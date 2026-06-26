import { Router } from 'express';
import * as catalog from '../catalog.js';
import { computeStats, flushTrash, trashSummary } from '../store.js';

export const trashRouter = Router();

trashRouter.get('/trash', async (_req, res) => {
  res.json(await trashSummary());
});

trashRouter.post('/trash/flush', async (_req, res) => {
  try {
    const freed = await flushTrash();
    res.json({ ok: true, ...freed, stats: computeStats(catalog.all()) });
  } catch (err) {
    console.error('Flush trash failed:', err);
    res.status(500).json({ error: 'flush failed' });
  }
});
