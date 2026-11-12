import { Controller, Get, HttpCode, Inject, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import {
  bookingItem,
  category,
  location,
  resource,
  service,
  serviceResource,
  serviceVariant,
  storefront,
  tenant,
  type Tx,
} from '@stayvinci/db';
import {
  CategoryInput,
  CategoryOut,
  LocationOut,
  LocationUpdate,
  ResourceInput,
  ResourceListQuery,
  ResourceOut,
  ResourceUpdate,
  ServiceInput,
  ServiceOut,
  ServiceUpdate,
  Storefront,
  StorefrontUpdate,
} from '@stayvinci/types';
import { z } from 'zod';
import { Errors, type AppRequest } from '../../common/http.js';
import {
  DocBody,
  DocQuery,
  DocResponse,
  DocUuidParam,
  UuidPath,
  ValidBody,
  ValidQuery,
} from '../../common/validation.js';
import { Data, audit } from '../../database.js';
import { Idempotent, RequireCapability } from '../../security/guards.js';

const actor = (req: AppRequest, action: string, targetType: string, targetId: string) => ({
  tenantId: req.tenant?.id ?? null,
  actorUserId: req.auth?.userId ?? null,
  actorLabel: 'member',
  action,
  targetType,
  targetId,
  ip: req.ip ?? null,
  requestId: req.requestId,
});

const list = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

/* ---------- Mappers ---------- */

type StorefrontRow = typeof storefront.$inferSelect;
const storefrontOut = (
  s: StorefrontRow,
  accessCode: string | null,
): z.output<typeof Storefront> => ({
  tagline: s.tagline,
  about: s.about,
  highlights: s.highlights,
  amenities: s.amenities,
  area: s.area,
  city: s.city,
  logo_url: s.logoUrl,
  cover_url: s.coverUrl,
  gallery: s.gallery,
  design: s.design,
  socials: s.socials,
  policies: s.policies,
  published: s.published,
  access_code: accessCode,
});

type ResourceRow = typeof resource.$inferSelect;
const resourceOut = (r: ResourceRow): z.output<typeof ResourceOut> => ({
  id: r.id,
  type: r.type,
  name: r.name,
  title: r.title,
  bio: r.bio,
  specialties: r.specialties,
  photo_url: r.photoUrl,
  description: r.description,
  amenities: r.amenities,
  gallery: r.gallery,
  capacity: r.capacity,
  show_on_store: r.showOnStore,
  position: r.position,
  active: r.active,
  location_id: r.locationId,
});

const resourceValues = (b: {
  [K in keyof z.output<typeof ResourceInput>]?: z.output<typeof ResourceInput>[K] | undefined;
}) => ({
  ...(b.name !== undefined && { name: b.name }),
  ...(b.title !== undefined && { title: b.title }),
  ...(b.bio !== undefined && { bio: b.bio }),
  ...(b.specialties !== undefined && { specialties: b.specialties }),
  ...(b.photo_url !== undefined && { photoUrl: b.photo_url }),
  ...(b.description !== undefined && { description: b.description }),
  ...(b.amenities !== undefined && { amenities: b.amenities }),
  ...(b.gallery !== undefined && { gallery: b.gallery }),
  ...(b.capacity !== undefined && { capacity: b.capacity }),
  ...(b.show_on_store !== undefined && { showOnStore: b.show_on_store }),
  ...(b.position !== undefined && { position: b.position }),
  ...(b.location_id !== undefined && { locationId: b.location_id }),
});

/**
 * What a House sells and shows: storefront, categories, services and prices, team and
 * rooms, locations and opening hours (spec §7, §8). Scoped to /v1/tenants/{tenantId}.
 */
@ApiTags('Houses: store and catalogue')
@ApiBearerAuth('access-token')
@Controller('v1/tenants/:tenantId')
export class CatalogueController {
  constructor(@Inject(Data) private readonly data: Data) {}

  /* ---------- Storefront ---------- */

  private async ensureStorefront(tx: Tx, tenantId: string): Promise<StorefrontRow> {
    await tx.insert(storefront).values({ tenantId }).onConflictDoNothing();
    const [s] = await tx.select().from(storefront).where(eq(storefront.tenantId, tenantId));
    if (!s) throw Errors.notFound('Storefront');
    return s;
  }

  @Get('storefront')
  @RequireCapability('booking.view')
  @ApiOperation({
    summary: 'Store profile',
    description: 'What guests see on your store, plus your private code.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocResponse(200, Storefront, 'Store profile', [401, 403, 404])
  getStorefront(@Req() req: AppRequest) {
    return this.data.inTenant(req, async (tx) => {
      const s = await this.ensureStorefront(tx, req.tenant?.id ?? '');
      const [t] = await tx
        .select({ code: tenant.accessCode })
        .from(tenant)
        .where(eq(tenant.id, s.tenantId));
      return storefrontOut(s, t?.code ?? null);
    });
  }

  @Patch('storefront')
  @RequireCapability('storefront.edit')
  @ApiOperation({
    summary: 'Edit store profile',
    description:
      'Send only what changes. `published: true` puts the store live for guests (when the House is live).',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocBody(StorefrontUpdate)
  @DocResponse(200, Storefront, 'Updated', [401, 403, 404, 409, 422])
  updateStorefront(
    @ValidBody(StorefrontUpdate) b: z.output<typeof StorefrontUpdate>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const tenantId = req.tenant?.id ?? '';
      await this.ensureStorefront(tx, tenantId);
      const { access_code, logo_url, cover_url, ...rest } = b;
      const set = {
        ...rest,
        ...(logo_url !== undefined && { logoUrl: logo_url }),
        ...(cover_url !== undefined && { coverUrl: cover_url }),
      };
      if (Object.keys(set).length)
        await tx.update(storefront).set(set).where(eq(storefront.tenantId, tenantId));
      if (access_code !== undefined) {
        try {
          // Savepoint: a taken code must not abort the rest of the update.
          await tx.transaction((sp) =>
            sp.update(tenant).set({ accessCode: access_code }).where(eq(tenant.id, tenantId)),
          );
        } catch {
          throw Errors.conflict('That code is taken. Choose another.');
        }
      }
      await audit(tx, actor(req, 'storefront.updated', 'tenant', tenantId));
      const s = await this.ensureStorefront(tx, tenantId);
      const [t] = await tx
        .select({ code: tenant.accessCode })
        .from(tenant)
        .where(eq(tenant.id, tenantId));
      return storefrontOut(s, t?.code ?? null);
    });
  }

  /* ---------- Locations ---------- */

  @Get('locations')
  @RequireCapability('booking.view')
  @ApiOperation({ summary: 'Locations and opening hours' })
  @DocUuidParam('tenantId', 'House id')
  @DocResponse(200, list(LocationOut), 'Locations', [401, 403, 404])
  async locations(@Req() req: AppRequest) {
    const rows = await this.data.inTenant(req, (tx) =>
      tx.select().from(location).orderBy(asc(location.name)),
    );
    return {
      items: rows.map((l) => ({
        id: l.id,
        name: l.name,
        timezone: l.timezone,
        area: l.area,
        city: l.city,
        address: l.address as Record<string, unknown>,
        hours: l.hours,
      })),
    };
  }

  @Patch('locations/:locationId')
  @RequireCapability('settings.manage')
  @ApiOperation({
    summary: 'Edit a location',
    description: 'Name, public area, street address (shared after booking) and opening hours.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocUuidParam('locationId', 'Location id')
  @DocBody(LocationUpdate)
  @DocResponse(200, LocationOut, 'Updated', [401, 403, 404, 422])
  updateLocation(
    @UuidPath('locationId') locationId: string,
    @ValidBody(LocationUpdate) b: z.output<typeof LocationUpdate>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const [l] = await tx.update(location).set(b).where(eq(location.id, locationId)).returning();
      if (!l) throw Errors.notFound('Location');
      await audit(tx, actor(req, 'location.updated', 'location', l.id));
      return {
        id: l.id,
        name: l.name,
        timezone: l.timezone,
        area: l.area,
        city: l.city,
        address: l.address as Record<string, unknown>,
        hours: l.hours,
      };
    });
  }

  /* ---------- Categories ---------- */

  @Get('categories')
  @RequireCapability('booking.view')
  @ApiOperation({ summary: 'Service categories' })
  @DocUuidParam('tenantId', 'House id')
  @DocResponse(200, list(CategoryOut), 'Categories', [401, 403, 404])
  async categories(@Req() req: AppRequest) {
    const rows = await this.data.inTenant(req, (tx) =>
      tx.select().from(category).orderBy(asc(category.position), asc(category.name)),
    );
    return {
      items: rows.map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
        image_url: c.imageUrl,
      })),
    };
  }

  @Post('categories')
  @RequireCapability('catalogue.edit')
  @Idempotent()
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a category' })
  @DocUuidParam('tenantId', 'House id')
  @DocBody(CategoryInput)
  @DocResponse(201, CategoryOut, 'Created', [400, 401, 403, 404, 422])
  createCategory(
    @ValidBody(CategoryInput) b: z.output<typeof CategoryInput>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const [c] = await tx
        .insert(category)
        .values({
          tenantId: req.tenant?.id ?? '',
          name: b.name,
          position: b.position,
          imageUrl: b.image_url,
        })
        .returning();
      if (!c) throw Errors.conflict('Could not create the category.');
      await audit(tx, actor(req, 'category.created', 'category', c.id));
      return { id: c.id, name: c.name, position: c.position, image_url: c.imageUrl };
    });
  }

  @Patch('categories/:categoryId')
  @RequireCapability('catalogue.edit')
  @ApiOperation({ summary: 'Edit a category' })
  @DocUuidParam('tenantId', 'House id')
  @DocUuidParam('categoryId', 'Category id')
  @DocBody(CategoryInput.partial())
  @DocResponse(200, CategoryOut, 'Updated', [401, 403, 404, 422])
  updateCategory(
    @UuidPath('categoryId') id: string,
    @ValidBody(CategoryInput.partial()) b: Partial<z.output<typeof CategoryInput>>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const [c] = await tx
        .update(category)
        .set({
          ...(b.name !== undefined && { name: b.name }),
          ...(b.position !== undefined && { position: b.position }),
          ...(b.image_url !== undefined && { imageUrl: b.image_url }),
        })
        .where(eq(category.id, id))
        .returning();
      if (!c) throw Errors.notFound('Category');
      await audit(tx, actor(req, 'category.updated', 'category', c.id));
      return { id: c.id, name: c.name, position: c.position, image_url: c.imageUrl };
    });
  }

  /* ---------- Services ---------- */

  private async servicesOut(tx: Tx, ids?: string[]): Promise<z.output<typeof ServiceOut>[]> {
    const svcs = await tx
      .select()
      .from(service)
      .where(ids ? inArray(service.id, ids) : undefined)
      .orderBy(asc(service.name));
    if (!svcs.length) return [];
    const sid = svcs.map((s) => s.id);
    const [vars, links] = await Promise.all([
      tx
        .select()
        .from(serviceVariant)
        .where(inArray(serviceVariant.serviceId, sid))
        .orderBy(asc(serviceVariant.position)),
      tx.select().from(serviceResource).where(inArray(serviceResource.serviceId, sid)),
    ]);
    return svcs.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category_id: s.categoryId,
      image_url: s.imageUrl,
      icon: s.icon,
      visibility: s.visibility,
      buffer_before_min: s.bufferBeforeMin,
      buffer_after_min: s.bufferAfterMin,
      requires: s.requires,
      active: s.active,
      variants: vars
        .filter((v) => v.serviceId === s.id)
        .map((v) => ({
          id: v.id,
          name: v.name,
          duration_min: v.durationMin,
          price_minor: Number(v.priceMinor),
          currency: v.currency,
        })),
      resource_ids: links.filter((l) => l.serviceId === s.id).map((l) => l.resourceId),
    }));
  }

  @Get('services')
  @RequireCapability('booking.view')
  @ApiOperation({
    summary: 'Services and prices',
    description: 'Every service with its options (duration and price) and who can deliver it.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocResponse(200, list(ServiceOut), 'Services', [401, 403, 404])
  async services(@Req() req: AppRequest) {
    return { items: await this.data.inTenant(req, (tx) => this.servicesOut(tx)) };
  }

  private async currency(tx: Tx, tenantId: string) {
    const [t] = await tx.select({ c: tenant.currency }).from(tenant).where(eq(tenant.id, tenantId));
    return t?.c ?? 'KES';
  }

  private async setLinks(tx: Tx, tenantId: string, serviceId: string, resourceIds: string[]) {
    await tx.delete(serviceResource).where(eq(serviceResource.serviceId, serviceId));
    if (resourceIds.length)
      await tx
        .insert(serviceResource)
        .values(
          [...new Set(resourceIds)].map((resourceId) => ({ tenantId, serviceId, resourceId })),
        );
  }

  @Post('services')
  @RequireCapability('catalogue.edit')
  @Idempotent()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Add a service',
    description: 'With one or more options (e.g. 60 and 90 minutes) and who can deliver it.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocBody(ServiceInput)
  @DocResponse(201, ServiceOut, 'Created', [400, 401, 403, 404, 422])
  createService(@ValidBody(ServiceInput) b: z.output<typeof ServiceInput>, @Req() req: AppRequest) {
    return this.data.inTenant(req, async (tx) => {
      const tenantId = req.tenant?.id ?? '';
      const currency = await this.currency(tx, tenantId);
      const [s] = await tx
        .insert(service)
        .values({
          tenantId,
          name: b.name,
          description: b.description,
          categoryId: b.category_id,
          imageUrl: b.image_url,
          icon: b.icon,
          visibility: b.visibility,
          bufferBeforeMin: b.buffer_before_min,
          bufferAfterMin: b.buffer_after_min,
          requires: b.requires,
        })
        .returning();
      if (!s) throw Errors.conflict('Could not create the service.');
      await tx.insert(serviceVariant).values(
        b.variants.map((v, i) => ({
          tenantId,
          serviceId: s.id,
          name: v.name,
          durationMin: v.duration_min,
          priceMinor: v.price_minor,
          currency,
          position: i,
        })),
      );
      await this.setLinks(tx, tenantId, s.id, b.resource_ids);
      await audit(tx, actor(req, 'service.created', 'service', s.id));
      const [out] = await this.servicesOut(tx, [s.id]);
      return out;
    });
  }

  @Patch('services/:serviceId')
  @RequireCapability('catalogue.edit')
  @ApiOperation({
    summary: 'Edit a service',
    description:
      'Send only what changes. `variants` replaces the options in order: existing options keep their id (so past bookings stay intact); options with bookings cannot be removed.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocUuidParam('serviceId', 'Service id')
  @DocBody(ServiceUpdate)
  @DocResponse(200, ServiceOut, 'Updated', [401, 403, 404, 409, 422])
  updateService(
    @UuidPath('serviceId') id: string,
    @ValidBody(ServiceUpdate) b: z.output<typeof ServiceUpdate>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const tenantId = req.tenant?.id ?? '';
      const set = {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.description !== undefined && { description: b.description }),
        ...(b.category_id !== undefined && { categoryId: b.category_id }),
        ...(b.image_url !== undefined && { imageUrl: b.image_url }),
        ...(b.icon !== undefined && { icon: b.icon }),
        ...(b.visibility !== undefined && { visibility: b.visibility }),
        ...(b.buffer_before_min !== undefined && { bufferBeforeMin: b.buffer_before_min }),
        ...(b.buffer_after_min !== undefined && { bufferAfterMin: b.buffer_after_min }),
        ...(b.requires !== undefined && { requires: b.requires }),
        ...(b.active !== undefined && { active: b.active }),
      };
      const [s] = Object.keys(set).length
        ? await tx.update(service).set(set).where(eq(service.id, id)).returning({ id: service.id })
        : await tx.select({ id: service.id }).from(service).where(eq(service.id, id));
      if (!s) throw Errors.notFound('Service');
      if (b.variants) {
        const currency = await this.currency(tx, tenantId);
        const existing = await tx
          .select({ id: serviceVariant.id })
          .from(serviceVariant)
          .where(eq(serviceVariant.serviceId, id))
          .orderBy(asc(serviceVariant.position));
        for (const [i, v] of b.variants.entries()) {
          const row = existing[i];
          const values = {
            name: v.name,
            durationMin: v.duration_min,
            priceMinor: v.price_minor,
            position: i,
          };
          if (row) await tx.update(serviceVariant).set(values).where(eq(serviceVariant.id, row.id));
          else
            await tx
              .insert(serviceVariant)
              .values({ ...values, tenantId, serviceId: id, currency });
        }
        const extra = existing.slice(b.variants.length).map((r) => r.id);
        if (extra.length) {
          const [used] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(bookingItem)
            .where(inArray(bookingItem.serviceVariantId, extra));
          if ((used?.n ?? 0) > 0)
            throw Errors.conflict('An option you removed has bookings. Hide the service instead.');
          await tx.delete(serviceVariant).where(inArray(serviceVariant.id, extra));
        }
      }
      if (b.resource_ids) await this.setLinks(tx, tenantId, id, b.resource_ids);
      await audit(tx, actor(req, 'service.updated', 'service', id));
      const [out] = await this.servicesOut(tx, [id]);
      return out;
    });
  }

  /* ---------- Team and rooms ---------- */

  @Get('resources')
  @RequireCapability('booking.view')
  @ApiOperation({
    summary: 'Team members and rooms',
    description: 'Filter with `type` (staff, room, unit, equipment).',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocQuery(ResourceListQuery)
  @DocResponse(200, list(ResourceOut), 'Resources', [401, 403, 404, 422])
  async resources(
    @ValidQuery(ResourceListQuery) q: z.output<typeof ResourceListQuery>,
    @Req() req: AppRequest,
  ) {
    const rows = await this.data.inTenant(req, (tx) =>
      tx
        .select()
        .from(resource)
        .where(q.type ? eq(resource.type, q.type) : undefined)
        .orderBy(asc(resource.type), asc(resource.position), asc(resource.name)),
    );
    return { items: rows.map(resourceOut) };
  }

  @Post('resources')
  @RequireCapability('staff.manage')
  @Idempotent()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Add a team member or room',
    description: 'Team members do not need an account; invite them separately to give app access.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocBody(ResourceInput)
  @DocResponse(201, ResourceOut, 'Created', [400, 401, 403, 404, 422])
  createResource(
    @ValidBody(ResourceInput) b: z.output<typeof ResourceInput>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const [r] = await tx
        .insert(resource)
        .values({
          tenantId: req.tenant?.id ?? '',
          type: b.type,
          name: b.name,
          ...resourceValues(b),
        })
        .returning();
      if (!r) throw Errors.conflict('Could not create it.');
      await audit(tx, actor(req, 'resource.created', 'resource', r.id));
      return resourceOut(r);
    });
  }

  @Patch('resources/:resourceId')
  @RequireCapability('staff.manage')
  @ApiOperation({
    summary: 'Edit a team member or room',
    description: '`active: false` takes them off the calendar for new bookings.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocUuidParam('resourceId', 'Resource id')
  @DocBody(ResourceUpdate)
  @DocResponse(200, ResourceOut, 'Updated', [401, 403, 404, 422])
  updateResource(
    @UuidPath('resourceId') id: string,
    @ValidBody(ResourceUpdate) b: z.output<typeof ResourceUpdate>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const set = { ...resourceValues(b), ...(b.active !== undefined && { active: b.active }) };
      const [r] = Object.keys(set).length
        ? await tx.update(resource).set(set).where(eq(resource.id, id)).returning()
        : await tx.select().from(resource).where(eq(resource.id, id));
      if (!r) throw Errors.notFound('Resource');
      await audit(tx, actor(req, 'resource.updated', 'resource', r.id));
      return resourceOut(r);
    });
  }
}
