import { useState } from 'react';
import { cn } from '@stayvinci/ui';

// Single-series charts. Colour validated with the dataviz palette checker
// (emerald family, chroma and contrast pass on the light surface).
export const SERIES = '#2a8a6a';
const SERIES_HOVER = '#1f6f55';

export interface Datum {
  label: string;
  value: number;
  sub?: string;
}

/** Vertical bars (e.g. revenue by day). Hover or focus a bar for its value. */
export function ColumnChart({
  data,
  format,
  height = 220,
  ariaLabel,
}: {
  data: Datum[];
  format: (v: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const labelEvery = Math.ceil(data.length / 10);
  const a = active !== null ? data[active] : undefined;

  return (
    <div className="relative" role="img" aria-label={ariaLabel}>
      <div className="flex" style={{ height }}>
        <div className="flex w-14 shrink-0 flex-col justify-between pr-2 pb-5 text-right text-[11px] text-ink-subtle tabular-nums">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{format(t)}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
            {ticks.map((t) => (
              <div key={t} className="border-t border-line/80" />
            ))}
          </div>
          <div className="absolute inset-x-0 top-0 bottom-5 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <button
                key={d.label + i}
                type="button"
                className="group relative flex h-full flex-1 items-end focus:outline-none"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${d.label}: ${format(d.value)}`}
              >
                <span
                  className="block w-full rounded-t-[4px] transition-colors"
                  style={{
                    height: `${(d.value / max) * 100}%`,
                    minHeight: d.value > 0 ? 2 : 0,
                    background: active === i ? SERIES_HOVER : SERIES,
                  }}
                />
              </button>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex gap-[2px]">
            {data.map((d, i) => (
              <span
                key={d.label + i}
                className="flex-1 truncate text-center text-[10px] text-ink-subtle"
              >
                {i % labelEvery === 0 ? d.label : ''}
              </span>
            ))}
          </div>
          {a && active !== null ? (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 shadow-pop"
              style={{ left: `${((active + 0.5) / data.length) * 100}%`, top: 0 }}
            >
              <div className="text-sm font-semibold tabular-nums">{format(a.value)}</div>
              <div className="text-[11px] whitespace-nowrap text-ink-muted">{a.sub ?? a.label}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Horizontal ranked bars (e.g. revenue by service). Values are direct-labelled. */
export function BarList({
  data,
  format,
  className,
}: {
  data: Datum[];
  format: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className={cn('space-y-2.5', className)}>
      {data.map((d) => (
        <li key={d.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{d.label}</span>
            <span className="shrink-0 font-medium text-ink tabular-nums">{format(d.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div
              className="h-2 rounded-full transition-[width] duration-300"
              style={{ width: `${(d.value / max) * 100}%`, background: SERIES }}
              title={d.sub}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
