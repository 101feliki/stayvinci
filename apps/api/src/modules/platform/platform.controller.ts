import { Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { membership, plan, tenant, user } from '@stayvinci/db';
import { CursorQuery, PlatformTenantCreate, Tenant, pageOf } from '@stayvinci/types';
import { z } from 'zod';
import { Errors, type AppRequest } from '../../common/http.js';
import { DocBody, DocQuery, DocResponse, ValidBody, ValidQuery } from '../../common/validation.js';
import { Data, audit, emit } from '../../database.js';
import { Idempotent, PlatformRoles } from '../../security/guards.js';
import { IdentityService } from '../identity/identity.service.js';
import { decodeCursor, encodeCursor } from '../tenants/cursor.js';

type TenantRow = typeof tenant.$inferSelect;
const out = (t: TenantRow): z.output<typeof Tenant> => ({
  id: t.id,
  handle: t.handle,
  name: t.name,
  kind: t.kind,
  vertical: t.vertical,
  market_code: t.marketCode,
  timezone: t.timezone,
  currency: t.currency,
  status: t.status,
  visibility: t.visibility,
  plan_code: t.planCode,
  created_at: t.createdAt,
});

/**
 * Stayvinci staff console (spec §13). Staff sign in to the console audience with 2FA;
 * every write is audit-logged against the House it touched.
 */
@ApiTags('Platform (staff)')
@Controller('v1/platform')
export class PlatformController {
  constructor(
    @Inject(Data) private readonly data: Data,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Get('tenants')
  @PlatformRoles('super_admin', 'admin', 'finance', 'marketing')
  @ApiOperation({
    summary: 'All Houses',
    description: 'Every House and Atelier, newest first. Staff only.',
  })
  @DocQuery(CursorQuery)
  @DocResponse(200, pageOf(Tenant), 'A page of Houses', [401, 403, 404, 422])
  async list(@ValidQuery(CursorQuery) q: z.output<typeof CursorQuery>) {
    const cursor = decodeCursor(q.cursor);
    const rows = await this.data.platform((tx) =>
      tx
        .select()
        .from(tenant)
        .where(
          cursor
            ? or(
                lt(tenant.createdAt, cursor.t),
                and(eq(tenant.createdAt, cursor.t), lt(tenant.id, cursor.id)),
              )
            : undefined,
        )
        .orderBy(desc(tenant.createdAt), desc(tenant.id))
        .limit(q.limit + 1),
    );
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return {
      items: page.map(out),
      next_cursor:
        rows.length > q.limit && last ? encodeCursor({ t: last.createdAt, id: last.id }) : null,
    };
  }

  @Post('tenants')
  @PlatformRoles('super_admin', 'admin')
  @Idempotent()
  @ApiOperation({
    summary: 'Create a House and invite its owner',
    description:
      'White-glove onboarding (spec §2). Creates the House in "onboarding", adds the owner, and emails them an activation link. The owner sets up two-step verification and accepts the agreements themselves.',
  })
  @DocBody(PlatformTenantCreate)
  @DocResponse(201, Tenant, 'Created', [400, 401, 403, 404, 409, 422])
  async create(
    @ValidBody(PlatformTenantCreate) body: z.output<typeof PlatformTenantCreate>,
    @Req() req: AppRequest,
  ) {
    const staff = req.auth;
    if (!staff) throw Errors.unauthorized();
    const created = await this.data.platform(async (tx) => {
      const [p] = await tx
        .select()
        .from(plan)
        .where(and(eq(plan.code, body.plan_code), eq(plan.active, true)));
      if (!p)
        throw Errors.invalid('Unknown plan.', [{ path: 'plan_code', message: 'Unknown plan' }]);
      const [taken] = await tx
        .select({ id: tenant.id })
        .from(tenant)
        .where(eq(tenant.handle, body.handle));
      if (taken) throw Errors.conflict(`The handle "${body.handle}" is taken.`);
      let [owner] = await tx.select().from(user).where(eq(user.phoneE164, body.owner.phone));
      if (!owner) {
        [owner] = await tx
          .insert(user)
          .values({
            phoneE164: body.owner.phone,
            fullName: body.owner.full_name,
            email: body.owner.email,
          })
          .onConflictDoNothing()
          .returning();
      }
      if (!owner) throw Errors.conflict('That owner email is already used by another account.');
      const [t] = await tx
        .insert(tenant)
        .values({
          handle: body.handle,
          name: body.name,
          kind: body.kind,
          vertical: body.vertical,
          marketCode: body.market_code,
          timezone: 'Africa/Nairobi',
          currency: 'KES',
          planCode: body.plan_code,
          source: 'invited',
          status: 'onboarding',
        })
        .returning();
      if (!t) throw Errors.conflict('Could not create the House.');
      await tx
        .insert(membership)
        .values({
          tenantId: t.id,
          userId: owner.id,
          role: 'owner',
          status: 'active',
          invitedBy: staff.userId,
        });
      await audit(tx, {
        tenantId: t.id,
        actorUserId: staff.userId,
        actorLabel: 'Stayvinci staff',
        action: 'tenant.created',
        targetType: 'tenant',
        targetId: t.id,
        after: { name: t.name, plan: t.planCode },
        ip: req.ip ?? null,
        requestId: req.requestId,
      });
      await emit(tx, {
        tenantId: t.id,
        type: 'tenant.created',
        aggregateType: 'tenant',
        aggregateId: t.id,
        payload: { source: 'invited' },
      });
      return { t, ownerId: owner.id };
    });
    await this.identity.sendEmailVerification(created.ownerId).catch(() => undefined);
    return out(created.t);
  }
}
