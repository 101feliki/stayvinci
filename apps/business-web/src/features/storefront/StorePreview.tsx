import { Clock, Crown, MapPin, Star } from 'lucide-react';
import { Marquee, SeasonDecor, ServiceVisual, StoreLogo, cn } from '@stayvinci/ui';
import {
  SECTION_LABELS,
  activeSeason,
  marqueeColors,
  marqueeLines,
  paintSection,
  resolvePalette,
} from '@stayvinci/demo-data/design';
import type { SectionKind, Storefront } from '../../mock/types';
import { durationLabel, money } from '../../lib/format';

interface PreviewService {
  id: string;
  name: string;
  description: string;
  variants: { durationMin: number; price: number }[];
  visibility: string;
  image: string | null;
  icon: string | null;
}

/**
 * Live preview of the guest store. Uses the same design engine as the guest app
 * (palette, seasons, marquee, section paint), so what you see is what guests see.
 */
export function StorePreview({
  sf,
  services,
  tiers,
  wide,
  focus,
}: {
  sf: Storefront;
  services: PreviewService[];
  tiers: { id: string; name: string; monthly: number; perks: string[] }[];
  wide: boolean;
  /** Section being edited; gets a soft outline in the preview. */
  focus?: SectionKind | null;
}) {
  const p = resolvePalette(sf);
  const season = activeSeason(sf.season);
  const lines = sf.marquee.enabled ? marqueeLines(sf.marquee, season) : [];
  const strip = marqueeColors(sf.marquee.style, p, season);
  const visible = services.filter((s) => s.visibility === 'public');
  const ring = (k: SectionKind) =>
    focus === k ? 'outline outline-2 -outline-offset-2 outline-azure-500' : '';

  return (
    <div className="h-full overflow-y-auto text-[13px]" style={{ background: p.soft }}>
      {/* Store top bar */}
      <div
        className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5"
        style={{ background: p.bg, color: p.fg }}
      >
        <StoreLogo
          src={sf.logo}
          name={sf.displayName}
          background={p.accent}
          color={p.onAccent}
          className="size-7 rounded-lg text-xs"
        />
        <span className="flex-1 truncate text-xs font-semibold">{sf.displayName}</span>
      </div>
      {lines.length ? (
        <Marquee
          lines={lines}
          speed={sf.marquee.speed}
          background={strip.background}
          color={strip.color}
          accent={strip.accent}
          className="text-[11px]"
        />
      ) : null}

      {sf.sections
        .filter((s) => s.enabled)
        .map((s) => {
          const paint = paintSection(sf.sectionStyles[s.kind], p, s.kind);
          const pad = paint.filled ? 'px-5 py-6' : 'px-5 pt-6';
          const sectionBox = cn('relative overflow-hidden', pad, ring(s.kind));
          const style = { background: paint.background, color: paint.color };
          const label = (text: string) => (
            <div
              className="mb-3 text-[10px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: paint.filled ? paint.muted : undefined }}
            >
              {text}
            </div>
          );
          switch (s.kind) {
            case 'hero':
              if (sf.cover.image && sf.cover.layout !== 'color')
                return (
                  <div
                    key={s.kind}
                    className={cn('relative overflow-hidden text-white', ring('hero'))}
                  >
                    <div
                      className={cn(
                        'relative',
                        sf.cover.layout === 'full' ? (wide ? 'h-80' : 'h-[420px]') : 'h-44',
                      )}
                    >
                      <img
                        src={sf.cover.image}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {sf.cover.layout === 'full' ? (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/20" />
                      ) : null}
                      {season ? (
                        <SeasonDecor motif={season.motif} colors={season.colors} density="light" />
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        sf.cover.layout === 'full'
                          ? 'absolute inset-x-0 bottom-0 p-5'
                          : 'px-5 py-6',
                      )}
                      style={
                        sf.cover.layout === 'split' ? { background: p.bg, color: p.fg } : undefined
                      }
                    >
                      <div
                        className="text-[9px] tracking-[0.3em] uppercase opacity-85"
                        style={{ color: sf.cover.layout === 'split' ? p.accent : undefined }}
                      >
                        {season ? season.name : 'Private store'}
                      </div>
                      <div
                        className={cn(
                          'mt-1.5 leading-[1.05] font-semibold tracking-tight',
                          wide ? 'text-3xl' : 'text-[1.6rem]',
                        )}
                      >
                        {sf.cover.headline || sf.displayName}
                      </div>
                      <div className="mt-1.5 text-xs opacity-85">
                        {sf.cover.subline || sf.tagline}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <span
                          className="rounded-full px-4 py-2 text-[11px] font-semibold"
                          style={
                            sf.cover.layout === 'full'
                              ? { background: '#FFFFFF', color: '#0B0B0C' }
                              : { background: p.accent, color: p.onAccent }
                          }
                        >
                          {sf.cover.ctaLabel || 'Book a visit'}
                        </span>
                        <span className="rounded-full border border-current/60 px-4 py-2 text-[11px] font-semibold">
                          Explore
                        </span>
                      </div>
                    </div>
                  </div>
                );
              return (
                <div
                  key={s.kind}
                  className={cn('relative overflow-hidden px-5 pt-9 pb-8', ring('hero'))}
                  style={style}
                >
                  {season ? (
                    <SeasonDecor motif={season.motif} colors={season.colors} density="light" />
                  ) : null}
                  <div
                    className="absolute -top-16 -right-16 size-44 rounded-full border opacity-30"
                    style={{ borderColor: p.accent }}
                  />
                  <div className="relative">
                    {sf.logo ? (
                      <StoreLogo
                        src={sf.logo}
                        name={sf.displayName}
                        background={p.accent}
                        color={p.onAccent}
                        className="mb-3 size-12"
                      />
                    ) : null}
                    <div
                      className="text-[10px] tracking-[0.25em] uppercase"
                      style={{ color: p.accent }}
                    >
                      {season ? season.name : 'Private store'}
                    </div>
                    <div
                      className={cn(
                        'mt-1.5 font-semibold tracking-tight',
                        wide ? 'text-3xl' : 'text-2xl',
                      )}
                    >
                      {sf.displayName}
                    </div>
                    <div className="mt-1" style={{ color: paint.muted }}>
                      {sf.tagline}
                    </div>
                    <button
                      type="button"
                      className="mt-5 rounded-full px-4 py-2 text-xs font-semibold"
                      style={{ background: p.accent, color: p.onAccent }}
                    >
                      Book a visit
                    </button>
                  </div>
                </div>
              );
            case 'featured':
              return (
                <div key={s.kind} className={sectionBox} style={style}>
                  {label('Featured')}
                  <div className={cn('grid gap-3', wide ? 'grid-cols-3' : 'grid-cols-2')}>
                    {visible.slice(0, wide ? 3 : 2).map((v) => (
                      <div
                        key={v.id}
                        className="overflow-hidden rounded-xl border border-black/5 bg-white text-ink"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden">
                          <ServiceVisual
                            image={v.image}
                            icon={v.icon}
                            name={v.name}
                            from={p.bg}
                            to={p.accent}
                            iconColor={p.fg}
                          />
                        </div>
                        <div className="p-2.5">
                          <div className="truncate font-semibold">{v.name}</div>
                          <div className="text-ink-muted">
                            from {money(Math.min(...v.variants.map((x) => x.price)))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            case 'menu':
              return (
                <div key={s.kind} className={sectionBox} style={style}>
                  {label('Menu')}
                  <ul className="divide-y divide-black/10 rounded-xl bg-white px-3 text-ink">
                    {visible.slice(0, 4).map((v) => (
                      <li key={v.id} className="flex items-center justify-between py-2.5">
                        <span>
                          <span className="block font-medium">{v.name}</span>
                          <span className="flex items-center gap-1 text-xs text-ink-subtle">
                            <Clock className="size-3" />
                            {durationLabel(v.variants[0]?.durationMin ?? 60)}
                          </span>
                        </span>
                        <span className="font-medium">{money(v.variants[0]?.price ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            case 'memberships':
              return (
                <div key={s.kind} className={sectionBox} style={style}>
                  {label('Memberships')}
                  <div className="flex gap-2 overflow-x-auto">
                    {tiers.map((t) => (
                      <div
                        key={t.id}
                        className="min-w-36 rounded-xl p-3"
                        style={{ background: p.bg, color: p.fg }}
                      >
                        <Crown className="mb-1 size-4" style={{ color: p.accent }} />
                        <div className="text-xs" style={{ color: p.accent }}>
                          {t.name}
                        </div>
                        <div className="font-semibold">{money(t.monthly)}/mo</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            case 'reviews':
              return (
                <div key={s.kind} className={sectionBox} style={style}>
                  <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase">
                    Reviews <Star className="size-3 fill-current" style={{ color: p.accent }} /> 4.9
                  </div>
                  <div className="rounded-xl bg-white/90 p-3 text-ink italic">
                    “So peaceful and private. Loved the tea afterwards.”
                  </div>
                </div>
              );
            case 'location':
              return (
                <div key={s.kind} className={sectionBox} style={style}>
                  {label('Visit')}
                  <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-ink">
                    <MapPin className="size-4" style={{ color: p.bg }} /> Address shared after
                    booking
                  </div>
                </div>
              );
            default:
              return (
                <div key={s.kind} className={sectionBox} style={style}>
                  {label(SECTION_LABELS[s.kind])}
                  <div className="h-14 rounded-xl bg-white/70" />
                </div>
              );
          }
        })}
      <div className="h-10" />
    </div>
  );
}
