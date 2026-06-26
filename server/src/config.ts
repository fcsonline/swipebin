import path from 'node:path';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Folder of images to triage (mount your photos here in Docker). */
export const IMAGES_DIR = path.resolve(process.env.IMAGES_DIR ?? 'photos');

/** Where state.json and the preview cache live. */
export const APP_DIR = path.resolve(process.env.APP_DIR ?? 'data');
export const CACHE_DIR = path.join(APP_DIR, 'cache');
export const STATE_FILE = path.join(APP_DIR, 'state.json');

/** Built frontend to serve. Defaults to ../../web/dist relative to this file. */
export const WEB_DIR = process.env.WEB_DIR ?? '';

/**
 * Externally-reachable address shown in the banner + QR code (so phones can connect).
 * Inside Docker the auto-detected IP is the container's, not the host's — set one of
 * these to your host's LAN IP/URL. PUBLIC_URL wins; otherwise PUBLIC_HOST + PORT.
 */
export const PUBLIC_URL = process.env.PUBLIC_URL ?? '';
export const PUBLIC_HOST = process.env.PUBLIC_HOST ?? '';

/** Deleted images are moved here, inside IMAGES_DIR so the move is an atomic rename. */
export const TRASH_DIRNAME = '.trash';

export const PORT = envInt('PORT', 3000);
export const PREVIEW_WIDTH = envInt('PREVIEW_WIDTH', 1080);
export const PREVIEW_QUALITY = envInt('PREVIEW_QUALITY', 80);

/** Directory names the scanner must never descend into. */
export const IGNORED_DIRS = new Set([TRASH_DIRNAME, '.swipebin', '@eaDir']);
