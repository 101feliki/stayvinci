import { useRef, useState } from 'react';
import { ImagePlus, Images, Shapes, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, SERVICE_ICON_SET, ServiceVisual, Segmented, cn } from '@stayvinci/ui';
import { basePalette, resizeImage } from '@stayvinci/demo-data/design';
import { api } from '../../lib/api';
import { useTenantQuery } from '../../lib/query';

/** Curated photos Houses can use while they don't have their own (template library). */
export const PHOTO_LIBRARY = [
  { src: '/demo/massage-sm.jpg', label: 'Massage' },
  { src: '/demo/hotstone-sm.jpg', label: 'Hot stones' },
  { src: '/demo/stones-sm.jpg', label: 'Stones & orchid' },
  { src: '/demo/facial-sm.jpg', label: 'Facial' },
  { src: '/demo/candles-sm.jpg', label: 'Candles' },
  { src: '/demo/botanics-sm.jpg', label: 'Botanics' },
  { src: '/demo/pool-sm.jpg', label: 'Water' },
];

/** Photo or icon for a service, with a live preview of the guest card. */
export function ServicePicture({
  name,
  image,
  icon,
  onChange,
}: {
  name: string;
  image: string | null;
  icon: string | null;
  onChange: (v: { image: string | null; icon: string | null }) => void;
}) {
  const sf = useTenantQuery(['storefront'], api.storefront.get);
  const p = sf.data ? basePalette(sf.data) : null;
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'library' | 'icon'>(image || !icon ? 'library' : 'icon');
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange({ image: await resizeImage(file, 1200), icon });
    } catch {
      toast.error("Couldn't read that image. Try a JPG or PNG.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 text-[13px] font-medium">Picture</div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-full shrink-0 sm:w-36">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
            <ServiceVisual
              image={image}
              icon={icon}
              name={name || 'Service'}
              from={p?.bg ?? '#092720'}
              to={p?.accent ?? '#C8A96A'}
              iconColor={p?.fg ?? '#F5F1E8'}
            />
          </div>
          <div className="mt-1.5 truncate text-xs font-medium">{name || 'Service name'}</div>
          <div className="text-[11px] text-ink-subtle">How guests see it</div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
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
              <ImagePlus className="size-4" /> Upload photo
            </Button>
            {image ? (
              <Button size="sm" variant="ghost" onClick={() => onChange({ image: null, icon })}>
                <Trash2 className="size-4" /> Remove photo
              </Button>
            ) : null}
          </div>
          <Segmented
            value={mode}
            onChange={setMode}
            items={[
              {
                value: 'library',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Images className="size-3.5" /> Photo library
                  </span>
                ),
              },
              {
                value: 'icon',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Shapes className="size-3.5" /> Icons
                  </span>
                ),
              },
            ]}
          />
          {mode === 'library' ? (
            <div className="grid grid-cols-4 gap-2">
              {PHOTO_LIBRARY.map((ph) => (
                <button
                  key={ph.src}
                  type="button"
                  onClick={() => onChange({ image: ph.src, icon })}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-lg ring-2 ring-offset-1 ring-offset-surface',
                    image === ph.src ? 'ring-azure-500' : 'ring-transparent hover:ring-line-strong',
                  )}
                  aria-label={`Use photo: ${ph.label}`}
                  title={ph.label}
                >
                  <img src={ph.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-7">
              {SERVICE_ICON_SET.map((ic) => (
                <button
                  key={ic.id}
                  type="button"
                  onClick={() => onChange({ image: null, icon: ic.id })}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-ink-muted transition-colors',
                    !image && icon === ic.id
                      ? 'border-azure-500 bg-azure-50 text-azure-800 dark:bg-azure-500/15 dark:text-azure-300'
                      : 'border-line hover:border-line-strong hover:text-ink',
                  )}
                  aria-label={ic.label}
                  title={ic.label}
                >
                  <ic.icon className="size-5" strokeWidth={1.6} />
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-ink-subtle">
            Photos look best. No photo yet? Pick one from our library or an icon; change it any
            time.
          </p>
        </div>
      </div>
    </div>
  );
}
