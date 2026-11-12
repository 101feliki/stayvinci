import { eq } from 'drizzle-orm';
import { withContext, type Db } from './connect.js';
import { importStore, type ImportResult } from './import.js';
import { user } from './schema.js';
import { showcaseStores } from './showcase.js';

export interface SeedResult {
  staffId: string;
  stores: ImportResult[];
}

/** The Stayvinci super admin used to sign in to the console in development. */
export const DEV_STAFF_EMAIL = 'felix@stayvinci.com';

/**
 * Development and demo seed: the showcase stores (10 client spas, 20 Ateliers) and one
 * Stayvinci super admin. Runs through the platform role, so row-level security applies.
 * Contains no secrets: everyone signs in with an email link.
 */
export async function seedDev(db: Db): Promise<SeedResult> {
  const staffId = await withContext(db, { role: 'sv_platform' }, async (tx) => {
    await tx
      .insert(user)
      .values({ email: DEV_STAFF_EMAIL, fullName: 'Felix Kariuki', platformRole: 'super_admin' })
      .onConflictDoNothing();
    const [s] = await tx.select({ id: user.id }).from(user).where(eq(user.email, DEV_STAFF_EMAIL));
    return s?.id ?? '';
  });
  const stores: ImportResult[] = [];
  for (const s of showcaseStores()) stores.push(await importStore(db, s));
  return { staffId, stores };
}
