import type { Stats } from '../api.js';
import { CrossIcon, HeartIcon } from './icons.js';

export function StatsBar({ stats }: { stats: Stats | null }) {
  if (!stats) return <div className="statsbar statsbar--loading" />;
  const pct = stats.total > 0 ? (stats.reviewed / stats.total) * 100 : 0;
  return (
    <div className="statsbar">
      <div className="statsbar__track">
        <div className="statsbar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="statsbar__nums">
        <span>{stats.remaining} left</span>
        <span className="statsbar__kept">
          <HeartIcon size={13} /> {stats.kept}
        </span>
        <span className="statsbar__deleted">
          <CrossIcon size={13} /> {stats.deleted}
        </span>
      </div>
    </div>
  );
}
