import express from 'express';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APP_DIR, IMAGES_DIR, PORT, WEB_DIR } from './config.js';
import * as catalog from './catalog.js';
import { computeStats, loadState } from './store.js';
import { queueRouter } from './routes/queue.js';
import { previewRouter } from './routes/preview.js';
import { decisionRouter } from './routes/decision.js';
import { statsRouter } from './routes/stats.js';
import { trashRouter } from './routes/trash.js';
import type { Stats } from './types.js';

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

function printBanner(stats: Stats): void {
  const lan = lanAddress();
  console.log('');
  console.log(`  🗑️  SwipeBin ready — ${stats.total.toLocaleString()} images found, ${stats.reviewed} reviewed`);
  console.log(`     ➜ Local:   http://localhost:${PORT}`);
  if (lan) console.log(`     ➜ Network: http://${lan}:${PORT}   (open on your phone)`);
  console.log('');
}

async function main(): Promise<void> {
  await loadState();
  await catalog.refresh();

  if (catalog.all().length === 0) {
    console.warn(`  ⚠️  No images found in ${IMAGES_DIR} — mount your photos there (or check IMAGES_DIR).`);
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use(queueRouter);
  api.use(previewRouter);
  api.use(decisionRouter);
  api.use(statsRouter);
  api.use(trashRouter);
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
    console.log(`  Images:  ${IMAGES_DIR}`);
    console.log(`  State:   ${APP_DIR}`);
    printBanner(computeStats(catalog.all()));
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
