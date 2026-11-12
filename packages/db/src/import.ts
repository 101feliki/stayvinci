// Store import: one JSON format to create or update Houses and Ateliers with their store,
// team, rooms and services. Used by the showcase seed and by content scripts:
//
//   pnpm --filter @stayvinci/db run import ./stores.json     (a StoreImport or an array)
//
// Matching is by natural keys, so re-running updates in place and never duplicates:
//   store by `handle`; location by name; category by name; team member and room by name;
//   service by name; service options by position. Fields you leave out are left as they are.
import { and, eq } from 'drizzle-orm';
import { withContext, type Db, type Tx } from './connect.js';
import {
  category,
  location,
  membership,
  resource,
  service,
  serviceResource,
  serviceVariant,
  storefront,
  tenant,
  user,
  type OpeningHours,
} from './schema.js';

export interface StoreImport {
  handle: string;
  name: string;
  kind?: 'house' | 'atelier';
  vertical?: 'spa' | 'short_stay' | 'atelier';
  plan_code?: string;
  status?: 'onboarding' | 'ready' | 'live';
  visibility?: 'private' | 'listed' | 'listed_limited';
  access_code?: string | null;
  timezone?: string;
  currency?: string;
  market_code?: string;
  /** The owner's sign-in email. They sign in with a magic link; no password is stored. */
  owner?: { full_name: string; email: string };
  location?: {
    name: string;
    area?: string | null;
    city?: string | null;
    hours?: OpeningHours;
    address?: Record<string, string>;
  };
  storefront?: {
    tagline?: string;
    about?: string;
    highlights?: string[];
    amenities?: string[];
    logo_url?: string | null;
    cover_url?: string | null;
    gallery?: string[];
    design?: Record<string, unknown>;
    socials?: Record<string, string>;
    policies?: Record<string, string>;
    published?: boolean;
  };
  categories?: { name: string; image_url?: string | null }[];
  team?: {
    name: string;
    title?: string | null;
    bio?: string;
    specialties?: string[];
    photo_url?: string | null;
    show_on_store?: boolean;
    active?: boolean;
  }[];
  rooms?: {
    type?: 'room' | 'unit';
    name: string;
    description?: string;
    amenities?: string[];
    gallery?: string[];
    capacity?: number;
  }[];
  services?: {
    name: string;
    category?: string;
    description?: string;
    image_url?: string | null;
    icon?: string | null;
    requires?: ('staff' | 'room' | 'unit')[];
    buffer_before_min?: number;
    buffer_after_min?: number;
    variants: { name: string; duration_min: number; price_minor: number }[];
    /**
     * Who delivers it: team specialties (any team member with one of these), and/or room
     * names. Leave out to let every team member (or every room/unit) deliver it.
     */
    delivered_by?: { specialties?: string[]; rooms?: string[] };
  }[];
}

export interface ImportResult {
  handle: string;
  tenantId: string;
  created: boolean;
  team: number;
  services: number;
}

/** Opening hours for a new location when none are given (matches the database default). */
const STANDARD_HOURS: OpeningHours = {
  mon: [['09:00', '20:00']],
  tue: [['09:00', '20:00']],
  wed: [['09:00', '20:00']],
  thu: [['09:00', '20:00']],
  fri: [['09:00', '20:00']],
  sat: [['09:00', '20:00']],
  sun: [['10:00', '18:00']],
};

const defined = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Creates or updates one store. Runs as the platform role (every write is RLS-checked). */
export async function importStore(db: Db, s: StoreImport): Promise<ImportResult> {
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(s.handle))
    throw new Error(`Invalid handle "${s.handle}": 3–30 lowercase letters, numbers and hyphens.`);
  return withContext(db, { role: 'sv_platform' }, async (tx) => {
    const [found] = await tx.select().from(tenant).where(eq(tenant.handle, s.handle));
    const tenantFields = defined({
      name: s.name,
      kind: s.kind,
      vertical: s.vertical,
      planCode: s.plan_code,
      status: s.status,
      visibility: s.visibility,
      accessCode: s.access_code,
      timezone: s.timezone,
      currency: s.currency,
      marketCode: s.market_code,
    });
    let t = found;
    if (t) {
      [t] = await tx.update(tenant).set(tenantFields).where(eq(tenant.id, t.id)).returning();
    } else {
      [t] = await tx
        .insert(tenant)
        .values({
          handle: s.handle,
          name: s.name,
          kind: s.kind ?? 'house',
          vertical: s.vertical ?? 'spa',
          marketCode: s.market_code ?? 'KE',
          timezone: s.timezone ?? 'Africa/Nairobi',
          currency: s.currency ?? 'KES',
          planCode: s.plan_code ?? 'business',
          status: s.status ?? 'live',
          visibility: s.visibility ?? 'listed',
          accessCode: s.access_code ?? null,
          source: 'invited',
        })
        .returning();
    }
    if (!t) throw new Error(`Could not save ${s.handle}`);
    const tenantId = t.id;

    if (s.owner) await upsertOwner(tx, tenantId, s.owner);

    if (s.location) {
      const [loc] = await tx
        .select({ id: location.id })
        .from(location)
        .where(and(eq(location.tenantId, tenantId), eq(location.name, s.location.name)));
      const values = defined({
        area: s.location.area,
        city: s.location.city,
        hours: s.location.hours,
        address: s.location.address,
      });
      if (loc) await tx.update(location).set(values).where(eq(location.id, loc.id));
      else
        await tx.insert(location).values({
          tenantId,
          name: s.location.name,
          timezone: s.timezone ?? t.timezone,
          address: s.location.address ?? {},
          ...values,
          hours: s.location.hours ?? STANDARD_HOURS,
        });
    }

    if (s.storefront) {
      const f = s.storefront;
      const values = defined({
        tagline: f.tagline,
        about: f.about,
        highlights: f.highlights,
        amenities: f.amenities,
        area: s.location?.area,
        city: s.location?.city,
        logoUrl: f.logo_url,
        coverUrl: f.cover_url,
        gallery: f.gallery,
        design: f.design,
        socials: f.socials,
        policies: f.policies,
        published: f.published,
      });
      await tx
        .insert(storefront)
        .values({ tenantId, ...values })
        .onConflictDoUpdate({ target: storefront.tenantId, set: values });
    }

    const categoryIds = new Map<string, string>();
    for (const [i, c] of (s.categories ?? []).entries()) {
      categoryIds.set(
        c.name,
        await upsertByName(
          tx,
          category,
          tenantId,
          c.name,
          defined({ position: i, imageUrl: c.image_url }),
        ),
      );
    }

    const teamIds: { id: string; specialties: string[] }[] = [];
    for (const [i, m] of (s.team ?? []).entries()) {
      const id = await upsertResource(
        tx,
        tenantId,
        'staff',
        m.name,
        defined({
          title: m.title,
          bio: m.bio,
          specialties: m.specialties,
          photoUrl: m.photo_url,
          showOnStore: m.show_on_store,
          active: m.active,
          position: i,
        }),
      );
      teamIds.push({ id, specialties: (m.specialties ?? []).map((x) => x.toLowerCase()) });
    }

    const roomIds = new Map<string, string>();
    for (const [i, r] of (s.rooms ?? []).entries()) {
      roomIds.set(
        r.name,
        await upsertResource(
          tx,
          tenantId,
          r.type ?? 'room',
          r.name,
          defined({
            description: r.description,
            amenities: r.amenities,
            gallery: r.gallery,
            capacity: r.capacity,
            position: i,
          }),
        ),
      );
    }

    for (const svc of s.services ?? []) {
      const categoryId = svc.category
        ? (categoryIds.get(svc.category) ??
          (await upsertByName(tx, category, tenantId, svc.category, {})))
        : undefined;
      const serviceId = await upsertByName(
        tx,
        service,
        tenantId,
        svc.name,
        defined({
          categoryId,
          description: svc.description,
          imageUrl: svc.image_url,
          icon: svc.icon,
          requires: svc.requires ?? ['staff'],
          bufferBeforeMin: svc.buffer_before_min,
          bufferAfterMin: svc.buffer_after_min,
        }),
      );
      const existing = await tx
        .select({ id: serviceVariant.id })
        .from(serviceVariant)
        .where(eq(serviceVariant.serviceId, serviceId))
        .orderBy(serviceVariant.position);
      for (const [i, v] of svc.variants.entries()) {
        const values = {
          name: v.name,
          durationMin: v.duration_min,
          priceMinor: v.price_minor,
          position: i,
        };
        const row = existing[i];
        if (row) await tx.update(serviceVariant).set(values).where(eq(serviceVariant.id, row.id));
        else
          await tx
            .insert(serviceVariant)
            .values({ ...values, tenantId, serviceId, currency: s.currency ?? t.currency });
      }
      // Who delivers it.
      if (svc.delivered_by) {
        const wanted = (svc.delivered_by.specialties ?? []).map((x) => x.toLowerCase());
        const staff = wanted.length
          ? teamIds.filter((m) => m.specialties.some((sp) => wanted.includes(sp))).map((m) => m.id)
          : [];
        const rooms = (svc.delivered_by.rooms ?? [])
          .map((n) => roomIds.get(n))
          .filter((x): x is string => !!x);
        await tx.delete(serviceResource).where(eq(serviceResource.serviceId, serviceId));
        const all = [...new Set([...staff, ...rooms])];
        if (all.length)
          await tx
            .insert(serviceResource)
            .values(all.map((resourceId) => ({ tenantId, serviceId, resourceId })));
      }
    }
    return {
      handle: s.handle,
      tenantId,
      created: !found,
      team: s.team?.length ?? 0,
      services: s.services?.length ?? 0,
    };
  });
}

async function upsertOwner(tx: Tx, tenantId: string, o: { full_name: string; email: string }) {
  const email = o.email.trim().toLowerCase();
  await tx.insert(user).values({ email, fullName: o.full_name }).onConflictDoNothing();
  const [u] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!u) throw new Error(`Could not save owner ${email}`);
  const [m] = await tx
    .select({ id: membership.id })
    .from(membership)
    .where(and(eq(membership.tenantId, tenantId), eq(membership.userId, u.id)));
  if (!m)
    await tx.insert(membership).values({ tenantId, userId: u.id, role: 'owner', status: 'active' });
}

type Named = typeof category | typeof service;
async function upsertByName(
  tx: Tx,
  table: Named,
  tenantId: string,
  name: string,
  values: Record<string, unknown>,
): Promise<string> {
  const [row] = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.tenantId, tenantId), eq(table.name, name)));
  if (row) {
    if (Object.keys(values).length)
      await tx
        .update(table)
        .set(values as never)
        .where(eq(table.id, row.id));
    return row.id;
  }
  const [created] = await tx
    .insert(table)
    .values({ tenantId, name, ...values } as never)
    .returning({ id: table.id });
  if (!created) throw new Error(`Could not save ${name}`);
  return created.id;
}

async function upsertResource(
  tx: Tx,
  tenantId: string,
  type: 'staff' | 'room' | 'unit',
  name: string,
  values: Record<string, unknown>,
): Promise<string> {
  const [row] = await tx
    .select({ id: resource.id })
    .from(resource)
    .where(and(eq(resource.tenantId, tenantId), eq(resource.type, type), eq(resource.name, name)));
  if (row) {
    if (Object.keys(values).length)
      await tx
        .update(resource)
        .set(values as never)
        .where(eq(resource.id, row.id));
    return row.id;
  }
  const [created] = await tx
    .insert(resource)
    .values({ tenantId, type, name, ...values } as never)
    .returning({ id: resource.id });
  if (!created) throw new Error(`Could not save ${name}`);
  return created.id;
}
