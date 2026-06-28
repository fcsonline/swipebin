import { useCallback, useEffect, useState } from 'react';

// Older WebKit (iOS Safari, some desktop Safari) only exposes the prefixed API.
interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}
interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function fullscreenElement(): Element | null {
  const d = document as WebkitDocument;
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/**
 * Track and toggle document fullscreen. `supported` is false where the
 * Fullscreen API is unavailable (notably iOS Safari, and PWAs already in
 * standalone display mode) so callers can hide the affordance.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => fullscreenElement() != null);

  useEffect(() => {
    const sync = () => setIsFullscreen(fullscreenElement() != null);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (fullscreenElement()) {
        const d = document as WebkitDocument;
        await (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      } else {
        const el = document.documentElement as WebkitElement;
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      // Request can be rejected (e.g. not a user gesture) — ignore.
    }
  }, []);

  const supported =
    typeof document !== 'undefined' &&
    (document.documentElement.requestFullscreen != null ||
      (document.documentElement as WebkitElement).webkitRequestFullscreen != null);

  return { isFullscreen, toggle, supported };
}
