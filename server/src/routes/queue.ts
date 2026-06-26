import { Router } from 'express';
import * as catalog from '../catalog.js';
import { isDecided } from '../store.js';

export const queueRouter = Router();

queueRouter.get('/queue', (req, res) => {
  const raw = Number.parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 20, 1), 100);
  const items = catalog.all().filter((i) => !isDecided(i.relPath)).slice(0, limit);
  res.json({ items });
});
