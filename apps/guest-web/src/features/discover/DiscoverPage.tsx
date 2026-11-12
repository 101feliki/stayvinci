import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, Sparkles } from 'lucide-react';
import { Input, Skeleton, cn } from '@stayvinci/ui';
import { money } from '@stayvinci/demo-data/format';
import { api, DISCOVER_CATEGORIES, type StoreCard } from '../../lib/api';
import { Stars } from '../../app/shared';
import { EnterCode } from '../home/HomePage';

/** Marketplace browsing (spec §8). Private stores never appear here. */
export function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [term, setTerm] = useState(q);
  const vertical = params.get('type');
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const res = useQuery({
    queryKey: ['discover', term, vertical],
    queryFn: () => api.discover(term, vertical),
  });
  const setVertical = (v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set('type', v);
    else next.delete('type');
    setParams(next, { replace: true });
  };
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
          aria-label="Search"
        />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {[{ label: 'All', vertical: null }, ...DISCOVER_CATEGORIES].map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setVertical(c.vertical)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              vertical === c.vertical
                ? 'border-emerald-900 bg-emerald-900 text-ivory'
                : 'border-line bg-surface text-ink-muted hover:text-ink',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      {res.error ? (
        <p className="py-10 text-center text-sm text-ink-muted">{res.error.message}</p>
      ) : !res.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : res.data.results.length === 0 ? (
        <div className="mx-auto max-w-md py-10 text-center">
          <p className="text-sm text-ink-muted">
            Nothing listed matches. Some places are private and open only with their code.
          </p>
          <div className="mt-4">
            <EnterCode />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.data.results.map((l) => (
            <StoreTile key={l.handle} s={l} />
          ))}
        </div>
      )}
    </div>
  );
}

const KIND_LABEL = { spa: 'Spa', atelier: 'Atelier', short_stay: 'Rooms & stays' } as const;

export function StoreTile({ s }: { s: StoreCard }) {
  return (
    <Link
      to={`/s/${s.handle}`}
      className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="relative h-44 overflow-hidden bg-emerald-900">
        {s.cover_url ? (
          <img
            src={s.cover_url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
          {KIND_LABEL[s.vertical]}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 font-semibold">{s.name}</div>
          {s.rating.average !== null ? (
            <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium">
              <Stars value={s.rating.average} size="size-3" /> {s.rating.average.toFixed(1)}
              <span className="text-ink-subtle">({s.rating.count})</span>
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink-subtle">
              <Sparkles className="size-3.5" /> New
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{s.tagline}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-[13px]">
          <span className="flex min-w-0 items-center gap-1 truncate text-ink-muted">
            <MapPin className="size-3.5 shrink-0" /> {[s.area, s.city].filter(Boolean).join(', ')}
          </span>
          <span className="shrink-0 font-medium">
            {s.from_price_minor !== null ? `from ${money(s.from_price_minor)}` : ''}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Old listing links now open the store itself. */
export function ListingPage() {
  const { handle = '' } = useParams();
  return <Navigate to={`/s/${handle}`} replace />;
}
