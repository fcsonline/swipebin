import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchQueue,
  fetchStats,
  fetchTrash,
  flushTrash,
  formatBytes,
  postDecision,
  postUndo,
  previewUrl,
  resetFolder,
  reviewAgain,
  type DecisionAction,
  type FileItem,
  type Stats,
  type TrashSummary,
} from '../api.js';
import { SwipeCard, type SwipeCommand } from './SwipeCard.js';
import { Controls } from './Controls.js';
import { StatsBar } from './StatsBar.js';
import { Summary } from './Summary.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { Lightbox } from './Lightbox.js';
import { CompressIcon, ExpandIcon, Logo, TrashIcon } from './icons.js';
import { useFullscreen } from '../useFullscreen.js';

const FETCH_BATCH = 24;
const REFILL_BELOW = 6;
const VISIBLE_STACK = 3;

interface Props {
  folderId: string;
  folderName: string;
  /** Show a "← Folders" button (multi-folder mode); false hides it (single folder). */
  showBack: boolean;
  onBack: () => void;
}

export function SwipeSession({ folderId, folderName, showBack, onBack }: Props) {
  const [cards, setCards] = useState<FileItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [command, setCommand] = useState<SwipeCommand | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trash, setTrash] = useState<TrashSummary>({ count: 0, bytes: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [freed, setFreed] = useState<TrashSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [zoomItem, setZoomItem] = useState<FileItem | null>(null);

  const seen = useRef<Set<string>>(new Set());
  const nonce = useRef(0);
  const fetching = useRef(false);

  const fullscreen = useFullscreen();

  const refill = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const { items } = await fetchQueue(folderId, FETCH_BATCH);
      const fresh = items.filter((i) => !seen.current.has(i.id));
      fresh.forEach((i) => seen.current.add(i.id));
      if (fresh.length > 0) setCards((prev) => [...prev, ...fresh]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      fetching.current = false;
    }
  }, [folderId]);

  useEffect(() => {
    (async () => {
      try {
        const [{ items }, s, t] = await Promise.all([
          fetchQueue(folderId, FETCH_BATCH),
          fetchStats(folderId),
          fetchTrash(folderId),
        ]);
        items.forEach((i) => seen.current.add(i.id));
        setCards(items);
        setStats(s);
        setTrash(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load files');
      } finally {
        setLoading(false);
      }
    })();
  }, [folderId]);

  const handleDecide = useCallback(
    (item: FileItem, action: DecisionAction) => {
      setCards((prev) => prev.filter((c) => c.id !== item.id));
      setCommand(null);
      setCanUndo(true);
      if (action === 'delete') {
        setTrash((t) => ({ count: t.count + 1, bytes: t.bytes + item.size }));
      }
      postDecision(folderId, item.id, action)
        .then((res) => setStats(res.stats))
        .catch((err) => setError(err instanceof Error ? err.message : 'Decision failed'));
    },
    [folderId],
  );

  useEffect(() => {
    if (!loading && cards.length < REFILL_BELOW) void refill();
  }, [cards.length, loading, refill]);

  // Close the zoom view if its image has left the deck (was kept/deleted/undone),
  // so a decided image can never linger as a zoomed preview.
  useEffect(() => {
    if (zoomItem && !cards.some((c) => c.id === zoomItem.id)) setZoomItem(null);
  }, [cards, zoomItem]);

  const triggerSwipe = useCallback((action: DecisionAction) => {
    nonce.current += 1;
    setCommand({ action, nonce: nonce.current });
  }, []);

  const handleUndo = useCallback(async () => {
    try {
      const res = await postUndo(folderId);
      setStats(res.stats);
      setCanUndo(false);
      if (res.ok && res.restored) {
        const restored = res.restored;
        if (res.undone?.action === 'delete') {
          setTrash((t) => ({
            count: Math.max(0, t.count - 1),
            bytes: Math.max(0, t.bytes - (restored.size ?? 0)),
          }));
        }
        seen.current.add(restored.id);
        setCards((prev) => (prev.some((c) => c.id === restored.id) ? prev : [restored, ...prev]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed');
    }
  }, [folderId]);

  const handleReviewAgain = useCallback(async () => {
    try {
      const res = await reviewAgain(folderId);
      seen.current.clear();
      setCanUndo(false);
      setFreed(null);
      setStats(res.stats);
      const { items } = await fetchQueue(folderId, FETCH_BATCH);
      items.forEach((i) => seen.current.add(i.id));
      setCards(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start another pass');
    }
  }, [folderId]);

  const handleDone = useCallback(async () => {
    try {
      await resetFolder(folderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset this folder');
      return;
    }
    if (showBack) {
      onBack();
      return;
    }
    // Single-folder mode has no picker — reload the now-fresh deck in place.
    seen.current.clear();
    setFreed(null);
    setCanUndo(false);
    setTrash({ count: 0, bytes: 0 });
    try {
      const [{ items }, s] = await Promise.all([
        fetchQueue(folderId, FETCH_BATCH),
        fetchStats(folderId),
      ]);
      items.forEach((i) => seen.current.add(i.id));
      setStats(s);
      setCards(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    }
  }, [folderId, showBack, onBack]);

  const doFlush = useCallback(async () => {
    setFlushing(true);
    try {
      const res = await flushTrash(folderId);
      setStats(res.stats);
      setTrash({ count: 0, bytes: 0 });
      setFreed((prev) => ({
        count: (prev?.count ?? 0) + res.count,
        bytes: (prev?.bytes ?? 0) + res.bytes,
      }));
      setToast(
        res.count > 0
          ? `Trash emptied — freed ${formatBytes(res.bytes)}`
          : 'Trash was already empty',
      );
    } catch {
      setToast('Failed to empty trash');
    } finally {
      setFlushing(false);
      setConfirmOpen(false);
    }
  }, [folderId]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || confirmOpen || zoomItem) return;
      if (e.key === 'ArrowRight') triggerSwipe('keep');
      else if (e.key === 'ArrowLeft') triggerSwipe('delete');
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') void handleUndo();
      else if (e.key === 'Escape' && showBack) onBack();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [triggerSwipe, handleUndo, confirmOpen, zoomItem, showBack, onBack]);

  const deck = cards.slice(0, VISIBLE_STACK);
  const empty = !loading && cards.length === 0;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__bar">
          <div className="app__bar-left">
            {showBack ? (
              <button className="back-btn" onClick={onBack} aria-label="Back to folders">
                ← Folders
              </button>
            ) : (
              <h1 className="app__title">
                <Logo size={30} />
              </h1>
            )}
            {showBack && <span className="session__folder">{folderName}</span>}
          </div>
          <div className="app__bar-right">
            {trash.count > 0 && (
              <button
                className="trash-skip"
                onClick={() => setConfirmOpen(true)}
                title="Empty trash now"
                aria-label={`Empty trash (${trash.count} files)`}
              >
                <TrashIcon size={17} />
                <span className="trash-skip__label">Empty trash</span>
                <span className="trash-skip__count">{trash.count}</span>
              </button>
            )}
            {fullscreen.supported && (
              <button
                type="button"
                className="fullscreen-btn"
                onClick={() => void fullscreen.toggle()}
                aria-label={fullscreen.isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                title={fullscreen.isFullscreen ? 'Exit full screen' : 'Full screen'}
              >
                {fullscreen.isFullscreen ? <CompressIcon size={18} /> : <ExpandIcon size={18} />}
              </button>
            )}
          </div>
        </div>
        <StatsBar stats={stats} />
      </header>

      <main className="deck">
        {loading && <div className="deck__msg">Loading…</div>}
        {error && <div className="deck__msg deck__msg--error">{error}</div>}

        {empty && !error && (
          <Summary
            stats={stats}
            trash={trash}
            freed={freed}
            onEmptyTrash={() => setConfirmOpen(true)}
            onReviewAgain={() => void handleReviewAgain()}
            onDone={() => void handleDone()}
          />
        )}

        {deck
          .map((item, i) => ({ item, i }))
          .reverse()
          .map(({ item, i }) => (
            <SwipeCard
              key={item.id}
              folderId={folderId}
              item={item}
              isTop={i === 0}
              stackIndex={i}
              command={i === 0 ? command : null}
              onDecide={handleDecide}
              onZoom={setZoomItem}
            />
          ))}
      </main>

      {!empty && (
        <footer className="app__footer">
          <Controls
            onKeep={() => triggerSwipe('keep')}
            onDelete={() => triggerSwipe('delete')}
            onUndo={() => void handleUndo()}
            canUndo={canUndo}
            disabled={loading || !!error}
          />
          <p className="app__hint">Swipe · or ← delete · → keep · Z undo</p>
        </footer>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Empty trash?"
        icon={<TrashIcon size={26} />}
        message={
          <>
            Permanently delete <strong>{trash.count}</strong>{' '}
            {trash.count === 1 ? 'file' : 'files'} ({formatBytes(trash.bytes)}) from the trash. This
            can't be undone.
          </>
        }
        confirmLabel="Delete forever"
        busy={flushing}
        onConfirm={() => void doFlush()}
        onCancel={() => setConfirmOpen(false)}
      />

      {toast && <div className="toast">{toast}</div>}

      {zoomItem && (
        <Lightbox
          src={previewUrl(folderId, zoomItem.id, 2048)}
          alt={zoomItem.name}
          onClose={() => setZoomItem(null)}
        />
      )}
    </div>
  );
}
