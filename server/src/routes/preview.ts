import { Router } from 'express';
import { createReadStream } from 'node:fs';
import { getPreviewPath } from '../preview.js';
import { PREVIEW_WIDTH } from '../config.js';
import { folderOf } from './folders.js';

export const previewRouter = Router({ mergeParams: true });

previewRouter.get('/images/:id/preview', async (req, res) => {
  const folder = folderOf(res);
  const item = folder.byId.get(req.params.id);
  if (!item) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  if (item.kind === 'other') {
    res.status(415).json({ error: 'no preview for this file type' });
    return;
  }
  const raw = Number.parseInt(String(req.query.w ?? PREVIEW_WIDTH), 10);
  const width = Math.min(Math.max(Number.isFinite(raw) ? raw : PREVIEW_WIDTH, 64), 4096);

  try {
    const file = await getPreviewPath(folder.id, folder.root, item, width);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    createReadStream(file).pipe(res);
  } catch (err) {
    console.error(`Preview failed for ${item.relPath}:`, err);
    res.status(500).json({ error: 'preview failed' });
  }
});
