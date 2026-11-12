// Store design engine shared by the business editor (preview) and the guest store,
// so what a House designs is exactly what guests see (spec §5.2).
//  - palettes: curated presets plus generated "mixes" from any base colour,
//    every one contrast-checked (WCAG AA for text, 4.5:1)
//  - seasonal themes: Kenyan public holidays and celebrations, with date windows
//  - section textures: pure CSS, no downloads, painted from the store's palette
import type {
  SeasonId,
  SectionKind,
  SectionStyle,
  StoreMarquee,
  StorePalette,
  StoreSeason,
  Storefront,
} from './types';

/* ---------- Colour maths ---------- */

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hh = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255];
}

export function hsl(h: number, s: number, l: number): string {
  return rgbToHex(hslToRgb(h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))));
}

export function hueOf(hex: string): { h: number; s: number; l: number } {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return { h, s, l };
}

/** Linear blend of two colours, t = 0 → a, 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function luminance(hex: string): number {
  const c = hexToRgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
}

/** WCAG contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const INK = '#1C1C1E';
const IVORY = '#F5F1E8';

/** Best readable text colour on a background. */
export function readableOn(bg: string): string {
  return contrast(bg, IVORY) >= contrast(bg, INK) ? IVORY : INK;
}

/** Fills in text colours and nudges anything below AA so every palette is safe. */
export function finalizePalette(
  p: Omit<StorePalette, 'fg' | 'muted' | 'onAccent'> & Partial<StorePalette>,
): StorePalette {
  const fg = p.fg && contrast(p.fg, p.bg) >= 4.5 ? p.fg : readableOn(p.bg);
  const dark = fg === IVORY || luminance(p.bg) < 0.3;
  return {
    id: p.id,
    name: p.name,
    bg: p.bg,
    fg,
    muted: alpha(fg, dark ? 0.72 : 0.66),
    accent: p.accent,
    onAccent: readableOn(p.accent),
    soft: p.soft,
  };
}

export function paletteContrast(p: StorePalette) {
  return {
    text: contrast(p.fg, p.bg),
    button: contrast(p.onAccent, p.accent),
    ok: contrast(p.fg, p.bg) >= 4.5 && contrast(p.onAccent, p.accent) >= 4.5,
  };
}

/* ---------- Palettes ---------- */

export const PRESET_PALETTES: StorePalette[] = [
  { id: 'emerald_gold', name: 'Emerald & Gold', bg: '#092720', accent: '#C8A96A', soft: '#EEF5F2' },
  {
    id: 'noir_champagne',
    name: 'Noir & Champagne',
    bg: '#1C1C1E',
    accent: '#D9BF86',
    soft: '#F3F2EF',
  },
  { id: 'ivory_sage', name: 'Ivory & Sage', bg: '#F5F1E8', accent: '#2F5D4E', soft: '#FAF8F4' },
  { id: 'plum_rose', name: 'Plum & Rose', bg: '#3B2A3F', accent: '#E8B4B8', soft: '#F5F0F6' },
  { id: 'ocean_sand', name: 'Ocean & Sand', bg: '#0E2F3F', accent: '#E3C79A', soft: '#EEF4F6' },
  {
    id: 'terracotta_cream',
    name: 'Terracotta & Cream',
    bg: '#5A2A1D',
    accent: '#F1D3A8',
    soft: '#FBF4EE',
  },
  {
    id: 'midnight_azure',
    name: 'Midnight & Azure',
    bg: '#0B1B33',
    accent: '#00AFF0',
    soft: '#EEF3FA',
  },
  { id: 'blush_cocoa', name: 'Blush & Cocoa', bg: '#F6E4E1', accent: '#5B3A32', soft: '#FCF6F4' },
  { id: 'forest_blush', name: 'Forest & Blush', bg: '#1F3A2E', accent: '#F2C4CE', soft: '#F1F6F2' },
  { id: 'onyx_azure', name: 'Onyx & Azure', bg: '#111214', accent: '#5CCBF5', soft: '#F2F3F5' },
].map((p) => finalizePalette(p));

/** Palettes for the four original curated theme names. */
const THEME_TO_PRESET: Record<Storefront['theme'], string> = {
  emerald: 'emerald_gold',
  noir: 'noir_champagne',
  ivory: 'ivory_sage',
  plum: 'plum_rose',
};

/**
 * "Mix" generator: six harmonious palettes from one base colour
 * (a brand colour, or the colour picked out of the House's logo).
 */
export function suggestPalettes(base: string): StorePalette[] {
  const { h, s } = hueOf(base);
  const sat = Math.max(0.28, Math.min(0.7, s));
  const tag = base.replace('#', '').toLowerCase();
  const mixes: Omit<StorePalette, 'fg' | 'muted' | 'onAccent'>[] = [
    // Deep brand + gold: the signature look
    {
      id: `deep_${tag}`,
      name: 'Deep & Gold',
      bg: hsl(h, sat * 0.75, 0.13),
      accent: '#C8A96A',
      soft: hsl(h, sat * 0.35, 0.96),
    },
    // Deep brand + its own light tint
    {
      id: `tonal_${tag}`,
      name: 'Tonal',
      bg: hsl(h, sat * 0.8, 0.16),
      accent: hsl(h, sat, 0.72),
      soft: hsl(h, sat * 0.3, 0.965),
    },
    // Complementary pop
    {
      id: `contrast_${tag}`,
      name: 'Bold contrast',
      bg: hsl(h, sat * 0.7, 0.14),
      accent: hsl(h + 180, Math.min(0.75, sat + 0.15), 0.68),
      soft: hsl(h, sat * 0.25, 0.965),
    },
    // Analogous warm
    {
      id: `warm_${tag}`,
      name: 'Warm glow',
      bg: hsl(h - 25, sat * 0.6, 0.15),
      accent: hsl(h + 30, Math.min(0.8, sat + 0.2), 0.7),
      soft: hsl(h + 30, 0.35, 0.965),
    },
    // Light, airy: ivory surface, brand as the accent
    {
      id: `airy_${tag}`,
      name: 'Light & airy',
      bg: hsl(h, sat * 0.35, 0.93),
      accent: hsl(h, sat, 0.3),
      soft: hsl(h, sat * 0.2, 0.98),
    },
    // Noir with a brand accent
    {
      id: `noir_${tag}`,
      name: 'Noir',
      bg: '#141416',
      accent: hsl(h, Math.min(0.8, sat + 0.1), 0.66),
      soft: '#F3F2EF',
    },
  ];
  return mixes.map((m) => finalizePalette(m));
}

/* ---------- Seasonal themes ---------- */

export type DecorMotif =
  'sparkles' | 'hearts' | 'eggs' | 'crescent' | 'flowers' | 'flag' | 'pumpkins' | 'snow';

export interface Season {
  id: SeasonId;
  name: string;
  /** Shown to the House, e.g. "1–7 Jan". */
  when: string;
  /** Inclusive month-day window, MM-DD. Moveable feasts use a typical window. */
  from: string;
  until: string;
  accent: string;
  /** Secondary colours used by decorations and the marquee. */
  colors: [string, string, string];
  motif: DecorMotif;
  message: string;
}

export const SEASONS: Season[] = [
  {
    id: 'new_year',
    name: 'New Year',
    when: '28 Dec – 7 Jan',
    from: '12-28',
    until: '01-07',
    accent: '#E3C27A',
    colors: ['#E3C27A', '#FFFFFF', '#C0C7D1'],
    motif: 'sparkles',
    message: 'New year, new you: treat yourself to a fresh start',
  },
  {
    id: 'valentines',
    name: "Valentine's Day",
    when: '1 – 15 Feb',
    from: '02-01',
    until: '02-15',
    accent: '#E8A3B0',
    colors: ['#D9465F', '#F2C4CE', '#FFFFFF'],
    motif: 'hearts',
    message: 'Couples treatments for Valentine’s: book together',
  },
  {
    id: 'easter',
    name: 'Easter',
    when: 'Late Mar – Apr',
    from: '03-20',
    until: '04-25',
    accent: '#C9B6E4',
    colors: ['#C9B6E4', '#F6E7A1', '#B8E0C8'],
    motif: 'eggs',
    message: 'Easter weekend: a calm reset before the week',
  },
  {
    id: 'eid',
    name: 'Eid',
    when: 'Dates vary',
    from: '03-25',
    until: '04-05',
    accent: '#D8C08A',
    colors: ['#D8C08A', '#2F6B5A', '#FFFFFF'],
    motif: 'crescent',
    message: 'Eid Mubarak: celebrate with a little care',
  },
  {
    id: 'mothers_day',
    name: "Mother's Day",
    when: 'Early – mid May',
    from: '05-01',
    until: '05-12',
    accent: '#F0B8C8',
    colors: ['#F0B8C8', '#FFFFFF', '#C8A96A'],
    motif: 'flowers',
    message: 'Spoil Mum: gift cards available',
  },
  {
    id: 'madaraka',
    name: 'Madaraka Day',
    when: '25 May – 1 Jun',
    from: '05-25',
    until: '06-01',
    accent: '#BB0000',
    colors: ['#000000', '#BB0000', '#006600'],
    motif: 'flag',
    message: 'Happy Madaraka Day from all of us',
  },
  {
    id: 'mashujaa',
    name: 'Mashujaa Day',
    when: '14 – 20 Oct',
    from: '10-14',
    until: '10-20',
    accent: '#BB0000',
    colors: ['#000000', '#BB0000', '#006600'],
    motif: 'flag',
    message: 'Celebrating our heroes this Mashujaa Day',
  },
  {
    id: 'halloween',
    name: 'Halloween',
    when: '20 – 31 Oct',
    from: '10-20',
    until: '10-31',
    accent: '#F28C28',
    colors: ['#F28C28', '#6B3FA0', '#1C1C1E'],
    motif: 'pumpkins',
    message: 'Spooky-season glow treatments are here',
  },
  {
    id: 'jamhuri',
    name: 'Jamhuri Day',
    when: '6 – 12 Dec',
    from: '12-06',
    until: '12-12',
    accent: '#BB0000',
    colors: ['#000000', '#BB0000', '#006600'],
    motif: 'flag',
    message: 'Happy Jamhuri Day, Kenya',
  },
  {
    id: 'christmas',
    name: 'Christmas',
    when: '1 – 27 Dec',
    from: '12-01',
    until: '12-27',
    accent: '#D4A64A',
    colors: ['#B3202A', '#1E5A3C', '#D4A64A'],
    motif: 'snow',
    message: 'Festive gift cards and holiday rituals',
  },
];

export function seasonById(id: SeasonId | null): Season | null {
  return SEASONS.find((s) => s.id === id) ?? null;
}

function inWindow(md: string, from: string, until: string) {
  return from <= until ? md >= from && md <= until : md >= from || md <= until;
}

/** Season whose window contains the date (national days win over long windows). */
export function seasonOnDate(date: Date): Season | null {
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const hits = SEASONS.filter((s) => inWindow(md, s.from, s.until));
  return hits.find((s) => s.motif === 'flag') ?? hits[0] ?? null;
}

/** Next season to start after the date, for "coming up" hints. */
export function nextSeason(date: Date): Season {
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const sorted = [...SEASONS].sort((a, b) => (a.from < b.from ? -1 : 1));
  return sorted.find((s) => s.from > md) ?? (sorted[0] as Season);
}

export function activeSeason(season: StoreSeason, now = new Date()): Season | null {
  if (season.auto) return seasonOnDate(now);
  return seasonById(season.id);
}

/* ---------- Section textures (pure CSS, painted from the palette) ---------- */

export interface Texture {
  id: string;
  name: string;
  css: (p: StorePalette) => string;
}

export const TEXTURES: Texture[] = [
  {
    id: 'silk',
    name: 'Silk',
    css: (p) =>
      `linear-gradient(125deg, ${mix(p.bg, p.accent, 0.22)} 0%, ${p.bg} 38%, ${mix(p.bg, '#000000', 0.25)} 100%)`,
  },
  {
    id: 'glow',
    name: 'Candle glow',
    css: (p) =>
      `radial-gradient(90% 70% at 15% 20%, ${alpha(p.accent, 0.38)} 0%, transparent 60%), radial-gradient(60% 60% at 90% 90%, ${alpha(p.accent, 0.18)} 0%, transparent 70%), ${p.bg}`,
  },
  {
    id: 'marble',
    name: 'Marble',
    css: (p) =>
      `radial-gradient(120% 80% at 0% 0%, ${alpha('#FFFFFF', 0.1)} 0%, transparent 40%), linear-gradient(115deg, transparent 40%, ${alpha('#FFFFFF', 0.08)} 45%, transparent 52%), linear-gradient(160deg, transparent 55%, ${alpha(p.accent, 0.14)} 60%, transparent 66%), ${p.bg}`,
  },
  {
    id: 'linen',
    name: 'Linen',
    css: (p) =>
      `repeating-linear-gradient(0deg, ${alpha('#FFFFFF', 0.035)} 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, ${alpha('#000000', 0.05)} 0 1px, transparent 1px 5px), ${p.bg}`,
  },
  {
    id: 'waves',
    name: 'Ripples',
    css: (p) =>
      `repeating-radial-gradient(circle at 100% 0%, ${alpha(p.accent, 0.12)} 0 2px, transparent 2px 28px), ${p.bg}`,
  },
  {
    id: 'arches',
    name: 'Arches',
    css: (p) =>
      `radial-gradient(circle at 50% 120%, transparent 38%, ${alpha(p.accent, 0.16)} 38.5%, transparent 40%), radial-gradient(circle at 50% 120%, transparent 52%, ${alpha(p.accent, 0.1)} 52.5%, transparent 54%), linear-gradient(180deg, ${p.bg}, ${mix(p.bg, '#000000', 0.2)})`,
  },
  {
    id: 'dusk',
    name: 'Dusk',
    css: (p) =>
      `linear-gradient(180deg, ${mix(p.bg, p.accent, 0.35)} 0%, ${p.bg} 55%, ${mix(p.bg, '#000000', 0.3)} 100%)`,
  },
];

export const SECTION_LABELS: Record<SectionKind, string> = {
  hero: 'Hero (top of the store)',
  featured: 'Featured offerings',
  menu: 'Menu by category',
  team: 'Team',
  gallery: 'Gallery',
  video: 'Video reel',
  memberships: 'Memberships',
  reviews: 'Reviews',
  policies: 'Policies',
  location: 'Location & hours',
  faq: 'FAQ',
};

export const DEFAULT_SECTION_STYLE: SectionStyle = {
  background: 'default',
  texture: null,
  photo: null,
  overlay: 35,
};

/** CSS for a section: background, text colour and whether text should be light. */
export function paintSection(
  style: SectionStyle | undefined,
  p: StorePalette,
  kind: SectionKind,
): { background: string; color: string; muted: string; filled: boolean } {
  const st =
    style ??
    (kind === 'hero'
      ? { ...DEFAULT_SECTION_STYLE, background: 'brand' as const }
      : DEFAULT_SECTION_STYLE);
  const shade = (o: number) =>
    `linear-gradient(${alpha('#000000', o / 100)}, ${alpha('#000000', o / 100)})`;
  switch (st.background) {
    case 'soft':
      return { background: p.soft, color: INK, muted: alpha(INK, 0.66), filled: true };
    case 'brand':
      return { background: p.bg, color: p.fg, muted: p.muted, filled: true };
    case 'accent':
      return {
        background: p.accent,
        color: p.onAccent,
        muted: alpha(p.onAccent, 0.72),
        filled: true,
      };
    case 'texture': {
      const t = TEXTURES.find((x) => x.id === st.texture) ?? TEXTURES[0];
      const base = t ? t.css(p) : p.bg;
      return {
        // Darken textures only on dark palettes; light palettes stay airy.
        background:
          readableOn(p.bg) === IVORY && st.overlay > 0
            ? `${shade(st.overlay * 0.4)}, ${base}`
            : base,
        color: p.fg,
        muted: p.muted,
        filled: true,
      };
    }
    case 'photo':
      return st.photo
        ? {
            background: `${shade(Math.max(st.overlay, 25))}, url("${st.photo}") center / cover no-repeat, ${p.bg}`,
            color: IVORY,
            muted: alpha(IVORY, 0.78),
            filled: true,
          }
        : { background: p.bg, color: p.fg, muted: p.muted, filled: true };
    default:
      return { background: 'transparent', color: INK, muted: alpha(INK, 0.66), filled: false };
  }
}

/* ---------- Resolving a store's look ---------- */

export function basePalette(sf: Pick<Storefront, 'theme' | 'accent' | 'palette'>): StorePalette {
  if (sf.palette) return finalizePalette(sf.palette);
  const preset =
    PRESET_PALETTES.find((x) => x.id === THEME_TO_PRESET[sf.theme]) ??
    (PRESET_PALETTES[0] as StorePalette);
  return finalizePalette({ ...preset, accent: sf.accent || preset.accent });
}

/** The palette guests actually see, including any seasonal recolouring. */
export function resolvePalette(
  sf: Pick<Storefront, 'theme' | 'accent' | 'palette' | 'season'>,
  now = new Date(),
): StorePalette {
  const p = basePalette(sf);
  const season = activeSeason(sf.season, now);
  if (!season || !sf.season.recolor) return p;
  return finalizePalette({ ...p, accent: season.accent });
}

/** Marquee lines to show, with the season's greeting added when that item is on. */
export function marqueeLines(m: StoreMarquee, season: Season | null) {
  return m.items
    .filter((i) => i.enabled && (i.kind !== 'season' || season))
    .map((i) => ({ ...i, text: i.kind === 'season' && season ? season.message : i.text }));
}

/** Colours of the marquee strip for its chosen style. */
export function marqueeColors(
  style: StoreMarquee['style'],
  p: StorePalette,
  season: { colors: readonly [string, string, string] } | null,
): { background: string; color: string; accent: string } {
  if (style === 'brand')
    return { background: mix(p.bg, '#000000', 0.15), color: p.fg, accent: p.accent };
  if (style === 'season' && season) {
    const bg = season.colors[0];
    const fg = readableOn(bg);
    return { background: bg, color: fg, accent: season.colors[2] === bg ? fg : season.colors[2] };
  }
  return { background: p.accent, color: p.onAccent, accent: p.onAccent };
}

export const DEFAULT_MARQUEE: StoreMarquee = {
  enabled: false,
  speed: 'normal',
  style: 'accent',
  items: [],
};

export const DEFAULT_SEASON: StoreSeason = { id: null, auto: false, recolor: true };

/** Dominant non-neutral colour of an image (logo), via an offscreen canvas. Browser only. */
export async function colorFromImage(src: string): Promise<string | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode().catch(() => undefined);
  if (!img.width) return null;
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 0;
    if (a < 128) continue;
    const [, s, l] = rgbToHsl([r, g, b]);
    if (s < 0.18 || l < 0.08 || l > 0.92) continue; // skip greys, black, white
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n += 1;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  const best = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  return best ? rgbToHex([best.r / best.n, best.g / best.n, best.b / best.n]) : null;
}

/** Shrinks an uploaded image to a sensible size and returns a data URL. Browser only. */
export async function resizeImage(
  file: File,
  maxSide: number,
  type = 'image/jpeg',
): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(type, 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
