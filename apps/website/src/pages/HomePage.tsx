import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
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
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@stayvinci/ui';
import { BUSINESS_APP_URL, GUEST_APP_URL, media, store, stores, type StoreCard } from '../api';
import { AtlasCard } from '../components/AtlasCard';
import { CATEGORIES, JOURNAL, SEASON, SELECTION, areasOf } from '../editorial';
import { GuideCard } from './JournalPage';

export function HomePage() {
  const all = useQuery({ queryKey: ['stores'], queryFn: () => stores() });
  const items = all.data ?? [];
  const spas = items.filter((s) => s.vertical === 'spa');
  const ateliers = items.filter((s) => s.vertical === 'atelier');
  const stays = items.filter((s) => s.vertical === 'short_stay');

  return (
    <main>
      <Hero items={items} />
      <Selection items={items} />
      <Categories items={items} />
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
      <Areas items={items} />
      <Reviews items={items} />
      <JournalTeaser />
      <ForBusiness />
    </main>
  );
}

/* ---------- Hero ---------- */

function Hero({ items }: { items: StoreCard[] }) {
  const count = items.length;
  const navigate = useNavigate();
  const [q, setQ] = useState('');
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
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-obsidian-900 transition hover:bg-ivory"
            >
              Explore every place <ArrowRight className="size-4" />
            </Link>
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
        <div className="hidden lg:block">
          <div className="border border-white/10 bg-noir-950/70 p-7 backdrop-blur-md">
            <div className="text-[10px] font-medium tracking-[0.26em] text-[#e4cf9f] uppercase">
              The index · {SEASON}
            </div>
            <form
              className="mt-5 flex items-center gap-3 border border-white/15 bg-white/5 px-4 py-3 focus-within:border-gold-300/60"
              onSubmit={(e) => {
                e.preventDefault();
                void navigate(`/explore${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
              }}
            >
              <Search className="size-4 text-white/60" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="A place, a treatment, an area…"
                className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
              />
            </form>
            <ul className="mt-4 divide-y divide-white/10">
              {CATEGORIES.map((c) => (
                <li key={c.vertical}>
                  <Link
                    to={`/explore?kind=${c.vertical}`}
                    className="group flex items-baseline justify-between gap-4 py-4"
                  >
                    <span>
                      <span className="block text-xl font-semibold tracking-tight">{c.label}</span>
                      <span className="block text-[13px] text-white/50">{c.blurb}</span>
                    </span>
                    <span className="flex items-center gap-3 text-2xl font-light text-[#e4cf9f] tabular-nums">
                      {items.filter((s) => s.vertical === c.vertical).length || '—'}
                      <ArrowRight className="size-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/standard"
              className="mt-4 flex items-center gap-2.5 text-[10px] font-medium tracking-[0.26em] text-white/60 uppercase hover:text-white"
            >
              <BadgeCheck className="size-3.5 text-azure-400" /> Every place verified · our standard
            </Link>
          </div>
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
              <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-900 text-gold-300 dark:bg-emerald-800">
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
    <section className="bg-emerald-sheen py-20 text-white md:py-28">
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
            href={`${GUEST_APP_URL}/?install=1`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-emerald-900 transition hover:bg-ivory"
          >
            Get the app <ArrowRight className="size-4" />
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
        <AtlasCard key={s.handle} s={s} size={size === 'lg' ? 'md' : 'mini'} />
      ))}
    </div>
  );
}

/* ---------- Atlas-style section number: "I —— The selection" ---------- */

function Numbered({ n, label, light }: { n: string; label: string; light?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 text-[11px] font-medium tracking-[0.26em] uppercase',
        light ? 'text-[#e4cf9f]' : 'text-gold-600 dark:text-gold-400',
      )}
    >
      <span>{n}</span>
      <span className={cn('h-px w-10', light ? 'bg-[#e4cf9f]/50' : 'bg-gold-400/60')} />
      <span>{label}</span>
    </div>
  );
}

/* ---------- The season's selection, on noir ---------- */

function Selection({ items }: { items: StoreCard[] }) {
  const picks = SELECTION.map((h) => items.find((s) => s.handle === h)).filter(
    (s): s is StoreCard => !!s,
  );
  if (!picks.length) return null;
  return (
    <section id="selection" className="scroll-mt-20 bg-noir-sheen py-20 text-[#f1ebdf] md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <Numbered n="I" label={`The selection · ${SEASON}`} light />
            <h2 className="mt-5 max-w-2xl text-3xl leading-tight font-semibold tracking-tight md:text-[2.6rem]">
              Places we would send a friend to
            </h2>
            <p className="mt-4 max-w-xl text-[15px] text-[#a59d90]">
              Chosen by the Stayvinci team for the season. A place can’t pay to be here.
            </p>
          </div>
          <Link
            to="/explore"
            className="flex shrink-0 items-center gap-2.5 text-[11px] font-medium tracking-[0.26em] text-[#e4cf9f] uppercase hover:text-white"
          >
            Every place <span className="h-px w-8 bg-current" />
          </Link>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {picks.map((s, i) => (
            <AtlasCard
              key={s.handle}
              s={s}
              tone="noir"
              size="mini"
              tag={`No. ${String(i + 1).padStart(2, '0')}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Categories with counts ---------- */

function Categories({ items }: { items: StoreCard[] }) {
  return (
    <section className="py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <Numbered n="II" label="Categories" />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {CATEGORIES.map((c) => {
            const n = items.filter((s) => s.vertical === c.vertical).length;
            return (
              <Link
                key={c.vertical}
                to={`/explore?kind=${c.vertical}`}
                className="group relative isolate flex aspect-[5/4] flex-col justify-end overflow-hidden rounded-xl border border-line p-6 text-white shadow-card transition-shadow hover:shadow-card-hover"
              >
                <img
                  src={media(c.image) ?? ''}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 -z-10 size-full object-cover brightness-[.7] transition-[transform,filter] duration-[1400ms] group-hover:scale-105 group-hover:brightness-[.8]"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-noir-950/90 via-noir-950/30 to-transparent" />
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-medium tracking-[0.26em] text-[#e4cf9f] uppercase">
                      {c.blurb}
                    </div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">{c.label}</div>
                  </div>
                  <div className="text-4xl font-light text-[#e4cf9f] tabular-nums">{n || '—'}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Browse by area ---------- */

function Areas({ items }: { items: StoreCard[] }) {
  const areas = areasOf(items).slice(0, 8);
  if (!areas.length) return null;
  return (
    <section className="bg-noir-sheen py-20 text-[#f1ebdf] md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <Numbered n="III" label="By area" light />
        <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
          Close to home, or close to work
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden border border-noir-line bg-noir-line sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((a) => (
            <Link
              key={a.area}
              to={`/explore?area=${encodeURIComponent(a.area)}`}
              className="group relative isolate flex min-h-40 flex-col justify-end bg-noir-900 p-5"
            >
              {a.cover ? (
                <img
                  src={media(a.cover) ?? ''}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 -z-10 size-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-35"
                />
              ) : null}
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xl font-semibold tracking-tight">{a.area}</span>
                <span className="text-sm text-[#e4cf9f] tabular-nums">
                  {a.count} {a.count === 1 ? 'place' : 'places'}
                </span>
              </div>
              <span className="mt-3 flex items-center gap-2.5 text-[10px] font-medium tracking-[0.26em] text-noir-muted uppercase group-hover:text-[#e4cf9f]">
                Discover
                <span className="h-px w-[18px] bg-current transition-[width] duration-300 group-hover:w-[34px]" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Journal ---------- */

function JournalTeaser() {
  return (
    <section className="py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <Numbered n="IV" label="The Journal" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
              Guides for slower, better visits
            </h2>
          </div>
          <Link
            to="/journal"
            className="hidden shrink-0 items-center gap-2.5 text-[11px] font-medium tracking-[0.26em] text-gold-600 uppercase sm:flex dark:text-gold-400"
          >
            All guides <span className="h-px w-8 bg-current" />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNAL.map((g) => (
            <GuideCard key={g.slug} g={g} />
          ))}
        </div>
      </div>
    </section>
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
        <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-3xl bg-emerald-sheen p-8 text-white md:flex-row md:items-center md:p-10">
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
