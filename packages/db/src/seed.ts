import { eq } from 'drizzle-orm';
import { withContext, type Db } from './connect.js';
import { membership, tenant, user } from './schema.js';

export interface SeedResult {
  tenantId: string;
  ownerId: string;
  staffId: string;
}

/**
 * Development seed: one House (Serenity), its owner, and a Stayvinci super admin.
 * Runs as the platform role, so it goes through the same row-level security as the app.
 * Contains no secrets: people sign in with an SMS code or email link in development.
 */
export async function seedDev(db: Db): Promise<SeedResult> {
  return withContext(db, { role: 'sv_platform' }, async (tx) => {
    const existing = await tx
      .select({ id: tenant.id })
      .from(tenant)
      .where(eq(tenant.handle, 'serenity'));
    const [owner] = await tx
      .insert(user)
      .values({
        phoneE164: '+254712345678',
        email: 'amani@serenity.example',
        fullName: 'Amani Mwangi',
      })
      .onConflictDoNothing()
      .returning({ id: user.id });
    const [staff] = await tx
      .insert(user)
      .values({
        phoneE164: '+254700000001',
        email: 'felix@stayvinci.com',
        fullName: 'Felix Kariuki',
        platformRole: 'super_admin',
      })
      .onConflictDoNothing()
      .returning({ id: user.id });
    if (existing[0] || !owner || !staff) {
      const [o] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.phoneE164, '+254712345678'));
      const [s] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, 'felix@stayvinci.com'));
      return { tenantId: existing[0]?.id ?? '', ownerId: o?.id ?? '', staffId: s?.id ?? '' };
    }
    const [t] = await tx
      .insert(tenant)
      .values({
        handle: 'serenity',
        name: 'Serenity Spa & Wellness',
        kind: 'house',
        vertical: 'spa',
        marketCode: 'KE',
        timezone: 'Africa/Nairobi',
        currency: 'KES',
        status: 'live',
        planCode: 'signature',
        source: 'invited',
      })
      .returning({ id: tenant.id });
    if (!t) throw new Error('Seeding the tenant failed');
    await tx
      .insert(membership)
      .values({ tenantId: t.id, userId: owner.id, role: 'owner', status: 'active' });
    return { tenantId: t.id, ownerId: owner.id, staffId: staff.id };
  });
}
