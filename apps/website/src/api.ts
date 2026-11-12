// Read-only data for the website, from the public store API (no sign-in, nothing private:
// the API never returns addresses, codes, contacts or guest data on these routes).
const env = import.meta.env as Record<string, string | undefined>;
export const API_URL = env.VITE_API_URL ?? 'http://localhost:4000';
export const GUEST_APP_URL = env.VITE_GUEST_APP_URL ?? 'http://localhost:5174';
export const BUSINESS_APP_URL = env.VITE_BUSINESS_APP_URL ?? 'http://localhost:5173';

export type Vertical = 'spa' | 'atelier' | 'short_stay';

export interface StoreCard {
  handle: string;
  name: string;
  kind: 'house' | 'atelier';
  vertical: Vertical;
  tagline: string;
  area: string | null;
  city: string | null;
  logo_url: string | null;
  cover_url: string | null;
  highlights: string[];
  from_price_minor: number | null;
  currency: string;
  rating: { average: number | null; count: number };
}

type Hours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string][]>
>;

export interface StoreDetail extends StoreCard {
  about: string;
  amenities: string[];
  gallery: string[];
  policies: Record<string, string>;
  locations: {
    id: string;
    name: string;
    area: string | null;
    city: string | null;
    timezone: string;
    hours: Hours;
  }[];
  categories: { id: string; name: string; image_url: string | null }[];
  services: {
    id: string;
    category_id: string | null;
    name: string;
    description: string;
    image_url: string | null;
    variants: {
      id: string;
      name: string;
      duration_min: number;
      price_minor: number;
      currency: string;
    }[];
  }[];
  team: {
    id: string;
    name: string;
    title: string | null;
    bio: string;
    specialties: string[];
    photo_url: string | null;
  }[];
  rooms: {
    id: string;
    type: 'room' | 'unit';
    name: string;
    description: string;
    amenities: string[];
    gallery: string[];
    capacity: number;
  }[];
  reviews: {
    id: string;
    rating: number;
    comment: string;
    reply: string | null;
    created_at: string;
  }[];
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`);
  } catch {
    throw new Error("Can't reach Stayvinci right now. Please try again shortly.");
  }
  if (res.status === 404) throw new Error('not_found');
  if (!res.ok) throw new Error('Something went wrong. Please try again.');
  return (await res.json()) as T;
}

export const stores = (vertical?: Vertical) =>
  get<{ items: StoreCard[] }>(`/v1/stores${vertical ? `?vertical=${vertical}` : ''}`).then(
    (r) => r.items,
  );

export const store = (handle: string) =>
  get<StoreDetail>(`/v1/stores/${encodeURIComponent(handle)}`);

/** Media paths from the API are relative to the guest app (where the photos are served). */
export const media = (url: string | null) =>
  url && url.startsWith('/') ? `${GUEST_APP_URL}${url}` : url;

/** The store inside the guest app: what a guest sees after installing the app. */
export const storeUrl = (handle: string) => `${GUEST_APP_URL}/s/${handle}`;

export const money = (minor: number, currency = 'KES') =>
  `${currency} ${new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(minor / 100)}`;

export const duration = (min: number) =>
  min >= 600
    ? 'Overnight'
    : min % 60 === 0
      ? `${min / 60} h`
      : min > 60
        ? `${Math.floor(min / 60)} h ${min % 60} min`
        : `${min} min`;

export const KIND_LABEL: Record<Vertical, string> = {
  spa: 'Spa',
  atelier: 'Atelier',
  short_stay: 'Rooms & stays',
};

export const DAY_LABELS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
] as const;
