import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ArrowRight,
  CalendarCheck,
  CalendarX,
  Crown,
  Gift,
  HelpCircle,
  ImagePlus,
  KeyRound,
  LayoutTemplate,
  Megaphone,
  Palette,
  Plus,
  ReceiptText,
  Search,
  Smartphone,
  Sparkles,
  User,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Kbd, cn } from '@stayvinci/ui';
import { api } from '../mock/api';
import type { Capability } from '../mock/types';
import { dateTime, money } from '../lib/format';
import { NAV } from './nav';
import { useCan, useSession } from './session';
import { useBookingDrawer, useUi } from './ui';

type Group =
  | 'Actions'
  | 'Help'
  | 'Guests'
  | 'Bookings'
  | 'Services'
  | 'Team'
  | 'Codes'
  | 'Memberships'
  | 'Pages';

interface Item {
  id: string;
  group: Group;
  label: string;
  sub?: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

/** Things people want to do, found by plain words. `to: 'new-booking'` opens the dialog. */
const ACTIONS: { label: string; words: string; to: string; cap?: Capability; icon: ReactNode }[] = [
  {
    label: 'New booking',
    words: 'book appointment create add walk-in',
    to: 'new-booking',
    cap: 'booking.create',
    icon: <Plus className="size-4" />,
  },
  {
    label: 'Block time on the calendar',
    words: 'block time off lunch leave closed holiday',
    to: '/calendar',
    cap: 'booking.edit',
    icon: <CalendarX className="size-4" />,
  },
  {
    label: 'Add or edit a service',
    words: 'service menu treatment price add new product catalogue',
    to: '/catalogue',
    cap: 'catalogue.edit',
    icon: <Sparkles className="size-4" />,
  },
  {
    label: 'Invite a team member',
    words: 'staff employee invite add team therapist receptionist permissions role',
    to: '/team',
    cap: 'staff.manage',
    icon: <UserPlus className="size-4" />,
  },
  {
    label: 'Upload your logo',
    words: 'logo brand image picture personalise personalize',
    to: '/storefront?tab=brand',
    cap: 'storefront.edit',
    icon: <ImagePlus className="size-4" />,
  },
  {
    label: 'Change store colours',
    words: 'colour color theme palette mix brand look design',
    to: '/storefront?tab=colours',
    cap: 'storefront.edit',
    icon: <Palette className="size-4" />,
  },
  {
    label: 'Section backgrounds and photos',
    words: 'background image photo picture section texture design layout',
    to: '/storefront?tab=sections',
    cap: 'storefront.edit',
    icon: <LayoutTemplate className="size-4" />,
  },
  {
    label: 'Run an offer in the marquee',
    words: 'marquee offer discount promotion banner announce promote ticker deal sale',
    to: '/storefront?tab=marquee',
    cap: 'storefront.edit',
    icon: <Megaphone className="size-4" />,
  },
  {
    label: 'Seasonal theme (Christmas, Valentine’s, holidays)',
    words:
      'season seasonal christmas valentines valentine halloween easter eid holiday jamhuri madaraka mashujaa new year mothers festive theme',
    to: '/storefront?tab=season',
    cap: 'storefront.edit',
    icon: <Gift className="size-4" />,
  },
  {
    label: 'Create a private code or QR',
    words: 'code qr link invite access private door share',
    to: '/access',
    cap: 'access.manage',
    icon: <KeyRound className="size-4" />,
  },
  {
    label: 'Connect M-Pesa (Paybill or Till)',
    words: 'mpesa m-pesa paybill till payment daraja connect money',
    to: '/payments',
    cap: 'payment_account.manage',
    icon: <Smartphone className="size-4" />,
  },
  {
    label: 'Refund a payment',
    words: 'refund money back return reverse',
    to: '/payments',
    cap: 'payment.refund',
    icon: <ReceiptText className="size-4" />,
  },
  {
    label: 'Membership tiers',
    words: 'membership members tier subscription loyal',
    to: '/catalogue',
    cap: 'catalogue.edit',
    icon: <Crown className="size-4" />,
  },
  {
    label: 'Message guests or run a campaign',
    words: 'campaign message sms whatsapp marketing promote send',
    to: '/marketing',
    cap: 'marketing.manage',
    icon: <Megaphone className="size-4" />,
  },
  {
    label: 'Publish your store',
    words: 'publish live go live storefront launch',
    to: '/storefront',
    cap: 'storefront.edit',
    icon: <Wand2 className="size-4" />,
  },
];

/** Short, plain answers for "how do I…" questions. */
const HELP: { q: string; a: string; words: string; to: string }[] = [
  {
    q: 'How do guests pay?',
    a: 'By M-Pesa prompt to your Paybill or Till; money goes straight to you. Cards come later.',
    words: 'pay payment mpesa money guests how',
    to: '/payments',
  },
  {
    q: 'How do guests find my store?',
    a: 'Share your private code, link or QR. Listing in Discover is optional.',
    words: 'find store guests code share qr discover listed private',
    to: '/access',
  },
  {
    q: 'How do I add my logo and colours?',
    a: 'Storefront → Brand to upload; Colours suggests mixes that match your logo.',
    words: 'logo colour color brand personalise theme',
    to: '/storefront?tab=brand',
  },
  {
    q: 'How do I run a discount?',
    a: 'Storefront → Marquee: add an offer line. It scrolls across the top of your store.',
    words: 'discount offer promotion sale deal marquee',
    to: '/storefront?tab=marquee',
  },
  {
    q: 'How do I decorate for Christmas or a holiday?',
    a: 'Storefront → Seasonal: pick one, or choose Automatic to follow the calendar.',
    words: 'christmas holiday season decorate valentines halloween festive',
    to: '/storefront?tab=season',
  },
  {
    q: 'Can my staff see guest phone numbers?',
    a: 'No. Only the owner sees contact details unless you give someone that permission.',
    words: 'staff phone number contact privacy see guest permission',
    to: '/team',
  },
  {
    q: 'What happens when a guest cancels?',
    a: 'Your cancellation policy decides the refund automatically. Change it in Policies.',
    words: 'cancel cancellation refund policy late no-show',
    to: '/policies',
  },
  {
    q: 'How do I stop two people booking the same slot?',
    a: 'It can’t happen: each staff member and room can only hold one booking at a time.',
    words: 'double booking overlap same time clash',
    to: '/calendar',
  },
];

function matches(q: string, text: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const t = text.toLowerCase();
  return words.every((w) => t.includes(w));
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, openNewBooking } = useUi();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const drawer = useBookingDrawer();
  const can = useCan();
  const { tenant } = useSession();
  const search = useQuery({
    queryKey: [tenant.id, 'search', q],
    queryFn: () => api.search(q),
    enabled: paletteOpen && q.trim().length >= 2,
  });

  useEffect(() => {
    if (!paletteOpen) setQ('');
  }, [paletteOpen]);

  const items = useMemo<Item[]>(() => {
    const close = () => setPaletteOpen(false);
    const go = (to: string) => () => {
      close();
      if (to === 'new-booking') openNewBooking();
      else void navigate(to);
    };
    const query = q.trim();
    const actions: Item[] = ACTIONS.filter(
      (a) => (!a.cap || can(a.cap)) && (!query || matches(query, `${a.label} ${a.words}`)),
    )
      .slice(0, query ? 6 : 5)
      .map((a) => ({
        id: `action:${a.label}`,
        group: 'Actions',
        label: a.label,
        icon: a.icon,
        run: go(a.to),
      }));
    const help: Item[] = query
      ? HELP.filter((h) => matches(query, `${h.q} ${h.words}`))
          .slice(0, 3)
          .map((h) => ({
            id: `help:${h.q}`,
            group: 'Help',
            label: h.q,
            sub: h.a,
            icon: <HelpCircle className="size-4" />,
            run: go(h.to),
          }))
      : [];
    const d = search.data;
    const guests: Item[] = (d?.guests ?? []).map((g) => ({
      id: `guest:${g.id}`,
      group: 'Guests',
      label: g.name,
      icon: <User className="size-4" />,
      run: go(`/guests/${g.id}`),
    }));
    const bookings: Item[] = (d?.bookings ?? []).map((b) => ({
      id: `booking:${b.id}`,
      group: 'Bookings',
      label: b.ref,
      hint: dateTime(b.start, tenant.timezone),
      icon: <CalendarCheck className="size-4" />,
      run: () => {
        close();
        drawer.open(b.id);
      },
    }));
    const services: Item[] = (d?.services ?? []).map((x) => ({
      id: `service:${x.id}`,
      group: 'Services',
      label: x.name,
      hint: `from ${money(x.price)}`,
      icon: <Sparkles className="size-4" />,
      run: go('/catalogue'),
    }));
    const team: Item[] = (d?.team ?? []).map((x) => ({
      id: `team:${x.id}`,
      group: 'Team',
      label: x.name,
      hint: x.title,
      icon: <Users className="size-4" />,
      run: go('/team'),
    }));
    const codes: Item[] = (d?.codes ?? []).map((x) => ({
      id: `code:${x.id}`,
      group: 'Codes',
      label: x.code,
      hint: x.label,
      icon: <KeyRound className="size-4" />,
      run: go('/access'),
    }));
    const tiers: Item[] = (d?.tiers ?? []).map((x) => ({
      id: `tier:${x.id}`,
      group: 'Memberships',
      label: x.name,
      icon: <Crown className="size-4" />,
      run: go('/catalogue'),
    }));
    const pages: Item[] = query
      ? NAV.flatMap((g) => g.items)
          .filter((i) => (!i.cap || can(i.cap)) && (!i.vertical || i.vertical === tenant.vertical))
          .filter((i) => matches(query, i.label))
          .map((i) => ({
            id: `page:${i.to}`,
            group: 'Pages',
            label: i.label,
            icon: <i.icon className="size-4" />,
            run: go(i.to),
          }))
      : [];
    return [
      ...actions,
      ...help,
      ...guests,
      ...bookings,
      ...services,
      ...team,
      ...codes,
      ...tiers,
      ...pages,
    ];
  }, [q, search.data, can, tenant, navigate, setPaletteOpen, openNewBooking, drawer]);

  useEffect(() => setActive(0), [q]);

  return (
    <DialogPrimitive.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-emerald-950/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content className="fixed top-[10vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl bg-surface shadow-pop focus:outline-none">
          <DialogPrimitive.Title className="sr-only">Search or ask</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search guests, bookings, services, team and codes, find an action, or ask how to do
            something
          </DialogPrimitive.Description>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 text-ink-subtle" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, items.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter') {
                  items[active]?.run();
                }
              }}
              placeholder="Search anything, or ask “how do I…”"
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {items.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <div className="text-sm font-medium">Nothing found for “{q}”</div>
                <div className="mt-1 text-[13px] text-ink-muted">
                  Try a guest&apos;s name, a booking ref, a service, or words like “refund”, “logo”
                  or “christmas”.
                </div>
              </div>
            ) : (
              items.map((item, i) => {
                const first = i === 0 || items[i - 1]?.group !== item.group;
                return (
                  <div key={item.id}>
                    {first ? (
                      <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">
                        {!q && item.group === 'Actions' ? 'Suggested' : item.group}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={item.run}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm',
                        i === active ? 'bg-emerald-50 text-ink' : 'text-ink-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0',
                          item.group === 'Help' ? 'text-azure-600' : 'text-ink-subtle',
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink">{item.label}</span>
                        {item.sub ? (
                          <span className="block text-[13px] text-ink-muted">{item.sub}</span>
                        ) : null}
                      </span>
                      {item.hint ? (
                        <span className="shrink-0 text-xs text-ink-subtle">{item.hint}</span>
                      ) : null}
                      {i === active ? (
                        <ArrowRight className="size-4 shrink-0 text-azure-600" />
                      ) : null}
                    </button>
                  </div>
                );
              })
            )}
            {!q ? (
              <div className="px-3 pt-3 pb-2 text-xs text-ink-subtle">
                Try a guest&apos;s name, a booking ref, “hot stone”, “refund”, “logo” or
                “christmas”.
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
