import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search, X } from 'lucide-react';
import { KIND_LABEL, stores } from '../api';
import { CATEGORIES, JOURNAL } from '../editorial';

/** Site-wide search (Ctrl+K or /): places, categories with counts, and journal guides. */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const all = useQuery({ queryKey: ['stores'], queryFn: () => stores(), enabled: open });
  const items = all.data ?? [];

  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = setTimeout(() => input.current?.focus(), 30);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const has = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const places = words.length
    ? items.filter((s) => has(`${s.name} ${s.tagline} ${s.area ?? ''} ${s.highlights.join(' ')}`))
    : [];
  const guides = words.length ? JOURNAL.filter((g) => has(`${g.title} ${g.summary}`)) : [];
  const go = (to: string) => {
    onClose();
    void navigate(to);
  };

  return (
    <div className="fixed inset-0 z-50 bg-noir-950/85 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Search Stayvinci"
        className="mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-2xl border border-noir-line bg-noir-900 text-[#f1ebdf] shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className="flex items-center gap-3 border-b border-noir-line px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            go(`/explore?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <Search className="size-5 text-[#e4cf9f]" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search places, treatments, areas…"
            className="w-full bg-transparent text-lg outline-none placeholder:text-noir-muted"
          />
          <button type="button" aria-label="Close search" onClick={onClose}>
            <X className="size-5 text-noir-muted hover:text-[#f1ebdf]" />
          </button>
        </form>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {!words.length ? (
            <>
              <Label>Browse</Label>
              {CATEGORIES.map((c) => (
                <Row
                  key={c.vertical}
                  onClick={() => go(`/explore?kind=${c.vertical}`)}
                  title={c.label}
                  meta={c.blurb}
                  count={items.filter((s) => s.vertical === c.vertical).length}
                />
              ))}
              <Row
                onClick={() => go('/journal')}
                title="The Journal"
                meta="Guides and plans"
                count={JOURNAL.length}
              />
            </>
          ) : (
            <>
              <Label>Places</Label>
              {places.length ? (
                places
                  .slice(0, 7)
                  .map((s) => (
                    <Row
                      key={s.handle}
                      onClick={() => go(`/places/${s.handle}`)}
                      title={s.name}
                      meta={`${KIND_LABEL[s.vertical]} · ${s.area ?? s.city ?? 'Kenya'}`}
                    />
                  ))
              ) : (
                <p className="px-3 py-2 text-sm text-noir-muted">No places match “{q.trim()}”.</p>
              )}
              {guides.length ? (
                <>
                  <Label>Journal</Label>
                  {guides.map((g) => (
                    <Row
                      key={g.slug}
                      onClick={() => go(`/journal/${g.slug}`)}
                      title={g.title}
                      meta={g.kind}
                    />
                  ))}
                </>
              ) : null}
            </>
          )}
        </div>
        <div className="flex justify-between border-t border-noir-line px-5 py-2.5 text-[10px] tracking-[0.2em] text-noir-muted uppercase">
          <span>Enter to see all results</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1.5 text-[10px] font-medium tracking-[0.26em] text-[#e4cf9f] uppercase">
      {children}
    </div>
  );
}

function Row({
  title,
  meta,
  count,
  onClick,
}: {
  title: string;
  meta: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-noir-800"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{title}</span>
        <span className="block truncate text-[12px] text-noir-muted">{meta}</span>
      </span>
      {count !== undefined ? (
        <span className="text-sm text-[#e4cf9f] tabular-nums">{count}</span>
      ) : null}
      <ArrowRight className="size-4 text-noir-muted opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}
