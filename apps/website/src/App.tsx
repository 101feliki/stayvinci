import { useEffect, useState } from 'react';
import {
  createBrowserRouter,
  Link,
  NavLink,
  Outlet,
  RouterProvider,
  ScrollRestoration,
} from 'react-router';
import { Menu, X } from 'lucide-react';
import { Logo, cn } from '@stayvinci/ui';
import { BUSINESS_APP_URL, GUEST_APP_URL } from './api';
import { HomePage } from './pages/HomePage';
import { PlacePage } from './pages/PlacePage';

const NAV = [
  { to: '/#solves', label: 'Why Stayvinci' },
  { to: '/#spas', label: 'Our spas' },
  { to: '/#ateliers', label: 'Ateliers' },
  { to: '/#stays', label: 'Stays' },
  { to: '/#business', label: 'For businesses' },
];

function Shell() {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 text-white transition-colors duration-300',
          solid || open ? 'bg-obsidian-900/95 backdrop-blur-xl' : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 md:h-[72px] lg:px-10">
          <Link to="/" aria-label="Stayvinci home" onClick={() => setOpen(false)}>
            <Logo on="dark" className="h-9 md:h-11" />
          </Link>
          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <a
                key={n.to}
                href={n.to}
                className="px-3 py-2 text-[12px] font-semibold tracking-[0.16em] text-white/70 uppercase transition-colors hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <a
            href={`${GUEST_APP_URL}/?install=1`}
            className="ml-auto hidden rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-obsidian-900 transition hover:bg-ivory sm:inline-flex lg:ml-2"
          >
            Get the app
          </a>
          <button
            type="button"
            className="ml-auto rounded-full p-2 hover:bg-white/10 sm:ml-0 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
        {open ? (
          <nav className="border-t border-white/10 px-4 pb-6 lg:hidden" aria-label="Main">
            {NAV.map((n) => (
              <a
                key={n.to}
                href={n.to}
                onClick={() => setOpen(false)}
                className="block py-3 text-base font-medium text-white/85"
              >
                {n.label}
              </a>
            ))}
            <a
              href={`${GUEST_APP_URL}/?install=1`}
              className="mt-3 flex justify-center rounded-full bg-white py-3 text-sm font-semibold text-obsidian-900"
            >
              Get the app
            </a>
          </nav>
        ) : null}
      </header>
      <Outlet />
      <Footer />
      <ScrollRestoration />
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-emerald-sheen text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div>
          <Logo on="dark" className="h-11" />
          <p className="mt-4 max-w-sm text-sm text-white/60">
            Private, branded stores for spas, therapists and stays in Kenya. Guests book in seconds
            and pay the place directly.
          </p>
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-[0.2em] text-white/50 uppercase">
            Guests
          </div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>
              <a href={`${GUEST_APP_URL}/?install=1`} className="hover:text-white">
                Get the app
              </a>
            </li>
            <li>
              <a href={`${GUEST_APP_URL}/discover`} className="hover:text-white">
                Discover places
              </a>
            </li>
            <li>
              <a href="/#spas" className="hover:text-white">
                Our spas
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-[0.2em] text-white/50 uppercase">
            Businesses
          </div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>
              <a href="/#business" className="hover:text-white">
                How it works for you
              </a>
            </li>
            <li>
              <a href={BUSINESS_APP_URL} className="hover:text-white">
                Business sign-in
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-white/45 sm:px-6 lg:px-10">
          <span>© {new Date().getFullYear()} Stayvinci · Nairobi, Kenya</span>
          <NavLink to="/" className="hover:text-white/80">
            stayvinci.com
          </NavLink>
        </div>
      </div>
    </footer>
  );
}

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'places/:handle', element: <PlacePage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
