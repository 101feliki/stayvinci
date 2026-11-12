import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Paintbrush } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Switch, cn } from '@stayvinci/ui';
import {
  DEFAULT_SECTION_STYLE,
  SECTION_LABELS,
  TEXTURES,
  paintSection,
  resizeImage,
  resolvePalette,
} from '@stayvinci/demo-data/design';
import type { SectionKind, SectionStyle } from '../../mock/types';
import type { PanelProps } from './BrandPanel';

const BACKGROUNDS: { value: SectionStyle['background']; label: string }[] = [
  { value: 'default', label: 'Plain' },
  { value: 'soft', label: 'Soft tint' },
  { value: 'brand', label: 'Brand colour' },
  { value: 'accent', label: 'Highlight' },
  { value: 'texture', label: 'Texture' },
  { value: 'photo', label: 'Photo' },
];

/** Section order, visibility and per-section backgrounds. */
export function SectionsPanel({
  draft,
  set,
  focus,
  setFocus,
}: PanelProps & { focus: SectionKind | null; setFocus: (k: SectionKind | null) => void }) {
  const p = resolvePalette(draft);
  const photoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const styleOf = (k: SectionKind): SectionStyle =>
    draft.sectionStyles[k] ??
    (k === 'hero' ? { ...DEFAULT_SECTION_STYLE, background: 'brand' } : DEFAULT_SECTION_STYLE);
  const setStyle = (k: SectionKind, patch: Partial<SectionStyle>) =>
    set({ sectionStyles: { ...draft.sectionStyles, [k]: { ...styleOf(k), ...patch } } });

  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft.sections];
    const a = next[i];
    const b = next[i + dir];
    if (!a || !b) return;
    next[i] = b;
    next[i + dir] = a;
    set({ sections: next });
  };

  const uploadPhoto = async (k: SectionKind, file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const photo = await resizeImage(file, 1600);
      setStyle(k, { background: 'photo', photo, overlay: Math.max(styleOf(k).overlay, 35) });
    } catch {
      toast.error("Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ul className="divide-y divide-line">
      {draft.sections.map((s, i) => {
        const open = focus === s.kind;
        const st = styleOf(s.kind);
        const paint = paintSection(st, p, s.kind);
        return (
          <li key={s.kind}>
            <div className="flex items-center gap-2 px-5 py-2.5">
              <span
                className="size-5 shrink-0 rounded-md border border-line"
                style={{ background: paint.filled ? paint.background : p.soft }}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => setFocus(open ? null : s.kind)}
                className={cn(
                  'flex flex-1 items-center gap-1.5 text-left text-sm',
                  !s.enabled && 'text-ink-subtle',
                )}
                aria-expanded={open}
              >
                {SECTION_LABELS[s.kind]}
                <ChevronDown
                  className={cn(
                    'size-3.5 text-ink-subtle transition-transform',
                    open && 'rotate-180',
                  )}
                />
              </button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Move up"
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={i === draft.sections.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Switch
                checked={s.enabled}
                onChange={(v) =>
                  set({
                    sections: draft.sections.map((x, j) => (j === i ? { ...x, enabled: v } : x)),
                  })
                }
                label={SECTION_LABELS[s.kind]}
              />
            </div>

            {open ? (
              <div className="space-y-4 bg-canvas/60 px-5 pt-2 pb-5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <Paintbrush className="size-3.5" /> Background
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BACKGROUNDS.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() =>
                        b.value === 'photo' && !st.photo
                          ? photoInput.current?.click()
                          : setStyle(s.kind, {
                              background: b.value,
                              texture: b.value === 'texture' ? (st.texture ?? 'silk') : st.texture,
                            })
                      }
                      className={cn(
                        'rounded-full border px-3 py-1 text-[13px] transition-colors',
                        st.background === b.value
                          ? 'border-emerald-900 bg-emerald-900 text-ivory'
                          : 'border-line bg-surface text-ink-muted hover:text-ink',
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {st.background === 'texture' ? (
                  <div className="grid grid-cols-4 gap-2">
                    {TEXTURES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setStyle(s.kind, { texture: t.id })}
                        className={cn(
                          'overflow-hidden rounded-lg border-2 text-[10px] font-medium',
                          st.texture === t.id ? 'border-azure-500' : 'border-transparent',
                        )}
                      >
                        <div className="h-12" style={{ background: t.css(p) }} />
                        <div className="bg-surface py-1">{t.name}</div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {st.background === 'photo' ? (
                  <div className="flex items-center gap-3">
                    <div
                      className="h-14 w-24 rounded-lg border border-line"
                      style={{ background: paint.background }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      onClick={() => photoInput.current?.click()}
                    >
                      <ImagePlus className="size-4" /> {st.photo ? 'Change photo' : 'Upload photo'}
                    </Button>
                  </div>
                ) : null}

                {st.background === 'photo' || st.background === 'texture' ? (
                  <label className="block text-xs text-ink-muted">
                    <span className="mb-1 flex justify-between">
                      <span>Darken for readable text</span>
                      <span className="tabular-nums">{st.overlay}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={5}
                      value={st.overlay}
                      onChange={(e) => setStyle(s.kind, { overlay: Number(e.target.value) })}
                      className="w-full accent-emerald-800"
                    />
                  </label>
                ) : null}
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void uploadPhoto(s.kind, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
