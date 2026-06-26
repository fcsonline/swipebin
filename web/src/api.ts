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

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export function previewUrl(item: ImageItem, width = 1080): string {
  return `/api/images/${item.id}/preview?w=${width}`;
}

export function fetchQueue(limit = 20): Promise<{ items: ImageItem[] }> {
  return jsonFetch(`/api/queue?limit=${limit}`);
}

export function fetchStats(): Promise<Stats> {
  return jsonFetch('/api/stats');
}

export function postDecision(
  id: string,
  action: DecisionAction,
): Promise<{ ok: boolean; stats: Stats }> {
  return jsonFetch(`/api/images/${id}/decision`, {
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

export function postUndo(): Promise<{
  ok: boolean;
  restored?: ImageItem;
  undone?: UndoneEntry;
  stats: Stats;
}> {
  return jsonFetch('/api/undo', { method: 'POST' });
}

export interface TrashSummary {
  count: number;
  bytes: number;
}

export function fetchTrash(): Promise<TrashSummary> {
  return jsonFetch('/api/trash');
}

export function flushTrash(): Promise<{ ok: boolean; count: number; bytes: number; stats: Stats }> {
  return jsonFetch('/api/trash/flush', { method: 'POST' });
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
