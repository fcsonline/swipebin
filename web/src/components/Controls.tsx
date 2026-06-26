import { CrossIcon, HeartIcon, UndoIcon } from './icons.js';

interface Props {
  onKeep: () => void;
  onDelete: () => void;
  onUndo: () => void;
  canUndo: boolean;
  disabled: boolean;
}

export function Controls({ onKeep, onDelete, onUndo, canUndo, disabled }: Props) {
  return (
    <div className="controls">
      <button
        className="btn btn--delete"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Delete (move to trash)"
        title="Delete — ←"
      >
        <CrossIcon />
      </button>
      <button
        className="btn btn--undo"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo last decision"
        title="Undo — Z"
      >
        <UndoIcon />
      </button>
      <button
        className="btn btn--keep"
        onClick={onKeep}
        disabled={disabled}
        aria-label="Keep"
        title="Keep — →"
      >
        <HeartIcon />
      </button>
    </div>
  );
}
