import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Fingerprint, Lock } from 'lucide-react';
import { Logo } from '@stayvinci/ui';
import { api } from '../lib/api';
import { RELOCK_AFTER_MS, appLock } from '../lib/appLock';

/**
 * Covers the app when it is locked. Locked on open (if the guest switched the lock on) and
 * after more than a minute away. While the app is in the background a plain cover hides it,
 * so the phone's app switcher never shows a booking.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => appLock.enabled());
  const [covered, setCovered] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        if (appLock.enabled()) setCovered(true);
        return;
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      if (appLock.enabled() && away > RELOCK_AFTER_MS) setLocked(true);
      setCovered(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const show = locked || covered;
  return (
    <>
      <div inert={show} aria-hidden={show}>
        {children}
      </div>
      {locked ? (
        <LockScreen onUnlocked={() => setLocked(false)} />
      ) : covered ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-obsidian-900">
          <Logo on="dark" className="h-12" />
        </div>
      ) : null}
    </>
  );
}

function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  const unlock = useCallback(
    async (quiet = false) => {
      setBusy(true);
      setError(null);
      try {
        if (await appLock.unlock()) onUnlocked();
        else if (!quiet) setError('That didn’t work. Try again.');
      } catch (e) {
        // NotAllowedError: cancelled, timed out, or the browser wants a tap first.
        if (!quiet)
          setError(
            e instanceof DOMException && e.name === 'NotAllowedError'
              ? 'Unlock was cancelled. Tap to try again.'
              : 'This phone could not verify you. Try again, or sign out below.',
          );
      } finally {
        setBusy(false);
      }
    },
    [onUnlocked],
  );

  // Ask straight away when the phone allows it without a tap (Android does; iPhone may not).
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    void unlock(true);
  }, [unlock]);

  const signOut = async () => {
    await api.me.signOut().catch(() => undefined);
    appLock.disable();
    window.location.replace('/');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stayvinci is locked"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-obsidian-sheen px-6 pt-[18vh] pb-[max(2rem,env(safe-area-inset-bottom))] text-white"
    >
      <div className="flex flex-col items-center text-center">
        <Logo on="dark" className="h-12" />
        <div className="mt-12 flex size-16 items-center justify-center rounded-full border border-white/15 bg-white/5">
          <Lock className="size-7 text-gold-300" />
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Stayvinci is locked</h1>
        <p className="mt-2 max-w-xs text-sm text-white/60">
          Use Face ID, your fingerprint or your phone’s PIN to open it.
        </p>
        {error ? <p className="mt-4 max-w-xs text-sm text-red-300">{error}</p> : null}
      </div>
      <div className="flex w-full max-w-xs flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => void unlock()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-obsidian-900 transition hover:bg-ivory disabled:opacity-60"
        >
          <Fingerprint className="size-5" /> {busy ? 'Waiting for your phone…' : 'Unlock'}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-[13px] text-white/50 underline-offset-4 hover:text-white hover:underline"
        >
          Can’t unlock? Sign out instead
        </button>
      </div>
    </div>
  );
}
