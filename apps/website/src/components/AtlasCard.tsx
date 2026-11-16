import { Link } from 'react-router';
import { Star } from 'lucide-react';
import { cn } from '@stayvinci/ui';
import { KIND_LABEL, media, money, type StoreCard } from '../api';

/**
 * Editorial place card: dimmed photo that brightens on hover, a small uppercase tag and badge
 * over the photo, a "kind · area" line, the name, a short blurb and a "Discover" link whose
 * line grows on hover. Gold hairline on the left, slim red reflection on the right.
 */
export function AtlasCard({
  s,
  tone = 'light',
  size = 'md',
  tag,
}: {
  s: StoreCard;
  tone?: 'light' | 'noir';
  size?: 'md' | 'mini';
  tag?: string;
}) {
  const noir = tone === 'noir';
  const area = s.area ?? s.city ?? 'Kenya';
  return (
    <Link
      to={`/places/${s.handle}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border shadow-card transition-[border-color,box-shadow,transform] duration-500 hover:-translate-y-0.5 hover:shadow-card-hover',
        noir
          ? 'border-noir-line bg-noir-900 text-[#f1ebdf] hover:border-gold-400/40'
          : 'border-line bg-surface hover:border-gold-400/50',
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden',
          noir ? 'bg-noir-800' : 'bg-obsidian-900',
          size === 'mini' ? 'aspect-[3/2]' : 'aspect-[4/3]',
        )}
      >
        {s.cover_url ? (
          <img
            src={media(s.cover_url) ?? ''}
            alt=""
            loading="lazy"
            className="size-full object-cover brightness-[.86] saturate-[.95] transition-[transform,filter] duration-[1400ms] ease-[cubic-bezier(.2,.7,.1,1)] group-hover:scale-105 group-hover:brightness-[.97]"
          />
        ) : null}
        <span className="absolute top-3.5 left-3.5 border border-gold-400/25 bg-noir-950/80 px-2.5 py-1.5 text-[9px] leading-none font-medium tracking-[0.26em] text-[#e4cf9f] uppercase backdrop-blur-md">
          {tag ?? KIND_LABEL[s.vertical]}
        </span>
        <span className="absolute top-3.5 right-3.5 inline-flex items-center gap-1 border border-gold-400/25 bg-noir-950/80 px-2.5 py-1.5 text-[12px] leading-none text-[#e4cf9f] backdrop-blur-md">
          {s.rating.average !== null ? (
            <>
              <Star className="size-3 fill-current" /> {s.rating.average.toFixed(1)}
            </>
          ) : (
            'New'
          )}
        </span>
      </div>
      <div className={cn('flex flex-1 flex-col', size === 'mini' ? 'gap-1.5 p-4' : 'gap-2 p-5')}>
        <div
          className={cn(
            'text-[10px] leading-snug font-medium tracking-[0.2em] uppercase',
            noir ? 'text-noir-muted' : 'text-ink-subtle',
          )}
        >
          {KIND_LABEL[s.vertical]} · {area}
        </div>
        <h3
          className={cn(
            'leading-tight font-semibold tracking-tight',
            size === 'mini' ? 'text-lg' : 'text-xl',
          )}
        >
          {s.name}
        </h3>
        <p
          className={cn(
            'line-clamp-2 text-[13.5px] leading-relaxed',
            noir ? 'text-[#a59d90]' : 'text-ink-muted',
          )}
        >
          {s.tagline}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <span className="flex items-center gap-2.5 text-[10px] leading-none font-medium tracking-[0.26em] text-gold-600 uppercase dark:text-gold-400">
            Discover
            <span className="h-px w-[18px] bg-current transition-[width] duration-300 group-hover:w-[34px]" />
          </span>
          {s.from_price_minor !== null ? (
            <span className={cn('text-[12.5px]', noir ? 'text-noir-muted' : 'text-ink-subtle')}>
              from {money(s.from_price_minor, s.currency)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
