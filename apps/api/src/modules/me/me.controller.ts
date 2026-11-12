import { Controller, Get, HttpCode, Inject, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, eq, sql } from 'drizzle-orm';
import { membership, tenant, user } from '@stayvinci/db';
import { Me, MeUpdate, MyTenant, effectiveCapabilities } from '@stayvinci/types';
import { z } from 'zod';
import { Errors, type AppRequest } from '../../common/http.js';
import {
  DocBody,
  DocResponse,
  DocUuidParam,
  UuidPath,
  ValidBody,
} from '../../common/validation.js';
import { Data, audit } from '../../database.js';
import { IdentityService } from '../identity/identity.service.js';

@ApiTags('Me')
@ApiBearerAuth('access-token')
@Controller('v1/me')
export class MeController {
  constructor(
    @Inject(Data) private readonly data: Data,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'My account',
    description: 'Your own details, including your own phone and email.',
  })
  @DocResponse(200, Me, 'Your account', [401])
  async get(@Req() req: AppRequest): Promise<z.output<typeof Me>> {
    if (!req.auth) throw Errors.unauthorized();
    const [u] = await this.data.asUser(req.auth, (tx) =>
      tx
        .select()
        .from(user)
        .where(eq(user.id, req.auth?.userId ?? '')),
    );
    if (!u) throw Errors.unauthorized();
    return {
      id: u.id,
      full_name: u.fullName,
      phone: u.phoneE164,
      email: u.email,
      email_verified: !!u.emailVerifiedAt,
      two_factor_enabled: !!u.totpEnabledAt,
      platform_role: u.platformRole,
    };
  }

  @Patch()
  @ApiOperation({
    summary: 'Update my name or email',
    description: 'Changing the email sends a new activation link.',
  })
  @DocBody(MeUpdate)
  @DocResponse(200, Me, 'Updated', [401, 409, 422])
  async update(@ValidBody(MeUpdate) body: z.output<typeof MeUpdate>, @Req() req: AppRequest) {
    const auth = req.auth;
    if (!auth) throw Errors.unauthorized();
    if (body.full_name) {
      await this.data.asUser(auth, (tx) =>
        tx
          .update(user)
          .set({ fullName: body.full_name ?? null })
          .where(eq(user.id, auth.userId)),
      );
    }
    if (body.email) {
      const taken = await this.data.identity((tx) =>
        tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, body.email ?? '')),
      );
      if (taken.some((t) => t.id !== auth.userId))
        throw Errors.conflict('That email is already used by another account.');
      await this.data.identity(async (tx) => {
        await tx
          .update(user)
          .set({ email: body.email ?? null, emailVerifiedAt: null })
          .where(eq(user.id, auth.userId));
        await audit(tx, {
          tenantId: null,
          actorUserId: auth.userId,
          actorLabel: 'self',
          action: 'user.email_changed',
        });
      });
      await this.identity.sendEmailVerification(auth.userId);
    }
    return this.get(req);
  }

  @Get('tenants')
  @ApiOperation({
    summary: 'My Houses',
    description: 'Houses and Ateliers I work in, with my role and the capabilities it gives me.',
  })
  @DocResponse(200, z.array(MyTenant), 'My memberships', [401])
  async tenants(@Req() req: AppRequest): Promise<z.output<typeof MyTenant>[]> {
    if (!req.auth) throw Errors.unauthorized();
    const rows = await this.data.asUser(req.auth, (tx) =>
      tx
        .select({ m: membership, t: tenant })
        .from(membership)
        .innerJoin(tenant, eq(tenant.id, membership.tenantId))
        .where(and(eq(membership.userId, req.auth?.userId ?? ''), eq(membership.status, 'active'))),
    );
    return rows.map(({ m, t }) => ({
      tenant_id: t.id,
      name: t.name,
      handle: t.handle,
      kind: t.kind,
      role: m.role,
      capabilities: [...effectiveCapabilities(m.role, m.capsAdded, m.capsRemoved)],
    }));
  }

  @Post('memberships/:membershipId/accept')
  @HttpCode(204)
  @ApiOperation({ summary: 'Accept an invitation to join a team' })
  @DocUuidParam('membershipId', 'The invitation (membership) id')
  @DocResponse(204, null, 'Joined', [401, 404])
  async accept(@UuidPath('membershipId') membershipId: string, @Req() req: AppRequest) {
    const auth = req.auth;
    if (!auth) throw Errors.unauthorized();
    const [invite] = await this.data.asUser(auth, (tx) =>
      tx
        .select()
        .from(membership)
        .where(
          and(
            eq(membership.id, membershipId),
            eq(membership.userId, auth.userId),
            eq(membership.status, 'invited'),
          ),
        ),
    );
    if (!invite) throw Errors.notFound('Invitation');
    await this.data.inTenant(
      {
        ...req,
        tenant: { id: invite.tenantId, role: invite.role, capabilities: new Set() },
      } as AppRequest,
      async (tx) => {
        await tx
          .update(membership)
          .set({ status: 'active', updatedAt: sql`now()` as never })
          .where(and(eq(membership.id, invite.id), eq(membership.userId, auth.userId)));
        await audit(tx, {
          tenantId: invite.tenantId,
          actorUserId: auth.userId,
          actorLabel: 'self',
          action: 'membership.accepted',
          targetType: 'membership',
          targetId: invite.id,
        });
      },
    );
  }
}
