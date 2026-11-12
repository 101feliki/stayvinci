import type { CSSProperties } from 'react';
import {
  Egg,
  Flower2,
  Ghost,
  Gift,
  Heart,
  Megaphone,
  Moon,
  Snowflake,
  Sparkle,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import { cn } from './cn';

/* ---------- Marquee (moving announcement strip) ---------- */

export interface MarqueeLine {
  id: string;
  kind: 'offer' | 'service' | 'message' | 'season';
  text: string;
}

const KIND_ICON: Record<MarqueeLine['kind'], LucideIcon> = {
  offer: Tag,
  service: Sparkles,
  message: Megaphone,
  season: Gift,
};

const SPEED = { slow: 0.42, normal: 0.3, fast: 0.2 } as const;

/**
 * Seamless looping strip. Pauses on hover and keyboard focus; with reduced motion it
 * becomes a still, horizontally scrollable row.
 */
export function Marquee({
  lines,
  speed = 'normal',
  background,
  color,
  accent,
  onSelect,
  className,
}: {
  lines: MarqueeLine[];
  speed?: keyof typeof SPEED;
  background: string;
  color: string;
  accent: string;
  onSelect?: (line: MarqueeLine) => void;
  className?: string;
}) {
  if (!lines.length) return null;
  const chars = lines.reduce((n, l) => n + l.text.length + 6, 0);
  const duration = Math.max(14, chars * SPEED[speed]);
  const row = (copy: number) =>
    lines.map((l) => {
      const Icon = KIND_ICON[l.kind];
      const inner = (
        <>
          <Icon className="size-3.5 shrink-0" style={{ color: accent }} aria-hidden />
          <span>{l.text}</span>
          <Sparkle className="mx-5 size-2.5 shrink-0 opacity-50" aria-hidden />
        </>
      );
      return onSelect ? (
        <button
          key={`${copy}-${l.id}`}
          type="button"
          tabIndex={copy === 0 ? 0 : -1}
          aria-hidden={copy !== 0}
          onClick={() => onSelect(l)}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap hover:underline"
        >
          {inner}
        </button>
      ) : (
        <span
          key={`${copy}-${l.id}`}
          aria-hidden={copy !== 0}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap"
        >
          {inner}
        </span>
      );
    });
  return (
    <div
      className={cn(
        'group relative overflow-hidden text-[13px] font-medium motion-reduce:overflow-x-auto',
        className,
      )}
      style={{ background, color }}
      role="region"
      aria-label="Announcements"
    >
      <div
        className="flex w-max animate-marquee py-2 group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ '--marquee-duration': `${duration}s` } as CSSProperties}
      >
        <div className="flex shrink-0 items-center pl-5">{row(0)}</div>
        <div className="flex shrink-0 items-center pl-5 motion-reduce:hidden">{row(1)}</div>
      </div>
    </div>
  );
}

/* ---------- Seasonal decorations ---------- */

export type Motif =
  'sparkles' | 'hearts' | 'eggs' | 'crescent' | 'flowers' | 'flag' | 'pumpkins' | 'snow';

const MOTIF_ICON: Record<Exclude<Motif, 'flag'>, LucideIcon> = {
  sparkles: Sparkles,
  hearts: Heart,
  eggs: Egg,
  crescent: Moon,
  flowers: Flower2,
  pumpkins: Ghost,
  snow: Snowflake,
};

// Fixed scatter so decorations never jump between renders.
const SPOTS = [
  [6, 18, 18, -12],
  [14, 62, 12, 8],
  [24, 30, 22, 18],
  [33, 78, 14, -6],
  [45, 12, 16, 10],
  [52, 55, 26, -16],
  [61, 85, 12, 4],
  [70, 24, 20, 14],
  [78, 66, 16, -10],
  [86, 38, 24, 6],
  [93, 80, 14, -14],
  [90, 8, 12, 12],
] as const;

/**
 * Decorative layer for a themed season. Place inside a `relative overflow-hidden`
 * container; it never blocks clicks and is hidden from screen readers.
 */
export function SeasonDecor({
  motif,
  colors,
  density = 'normal',
  className,
}: {
  motif: Motif;
  colors: readonly [string, string, string];
  density?: 'light' | 'normal';
  className?: string;
}) {
  if (motif === 'flag') {
    // Kenyan flag colours as a slim ribbon, plus a few sparkles.
    return (
      <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
        <div className="absolute inset-x-0 top-0 flex h-1.5 flex-col">
          <span className="flex-1" style={{ background: colors[0] }} />
          <span className="h-px bg-white" />
          <span className="flex-1" style={{ background: colors[1] }} />
          <span className="h-px bg-white" />
          <span className="flex-1" style={{ background: colors[2] }} />
        </div>
        {SPOTS.slice(0, density === 'light' ? 3 : 5).map(([x, y, s], i) => (
          <Sparkles
            key={i}
            className="absolute animate-float opacity-25"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: s,
              height: s,
              color: '#FFFFFF',
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}
      </div>
    );
  }
  const Icon = MOTIF_ICON[motif];
  const spots = density === 'light' ? SPOTS.slice(0, 6) : SPOTS;
  return (
    <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
      {spots.map(([x, y, s, r], i) => (
        <Icon
          key={i}
          className="absolute animate-float"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: s,
            height: s,
            rotate: `${r}deg`,
            color: colors[i % 3],
            opacity: 0.22 + (i % 3) * 0.08,
            animationDelay: `${(i % 5) * 0.9}s`,
            fill: motif === 'hearts' ? colors[i % 3] : 'none',
          }}
        />
      ))}
    </div>
  );
}

/* ---------- Store logo ---------- */

/** A House's own logo, or an elegant monogram when none is uploaded. */
export function StoreLogo({
  src,
  name,
  background,
  color,
  className,
}: {
  src: string | null;
  name: string;
  background: string;
  color: string;
  className?: string;
}) {
  if (src)
    return (
      <img
        src={src}
        alt={`${name} logo`}
        className={cn('size-10 shrink-0 rounded-xl object-cover', className)}
        draggable={false}
      />
    );
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold',
        className,
      )}
      style={{ background, color }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
