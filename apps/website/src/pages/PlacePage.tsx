import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@stayvinci/ui';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  MapPin,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import {
  DAY_LABELS,
  KIND_LABEL,
  duration,
  media,
  money,
  store,
  stores,
  storeUrl,
  type StoreDetail,
} from '../api';

/**
 * A place's own page on the Stayvinci website: its profile, menu, rooms, hours and reviews,
 * with a booking card that opens its store in the app.
 */
export function PlacePage() {
  const { handle = '' } = useParams();
  const q = useQuery({ queryKey: ['store', handle], queryFn: () => store(handle) });
  useEffect(() => {
    document.title = q.data ? `${q.data.name} · Stayvinci` : 'Stayvinci';
    return () => {
      document.title = 'Stayvinci';
    };
  }, [q.data]);

  if (q.error)
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 pt-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {q.error.message === 'not_found' ? 'This place isn’t listed' : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {q.error.message === 'not_found'
            ? 'Some places on Stayvinci are private and open only with their code, in the app.'
            : q.error.message}
        </p>
        <Link to="/#spas" className="mt-6 text-sm font-semibold text-azure-700 dark:text-azure-400">
          See the places we work with
        </Link>
      </main>
    );
  if (!q.data)
    return (
      <main>
        <div className="h-[62vh] animate-pulse bg-obsidian-900" />
      </main>
    );
  const s = q.data;
  return (
    <main>
      <PlaceHero s={s} />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-10 lg:py-20">
        <div className="min-w-0 space-y-16">
          <About s={s} />
          <MenuSection s={s} />
          <Rooms s={s} />
          <Team s={s} />
          <VisitInfo s={s} />
          <PlaceReviews s={s} />
        </div>
        <aside className="hidden lg:block">
          <BookCard s={s} />
        </aside>
      </div>
      <MorePlaces s={s} />
    </main>
  );
}

function PlaceHero({ s }: { s: StoreDetail }) {
  const place = [s.area, s.city].filter(Boolean).join(', ');
  return (
    <section className="relative isolate overflow-hidden bg-obsidian-900 text-white">
      {s.cover_url ? (
        <img
          src={media(s.cover_url) ?? ''}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover opacity-55"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-obsidian-900 via-obsidian-900/50 to-obsidian-900/30" />
      <div className="mx-auto max-w-7xl px-4 pt-28 pb-14 sm:px-6 md:pt-40 md:pb-20 lg:px-10">
        <Link
          to="/#spas"
          className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="size-4" /> All places
        </Link>
        <div className="mt-8 flex flex-wrap items-center gap-2 text-[12px] font-semibold">
          <span className="rounded-full bg-white/90 px-3 py-1 text-obsidian-900">
            {KIND_LABEL[s.vertical]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
            <BadgeCheck className="size-3.5 text-azure-400" /> Verified on Stayvinci
          </span>
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
          {s.name}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-white/80">{s.tagline}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/75">
          {place ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> {place}
            </span>
          ) : null}
          {s.rating.average !== null ? (
            <span className="flex items-center gap-1.5">
              <Star className="size-4 fill-gold-400 text-gold-400" /> {s.rating.average.toFixed(1)}{' '}
              from {s.rating.count} verified {s.rating.count === 1 ? 'visit' : 'visits'}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-4" /> New on Stayvinci
            </span>
          )}
          {s.from_price_minor !== null ? (
            <span>From {money(s.from_price_minor, s.currency)}</span>
          ) : null}
        </div>
        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href={storeUrl(s.handle)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-obsidian-900 transition hover:bg-ivory"
          >
            Book in the app <ArrowRight className="size-4" />
          </a>
          <a
            href="#menu"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            See the menu
          </a>
        </div>
      </div>
    </section>
  );
}

/** Sticky card beside the profile: price, place, today's hours, and the way in. */
function BookCard({ s }: { s: StoreDetail }) {
  const place = [s.area, s.city].filter(Boolean).join(', ');
  const loc = s.locations[0];
  const key = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[new Date().getDay()];
  const today = key && loc ? (loc.hours[key] ?? []) : [];
  return (
    <div className="sticky top-24 rounded-2xl border border-line bg-surface p-6 shadow-card">
      <div className="text-[11px] font-semibold tracking-[0.22em] text-ink-subtle uppercase">
        Book a visit
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{s.name}</div>
      {s.from_price_minor !== null ? (
        <div className="mt-1 text-sm text-ink-muted">
          From{' '}
          <span className="font-semibold text-ink">{money(s.from_price_minor, s.currency)}</span>
        </div>
      ) : null}
      <ul className="mt-5 space-y-2.5 text-sm text-ink-muted">
        {place ? (
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-ink-subtle" /> {place}
          </li>
        ) : null}
        {loc ? (
          <li className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-ink-subtle" />
            {today.length
              ? `Open today ${today.map(([o, c]) => `${o}–${c}`).join(', ')}`
              : 'Closed today'}
          </li>
        ) : null}
        {s.rating.average !== null ? (
          <li className="flex items-center gap-2">
            <Star className="size-4 shrink-0 fill-gold-400 text-gold-400" />
            {s.rating.average.toFixed(1)} from {s.rating.count} verified visit
            {s.rating.count === 1 ? '' : 's'}
          </li>
        ) : null}
      </ul>
      <a
        href={storeUrl(s.handle)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-obsidian-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-obsidian-800 dark:bg-white dark:text-obsidian-900"
      >
        Book in the app <ArrowRight className="size-4" />
      </a>
      <p className="mt-3 text-center text-xs text-ink-subtle">
        Private and discreet. Reminders never name the place.
      </p>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">{children}</h2>;
}

function About({ s }: { s: StoreDetail }) {
  return (
    <section>
      <H>About</H>
      <p className="mt-4 text-[17px] leading-relaxed whitespace-pre-line text-ink-muted">
        {s.about}
      </p>
      {s.highlights.length ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {s.highlights.map((h) => (
            <li
              key={h}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm shadow-card"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-azure-700 dark:text-azure-400" /> {h}
            </li>
          ))}
        </ul>
      ) : null}
      {s.amenities.length ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {s.amenities.map((a) => (
            <span
              key={a}
              className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-muted"
            >
              {a}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MenuSection({ s }: { s: StoreDetail }) {
  if (!s.services.length) return null;
  const groups = [
    ...s.categories.map((c) => ({
      id: c.id,
      name: c.name,
      services: s.services.filter((x) => x.category_id === c.id),
    })),
    { id: '_', name: 'More', services: s.services.filter((x) => !x.category_id) },
  ].filter((g) => g.services.length);
  return (
    <section id="menu" className="scroll-mt-24">
      <H>{s.vertical === 'short_stay' ? 'Stays and rates' : 'Menu'}</H>
      <p className="mt-2 text-sm text-ink-muted">
        Prices as shown in their store. Book any of these in the app.
      </p>
      <div className="mt-8 space-y-10">
        {groups.map((g) => (
          <div key={g.id}>
            <h3 className="text-[11px] font-semibold tracking-[0.22em] text-ink-subtle uppercase">
              {g.name}
            </h3>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
              {g.services.map((svc) => (
                <li key={svc.id} className="flex gap-4 p-5">
                  {svc.image_url ? (
                    <img
                      src={media(svc.image_url) ?? ''}
                      alt=""
                      loading="lazy"
                      className="hidden size-20 shrink-0 rounded-xl object-cover sm:block"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{svc.name}</div>
                    {svc.description ? (
                      <p className="mt-1 text-sm text-ink-muted">{svc.description}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {svc.variants.map((v) => (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-[13px]"
                        >
                          <Clock className="size-3.5 text-ink-subtle" />
                          {/\d|night/i.test(v.name)
                            ? v.name
                            : `${v.name} · ${duration(v.duration_min)}`}
                          <span className="font-semibold">{money(v.price_minor, v.currency)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Rooms({ s }: { s: StoreDetail }) {
  if (!s.rooms.length) return null;
  return (
    <section>
      <H>{s.vertical === 'short_stay' ? 'The rooms' : 'Rooms & facilities'}</H>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {s.rooms.map((r) => (
          <article
            key={r.id}
            className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
          >
            {r.gallery[0] ? (
              <img
                src={media(r.gallery[0]) ?? ''}
                alt=""
                loading="lazy"
                className="h-44 w-full object-cover"
              />
            ) : null}
            <div className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{r.name}</h3>
                <span className="flex shrink-0 items-center gap-1 text-xs text-ink-subtle">
                  <Users className="size-3.5" />{' '}
                  {r.capacity > 1 ? `Up to ${r.capacity}` : '1 guest'}
                </span>
              </div>
              {r.description ? (
                <p className="mt-1.5 text-sm text-ink-muted">{r.description}</p>
              ) : null}
              {r.amenities.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.amenities.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-canvas px-2.5 py-0.5 text-[12px] text-ink-muted"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Team({ s }: { s: StoreDetail }) {
  if (!s.team.length) return null;
  return (
    <section>
      <H>{s.kind === 'atelier' ? 'Who you’ll see' : 'The team'}</H>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {s.team.map((p) => (
          <div
            key={p.id}
            className="flex gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
          >
            {p.photo_url ? (
              <img
                src={media(p.photo_url) ?? ''}
                alt=""
                className="size-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-obsidian-900 text-lg font-semibold text-gold-300">
                {p.name.charAt(0)}
              </span>
            )}
            <div className="min-w-0">
              <div className="font-semibold">{p.name}</div>
              {p.title ? <div className="text-sm text-ink-muted">{p.title}</div> : null}
              {p.bio ? <p className="mt-2 text-sm text-ink-muted">{p.bio}</p> : null}
              {p.specialties.length ? (
                <p className="mt-2 text-[12px] text-ink-subtle">{p.specialties.join(' · ')}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function VisitInfo({ s }: { s: StoreDetail }) {
  const hours = s.locations[0]?.hours ?? {};
  const policies = Object.values(s.policies);
  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h3 className="font-semibold">Opening hours</h3>
        <ul className="mt-3 space-y-1.5 text-sm">
          {DAY_LABELS.map(([k, label]) => {
            const spans = hours[k] ?? [];
            return (
              <li key={k} className="flex justify-between gap-4">
                <span className="text-ink-muted">{label}</span>
                <span className="tabular-nums">
                  {spans.length ? spans.map(([a, b]) => `${a} – ${b}`).join(', ') : 'Closed'}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-xs text-ink-subtle">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          {[s.area, s.city].filter(Boolean).join(', ')}. The exact address comes with your booking.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h3 className="font-semibold">Good to know</h3>
        <ul className="mt-3 space-y-3 text-sm text-ink-muted">
          {(policies.length
            ? policies
            : ['Free cancellation up to 2 hours before, in the app.']
          ).map((p) => (
            <li key={p} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-azure-700 dark:text-azure-400" /> {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PlaceReviews({ s }: { s: StoreDetail }) {
  return (
    <section>
      <H>Reviews</H>
      {s.reviews.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {s.reviews.map((r) => (
            <figure
              key={r.id}
              className="rounded-2xl border border-line bg-surface p-5 shadow-card"
            >
              <div className="flex gap-0.5" aria-label={`${r.rating} out of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={cn(
                      'size-4',
                      i <= r.rating ? 'fill-gold-400 text-gold-400' : 'text-line-strong',
                    )}
                  />
                ))}
              </div>
              {r.comment ? (
                <blockquote className="mt-2 text-[15px]">“{r.comment}”</blockquote>
              ) : null}
              {r.reply ? (
                <p className="mt-3 border-l-2 border-line-strong pl-3 text-[13px] text-ink-muted">
                  <span className="font-medium text-ink">{s.name}:</span> {r.reply}
                </p>
              ) : null}
              <figcaption className="mt-3 text-xs text-ink-subtle">
                Verified visit ·{' '}
                {new Date(r.created_at).toLocaleDateString('en-KE', {
                  month: 'long',
                  year: 'numeric',
                })}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-line-strong p-6 text-sm text-ink-muted">
          No reviews yet. Reviews on Stayvinci come only from guests after a completed visit.
        </p>
      )}
    </section>
  );
}

function MorePlaces({ s }: { s: StoreDetail }) {
  const q = useQuery({ queryKey: ['stores', s.vertical], queryFn: () => stores(s.vertical) });
  const others = (q.data ?? []).filter((x) => x.handle !== s.handle).slice(0, 4);
  if (!others.length) return null;
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          More {s.vertical === 'spa' ? 'spas' : s.vertical === 'short_stay' ? 'stays' : 'Ateliers'}{' '}
          on Stayvinci
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((o) => (
            <Link
              key={o.handle}
              to={`/places/${o.handle}`}
              className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="h-36 overflow-hidden bg-obsidian-900">
                {o.cover_url ? (
                  <img
                    src={media(o.cover_url) ?? ''}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : null}
              </div>
              <div className="p-4">
                <div className="font-semibold">{o.name}</div>
                <div className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{o.tagline}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
