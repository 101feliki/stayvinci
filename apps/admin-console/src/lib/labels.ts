import type { BadgeTone } from '@stayvinci/ui';
import type { FeatureStage, PlanId, TxnStatus } from '@stayvinci/demo-data/platform';
import type { ProviderState, TenantStatus } from '@stayvinci/demo-data/types';

export const TENANT_STATUS: Record<TenantStatus, { label: string; tone: BadgeTone; hint: string }> =
  {
    draft: { label: 'Invited', tone: 'neutral', hint: 'Invite sent; owner has not signed in yet' },
    onboarding: { label: 'Onboarding', tone: 'azure', hint: 'Signed up, setting up the store' },
    verification: {
      label: 'Verification',
      tone: 'plum',
      hint: 'Documents submitted, awaiting review',
    },
    setup: { label: 'Ready', tone: 'gold', hint: 'Verified and set up, not yet published' },
    live: { label: 'Live', tone: 'emerald', hint: 'Taking bookings' },
    past_due: { label: 'Past due', tone: 'amber', hint: 'Subscription unpaid, in grace period' },
    suspended: { label: 'Suspended', tone: 'red', hint: 'Store unavailable to guests' },
  };

/** Order used by the onboarding board and status pickers. */
export const STATUS_ORDER: TenantStatus[] = [
  'draft',
  'onboarding',
  'verification',
  'setup',
  'live',
  'past_due',
  'suspended',
];

export const PLAN_LABEL: Record<PlanId, string> = {
  solo: 'Solo',
  business: 'Business',
  signature: 'Signature',
};

export const TXN_STATUS: Record<TxnStatus, { label: string; tone: BadgeTone }> = {
  succeeded: { label: 'Paid', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'red' },
  pending: { label: 'Waiting', tone: 'azure' },
  expired: { label: 'Expired', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'plum' },
};

export const PROVIDER_STATE: Record<ProviderState, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Not connected', tone: 'neutral' },
  testing: { label: 'Testing', tone: 'azure' },
  verified: { label: 'Working', tone: 'emerald' },
  disabled: { label: 'Disabled', tone: 'neutral' },
  failing: { label: 'Failing', tone: 'red' },
};

export const STAGE: Record<FeatureStage, { label: string; tone: BadgeTone; hint: string }> = {
  internal: { label: 'Internal', tone: 'neutral', hint: 'Only test Houses you pick' },
  beta: { label: 'Beta', tone: 'azure', hint: 'Selected pilot Houses' },
  general: { label: 'Released', tone: 'emerald', hint: 'Follows the plans' },
};

export const PAY_LABEL = {
  paybill: 'Paybill',
  till: 'Till (Buy Goods)',
  card: 'Card',
  cash: 'Cash',
} as const;

export const FLOW_LABEL = {
  stk_push: 'M-Pesa prompt',
  c2b: 'Paid to shortcode',
  manual: 'Confirmed by staff',
  card: 'Card',
} as const;
