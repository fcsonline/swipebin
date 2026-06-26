import fs from 'node:fs/promises';
import path from 'node:path';
import { IGNORED_DIRS } from './config.js';
import type { FileItem, FileKind } from './types.js';

/** Browser-renderable formats handled directly by sharp/libvips. */
export const STANDARD_EXTS = new Set([
  'jpg', 'jpeg', 'jpe', 'png', 'webp', 'gif', 'tif', 'tiff', 'bmp', 'avif', 'heic', 'heif',
]);

/** Camera RAW formats — previewed via dcraw. */
export const RAW_EXTS = new Set([
  'cr2', 'cr3', 'crw', 'nef', 'nrw', 'arw', 'sr2', 'srf', 'raf', 'orf', 'rw2', 'rwl',
  'dng', 'pef', 'srw', 'kdc', 'dcr', 'x3f', 'mrw', 'mef', 'iiq', '3fr', 'erf', 'mos', 'raw',
]);

export function encodeId(relPath: string): string {
  return Buffer.from(relPath, 'utf8').toString('base64url');
}

export function decodeId(id: string): string {
  return Buffer.from(id, 'base64url').toString('utf8');
}

export function isRawExt(ext: string): boolean {
  return RAW_EXTS.has(ext);
}

export function isImageExt(ext: string): boolean {
  return STANDARD_EXTS.has(ext) || RAW_EXTS.has(ext);
}

function classify(ext: string): FileKind {
  if (isImageExt(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

/** Recursively scan `root` for ALL files, skipping hidden + ignored dirs. */
export async function scanImages(root: string): Promise<FileItem[]> {
  const out: FileItem[] = [];

  async function walk(absDir: string, relDir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      // Skip hidden entries (covers .trash, AppleDouble ._files, etc.) and ignored dirs.
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
      const childRel = relDir ? `${relDir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(path.join(absDir, entry.name), childRel);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        let stat;
        try {
          stat = await fs.stat(path.join(absDir, entry.name));
        } catch {
          continue;
        }
        out.push({
          id: encodeId(childRel),
          relPath: childRel,
          name: entry.name,
          ext,
          kind: classify(ext),
          isRaw: isRawExt(ext),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      }
    }
  }

  await walk(root, '');
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}
