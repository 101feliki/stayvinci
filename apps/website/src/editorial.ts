// Editorial content for the website: the season's selection, categories and journal guides.
// The selection is chosen by the Stayvinci team (not paid placement); edit the list here.
import type { StoreCard, Vertical } from './api';

export const SEASON = 'Summer 2026–27';

/** Hand-picked places for the season, in display order. Unknown handles are skipped. */
export const SELECTION = [
  'kempinski-the-spa',
  'serenity-gigiri',
  'luxe-escape-spa',
  'azizi-spa',
  'blossom-kilimani',
  'detox-health-spa',
  'runda-poolside-villa',
  'achieng-massage',
];

export const CATEGORIES: { vertical: Vertical; label: string; blurb: string; image: string }[] = [
  {
    vertical: 'spa',
    label: 'Spas',
    blurb: 'Massage, steam, facials and rituals',
    image: '/demo/stones.jpg',
  },
  {
    vertical: 'atelier',
    label: 'Ateliers',
    blurb: 'Therapists, barbers, nails, lashes',
    image: '/demo/facial.jpg',
  },
  {
    vertical: 'short_stay',
    label: 'Stays',
    blurb: 'Rooms, cottages and villas',
    image: '/demo/pool.jpg',
  },
];

/** Areas with places, most places first. */
export function areasOf(
  items: StoreCard[],
): { area: string; count: number; cover: string | null }[] {
  const by = new Map<string, { count: number; cover: string | null }>();
  for (const s of items) {
    const a = s.area?.trim();
    if (!a) continue;
    const cur = by.get(a) ?? { count: 0, cover: null };
    by.set(a, { count: cur.count + 1, cover: cur.cover ?? s.cover_url });
  }
  return [...by.entries()]
    .map(([area, v]) => ({ area, ...v }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}

export interface Guide {
  slug: string;
  title: string;
  kind: string;
  date: string;
  minutes: number;
  image: string;
  summary: string;
  body: { heading?: string; text: string }[];
}

export const JOURNAL: Guide[] = [
  {
    slug: 'first-deep-tissue-massage',
    title: 'Your first deep-tissue massage: what to expect',
    kind: 'Guide',
    date: '2026-11-10',
    minutes: 4,
    image: '/demo/massage.jpg',
    summary:
      'How it differs from a relaxing massage, how to choose the length, and how to feel good afterwards.',
    body: [
      {
        text: 'Deep-tissue massage works slower and firmer than a relaxing massage, reaching the deeper layers of muscle. It suits tight shoulders, a stiff back or legs after sport, and it should never be painful.',
      },
      {
        heading: 'Choosing the length',
        text: 'Sixty minutes is enough to focus on one or two areas. Ninety minutes lets the therapist work the whole body without hurrying. If it is your first time, start with sixty.',
      },
      {
        heading: 'During the session',
        text: 'Say so if the pressure is too much: a good therapist adjusts straight away. Breathe slowly into the tight spots rather than holding your breath.',
      },
      {
        heading: 'Afterwards',
        text: 'Drink water, keep the rest of the day calm, and expect some tenderness the next day. Book the next visit two to four weeks later if you want lasting change.',
      },
    ],
  },
  {
    slug: 'booking-discreetly',
    title: 'Booking discreetly: how Stayvinci keeps your visits private',
    kind: 'The Stayvinci standard',
    date: '2026-11-08',
    minutes: 3,
    image: '/demo/candles.jpg',
    summary:
      'Neutral reminders, no phone numbers shared with staff, and private stores that open only with a code.',
    body: [
      {
        text: 'Privacy is part of the booking, not an extra. Every place on Stayvinci works with the same rules, whatever their size.',
      },
      {
        heading: 'Neutral reminders',
        text: 'Notifications never name the place or the treatment on your lock screen. You choose whether to see more detail inside the app.',
      },
      {
        heading: 'Your number stays yours',
        text: 'Staff see the name or alias you choose. Your phone number and email are visible only to the owner, and only when needed.',
      },
      {
        heading: 'Private stores',
        text: 'Some places are not listed at all. They share a private code or link with their guests, and only those guests can enter.',
      },
    ],
  },
  {
    slug: 'a-calm-saturday-in-nairobi',
    title: 'A calm Saturday in Nairobi, from steam room to supper',
    kind: 'Evenings for two',
    date: '2026-11-05',
    minutes: 3,
    image: '/demo/pool.jpg',
    summary: 'A slow plan for two: a late-morning steam, a couples ritual, and an early night.',
    body: [
      {
        text: 'The best spa days are unhurried. Book the treatment first, then build the day around it.',
      },
      {
        heading: 'Late morning',
        text: 'Arrive fifteen minutes early, change, and start with the steam room or sauna to warm up the muscles.',
      },
      {
        heading: 'Midday',
        text: 'A couples ritual of ninety minutes, side by side in a private suite. Many spas offer tea and a quiet lounge afterwards.',
      },
      {
        heading: 'Evening',
        text: 'Keep it light: an early supper, no alarms the next morning. If you want to stay over, look at the stays on Stayvinci for a room nearby.',
      },
    ],
  },
];
