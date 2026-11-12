import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Eye, Lightbulb, LogOut, Menu as MenuIcon, RotateCcw, X } from 'lucide-react';
import {
  Avatar,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  LogoMark,
  ThemeSwitcher,
  cn,
  resetHints,
} from '@stayvinci/ui';
import {
  PLATFORM_ROLE_CAPS,
  PLATFORM_ROLE_LABELS,
  type PlatformRole,
} from '@stayvinci/demo-data/platform';
import { api } from '../mock/api';
import { NAV } from './nav';
import { useCan, useSession } from './session';
import { RouteHint } from './hints';

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const can = useCan();
  return (
    <div className="flex h-full flex-col bg-emerald-sheen text-ivory">
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <LogoMark on="dark" className="size-9" />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Stayvinci</div>
          <div className="text-[11px] tracking-wider text-gold-300 uppercase">Console</div>
        </div>
      </div>
      <nav
        className="flex-1 space-y-5 overflow-y-auto px-3 pt-3 pb-6 [scrollbar-width:thin]"
        aria-label="Main"
      >
        {NAV.map((g) => {
          const items = g.items.filter((i) => can(i.cap));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-emerald-300/70 uppercase">
                {g.group}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      {...(onNavigate ? { onClick: onNavigate } : {})}
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-emerald-800 font-medium text-ivory'
                            : 'text-emerald-100/80 hover:bg-emerald-800/50 hover:text-ivory',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive ? (
                            <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-gold-400" />
                          ) : null}
                          <item.icon
                            className={cn(
                              'size-[18px]',
                              isActive ? 'text-gold-300' : 'text-emerald-300/80',
                            )}
                          />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-emerald-800 px-5 py-3 text-[11px] text-emerald-300/70">
        Demo data · prototype build
      </div>
    </div>
  );
}

function UserMenu() {
  const s = useSession();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries();
  const roles = Object.keys(PLATFORM_ROLE_CAPS) as PlatformRole[];
  return (
    <Menu>
      <MenuTrigger className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-canvas">
        <Avatar name={s.staff.name} size="sm" tone="gold" />
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-medium">{s.staff.name}</span>
          <span className="block text-[11px] text-ink-muted">{PLATFORM_ROLE_LABELS[s.role]}</span>
        </span>
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuLabel>Preview the console as (demo)</MenuLabel>
        {roles.map((r) => (
          <MenuItem
            key={r}
            onSelect={() => void api.session.setViewAs(r === s.staff.role ? null : r).then(refresh)}
          >
            <span className="flex-1">{PLATFORM_ROLE_LABELS[r]}</span>
            {s.role === r ? <Check className="size-4 text-azure-600" /> : null}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <div className="px-2 pb-2">
          <ThemeSwitcher compact />
        </div>
        <MenuItem onSelect={() => resetHints()}>
          <Lightbulb className="size-4" /> Show page tips again
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => void api.session.resetDemo().then(refresh)}>
          <RotateCcw className="size-4" /> Reset demo data
        </MenuItem>
        <MenuItem onSelect={() => void api.session.signOut().then(refresh)}>
          <LogOut className="size-4" /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function AppShell() {
  const s = useSession();
  const qc = useQueryClient();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>
      {navOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 animate-fade-in bg-emerald-950/40"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative h-full w-72 animate-slide-in-right">
            <Sidebar onNavigate={() => setNavOpen(false)} />
            <button
              type="button"
              className="absolute top-4 right-3 rounded-lg p-1.5 text-ivory/80 hover:bg-emerald-800"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      ) : null}
      <div className="min-w-0 lg:pl-64">
        {s.viewAs ? (
          <div className="flex flex-wrap items-center justify-center gap-2 bg-azure-500 px-4 py-1.5 text-[13px] font-medium text-white">
            <Eye className="size-4" /> Previewing as {PLATFORM_ROLE_LABELS[s.viewAs]}: you see what
            they see.
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => void api.session.setViewAs(null).then(() => qc.invalidateQueries())}
            >
              Exit preview
            </button>
          </div>
        ) : null}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-ink-muted hover:bg-surface lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon className="size-5" />
          </button>
          <span className="hidden text-sm text-ink-muted sm:block">
            Stayvinci never holds guest money: payments go straight to each House.
          </span>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-16 sm:px-6">
          <RouteHint />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
