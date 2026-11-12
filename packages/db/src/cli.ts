#!/usr/bin/env node
// Usage: stayvinci-db migrate | seed      (reads DATABASE_URL)
import { connect } from './connect.js';
import { migrate } from './migrate.js';
import { seedDev } from './seed.js';

const command = process.argv[2];
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. See infra/.env.example.');
  process.exit(1);
}
if (command !== 'migrate' && command !== 'seed') {
  console.error('Usage: stayvinci-db migrate | seed');
  process.exit(1);
}

const database = await connect(url);
try {
  const result = await migrate(database.runner);
  const applied = result.applied.length ? result.applied.join(', ') : 'none (up to date)';
  process.stdout.write(`Migrations applied: ${applied}${'\n'}`);
  if (command === 'seed') {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Refusing to seed demo data in production.');
    const seeded = await seedDev(database.db);
    process.stdout.write(`Seeded demo House ${seeded.tenantId}${'\n'}`);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await database.close();
}
