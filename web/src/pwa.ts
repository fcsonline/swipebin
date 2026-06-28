// Registers the service worker that powers offline support + installability.
// Only runs in production builds — in dev the Vite server owns the page and a
// stale SW cache would mask hot reloads.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
