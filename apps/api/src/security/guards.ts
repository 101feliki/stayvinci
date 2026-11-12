import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { and, eq, isNull } from 'drizzle-orm';
import { membership, session, withContext, type Database } from '@stayvinci/db';
import { effectiveCapabilities, type Capability, type PlatformRole } from '@stayvinci/types';
import type { Config } from '../config.js';
import { CONFIG, DATABASE, Errors, type AppRequest } from '../common/http.js';
import { verifyAccessToken } from './tokens.js';

const PUBLIC = 'sv:public';
const CAPABILITY = 'sv:capability';
const PLATFORM = 'sv:platform';
const IDEMPOTENT = 'sv:idempotent';

/** No sign-in needed (health, sign-in endpoints). Everything else requires a token. */
export const Public = () => SetMetadata(PUBLIC, true);

/** Requires a capability inside the House named by :tenantId (spec §1). */
export const RequireCapability = (cap: Capability) =>
  applyDecorators(SetMetadata(CAPABILITY, cap), ApiBearerAuth('access-token'));

/** Stayvinci staff only, with one of these roles, signed in to the console with 2FA. */
export const PlatformRoles = (...roles: PlatformRole[]) =>
  applyDecorators(SetMetadata(PLATFORM, roles), ApiBearerAuth('access-token'));

/** POST that creates bookings or moves money: requires an Idempotency-Key header (rule 4). */
export const Idempotent = () =>
  applyDecorators(
    SetMetadata(IDEMPOTENT, true),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      description:
        'Unique per logical request (8–128 chars). Retries with the same key return the first response.',
    }),
  );

export const isIdempotent = (reflector: Reflector, ctx: ExecutionContext) =>
  reflector.getAllAndOverride<boolean>(IDEMPOTENT, [ctx.getHandler(), ctx.getClass()]) === true;

/** 1. Verifies the bearer token and that its session is still live. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(DATABASE) private readonly database: Database,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()]))
      return true;
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const auth = token ? await verifyAccessToken(this.config.jwtSecret, token) : null;
    if (!auth) throw Errors.unauthorized();
    // Revocation is immediate: sign-out, password reset and role changes end sessions.
    const live = await withContext(this.database.db, { role: 'sv_identity' }, (tx) =>
      tx
        .select({ id: session.id })
        .from(session)
        .where(
          and(
            eq(session.id, auth.sessionId),
            eq(session.userId, auth.userId),
            isNull(session.revokedAt),
          ),
        ),
    );
    if (!live.length) throw Errors.unauthorized('Your session has ended. Sign in again.');
    req.auth = auth;
    return true;
  }
}

/** 2. For /tenants/:tenantId routes: the caller must be an active member of that House. */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const raw = req.params.tenantId as string | string[] | undefined;
    if (raw === undefined || !req.auth) return true;
    const tenantId = Array.isArray(raw) ? (raw[0] ?? '') : raw;
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw Errors.notFound('House');
    if (req.auth.audience !== 'business') throw Errors.forbidden('Use the business app for this.');
    const [m] = await withContext(
      this.database.db,
      { role: 'sv_app', userId: req.auth.userId, tenantId },
      (tx) =>
        tx
          .select()
          .from(membership)
          .where(
            and(
              eq(membership.tenantId, tenantId),
              eq(membership.userId, req.auth?.userId ?? ''),
              eq(membership.status, 'active'),
            ),
          ),
    );
    // Not a member looks exactly like "doesn't exist": no hints that a House is there.
    if (!m) throw Errors.notFound('House');
    if (m.role === 'owner' && !req.auth.secondFactor) throw Errors.secondFactor();
    req.tenant = {
      id: tenantId,
      role: m.role,
      capabilities: effectiveCapabilities(m.role, m.capsAdded, m.capsRemoved),
    };
    return true;
  }
}

/** 3. Capability inside the House. */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const cap = this.reflector.getAllAndOverride<Capability | undefined>(CAPABILITY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!cap) return true;
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (!req.tenant?.capabilities.has(cap))
      throw Errors.forbidden(`You need the "${cap}" permission for this.`);
    return true;
  }
}

/** 4. Platform (console) routes. */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<PlatformRole[] | undefined>(PLATFORM, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles) return true;
    const auth = ctx.switchToHttp().getRequest<AppRequest>().auth;
    if (!auth || auth.audience !== 'console' || !auth.platformRole) throw Errors.notFound();
    if (!auth.secondFactor) throw Errors.secondFactor();
    if (!roles.includes(auth.platformRole)) throw Errors.forbidden();
    return true;
  }
}
