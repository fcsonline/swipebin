import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchTrash, flushTrash, formatBytes, type Stats, type TrashSummary } from '../api.js';
import { TrashIcon } from './icons.js';

function Donut({ kept, deleted }: { kept: number; deleted: number }) {
  const total = kept + deleted;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const keptLen = total ? (kept / total) * circ : 0;
  const deletedLen = total ? (deleted / total) * circ : 0;
  return (
    <svg className="donut" viewBox="0 0 140 140" width="160" height="160">
      <circle cx="70" cy="70" r={r} className="donut__track" />
      {total > 0 && (
        <>
          <circle
            cx="70"
            cy="70"
            r={r}
            className="donut__deleted"
            strokeDasharray={`${deletedLen} ${circ - deletedLen}`}
            strokeDashoffset={0}
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            className="donut__kept"
            strokeDasharray={`${keptLen} ${circ - keptLen}`}
            strokeDashoffset={-deletedLen}
          />
        </>
      )}
      <text x="70" y="64" className="donut__num">
        {total}
      </text>
      <text x="70" y="84" className="donut__label">
        reviewed
      </text>
    </svg>
  );
}

export function Summary({ stats, onStats }: { stats: Stats | null; onStats: (s: Stats) => void }) {
  const [trash, setTrash] = useState<TrashSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushed, setFlushed] = useState<TrashSummary | null>(null);

  useEffect(() => {
    fetchTrash().then(setTrash).catch(() => setTrash({ count: 0, bytes: 0 }));
  }, []);

  async function doFlush() {
    setFlushing(true);
    try {
      const res = await flushTrash();
      setFlushed({ count: res.count, bytes: res.bytes });
      setTrash({ count: 0, bytes: 0 });
      onStats(res.stats);
    } catch {
      /* leave UI as-is on error */
    } finally {
      setFlushing(false);
      setConfirming(false);
    }
  }

  const kept = stats?.kept ?? 0;
  const deleted = stats?.deleted ?? 0;

  return (
    <motion.div
      className="summary"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
    >
      <div className="summary__emoji">🎉</div>
      <h2 className="summary__title">All caught up!</h2>
      <p className="summary__subtitle">You've reviewed every image.</p>

      <Donut kept={kept} deleted={deleted} />

      <div className="summary__tiles">
        <div className="tile tile--keep">
          <span className="tile__num">{kept}</span>
          <span className="tile__label">Kept</span>
        </div>
        <div className="tile tile--delete">
          <span className="tile__num">{deleted}</span>
          <span className="tile__label">Deleted</span>
        </div>
      </div>

      <div className="trashcard">
        {flushed ? (
          <div className="trashcard__done">
            <TrashIcon size={18} />
            <span>
              Emptied {flushed.count} {flushed.count === 1 ? 'file' : 'files'} · freed{' '}
              {formatBytes(flushed.bytes)}
            </span>
          </div>
        ) : !trash ? (
          <div className="trashcard__line">Checking trash…</div>
        ) : trash.count === 0 ? (
          <div className="trashcard__line">
            <TrashIcon size={18} /> Trash is empty
          </div>
        ) : (
          <>
            <div className="trashcard__line">
              <TrashIcon size={18} />
              <span>
                <strong>{trash.count}</strong> {trash.count === 1 ? 'file' : 'files'} in trash ·{' '}
                {formatBytes(trash.bytes)}
              </span>
            </div>
            {confirming ? (
              <div className="trashcard__confirm">
                <p className="trashcard__warn">
                  Permanently delete {trash.count} {trash.count === 1 ? 'file' : 'files'}? This
                  can't be undone.
                </p>
                <div className="trashcard__actions">
                  <button className="btn-pill btn-pill--ghost" onClick={() => setConfirming(false)} disabled={flushing}>
                    Cancel
                  </button>
                  <button className="btn-pill btn-pill--danger" onClick={doFlush} disabled={flushing}>
                    {flushing ? 'Emptying…' : 'Yes, delete forever'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn-pill btn-pill--danger" onClick={() => setConfirming(true)}>
                <TrashIcon size={16} /> Empty Trash
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
