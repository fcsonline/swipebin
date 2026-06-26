import { Router, type NextFunction, type Request, type Response } from 'express';
import * as catalog from '../catalog.js';
import type { FolderCatalog } from '../catalog.js';
import { computeStats, trashSummary } from '../store.js';

export const foldersRouter = Router();

/** Summary of every folder — powers the picker / resume hub. */
foldersRouter.get('/folders', async (_req, res) => {
  const out = await Promise.all(
    catalog.listFolders().map(async (f) => {
      const stats = computeStats(f.id, f.items);
      const trash = await trashSummary(f.root);
      return { id: f.id, name: f.name, coverImageId: f.items[0]?.id ?? null, ...stats, trash };
    }),
  );
  res.json({ folders: out });
});

/** Resolve :folderId into res.locals.folder, or 404. */
export function resolveFolder(req: Request, res: Response, next: NextFunction): void {
  const folder = catalog.getFolder(req.params.folderId);
  if (!folder) {
    res.status(404).json({ error: 'folder not found' });
    return;
  }
  res.locals.folder = folder;
  next();
}

export function folderOf(res: Response): FolderCatalog {
  return res.locals.folder as FolderCatalog;
}
