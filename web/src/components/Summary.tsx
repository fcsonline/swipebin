import { motion } from 'framer-motion';
import { formatBytes, type Stats, type TrashSummary } from '../api.js';
import { CelebrateGraphic, TrashIcon } from './icons.js';

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

interface Props {
  stats: Stats | null;
  trash: TrashSummary;
  /** Cumulative space permanently freed this session (after emptying trash). */
  freed: TrashSummary | null;
  onEmptyTrash: () => void;
}

export function Summary({ stats, trash, freed, onEmptyTrash }: Props) {
  const kept = stats?.kept ?? 0;
  const deleted = stats?.deleted ?? 0;

  return (
    <motion.div
      className="summary"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
    >
      <CelebrateGraphic />
      <h2 className="summary__title">All caught up!</h2>
      <p className="summary__subtitle">You've reviewed everything.</p>

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

      {freed ? (
        <div className="freed" role="status">
          <div className="freed__size">{formatBytes(freed.bytes)} freed</div>
          <div className="freed__sub">
            {freed.count} {freed.count === 1 ? 'file' : 'files'} deleted forever
          </div>
        </div>
      ) : (
        <div className="trashcard">
          {trash.count === 0 ? (
            <div className="trashcard__line">
              <TrashIcon size={18} /> Trash is empty
            </div>
          ) : (
            <>
              <div className="trashcard__line">
                <TrashIcon size={18} />
                <span>
                  <strong>{trash.count}</strong> {trash.count === 1 ? 'file' : 'files'} in trash ·{' '}
                  {formatBytes(trash.bytes)} to free
                </span>
              </div>
              <button className="btn-pill btn-pill--danger" onClick={onEmptyTrash}>
                <TrashIcon size={16} /> Empty Trash
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
