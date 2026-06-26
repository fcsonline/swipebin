import fs from 'node:fs/promises';
import path from 'node:path';
import { APP_DIR, IMAGES_DIR, STATE_FILE, TRASH_DIRNAME } from './config.js';
import type { Decision, DecisionAction, FileItem, Stats, UndoLogEntry } from './types.js';

const MAX_UNDO_LOG = 200;

interface RootState {
  decisions: Record<string, Decision>;
  undoLog: UndoLogEntry[];
}
interface MultiState {
  folders: Record<string, RootState>;
}

let state: MultiState = { folders: {} };

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Id of the single legacy folder (matches catalog's encodeFolderId(basename(IMAGES_DIR))). */
function legacyFolderId(): string {
  return Buffer.from(path.basename(IMAGES_DIR), 'utf8').toString('base64url');
}

export async function loadState(): Promise<void> {
  await fs.mkdir(APP_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.folders) {
      state = { folders: parsed.folders as Record<string, RootState> };
    } else if (parsed.decisions || parsed.undoLog) {
      // Migrate the old flat { decisions, undoLog } shape under the legacy folder id.
      state = {
        folders: {
          [legacyFolderId()]: {
            decisions: (parsed.decisions as Record<string, Decision>) ?? {},
            undoLog: (parsed.undoLog as UndoLogEntry[]) ?? [],
          },
        },
      };
    } else {
      state = { folders: {} };
    }
  } catch {
    state = { folders: {} };
  }
}

// Serialize writes so concurrent decisions never interleave a partial file.
let writeChain: Promise<void> = Promise.resolve();
function persist(): Promise<void> {
  const snapshot = JSON.stringify(state, null, 2);
  writeChain = writeChain
    .then(async () => {
      const tmp = `${STATE_FILE}.tmp`;
      await fs.writeFile(tmp, snapshot, 'utf8');
      await fs.rename(tmp, STATE_FILE);
    })
    .catch((err) => {
      console.error('Failed to persist state:', err);
    });
  return writeChain;
}

function bucket(folderId: string): RootState {
  let b = state.folders[folderId];
  if (!b) {
    b = { decisions: {}, undoLog: [] };
    state.folders[folderId] = b;
  }
  return b;
}

export function isDecided(folderId: string, relPath: string): boolean {
  return Object.prototype.hasOwnProperty.call(bucket(folderId).decisions, relPath);
}

export function getDecision(folderId: string, relPath: string): Decision | undefined {
  return bucket(folderId).decisions[relPath];
}

/** Find a destination in <root>/.trash that doesn't clobber an existing file. */
async function uniqueTrashDest(root: string, relPath: string): Promise<string> {
  const base = path.join(root, TRASH_DIRNAME, relPath);
  const dir = path.dirname(base);
  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(dir, `${stem} (${n})${ext}`);
      n += 1;
    } catch {
      return candidate;
    }
  }
}

async function moveToTrash(root: string, relPath: string): Promise<string> {
  const src = path.join(root, relPath);
  const dest = await uniqueTrashDest(root, relPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(src, dest);
  return toPosix(path.relative(root, dest));
}

export async function decide(
  folderId: string,
  root: string,
  item: FileItem,
  action: DecisionAction,
): Promise<Decision> {
  const b = bucket(folderId);
  const decision: Decision = { action, at: new Date().toISOString() };
  if (action === 'delete') {
    decision.trashRelPath = await moveToTrash(root, item.relPath);
  }
  b.decisions[item.relPath] = decision;
  b.undoLog.push({ relPath: item.relPath, action, trashRelPath: decision.trashRelPath, at: decision.at });
  if (b.undoLog.length > MAX_UNDO_LOG) b.undoLog.shift();
  await persist();
  return decision;
}

/** Revert the most recent decision in a folder. Restores trashed files to their original path. */
export async function undo(folderId: string, root: string): Promise<UndoLogEntry | null> {
  const b = bucket(folderId);
  const entry = b.undoLog.pop();
  if (!entry) return null;

  if (entry.action === 'delete' && entry.trashRelPath) {
    const trashAbs = path.join(root, entry.trashRelPath);
    const dest = path.join(root, entry.relPath);
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.rename(trashAbs, dest);
    } catch (err) {
      console.error(`Undo could not restore ${entry.relPath}:`, err);
    }
  }

  delete b.decisions[entry.relPath];
  await persist();
  return entry;
}

export interface TrashSummary {
  count: number;
  bytes: number;
}

/** Count and total size of everything in <root>/.trash. */
export async function trashSummary(root: string): Promise<TrashSummary> {
  const trashDir = path.join(root, TRASH_DIRNAME);
  let count = 0;
  let bytes = 0;
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(p);
      } else if (entry.isFile()) {
        try {
          const s = await fs.stat(p);
          count += 1;
          bytes += s.size;
        } catch {
          // ignore unreadable entries
        }
      }
    }
  }
  await walk(trashDir);
  return { count, bytes };
}

/** Permanently delete a folder's .trash. Its deleted files can no longer be undone. */
export async function flushTrash(folderId: string, root: string): Promise<TrashSummary> {
  const summary = await trashSummary(root);
  await fs.rm(path.join(root, TRASH_DIRNAME), { recursive: true, force: true });
  const b = bucket(folderId);
  b.undoLog = b.undoLog.filter((e) => e.action !== 'delete');
  await persist();
  return summary;
}

export function computeStats(folderId: string, items: FileItem[]): Stats {
  const values = Object.values(bucket(folderId).decisions);
  const kept = values.filter((d) => d.action === 'keep').length;
  const deleted = values.filter((d) => d.action === 'delete').length;
  const reviewed = kept + deleted;
  const remaining = items.filter((i) => !isDecided(folderId, i.relPath)).length;
  return { total: remaining + reviewed, reviewed, kept, deleted, remaining };
}
