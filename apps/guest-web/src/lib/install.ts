import { useEffect, useState } from 'react';

/** Chrome/Edge/Samsung's install event (not in the TypeScript DOM types yet). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's own mini-bar quiet; we show our own calm banner instead.
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** Registers the service worker in production builds (it makes the app installable). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent);

/**
 * What installing looks like on this device:
 *  - 'prompt'  Android/desktop Chrome, Edge, Samsung: one tap opens the system install sheet.
 *  - 'ios'     Safari on iPhone/iPad: Share, then "Add to Home Screen".
 *  - 'manual'  other browsers: use the browser menu.
 *  - 'installed' already running as the app.
 */
export function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const mode: 'prompt' | 'ios' | 'manual' | 'installed' = isStandalone()
    ? 'installed'
    : deferred
      ? 'prompt'
      : isIOS()
        ? 'ios'
        : 'manual';
  return {
    mode,
    async install(): Promise<boolean> {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      notify();
      return outcome === 'accepted';
    },
  };
}
