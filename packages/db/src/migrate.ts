import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Minimal surface both node-postgres and PGlite provide. */
export interface SqlRunner {
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Applies SQL files from migrations/ in name order, each in its own transaction, and records
 * a checksum. A migration that was edited after being applied stops the run: fix forward
 * with a new file instead of rewriting history.
 */
export async function migrate(db: SqlRunner, dir = MIGRATIONS_DIR): Promise<MigrationResult> {
  await db.exec(`create table if not exists schema_migration (
    version    text primary key,
    checksum   text not null,
    applied_at timestamptz not null default now()
  )`);
  const done = new Map(
    (
      await db.query<{ version: string; checksum: string }>(
        'select version, checksum from schema_migration',
      )
    ).map((r) => [r.version, r.checksum]),
  );
  const files = (await readdir(dir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  const result: MigrationResult = { applied: [], skipped: [] };
  for (const file of files) {
    const sql = await readFile(new URL(file, `file://${dir.replace(/\\/g, '/')}/`), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const known = done.get(file);
    if (known) {
      if (known !== checksum)
        throw new Error(
          `Migration ${file} changed after it was applied. Add a new migration instead.`,
        );
      result.skipped.push(file);
      continue;
    }
    await db.exec('begin');
    try {
      await db.exec(sql);
      await db.query('insert into schema_migration (version, checksum) values ($1, $2)', [
        file,
        checksum,
      ]);
      await db.exec('commit');
      result.applied.push(file);
    } catch (e) {
      await db.exec('rollback');
      throw new Error(`Migration ${file} failed: ${e instanceof Error ? e.message : String(e)}`, {
        cause: e,
      });
    }
  }
  return result;
}
