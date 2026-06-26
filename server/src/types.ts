export type DecisionAction = 'keep' | 'delete';

export interface ImageItem {
  /** base64url(relPath) — stable across restarts, decodes back to the path. */
  id: string;
  /** POSIX-style path relative to IMAGES_DIR. */
  relPath: string;
  name: string;
  /** lowercased extension, no leading dot. */
  ext: string;
  isRaw: boolean;
  size: number;
  mtimeMs: number;
}

export interface Decision {
  action: DecisionAction;
  at: string;
  /** Where the file was moved (delete only), relative to IMAGES_DIR. */
  trashRelPath?: string;
}

export interface UndoLogEntry {
  relPath: string;
  action: DecisionAction;
  trashRelPath?: string;
  at: string;
}

export interface StateData {
  decisions: Record<string, Decision>;
  undoLog: UndoLogEntry[];
}

export interface Stats {
  total: number;
  reviewed: number;
  kept: number;
  deleted: number;
  remaining: number;
}
