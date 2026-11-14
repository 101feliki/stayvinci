import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { EmptyState, LogoMark, Skeleton } from '@stayvinci/ui';
import { api } from '../lib/api';
import type { Capability } from '../mock/types';
import { AppShell } from './AppShell';
import { SessionProvider, useCan, type SignedInSession } from './session';
import { SignIn } from './SignIn';
import { UiProvider } from './ui';
import { TodayPage } from '../features/today/TodayPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { BookingsPage } from '../features/bookings/BookingsPage';
import { RequestsPage } from '../features/bookings/RequestsPage';
import { GuestsPage } from '../features/guests/GuestsPage';
import { GuestDetailPage } from '../features/guests/GuestDetailPage';
import { MessagesPage } from '../features/messages/MessagesPage';
import { CataloguePage } from '../features/catalogue/CataloguePage';
import { TeamPage } from '../features/team/TeamPage';
import { StorefrontPage } from '../features/storefront/StorefrontPage';
import { ContentPage } from '../features/content/ContentPage';
import { AccessPage } from '../features/access/AccessPage';
import { PoliciesPage } from '../features/policies/PoliciesPage';
import { PaymentsPage } from '../features/payments/PaymentsPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { MarketingPage } from '../features/marketing/MarketingPage';
import { CompliancePage } from '../features/compliance/CompliancePage';
import { BillingPage } from '../features/billing/BillingPage';
import { SettingsPage } from '../features/settings/SettingsPage';

/** Hides a page from roles without the capability. The API refuses the data either way. */
function Gate({ cap, children }: { cap?: Capability; children: ReactNode }) {
  const can = useCan();
  if (cap && !can(cap)) {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="You don't have access to this page"
        description="Ask the owner of this House to give you the permission you need."
        className="py-24"
      />
    );
  }
  return <>{children}</>;
}

const page = (path: string, element: ReactNode, cap?: Capability): RouteObject => ({
  path,
  element: cap ? <Gate cap={cap}>{element}</Gate> : element,
});

const router = createBrowserRouter([
  {
    element: (
      <UiProvider>
        <AppShell />
      </UiProvider>
    ),
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      page('today', <TodayPage />, 'booking.view'),
      page('calendar', <CalendarPage />, 'booking.view'),
      page('bookings', <BookingsPage />, 'booking.view'),
      page('requests', <RequestsPage />, 'booking.approve'),
      page('guests', <GuestsPage />, 'guest.view'),
      page('guests/:id', <GuestDetailPage />, 'guest.view'),
      page('messages', <MessagesPage />, 'message.reply'),
      page('catalogue', <CataloguePage />, 'catalogue.edit'),
      page('team', <TeamPage />, 'staff.manage'),
      page('storefront', <StorefrontPage />, 'storefront.edit'),
      page('content', <ContentPage />, 'content.edit'),
      page('access', <AccessPage />, 'access.manage'),
      page('policies', <PoliciesPage />, 'policy.edit'),
      page('payments', <PaymentsPage />, 'payment.view'),
      page('reports', <ReportsPage />, 'report.view'),
      page('marketing', <MarketingPage />, 'marketing.manage'),
      page('compliance', <CompliancePage />, 'compliance.view'),
      page('billing', <BillingPage />, 'billing.manage'),
      page('settings', <SettingsPage />),
      { path: '*', element: <Navigate to="/today" replace /> },
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
