import { Router } from 'express';
import { computeStats } from '../store.js';
import { folderOf } from './folders.js';

export const statsRouter = Router({ mergeParams: true });

statsRouter.get('/stats', (_req, res) => {
  const folder = folderOf(res);
  res.json(computeStats(folder.id, folder.items));
});
