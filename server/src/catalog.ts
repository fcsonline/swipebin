import fs from 'node:fs/promises';
import path from 'node:path';
import { scanImages } from './scanner.js';
import { FOLDERS_DIR, IGNORED_DIRS, IMAGES_DIR } from './config.js';
import type { FileItem } from './types.js';

export interface Folder {
  /** base64url(name) — stable across restarts. */
  id: string;
  name: string;
  /** absolute path of the folder root. */
  root: string;
}

export interface FolderCatalog extends Folder {
  items: FileItem[];
  byId: Map<string, FileItem>;
  byRelPath: Map<string, FileItem>;
}

export function encodeFolderId(name: string): string {
  return Buffer.from(name, 'utf8').toString('base64url');
}

let folders = new Map<string, FolderCatalog>();

/** Discover the folders to triage: subdirs of FOLDERS_DIR, else the legacy IMAGES_DIR. */
async function resolveFolders(): Promise<Folder[]> {
  const out: Folder[] = [];
  if (FOLDERS_DIR) {
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = await fs.readdir(FOLDERS_DIR, { withFileTypes: true });
    } catch {
      // FOLDERS_DIR missing — fall back below
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || IGNORED_DIRS.has(e.name)) continue;
      out.push({ id: encodeFolderId(e.name), name: e.name, root: path.join(FOLDERS_DIR, e.name) });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (out.length === 0) {
    const name = path.basename(IMAGES_DIR);
    out.push({ id: encodeFolderId(name), name, root: IMAGES_DIR });
  }
  return out;
}

/** (Re)discover folders and scan each one into the in-memory catalog. */
export async function refreshAll(): Promise<void> {
  const list = await resolveFolders();
  const next = new Map<string, FolderCatalog>();
  for (const f of list) {
    const items = await scanImages(f.root);
    next.set(f.id, {
      ...f,
      items,
      byId: new Map(items.map((i) => [i.id, i])),
      byRelPath: new Map(items.map((i) => [i.relPath, i])),
    });
  }
  folders = next;
}

export function listFolders(): FolderCatalog[] {
  return [...folders.values()];
}

export function getFolder(id: string): FolderCatalog | undefined {
  return folders.get(id);
}

export function folderCount(): number {
  return folders.size;
}

export function totalImages(): number {
  let n = 0;
  for (const f of folders.values()) n += f.items.length;
  return n;
}
