import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { cn } from '@stayvinci/ui';
import { KIND_LABEL, stores, type Vertical } from '../api';
import { AtlasCard } from '../components/AtlasCard';
import { CATEGORIES, areasOf } from '../editorial';

/** Every listed place, filtered by kind, area and words: /explore?kind=spa&area=Gigiri&q=steam */
export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const kind = (params.get('kind') as Vertical | null) ?? null;
  const area = params.get('area');
  const q = params.get('q') ?? '';
  const all = useQuery({ queryKey: ['stores'], queryFn: () => stores() });
  const items = useMemo(() => all.data ?? [], [all.data]);

  useEffect(() => {
    document.title = 'Explore · Stayvinci';
    return () => {
      document.title = 'Stayvinci';
    };
  }, []);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter(
    (s) =>
      (!kind || s.vertical === kind) &&
      (!area || s.area === area) &&
      words.every((w) =>
        `${s.name} ${s.tagline} ${s.area ?? ''} ${s.highlights.join(' ')}`
          .toLowerCase()
          .includes(w),
      ),
  );
  const areas = areasOf(kind ? items.filter((s) => s.vertical === kind) : items);

  return (
    <main>
      <section className="bg-noir-sheen pt-32 pb-12 text-[#f1ebdf] md:pt-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="text-[11px] font-medium tracking-[0.26em] text-[#e4cf9f] uppercase">
            Explore
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            {kind ? CATEGORIES.find((c) => c.vertical === kind)?.label : 'Every place'}
            {area ? ` in ${area}` : ''}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-[#a59d90]">
            Verified places on Stayvinci. Open any of them to see the menu, the hours and the team,
            then book in the app.
          </p>
          <label className="mt-8 flex max-w-xl items-center gap-3 border border-noir-line bg-noir-900 px-4 py-3 focus-within:border-gold-400/50">
            <Search className="size-4 text-noir-muted" />
            <input
              value={q}
              onChange={(e) => set('q', e.target.value)}
              placeholder="A place, a treatment, an area…"
              className="w-full bg-transparent text-[15px] text-[#f1ebdf] outline-none placeholder:text-noir-muted"
            />
            {q ? (
              <button type="button" aria-label="Clear" onClick={() => set('q', null)}>
                <X className="size-4 text-noir-muted" />
              </button>
            ) : null}
          </label>
          <div className="mt-6 flex flex-wrap gap-2">
            <Chip on={!kind} onClick={() => set('kind', null)}>
              All · {items.length}
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.vertical}
                on={kind === c.vertical}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('kind', c.vertical);
                  next.delete('area');
                  setParams(next, { replace: true });
                }}
              >
                {c.label} · {items.filter((s) => s.vertical === c.vertical).length}
              </Chip>
            ))}
          </div>
          {areas.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {areas.map((a) => (
                <Chip
                  key={a.area}
                  subtle
                  on={area === a.area}
                  onClick={() => set('area', area === a.area ? null : a.area)}
                >
                  {a.area} · {a.count}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          {all.error ? (
            <p className="text-sm text-ink-muted">{all.error.message}</p>
          ) : all.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-line/60" />
              ))}
            </div>
          ) : shown.length ? (
            <>
              <p className="mb-6 text-[11px] font-medium tracking-[0.2em] text-ink-subtle uppercase">
                {shown.length} {shown.length === 1 ? 'place' : 'places'}
                {kind ? ` · ${KIND_LABEL[kind]}` : ''}
              </p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((s) => (
                  <AtlasCard key={s.handle} s={s} />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
              <p className="text-sm text-ink-muted">Nothing matches yet.</p>
              <Link
                to="/explore"
                className="mt-3 inline-block text-sm font-semibold text-azure-700 dark:text-azure-400"
              >
                See every place
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Chip({
  on,
  subtle,
  onClick,
  children,
}: {
  on: boolean;
  subtle?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'border px-3.5 py-2 text-[11px] font-medium tracking-[0.16em] uppercase transition-colors',
        on
          ? 'border-gold-400/60 bg-gold-400/15 text-[#e4cf9f]'
          : subtle
            ? 'border-noir-line text-noir-muted hover:text-[#f1ebdf]'
            : 'border-noir-line text-[#cfc6b8] hover:border-gold-400/40 hover:text-[#f1ebdf]',
      )}
    >
      {children}
    </button>
  );
}
