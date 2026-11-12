// Contracts for stores, availability, bookings, catalogue, team and reviews (spec §7–§14).
// The API validates with these and Swagger is generated from them.
import { z } from 'zod';

const Uuid = z.uuid();
/** A full https URL, or a path on the same site (e.g. /demo/pool.jpg). */
const Url = z.union([z.url().max(2000), z.string().regex(/^\/[A-Za-z0-9/_.-]{1,300}$/)]);
const Minor = z.number().int().min(0);
const Text = (max: number) => z.string().trim().max(max);
const Day = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
export const OpeningHours = z
  .partialRecord(Day, z.array(z.tuple([LocalTime, LocalTime])).max(4))
  .meta({ id: 'OpeningHours', description: 'Per weekday, a list of [open, close] local times.' });

const Vertical = z.enum(['spa', 'short_stay', 'atelier']);
const Kind = z.enum(['house', 'atelier']);

/* ---------- Public: browsing stores ---------- */

export const Rating = z
  .object({ average: z.number().nullable(), count: z.number().int() })
  .meta({ id: 'Rating', description: 'From reviews of completed visits only.' });

export const StoreCard = z
  .object({
    handle: z.string(),
    name: z.string(),
    kind: Kind,
    vertical: Vertical,
    tagline: z.string(),
    area: z.string().nullable(),
    city: z.string().nullable(),
    logo_url: z.string().nullable(),
    cover_url: z.string().nullable(),
    highlights: z.array(z.string()),
    from_price_minor: z.number().int().nullable(),
    currency: z.string(),
    rating: Rating,
  })
  .meta({ id: 'StoreCard' });

export const StoreListQuery = z.object({
  q: Text(80).optional(),
  vertical: Vertical.optional(),
  kind: Kind.optional(),
});

export const StoreList = z.object({ items: z.array(StoreCard) }).meta({ id: 'StoreList' });

export const PublicVariant = z
  .object({
    id: Uuid,
    name: z.string(),
    duration_min: z.number().int(),
    price_minor: z.number().int(),
    currency: z.string(),
  })
  .meta({ id: 'PublicVariant' });

export const PublicService = z
  .object({
    id: Uuid,
    category_id: Uuid.nullable(),
    name: z.string(),
    description: z.string(),
    image_url: z.string().nullable(),
    icon: z.string().nullable(),
    requires: z.array(z.string()),
    variants: z.array(PublicVariant),
  })
  .meta({ id: 'PublicService' });

export const PublicTeamMember = z
  .object({
    id: Uuid,
    name: z.string(),
    title: z.string().nullable(),
    bio: z.string(),
    specialties: z.array(z.string()),
    photo_url: z.string().nullable(),
  })
  .meta({ id: 'PublicTeamMember' });

export const PublicRoom = z
  .object({
    id: Uuid,
    type: z.enum(['room', 'unit']),
    name: z.string(),
    description: z.string(),
    amenities: z.array(z.string()),
    gallery: z.array(z.string()),
    capacity: z.number().int(),
  })
  .meta({ id: 'PublicRoom' });

export const PublicReview = z
  .object({
    id: Uuid,
    rating: z.number().int(),
    comment: z.string(),
    reply: z.string().nullable(),
    created_at: z.string(),
  })
  .meta({ id: 'PublicReview' });

export const PublicLocation = z
  .object({
    id: Uuid,
    name: z.string(),
    area: z.string().nullable(),
    city: z.string().nullable(),
    timezone: z.string(),
    hours: OpeningHours,
  })
  .meta({ id: 'PublicLocation', description: 'The street address is shared after booking.' });

export const StoreDetail = StoreCard.extend({
  about: z.string(),
  amenities: z.array(z.string()),
  gallery: z.array(z.string()),
  design: z.record(z.string(), z.unknown()),
  socials: z.record(z.string(), z.string()),
  policies: z.record(z.string(), z.string()),
  locations: z.array(PublicLocation),
  categories: z.array(z.object({ id: Uuid, name: z.string(), image_url: z.string().nullable() })),
  services: z.array(PublicService),
  team: z.array(PublicTeamMember),
  rooms: z.array(PublicRoom),
  reviews: z.array(PublicReview),
  chat_enabled: z.boolean().describe('Show the chat button'),
}).meta({ id: 'StoreDetail' });

export const StoreEnter = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{4,24}$/, 'Codes are 4–24 letters, numbers or hyphens'),
  })
  .meta({ id: 'StoreEnter' });
export const StoreEntered = z
  .object({ handle: z.string(), name: z.string() })
  .meta({ id: 'StoreEntered' });

export const AvailabilityQuery = z.object({
  variant_id: Uuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  resource_id: Uuid.optional(),
});

export const Availability = z
  .object({
    date: z.string(),
    timezone: z.string(),
    slots: z.array(
      z.object({
        starts_at: z.string(),
        ends_at: z.string(),
        resource_ids: z.array(Uuid).meta({ description: 'Team members or rooms free then' }),
      }),
    ),
  })
  .meta({ id: 'Availability' });

/* ---------- Guest: bookings ---------- */

export const BookingCreate = z
  .object({
    variant_id: Uuid,
    starts_at: z.iso.datetime({ offset: true }),
    resource_id: Uuid.optional().meta({ description: 'Preferred team member or room' }),
    notes: Text(500).optional(),
    via: z
      .enum(['own_channel', 'marketplace'])
      .default('own_channel')
      .meta({ description: 'How the guest found the store (first touch is permanent)' }),
  })
  .meta({ id: 'BookingCreate' });

export const BookingState = z.enum([
  'held',
  'pending_payment',
  'requested',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled_by_guest',
  'cancelled_by_tenant',
  'no_show',
  'disputed',
]);

export const GuestBooking = z
  .object({
    id: Uuid,
    ref: z.string(),
    store: z.object({ handle: z.string(), name: z.string() }),
    state: BookingState,
    starts_at: z.string(),
    ends_at: z.string(),
    service: z.string(),
    variant: z.string(),
    with: z.string().nullable(),
    total_minor: z.number().int(),
    currency: z.string(),
    can_cancel: z.boolean(),
    can_review: z.boolean(),
  })
  .meta({ id: 'GuestBooking' });

export const ReviewCreate = z
  .object({ rating: z.number().int().min(1).max(5), comment: Text(1000).default('') })
  .meta({ id: 'ReviewCreate' });

/* ---------- House: storefront, catalogue, team, bookings ---------- */

export const Storefront = z
  .object({
    tagline: z.string(),
    about: z.string(),
    highlights: z.array(z.string()),
    amenities: z.array(z.string()),
    area: z.string().nullable(),
    city: z.string().nullable(),
    logo_url: z.string().nullable(),
    cover_url: z.string().nullable(),
    gallery: z.array(z.string()),
    design: z.record(z.string(), z.unknown()),
    socials: z.record(z.string(), z.string()),
    policies: z.record(z.string(), z.string()),
    published: z.boolean(),
    chat_enabled: z.boolean().describe('Guests can message the House from the store'),
    access_code: z.string().nullable(),
  })
  .meta({ id: 'Storefront' });

export const StorefrontUpdate = z
  .object({
    tagline: Text(160),
    about: Text(4000),
    highlights: z.array(Text(80)).max(12),
    amenities: z.array(Text(60)).max(40),
    area: Text(80).nullable(),
    city: Text(80).nullable(),
    logo_url: Url.nullable(),
    cover_url: Url.nullable(),
    gallery: z.array(Url).max(40),
    design: z.record(z.string(), z.unknown()),
    socials: z.record(z.string(), Text(200)),
    policies: z.record(z.string(), Text(2000)),
    published: z.boolean(),
    chat_enabled: z.boolean(),
    access_code: z
      .string()
      .regex(/^[A-Za-z0-9-]{4,24}$/)
      .nullable(),
  })
  .partial()
  .meta({ id: 'StorefrontUpdate' });

export const VariantInput = z.object({
  name: Text(80).min(1),
  duration_min: z.number().int().min(5).max(1440),
  price_minor: Minor,
});

export const ServiceInput = z
  .object({
    name: Text(120).min(2),
    description: Text(2000).default(''),
    category_id: Uuid.nullable().default(null),
    image_url: Url.nullable().default(null),
    icon: Text(40).nullable().default(null),
    visibility: z.enum(['public', 'members_only', 'invite_only', 'hidden']).default('public'),
    buffer_before_min: z.number().int().min(0).max(240).default(0),
    buffer_after_min: z.number().int().min(0).max(240).default(0),
    requires: z
      .array(z.enum(['staff', 'room', 'unit']))
      .max(3)
      .default(['staff']),
    variants: z.array(VariantInput).min(1).max(12),
    resource_ids: z.array(Uuid).max(200).default([]).meta({
      description: 'Team members or rooms who can deliver this service',
    }),
  })
  .meta({ id: 'ServiceInput' });

export const ServiceUpdate = ServiceInput.partial()
  .extend({ active: z.boolean().optional() })
  .meta({ id: 'ServiceUpdate' });

export const ServiceOut = z
  .object({
    id: Uuid,
    name: z.string(),
    description: z.string(),
    category_id: Uuid.nullable(),
    image_url: z.string().nullable(),
    icon: z.string().nullable(),
    visibility: z.string(),
    buffer_before_min: z.number().int(),
    buffer_after_min: z.number().int(),
    requires: z.array(z.string()),
    active: z.boolean(),
    variants: z.array(PublicVariant),
    resource_ids: z.array(Uuid),
  })
  .meta({ id: 'Service' });

export const CategoryInput = z
  .object({
    name: Text(80).min(1),
    position: z.number().int().min(0).max(999).default(0),
    image_url: Url.nullable().default(null),
  })
  .meta({ id: 'CategoryInput' });

export const CategoryOut = z
  .object({
    id: Uuid,
    name: z.string(),
    position: z.number().int(),
    image_url: z.string().nullable(),
  })
  .meta({ id: 'Category' });

export const ResourceInput = z
  .object({
    type: z.enum(['staff', 'room', 'unit', 'equipment']),
    name: Text(120).min(1),
    title: Text(80).nullable().default(null),
    bio: Text(1200).default(''),
    specialties: z.array(Text(60)).max(20).default([]),
    photo_url: Url.nullable().default(null),
    description: Text(2000).default(''),
    amenities: z.array(Text(60)).max(40).default([]),
    gallery: z.array(Url).max(30).default([]),
    capacity: z.number().int().min(1).max(500).default(1),
    show_on_store: z.boolean().default(true),
    position: z.number().int().min(0).max(999).default(0),
    location_id: Uuid.nullable().default(null),
  })
  .meta({ id: 'ResourceInput' });

export const ResourceUpdate = ResourceInput.omit({ type: true })
  .partial()
  .extend({ active: z.boolean().optional() })
  .meta({ id: 'ResourceUpdate' });

export const ResourceOut = z
  .object({
    id: Uuid,
    type: z.string(),
    name: z.string(),
    title: z.string().nullable(),
    bio: z.string(),
    specialties: z.array(z.string()),
    photo_url: z.string().nullable(),
    description: z.string(),
    amenities: z.array(z.string()),
    gallery: z.array(z.string()),
    capacity: z.number().int(),
    show_on_store: z.boolean(),
    position: z.number().int(),
    active: z.boolean(),
    location_id: Uuid.nullable(),
  })
  .meta({ id: 'Resource' });

export const ResourceListQuery = z.object({
  type: z.enum(['staff', 'room', 'unit', 'equipment']).optional(),
});

export const LocationOut = z
  .object({
    id: Uuid,
    name: z.string(),
    timezone: z.string(),
    area: z.string().nullable(),
    city: z.string().nullable(),
    address: z.record(z.string(), z.unknown()),
    hours: OpeningHours,
  })
  .meta({ id: 'Location' });

export const LocationUpdate = z
  .object({
    name: Text(120).min(1),
    area: Text(80).nullable(),
    city: Text(80).nullable(),
    address: z.record(z.string(), Text(200)),
    hours: OpeningHours,
  })
  .partial()
  .meta({ id: 'LocationUpdate' });

export const HouseBookingQuery = z.object({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
});

export const HouseBooking = z
  .object({
    id: Uuid,
    ref: z.string(),
    state: BookingState,
    starts_at: z.string(),
    ends_at: z.string(),
    guest: z.object({ id: Uuid, alias: z.string().nullable() }),
    service: z.string(),
    variant: z.string(),
    resources: z.array(z.object({ id: Uuid, name: z.string(), type: z.string() })),
    total_minor: z.number().int(),
    paid_minor: z.number().int(),
    currency: z.string(),
    source: z.string(),
    notes: z.string().nullable(),
  })
  .meta({ id: 'HouseBooking' });

export const BookingTransition = z
  .object({
    to: z.enum(['confirmed', 'checked_in', 'completed', 'no_show', 'cancelled_by_tenant']),
    version: z
      .number()
      .int()
      .min(1)
      .meta({ description: 'The version you last saw (prevents lost updates)' }),
  })
  .meta({ id: 'BookingTransition' });

export const HouseReview = PublicReview.extend({
  booking_ref: z.string(),
  published: z.boolean(),
}).meta({ id: 'HouseReview' });

export const ReviewReply = z.object({ reply: Text(1000).min(1) }).meta({ id: 'ReviewReply' });
