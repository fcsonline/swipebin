import { useEffect, useState } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { previewUrl, type DecisionAction, type ImageItem } from '../api.js';

const SWIPE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 600;

export interface SwipeCommand {
  action: DecisionAction;
  nonce: number;
}

interface Props {
  folderId: string;
  item: ImageItem;
  isTop: boolean;
  /** 0 = top of the deck; higher = further back. */
  stackIndex: number;
  /** Button/keyboard-driven swipe of the top card. */
  command: SwipeCommand | null;
  onDecide: (item: ImageItem, action: DecisionAction) => void;
}

export function SwipeCard({ folderId, item, isTop, stackIndex, command, onDecide }: Props) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-16, 0, 16]);
  const keepOpacity = useTransform(x, [40, 150], [0, 1]);
  const deleteOpacity = useTransform(x, [-150, -40], [1, 0]);
  const [exiting, setExiting] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

  // React to button/keyboard commands while this card is on top.
  useEffect(() => {
    if (isTop && command && !exiting) flyAway(command.action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.nonce]);

  // Depth styling for cards sitting behind the top one.
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
      {!loaded && <div className="card__spinner" aria-hidden />}
      <img
        className="card__img"
        src={previewUrl(folderId, item.id)}
        alt={item.name}
        draggable={false}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />

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
        {item.isRaw && <span className="card__raw">RAW</span>}
      </div>
    </motion.div>
  );
}
