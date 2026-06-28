import { Router } from 'express';
import { computeStats, decide, resetFolder, resetKept, undo } from '../store.js';
import type { DecisionAction } from '../types.js';
import { folderOf } from './folders.js';

export const decisionRouter = Router({ mergeParams: true });

decisionRouter.post('/images/:id/decision', async (req, res) => {
  const folder = folderOf(res);
  const item = folder.byId.get(req.params.id);
  if (!item) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const action = req.body?.action as DecisionAction | undefined;
  if (action !== 'keep' && action !== 'delete') {
    res.status(400).json({ error: 'action must be "keep" or "delete"' });
    return;
  }
  try {
    const decision = await decide(folder.id, folder.root, item, action);
    res.json({ ok: true, decision, stats: computeStats(folder.id, folder.items) });
  } catch (err) {
    console.error(`Decision failed for ${item.relPath}:`, err);
    res.status(500).json({ error: 'decision failed' });
  }
});

decisionRouter.post('/reset', async (_req, res) => {
  const folder = folderOf(res);
  try {
    await resetFolder(folder.id);
    res.json({ ok: true, stats: computeStats(folder.id, folder.items) });
  } catch (err) {
    console.error('Reset failed:', err);
    res.status(500).json({ error: 'reset failed' });
  }
});

decisionRouter.post('/review-again', async (_req, res) => {
  const folder = folderOf(res);
  try {
    await resetKept(folder.id);
    res.json({ ok: true, stats: computeStats(folder.id, folder.items) });
  } catch (err) {
    console.error('Review-again failed:', err);
    res.status(500).json({ error: 'review-again failed' });
  }
});

decisionRouter.post('/undo', async (_req, res) => {
  const folder = folderOf(res);
  try {
    const entry = await undo(folder.id, folder.root);
    const stats = computeStats(folder.id, folder.items);
    if (!entry) {
      res.json({ ok: false, stats });
      return;
    }
    const restored = folder.byRelPath.get(entry.relPath) ?? { relPath: entry.relPath };
    res.json({ ok: true, restored, undone: entry, stats });
  } catch (err) {
    console.error('Undo failed:', err);
    res.status(500).json({ error: 'undo failed' });
  }
});
