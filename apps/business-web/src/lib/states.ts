import type { BadgeTone } from '@stayvinci/ui';
import type { BookingState, ItemVisibility, PaymentStatus, ProviderState } from '../mock/types';

export const BOOKING_STATE: Record<
  BookingState,
  { label: string; tone: BadgeTone; block: string }
> = {
  held: { label: 'Held', tone: 'neutral', block: 'bg-stone-100 border-stone-300 text-stone-700' },
  pending_payment: {
    label: 'Awaiting payment',
    tone: 'amber',
    block: 'bg-amber-50 border-amber-300 text-amber-900',
  },
  requested: {
    label: 'Requested',
    tone: 'azure',
    block: 'bg-azure-50 border-azure-300 text-azure-800',
  },
  confirmed: {
    label: 'Confirmed',
    tone: 'emerald',
    block: 'bg-emerald-100 border-emerald-500 text-emerald-900',
  },
  checked_in: {
    label: 'Checked in',
    tone: 'gold',
    block: 'bg-gold-50 border-gold-300 text-gold-800',
  },
  completed: {
    label: 'Completed',
    tone: 'dark',
    block: 'bg-stone-50 border-stone-300 text-stone-600',
  },
  cancelled_by_guest: {
    label: 'Cancelled by guest',
    tone: 'red',
    block: 'bg-red-50/60 border-red-200 text-red-700 line-through',
  },
  cancelled_by_tenant: {
    label: 'Cancelled by you',
    tone: 'red',
    block: 'bg-red-50/60 border-red-200 text-red-700 line-through',
  },
  no_show: { label: 'No-show', tone: 'red', block: 'bg-red-50 border-red-300 text-red-800' },
  disputed: { label: 'Disputed', tone: 'plum', block: 'bg-plum-50 border-plum-100 text-plum-700' },
};

/** Allowed staff-initiated transitions (spec §10.3–10.4). */
export const TRANSITIONS: Partial<Record<BookingState, BookingState[]>> = {
  pending_payment: ['confirmed', 'cancelled_by_tenant'],
  requested: ['confirmed', 'cancelled_by_tenant'],
  confirmed: ['checked_in', 'no_show', 'cancelled_by_tenant'],
  checked_in: ['completed'],
};

export const ACTIVE_STATES: BookingState[] = [
  'held',
  'pending_payment',
  'requested',
  'confirmed',
  'checked_in',
];

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'amber' },
  succeeded: { label: 'Succeeded', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'red' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'plum' },
  partially_refunded: { label: 'Part refunded', tone: 'plum' },
};

export const PROVIDER_STATE: Record<ProviderState, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  testing: { label: 'Testing', tone: 'amber' },
  verified: { label: 'Verified', tone: 'emerald' },
  disabled: { label: 'Disabled', tone: 'neutral' },
  failing: { label: 'Failing', tone: 'red' },
};

export const VISIBILITY: Record<ItemVisibility, { label: string; tone: BadgeTone }> = {
  public: { label: 'Public', tone: 'emerald' },
  members_only: { label: 'Members only', tone: 'plum' },
  invite_only: { label: 'Invite only', tone: 'azure' },
  hidden: { label: 'Hidden', tone: 'neutral' },
};
