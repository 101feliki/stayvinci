import { cn } from './cn';

/**
 * Brand assets. Each app serves them from `public/brand/` (copies of the bold,
 * transparent files in the repo's `brand/logo/` folder), so the same paths work
 * everywhere. To change the logo, replace the files; no code changes needed.
 */
const ASSETS = {
  logoOnDark: '/brand/logo-on-dark.svg',
  logoOnLight: '/brand/logo-on-light.svg',
  markOnDark: '/brand/mark-on-dark.svg',
  markOnLight: '/brand/mark-on-light.svg',
} as const;

type Surface = 'dark' | 'light';

/**
 * The full Stayvinci logo (SV mark + wordmark). This is the standard logo.
 * `on` says which background it sits on: `dark` is the Figma original (gold to white),
 * `light` turns the white highlights charcoal and deepens the gold. A `light` logo
 * swaps to the dark-background version automatically in dark mode.
 */
export function Logo({ on = 'light', className }: { on?: Surface; className?: string }) {
  const cls = cn('h-10 w-auto select-none', className);
  if (on === 'dark')
    return <img src={ASSETS.logoOnDark} alt="Stayvinci" className={cls} draggable={false} />;
  return (
    <>
      <img
        src={ASSETS.logoOnLight}
        alt="Stayvinci"
        className={cn(cls, 'dark:hidden')}
        draggable={false}
      />
      <img
        src={ASSETS.logoOnDark}
        alt="Stayvinci"
        className={cn(cls, 'hidden dark:block')}
        draggable={false}
      />
    </>
  );
}

/**
 * The SV mark on its own, for small places: cards, headers, avatars, the QR
 * centre, notification previews. `badge` puts it on a dark disc so it reads on
 * any background, including photos.
 */
export function LogoMark({
  on = 'light',
  badge = false,
  className,
  label,
}: {
  on?: Surface;
  badge?: boolean;
  className?: string;
  /** Accessible name; omit when the mark is decorative next to the word "Stayvinci". */
  label?: string;
}) {
  if (badge)
    return (
      <span
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-card',
          className,
        )}
      >
        <img
          src={ASSETS.markOnDark}
          alt={label ?? ''}
          className="size-[80%] select-none"
          draggable={false}
        />
      </span>
    );
  const cls = cn('size-8 select-none', className);
  if (on === 'dark')
    return <img src={ASSETS.markOnDark} alt={label ?? ''} className={cls} draggable={false} />;
  return (
    <>
      <img
        src={ASSETS.markOnLight}
        alt={label ?? ''}
        className={cn(cls, 'dark:hidden')}
        draggable={false}
      />
      <img
        src={ASSETS.markOnDark}
        alt={label ?? ''}
        className={cn(cls, 'hidden dark:block')}
        draggable={false}
      />
    </>
  );
}
