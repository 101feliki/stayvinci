import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { auditLog, outboxEvent, withContext, type Database, type Tx } from '@stayvinci/db';
import { DATABASE, type AppRequest, type AuthContext, Errors } from './common/http.js';

/**
 * The only way the API touches the database. Each helper opens a transaction in a
 * restricted role with the caller's context set, so row-level security applies to every
 * query and a forgotten WHERE clause can't leak another House's data.
 */
@Injectable()
export class Data {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  get raw() {
    return this.database;
  }

  /** Inside one House (tenant routes). Requires the tenant guard to have run. */
  inTenant<T>(req: AppRequest, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (!req.auth || !req.tenant) throw Errors.forbidden();
    return withContext(
      this.database.db,
      { role: 'sv_app', userId: req.auth.userId, tenantId: req.tenant.id },
      fn,
    );
  }

  /** As the signed-in person, outside any House (their own profile and memberships). */
  asUser<T>(auth: AuthContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return withContext(this.database.db, { role: 'sv_app', userId: auth.userId }, fn);
  }

  /** Sign-in and sessions: can find people by phone or email, nothing else. */
  identity<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return withContext(this.database.db, { role: 'sv_identity' }, fn);
  }

  /**
   * Guests browsing stores (signed in or not): only live, published stores, only public
   * columns. A private store becomes visible when the guest supplies its access code.
   */
  publicStore<T>(accessCode: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return withContext(this.database.db, { role: 'sv_public', accessCode }, fn);
  }

  /** A guest acting inside one store they are visiting (their booking, their profile). */
  asGuestIn<T>(userId: string, tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return withContext(this.database.db, { role: 'sv_app', userId, tenantId }, fn);
  }

  /** Stayvinci staff and system jobs. Callers must audit what they do. */
  platform<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return withContext(this.database.db, { role: 'sv_platform' }, fn);
  }
}

export interface AuditInput {
  tenantId: string | null;
  actorUserId: string | null;
  actorLabel: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  requestId?: string;
}

/** Writes an audit entry in the caller's transaction (CLAUDE.md rule 9). */
export async function audit(tx: Tx, a: AuditInput): Promise<void> {
  await tx.insert(auditLog).values({
    tenantId: a.tenantId,
    actorUserId: a.actorUserId,
    actorLabel: a.actorLabel,
    action: a.action,
    targetType: a.targetType ?? null,
    targetId: a.targetId ?? null,
    before: a.before ?? null,
    after: a.after ?? null,
    ip: a.ip ?? null,
    requestId: a.requestId ?? null,
  });
}

/** Records a domain event in the same transaction as the change (outbox pattern, spec §20). */
export async function emit(
  tx: Tx,
  e: {
    tenantId: string | null;
    type: string;
    aggregateType: string;
    aggregateId: string;
    payload: unknown;
  },
): Promise<void> {
  await tx.insert(outboxEvent).values({
    tenantId: e.tenantId,
    type: e.type,
    aggregateType: e.aggregateType,
    aggregateId: e.aggregateId,
    payload: e.payload,
  });
}

export { and, eq };
