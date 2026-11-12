import { useEffect, useState, type CSSProperties } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, KeyRound, Lock, MessageCircle } from 'lucide-react';
import {
  Button,
  Marquee,
  SeasonDecor,
  Skeleton,
  SocialIcon,
  SOCIAL_LABEL,
  StoreLogo,
  cn,
} from '@stayvinci/ui';
import { marqueeColors, paintSection } from '@stayvinci/demo-data/design';
import { api, type StoreView } from '../../mock/api';
import { EnterCode } from '../home/HomePage';

export function useStore(): StoreView {
  return useOutletContext<StoreView>();
}

function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}

/** Social links the House chose to show (Instagram, Facebook, X, TikTok, WhatsApp). */
export function StoreSocials({
  s,
  className,
  size = 'size-5',
}: {
  s: StoreView;
  className?: string;
  size?: string;
}) {
  const handle = s.tenant.handle;
  if (!s.socials.length) return null;
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {s.socials.map((a) =>
        a.url ? (
          <a
            key={a.network}
            href={a.url}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full p-2 opacity-90 transition hover:bg-white/10 hover:opacity-100"
            aria-label={`${s.tenant.name} on ${SOCIAL_LABEL[a.network]}`}
          >
            <SocialIcon network={a.network} className={size} />
          </a>
        ) : (
          <Link
            key={a.network}
            to={`/s/${handle}/chat`}
            className="rounded-full p-2 opacity-90 transition hover:bg-white/10 hover:opacity-100"
            aria-label={`Message ${s.tenant.name}`}
          >
            <SocialIcon network={a.network} className={size} />
          </Link>
        ),
      )}
    </div>
  );
}

/**
 * The store as a "room": only this House, an explicit way out, a sticky Book button
 * (spec §9). Editorial layout: the House's cover image fills the screen on the store
 * landing, the top bar floats over it and turns solid as you scroll.
 */
export function StoreLayout() {
  const { handle = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const q = useQuery({ queryKey: ['store', handle], queryFn: () => api.store(handle) });

  if (q.error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-obsidian-900 text-gold-300">
          <Lock className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">This place is private</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          Enter the code the House gave you to step inside.
        </p>
        <EnterCode large />
        <Link to="/" className="mt-6 text-sm font-medium text-azure-700">
          Back to My places
        </Link>
      </div>
    );
  }
  if (!q.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-[70vh] rounded-none" />
        <div className="mx-auto max-w-7xl space-y-4 px-5">
          <Skeleton className="h-12" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );

  const s = q.data;
  const th = s.palette;
  const strip = s.marquee ? marqueeColors(s.marquee.style, th, s.season) : null;
  const path = location.pathname.replace(/\/$/, '');
  const isHome = path === `/s/${handle}`;
  const isDetail = path.includes('/o/');
  const cover = s.cover;
  const overlay = isHome && cover.layout === 'full' && !!cover.image;
  const solid = !overlay || scrolled;
  const tabs = [
    { to: '', label: 'Home', end: true },
    { to: 'menu', label: s.tenant.vertical === 'spa' ? 'Menu' : 'Stays', end: false },
    ...(s.tiers.length ? [{ to: 'members', label: 'Memberships', end: false }] : []),
    ...(s.content.length
      ? [{ to: 'content', label: s.liveNow ? 'Live & content' : 'Content', end: false }]
      : []),
    { to: 'about', label: 'About', end: false },
  ];

  return (
    <div
      className="min-h-screen bg-[var(--store-soft)] dark:bg-canvas"
      style={{ '--store-soft': th.soft } as CSSProperties}
    >
      {s.marquee && strip && s.marquee.lines.length ? (
        <Marquee
          lines={s.marquee.lines}
          speed={s.marquee.speed}
          background={strip.background}
          color={strip.color}
          accent={strip.accent}
          className="relative z-40"
          onSelect={(line) => {
            const item = s.marquee?.lines.find((l) => l.id === line.id);
            if (item?.serviceId) void navigate(`/s/${handle}/o/${item.serviceId}`);
          }}
        />
      ) : null}

      {/* Top bar: floats over the cover, solid once you scroll */}
      <header
        className={cn(
          'sticky top-0 z-30 transition-[background-color,box-shadow,backdrop-filter] duration-300',
          overlay && '-mb-16',
          solid && 'shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl',
        )}
        style={{
          background: solid ? `${th.bg}f0` : 'transparent',
          color: solid ? th.fg : '#FFFFFF',
        }}
      >
        <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6 lg:px-10">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium hover:bg-white/10"
            aria-label="Back to my places"
          >
            <ArrowLeft className="size-4" /> <span className="hidden sm:inline">My places</span>
          </Link>
          <Link
            to={`/s/${handle}`}
            className="flex min-w-0 flex-1 items-center justify-center gap-2.5"
          >
            <StoreLogo
              src={s.logo}
              name={s.tenant.name}
              background={th.accent}
              color={th.onAccent}
              className="size-8 rounded-lg text-xs"
            />
            <span className="truncate text-[15px] font-semibold tracking-tight">
              {s.tenant.name}
            </span>
          </Link>
          <StoreSocials s={s} className="hidden lg:flex" size="size-[18px]" />
          <Link
            to={`/s/${handle}/chat`}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Message the House"
          >
            <MessageCircle className="size-5" />
          </Link>
          <button
            type="button"
            onClick={() => navigate(`/s/${handle}/menu`)}
            className="hidden rounded-full px-5 py-2 text-[13px] font-semibold transition-transform active:scale-[0.98] md:block"
            style={{ background: th.accent, color: th.onAccent }}
          >
            Book
          </button>
        </div>
      </header>

      {isHome ? <Cover s={s} handle={handle} /> : null}

      {!isDetail ? (
        <nav
          className="sticky top-16 z-20 border-b border-black/5 bg-surface/90 backdrop-blur-xl dark:border-white/10"
          aria-label="Store sections"
        >
          <div className="flex w-full gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:justify-center sm:px-6">
            {tabs.map((t) => (
              <NavLink
                key={t.label}
                to={t.to === '' ? `/s/${handle}` : `/s/${handle}/${t.to}`}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'relative shrink-0 px-4 py-4 text-[12px] font-semibold tracking-[0.14em] uppercase transition-colors',
                    isActive ? 'text-ink' : 'text-ink-subtle hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {t.label}
                    {isActive ? (
                      <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-ink" />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}

      <main className="mx-auto w-full max-w-7xl px-4 pt-8 pb-32 sm:px-6 lg:px-10">
        <Outlet context={s} />
      </main>

      {/* Sticky book bar (thumb zone) on phones */}
      {!isDetail && !path.endsWith('/menu') ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <Button
            size="lg"
            className="w-full rounded-full"
            style={{
              background: th.fg === '#1C1C1E' ? th.accent : th.bg,
              color: th.fg === '#1C1C1E' ? th.onAccent : th.fg,
            }}
            onClick={() => navigate(`/s/${handle}/menu`)}
          >
            {cover.ctaLabel || 'Book a visit'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The store landing cover: full-screen photo, image beside text, or brand colour. */
function Cover({ s, handle }: { s: StoreView; handle: string }) {
  const navigate = useNavigate();
  const th = s.palette;
  const c = s.cover;
  const eyebrow = (
    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.3em] uppercase">
      {s.season ? s.season.name : 'Private store'}
      {s.tenant.verified ? <BadgeCheck className="size-3.5" /> : null}
    </div>
  );
  const ctas = (light: boolean) => (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => navigate(`/s/${handle}/menu`)}
        className="rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide shadow-sm transition-transform active:scale-[0.98]"
        style={
          light
            ? { background: '#FFFFFF', color: '#0B0B0C' }
            : { background: th.accent, color: th.onAccent }
        }
      >
        {c.ctaLabel || 'Book a visit'}
      </button>
      <button
        type="button"
        onClick={() => navigate(`/s/${handle}/menu`)}
        className="rounded-full border px-7 py-3.5 text-sm font-semibold tracking-wide transition-colors hover:bg-white/10"
        style={{ borderColor: light ? 'rgba(255,255,255,0.6)' : th.accent }}
      >
        Explore the menu
      </button>
      {s.unlockedExtras ? (
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur">
          <KeyRound className="size-3.5" /> Private offers unlocked
        </span>
      ) : null}
    </div>
  );

  if (c.layout === 'full' && c.image) {
    return (
      <section className="relative isolate flex h-[78svh] min-h-[520px] items-end overflow-hidden text-white">
        <img
          src={c.image}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full animate-cover-in object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />
        {s.season ? <SeasonDecor motif={s.season.motif} colors={s.season.colors} /> : null}
        <div className="w-full px-5 pb-14 sm:px-6 md:pb-20 lg:px-10">
          <div className="max-w-3xl">
            {s.logo ? (
              <StoreLogo
                src={s.logo}
                name={s.tenant.name}
                background={th.accent}
                color={th.onAccent}
                className="mb-6 size-16 rounded-2xl shadow-pop ring-1 ring-white/20"
              />
            ) : null}
            {eyebrow}
            <h1 className="mt-4 text-[2.6rem] leading-[1.02] font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              {c.headline || s.tenant.name}
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/85 sm:text-lg">
              {c.subline || s.tenant.tagline}
            </p>
            {ctas(true)}
          </div>
        </div>
      </section>
    );
  }

  if (c.layout === 'split' && c.image) {
    return (
      <section
        className="grid md:min-h-[72svh] md:grid-cols-2"
        style={{ background: th.bg, color: th.fg }}
      >
        <div className="relative order-2 flex items-center overflow-hidden px-5 py-14 sm:px-10 md:order-1 lg:px-16">
          {s.season ? (
            <SeasonDecor motif={s.season.motif} colors={s.season.colors} density="light" />
          ) : null}
          <div className="relative max-w-xl">
            {s.logo ? (
              <StoreLogo
                src={s.logo}
                name={s.tenant.name}
                background={th.accent}
                color={th.onAccent}
                className="mb-6 size-14 rounded-2xl"
              />
            ) : null}
            <div style={{ color: th.accent }}>{eyebrow}</div>
            <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              {c.headline || s.tenant.name}
            </h1>
            <p className="mt-5 text-base sm:text-lg" style={{ color: th.muted }}>
              {c.subline || s.tenant.tagline}
            </p>
            {ctas(false)}
          </div>
        </div>
        <div className="relative order-1 h-[46svh] md:order-2 md:h-auto">
          <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      </section>
    );
  }

  const paint = paintSection(s.sectionStyles.hero, th, 'hero');
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: paint.background, color: paint.color }}
    >
      {s.season ? <SeasonDecor motif={s.season.motif} colors={s.season.colors} /> : null}
      <div className="relative px-5 pt-16 pb-16 sm:px-6 md:pt-24 md:pb-24 lg:px-10">
        <div className="max-w-3xl">
          {s.logo ? (
            <StoreLogo
              src={s.logo}
              name={s.tenant.name}
              background={th.accent}
              color={th.onAccent}
              className="mb-6 size-16 rounded-2xl shadow-pop"
            />
          ) : null}
          <div style={{ color: th.accent }}>{eyebrow}</div>
          <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
            {c.headline || s.tenant.name}
          </h1>
          <p className="mt-5 max-w-xl text-base sm:text-lg" style={{ color: paint.muted }}>
            {c.subline || s.tenant.tagline}
          </p>
          {ctas(false)}
        </div>
      </div>
    </section>
  );
}
