import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Radio,
  Crown,
  Gift,
  Images,
  KeyRound,
  Lock,
  MapPin,
  Package,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Avatar, Badge, ServiceVisual, SOCIAL_LABEL, cn } from '@stayvinci/ui';
import { paintSection } from '@stayvinci/demo-data/design';
import { date, durationLabel, money } from '@stayvinci/demo-data/format';
import { Stars } from '../../app/shared';
import { StoreSocials, useStore } from './StoreLayout';
import { LiveSessions } from './LiveSessions';
import type { StoreView } from '../../mock/api';

type Service = StoreView['services'][number];

function fromPrice(s: Service) {
  return Math.min(...s.variants.map((v) => v.price));
}

export function ServiceRow({ s, handle }: { s: Service; handle: string }) {
  const { palette } = useStore();
  const min = Math.min(...s.variants.map((v) => v.durationMin));
  return (
    <Link
      to={`/s/${handle}/o/${s.id}`}
      className="flex items-center gap-4 py-4 transition-colors hover:bg-black/[0.015]"
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl sm:size-20">
        <ServiceVisual
          image={s.image}
          icon={s.icon}
          name={s.name}
          from={palette.bg}
          to={palette.accent}
          iconColor={palette.fg}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{s.name}</span>
          {s.visibility === 'invite_only' ? (
            <Badge tone="gold">
              <KeyRound className="size-3" /> Private
            </Badge>
          ) : null}
          {s.visibility === 'members_only' ? <Badge tone="plum">Members</Badge> : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-muted">{s.description}</p>
        <div className="mt-1.5 flex items-center gap-1 text-xs text-ink-subtle">
          <Clock className="size-3.5" /> from {durationLabel(min)}
          {s.variants.length > 1 ? ` · ${s.variants.length} options` : ''}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold">{money(fromPrice(s))}</div>
        <ChevronRight className="ml-auto size-4 text-ink-subtle" />
      </div>
    </Link>
  );
}

function SectionHead({ title, to, eyebrow }: { title: string; to?: string; eyebrow?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold tracking-[0.22em] text-ink-subtle uppercase in-data-[filled=true]:text-current in-data-[filled=true]:opacity-70">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{title}</h2>
      </div>
      {to ? (
        <Link
          to={to}
          className="text-[13px] font-medium text-azure-700 in-data-[filled=true]:text-current in-data-[filled=true]:underline"
        >
          See all
        </Link>
      ) : null}
    </div>
  );
}

export function StoreHome() {
  const s = useStore();
  const { handle = '' } = useParams();
  const th = s.palette;
  const featured = [...s.services].filter((x) => x.visibility !== 'hidden').slice(0, 4);
  const blocks: Record<string, React.ReactNode> = {
    featured: (
      <section key="featured">
        <SectionHead eyebrow="Our favourites" title="Featured" to={`/s/${handle}/menu`} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          {featured.map((f) => (
            <Link key={f.id} to={`/s/${handle}/o/${f.id}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
                <ServiceVisual
                  image={f.image}
                  icon={f.icon}
                  name={f.name}
                  from={th.bg}
                  to={th.accent}
                  iconColor={th.fg}
                  className="transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>
              <div className="mt-3 line-clamp-1 text-[15px] font-semibold">{f.name}</div>
              <div className="text-[13px] text-ink-muted in-data-[filled=true]:text-current in-data-[filled=true]:opacity-75">
                from {money(fromPrice(f))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    ),
    team: s.staff.length ? (
      <section key="team">
        <SectionHead title="Our team" />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {s.staff.map((p) => (
            <div
              key={p.id}
              className="w-40 shrink-0 rounded-2xl border border-line bg-surface p-4 text-center shadow-card"
            >
              <Avatar name={p.name} size="lg" className="mx-auto" />
              <div className="mt-2 text-sm font-semibold">{p.name.split(' ')[0]}</div>
              <div className="text-xs text-ink-muted">{p.title}</div>
              <div className="mt-2 line-clamp-1 text-[11px] text-ink-subtle">
                {p.specialties.join(' · ')}
              </div>
            </div>
          ))}
        </div>
      </section>
    ) : null,
    memberships: s.tiers.length ? (
      <section key="memberships">
        <Link
          to={`/s/${handle}/members`}
          className="flex items-center gap-4 rounded-2xl p-5"
          style={{ background: th.bg, color: th.fg }}
        >
          <Crown className="size-8 shrink-0" style={{ color: s.accent }} />
          <span className="flex-1">
            <span className="block font-semibold">Become a member</span>
            <span className="text-[13px]" style={{ color: th.muted }}>
              From {money(Math.min(...s.tiers.map((t) => t.monthly)))} a month · sessions included,
              priority booking
            </span>
          </span>
          <ChevronRight className="size-5" />
        </Link>
      </section>
    ) : null,
    reviews:
      s.reviews.length && s.rating ? (
        <section key="reviews">
          <SectionHead title="What guests say" />
          <div className="mb-3 flex items-center gap-2 text-sm">
            <Stars value={s.rating} /> <span className="font-semibold">{s.rating.toFixed(1)}</span>
            <span className="text-ink-muted in-data-[filled=true]:text-current in-data-[filled=true]:opacity-80">
              from verified visits
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.reviews.slice(0, 4).map((r) => (
              <figure
                key={r.id}
                className="rounded-2xl border border-line bg-surface p-4 shadow-card"
              >
                <Stars value={r.rating} size="size-3" />
                <blockquote className="mt-2 text-sm">“{r.body}”</blockquote>
                <figcaption className="mt-2 text-xs text-ink-subtle">{r.service}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null,
    location: (
      <section key="location">
        <SectionHead title="Visit" to={`/s/${handle}/about`} />
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <MapPin className="size-5 text-emerald-700" />
          <span className="flex-1 text-sm">
            <span className="block font-medium">{s.tenant.area}</span>
            <span className="text-[13px] text-ink-muted">
              {s.address ? s.address : 'Exact address is shared once your booking is paid.'}
            </span>
          </span>
        </div>
      </section>
    ),
  };
  const cats = s.categories.filter((c) => s.services.some((x) => x.categoryId === c.id));
  const live = s.content.find((c) => c.kind === 'live' && c.live?.status === 'live');
  return (
    <div className="space-y-14">
      {live ? (
        <Link
          to={`/s/${handle}/content`}
          className="flex items-center gap-4 rounded-2xl bg-obsidian-sheen p-4 text-white sm:p-5"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase">
            <Radio className="size-3.5 animate-pulse" /> Live
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{live.title}</span>
            <span className="text-[13px] text-white/70">
              With {live.live?.host.split(' ')[0]} · {live.live?.attending} watching now
            </span>
          </span>
          <span className="hidden items-center gap-1 text-sm font-semibold sm:flex">
            Join <ArrowRight className="size-4" />
          </span>
        </Link>
      ) : null}

      {cats.length > 1 ? (
        <section>
          <SectionHead eyebrow="Explore" title="Find your ritual" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {cats.slice(0, 4).map((c) => {
              const first = s.services.find((x) => x.categoryId === c.id);
              return (
                <Link
                  key={c.id}
                  to={`/s/${handle}/menu`}
                  className="group relative block aspect-[3/4] overflow-hidden rounded-2xl text-white sm:aspect-[4/5]"
                >
                  <ServiceVisual
                    image={c.image ?? first?.image ?? null}
                    icon={first?.icon ?? null}
                    name={c.name}
                    from={th.bg}
                    to={th.accent}
                    iconColor={th.fg}
                    className="transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="text-lg font-semibold tracking-tight">{c.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[12px] font-medium tracking-wider text-white/80 uppercase">
                      Discover <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {s.sections
        .filter((k) => k in blocks && blocks[k])
        .map((k) => {
          const paint = paintSection(s.sectionStyles[k], th, k);
          if (!paint.filled) return blocks[k];
          return (
            <div
              key={k}
              data-filled="true"
              className="-mx-4 rounded-none px-4 py-7 sm:mx-0 sm:rounded-3xl sm:px-6"
              style={{ background: paint.background, color: paint.color }}
            >
              {blocks[k]}
            </div>
          );
        })}
      {s.socials.length ? (
        <section className="rounded-3xl bg-obsidian-sheen px-6 py-10 text-center text-white">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-white/60 uppercase">
            Stay in touch
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Follow {s.tenant.name}</h2>
          <StoreSocials s={s} className="mt-4 justify-center" size="size-6" />
          <p className="mt-3 text-[13px] text-white/60">
            {s.socials.map((a) => SOCIAL_LABEL[a.network]).join(' · ')}
          </p>
        </section>
      ) : null}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-subtle">
        <ShieldCheck className="size-3.5" /> You’re in a private store. Nothing here is shown to
        other places.
      </p>
    </div>
  );
}

export function StoreMenu() {
  const s = useStore();
  const { handle = '' } = useParams();
  const [cat, setCat] = useState<string | null>(null);
  const cats = s.categories.filter((c) => s.services.some((x) => x.categoryId === c.id));
  return (
    <div className="space-y-6">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {[null, ...cats.map((c) => c.id)].map((id) => {
          const c = cats.find((x) => x.id === id);
          return (
            <button
              key={id ?? 'all'}
              type="button"
              onClick={() => setCat(id)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                cat === id
                  ? 'border-emerald-900 bg-emerald-900 text-ivory'
                  : 'border-line bg-surface text-ink-muted hover:text-ink',
              )}
            >
              {c?.name ?? 'All'}
            </button>
          );
        })}
      </div>
      {cats
        .filter((c) => !cat || c.id === cat)
        .map((c) => (
          <section
            key={c.id}
            className="rounded-2xl border border-line bg-surface px-5 shadow-card"
          >
            <h2 className="flex items-center gap-2 border-b border-line py-4 text-[15px] font-semibold">
              {c.name}
              {c.visibility === 'invite_only' ? (
                <Badge tone="gold">
                  <KeyRound className="size-3" /> Unlocked by your code
                </Badge>
              ) : null}
            </h2>
            <div className="divide-y divide-line">
              {s.services
                .filter((x) => x.categoryId === c.id)
                .map((x) => (
                  <ServiceRow key={x.id} s={x} handle={handle} />
                ))}
            </div>
          </section>
        ))}
      {s.packages.length || s.giftCards.length ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {s.packages.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <Package className="size-6 text-emerald-700" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-ink-muted">
                  {p.credits} sessions · valid {p.validityDays} days
                </div>
              </div>
              <div className="text-sm font-semibold">{money(p.price)}</div>
            </div>
          ))}
          {s.giftCards.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <Gift className="size-6 text-gold-600" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{g.name}</div>
                <div className="text-xs text-ink-muted">Send to someone special</div>
              </div>
              <div className="text-sm font-semibold">{g.value ? money(g.value) : 'Any amount'}</div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

export function StoreMembers() {
  const s = useStore();
  const th = s.palette;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Memberships</h2>
        <p className="text-sm text-ink-muted">
          Monthly sessions, member prices and priority booking. Cancel any time.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {s.tiers.map((t, i) => (
          <div
            key={t.id}
            className={cn(
              'flex flex-col rounded-2xl border bg-surface p-5 shadow-card',
              i === 1 ? 'border-gold-300 ring-1 ring-gold-300' : 'border-line',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t.name}</span>
              {s.membership === t.id ? (
                <Badge tone="emerald">Your plan</Badge>
              ) : i === 1 ? (
                <Badge tone="gold">Most chosen</Badge>
              ) : null}
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight">
              {money(t.monthly)}
              <span className="text-sm font-normal text-ink-muted"> / month</span>
            </div>
            <ul className="mt-4 flex-1 space-y-2 text-[13px]">
              {t.perks.map((p) => (
                <li key={p} className="flex gap-2">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-gold-500" /> {p}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={s.membership === t.id}
              className="mt-5 rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: th.bg === '#F5F1E8' ? '#092720' : th.bg, color: '#F5F1E8' }}
            >
              {s.membership === t.id ? 'Active' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StoreContent() {
  const s = useStore();
  const th = s.palette;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Live & content</h2>
        <p className="text-sm text-ink-muted">
          Guides and sessions from the House. Paid videos are bought on the web and play in the app.
        </p>
      </div>
      <LiveSessions s={s} />
      <div className="mb-1 text-[11px] font-semibold tracking-[0.22em] text-ink-subtle uppercase">
        Videos and guides
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {s.content
          .filter((c) => c.kind !== 'live')
          .map((c) => (
            <div
              key={c.id}
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
            >
              <div
                className="relative flex h-40 items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${th.bg}, ${s.accent})`,
                  color: '#F5F1E8',
                }}
              >
                {c.unlocked ? (
                  c.kind === 'video' ? (
                    <PlayCircle className="size-12" />
                  ) : (
                    <Images className="size-12" />
                  )
                ) : (
                  <Lock className="size-10 opacity-90" />
                )}
              </div>
              <div className="p-4">
                <div className="text-sm font-semibold">{c.title}</div>
                <div className="mt-2">
                  {c.unlocked ? (
                    <Badge tone="emerald">
                      {c.price === null && c.tierIds.length
                        ? 'Included in your membership'
                        : 'Free'}
                    </Badge>
                  ) : c.price ? (
                    <Badge tone="gold">{money(c.price)}</Badge>
                  ) : (
                    <Badge tone="plum">
                      <Crown className="size-3" /> Members
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export function StoreAbout() {
  const s = useStore();
  const p = s.policies;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-[15px] font-semibold">About</h2>
          <p className="mt-2 text-sm text-ink-muted">{s.tenant.description}</p>
        </section>
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-[15px] font-semibold">Booking policies</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {p.paymentAtBooking === 'percent_deposit' ? (
              <li>A {p.depositValue}% deposit secures your booking.</li>
            ) : null}
            {p.paymentAtBooking === 'full' ? <li>Full payment when you book.</li> : null}
            <li>Free cancellation up to {p.freeCancelHours} hours before.</li>
            <li>
              {p.lateCancel === 'deposit_kept'
                ? 'Later than that, the deposit is kept.'
                : p.lateCancel === 'percent_fee'
                  ? `Later than that, a ${p.lateCancelPct}% fee applies.`
                  : 'Later than that, the full amount is charged.'}
            </li>
            <li>Book at least {p.leadTimeHours} hours ahead.</li>
          </ul>
        </section>
        {s.reviews.length ? (
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h2 className="text-[15px] font-semibold">Reviews</h2>
            <div className="mt-3 space-y-4">
              {s.reviews.map((r) => (
                <div key={r.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <Stars value={r.rating} size="size-3" />
                    <span className="text-xs text-ink-subtle">{date(r.at, s.tenant.timezone)}</span>
                  </div>
                  <p className="mt-1.5 text-sm">{r.body}</p>
                  {r.reply ? (
                    <p className="mt-2 border-l-2 border-gold-400 pl-3 text-[13px] text-ink-muted">
                      {r.reply}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <aside className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <MapPin className="size-4 text-emerald-700" /> Location
          </h2>
          <p className="mt-2 text-sm">{s.address ?? s.tenant.area}</p>
          {s.arrival ? (
            <p className="mt-2 rounded-lg bg-gold-50 p-3 text-[13px] text-gold-800">{s.arrival}</p>
          ) : (
            <p className="mt-1 text-xs text-ink-subtle">
              Exact address and arrival details are shared after payment.
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-[15px] font-semibold">Hours</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {s.hours.map((h) => (
              <li key={h.day} className="flex justify-between">
                <span className="text-ink-muted">{h.day}</span>
                <span className="tabular-nums">
                  {h.closed ? 'Closed' : `${h.open} – ${h.close}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
