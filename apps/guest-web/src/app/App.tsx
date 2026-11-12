import {
  createBrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  RouterProvider,
  useNavigate,
  useParams,
} from 'react-router';
import { useEffect } from 'react';
import { CalendarDays, Compass, Home, User, Wallet } from 'lucide-react';
import { Logo, cn } from '@stayvinci/ui';
import { api } from '../mock/api';
import { SignInProvider, useMe } from './shared';
import { HomePage } from '../features/home/HomePage';
import { DiscoverPage, ListingPage } from '../features/discover/DiscoverPage';
import { StoreLayout } from '../features/store/StoreLayout';
import {
  StoreHome,
  StoreMenu,
  StoreMembers,
  StoreContent,
  StoreAbout,
} from '../features/store/StorePages';
import { OfferingPage } from '../features/store/OfferingPage';
import { CheckoutPage } from '../features/checkout/CheckoutPage';
import { ChatPage } from '../features/store/ChatPage';
import { BookingsPage } from '../features/bookings/BookingsPage';
import { WalletPage } from '../features/wallet/WalletPage';
import { ProfilePage } from '../features/profile/ProfilePage';

const TABS = [
  { to: '/', label: 'My places', icon: Home, end: true },
  { to: '/discover', label: 'Discover', icon: Compass, end: false },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays, end: false },
  { to: '/wallet', label: 'Wallet', icon: Wallet, end: false },
  { to: '/profile', label: 'Profile', icon: User, end: false },
];

/**
 * Stayvinci chrome: full-width obsidian bar with the bold gold logo on every screen size,
 * section links on desktop and bottom tabs on phones. Hidden inside stores.
 */
function GuestShell() {
  const me = useMe();
  const greeting = me.data?.signedIn
    ? `Hi, ${me.data.alias ?? me.data.firstName}`
    : 'Browsing as visitor';
  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="sticky top-0 z-30 bg-obsidian-900/95 text-white backdrop-blur-xl">
        <div className="flex h-16 w-full items-center gap-6 px-4 sm:px-6 md:h-[72px] lg:px-10">
          <NavLink to="/" className="flex shrink-0 items-center" aria-label="Stayvinci home">
            <Logo on="dark" className="h-9 md:h-11" />
          </NavLink>
          <nav className="hidden flex-1 justify-center gap-1 md:flex" aria-label="Main">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'relative px-4 py-2 text-[12px] font-semibold tracking-[0.16em] uppercase transition-colors',
                    isActive ? 'text-white' : 'text-white/55 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {t.label}
                    {isActive ? (
                      <span className="absolute inset-x-4 -bottom-0.5 h-px bg-gold-400" />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <NavLink
            to="/profile"
            className="ml-auto flex items-center gap-2.5 rounded-full py-1 pr-1 pl-3 text-[13px] text-white/75 hover:bg-white/10 md:ml-0"
          >
            <span className="max-w-36 truncate">{greeting}</span>
            <span className="flex size-8 items-center justify-center rounded-full bg-gold-400 text-xs font-semibold text-obsidian-900">
              {(me.data?.signedIn ? (me.data.alias ?? me.data.firstName) : 'G').charAt(0)}
            </span>
          </NavLink>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 md:pt-8 md:pb-16 lg:px-10">
        <Outlet />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Main"
      >
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-ink' : 'text-ink-subtle',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    isActive && 'bg-obsidian-900 text-white dark:bg-white dark:text-obsidian-900',
                  )}
                >
                  <t.icon className="size-5" />
                </span>
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Invite link: https://stayvinci.com/i/{code} enters the store and opens it (spec §6). */
function InviteRedirect() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    api
      .enter(code)
      .then((r) => navigate(`/s/${r.handle}`, { replace: true }))
      .catch(() => navigate(`/?code=${encodeURIComponent(code)}`, { replace: true }));
  }, [code, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">
      Opening…
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/i/:code', element: <InviteRedirect /> },
  {
    element: <GuestShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'discover', element: <DiscoverPage /> },
      { path: 'discover/:handle', element: <ListingPage /> },
      { path: 'bookings', element: <BookingsPage /> },
      { path: 'wallet', element: <WalletPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  {
    path: '/s/:handle',
    element: <StoreLayout />,
    children: [
      { index: true, element: <StoreHome /> },
      { path: 'menu', element: <StoreMenu /> },
      { path: 'members', element: <StoreMembers /> },
      { path: 'content', element: <StoreContent /> },
      { path: 'about', element: <StoreAbout /> },
      { path: 'o/:serviceId', element: <OfferingPage /> },
    ],
  },
  { path: '/s/:handle/book/:serviceId', element: <CheckoutPage /> },
  { path: '/s/:handle/chat', element: <ChatPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <SignInProvider>
      <RouterProvider router={router} />
    </SignInProvider>
  );
}
