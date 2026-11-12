import type { Capability, TeamMember, TenantRole } from '../mock/types';

// Role bundles from spec §1. Owners can add or remove single capabilities per person.
// guest.contact.view and guest.export are Owner-only by default (anti-poaching guarantee).
const ALL: Capability[] = [
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
];

export const ROLE_BUNDLES: Record<TenantRole, Capability[]> = {
  owner: ALL,
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

export const ROLE_LABELS: Record<TenantRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  front_desk: 'Front desk',
  practitioner: 'Practitioner',
  content_editor: 'Content editor',
  accountant: 'Accountant',
};

export const CAPABILITY_GROUPS: { label: string; items: { cap: Capability; label: string }[] }[] = [
  {
    label: 'Bookings',
    items: [
      { cap: 'booking.view', label: 'View bookings' },
      { cap: 'booking.create', label: 'Create bookings' },
      { cap: 'booking.edit', label: 'Move, cancel, check in' },
      { cap: 'booking.approve', label: 'Approve requests' },
    ],
  },
  {
    label: 'Guests',
    items: [
      { cap: 'guest.view', label: 'View guest profiles' },
      { cap: 'guest.contact.view', label: 'See phone and email' },
      { cap: 'guest.import', label: 'Import guests' },
      { cap: 'guest.export', label: 'Export guest data' },
      { cap: 'message.reply', label: 'Reply to messages' },
    ],
  },
  {
    label: 'Store',
    items: [
      { cap: 'catalogue.edit', label: 'Edit catalogue' },
      { cap: 'staff.manage', label: 'Manage team and resources' },
      { cap: 'storefront.edit', label: 'Edit storefront' },
      { cap: 'content.edit', label: 'Manage content' },
      { cap: 'access.manage', label: 'Manage access codes' },
      { cap: 'policy.edit', label: 'Edit policies' },
    ],
  },
  {
    label: 'Money',
    items: [
      { cap: 'payment.view', label: 'View payments' },
      { cap: 'payment.refund', label: 'Issue refunds' },
      { cap: 'payment_account.manage', label: 'Manage payment accounts' },
      { cap: 'report.view', label: 'View reports' },
      { cap: 'report.financial.view', label: 'View financial reports' },
      { cap: 'billing.manage', label: 'Manage Stayvinci billing' },
    ],
  },
  {
    label: 'Other',
    items: [
      { cap: 'marketing.manage', label: 'Run campaigns' },
      { cap: 'review.reply', label: 'Reply to reviews' },
      { cap: 'compliance.view', label: 'View compliance records' },
      { cap: 'settings.manage', label: 'Manage settings' },
      { cap: 'audit.view', label: 'View audit log' },
    ],
  },
];

export function effectiveCapabilities(
  member: Pick<TeamMember, 'role' | 'added' | 'removed'>,
): Set<Capability> {
  const set = new Set<Capability>(ROLE_BUNDLES[member.role]);
  for (const c of member.added) set.add(c);
  for (const c of member.removed) set.delete(c);
  return set;
}
