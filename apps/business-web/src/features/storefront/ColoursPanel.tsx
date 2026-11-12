import { useMemo, useState } from 'react';
import { Check, CircleAlert, RotateCcw, Shuffle, Wand2 } from 'lucide-react';
import { Badge, Button, cn } from '@stayvinci/ui';
import {
  PRESET_PALETTES,
  basePalette,
  colorFromImage,
  finalizePalette,
  hsl,
  hueOf,
  paletteContrast,
  suggestPalettes,
} from '@stayvinci/demo-data/design';
import type { StorePalette } from '../../mock/types';
import type { PanelProps } from './BrandPanel';

function Swatch({
  p,
  selected,
  onClick,
}: {
  p: StorePalette;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group overflow-hidden rounded-xl border-2 text-left transition-shadow hover:shadow-card-hover',
        selected ? 'border-azure-500' : 'border-line',
      )}
      aria-pressed={selected}
      aria-label={`Use ${p.name}`}
    >
      <div className="relative h-16 px-3 pt-2.5" style={{ background: p.bg, color: p.fg }}>
        <div className="text-[11px] font-semibold">Aa</div>
        <span
          className="absolute right-2.5 bottom-2.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: p.accent, color: p.onAccent }}
        >
          Book
        </span>
        {selected ? (
          <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-azure-500 text-white">
            <Check className="size-3" />
          </span>
        ) : null}
      </div>
      <div className="h-2" style={{ background: p.soft }} />
      <div className="truncate bg-surface px-2.5 py-1.5 text-[11px] font-medium">{p.name}</div>
    </button>
  );
}

/**
 * Colours: curated palettes, generated "mixes" from any colour or the logo,
 * and fine-tuning. Every palette is contrast-checked so text stays readable.
 */
export function ColoursPanel({
  draft,
  set,
  base,
  setBase,
}: PanelProps & { base: string; setBase: (hex: string) => void }) {
  const current = basePalette(draft);
  const [shuffle, setShuffle] = useState(0);
  const mixes = useMemo(() => {
    if (shuffle === 0) return suggestPalettes(base);
    const { h, s, l } = hueOf(base);
    return suggestPalettes(hsl(h + shuffle * 23, Math.min(0.8, s + 0.05), l));
  }, [base, shuffle]);
  const check = paletteContrast(current);
  const choose = (p: StorePalette) => set({ palette: p });
  const tune = (patch: Partial<StorePalette>) =>
    set({
      palette: finalizePalette({
        ...current,
        ...patch,
        id: 'custom',
        name: 'Custom',
        fg: '',
      }),
    });

  return (
    <div className="space-y-7 p-5">
      <div className="flex items-center gap-3 rounded-xl bg-canvas p-3">
        <div className="flex overflow-hidden rounded-lg border border-line">
          {[current.bg, current.accent, current.soft].map((c) => (
            <span key={c} className="size-8" style={{ background: c }} />
          ))}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{current.name}</div>
          <div className="text-xs text-ink-subtle">Your store&apos;s colours now</div>
        </div>
        {check.ok ? (
          <Badge tone="emerald">
            <Check className="size-3" /> Easy to read
          </Badge>
        ) : (
          <Badge tone="amber">
            <CircleAlert className="size-3" /> Low contrast
          </Badge>
        )}
      </div>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[13px] font-semibold">Mixes made for you</div>
          <button
            type="button"
            onClick={() => setShuffle((n) => n + 1)}
            className="flex items-center gap-1 text-[13px] font-medium text-azure-700"
          >
            <Shuffle className="size-3.5" /> Shuffle
          </button>
        </div>
        <p className="mb-3 text-xs text-ink-subtle">
          Pick a starting colour (or use your logo) and we&apos;ll mix six palettes that work
          together.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-1.5 text-[13px]">
            <input
              type="color"
              value={base}
              onChange={(e) => {
                setShuffle(0);
                setBase(e.target.value);
              }}
              className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="Starting colour"
            />
            <span className="font-mono text-xs uppercase">{base}</span>
          </label>
          {draft.logo ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void colorFromImage(draft.logo ?? '').then((c) => {
                  if (c) {
                    setShuffle(0);
                    setBase(c);
                  }
                })
              }
            >
              <Wand2 className="size-4" /> From my logo
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {mixes.map((p) => (
            <Swatch
              key={p.id + shuffle}
              p={p}
              selected={draft.palette?.id === p.id}
              onClick={() => choose(p)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 text-[13px] font-semibold">Curated palettes</div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {PRESET_PALETTES.map((p) => (
            <Swatch
              key={p.id}
              p={p}
              selected={(draft.palette?.id ?? '') === p.id}
              onClick={() => choose(p)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 text-[13px] font-semibold">Fine-tune</div>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['bg', 'Main colour'],
              ['accent', 'Highlight'],
              ['soft', 'Page tint'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="space-y-1.5 text-xs text-ink-muted">
              <span className="block">{label}</span>
              <span className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5">
                <input
                  type="color"
                  value={current[k]}
                  onChange={(e) => tune({ [k]: e.target.value.toUpperCase() })}
                  className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="font-mono text-[11px] text-ink uppercase">{current[k]}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-subtle">
          Text contrast {check.text.toFixed(1)}:1 · button {check.button.toFixed(1)}:1. We pick the
          text colour for you so it stays readable.
        </p>
        {draft.palette ? (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => set({ palette: null })}>
            <RotateCcw className="size-4" /> Back to the original theme
          </Button>
        ) : null}
      </section>
    </div>
  );
}
