import express from 'express';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { APP_DIR, FOLDERS_DIR, IMAGES_DIR, PORT, PUBLIC_HOST, PUBLIC_URL, WEB_DIR } from './config.js';
import * as catalog from './catalog.js';
import { loadState } from './store.js';
import { foldersRouter, resolveFolder } from './routes/folders.js';
import { queueRouter } from './routes/queue.js';
import { previewRouter } from './routes/preview.js';
import { decisionRouter } from './routes/decision.js';
import { statsRouter } from './routes/stats.js';
import { trashRouter } from './routes/trash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = WEB_DIR || path.resolve(__dirname, '../../web/dist');

function lanAddress(): string | undefined {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return undefined;
}

/** The address phones should open. PUBLIC_URL/PUBLIC_HOST override the detected IP. */
function networkUrl(): string {
  if (PUBLIC_URL) return PUBLIC_URL;
  const host = PUBLIC_HOST || lanAddress();
  return host ? `http://${host}:${PORT}` : `http://localhost:${PORT}`;
}

async function printBanner(folders: number, images: number): Promise<void> {
  const url = networkUrl();
  const inDocker = existsSync('/.dockerenv');
  const folderPart = folders === 1 ? '1 folder' : `${folders.toLocaleString()} folders`;
  console.log('');
  console.log(`  🗑️  SwipeBin ready — ${folderPart} · ${images.toLocaleString()} images`);
  console.log(`     ➜ Local:   http://localhost:${PORT}`);
  console.log(`     ➜ Network: ${url}`);
  if (inDocker && !PUBLIC_URL && !PUBLIC_HOST) {
    console.log('       (set PUBLIC_HOST=<your LAN IP> for a phone-reachable address)');
  }
  console.log('');
  try {
    const qr = await QRCode.toString(url, { type: 'terminal', small: true });
    console.log('  📱 Scan to open on your phone:');
    console.log(qr.replace(/^/gm, '  '));
  } catch {
    // QR rendering is best-effort; the URL above is always printed.
  }
}

async function main(): Promise<void> {
  await loadState();
  await catalog.refreshAll();

  if (catalog.totalImages() === 0) {
    const where = FOLDERS_DIR ? `${FOLDERS_DIR}/<folder>` : IMAGES_DIR;
    console.warn(`  ⚠️  No images found — mount your photos under ${where}.`);
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use(foldersRouter); // GET /folders

  // All per-image work is scoped to a folder.
  const scoped = express.Router({ mergeParams: true });
  scoped.use(resolveFolder);
  scoped.use(queueRouter);
  scoped.use(previewRouter);
  scoped.use(decisionRouter);
  scoped.use(statsRouter);
  scoped.use(trashRouter);
  api.use('/folders/:folderId', scoped);

  app.use('/api', api);
  // Unmatched API routes return JSON, not the SPA shell.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

  if (existsSync(webDir)) {
    app.use(express.static(webDir));
    app.get('*', (_req, res) => res.sendFile(path.join(webDir, 'index.html')));
  } else {
    console.warn(`  ⚠️  Frontend not built at ${webDir}. In dev, use the Vite server on :5173.`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`  Folders: ${FOLDERS_DIR || IMAGES_DIR}`);
    console.log(`  State:   ${APP_DIR}`);
    void printBanner(catalog.folderCount(), catalog.totalImages());
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
