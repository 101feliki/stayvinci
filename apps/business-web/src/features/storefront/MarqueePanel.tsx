import { Gift, Megaphone, Plus, Sparkles, Tag, Trash2 } from 'lucide-react';
import { Badge, Input, Segmented, Select, Switch } from '@stayvinci/ui';
import type { MarqueeItem, MarqueeKind, StoreMarquee } from '../../mock/types';
import { money } from '../../lib/format';
import type { PanelProps } from './BrandPanel';

const KINDS: Record<
  MarqueeKind,
  { label: string; icon: typeof Tag; tone: 'gold' | 'azure' | 'neutral' | 'plum' }
> = {
  offer: { label: 'Discount or offer', icon: Tag, tone: 'gold' },
  service: { label: 'Promote a service', icon: Sparkles, tone: 'azure' },
  message: { label: 'Message', icon: Megaphone, tone: 'neutral' },
  season: { label: 'Season greeting', icon: Gift, tone: 'plum' },
};

const OFFER_IDEAS = [
  'Happy hour: 20% off between 2 and 5 pm on weekdays',
  'Bring a friend: 10% off for both of you',
  'First visit? Enjoy a complimentary upgrade',
  'Book 5 sessions, get the 6th free',
];

/** The moving announcement strip at the top of the store. */
export function MarqueePanel({
  draft,
  set,
  services,
}: PanelProps & { services: { id: string; name: string; variants: { price: number }[] }[] }) {
  const m = draft.marquee;
  const update = (patch: Partial<StoreMarquee>) => set({ marquee: { ...m, ...patch } });
  const updateItem = (id: string, patch: Partial<MarqueeItem>) =>
    update({ items: m.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const add = (kind: MarqueeKind, text = '', serviceId: string | null = null) =>
    update({
      enabled: true,
      items: [...m.items, { id: `mq_${Date.now()}`, kind, text, serviceId, enabled: true }],
    });
  const serviceText = (id: string) => {
    const s = services.find((x) => x.id === id);
    if (!s) return '';
    return `Now booking: ${s.name}, from ${money(Math.min(...s.variants.map((v) => v.price)))}`;
  };

  return (
    <div className="space-y-6 p-5">
      <div className="flex items-center justify-between gap-4 rounded-xl bg-canvas p-4">
        <div>
          <div className="text-sm font-medium">Show the marquee</div>
          <div className="text-xs text-ink-subtle">
            A gently moving strip under your store&apos;s top bar. Guests can tap a service to open
            it.
          </div>
        </div>
        <Switch checked={m.enabled} onChange={(v) => update({ enabled: v })} label="Show marquee" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink-muted">Speed</div>
          <Segmented
            value={m.speed}
            onChange={(v) => update({ speed: v })}
            items={[
              { value: 'slow', label: 'Slow' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink-muted">Colours</div>
          <Segmented
            value={m.style}
            onChange={(v) => update({ style: v })}
            items={[
              { value: 'accent', label: 'Highlight' },
              { value: 'brand', label: 'Brand' },
              { value: 'season', label: 'Season' },
            ]}
          />
        </div>
      </div>

      <section>
        <div className="mb-2 text-[13px] font-semibold">What it says</div>
        {m.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-4 text-center text-[13px] text-ink-muted">
            Nothing yet. Add an offer, a service or a message below.
          </p>
        ) : (
          <ul className="space-y-2">
            {m.items.map((item) => {
              const k = KINDS[item.kind];
              return (
                <li key={item.id} className="rounded-xl border border-line bg-surface p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone={k.tone}>
                      <k.icon className="size-3" /> {k.label}
                    </Badge>
                    <span className="flex-1" />
                    <Switch
                      checked={item.enabled}
                      onChange={(v) => updateItem(item.id, { enabled: v })}
                      label="Show this line"
                    />
                    <button
                      type="button"
                      onClick={() => update({ items: m.items.filter((x) => x.id !== item.id) })}
                      className="rounded-lg p-1.5 text-ink-subtle hover:bg-red-50 hover:text-red-700"
                      aria-label="Remove line"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {item.kind === 'service' ? (
                    <Select
                      value={item.serviceId ?? ''}
                      onChange={(e) =>
                        updateItem(item.id, {
                          serviceId: e.target.value,
                          text: serviceText(e.target.value),
                        })
                      }
                      aria-label="Service"
                      className="mb-2"
                    >
                      <option value="">Choose a service…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                  {item.kind === 'season' ? (
                    <p className="text-[13px] text-ink-muted">
                      Shows the greeting of your active seasonal theme (set it in Seasonal).
                    </p>
                  ) : (
                    <Input
                      value={item.text}
                      onChange={(e) => updateItem(item.id, { text: e.target.value })}
                      placeholder="What should guests read?"
                      maxLength={90}
                      aria-label="Marquee text"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(KINDS) as MarqueeKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => add(k)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-azure-500"
            >
              <Plus className="size-3.5" /> {KINDS[k].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 text-[13px] font-semibold">Offer ideas</div>
        <div className="flex flex-wrap gap-2">
          {OFFER_IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => add('offer', idea)}
              className="rounded-full bg-gold-50 px-3 py-1.5 text-left text-[13px] text-gold-800 hover:bg-gold-100"
            >
              {idea}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
