import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input, StoreLogo, Switch, Textarea } from '@stayvinci/ui';
import { colorFromImage, resizeImage, resolvePalette } from '@stayvinci/demo-data/design';
import type { Storefront } from '../../mock/types';

export interface PanelProps {
  draft: Storefront;
  set: (patch: Partial<Storefront>) => void;
}

/** Logo, name, tagline and contact visibility (spec §5.2 Identity). */
export function BrandPanel({
  draft,
  set,
  onLogoColour,
}: PanelProps & { onLogoColour: (hex: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const p = resolvePalette(draft);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file (PNG, JPG or SVG).');
      return;
    }
    setBusy(true);
    try {
      const logo = await resizeImage(file, 512, 'image/png');
      set({ logo });
      const colour = await colorFromImage(logo);
      if (colour) {
        onLogoColour(colour);
        toast.success('Logo added. We found colours that match it in Colours.');
      } else toast.success('Logo added');
    } catch {
      toast.error("Couldn't read that image. Try a PNG or JPG.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-5">
      <div>
        <div className="mb-2 text-[13px] font-medium">Logo</div>
        <div className="flex items-center gap-4">
          <div
            className="flex size-24 items-center justify-center rounded-2xl"
            style={{ background: p.bg }}
          >
            <StoreLogo
              src={draft.logo}
              name={draft.displayName}
              background={p.accent}
              color={p.onAccent}
              className="size-16 rounded-2xl text-2xl"
            />
          </div>
          <div className="space-y-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
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
              <ImagePlus className="size-4" /> {draft.logo ? 'Change logo' : 'Upload logo'}
            </Button>
            {draft.logo ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void colorFromImage(draft.logo ?? '').then((c) =>
                      c ? onLogoColour(c) : toast.message('No strong colour found in the logo'),
                    )
                  }
                >
                  <Wand2 className="size-4" /> Match colours
                </Button>
                <Button size="sm" variant="ghost" onClick={() => set({ logo: null })}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-ink-subtle">
              Square works best. Shown in your store header, hero and on guests&apos; My places.
            </p>
          </div>
        </div>
      </div>

      <Field label="Display name">
        {(id) => (
          <Input
            id={id}
            value={draft.displayName}
            onChange={(e) => set({ displayName: e.target.value })}
          />
        )}
      </Field>
      <Field label="Short tagline">
        {(id) => (
          <Textarea
            id={id}
            value={draft.tagline}
            onChange={(e) => set({ tagline: e.target.value })}
            className="min-h-14"
          />
        )}
      </Field>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Show contact details</div>
          <div className="text-xs text-ink-subtle">
            When off, guests can only reach you by in-app chat.
          </div>
        </div>
        <Switch
          checked={draft.showContacts}
          onChange={(v) => set({ showContacts: v })}
          label="Show contacts"
        />
      </div>
    </div>
  );
}
