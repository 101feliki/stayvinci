#!/usr/bin/env node
// Usage: stayvinci-db migrate | seed | import <file.json>      (reads DATABASE_URL)
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connect } from './connect.js';
import { importStore, type StoreImport } from './import.js';
import { migrate } from './migrate.js';
import { DEV_STAFF_EMAIL, seedDev } from './seed.js';

const [command, file] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
const out = (line: string) => process.stdout.write(`${line}${'\n'}`);
if (!url) {
  console.error('DATABASE_URL is not set. See apps/api/.env.example.');
  process.exit(1);
}
if (!['migrate', 'seed', 'import'].includes(command ?? '') || (command === 'import' && !file)) {
  console.error('Usage: stayvinci-db migrate | seed | import <file.json>');
  process.exit(1);
}

const database = await connect(url);
try {
  const result = await migrate(database.runner);
  out(
    `Migrations applied: ${result.applied.length ? result.applied.join(', ') : 'none (up to date)'}`,
  );
  if (command === 'seed') {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Refusing to seed demo data in production.');
    const seeded = await seedDev(database.db);
    const created = seeded.stores.filter((s) => s.created).length;
    out(
      `Showcase stores: ${seeded.stores.length} (${created} new, ${seeded.stores.length - created} updated)`,
    );
    out(`Console sign-in (email link): ${DEV_STAFF_EMAIL}`);
    out('Store owners sign in by email link at <handle>@owners.stayvinci.test');
  }
  if (command === 'import' && file) {
    const parsed = JSON.parse(
      // Relative paths are read from where you ran pnpm, not from apps/api.
      await readFile(resolve(process.env.INIT_CWD ?? process.cwd(), file), 'utf8'),
    ) as StoreImport | StoreImport[];
    for (const s of Array.isArray(parsed) ? parsed : [parsed]) {
      const r = await importStore(database.db, s);
      out(
        `${r.created ? 'Created' : 'Updated'} ${r.handle}: ${r.team} team, ${r.services} services`,
      );
    }
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await database.close();
}
