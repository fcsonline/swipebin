import { Router } from 'express';
import * as catalog from '../catalog.js';
import { computeStats, decide, undo } from '../store.js';
import type { DecisionAction } from '../types.js';

export const decisionRouter = Router();

decisionRouter.post('/images/:id/decision', async (req, res) => {
  const item = catalog.getById(req.params.id);
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
    const decision = await decide(item, action);
    res.json({ ok: true, decision, stats: computeStats(catalog.all()) });
  } catch (err) {
    console.error(`Decision failed for ${item.relPath}:`, err);
    res.status(500).json({ error: 'decision failed' });
  }
});

decisionRouter.post('/undo', async (_req, res) => {
  try {
    const entry = await undo();
    const stats = computeStats(catalog.all());
    if (!entry) {
      res.json({ ok: false, stats });
      return;
    }
    const restored = catalog.getByRelPath(entry.relPath) ?? { relPath: entry.relPath };
    res.json({ ok: true, restored, undone: entry, stats });
  } catch (err) {
    console.error('Undo failed:', err);
    res.status(500).json({ error: 'undo failed' });
  }
});
