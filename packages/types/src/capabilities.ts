// Roles and capabilities (spec §1). Shared by the API (enforcement) and the apps (hiding
// controls). guest.contact.view and guest.export are Owner-only by default: the
// anti-poaching guarantee.

export const CAPABILITIES = [
  'booking.view',
  'booking.create',
  'booking.edit',
  'booking.approve',
  'guest.view',
  'guest.contact.view',
  'guest.import',
  'guest.export',
  'message.reply',
  'catalogue.edit',
  'staff.manage',
  'storefront.edit',
  'content.edit',
  'access.manage',
  'policy.edit',
  'payment_account.manage',
  'payment.view',
  'payment.refund',
  'report.view',
  'report.financial.view',
  'marketing.manage',
  'review.reply',
  'compliance.view',
  'billing.manage',
  'settings.manage',
  'audit.view',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const TENANT_ROLES = [
  'owner',
  'manager',
  'front_desk',
  'practitioner',
  'content_editor',
  'accountant',
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export const ROLE_BUNDLES: Record<TenantRole, readonly Capability[]> = {
  owner: CAPABILITIES,
  manager: [
    'booking.view',
    'booking.create',
    'booking.edit',
    'booking.approve',
    'guest.view',
    'guest.import',
    'message.reply',
    'catalogue.edit',
    'staff.manage',
    'storefront.edit',
    'content.edit',
    'access.manage',
    'policy.edit',
    'payment.view',
    'payment.refund',
    'report.view',
    'report.financial.view',
    'marketing.manage',
    'review.reply',
    'compliance.view',
    'audit.view',
  ],
  front_desk: [
    'booking.view',
    'booking.create',
    'booking.edit',
    'guest.view',
    'message.reply',
    'payment.view',
  ],
  practitioner: ['booking.view'],
  content_editor: ['storefront.edit', 'content.edit', 'review.reply'],
  accountant: ['payment.view', 'report.view', 'report.financial.view'],
};

/** Role bundle plus per-person additions, minus removals. */
export function effectiveCapabilities(
  role: TenantRole,
  added: readonly string[] = [],
  removed: readonly string[] = [],
): Set<Capability> {
  const caps = new Set<Capability>(ROLE_BUNDLES[role]);
  for (const c of added)
    if ((CAPABILITIES as readonly string[]).includes(c)) caps.add(c as Capability);
  for (const c of removed) caps.delete(c as Capability);
  return caps;
}

export const PLATFORM_ROLES = ['super_admin', 'admin', 'finance', 'marketing'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];
