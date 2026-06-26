import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchQueue,
  fetchStats,
  postDecision,
  postUndo,
  type DecisionAction,
  type ImageItem,
  type Stats,
} from './api.js';
import { SwipeCard, type SwipeCommand } from './components/SwipeCard.js';
import { Controls } from './components/Controls.js';
import { StatsBar } from './components/StatsBar.js';

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
        const [{ items }, s] = await Promise.all([fetchQueue(FETCH_BATCH), fetchStats()]);
        items.forEach((i) => seen.current.add(i.id));
        setCards(items);
        setStats(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load images');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDecide = useCallback(
    (item: ImageItem, action: DecisionAction) => {
      setCards((prev) => prev.filter((c) => c.id !== item.id));
      setCommand(null);
      setCanUndo(true);
      postDecision(item.id, action)
        .then((res) => setStats(res.stats))
        .catch((err) => setError(err instanceof Error ? err.message : 'Decision failed'));
    },
    [],
  );

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
        seen.current.add(restored.id);
        setCards((prev) =>
          prev.some((c) => c.id === restored.id) ? prev : [restored, ...prev],
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed');
    }
  }, []);

  // Keyboard shortcuts: ← delete, → keep, Z undo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.key === 'ArrowRight') triggerSwipe('keep');
      else if (e.key === 'ArrowLeft') triggerSwipe('delete');
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') void handleUndo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [triggerSwipe, handleUndo]);

  const deck = cards.slice(0, VISIBLE_STACK);
  const empty = !loading && cards.length === 0;

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">🗑️ SwipeBin</h1>
        <StatsBar stats={stats} />
      </header>

      <main className="deck">
        {loading && <div className="deck__msg">Loading…</div>}
        {error && <div className="deck__msg deck__msg--error">{error}</div>}

        {empty && !error && (
          <div className="deck__msg deck__empty">
            <div className="deck__empty-emoji">🎉</div>
            <p>All caught up!</p>
            <small>
              {stats ? `${stats.kept} kept · ${stats.deleted} sent to trash` : ''}
            </small>
          </div>
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

      <footer className="app__footer">
        <Controls
          onKeep={() => triggerSwipe('keep')}
          onDelete={() => triggerSwipe('delete')}
          onUndo={() => void handleUndo()}
          canUndo={canUndo}
          disabled={empty || loading || !!error}
        />
        <p className="app__hint">Swipe or use ← delete · → keep · Z undo</p>
      </footer>
    </div>
  );
}
