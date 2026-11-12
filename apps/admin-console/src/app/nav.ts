import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Building2,
  Compass,
  LayoutDashboard,
  Megaphone,
  Layers,
  Receipt,
  Rocket,
  ScrollText,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react';
import type { PlatformCapability } from '@stayvinci/demo-data/platform';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  cap: PlatformCapability;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Run',
    items: [
      { to: '/overview', label: 'Overview', icon: LayoutDashboard, cap: 'tenant.view' },
      { to: '/houses', label: 'Houses', icon: Building2, cap: 'tenant.view' },
      { to: '/onboarding', label: 'Onboarding', icon: Workflow, cap: 'tenant.view' },
    ],
  },
  {
    group: 'Data',
    items: [
      { to: '/transactions', label: 'Transactions', icon: Activity, cap: 'transaction.view' },
      { to: '/insights', label: 'Growth insights', icon: TrendingUp, cap: 'insight.view' },
    ],
  },
  {
    group: 'Product',
    items: [
      { to: '/plans', label: 'Plans & features', icon: Layers, cap: 'tenant.view' },
      { to: '/releases', label: 'Feature releases', icon: Rocket, cap: 'feature.manage' },
      { to: '/ads', label: 'Ads', icon: Megaphone, cap: 'ads.manage' },
      { to: '/marketplace', label: 'Marketplace', icon: Compass, cap: 'marketplace.manage' },
    ],
  },
  {
    group: 'Company',
    items: [
      { to: '/billing', label: 'Billing', icon: Receipt, cap: 'billing.manage' },
      { to: '/staff', label: 'Staff & roles', icon: Users, cap: 'staff.manage' },
      { to: '/activity', label: 'Activity log', icon: ScrollText, cap: 'audit.view' },
    ],
  },
];
