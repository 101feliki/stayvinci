import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Users,
  UsersRound,
  Clapperboard,
  type LucideIcon,
} from 'lucide-react';
import type { Capability, Vertical } from '../mock/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  cap?: Capability;
  vertical?: Vertical;
  badge?: 'requests' | 'messages';
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Daily',
    items: [
      { to: '/today', label: 'Today', icon: LayoutDashboard, cap: 'booking.view' },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays, cap: 'booking.view' },
      { to: '/bookings', label: 'Bookings', icon: ClipboardList, cap: 'booking.view' },
      {
        to: '/requests',
        label: 'Requests',
        icon: Inbox,
        cap: 'booking.approve',
        badge: 'requests',
      },
      {
        to: '/messages',
        label: 'Messages',
        icon: MessageSquare,
        cap: 'message.reply',
        badge: 'messages',
      },
    ],
  },
  {
    group: 'Guests',
    items: [
      { to: '/guests', label: 'Guests', icon: Users, cap: 'guest.view' },
      { to: '/marketing', label: 'Marketing', icon: Megaphone, cap: 'marketing.manage' },
    ],
  },
  {
    group: 'Store',
    items: [
      { to: '/catalogue', label: 'Catalogue', icon: BookOpen, cap: 'catalogue.edit' },
      { to: '/team', label: 'Team & resources', icon: UsersRound, cap: 'staff.manage' },
      { to: '/storefront', label: 'Storefront', icon: Store, cap: 'storefront.edit' },
      { to: '/content', label: 'Content', icon: Clapperboard, cap: 'content.edit' },
      { to: '/access', label: 'Access & visibility', icon: KeyRound, cap: 'access.manage' },
      { to: '/policies', label: 'Policies & rules', icon: ScrollText, cap: 'policy.edit' },
    ],
  },
  {
    group: 'Money',
    items: [
      { to: '/payments', label: 'Payments', icon: CreditCard, cap: 'payment.view' },
      { to: '/reports', label: 'Reports', icon: BarChart3, cap: 'report.view' },
      { to: '/billing', label: 'Billing', icon: Receipt, cap: 'billing.manage' },
    ],
  },
  {
    group: 'Admin',
    items: [
      {
        to: '/compliance',
        label: 'Compliance',
        icon: ShieldCheck,
        cap: 'compliance.view',
        vertical: 'short_stay',
      },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const MOBILE_TABS = ['/today', '/calendar', '/bookings', '/messages'];
