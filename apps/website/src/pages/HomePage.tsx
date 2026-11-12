import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  ArrowRight,
  BadgeCheck,
  BellOff,
  CalendarCheck,
  CalendarClock,
  EyeOff,
  KeyRound,
  LayoutGrid,
  MapPin,
  MessageSquareQuote,
  Palette,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@stayvinci/ui';
import {
  BUSINESS_APP_URL,
  GUEST_APP_URL,
  KIND_LABEL,
  media,
  money,
  store,
  stores,
  storeUrl,
  type StoreCard,
} from '../api';
import { PhoneFrame } from '../components/DeviceFrame';

export function HomePage() {
  const all = useQuery({ queryKey: ['stores'], queryFn: () => stores() });
  const items = all.data ?? [];
  const spas = items.filter((s) => s.vertical === 'spa');
  const ateliers = items.filter((s) => s.vertical === 'atelier');
  const stays = items.filter((s) => s.vertical === 'short_stay');
  const showcase = spas[0]?.handle;

  return (
    <main>
      <Hero showcase={showcase} count={items.length} />
      <Solves />
      <Journey />
      <section id="spas" className="scroll-mt-20 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <SectionHead
            eyebrow="The spas we work with"
            title="Each spa, its own private store"
            lead="These spas run their bookings on Stayvinci. Open any of them to see their store exactly as guests see it in the app."
          />
          <PlaceGrid loading={all.isLoading} error={all.error} items={spas} size="lg" />
        </div>
      </section>
      <section id="ateliers" className="scroll-mt-20 bg-surface py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <SectionHead
            eyebrow="Ateliers"
            title="Independent professionals, verified"
            lead="Therapists, stylists, nail and make-up artists with their own store: their menu, their hours, their guests."
          />
          <PlaceGrid loading={all.isLoading} error={all.error} items={ateliers} size="sm" />
        </div>
      </section>
      <section id="stays" className="scroll-mt-20 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <SectionHead
            eyebrow="Rooms & stays"
            title="Rooms worth staying in"
            lead="Hosts show their available rooms with photos and amenities. Guests book a night and get the address with their booking."
          />
          <PlaceGrid loading={all.isLoading} error={all.error} items={stays} size="sm" />
        </div>
      </section>
      <Reviews items={items} />
      <ForBusiness />
    </main>
  );
}

/* ---------- Hero ---------- */

function Hero({ showcase, count }: { showcase: string | undefined; count: number }) {
  return (
    <section className="relative isolate overflow-hidden bg-obsidian-900 text-white">
      <img
        src={media('/demo/pool.jpg') ?? ''}
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover opacity-35"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-obsidian-900 via-obsidian-900/85 to-obsidian-900/30" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-32 pb-20 sm:px-6 md:pt-40 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pb-28">
        <div className="animate-rise">
          <div className="text-[11px] font-semibold tracking-[0.24em] text-gold-300 uppercase">
            Spas · Ateliers · Stays · Kenya
          </div>
          <h1 className="mt-5 text-[2.6rem] leading-[1.04] font-semibold tracking-tight sm:text-6xl lg:text-[4.2rem]">
            The places you love,
            <br />
            booked privately.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/75">
            Stayvinci gives every spa, therapist and stay its own private, branded store. Guests
            find it with a code or in Discover, see real free times, book in seconds and pay the
            place directly. Nothing on their lock screen gives them away.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#spas"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-obsidian-900 transition hover:bg-ivory"
            >
              Explore our spas <ArrowRight className="size-4" />
            </a>
            <a
              href="#business"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              For businesses
            </a>
          </div>
          <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <div>
              <dt className="text-white/50">Places on Stayvinci</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{count || '—'}</dd>
            </div>
            <div>
              <dt className="text-white/50">Double bookings</dt>
              <dd className="mt-0.5 text-2xl font-semibold">Zero, by design</dd>
            </div>
            <div>
              <dt className="text-white/50">Guest money we hold</dt>
              <dd className="mt-0.5 text-2xl font-semibold">None</dd>
            </div>
          </dl>
        </div>
        <div className="hidden justify-center lg:flex">
          {showcase ? (
            <PhoneFrame src={storeUrl(showcase)} title="A spa store in the Stayvinci app" />
          ) : (
            <div className="h-[640px] w-[316px] rounded-[48px] border border-white/15 bg-white/5" />
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- What we solve ---------- */

const GUEST_SOLVES = [
  {
    icon: CalendarClock,
    pain: 'Booking a spa means calls, DMs and waiting for a reply.',
    fix: 'See real free times and book in seconds, day or night.',
  },
  {
    icon: BellOff,
    pain: 'Reminders and texts tell anyone holding your phone where you go.',
    fix: 'Neutral reminders that never name the place or the service.',
  },
  {
    icon: EyeOff,
    pain: 'Your number ends up in every staff phone.',
    fix: 'The place sees an alias. Your number stays with Stayvinci.',
  },
  {
    icon: LayoutGrid,
    pain: 'A different link, number or app for every place you use.',
    fix: 'One app for all your places: enter by private code, link, QR or Discover.',
  },
  {
    icon: Wallet,
    pain: 'Paying a middleman, then chasing refunds.',
    fix: 'Pay the place directly by M-Pesa. Cancellation terms are clear before you book.',
  },
  {
    icon: MessageSquareQuote,
    pain: 'Reviews you cannot trust.',
    fix: 'Only guests with a completed visit can review. Nothing is bought or invented.',
  },
];

const BUSINESS_SOLVES = [
  {
    icon: Palette,
    title: 'A store that looks like you',
    body: 'Your logo, colours, cover, seasonal themes and a moving banner for offers. Private by code, or listed in Discover.',
  },
  {
    icon: CalendarCheck,
    title: 'No double bookings, ever',
    body: 'Therapists, rooms, pools and suites are booked together, with clean-up time between guests. Enforced by the database, not by luck.',
  },
  {
    icon: Wallet,
    title: 'Your money, straight to you',
    body: 'Guests pay into your own M-Pesa Till or Paybill. Stayvinci never holds guest funds.',
  },
  {
    icon: Users,
    title: 'Team, rooms and calendar in one place',
    body: 'Every booking, check-in and no-show in one calendar. Staff see guests by alias; contact details only for roles you allow.',
  },
  {
    icon: RefreshCcw,
    title: 'Guests who come back to you',
    body: 'Guests who arrive through your code stay yours. The marketplace fee applies only to the first visit of a guest Stayvinci brings you.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified and audited',
    body: 'Every House and Atelier is verified. Every privileged action and money movement is logged.',
  },
];

function Solves() {
  return (
    <section id="solves" className="scroll-mt-20 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <SectionHead
          eyebrow="What Stayvinci solves"
          title="Premium care deserves a better way to book"
          lead="Spas and therapists in Nairobi still run on phone calls, WhatsApp threads and paper diaries. Guests want discretion. Stayvinci fixes both sides."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {GUEST_SOLVES.map((s) => (
            <article
              key={s.fix}
              className="rounded-2xl border border-line bg-surface p-6 shadow-card"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-obsidian-900 text-gold-300 dark:bg-white/10">
                <s.icon className="size-5" />
              </span>
              <p className="mt-5 text-sm text-ink-subtle line-through decoration-ink-subtle/40">
                {s.pain}
              </p>
              <p className="mt-2 text-[17px] leading-snug font-semibold">{s.fix}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- The guest journey ---------- */

const STEPS = [
  { icon: Smartphone, title: 'Get the app', body: 'One app on Android, iPhone or the web.' },
  {
    icon: KeyRound,
    title: 'Find your place',
    body: 'Enter a private code, scan the QR at reception, or browse Discover.',
  },
  {
    icon: CalendarCheck,
    title: 'Book a time',
    body: 'Pick the treatment, the person and a free time. Confirmed instantly.',
  },
  {
    icon: MapPin,
    title: 'Visit',
    body: 'The address comes with your booking. Pay the place directly.',
  },
  {
    icon: RefreshCcw,
    title: 'Come back',
    body: 'Your places stay in the app. Rebook in two taps.',
  },
];

function Journey() {
  return (
    <section className="bg-obsidian-sheen py-20 text-white md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <SectionHead
          dark
          eyebrow="How it works"
          title="From code to calm in five steps"
          lead="The website shows you the places. The app is where guests live with them."
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <s.icon className="size-5 text-gold-300" />
                <span className="text-xs font-semibold text-white/40 tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="mt-6 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-white/65">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <a
            href={GUEST_APP_URL}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-obsidian-900 transition hover:bg-ivory"
          >
            Open the app <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------- Places ---------- */

function PlaceGrid({
  items,
  loading,
  error,
  size,
}: {
  items: StoreCard[];
  loading: boolean;
  error: Error | null;
  size: 'lg' | 'sm';
}) {
  if (error)
    return (
      <p className="rounded-2xl border border-line p-8 text-center text-sm text-ink-muted">
        {error.message}
      </p>
    );
  if (loading)
    return (
      <div
        className={cn(
          'grid gap-5',
          size === 'lg' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {Array.from({ length: size === 'lg' ? 6 : 4 }, (_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl bg-line/60" />
        ))}
      </div>
    );
  if (!items.length)
    return (
      <p className="rounded-2xl border border-line p-8 text-center text-sm text-ink-muted">
        Coming soon.
      </p>
    );
  return (
    <div
      className={cn(
        'grid gap-5',
        size === 'lg' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {items.map((s) => (
        <PlaceCard key={s.handle} s={s} size={size} />
      ))}
    </div>
  );
}

function Rating({ s, light }: { s: StoreCard; light?: boolean }) {
  return s.rating.average !== null ? (
    <span className="inline-flex items-center gap-1 text-[13px] font-medium">
      <Star className="size-3.5 fill-gold-400 text-gold-400" />
      {s.rating.average.toFixed(1)}
      <span className={light ? 'text-white/60' : 'text-ink-subtle'}>({s.rating.count})</span>
    </span>
  ) : (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[12px] font-medium',
        light ? 'text-white/70' : 'text-ink-subtle',
      )}
    >
      <Sparkles className="size-3.5" /> New on Stayvinci
    </span>
  );
}

function PlaceCard({ s, size }: { s: StoreCard; size: 'lg' | 'sm' }) {
  const place = [s.area, s.city].filter(Boolean).join(', ');
  return (
    <Link
      to={`/places/${s.handle}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div
        className={cn('relative overflow-hidden bg-obsidian-900', size === 'lg' ? 'h-60' : 'h-44')}
      >
        {s.cover_url ? (
          <img
            src={media(s.cover_url) ?? ''}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-obsidian-900">
          {KIND_LABEL[s.vertical]}
        </span>
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-obsidian-900">
          <BadgeCheck className="size-3.5 text-azure-700" /> Verified
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3
            className={cn('font-semibold tracking-tight', size === 'lg' ? 'text-lg' : 'text-base')}
          >
            {s.name}
          </h3>
          <Rating s={s} />
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{s.tagline}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[13px]">
          <span className="flex min-w-0 items-center gap-1 truncate text-ink-muted">
            <MapPin className="size-3.5 shrink-0" /> {place}
          </span>
          {s.from_price_minor !== null ? (
            <span className="shrink-0 font-medium">
              from {money(s.from_price_minor, s.currency)}
            </span>
          ) : null}
        </div>
        {size === 'lg' ? (
          <span className="mt-4 inline-flex items-center gap-1.5 border-t border-line pt-4 text-sm font-semibold text-azure-700 dark:text-azure-400">
            See their store{' '}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/* ---------- Reviews (real ones only) ---------- */

function Reviews({ items }: { items: StoreCard[] }) {
  const rated = items
    .filter((s) => s.rating.count > 0)
    .sort((a, b) => b.rating.count - a.rating.count)
    .slice(0, 6);
  const details = useQueries({
    queries: rated.map((s) => ({ queryKey: ['store', s.handle], queryFn: () => store(s.handle) })),
  });
  const quotes = details
    .flatMap((d) =>
      d.data
        ? d.data.reviews
            .filter((r) => r.comment.trim())
            .slice(0, 2)
            .map((r) => ({ ...r, store: d.data.name, handle: d.data.handle }))
        : [],
    )
    .slice(0, 6);
  return (
    <section id="reviews" className="scroll-mt-20 bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <SectionHead
          eyebrow="Reviews"
          title="Only from real visits"
          lead="Every review on Stayvinci is written by a guest after a completed booking. We never buy, write or edit reviews, and places can reply but not delete them."
        />
        {quotes.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quotes.map((q) => (
              <figure
                key={q.id}
                className="flex flex-col rounded-2xl border border-line bg-canvas p-6 shadow-card"
              >
                <div className="flex gap-0.5" aria-label={`${q.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={cn(
                        'size-4',
                        i <= q.rating ? 'fill-gold-400 text-gold-400' : 'text-line-strong',
                      )}
                    />
                  ))}
                </div>
                <blockquote className="mt-3 flex-1 text-[15px]">“{q.comment}”</blockquote>
                <figcaption className="mt-4 text-sm">
                  <Link to={`/places/${q.handle}`} className="font-semibold hover:underline">
                    {q.store}
                  </Link>
                  <span className="text-ink-subtle"> · verified visit</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
            <MessageSquareQuote className="size-8 text-ink-subtle" />
            <p className="mt-4 max-w-lg text-[15px] text-ink-muted">
              Our places have just opened their stores on Stayvinci. Guest reviews will appear here
              as visits are completed, never before.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- For businesses ---------- */

function ForBusiness() {
  return (
    <section id="business" className="scroll-mt-20 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <SectionHead
          eyebrow="For spas, Ateliers and hosts"
          title="Run your bookings like a five-star house"
          lead="Join, connect your own M-Pesa, get verified, design your store, then open your door: privately by code, or listed for new guests."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {BUSINESS_SOLVES.map((b) => (
            <article
              key={b.title}
              className="rounded-2xl border border-line bg-surface p-6 shadow-card"
            >
              <b.icon className="size-6 text-azure-700 dark:text-azure-400" />
              <h3 className="mt-4 text-[17px] font-semibold">{b.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{b.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-3xl bg-obsidian-sheen p-8 text-white md:flex-row md:items-center md:p-10">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">Already a Stayvinci House?</h3>
            <p className="mt-1 text-white/70">
              Sign in to manage your store, team, rooms and calendar.
            </p>
          </div>
          <a
            href={BUSINESS_APP_URL}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-obsidian-900 transition hover:bg-ivory"
          >
            Business sign-in <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------- Shared ---------- */

export function SectionHead({
  eyebrow,
  title,
  lead,
  dark,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  dark?: boolean;
}) {
  return (
    <div className="mb-10 max-w-3xl md:mb-14">
      <div
        className={cn(
          'text-[11px] font-semibold tracking-[0.24em] uppercase',
          dark ? 'text-gold-300' : 'text-ink-subtle',
        )}
      >
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-[2.6rem] md:leading-[1.1]">
        {title}
      </h2>
      {lead ? (
        <p className={cn('mt-4 text-[17px]', dark ? 'text-white/70' : 'text-ink-muted')}>{lead}</p>
      ) : null}
    </div>
  );
}
