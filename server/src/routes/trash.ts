import { Router } from 'express';
import { computeStats, flushTrash, trashSummary } from '../store.js';
import { folderOf } from './folders.js';

export const trashRouter = Router({ mergeParams: true });

trashRouter.get('/trash', async (_req, res) => {
  const folder = folderOf(res);
  res.json(await trashSummary(folder.root));
});

trashRouter.post('/trash/flush', async (_req, res) => {
  const folder = folderOf(res);
  try {
    const freed = await flushTrash(folder.id, folder.root);
    res.json({ ok: true, ...freed, stats: computeStats(folder.id, folder.items) });
  } catch (err) {
    console.error('Flush trash failed:', err);
    res.status(500).json({ error: 'flush failed' });
  }
});
