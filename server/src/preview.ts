import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { CACHE_DIR, PREVIEW_QUALITY } from './config.js';
import type { FileItem } from './types.js';

function cacheKey(folderId: string, item: FileItem, width: number): string {
  const h = crypto.createHash('sha1');
  h.update(`${folderId}|${item.relPath}|${item.mtimeMs}|${item.size}|${width}|q${PREVIEW_QUALITY}`);
  return `${h.digest('hex')}.jpg`;
}

/** Run a command, returning its stdout as a Buffer (rejects on non-zero exit). */
function run(cmd: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => out.push(c));
    proc.stderr.on('data', (c: Buffer) => err.push(c));
    proc.on('error', reject); // e.g. binary not installed
    proc.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err).toString().trim()}`));
    });
  });
}

function toJpeg(input: Buffer, width: number): Promise<Buffer> {
  return sharp(input, { failOn: 'none' })
    .rotate() // auto-orient from EXIF
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: PREVIEW_QUALITY, mozjpeg: true })
    .toBuffer();
}

/** Convert a RAW file to a web-safe JPEG buffer. */
async function rawToJpeg(srcAbs: string, width: number): Promise<Buffer> {
  // Fast path: extract the embedded JPEG preview most RAW files carry.
  try {
    const embedded = await run('dcraw', ['-e', '-c', srcAbs]);
    if (embedded.length > 0) return await toJpeg(embedded, width);
  } catch {
    // fall through to a full demosaic
  }
  // Fallback: demosaic the sensor data (half-size for speed) and emit PPM on stdout.
  const ppm = await run('dcraw', ['-c', '-w', '-h', srcAbs]);
  return toJpeg(ppm, width);
}

/** Render a PDF's first page to a web-safe JPEG buffer (via poppler's pdftoppm). */
async function pdfToJpeg(srcAbs: string, width: number): Promise<Buffer> {
  // pdftoppm doesn't reliably stream to stdout across versions, so render to a
  // temp file (`-singlefile` writes <prefix>.jpg) and read it back.
  const prefix = path.join(CACHE_DIR, `.pdf-${process.pid}-${Date.now()}`);
  const outFile = `${prefix}.jpg`;
  try {
    await run('pdftoppm', [
      '-jpeg',
      '-f', '1', '-l', '1',
      '-singlefile',
      '-scale-to', String(Math.min(width, 2000)),
      srcAbs,
      prefix,
    ]);
    return await toJpeg(await fs.readFile(outFile), width);
  } finally {
    await fs.rm(outFile, { force: true }).catch(() => {});
  }
}

/**
 * Return a path to a cached JPEG preview for `item`, generating and caching it on a miss.
 * The cache key includes mtime + size, so edited files regenerate automatically.
 */
export async function getPreviewPath(
  folderId: string,
  root: string,
  item: FileItem,
  width: number,
): Promise<string> {
  if (item.kind === 'other') throw new Error('no preview for this file type');
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheKey(folderId, item, width));
  try {
    await fs.access(cachePath);
    return cachePath;
  } catch {
    // cache miss — generate below
  }

  const srcAbs = path.join(root, item.relPath);
  let buffer: Buffer;
  if (item.kind === 'pdf') buffer = await pdfToJpeg(srcAbs, width);
  else if (item.isRaw) buffer = await rawToJpeg(srcAbs, width);
  else buffer = await toJpeg(await fs.readFile(srcAbs), width);

  const tmp = `${cachePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, cachePath);
  return cachePath;
}
