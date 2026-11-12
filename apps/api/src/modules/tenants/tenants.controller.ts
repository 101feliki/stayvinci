import { Controller, Get, HttpCode, Inject, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { auditLog, guestProfile, membership, tenant, user } from '@stayvinci/db';
import {
  AuditEntry,
  CursorQuery,
  Guest,
  Member,
  MemberInvite,
  MemberUpdate,
  Tenant,
  TenantUpdate,
  pageOf,
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
import { Data, audit, emit } from '../../database.js';
import { Idempotent, RequireCapability } from '../../security/guards.js';
import { IdentityService } from '../identity/identity.service.js';
import { decodeCursor, encodeCursor } from './cursor.js';

type TenantRow = typeof tenant.$inferSelect;
const tenantOut = (t: TenantRow): z.output<typeof Tenant> => ({
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

const actor = (req: AppRequest) => ({
  tenantId: req.tenant?.id ?? null,
  actorUserId: req.auth?.userId ?? null,
  actorLabel: 'member',
  ip: req.ip ?? null,
  requestId: req.requestId,
});

/**
 * Business endpoints scoped to one House: /v1/tenants/{tenantId}/... (spec §20).
 * The tenant guard has already checked membership; row-level security checks again.
 */
@ApiTags('Houses')
@Controller('v1/tenants/:tenantId')
export class TenantsController {
  constructor(
    @Inject(Data) private readonly data: Data,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Get()
  @RequireCapability('booking.view')
  @ApiOperation({
    summary: 'This House',
    description: 'Profile, plan and status of a House you belong to.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocResponse(200, Tenant, 'The House', [401, 403, 404])
  async get(@Req() req: AppRequest) {
    const [t] = await this.data.inTenant(req, (tx) =>
      tx
        .select()
        .from(tenant)
        .where(eq(tenant.id, req.tenant?.id ?? '')),
    );
    if (!t) throw Errors.notFound('House');
    return tenantOut(t);
  }

  @Patch()
  @RequireCapability('settings.manage')
  @ApiOperation({
    summary: 'Update House settings',
    description: 'Name, time zone and marketplace visibility. Audit-logged.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocBody(TenantUpdate)
  @DocResponse(200, Tenant, 'Updated', [401, 403, 404, 422])
  async update(
    @ValidBody(TenantUpdate) body: z.output<typeof TenantUpdate>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const id = req.tenant?.id ?? '';
      const [before] = await tx.select().from(tenant).where(eq(tenant.id, id));
      const [after] = await tx
        .update(tenant)
        .set({
          ...(body.name ? { name: body.name } : {}),
          ...(body.timezone ? { timezone: body.timezone } : {}),
          ...(body.visibility ? { visibility: body.visibility } : {}),
        })
        .where(eq(tenant.id, id))
        .returning();
      if (!before || !after) throw Errors.notFound('House');
      await audit(tx, {
        ...actor(req),
        action: 'tenant.updated',
        targetType: 'tenant',
        targetId: id,
        before: body,
        after: tenantOut(after),
      });
      await emit(tx, {
        tenantId: id,
        type: 'tenant.updated',
        aggregateType: 'tenant',
        aggregateId: id,
        payload: body,
      });
      return tenantOut(after);
    });
  }

  /* ---------- Team ---------- */

  @Get('members')
  @RequireCapability('staff.manage')
  @ApiOperation({
    summary: 'Team members',
    description: 'Everyone in this House with their role and permission changes.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocResponse(200, z.array(Member), 'Team', [401, 403, 404])
  async members(@Req() req: AppRequest): Promise<z.output<typeof Member>[]> {
    const rows = await this.data.inTenant(req, (tx) =>
      tx
        .select({ m: membership, name: user.fullName })
        .from(membership)
        .innerJoin(user, eq(user.id, membership.userId))
        .where(eq(membership.tenantId, req.tenant?.id ?? ''))
        .orderBy(membership.createdAt),
    );
    return rows.map(({ m, name }) => ({
      id: m.id,
      user_id: m.userId,
      full_name: name,
      role: m.role,
      caps_added: m.capsAdded,
      caps_removed: m.capsRemoved,
      status: m.status,
      created_at: m.createdAt,
    }));
  }

  @Post('members')
  @RequireCapability('staff.manage')
  @Idempotent()
  @ApiOperation({
    summary: 'Invite a team member',
    description:
      'Invites by phone number. They accept after signing in. Owners can only be added by Stayvinci.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocBody(MemberInvite)
  @DocResponse(201, Member, 'Invited', [400, 401, 403, 404, 409, 422])
  async invite(
    @ValidBody(MemberInvite) body: z.output<typeof MemberInvite>,
    @Req() req: AppRequest,
  ) {
    // Find or create the person (identity role), then add them to this House (tenant role).
    const person = await this.data.identity(async (tx) => {
      const [existing] = await tx.select().from(user).where(eq(user.phoneE164, body.phone));
      if (existing) return existing;
      const [created] = await tx
        .insert(user)
        .values({
          phoneE164: body.phone,
          fullName: body.full_name,
          ...(body.email ? { email: body.email } : {}),
        })
        .onConflictDoNothing()
        .returning();
      if (created) return created;
      throw Errors.conflict('That email is already used by another account.');
    });
    return this.data.inTenant(req, async (tx) => {
      const id = req.tenant?.id ?? '';
      const [m] = await tx
        .insert(membership)
        .values({
          tenantId: id,
          userId: person.id,
          role: body.role,
          status: 'invited',
          invitedBy: req.auth?.userId ?? null,
        })
        .onConflictDoNothing()
        .returning();
      if (!m) throw Errors.conflict('This person is already in the team.');
      await audit(tx, {
        ...actor(req),
        action: 'membership.invited',
        targetType: 'membership',
        targetId: m.id,
        after: { role: m.role },
      });
      await emit(tx, {
        tenantId: id,
        type: 'membership.invited',
        aggregateType: 'membership',
        aggregateId: m.id,
        payload: { role: m.role },
      });
      return {
        id: m.id,
        user_id: m.userId,
        full_name: person.fullName,
        role: m.role,
        caps_added: m.capsAdded,
        caps_removed: m.capsRemoved,
        status: m.status,
        created_at: m.createdAt,
      };
    });
  }

  @Patch('members/:memberId')
  @RequireCapability('staff.manage')
  @ApiOperation({
    summary: 'Change a team member',
    description:
      "Role, per-person permission changes, or suspend. Changes sign the person out so new permissions apply at once. You can't change your own role, and a House always keeps an owner.",
  })
  @DocUuidParam('tenantId', 'House id')
  @DocUuidParam('memberId', 'Membership id')
  @DocBody(MemberUpdate)
  @DocResponse(200, Member, 'Updated', [401, 403, 404, 422])
  async updateMember(
    @UuidPath('memberId') memberId: string,
    @ValidBody(MemberUpdate) body: z.output<typeof MemberUpdate>,
    @Req() req: AppRequest,
  ) {
    const result = await this.data.inTenant(req, async (tx) => {
      const id = req.tenant?.id ?? '';
      const [m] = await tx
        .select()
        .from(membership)
        .where(and(eq(membership.id, memberId), eq(membership.tenantId, id)));
      if (!m) throw Errors.notFound('Team member');
      if (m.userId === req.auth?.userId && (body.role || body.status))
        throw Errors.forbidden("You can't change your own role.");
      const touchesOwner = m.role === 'owner' || body.role === 'owner';
      if (touchesOwner && req.tenant?.role !== 'owner')
        throw Errors.forbidden('Only an owner can change owners.');
      if (
        m.role === 'owner' &&
        ((body.role && body.role !== 'owner') || body.status === 'suspended')
      ) {
        const [owners] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(membership)
          .where(
            and(
              eq(membership.tenantId, id),
              eq(membership.role, 'owner'),
              eq(membership.status, 'active'),
            ),
          );
        if ((owners?.n ?? 0) <= 1) throw Errors.forbidden('A House must keep at least one owner.');
      }
      const [after] = await tx
        .update(membership)
        .set({
          ...(body.role ? { role: body.role } : {}),
          ...(body.caps_added ? { capsAdded: body.caps_added } : {}),
          ...(body.caps_removed ? { capsRemoved: body.caps_removed } : {}),
          ...(body.status ? { status: body.status } : {}),
        })
        .where(eq(membership.id, memberId))
        .returning();
      if (!after) throw Errors.notFound('Team member');
      await audit(tx, {
        ...actor(req),
        action: 'membership.changed',
        targetType: 'membership',
        targetId: memberId,
        before: {
          role: m.role,
          caps_added: m.capsAdded,
          caps_removed: m.capsRemoved,
          status: m.status,
        },
        after: body,
      });
      const [name] = await tx
        .select({ n: user.fullName })
        .from(user)
        .where(eq(user.id, after.userId));
      return {
        id: after.id,
        user_id: after.userId,
        full_name: name?.n ?? null,
        role: after.role,
        caps_added: after.capsAdded,
        caps_removed: after.capsRemoved,
        status: after.status,
        created_at: after.createdAt,
      };
    });
    // Role and access changes end the person's sessions (spec §18).
    await this.identity.revokeAll(result.user_id);
    return result;
  }

  /* ---------- Guests ---------- */

  @Get('guests')
  @RequireCapability('guest.view')
  @ApiOperation({
    summary: 'Guests of this House',
    description:
      'Phone and email are included ONLY for callers with guest.contact.view (owner by default). Everyone else gets the same list without contact fields.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocQuery(CursorQuery)
  @DocResponse(200, pageOf(Guest), 'A page of guests', [401, 403, 404, 422])
  async guests(@ValidQuery(CursorQuery) q: z.output<typeof CursorQuery>, @Req() req: AppRequest) {
    const canSeeContact = req.tenant?.capabilities.has('guest.contact.view') ?? false;
    const cursor = decodeCursor(q.cursor);
    const rows = await this.data.inTenant(req, (tx) =>
      tx
        .select({ g: guestProfile, name: user.fullName, phone: user.phoneE164, email: user.email })
        .from(guestProfile)
        .innerJoin(user, eq(user.id, guestProfile.userId))
        .where(
          and(
            eq(guestProfile.tenantId, req.tenant?.id ?? ''),
            cursor
              ? or(
                  lt(guestProfile.createdAt, cursor.t),
                  and(eq(guestProfile.createdAt, cursor.t), lt(guestProfile.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(guestProfile.createdAt), desc(guestProfile.id))
        .limit(q.limit + 1),
    );
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return {
      items: page.map(({ g, name, phone, email }) => ({
        id: g.id,
        display_name: g.alias ?? name ?? 'Guest',
        first_touch_source: g.firstTouchSource,
        tags: g.tags,
        // Field-level omission (CLAUDE.md rule 5): absent, not blanked.
        ...(canSeeContact && phone ? { phone } : {}),
        ...(canSeeContact && email ? { email } : {}),
      })),
      next_cursor:
        rows.length > q.limit && last ? encodeCursor({ t: last.g.createdAt, id: last.g.id }) : null,
    };
  }

  /* ---------- Audit ---------- */

  @Get('audit')
  @RequireCapability('audit.view')
  @ApiOperation({
    summary: 'Activity log',
    description: 'Every privileged change in this House, newest first.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocQuery(CursorQuery)
  @DocResponse(200, pageOf(AuditEntry), 'A page of entries', [401, 403, 404, 422])
  async audit(@ValidQuery(CursorQuery) q: z.output<typeof CursorQuery>, @Req() req: AppRequest) {
    const before = q.cursor && /^\d{1,18}$/.test(q.cursor) ? Number(q.cursor) : null;
    const rows = await this.data.inTenant(req, (tx) =>
      tx
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.tenantId, req.tenant?.id ?? ''),
            before ? lt(auditLog.id, before) : undefined,
          ),
        )
        .orderBy(desc(auditLog.id))
        .limit(q.limit + 1),
    );
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((a) => ({
        id: a.id,
        actor: a.actorLabel,
        action: a.action,
        target_type: a.targetType,
        target_id: a.targetId,
        occurred_at: a.occurredAt,
      })),
      next_cursor: rows.length > q.limit ? String(page[page.length - 1]?.id ?? '') : null,
    };
  }
}

export { HttpCode };
