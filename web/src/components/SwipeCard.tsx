import { useEffect, useState } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import {
  formatBytes,
  isPreviewable,
  previewUrl,
  type DecisionAction,
  type FileItem,
} from '../api.js';
import { FileIcon, ZoomIcon } from './icons.js';

const SWIPE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 600;

export interface SwipeCommand {
  action: DecisionAction;
  nonce: number;
}

interface Props {
  folderId: string;
  item: FileItem;
  isTop: boolean;
  /** 0 = top of the deck; higher = further back. */
  stackIndex: number;
  /** Button/keyboard-driven swipe of the top card. */
  command: SwipeCommand | null;
  onDecide: (item: FileItem, action: DecisionAction) => void;
  /** Tap-to-zoom (images only). */
  onZoom?: (item: FileItem) => void;
}

export function SwipeCard({ folderId, item, isTop, stackIndex, command, onDecide, onZoom }: Props) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-16, 0, 16]);
  const keepOpacity = useTransform(x, [40, 150], [0, 1]);
  const deleteOpacity = useTransform(x, [-150, -40], [1, 0]);
  const [exiting, setExiting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const preview = isPreviewable(item);
  const canZoom = isTop && item.kind === 'image' && !!onZoom;

  function flyAway(action: DecisionAction) {
    if (exiting) return;
    setExiting(true);
    const dir = action === 'keep' ? 1 : -1;
    animate(x, dir * (window.innerWidth + 240), {
      duration: 0.32,
      ease: 'easeIn',
      onComplete: () => onDecide(item, action),
    });
  }

  function onDragEnd(_e: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      flyAway('keep');
    } else if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      flyAway('delete');
    } else {
      animate(x, 0, { type: 'spring', stiffness: 350, damping: 32 });
    }
  }

  useEffect(() => {
    if (isTop && command && !exiting) flyAway(command.action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.nonce]);

  const depthStyle =
    stackIndex === 0
      ? {}
      : {
          scale: 1 - Math.min(stackIndex, 2) * 0.04,
          y: Math.min(stackIndex, 2) * 14,
        };

  return (
    <motion.div
      className="card"
      style={{ x: isTop ? x : 0, rotate: isTop ? rotate : 0, zIndex: 100 - stackIndex }}
      initial={depthStyle}
      animate={depthStyle}
      drag={isTop && !exiting ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={onDragEnd}
      whileTap={isTop ? { cursor: 'grabbing' } : undefined}
    >
      {preview ? (
        <>
          {!loaded && <div className="card__spinner" aria-hidden />}
          <img
            className={`card__img ${canZoom ? 'card__img--zoomable' : ''}`}
            src={previewUrl(folderId, item.id)}
            alt={item.name}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onClick={canZoom ? () => onZoom?.(item) : undefined}
            style={{ opacity: loaded ? 1 : 0 }}
          />
          {canZoom && loaded && (
            <span className="card__zoom" aria-hidden>
              <ZoomIcon size={18} />
            </span>
          )}
        </>
      ) : (
        <div className="card__placeholder">
          <FileIcon size={76} />
          <span className="card__placeholder-ext">{item.ext ? `.${item.ext}` : 'file'}</span>
        </div>
      )}

      {isTop && (
        <>
          <motion.div className="card__tint card__tint--keep" style={{ opacity: keepOpacity }} />
          <motion.div className="card__tint card__tint--delete" style={{ opacity: deleteOpacity }} />
          <motion.div className="card__badge card__badge--keep" style={{ opacity: keepOpacity }}>
            KEEP
          </motion.div>
          <motion.div className="card__badge card__badge--delete" style={{ opacity: deleteOpacity }}>
            DELETE
          </motion.div>
        </>
      )}

      <div className="card__meta">
        <span className="card__name" title={item.relPath}>
          {item.name}
        </span>
        {item.kind === 'pdf' && <span className="card__tag">PDF</span>}
        {item.isRaw && <span className="card__tag">RAW</span>}
        <span className="card__size">{formatBytes(item.size)}</span>
      </div>
    </motion.div>
  );
}
