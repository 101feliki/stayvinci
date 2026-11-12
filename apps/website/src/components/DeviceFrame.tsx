import { useEffect, useRef, useState } from 'react';
import { cn } from '@stayvinci/ui';

/**
 * The live store, running inside a phone. This is the real guest app (not a picture), so
 * what visitors see here is exactly what a guest sees after installing the app.
 */
export function PhoneFrame({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const W = 390;
  const H = 844;
  const scale = 0.74;
  return (
    <div
      className={cn(
        'relative shrink-0 rounded-[52px] bg-obsidian-950 p-3 shadow-[0_40px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/15',
        className,
      )}
      style={{ width: W * scale + 24, height: H * scale + 24 }}
    >
      <div className="relative size-full overflow-hidden rounded-[40px] bg-obsidian-900">
        {!loaded ? <div className="absolute inset-0 animate-pulse bg-white/5" /> : null}
        <iframe
          src={src}
          title={title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className="absolute top-0 left-0 origin-top-left border-0"
          style={{ width: W, height: H, transform: `scale(${scale})` }}
        />
      </div>
      <div className="pointer-events-none absolute top-5 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-obsidian-950" />
    </div>
  );
}

/** The same store at desktop width, scaled to fit its column. */
export function BrowserFrame({ src, title }: { src: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const W = 1280;
  const H = 860;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = width ? width / W : 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 truncate rounded-md bg-canvas px-3 py-1 text-[11px] text-ink-subtle">
          {src.replace(/^https?:\/\//, '')}
        </span>
      </div>
      <div ref={box} className="relative w-full" style={{ height: H * scale }}>
        {!loaded ? <div className="absolute inset-0 animate-pulse bg-line/40" /> : null}
        {scale ? (
          <iframe
            src={src}
            title={title}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className="absolute top-0 left-0 origin-top-left border-0"
            style={{ width: W, height: H, transform: `scale(${scale})` }}
          />
        ) : null}
      </div>
    </div>
  );
}
