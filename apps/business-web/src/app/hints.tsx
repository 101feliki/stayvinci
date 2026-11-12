import { Link, useLocation } from 'react-router';
import { PageHint } from '@stayvinci/ui';

/** One short setup tip per page, shown until the person closes it (Settings → Appearance brings them back). */
const HINTS: Record<string, { title: string; body: string; link?: { to: string; label: string } }> =
  {
    '/today': {
      title: 'Your day at a glance',
      body: 'Tap a booking to check a guest in, take a payment or move it. Requests and unmatched payments wait under “Needs attention”.',
    },
    '/calendar': {
      title: 'Drag to move, click empty space to book',
      body: 'Block time for lunch or leave with “Block time”. Nobody can be double-booked: each person and room holds one booking at a time.',
    },
    '/bookings': {
      title: 'Every booking in one list',
      body: 'Filter by state or date, then open one to refund, reschedule or message the guest.',
    },
    '/requests': {
      title: 'Approve or decline requests',
      body: 'Requests you don’t answer in time are declined and refunded automatically, so guests are never left waiting.',
    },
    '/messages': {
      title: 'Chat without sharing numbers',
      body: 'Guests message you in the app. Phone numbers are never shown in chat, for your team or your guests.',
    },
    '/guests': {
      title: 'Your guests stay yours',
      body: 'Only the owner sees contact details unless you give someone permission. Import an existing client list with “Import”.',
    },
    '/marketing': {
      title: 'Bring guests back',
      body: 'Send offers to groups like “haven’t visited in 60 days”. For a public banner on your store, use the Marquee.',
      link: { to: '/storefront?tab=marquee', label: 'Set up the marquee' },
    },
    '/catalogue': {
      title: 'Make every service look its best',
      body: 'Open a service to add a photo, or pick one from our library or icon set. Set prices, durations and who can perform it.',
    },
    '/team': {
      title: 'Invite your team',
      body: 'Give each person a role (front desk, therapist, manager). Fine-tune what they can see under their name.',
    },
    '/storefront': {
      title: 'Design your store',
      body: 'Start with Brand (logo) and Cover (your big photo), then Colours. Everything shows in the preview; guests see it after you publish.',
    },
    '/content': {
      title: 'Go live or share videos',
      body: 'Schedule a live class or Q&A for everyone, members or ticket holders. Upload videos and galleries for guests to watch any time.',
    },
    '/access': {
      title: 'Open the door',
      body: 'Share your private code, link or QR. Make codes for campaigns or VIPs, and choose whether to list in Discover.',
    },
    '/policies': {
      title: 'Set your rules once',
      body: 'Deposits, cancellation windows and no-show fees apply automatically to every booking and refund.',
    },
    '/payments': {
      title: 'Get paid straight to your M-Pesa',
      body: 'Connect your Paybill or Till. Money goes directly to you; Stayvinci never holds it. Attach unmatched payments to bookings here.',
    },
    '/reports': {
      title: 'See what’s working',
      body: 'Revenue, busiest hours, top services and returning guests. Export any report to a spreadsheet.',
    },
    '/billing': {
      title: 'Your Stayvinci plan',
      body: 'Your subscription and any marketplace fees, with a plain explanation of every line.',
    },
    '/compliance': {
      title: 'Guest registration and levies',
      body: 'Short-stay guest registers and tourism levy reports are prepared for you from your bookings.',
    },
    '/settings': {
      title: 'Make it yours',
      body: 'Connect Instagram, Facebook, X, TikTok and WhatsApp under Social accounts. Switch light or dark under Appearance.',
    },
  };

export function RouteHint() {
  const { pathname } = useLocation();
  const key = Object.keys(HINTS).find((k) => pathname === k || pathname.startsWith(`${k}/`));
  if (!key) return null;
  const h = HINTS[key];
  if (!h) return null;
  return (
    <PageHint
      key={key}
      id={`business${key}`}
      title={h.title}
      action={
        h.link ? (
          <Link
            to={h.link.to}
            className="text-[13px] font-medium text-azure-700 dark:text-azure-300"
          >
            {h.link.label} →
          </Link>
        ) : undefined
      }
    >
      {h.body}
    </PageHint>
  );
}
