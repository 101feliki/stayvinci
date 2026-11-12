import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { LogoMark } from '@stayvinci/ui';
import { useInstall } from '../lib/install';

const DISMISSED = 'sv.install.dismissed';

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/**
 * A calm strip under the header that offers the app. Shown until installed or closed;
 * the website's "Get the app" button links here with ?install=1 to show it again.
 */
export function InstallBanner() {
  const { mode, install } = useInstall();
  const asked = new URLSearchParams(window.location.search).has('install');
  const [hidden, setHidden] = useState(() => !asked && read(DISMISSED) === '1');
  if (mode === 'installed' || hidden) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      /* private mode: just hide for now */
    }
    setHidden(true);
  };

  return (
    <div className="bg-emerald-sheen text-white">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
        <LogoMark on="dark" className="size-8 shrink-0" />
        <div className="min-w-0 flex-1 text-[13px] leading-snug">
          <div className="font-semibold">Get the Stayvinci app</div>
          <div className="text-white/70">
            {mode === 'prompt' ? (
              'Your places on your home screen, full screen and quick to open.'
            ) : mode === 'ios' ? (
              <>
                Tap <Share className="inline size-3.5 -translate-y-px" aria-label="Share" /> then
                “Add to Home Screen”.
              </>
            ) : (
              'Open your browser menu and choose “Install app” or “Add to Home screen”.'
            )}
          </div>
        </div>
        {mode === 'prompt' ? (
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-emerald-900 transition hover:bg-ivory"
          >
            <Download className="size-4" />
            Install
          </button>
        ) : null}
        <button
          type="button"
          onClick={close}
          aria-label="Not now"
          className="shrink-0 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
