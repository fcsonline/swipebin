import { scanImages } from './scanner.js';
import type { ImageItem } from './types.js';

let items: ImageItem[] = [];
let byId = new Map<string, ImageItem>();
let byRelPath = new Map<string, ImageItem>();

/** Re-scan IMAGES_DIR and rebuild the in-memory catalog. */
export async function refresh(): Promise<void> {
  items = await scanImages();
  byId = new Map(items.map((i) => [i.id, i]));
  byRelPath = new Map(items.map((i) => [i.relPath, i]));
}

export function all(): ImageItem[] {
  return items;
}

export function getById(id: string): ImageItem | undefined {
  return byId.get(id);
}

export function getByRelPath(relPath: string): ImageItem | undefined {
  return byRelPath.get(relPath);
}
