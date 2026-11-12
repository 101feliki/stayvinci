// Showcase stores: the 10 client spas and 20 independent Ateliers (therapists, beauty
// professionals and room hosts), in the StoreImport format (see import.ts).
//
// What is real and what is a placeholder:
//   real: spa names and the services each spa offers (from the spa).
//   placeholders until the spa confirms or a content script replaces them: team names,
//   prices, opening hours, images. Generated team members of the client spas are hidden
//   from the public store (show_on_store: false) so no invented person is presented as a
//   real employee; they still power availability ("any therapist") and the business app.
//   Ateliers are fictional sample professionals and are shown in full.
//   No reviews are seeded: reviews only come from real guests after completed visits.
import type { StoreImport } from './import.js';
import type { OpeningHours } from './schema.js';

const KES = (shillings: number) => shillings * 100;
const img = (name: string) => `/demo/${name}.jpg`;
const PHOTOS = ['pool', 'massage', 'facial', 'hotstone', 'stones', 'candles', 'botanics'] as const;

const hours = (
  open: string,
  close: string,
  sunday: [string, string] = [open, close],
): OpeningHours => ({
  mon: [[open, close]],
  tue: [[open, close]],
  wed: [[open, close]],
  thu: [[open, close]],
  fri: [[open, close]],
  sat: [[open, close]],
  sun: [sunday],
});

/** What every Stayvinci store offers guests (the product promise, shown on each profile). */
const PROMISES = [
  'Book in seconds, any time of day',
  'Pay by M-Pesa straight to the spa',
  'Discreet: neutral notifications, no names on your lock screen',
  'Free cancellation up to 2 hours before',
];

const POLICIES = {
  cancellation:
    'Cancel free of charge up to 2 hours before your time in the app. Later cancellations and no-shows may be charged as the spa sets out.',
  arrival: 'Please arrive 10–15 minutes early to change and settle in.',
  privacy:
    'Your phone number is never shown to staff. Reminders are neutral and never name the spa or the service.',
};

/* ---------- Team generator (placeholder names) ---------- */

const FIRST = [
  'Achieng',
  'Wanjiru',
  'Akinyi',
  'Njeri',
  'Mumbua',
  'Chebet',
  'Wambui',
  'Atieno',
  'Nyambura',
  'Kendi',
  'Makena',
  'Nafula',
  'Awino',
  'Jeptoo',
  'Wangari',
  'Moraa',
  'Zawadi',
  'Imani',
  'Neema',
  'Amani',
  'Baraka',
  'Otieno',
  'Kamau',
  'Mwangi',
  'Kipchoge',
  'Mutua',
  'Omondi',
  'Njoroge',
  'Kibet',
  'Odhiambo',
  'Faith',
  'Grace',
  'Mercy',
  'Joy',
  'Lilian',
  'Esther',
  'Brian',
  'Kevin',
  'Dennis',
  'Collins',
  'Halima',
  'Fatuma',
  'Aisha',
  'Salma',
  'Rehema',
  'Zuri',
  'Tumaini',
  'Pendo',
  'Furaha',
  'Nia',
];
const LAST = [
  'Odhiambo',
  'Wanjiku',
  'Mwangi',
  'Otieno',
  'Kamau',
  'Njoroge',
  'Kiprono',
  'Mutua',
  'Ochieng',
  'Kariuki',
  'Wafula',
  'Chege',
  'Nyaga',
  'Kilonzo',
  'Barasa',
  'Onyango',
  'Macharia',
  'Gitau',
  'Rotich',
  'Muriuki',
  'Omondi',
  'Ndungu',
  'Koech',
  'Wekesa',
  'Mbugua',
  'Kimani',
  'Langat',
  'Ouma',
  'Musyoka',
  'Achieng',
];

type Role = {
  title: string;
  specialties: string[];
  bio: (years: number) => string;
  bookable: boolean;
};
const ROLES: Record<string, Role> = {
  massage: {
    title: 'Massage therapist',
    specialties: ['massage', 'deep tissue', 'swedish', 'hot stone', 'aromatherapy'],
    bio: (y) => `${y} years of massage practice, from calming Swedish to focused deep tissue work.`,
    bookable: true,
  },
  senior: {
    title: 'Senior therapist',
    specialties: ['massage', 'deep tissue', 'hot stone', 'couples', 'signature rituals'],
    bio: (y) => `Leads signature rituals and couples treatments. ${y} years in spa therapy.`,
    bookable: true,
  },
  clinical: {
    title: 'Clinical massage therapist',
    specialties: ['massage', 'clinical', 'sports', 'deep tissue', 'pain relief'],
    bio: (y) => `Clinical and sports massage for pain relief and recovery. ${y} years of practice.`,
    bookable: true,
  },
  esthetician: {
    title: 'Esthetician',
    specialties: ['facial', 'skin', 'waxing', 'body scrub'],
    bio: (y) => `Skin specialist with ${y} years of facials, peels and body treatments.`,
    bookable: true,
  },
  hammam: {
    title: 'Hammam attendant',
    specialties: ['moroccan bath', 'body scrub', 'steam'],
    bio: (y) => `Moroccan bath rituals with black soap and kessa scrubs. ${y} years of experience.`,
    bookable: true,
  },
  nails: {
    title: 'Nail technician',
    specialties: ['nails', 'manicure', 'pedicure', 'nail art'],
    bio: (y) => `Manicures, pedicures and nail artistry. ${y} years at the table.`,
    bookable: true,
  },
  hair: {
    title: 'Hair stylist',
    specialties: ['hair', 'styling', 'treatment', 'braids'],
    bio: (y) => `Cuts, treatments and protective styles. ${y} years behind the chair.`,
    bookable: true,
  },
  aesthetic: {
    title: 'Aesthetic practitioner',
    specialties: ['medical aesthetics', 'microneedling', 'consultation', 'facial'],
    bio: (y) =>
      `Licensed practitioner for medical-grade facials and microneedling. ${y} years in aesthetics.`,
    bookable: true,
  },
  aqua: {
    title: 'Aquatherapist',
    specialties: ['aquatherapy', 'hydrotherapy', 'massage'],
    bio: (y) => `Water-based therapy and hydrotherapy circuits. ${y} years of practice.`,
    bookable: true,
  },
  desk: {
    title: 'Guest relations',
    specialties: [],
    bio: () => 'Welcomes guests and looks after bookings.',
    bookable: false,
  },
};

/** A deterministic team of `size` people with the given mix of roles. */
function team(
  seed: number,
  size: number,
  mix: [keyof typeof ROLES, number][],
): NonNullable<StoreImport['team']> {
  const total = mix.reduce((n, [, w]) => n + w, 0);
  const roles: (keyof typeof ROLES)[] = [];
  for (const [role, weight] of mix) {
    const n = Math.max(1, Math.round((weight / total) * size));
    for (let i = 0; i < n; i++) roles.push(role);
  }
  while (roles.length > size) roles.splice(roles.length - 2, 1);
  while (roles.length < size) roles.push(mix[0]?.[0] ?? 'massage');
  const used = new Set<string>();
  return roles.map((role, i) => {
    let name = '';
    for (let k = 0; !name || used.has(name); k++) {
      name = `${FIRST[(seed * 7 + i * 3 + k) % FIRST.length]} ${LAST[(seed * 11 + i * 5 + k * 2) % LAST.length]}`;
    }
    used.add(name);
    const r = ROLES[role] as Role;
    return {
      name,
      title: r.title,
      bio: r.bio(3 + ((seed + i * 7) % 12)),
      specialties: r.specialties,
      // Client spas: invented names stay off the public store (see the header note).
      show_on_store: false,
      active: true,
    };
  });
}

const sizeFor = (i: number) => 20 + ((i * 7) % 11); // 20–30 people

/* ---------- Service building blocks ---------- */

type Svc = NonNullable<StoreImport['services']>[number];

/** Placeholder photo per category (only where one of the demo photos honestly fits). */
const CATEGORY_PHOTO: Record<string, (typeof PHOTOS)[number]> = {
  Massage: 'massage',
  Therapeutic: 'hotstone',
  Facials: 'facial',
  Aesthetics: 'facial',
  Thermal: 'pool',
  Aquatherapy: 'pool',
  Moroccan: 'stones',
  Body: 'botanics',
  Packages: 'candles',
};
const photoFor = (category: string) => {
  const p = CATEGORY_PHOTO[category];
  return p ? img(p) : null;
};
const svc = (
  category: string,
  name: string,
  description: string,
  variants: [string, number, number][],
  by: string[],
  extra: Partial<Svc> = {},
): Svc => ({
  category,
  name,
  description,
  image_url: photoFor(category),
  variants: variants.map(([n, d, p]) => ({ name: n, duration_min: d, price_minor: KES(p) })),
  delivered_by: { specialties: by },
  buffer_after_min: 15,
  ...extra,
});

const m = (n: string, d: string, p60: number, p90?: number, by = ['massage']) =>
  svc(
    'Massage',
    n,
    d,
    p90
      ? [
          ['60 minutes', 60, p60],
          ['90 minutes', 90, p90],
        ]
      : [['60 minutes', 60, p60]],
    by,
  );

const design = (
  palette: string,
  headline: string,
  subline: string,
  cover: string,
  marquee: string[],
) => ({
  theme: 'emerald',
  palette: { preset: palette },
  cover: { image: img(cover), headline, subline, layout: 'full', ctaLabel: 'Book a treatment' },
  marquee: {
    enabled: marquee.length > 0,
    speed: 'slow',
    style: 'accent',
    items: marquee.map((text, i) => ({
      id: `m${i}`,
      kind: 'message',
      text,
      serviceId: null,
      enabled: true,
    })),
  },
  season: { id: null, auto: true, recolor: false },
});

const facilityRoom = (name: string, description: string, amenities: string[], capacity = 1) => ({
  type: 'room' as const,
  name,
  description,
  amenities,
  capacity,
});

const owner = (handle: string, name: string) => ({
  full_name: `${name} (owner)`,
  email: `${handle}@owners.stayvinci.test`,
});

/* ---------- The 10 client spas ---------- */

interface SpaSpec {
  handle: string;
  name: string;
  area: string | null;
  tagline: string;
  about: string;
  offers: string[];
  amenities: string[];
  palette: string;
  cover: (typeof PHOTOS)[number];
  hours: OpeningHours;
  mix: [keyof typeof ROLES, number][];
  rooms: NonNullable<StoreImport['rooms']>;
  services: Svc[];
}

const SPAS: SpaSpec[] = [
  {
    handle: 'kempinski-the-spa',
    name: 'Kempinski The Spa - Nairobi',
    area: 'Westlands',
    tagline: 'European season-inspired treatments in the heart of Nairobi',
    about:
      'Treatments inspired by the European seasons, with a sauna, steam room, jacuzzi and an outdoor heated pool to complete your visit.',
    offers: [
      'European season-inspired treatments',
      'Sauna and steam room',
      'Jacuzzi',
      'Outdoor heated pool',
    ],
    amenities: ['Sauna', 'Steam room', 'Jacuzzi', 'Outdoor heated pool', 'Changing rooms'],
    palette: 'noir_champagne',
    cover: 'pool',
    hours: hours('07:00', '21:00'),
    mix: [
      ['senior', 4],
      ['massage', 10],
      ['esthetician', 5],
      ['aqua', 2],
      ['desk', 3],
    ],
    rooms: [
      facilityRoom(
        'Couples suite',
        'A private suite for two, side by side.',
        ['Two beds', 'Private shower'],
        2,
      ),
      facilityRoom(
        'Heated pool and jacuzzi',
        'Outdoor heated pool with jacuzzi, booked per session.',
        ['Pool', 'Jacuzzi', 'Loungers'],
        1,
      ),
    ],
    services: [
      m(
        'Season-inspired signature massage',
        'A full-body massage whose oils and rhythm follow the European season.',
        12000,
        16000,
        ['signature rituals', 'massage'],
      ),
      m('Deep tissue massage', 'Firm, focused work on tight muscles and knots.', 11000, 15000, [
        'deep tissue',
      ]),
      svc(
        'Massage',
        'Couples massage',
        'Side by side in the couples suite.',
        [
          ['60 minutes', 60, 22000],
          ['90 minutes', 90, 30000],
        ],
        ['couples'],
        {
          requires: ['staff', 'room'],
          delivered_by: { specialties: ['couples'], rooms: ['Couples suite'] },
        },
      ),
      svc(
        'Facials',
        'Seasonal facial',
        'Cleanse, exfoliate and nourish with products matched to the season.',
        [['60 minutes', 60, 10000]],
        ['facial'],
      ),
      svc(
        'Thermal',
        'Sauna, steam and pool session',
        'Time in the sauna, steam room, jacuzzi and outdoor heated pool.',
        [['2 hours', 120, 5000]],
        [],
        {
          requires: ['room'],
          delivered_by: { rooms: ['Heated pool and jacuzzi'] },
          buffer_after_min: 0,
        },
      ),
    ],
  },
  {
    handle: 'luxe-escape-spa',
    name: 'Luxe The Escape Spa',
    area: null,
    tagline: 'Aquatherapy, medical-grade facials and Moroccan rituals',
    about:
      'Aquatherapy, TheraVine medical-grade facials, Moroccan-inspired treatments, nail artistry and couples massages.',
    offers: [
      'Aquatherapy',
      'TheraVine medical-grade facials',
      'Moroccan-inspired treatments',
      'Nail artistry',
      'Couples massages',
    ],
    amenities: ['Hydrotherapy pool', 'Moroccan bath', 'Nail lounge', 'Couples suite'],
    palette: 'plum_rose',
    cover: 'facial',
    hours: hours('09:00', '20:00', ['10:00', '18:00']),
    mix: [
      ['aqua', 3],
      ['esthetician', 5],
      ['hammam', 3],
      ['nails', 4],
      ['senior', 3],
      ['massage', 6],
      ['desk', 2],
    ],
    rooms: [
      facilityRoom('Couples suite', 'Private suite for two.', ['Two beds', 'Soft lighting'], 2),
      facilityRoom(
        'Aquatherapy pool',
        'Warm hydrotherapy pool with jets.',
        ['Jets', 'Warm water'],
        1,
      ),
    ],
    services: [
      svc(
        'Aquatherapy',
        'Aquatherapy session',
        'Guided water therapy in the warm hydrotherapy pool.',
        [['45 minutes', 45, 6500]],
        ['aquatherapy'],
        {
          requires: ['staff', 'room'],
          delivered_by: { specialties: ['aquatherapy'], rooms: ['Aquatherapy pool'] },
        },
      ),
      svc(
        'Facials',
        'TheraVine medical-grade facial',
        'Medical-grade facial for visible results.',
        [
          ['60 minutes', 60, 12000],
          ['90 minutes', 90, 16000],
        ],
        ['facial'],
      ),
      svc(
        'Moroccan',
        'Moroccan-inspired ritual',
        'Black soap, kessa scrub and a nourishing wrap.',
        [['75 minutes', 75, 9000]],
        ['moroccan bath'],
      ),
      svc(
        'Nails',
        'Nail artistry',
        'Manicure with custom nail art.',
        [
          ['60 minutes', 60, 3500],
          ['90 minutes', 90, 5000],
        ],
        ['nails'],
      ),
      svc(
        'Massage',
        'Couples massage',
        'Side by side in the couples suite.',
        [['60 minutes', 60, 16000]],
        ['couples'],
        {
          requires: ['staff', 'room'],
          delivered_by: { specialties: ['couples'], rooms: ['Couples suite'] },
        },
      ),
    ],
  },
  ...(['Gigiri', 'Kitisuru', 'Karen'] as const).map((place, k): SpaSpec => {
    const handle = `serenity-${place.toLowerCase()}`;
    const base: Svc[] = [
      m('Serenity massage', 'Full-body relaxing massage.', 7000, 9500),
      m('Deep tissue massage', 'Firm pressure for tight muscles.', 8000, 10500, ['deep tissue']),
      svc(
        'Massage',
        'Couples ritual',
        'A shared ritual for two in the couples suite.',
        [['90 minutes', 90, 18000]],
        ['couples'],
        {
          requires: ['staff', 'room'],
          delivered_by: { specialties: ['couples'], rooms: ['Couples suite'] },
        },
      ),
    ];
    const specific: Record<
      typeof place,
      {
        offers: string[];
        amenities: string[];
        services: Svc[];
        mix: SpaSpec['mix'];
        cover: SpaSpec['cover'];
      }
    > = {
      Gigiri: {
        offers: [
          'Massages',
          'Steam rooms',
          'Couples rituals',
          'Full-service hair salon',
          'On-site coffee shop',
        ],
        amenities: ['Steam room', 'Hair salon', 'Coffee shop', 'Couples suite'],
        services: [
          svc(
            'Hair',
            'Wash, treatment and style',
            'Full-service salon care.',
            [
              ['60 minutes', 60, 3500],
              ['90 minutes', 90, 5000],
            ],
            ['hair'],
          ),
          svc(
            'Thermal',
            'Private steam session',
            'Time in the steam room.',
            [['30 minutes', 30, 1500]],
            [],
            { requires: ['room'], delivered_by: { rooms: ['Steam room'] }, buffer_after_min: 10 },
          ),
        ],
        mix: [
          ['senior', 3],
          ['massage', 9],
          ['hair', 6],
          ['esthetician', 2],
          ['desk', 3],
        ],
        cover: 'candles',
      },
      Kitisuru: {
        offers: [
          'Massages',
          'Sauna and steam baths',
          'Hair salon',
          'Coffee shop',
          'Medical aesthetic consultations',
        ],
        amenities: ['Sauna', 'Steam bath', 'Hair salon', 'Coffee shop', 'Couples suite'],
        services: [
          svc(
            'Hair',
            'Wash, treatment and style',
            'Salon care by our stylists.',
            [['60 minutes', 60, 3500]],
            ['hair'],
          ),
          svc(
            'Aesthetics',
            'Medical aesthetic consultation',
            'A one-to-one consultation with a licensed practitioner.',
            [['30 minutes', 30, 3000]],
            ['consultation'],
          ),
          svc(
            'Thermal',
            'Sauna and steam session',
            'Time in the sauna and steam bath.',
            [['45 minutes', 45, 2000]],
            [],
            { requires: ['room'], delivered_by: { rooms: ['Steam room'] }, buffer_after_min: 10 },
          ),
        ],
        mix: [
          ['senior', 3],
          ['massage', 8],
          ['hair', 5],
          ['aesthetic', 2],
          ['esthetician', 2],
          ['desk', 3],
        ],
        cover: 'botanics',
      },
      Karen: {
        offers: ['Massages on heated beds', 'Jacuzzis', 'Saunas', 'Steam rooms', 'Microneedling'],
        amenities: ['Heated massage beds', 'Jacuzzi', 'Sauna', 'Steam room', 'Couples suite'],
        services: [
          svc(
            'Aesthetics',
            'Microneedling',
            'Collagen induction for texture and tone.',
            [['60 minutes', 60, 15000]],
            ['microneedling'],
          ),
          svc(
            'Thermal',
            'Jacuzzi, sauna and steam',
            'Unwind in the jacuzzi, sauna and steam room.',
            [['60 minutes', 60, 2500]],
            [],
            { requires: ['room'], delivered_by: { rooms: ['Steam room'] }, buffer_after_min: 10 },
          ),
        ],
        mix: [
          ['senior', 4],
          ['massage', 11],
          ['aesthetic', 2],
          ['esthetician', 3],
          ['desk', 3],
        ],
        cover: 'hotstone',
      },
    };
    const s = specific[place];
    return {
      handle,
      name: `Serenity Spa ${place}`,
      area: place,
      tagline:
        place === 'Karen'
          ? 'Massages on heated beds, jacuzzis and microneedling in Karen'
          : place === 'Gigiri'
            ? 'Massage, steam, a full salon and coffee in Gigiri'
            : 'Massage, sauna, salon and aesthetic care in Kitisuru',
      about: `${s.offers.join(', ')}.`,
      offers: s.offers,
      amenities: s.amenities,
      palette: ['emerald_gold', 'ivory_sage', 'forest_blush'][k] as string,
      cover: s.cover,
      hours: hours('08:00', '20:00', ['09:00', '18:00']),
      mix: s.mix,
      rooms: [
        facilityRoom('Couples suite', 'Private suite for two.', ['Two beds'], 2),
        facilityRoom(
          'Steam room',
          place === 'Karen' ? 'Steam room, sauna and jacuzzi.' : 'Steam room and sauna.',
          ['Steam', 'Sauna'],
          1,
        ),
      ],
      services: [...base, ...s.services],
    };
  }),
  {
    handle: 'aromatics-spa',
    name: 'Aromatics Spa',
    area: null,
    tagline: 'Deep tissue, facials and multi-hour relaxation packages',
    about: 'Deep tissue massages, facials and multi-hour relaxation packages.',
    offers: ['Deep tissue massages', 'Facials', 'Multi-hour relaxation packages'],
    amenities: ['Relaxation lounge', 'Aromatherapy oils', 'Changing rooms'],
    palette: 'terracotta_cream',
    cover: 'botanics',
    hours: hours('09:00', '20:00'),
    mix: [
      ['senior', 3],
      ['massage', 12],
      ['esthetician', 5],
      ['desk', 2],
    ],
    rooms: [],
    services: [
      m('Deep tissue massage', 'Focused work on tension and knots.', 6000, 8000, ['deep tissue']),
      m('Aromatherapy massage', 'Essential-oil massage to calm body and mind.', 5500, 7500, [
        'aromatherapy',
      ]),
      svc(
        'Facials',
        'Classic facial',
        'Cleanse, exfoliate, mask and massage.',
        [['60 minutes', 60, 5000]],
        ['facial'],
      ),
      svc(
        'Packages',
        'Half-day relaxation package',
        'Massage, facial and body scrub with time to rest between.',
        [['3 hours', 180, 15000]],
        ['signature rituals'],
      ),
      svc(
        'Packages',
        'Full-day retreat',
        'A full day of treatments with breaks to unwind.',
        [['5 hours', 300, 24000]],
        ['signature rituals'],
      ),
    ],
  },
  {
    handle: 'iconz-spa',
    name: 'Iconz Spa',
    area: null,
    tagline: 'Deep tissue, hot stones, scrubs, steam, waxing and nails',
    about: 'Deep tissue and hot stone massages, body scrubs, steam baths, waxing and nail care.',
    offers: [
      'Deep tissue massage',
      'Hot stone massage',
      'Body scrubs',
      'Steam baths',
      'Waxing',
      'Nail care',
    ],
    amenities: ['Steam bath', 'Nail bar', 'Changing rooms'],
    palette: 'onyx_azure',
    cover: 'hotstone',
    hours: hours('09:00', '21:00', ['10:00', '19:00']),
    mix: [
      ['massage', 11],
      ['esthetician', 5],
      ['nails', 5],
      ['desk', 2],
    ],
    rooms: [facilityRoom('Steam room', 'Private steam bath.', ['Steam'], 1)],
    services: [
      m('Deep tissue massage', 'Firm pressure for tight muscles.', 4500, 6500, ['deep tissue']),
      m('Hot stone massage', 'Warm basalt stones melt away tension.', 5500, 7500, ['hot stone']),
      svc(
        'Body',
        'Body scrub',
        'Exfoliating scrub for smooth, bright skin.',
        [['45 minutes', 45, 3500]],
        ['body scrub'],
      ),
      svc(
        'Body',
        'Waxing',
        'Hair removal by area.',
        [
          ['30 minutes', 30, 2000],
          ['60 minutes', 60, 3500],
        ],
        ['waxing'],
      ),
      svc(
        'Nails',
        'Manicure and pedicure',
        'Shape, cuticle care and polish.',
        [
          ['60 minutes', 60, 2500],
          ['90 minutes', 90, 3800],
        ],
        ['nails'],
      ),
      svc(
        'Thermal',
        'Steam bath',
        'Private time in the steam room.',
        [['30 minutes', 30, 1200]],
        [],
        { requires: ['room'], delivered_by: { rooms: ['Steam room'] }, buffer_after_min: 10 },
      ),
    ],
  },
  {
    handle: 'blossom-kilimani',
    name: 'Blossom Spa Kilimani',
    area: 'Kilimani',
    tagline: 'Moroccan baths and Korean facials in Kilimani',
    about: 'Moroccan baths, Korean facials, steam baths, body scrubs and hot stone massages.',
    offers: ['Moroccan baths', 'Korean facials', 'Steam baths', 'Body scrubs', 'Hot stone massage'],
    amenities: ['Hammam', 'Steam bath', 'Changing rooms'],
    palette: 'blush_cocoa',
    cover: 'facial',
    hours: hours('09:00', '20:00'),
    mix: [
      ['hammam', 5],
      ['esthetician', 6],
      ['massage', 9],
      ['desk', 2],
    ],
    rooms: [
      facilityRoom('Hammam', 'Moroccan bath with heated marble.', ['Heated marble', 'Steam'], 1),
    ],
    services: [
      svc(
        'Moroccan',
        'Moroccan bath',
        'Black soap, steam and kessa scrub in the hammam.',
        [['60 minutes', 60, 5000]],
        ['moroccan bath'],
        {
          requires: ['staff', 'room'],
          delivered_by: { specialties: ['moroccan bath'], rooms: ['Hammam'] },
        },
      ),
      svc(
        'Facials',
        'Korean facial',
        'Multi-step K-beauty facial for glass skin.',
        [['75 minutes', 75, 6500]],
        ['facial'],
      ),
      svc('Body', 'Body scrub', 'Exfoliating scrub.', [['45 minutes', 45, 3500]], ['body scrub']),
      m('Hot stone massage', 'Warm stones for deep relaxation.', 5500, 7500, ['hot stone']),
    ],
  },
  {
    handle: 'azizi-spa',
    name: 'Azizi Spa',
    area: null,
    tagline: 'Moroccan black soap baths, steam, facials and massage',
    about: 'Moroccan black soap baths, steam sessions, facials and full-body massages.',
    offers: ['Moroccan black soap baths', 'Steam sessions', 'Facials', 'Full-body massages'],
    amenities: ['Hammam', 'Steam room'],
    palette: 'ocean_sand',
    cover: 'stones',
    hours: hours('09:00', '20:00', ['10:00', '18:00']),
    mix: [
      ['hammam', 5],
      ['massage', 10],
      ['esthetician', 4],
      ['desk', 2],
    ],
    rooms: [facilityRoom('Hammam', 'Moroccan bath and steam.', ['Steam', 'Black soap'], 1)],
    services: [
      svc(
        'Moroccan',
        'Moroccan black soap bath',
        'Traditional black soap bath with kessa scrub.',
        [['60 minutes', 60, 4500]],
        ['moroccan bath'],
        {
          requires: ['staff', 'room'],
          delivered_by: { specialties: ['moroccan bath'], rooms: ['Hammam'] },
        },
      ),
      svc('Thermal', 'Steam session', 'Time in the steam room.', [['30 minutes', 30, 1200]], [], {
        requires: ['room'],
        delivered_by: { rooms: ['Hammam'] },
        buffer_after_min: 10,
      }),
      svc(
        'Facials',
        'Facial',
        'Deep cleanse and hydration.',
        [['60 minutes', 60, 4500]],
        ['facial'],
      ),
      m('Full-body massage', 'Relaxing full-body massage.', 4500, 6500),
    ],
  },
  {
    handle: 'detox-health-spa',
    name: 'DETOX HEALTH SPA',
    area: null,
    tagline: 'Clinical and therapeutic massage for pain relief and recovery',
    about:
      'Clinical and therapeutic massages for pain relief and muscle recovery, steam baths and Moroccan baths.',
    offers: [
      'Clinical massage',
      'Therapeutic massage',
      'Pain relief',
      'Muscle recovery',
      'Steam baths',
      'Moroccan baths',
    ],
    amenities: ['Steam bath', 'Hammam', 'Changing rooms'],
    palette: 'midnight_azure',
    cover: 'massage',
    hours: hours('07:00', '20:00', ['09:00', '17:00']),
    mix: [
      ['clinical', 12],
      ['massage', 4],
      ['hammam', 3],
      ['desk', 2],
    ],
    rooms: [facilityRoom('Hammam', 'Moroccan bath and steam.', ['Steam'], 1)],
    services: [
      svc(
        'Therapeutic',
        'Clinical massage',
        'Assessment-led massage for pain relief.',
        [
          ['60 minutes', 60, 5000],
          ['90 minutes', 90, 7000],
        ],
        ['clinical'],
      ),
      svc(
        'Therapeutic',
        'Sports recovery massage',
        'For muscle recovery after training or injury.',
        [['60 minutes', 60, 5000]],
        ['sports'],
      ),
      svc(
        'Moroccan',
        'Moroccan bath',
        'Black soap and scrub.',
        [['60 minutes', 60, 4000]],
        ['moroccan bath'],
        {
          requires: ['staff', 'room'],
          delivered_by: { specialties: ['moroccan bath'], rooms: ['Hammam'] },
        },
      ),
      svc('Thermal', 'Steam bath', 'Private steam.', [['30 minutes', 30, 1000]], [], {
        requires: ['room'],
        delivered_by: { rooms: ['Hammam'] },
        buffer_after_min: 10,
      }),
    ],
  },
];

function spaImport(s: SpaSpec, i: number): StoreImport {
  return {
    handle: s.handle,
    name: s.name,
    kind: 'house',
    vertical: 'spa',
    plan_code: 'signature',
    status: 'live',
    visibility: 'listed',
    owner: owner(s.handle, s.name),
    location: { name: s.name, area: s.area, city: 'Nairobi', hours: s.hours },
    storefront: {
      tagline: s.tagline,
      about: s.about,
      highlights: [...s.offers.slice(0, 4), ...PROMISES.slice(0, 2)],
      amenities: s.amenities,
      logo_url: null,
      cover_url: img(s.cover),
      gallery: PHOTOS.filter((p) => p !== s.cover)
        .slice(0, 4)
        .map(img),
      design: design(s.palette, s.name, s.tagline, s.cover, [
        s.offers.slice(0, 3).join(' · '),
        ...PROMISES.slice(1, 3),
      ]),
      socials: {},
      policies: POLICIES,
      published: true,
    },
    categories: [...new Set(s.services.map((x) => x.category as string))].map((name) => ({
      name,
      image_url: photoFor(name),
    })),
    team: team(i + 1, sizeFor(i), s.mix),
    rooms: s.rooms,
    services: s.services,
  };
}

/* ---------- 20 Ateliers: 12 professionals, 8 room hosts ---------- */

interface Pro {
  handle: string;
  name: string;
  craft: string;
  area: string;
  role: keyof typeof ROLES;
  services: Svc[];
  cover: (typeof PHOTOS)[number];
}

const PROS: Pro[] = [
  {
    handle: 'achieng-massage',
    name: 'Achieng Otieno',
    craft: 'Mobile massage therapist',
    area: 'Westlands',
    role: 'massage',
    cover: 'massage',
    services: [m('Home visit massage', 'A full-body massage at your home or hotel.', 5000, 7000)],
  },
  {
    handle: 'wanjiru-skin',
    name: 'Wanjiru Kamau',
    craft: 'Skin therapist',
    area: 'Kilimani',
    role: 'esthetician',
    cover: 'facial',
    services: [
      svc(
        'Facials',
        'Hydrating facial',
        'Deep hydration for dry or tired skin.',
        [['60 minutes', 60, 4500]],
        ['facial'],
      ),
    ],
  },
  {
    handle: 'kibet-sports',
    name: 'Kibet Rotich',
    craft: 'Sports massage therapist',
    area: 'Lavington',
    role: 'clinical',
    cover: 'stones',
    services: [
      svc(
        'Therapeutic',
        'Sports massage',
        'Recovery for runners and athletes.',
        [
          ['60 minutes', 60, 5000],
          ['90 minutes', 90, 7000],
        ],
        ['sports'],
      ),
    ],
  },
  {
    handle: 'zawadi-nails',
    name: 'Zawadi Wafula',
    craft: 'Nail artist',
    area: 'Kileleshwa',
    role: 'nails',
    cover: 'candles',
    services: [
      svc(
        'Nails',
        'Gel manicure with art',
        'Long-lasting gel with custom designs.',
        [['75 minutes', 75, 3500]],
        ['nails'],
      ),
    ],
  },
  {
    handle: 'njeri-braids',
    name: 'Njeri Mwangi',
    craft: 'Hair stylist',
    area: 'South B',
    role: 'hair',
    cover: 'botanics',
    services: [
      svc(
        'Hair',
        'Knotless braids',
        'Neat, lightweight protective braids.',
        [['4 hours', 240, 6000]],
        ['hair'],
      ),
      svc('Hair', 'Silk press', 'Smooth, bouncy finish.', [['2 hours', 120, 3500]], ['hair']),
    ],
  },
  {
    handle: 'imani-aromatherapy',
    name: 'Imani Chege',
    craft: 'Aromatherapist',
    area: 'Runda',
    role: 'massage',
    cover: 'botanics',
    services: [
      m('Aromatherapy massage', 'Essential oils blended for you.', 5500, 7500, ['aromatherapy']),
    ],
  },
  {
    handle: 'otieno-physio-massage',
    name: 'Otieno Ouma',
    craft: 'Clinical massage therapist',
    area: 'Upper Hill',
    role: 'clinical',
    cover: 'massage',
    services: [
      svc(
        'Therapeutic',
        'Back and neck relief',
        'Targeted work for desk-bound backs.',
        [
          ['45 minutes', 45, 3500],
          ['60 minutes', 60, 4500],
        ],
        ['clinical'],
      ),
    ],
  },
  {
    handle: 'makena-lashes-brows',
    name: 'Makena Kariuki',
    craft: 'Brow and lash artist',
    area: 'Kilimani',
    role: 'esthetician',
    cover: 'facial',
    services: [
      svc(
        'Brows and lashes',
        'Brow shape and tint',
        'Shaping and tint for defined brows.',
        [['45 minutes', 45, 2500]],
        ['facial'],
      ),
    ],
  },
  {
    handle: 'amani-reflexology',
    name: 'Amani Muriuki',
    craft: 'Reflexologist',
    area: 'Karen',
    role: 'massage',
    cover: 'stones',
    services: [
      svc(
        'Massage',
        'Foot reflexology',
        'Pressure-point therapy for the feet.',
        [['45 minutes', 45, 3000]],
        ['massage'],
      ),
    ],
  },
  {
    handle: 'halima-henna',
    name: 'Halima Salim',
    craft: 'Henna and bridal beauty',
    area: 'Eastleigh',
    role: 'esthetician',
    cover: 'candles',
    services: [
      svc(
        'Bridal',
        'Bridal henna',
        'Intricate henna for the bride.',
        [['3 hours', 180, 8000]],
        ['facial'],
      ),
    ],
  },
  {
    handle: 'baraka-barber',
    name: 'Baraka Njoroge',
    craft: 'Barber and grooming',
    area: 'Westlands',
    role: 'hair',
    cover: 'botanics',
    services: [
      svc(
        'Grooming',
        'Cut and beard shape',
        'Precision cut with beard care.',
        [['45 minutes', 45, 1500]],
        ['hair'],
      ),
    ],
  },
  {
    handle: 'neema-prenatal',
    name: 'Neema Wekesa',
    craft: 'Prenatal massage therapist',
    area: 'Kileleshwa',
    role: 'massage',
    cover: 'candles',
    services: [m('Prenatal massage', 'Gentle, side-lying massage for mothers-to-be.', 5000)],
  },
];

const HOSTS: {
  handle: string;
  name: string;
  area: string;
  place: string;
  units: [string, string, string[], number, number][];
}[] = [
  {
    handle: 'kilimani-garden-suites',
    name: 'Kilimani Garden Suites',
    area: 'Kilimani',
    place: 'Garden suites near Yaya Centre',
    units: [
      [
        'Garden studio',
        'Quiet studio opening onto the garden.',
        ['Wi-Fi', 'Kitchenette', 'Workspace'],
        2,
        7500,
      ],
      [
        'One-bedroom suite',
        'Bright suite with a balcony.',
        ['Wi-Fi', 'Kitchen', 'Balcony'],
        2,
        9500,
      ],
    ],
  },
  {
    handle: 'westlands-skyline-loft',
    name: 'Westlands Skyline Loft',
    area: 'Westlands',
    place: 'A loft above Westlands',
    units: [
      [
        'Skyline loft',
        'Open-plan loft with city views.',
        ['Wi-Fi', 'City view', 'Gym access'],
        2,
        11000,
      ],
    ],
  },
  {
    handle: 'karen-forest-cottage',
    name: 'Karen Forest Cottage',
    area: 'Karen',
    place: 'A cottage by the forest',
    units: [
      [
        'Forest cottage',
        'Stone cottage with a fireplace.',
        ['Fireplace', 'Garden', 'Parking'],
        4,
        14000,
      ],
    ],
  },
  {
    handle: 'lavington-calm-rooms',
    name: 'Lavington Calm Rooms',
    area: 'Lavington',
    place: 'Calm rooms in leafy Lavington',
    units: [
      ['Queen room', 'Calm room with en-suite.', ['Wi-Fi', 'En-suite'], 2, 6000],
      ['Twin room', 'Two beds, ideal for colleagues.', ['Wi-Fi', 'Desk'], 2, 6500],
      ['Family room', 'Space for four.', ['Wi-Fi', 'Lounge'], 4, 9000],
    ],
  },
  {
    handle: 'runda-poolside-villa',
    name: 'Runda Poolside Villa',
    area: 'Runda',
    place: 'A villa with its own pool',
    units: [
      [
        'Poolside villa',
        'Three-bedroom villa with a private pool.',
        ['Private pool', 'Chef on request', 'Parking'],
        6,
        35000,
      ],
    ],
  },
  {
    handle: 'kileleshwa-studio-nest',
    name: 'Kileleshwa Studio Nest',
    area: 'Kileleshwa',
    place: 'Compact studios for work trips',
    units: [
      ['Studio A', 'Compact studio with a workspace.', ['Wi-Fi', 'Workspace'], 1, 4500],
      ['Studio B', 'Corner studio with more light.', ['Wi-Fi', 'Workspace'], 2, 5000],
    ],
  },
  {
    handle: 'gigiri-diplomat-flat',
    name: 'Gigiri Diplomat Flat',
    area: 'Gigiri',
    place: 'A serviced flat near the UN',
    units: [
      [
        'Two-bedroom flat',
        'Serviced flat, minutes from the UN complex.',
        ['Wi-Fi', 'Housekeeping', 'Backup power'],
        4,
        16000,
      ],
    ],
  },
  {
    handle: 'nyali-ocean-room',
    name: 'Nyali Ocean Room',
    area: 'Nyali, Mombasa',
    place: 'A room by the ocean in Nyali',
    units: [
      ['Ocean room', 'Steps from the beach.', ['Sea view', 'Air conditioning', 'Wi-Fi'], 2, 8500],
    ],
  },
];

function proImport(p: Pro, i: number): StoreImport {
  const r = ROLES[p.role] as Role;
  const first = p.name.split(' ')[0] as string;
  return {
    handle: p.handle,
    name: p.name,
    kind: 'atelier',
    vertical: 'atelier',
    plan_code: 'solo',
    status: 'live',
    visibility: 'listed',
    owner: { full_name: p.name, email: `${p.handle}@owners.stayvinci.test` },
    location: {
      name: `${first}'s studio`,
      area: p.area,
      city: 'Nairobi',
      hours: hours('09:00', '19:00', ['10:00', '16:00']),
    },
    storefront: {
      tagline: `${p.craft} in ${p.area}`,
      about: `${r.bio(4 + (i % 9))} Book directly with ${first}: pick a time that suits you and pay by M-Pesa.`,
      highlights: [p.craft, ...PROMISES.slice(0, 3)],
      amenities: [],
      logo_url: null,
      cover_url: img(p.cover),
      gallery: [img(p.cover)],
      design: design(
        ['ivory_sage', 'plum_rose', 'noir_champagne', 'blush_cocoa'][i % 4] as string,
        p.name,
        `${p.craft} · ${p.area}`,
        p.cover,
        [],
      ),
      socials: {},
      policies: POLICIES,
      published: true,
    },
    categories: [...new Set(p.services.map((x) => x.category as string))].map((name) => ({
      name,
      image_url: photoFor(name),
    })),
    // The professional is their own (single) team member, shown on their store.
    team: [
      {
        name: p.name,
        title: p.craft,
        bio: r.bio(4 + (i % 9)),
        specialties: r.specialties,
        show_on_store: true,
      },
    ],
    services: p.services.map((s) => ({
      ...s,
      delivered_by: { specialties: r.specialties.slice(0, 1) },
    })),
  };
}

function hostImport(h: (typeof HOSTS)[number], i: number): StoreImport {
  const night = (minutes: number) => minutes; // check-in 14:00, check-out 11:00 next day = 21 h
  return {
    handle: h.handle,
    name: h.name,
    kind: 'atelier',
    vertical: 'short_stay',
    plan_code: 'solo',
    status: 'live',
    visibility: 'listed',
    owner: { full_name: `${h.name} host`, email: `${h.handle}@owners.stayvinci.test` },
    location: {
      name: h.name,
      area: h.area,
      city: h.area.includes('Mombasa') ? 'Mombasa' : 'Nairobi',
    },
    storefront: {
      tagline: h.place,
      about: `${h.place}. Check-in from 14:00, check-out by 11:00. The exact address is shared after you book.`,
      highlights: ['Check-in from 14:00', 'Address shared after booking', ...PROMISES.slice(1, 3)],
      amenities: [...new Set(h.units.flatMap((u) => u[2]))],
      logo_url: null,
      cover_url: img(['pool', 'candles', 'botanics', 'stones'][i % 4] as string),
      gallery: [],
      design: design(
        ['ocean_sand', 'ivory_sage', 'forest_blush', 'noir_champagne'][i % 4] as string,
        h.name,
        h.place,
        ['pool', 'candles', 'botanics', 'stones'][i % 4] as (typeof PHOTOS)[number],
        [],
      ),
      socials: {},
      policies: {
        cancellation: 'Free cancellation up to 2 hours before check-in in the app.',
        arrival: 'Check-in from 14:00, check-out by 11:00.',
        privacy: POLICIES.privacy,
      },
      published: true,
    },
    categories: [{ name: 'Stays' }],
    rooms: h.units.map(([name, description, amenities, capacity]) => ({
      type: 'unit' as const,
      name,
      description,
      amenities,
      capacity,
    })),
    services: h.units.map(([name, description, , , price]) => ({
      category: 'Stays',
      name: `${name}: one night`,
      description,
      requires: ['unit' as const],
      variants: [{ name: '1 night', duration_min: night(21 * 60), price_minor: KES(price) }],
      delivered_by: { rooms: [name] },
      buffer_after_min: 0,
    })),
  };
}

/** Everything the showcase seed loads: 10 spas, 12 professionals, 8 room hosts. */
export function showcaseStores(): StoreImport[] {
  return [...SPAS.map(spaImport), ...PROS.map(proImport), ...HOSTS.map(hostImport)];
}
