import fs from 'node:fs/promises';
import path from 'node:path';
import { APP_DIR, IMAGES_DIR, STATE_FILE, TRASH_DIRNAME } from './config.js';
import type { Decision, DecisionAction, ImageItem, StateData, Stats, UndoLogEntry } from './types.js';

const MAX_UNDO_LOG = 200;

let state: StateData = { decisions: {}, undoLog: [] };

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

export async function loadState(): Promise<void> {
  await fs.mkdir(APP_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StateData>;
    state = {
      decisions: parsed.decisions ?? {},
      undoLog: parsed.undoLog ?? [],
    };
  } catch {
    state = { decisions: {}, undoLog: [] };
  }
}

// Serialize writes so concurrent decisions never interleave a partial file.
let writeChain: Promise<void> = Promise.resolve();
function persist(): Promise<void> {
  const snapshot = JSON.stringify(state, null, 2);
  writeChain = writeChain.then(async () => {
    const tmp = `${STATE_FILE}.tmp`;
    await fs.writeFile(tmp, snapshot, 'utf8');
    await fs.rename(tmp, STATE_FILE);
  }).catch((err) => {
    console.error('Failed to persist state:', err);
  });
  return writeChain;
}

export function isDecided(relPath: string): boolean {
  return Object.prototype.hasOwnProperty.call(state.decisions, relPath);
}

export function getDecision(relPath: string): Decision | undefined {
  return state.decisions[relPath];
}

/** Find a destination in .trash that doesn't clobber an existing file. */
async function uniqueTrashDest(relPath: string): Promise<string> {
  const base = path.join(IMAGES_DIR, TRASH_DIRNAME, relPath);
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

async function moveToTrash(relPath: string): Promise<string> {
  const src = path.join(IMAGES_DIR, relPath);
  const dest = await uniqueTrashDest(relPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(src, dest);
  return toPosix(path.relative(IMAGES_DIR, dest));
}

export async function decide(item: ImageItem, action: DecisionAction): Promise<Decision> {
  const decision: Decision = { action, at: new Date().toISOString() };
  if (action === 'delete') {
    decision.trashRelPath = await moveToTrash(item.relPath);
  }
  state.decisions[item.relPath] = decision;
  state.undoLog.push({
    relPath: item.relPath,
    action,
    trashRelPath: decision.trashRelPath,
    at: decision.at,
  });
  if (state.undoLog.length > MAX_UNDO_LOG) state.undoLog.shift();
  await persist();
  return decision;
}

/** Revert the most recent decision. Restores trashed files back to their original path. */
export async function undo(): Promise<UndoLogEntry | null> {
  const entry = state.undoLog.pop();
  if (!entry) return null;

  if (entry.action === 'delete' && entry.trashRelPath) {
    const trashAbs = path.join(IMAGES_DIR, entry.trashRelPath);
    const dest = path.join(IMAGES_DIR, entry.relPath);
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.rename(trashAbs, dest);
    } catch (err) {
      console.error(`Undo could not restore ${entry.relPath}:`, err);
    }
  }

  delete state.decisions[entry.relPath];
  await persist();
  return entry;
}

export interface TrashSummary {
  count: number;
  bytes: number;
}

/** Count and total size of everything currently in .trash. */
export async function trashSummary(): Promise<TrashSummary> {
  const trashDir = path.join(IMAGES_DIR, TRASH_DIRNAME);
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

/** Permanently delete everything in .trash. Deleted files can no longer be undone. */
export async function flushTrash(): Promise<TrashSummary> {
  const trashDir = path.join(IMAGES_DIR, TRASH_DIRNAME);
  const summary = await trashSummary();
  await fs.rm(trashDir, { recursive: true, force: true });
  // The files backing 'delete' decisions are gone now — drop those from the undo history.
  state.undoLog = state.undoLog.filter((e) => e.action !== 'delete');
  await persist();
  return summary;
}

export function computeStats(items: ImageItem[]): Stats {
  const values = Object.values(state.decisions);
  const kept = values.filter((d) => d.action === 'keep').length;
  const deleted = values.filter((d) => d.action === 'delete').length;
  const reviewed = kept + deleted;
  // `items` excludes trashed files (deleted), so undecided count = items without a decision.
  const remaining = items.filter((i) => !isDecided(i.relPath)).length;
  return { total: remaining + reviewed, reviewed, kept, deleted, remaining };
}
