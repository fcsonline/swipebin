import { useEffect, useState } from 'react';
import { Logo } from './icons.js';

// `beforeinstallprompt` isn't in the standard lib DOM types yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'swipebin:install-dismissed';
// Re-offer the prompt only after a cooling-off period (14 days).
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes installed state via this non-standard flag.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function recentlyDismissed(): boolean {
  const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
  return at > 0 && Date.now() - at < DISMISS_COOLDOWN_MS;
}

function isIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent) // only real Safari can install
  );
}

/**
 * Bottom banner offering to install the app. Uses the native
 * `beforeinstallprompt` flow where available (Chrome/Edge/Android), and falls
 * back to a short "Add to Home Screen" hint on iOS Safari, which has no API.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we show our own UI
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setShowIosHint(false);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt, so surface a manual hint instead.
    if (isIos()) setShowIosHint(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferred(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (!deferred && !showIosHint) return null;

  return (
    <div className="install" role="dialog" aria-label="Install SwipeBin">
      <span className="install__icon">
        <Logo size={34} />
      </span>
      <div className="install__text">
        <div className="install__title">Install SwipeBin</div>
        <div className="install__sub">
          {deferred ? (
            'Add it to your home screen for a full-screen, app-like experience.'
          ) : (
            <>
              Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.
            </>
          )}
        </div>
      </div>
      <div className="install__actions">
        {deferred && (
          <button type="button" className="btn-pill btn-pill--accent" onClick={install}>
            Install
          </button>
        )}
        <button
          type="button"
          className="btn-pill btn-pill--ghost install__dismiss"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
        >
          {deferred ? 'Not now' : 'Got it'}
        </button>
      </div>
    </div>
  );
}
