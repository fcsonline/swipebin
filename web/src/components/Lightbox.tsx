import { useEffect, useState } from 'react';

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

/** Fullscreen image viewer. Tap the image to toggle 1× / zoomed; backdrop or × closes. */
export function Lightbox({ src, alt, onClose }: Props) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className={`lightbox__stage ${zoomed ? 'is-zoomed' : ''}`} onClick={(e) => e.stopPropagation()}>
        <img
          className={`lightbox__img ${zoomed ? 'is-zoomed' : ''}`}
          src={src}
          alt={alt}
          draggable={false}
          onClick={() => setZoomed((z) => !z)}
        />
      </div>
    </div>
  );
}
