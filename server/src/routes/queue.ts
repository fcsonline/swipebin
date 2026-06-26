import { Router } from 'express';
import { isDecided } from '../store.js';
import { folderOf } from './folders.js';

export const queueRouter = Router({ mergeParams: true });

queueRouter.get('/queue', (req, res) => {
  const folder = folderOf(res);
  const raw = Number.parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 20, 1), 100);
  const items = folder.items.filter((i) => !isDecided(folder.id, i.relPath)).slice(0, limit);
  res.json({ items });
});
