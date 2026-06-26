import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { CACHE_DIR, IMAGES_DIR, PREVIEW_QUALITY } from './config.js';
import type { ImageItem } from './types.js';

function cacheKey(item: ImageItem, width: number): string {
  const h = crypto.createHash('sha1');
  h.update(`${item.relPath}|${item.mtimeMs}|${item.size}|${width}|q${PREVIEW_QUALITY}`);
  return `${h.digest('hex')}.jpg`;
}

/** Run dcraw with the given args, returning its stdout as a Buffer. */
function runDcraw(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn('dcraw', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => out.push(c));
    proc.stderr.on('data', (c: Buffer) => err.push(c));
    proc.on('error', reject); // e.g. dcraw not installed
    proc.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`dcraw exited ${code}: ${Buffer.concat(err).toString().trim()}`));
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
    const embedded = await runDcraw(['-e', '-c', srcAbs]);
    if (embedded.length > 0) return await toJpeg(embedded, width);
  } catch {
    // fall through to a full demosaic
  }
  // Fallback: demosaic the sensor data (half-size for speed) and emit PPM on stdout.
  const ppm = await runDcraw(['-c', '-w', '-h', srcAbs]);
  return toJpeg(ppm, width);
}

/**
 * Return a path to a cached JPEG preview for `item`, generating and caching it on a miss.
 * The cache key includes mtime + size, so edited files regenerate automatically.
 */
export async function getPreviewPath(item: ImageItem, width: number): Promise<string> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheKey(item, width));
  try {
    await fs.access(cachePath);
    return cachePath;
  } catch {
    // cache miss — generate below
  }

  const srcAbs = path.join(IMAGES_DIR, item.relPath);
  const buffer = item.isRaw ? await rawToJpeg(srcAbs, width) : await toJpeg(await fs.readFile(srcAbs), width);

  const tmp = `${cachePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, cachePath);
  return cachePath;
}
