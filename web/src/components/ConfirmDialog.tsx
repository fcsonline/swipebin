import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  busy = false,
  icon,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog__backdrop">
      <div className="dialog" role="dialog" aria-modal="true">
        {icon && <div className="dialog__icon">{icon}</div>}
        <h3 className="dialog__title">{title}</h3>
        <div className="dialog__message">{message}</div>
        <div className="dialog__actions">
          <button className="btn-pill btn-pill--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button className="btn-pill btn-pill--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Emptying…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
