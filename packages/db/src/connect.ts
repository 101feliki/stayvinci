import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema.js';
import type { SqlRunner } from './migrate.js';

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export interface Database {
  /** Drizzle query builder. Use it through withContext() for anything tenant- or user-scoped. */
  db: Db;
  /** Raw runner for migrations and seeds. */
  runner: SqlRunner;
  kind: 'postgres' | 'pglite';
  close(): Promise<void>;
}

/**
 * Opens the database named by DATABASE_URL.
 *  - postgres://user:pass@host:5432/db   real PostgreSQL (production, Docker Compose)
 *  - pglite://memory                      in-memory PGlite (tests)
 *  - pglite://./.data/pglite              file-backed PGlite (local dev without Docker)
 */
export async function connect(url: string): Promise<Database> {
  if (url.startsWith('pglite://')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { btree_gist } = await import('@electric-sql/pglite/contrib/btree_gist');
    const { citext } = await import('@electric-sql/pglite/contrib/citext');
    const { drizzle } = await import('drizzle-orm/pglite');
    const target = url.slice('pglite://'.length);
    const extensions = { btree_gist, citext };
    if (target !== 'memory') {
      const { mkdir } = await import('node:fs/promises');
      const { dirname } = await import('node:path');
      await mkdir(dirname(target), { recursive: true });
    }
    const client =
      target === 'memory'
        ? new PGlite({ extensions })
        : new PGlite({ dataDir: target, extensions });
    await client.waitReady;
    return {
      db: drizzle(client, { schema }) as unknown as Db,
      runner: {
        exec: async (s) => {
          await client.exec(s);
        },
        query: async <T>(s: string, p?: unknown[]) => (await client.query<T>(s, p as never[])).rows,
      },
      kind: 'pglite',
      close: () => client.close(),
    };
  }
  const pg = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pool = new pg.default.Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    // Stop runaway queries and abandoned transactions from holding locks.
    statement_timeout: 10_000,
    idle_in_transaction_session_timeout: 15_000,
  });
  return {
    db: drizzle(pool, { schema }) as unknown as Db,
    runner: {
      exec: async (s) => {
        await pool.query(s);
      },
      query: async <T>(s: string, p?: unknown[]) => (await pool.query(s, p)).rows as T[],
    },
    kind: 'postgres',
    close: () => pool.end(),
  };
}

export type DbRole = 'sv_app' | 'sv_identity' | 'sv_payments' | 'sv_platform';
const ROLES: readonly DbRole[] = ['sv_app', 'sv_identity', 'sv_payments', 'sv_platform'];

export interface RequestContext {
  role: DbRole;
  userId?: string | null;
  tenantId?: string | null;
}

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Runs `fn` in a transaction that has switched to a restricted role and set the request
 * context. Row-level security then limits every query to the tenant and user, even if the
 * code forgets a WHERE clause. Settings are transaction-local, so pooled connections never
 * leak one request's context into the next.
 */
export async function withContext<T>(
  db: Db,
  ctx: RequestContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!ROLES.includes(ctx.role)) throw new Error(`Unknown database role: ${ctx.role}`);
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`set local role ${ctx.role}`));
    await tx.execute(sql`select set_config('app.tenant_id', ${ctx.tenantId ?? ''}, true),
                               set_config('app.user_id', ${ctx.userId ?? ''}, true)`);
    return fn(tx);
  });
}
