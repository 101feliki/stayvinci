import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, Clock, KeyRound, MapPin, Search } from 'lucide-react';
import { Badge, Input, Skeleton, cn } from '@stayvinci/ui';
import { money } from '@stayvinci/demo-data/format';
import { api } from '../../mock/api';
import { Stars } from '../../app/shared';
import { EnterCode } from '../home/HomePage';

const CATEGORIES = ['Spas', 'Massages', 'Facials', 'Nails', 'Short stays'];

/** Marketplace browsing (spec §8). Private stores never appear here. */
export function DiscoverPage() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const res = useQuery({ queryKey: ['discover', q, cat], queryFn: () => api.discover(q, cat) });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="text-sm text-ink-muted">Verified places that chose to be listed.</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, service or area"
          className="h-12 pl-10 text-base"
        />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {[null, ...CATEGORIES].map((c) => (
          <button
            key={c ?? 'all'}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              cat === c
                ? 'border-emerald-900 bg-emerald-900 text-ivory'
                : 'border-line bg-surface text-ink-muted hover:text-ink',
            )}
          >
            {c ?? 'All'}
          </button>
        ))}
      </div>
      {res.data?.privateMatch ? (
        <div className="rounded-2xl border border-gold-200 bg-gold-50 p-4">
          <div className="text-sm font-medium text-gold-800">
            No public listing found. Have a code?
          </div>
          <p className="mb-3 text-[13px] text-gold-700">
            Some places are private and can only be entered with their code.
          </p>
          <EnterCode />
        </div>
      ) : null}
      {!res.data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : res.data.results.length === 0 && !res.data.privateMatch ? (
        <p className="py-10 text-center text-sm text-ink-muted">
          Nothing matches yet. Try another area or category.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.data.results.map((l) => (
            <Link
              key={l.handle}
              to={`/discover/${l.handle}`}
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div
                className="relative h-36"
                style={{ background: `linear-gradient(135deg, ${l.tone}, #C8A96A)` }}
              >
                {l.verified ? (
                  <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <BadgeCheck className="size-3.5 text-azure-600" /> Verified
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{l.name}</div>
                  <span className="flex items-center gap-1 text-[13px] font-medium">
                    <Stars value={l.rating} size="size-3" /> {l.rating}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-muted">
                  <MapPin className="size-3.5" /> {l.area} · {l.category}
                </div>
                <div className="mt-3 flex items-center justify-between text-[13px]">
                  <span className="font-medium">
                    {l.fromPrice ? `from ${money(l.fromPrice)}` : 'Prices on request'}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700">
                    <Clock className="size-3.5" /> {l.nextAvailable}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ListingPage() {
  const { handle = '' } = useParams();
  const l = useQuery({ queryKey: ['listing', handle], queryFn: () => api.listing(handle) });
  if (!l.data) return <Skeleton className="h-80 rounded-3xl" />;
  const d = l.data;
  return (
    <div className="space-y-6">
      <Link
        to="/discover"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Discover
      </Link>
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <div
          className="h-48"
          style={{ background: `linear-gradient(135deg, ${d.tone}, #C8A96A)` }}
        />
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
            {d.verified ? (
              <Badge tone="azure">
                <BadgeCheck className="size-3.5" /> Verified
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <span className="flex items-center gap-1">
              <MapPin className="size-4" /> {d.area} (exact address after booking)
            </span>
            <span className="flex items-center gap-1">
              <Stars value={d.rating} /> {d.rating} · {d.reviews} reviews
            </span>
          </div>
          <div className="mt-6 rounded-2xl bg-canvas p-5">
            {d.mode === 'listed_limited' ? (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <KeyRound className="size-4 text-gold-600" /> The menu opens with a code
                </div>
                <p className="mt-1 mb-4 text-[13px] text-ink-muted">
                  This place shows its profile publicly but keeps its menu for guests with a code.
                </p>
                <EnterCode />
              </>
            ) : (
              <>
                <div className="font-medium">This is a demo marketplace listing</div>
                <p className="mt-1 text-[13px] text-ink-muted">
                  In the full app you would enter this store and book directly. Guests found through
                  Discover are marketplace guests: the House pays Stayvinci a one-time fee on your
                  first completed booking, never on later visits, and never anything extra for you.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
