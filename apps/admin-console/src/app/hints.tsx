import { useLocation } from 'react-router';
import { PageHint } from '@stayvinci/ui';

/** A short tip per console page; closing it is remembered on this device. */
const HINTS: Record<string, { title: string; body: string }> = {
  '/overview': {
    title: 'Start with “Needs attention”',
    body: 'Failing M-Pesa connections, unpaid subscriptions and stalled setups are listed first. Click one to open the House.',
  },
  '/houses': {
    title: 'Add a House or open one to help',
    body: '“Add a House” sends the owner an invite. Inside a House, “Manage store” opens their business app with full control; they see your changes in their activity log.',
  },
  '/onboarding': {
    title: 'Move every House to Live',
    body: 'Cards show setup progress. Stalled ones are your best calls of the day.',
  },
  '/transactions': {
    title: 'Clean payment data, no guest identities',
    body: 'Guests appear as anonymous references so repeat visits can be counted. Export to CSV for deeper analysis.',
  },
  '/insights': {
    title: 'Prove the value',
    body: 'Compare each House’s first month with its latest, and with what it earned before Stayvinci. Use these numbers in case studies.',
  },
  '/plans': {
    title: 'Decide what each plan includes',
    body: 'Tick a box to add a feature to a plan; Houses on that plan get it at once. Exceptions for one House live on its page.',
  },
  '/releases': {
    title: 'Release safely',
    body: 'New features start Internal (your test Houses), move to Beta (pilots), then Released (follows the plans).',
  },
  '/ads': {
    title: 'Grow Stayvinci',
    body: 'Connect Meta and Google, then launch a campaign for Houses or guests. Cost per House shows which ads are worth it.',
  },
  '/marketplace': {
    title: 'Curate Discover',
    body: 'Feature Houses that are listed and doing well. Private Houses never appear.',
  },
  '/billing': {
    title: 'Subscriptions and grace',
    body: 'Give a struggling House more days or a coupon. Prices come from the plan catalogue once decided.',
  },
  '/staff': {
    title: 'Give your team the right role',
    body: 'Admin runs Houses, Finance handles billing and data, Marketing runs ads and Discover. Preview any role from your menu.',
  },
  '/activity': {
    title: 'Everything is recorded',
    body: 'Every change by staff, owners and the system, filterable by House and person. Export for audits.',
  },
};

export function RouteHint() {
  const { pathname } = useLocation();
  const key = Object.keys(HINTS).find((k) => pathname === k || pathname.startsWith(`${k}/`));
  const h = key ? HINTS[key] : undefined;
  if (!key || !h) return null;
  return (
    <PageHint key={key} id={`console${key}`} title={h.title}>
      {h.body}
    </PageHint>
  );
}
