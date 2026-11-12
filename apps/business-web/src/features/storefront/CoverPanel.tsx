import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input, Textarea, cn } from '@stayvinci/ui';
import { resizeImage } from '@stayvinci/demo-data/design';
import type { StoreCover } from '../../mock/types';
import type { PanelProps } from './BrandPanel';

const LIBRARY = [
  '/demo/stones.jpg',
  '/demo/hotstone.jpg',
  '/demo/massage.jpg',
  '/demo/candles.jpg',
  '/demo/facial.jpg',
  '/demo/botanics.jpg',
  '/demo/pool.jpg',
];

const LAYOUTS: { value: StoreCover['layout']; label: string; hint: string }[] = [
  {
    value: 'full',
    label: 'Full-screen photo',
    hint: 'Big, editorial, like a luxury beauty campaign',
  },
  {
    value: 'split',
    label: 'Photo beside text',
    hint: 'Calm and clear; great with a portrait photo',
  },
  { value: 'color', label: 'Brand colour', hint: 'No photo: your colours and texture' },
];

/** The store landing cover: the first thing guests see. */
export function CoverPanel({ draft, set }: PanelProps) {
  const c = draft.cover;
  const update = (patch: Partial<StoreCover>) => set({ cover: { ...c, ...patch } });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      update({
        image: await resizeImage(file, 2000),
        layout: c.layout === 'color' ? 'full' : c.layout,
      });
    } catch {
      toast.error("Couldn't read that image. Try a large JPG.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-5">
      <section>
        <div className="mb-2 text-[13px] font-semibold">Layout</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {LAYOUTS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => update({ layout: l.value })}
              className={cn(
                'overflow-hidden rounded-xl border-2 text-left',
                c.layout === l.value ? 'border-azure-500' : 'border-line hover:border-line-strong',
              )}
              aria-pressed={c.layout === l.value}
            >
              <div className="flex h-16 bg-canvas p-1.5">
                {l.value === 'full' ? (
                  <div className="relative flex-1 overflow-hidden rounded-md bg-[url(/demo/stones-sm.jpg)] bg-cover bg-center">
                    <div className="absolute bottom-1.5 left-1.5 h-1.5 w-10 rounded bg-white/90" />
                  </div>
                ) : l.value === 'split' ? (
                  <div className="flex flex-1 gap-1">
                    <div className="flex flex-1 flex-col justify-center gap-1 rounded-md bg-emerald-900 p-1.5">
                      <div className="h-1.5 w-8 rounded bg-white/80" />
                      <div className="h-1 w-6 rounded bg-white/40" />
                    </div>
                    <div className="flex-1 rounded-md bg-[url(/demo/hotstone-sm.jpg)] bg-cover bg-center" />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col justify-center gap-1 rounded-md bg-emerald-900 p-2">
                    <div className="h-1.5 w-10 rounded bg-white/80" />
                    <div className="h-1 w-7 rounded bg-white/40" />
                  </div>
                )}
              </div>
              <div className="px-2.5 py-2">
                <div className="text-[13px] font-medium">{l.label}</div>
                <div className="text-[11px] leading-tight text-ink-subtle">{l.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {c.layout !== 'color' ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-semibold">Cover photo</div>
            <div className="flex gap-2">
              <input
                ref={input}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                loading={busy}
                onClick={() => input.current?.click()}
              >
                <ImagePlus className="size-4" /> Upload
              </Button>
              {c.image ? (
                <Button size="sm" variant="ghost" onClick={() => update({ image: null })}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
          {c.image ? (
            <div className="mb-3 aspect-[16/7] overflow-hidden rounded-xl">
              <img src={c.image} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <p className="mb-3 rounded-xl border border-dashed border-line-strong p-4 text-center text-[13px] text-ink-muted">
              Upload a wide, high-quality photo of your space or a treatment, or pick one below.
            </p>
          )}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {LIBRARY.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => update({ image: src })}
                className={cn(
                  'aspect-square overflow-hidden rounded-lg ring-2 ring-offset-1 ring-offset-surface',
                  c.image === src ? 'ring-azure-500' : 'ring-transparent hover:ring-line-strong',
                )}
                aria-label="Use this photo"
              >
                <img
                  src={src.replace('.jpg', '-sm.jpg')}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <Field label="Headline" hint="Short and confident. Leave empty to show your name.">
        {(id) => (
          <Input
            id={id}
            value={c.headline}
            maxLength={60}
            onChange={(e) => update({ headline: e.target.value })}
          />
        )}
      </Field>
      <Field label="Line under the headline">
        {(id) => (
          <Textarea
            id={id}
            value={c.subline}
            maxLength={160}
            onChange={(e) => update({ subline: e.target.value })}
            className="min-h-16"
          />
        )}
      </Field>
      <Field label="Button label" hint="e.g. Book a visit, Reserve, Check dates">
        {(id) => (
          <Input
            id={id}
            value={c.ctaLabel}
            maxLength={24}
            onChange={(e) => update({ ctaLabel: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}
