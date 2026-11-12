import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { EmptyState, LogoMark, Skeleton } from '@stayvinci/ui';
import type { PlatformCapability } from '@stayvinci/demo-data/platform';
import { api } from '../mock/api';
import { AppShell } from './AppShell';
import { SessionProvider, useCan, type SignedInSession } from './session';
import { SignIn } from './SignIn';
import { OverviewPage } from '../features/overview/OverviewPage';
import { HousesPage } from '../features/houses/HousesPage';
import { HouseDetailPage } from '../features/houses/HouseDetailPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import { InsightsPage } from '../features/insights/InsightsPage';
import { PlansPage } from '../features/plans/PlansPage';
import { ReleasesPage } from '../features/releases/ReleasesPage';
import { MarketplacePage } from '../features/marketplace/MarketplacePage';
import { AdsPage } from '../features/ads/AdsPage';
import { BillingPage } from '../features/billing/BillingPage';
import { StaffPage } from '../features/staff/StaffPage';
import { ActivityPage } from '../features/activity/ActivityPage';

/** Hides a page from roles without the capability. The API refuses the data either way. */
function Gate({ cap, children }: { cap: PlatformCapability; children: ReactNode }) {
  const can = useCan();
  if (!can(cap)) {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="Your role doesn't include this page"
        description="A Super admin can change your role in Staff & roles."
        className="py-24"
      />
    );
  }
  return <>{children}</>;
}

const page = (path: string, element: ReactNode, cap: PlatformCapability): RouteObject => ({
  path,
  element: <Gate cap={cap}>{element}</Gate>,
});

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      page('overview', <OverviewPage />, 'tenant.view'),
      page('houses', <HousesPage />, 'tenant.view'),
      page('houses/:id', <HouseDetailPage />, 'tenant.view'),
      page('onboarding', <OnboardingPage />, 'tenant.view'),
      page('transactions', <TransactionsPage />, 'transaction.view'),
      page('insights', <InsightsPage />, 'insight.view'),
      page('plans', <PlansPage />, 'tenant.view'),
      page('releases', <ReleasesPage />, 'feature.manage'),
      page('ads', <AdsPage />, 'ads.manage'),
      page('marketplace', <MarketplacePage />, 'marketplace.manage'),
      page('billing', <BillingPage />, 'billing.manage'),
      page('staff', <StaffPage />, 'staff.manage'),
      page('activity', <ActivityPage />, 'audit.view'),
      { path: '*', element: <Navigate to="/overview" replace /> },
    ],
  },
]);

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-14 animate-pulse" />
        <Skeleton className="h-2 w-24" />
      </div>
    </div>
  );
}

export function App() {
  const session = useQuery({ queryKey: ['session'], queryFn: api.session.get });
  if (!session.data) return <Splash />;
  if (!session.data.signedIn) return <SignIn />;
  const value: SignedInSession = session.data;
  return (
    <SessionProvider value={value}>
      <RouterProvider router={router} />
    </SessionProvider>
  );
}
