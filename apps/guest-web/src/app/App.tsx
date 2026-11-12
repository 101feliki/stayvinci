import {
  createBrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  RouterProvider,
  useNavigate,
  useParams,
} from 'react-router';
import { Suspense, lazy, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Compass, Home, User, Wallet } from 'lucide-react';
import { Logo, cn } from '@stayvinci/ui';
import { api } from '../lib/api';
import { InstallBanner } from './InstallBanner';
import { SignInProvider, takeReturnPath, useMe, useSignIn } from './shared';
import { HomePage } from '../features/home/HomePage';
import { StoreLayout } from '../features/store/StoreLayout';

/*
 * Screens load when first opened, so a guest following a store link downloads the store,
 * not the whole app. Home and the store frame stay in the first download.
 */
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const DiscoverPage = page(() => import('../features/discover/DiscoverPage'), 'DiscoverPage');
const ListingPage = page(() => import('../features/discover/DiscoverPage'), 'ListingPage');
const storePages = () => import('../features/store/StorePages');
const StoreHome = page(storePages, 'StoreHome');
const StoreMenu = page(storePages, 'StoreMenu');
const StoreMembers = page(storePages, 'StoreMembers');
const StoreContent = page(storePages, 'StoreContent');
const StoreAbout = page(storePages, 'StoreAbout');
const OfferingPage = page(() => import('../features/store/OfferingPage'), 'OfferingPage');
const CheckoutPage = page(() => import('../features/checkout/CheckoutPage'), 'CheckoutPage');
const ChatPage = page(() => import('../features/store/ChatPage'), 'ChatPage');
const BookingsPage = page(() => import('../features/bookings/BookingsPage'), 'BookingsPage');
const WalletPage = page(() => import('../features/wallet/WalletPage'), 'WalletPage');
const ProfilePage = page(() => import('../features/profile/ProfilePage'), 'ProfilePage');

/** While a screen's code arrives: a quiet bar, no layout jump. */
function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true">
      <span className="h-1 w-24 animate-pulse rounded-full bg-line" />
    </div>
  );
}
const S = (node: ReactNode) => <Suspense fallback={<Loading />}>{node}</Suspense>;

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
  const { requireSignIn } = useSignIn();
  const signedIn = !!me.data?.signedIn;
  // The wallet only means something once a guest has an account.
  const tabs = signedIn ? TABS : TABS.filter((t) => t.to !== '/wallet');
  const name = me.data?.signedIn ? (me.data.alias ?? me.data.firstName ?? '') : '';
  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="sticky top-0 z-30 bg-obsidian-900/95 text-white backdrop-blur-xl">
        <div className="flex h-16 w-full items-center gap-6 px-4 sm:px-6 md:h-[72px] lg:px-10">
          <NavLink to="/" className="flex shrink-0 items-center" aria-label="Stayvinci home">
            <Logo on="dark" className="h-9 md:h-11" />
          </NavLink>
          <nav className="hidden flex-1 justify-center gap-1 md:flex" aria-label="Main">
            {tabs.map((t) => (
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
          {signedIn ? (
            <NavLink
              to="/profile"
              className="ml-auto flex items-center gap-2.5 rounded-full py-1 pr-1 pl-3 text-[13px] text-white/75 hover:bg-white/10 md:ml-0"
            >
              <span className="max-w-36 truncate">{name ? `Hi, ${name}` : 'Your account'}</span>
              <span className="flex size-8 items-center justify-center rounded-full bg-gold-400 text-xs font-semibold text-obsidian-900">
                {(name || 'G').charAt(0)}
              </span>
            </NavLink>
          ) : me.isLoading ? (
            <span className="ml-auto md:ml-0" />
          ) : (
            <button
              type="button"
              onClick={() => requireSignIn(me.data, () => undefined)}
              className="ml-auto rounded-full border border-white/25 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10 md:ml-0"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      <InstallBanner />
      <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 md:pt-8 md:pb-16 lg:px-10">
        <Outlet />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Main"
      >
        {tabs.map((t) => (
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
                    isActive && 'bg-emerald-900 text-white dark:bg-emerald-700',
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

/** Pages that only make sense with an account (the wallet); visitors go home. */
function SignedInOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isLoading) return null;
  return me.data?.signedIn ? children : <Navigate to="/" replace />;
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

/** The emailed sign-in link lands here: /auth/magic?token=… */
function MagicLink() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    // Remove the token from the address bar and history straight away.
    window.history.replaceState(null, '', '/auth/magic');
    api.me
      .finishLink(token)
      .then(async () => {
        await qc.invalidateQueries();
        toast.success('Signed in');
        navigate(takeReturnPath(), { replace: true });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'This link did not work.'));
  }, [navigate, qc]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo on="light" className="h-10" />
      {error ? (
        <>
          <p className="max-w-sm text-sm text-ink-muted">{error}</p>
          <NavLink to="/" className="text-sm font-medium text-azure-700">
            Back to Stayvinci
          </NavLink>
        </>
      ) : (
        <p className="text-sm text-ink-muted">Signing you in…</p>
      )}
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/auth/magic', element: <MagicLink /> },
  { path: '/i/:code', element: <InviteRedirect /> },
  {
    element: <GuestShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'discover', element: S(<DiscoverPage />) },
      { path: 'discover/:handle', element: S(<ListingPage />) },
      { path: 'bookings', element: S(<BookingsPage />) },
      {
        path: 'wallet',
        element: <SignedInOnly>{S(<WalletPage />)}</SignedInOnly>,
      },
      { path: 'profile', element: S(<ProfilePage />) },
    ],
  },
  {
    path: '/s/:handle',
    element: <StoreLayout />,
    children: [
      { index: true, element: S(<StoreHome />) },
      { path: 'menu', element: S(<StoreMenu />) },
      { path: 'members', element: S(<StoreMembers />) },
      { path: 'content', element: S(<StoreContent />) },
      { path: 'about', element: S(<StoreAbout />) },
      { path: 'o/:serviceId', element: S(<OfferingPage />) },
    ],
  },
  { path: '/s/:handle/book/:serviceId', element: S(<CheckoutPage />) },
  { path: '/s/:handle/chat', element: S(<ChatPage />) },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <SignInProvider>
      <RouterProvider router={router} />
    </SignInProvider>
  );
}
