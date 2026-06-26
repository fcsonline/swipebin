import { previewUrl, type FolderSummary } from '../api.js';
import { Logo } from './icons.js';

interface Props {
  folders: FolderSummary[];
  onPick: (id: string) => void;
}

function FolderCard({ folder, onPick }: { folder: FolderSummary; onPick: (id: string) => void }) {
  const { total, reviewed, remaining } = folder;
  const pct = total > 0 ? (reviewed / total) * 100 : 0;
  const done = total > 0 && remaining === 0;
  const meta = total === 0 ? 'No images' : remaining > 0 ? `${remaining} left` : 'All done';

  return (
    <button className="folder-card" onClick={() => onPick(folder.id)}>
      <div className="folder-card__cover">
        {folder.coverImageId ? (
          <img src={previewUrl(folder.id, folder.coverImageId, 500)} alt="" draggable={false} />
        ) : (
          <div className="folder-card__placeholder">
            <Logo size={40} />
          </div>
        )}
        {done && <span className="folder-card__badge" aria-label="All reviewed">✓</span>}
      </div>
      <div className="folder-card__body">
        <div className="folder-card__name" title={folder.name}>
          {folder.name}
        </div>
        <div className="folder-card__meta">
          <span>{total.toLocaleString()} {total === 1 ? 'photo' : 'photos'}</span>
          <span className={done ? 'folder-card__done' : 'folder-card__left'}>{meta}</span>
        </div>
        <div className="folder-card__bar">
          <div className="folder-card__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </button>
  );
}

export function FolderPicker({ folders, onPick }: Props) {
  return (
    <div className="app picker">
      <header className="app__header">
        <div className="app__bar">
          <h1 className="app__title">
            <Logo size={30} />
          </h1>
        </div>
        <p className="picker__subtitle">Choose a folder to clean up</p>
      </header>

      <main className="picker__grid">
        {folders.length === 0 && (
          <div className="deck__msg">No folders mounted. Mount one under /data/folders.</div>
        )}
        {folders.map((f) => (
          <FolderCard key={f.id} folder={f} onPick={onPick} />
        ))}
      </main>
    </div>
  );
}
