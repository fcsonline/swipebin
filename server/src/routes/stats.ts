import { Router } from 'express';
import * as catalog from '../catalog.js';
import { computeStats } from '../store.js';

export const statsRouter = Router();

statsRouter.get('/stats', (_req, res) => {
  res.json(computeStats(catalog.all()));
});
