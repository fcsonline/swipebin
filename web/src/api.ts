export type DecisionAction = 'keep' | 'delete';

export interface ImageItem {
  id: string;
  relPath: string;
  name: string;
  ext: string;
  isRaw: boolean;
  size: number;
  mtimeMs: number;
}

export interface Stats {
  total: number;
  reviewed: number;
  kept: number;
  deleted: number;
  remaining: number;
}

export interface TrashSummary {
  count: number;
  bytes: number;
}

export interface FolderSummary extends Stats {
  id: string;
  name: string;
  coverImageId: string | null;
  trash: TrashSummary;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

const base = (folderId: string) => `/api/folders/${encodeURIComponent(folderId)}`;

export function previewUrl(folderId: string, imageId: string, width = 1080): string {
  return `${base(folderId)}/images/${imageId}/preview?w=${width}`;
}

export function fetchFolders(): Promise<{ folders: FolderSummary[] }> {
  return jsonFetch('/api/folders');
}

export function fetchQueue(folderId: string, limit = 20): Promise<{ items: ImageItem[] }> {
  return jsonFetch(`${base(folderId)}/queue?limit=${limit}`);
}

export function fetchStats(folderId: string): Promise<Stats> {
  return jsonFetch(`${base(folderId)}/stats`);
}

export function postDecision(
  folderId: string,
  id: string,
  action: DecisionAction,
): Promise<{ ok: boolean; stats: Stats }> {
  return jsonFetch(`${base(folderId)}/images/${id}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

export interface UndoneEntry {
  relPath: string;
  action: DecisionAction;
  at: string;
}

export function postUndo(folderId: string): Promise<{
  ok: boolean;
  restored?: ImageItem;
  undone?: UndoneEntry;
  stats: Stats;
}> {
  return jsonFetch(`${base(folderId)}/undo`, { method: 'POST' });
}

export function fetchTrash(folderId: string): Promise<TrashSummary> {
  return jsonFetch(`${base(folderId)}/trash`);
}

export function flushTrash(
  folderId: string,
): Promise<{ ok: boolean; count: number; bytes: number; stats: Stats }> {
  return jsonFetch(`${base(folderId)}/trash/flush`, { method: 'POST' });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
