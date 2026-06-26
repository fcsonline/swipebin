import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchQueue,
  fetchStats,
  fetchTrash,
  flushTrash,
  formatBytes,
  postDecision,
  postUndo,
  type DecisionAction,
  type ImageItem,
  type Stats,
  type TrashSummary,
} from './api.js';
import { SwipeCard, type SwipeCommand } from './components/SwipeCard.js';
import { Controls } from './components/Controls.js';
import { StatsBar } from './components/StatsBar.js';
import { Summary } from './components/Summary.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { Logo, TrashIcon } from './components/icons.js';

const FETCH_BATCH = 24;
const REFILL_BELOW = 6;
const VISIBLE_STACK = 3;

export function App() {
  const [cards, setCards] = useState<ImageItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [command, setCommand] = useState<SwipeCommand | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live trash tracking (kept in sync optimistically: a move preserves file size).
  const [trash, setTrash] = useState<TrashSummary>({ count: 0, bytes: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushed, setFlushed] = useState<TrashSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // IDs ever placed in the deck, so refills don't reintroduce duplicates.
  const seen = useRef<Set<string>>(new Set());
  const nonce = useRef(0);
  const fetching = useRef(false);

  const refill = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const { items } = await fetchQueue(FETCH_BATCH);
      const fresh = items.filter((i) => !seen.current.has(i.id));
      fresh.forEach((i) => seen.current.add(i.id));
      if (fresh.length > 0) setCards((prev) => [...prev, ...fresh]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      fetching.current = false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [{ items }, s, t] = await Promise.all([
          fetchQueue(FETCH_BATCH),
          fetchStats(),
          fetchTrash(),
        ]);
        items.forEach((i) => seen.current.add(i.id));
        setCards(items);
        setStats(s);
        setTrash(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load images');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDecide = useCallback((item: ImageItem, action: DecisionAction) => {
    setCards((prev) => prev.filter((c) => c.id !== item.id));
    setCommand(null);
    setCanUndo(true);
    if (action === 'delete') {
      setTrash((t) => ({ count: t.count + 1, bytes: t.bytes + item.size }));
    }
    postDecision(item.id, action)
      .then((res) => setStats(res.stats))
      .catch((err) => setError(err instanceof Error ? err.message : 'Decision failed'));
  }, []);

  // Refill when the deck runs low.
  useEffect(() => {
    if (!loading && cards.length < REFILL_BELOW) void refill();
  }, [cards.length, loading, refill]);

  const triggerSwipe = useCallback((action: DecisionAction) => {
    nonce.current += 1;
    setCommand({ action, nonce: nonce.current });
  }, []);

  const handleUndo = useCallback(async () => {
    try {
      const res = await postUndo();
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
  }, []);

  const doFlush = useCallback(async () => {
    setFlushing(true);
    try {
      const res = await flushTrash();
      setStats(res.stats);
      setTrash({ count: 0, bytes: 0 });
      setFlushed({ count: res.count, bytes: res.bytes });
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
  }, []);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Keyboard shortcuts: ← delete, → keep, Z undo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || confirmOpen) return;
      if (e.key === 'ArrowRight') triggerSwipe('keep');
      else if (e.key === 'ArrowLeft') triggerSwipe('delete');
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') void handleUndo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [triggerSwipe, handleUndo, confirmOpen]);

  const deck = cards.slice(0, VISIBLE_STACK);
  const empty = !loading && cards.length === 0;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__bar">
          <h1 className="app__title">
            <Logo size={30} />
          </h1>
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
            flushed={flushed}
            onEmptyTrash={() => setConfirmOpen(true)}
          />
        )}

        {/* Render back-to-front so the top card paints last. */}
        {deck
          .map((item, i) => ({ item, i }))
          .reverse()
          .map(({ item, i }) => (
            <SwipeCard
              key={item.id}
              item={item}
              isTop={i === 0}
              stackIndex={i}
              command={i === 0 ? command : null}
              onDecide={handleDecide}
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
    </div>
  );
}
