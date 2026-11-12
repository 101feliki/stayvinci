import { CalendarClock, Check, Megaphone } from 'lucide-react';
import { Badge, Button, SeasonDecor, Segmented, Switch, cn } from '@stayvinci/ui';
import {
  SEASONS,
  activeSeason,
  nextSeason,
  resolvePalette,
  seasonOnDate,
} from '@stayvinci/demo-data/design';
import type { StoreSeason } from '../../mock/types';
import type { PanelProps } from './BrandPanel';

type Mode = 'off' | 'pick' | 'auto';

/** Seasonal themes: public holidays and celebrations, picked or automatic. */
export function SeasonPanel({ draft, set }: PanelProps) {
  const s = draft.season;
  const mode: Mode = s.auto ? 'auto' : s.id ? 'pick' : 'off';
  const update = (patch: Partial<StoreSeason>) => set({ season: { ...s, ...patch } });
  const p = resolvePalette({ ...draft, season: { ...s, recolor: false } });
  const now = new Date();
  const inSeason = seasonOnDate(now);
  const upcoming = nextSeason(now);
  const active = activeSeason(s, now);
  const greetingOn = draft.marquee.items.some((i) => i.kind === 'season' && i.enabled);

  const addGreeting = () => {
    const has = draft.marquee.items.find((i) => i.kind === 'season');
    set({
      marquee: {
        ...draft.marquee,
        enabled: true,
        items: has
          ? draft.marquee.items.map((i) => (i.kind === 'season' ? { ...i, enabled: true } : i))
          : [
              ...draft.marquee.items,
              { id: `mq_${Date.now()}`, kind: 'season', text: '', serviceId: null, enabled: true },
            ],
      },
    });
  };

  return (
    <div className="space-y-6 p-5">
      <div>
        <Segmented
          value={mode}
          onChange={(v) =>
            update(
              v === 'off'
                ? { id: null, auto: false }
                : v === 'auto'
                  ? { auto: true }
                  : { auto: false, id: s.id ?? inSeason?.id ?? upcoming.id },
            )
          }
          items={[
            { value: 'off', label: 'Off' },
            { value: 'pick', label: 'Choose one' },
            { value: 'auto', label: 'Automatic' },
          ]}
        />
        <p className="mt-2 text-xs text-ink-subtle">
          {mode === 'auto'
            ? 'Your store dresses up for each holiday in its own dates, then goes back to normal.'
            : mode === 'pick'
              ? 'The theme you choose stays on until you turn it off.'
              : 'No seasonal decoration.'}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-canvas p-3 text-[13px]">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-azure-600" />
        <div>
          {inSeason ? (
            <>
              <span className="font-medium">{inSeason.name}</span> is on now ({inSeason.when}).{' '}
            </>
          ) : null}
          Coming up: <span className="font-medium">{upcoming.name}</span> ({upcoming.when}).
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {SEASONS.map((season) => {
          const selected = mode === 'pick' && s.id === season.id;
          const showing = active?.id === season.id;
          return (
            <button
              key={season.id}
              type="button"
              onClick={() => update({ auto: false, id: season.id })}
              className={cn(
                'overflow-hidden rounded-xl border-2 text-left transition-shadow hover:shadow-card-hover',
                selected ? 'border-azure-500' : 'border-line',
              )}
              aria-pressed={selected}
            >
              <div
                className="relative h-20 overflow-hidden"
                style={{
                  background:
                    season.motif === 'flag'
                      ? p.bg
                      : `linear-gradient(135deg, ${p.bg}, ${season.colors[0]}55)`,
                }}
              >
                <SeasonDecor motif={season.motif} colors={season.colors} density="light" />
                {showing ? (
                  <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink">
                    Showing
                  </span>
                ) : null}
                {selected ? (
                  <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-azure-500 text-white">
                    <Check className="size-3" />
                  </span>
                ) : null}
              </div>
              <div className="bg-surface px-3 py-2">
                <div className="text-[13px] font-semibold">{season.name}</div>
                <div className="text-[11px] text-ink-subtle">{season.when}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Use the season&apos;s colours</div>
          <div className="text-xs text-ink-subtle">
            Tints your highlight colour, e.g. gold for Christmas or rose for Valentine&apos;s.
          </div>
        </div>
        <Switch
          checked={s.recolor}
          onChange={(v) => update({ recolor: v })}
          label="Season colours"
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-line p-4">
        <div>
          <div className="text-sm font-medium">Season greeting in the marquee</div>
          <div className="text-xs text-ink-subtle">
            {active ? `“${active.message}”` : 'Shows when a seasonal theme is on.'}
          </div>
        </div>
        {greetingOn ? (
          <Badge tone="emerald">
            <Check className="size-3" /> On
          </Badge>
        ) : (
          <Button size="sm" variant="secondary" onClick={addGreeting}>
            <Megaphone className="size-4" /> Add
          </Button>
        )}
      </div>
    </div>
  );
}
