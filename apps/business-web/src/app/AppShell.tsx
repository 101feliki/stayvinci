import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  ChevronsUpDown,
  Eye,
  LogOut,
  Menu as MenuIcon,
  MoreHorizontal,
  Plus,
  Wrench,
  Search,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  cn,
  LogoMark,
  StoreLogo,
} from '@stayvinci/ui';
import { api } from '../lib/api';
import type { TenantRole } from '../mock/types';
import { ROLE_LABELS } from '../lib/capabilities';
import { useTenantQuery } from '../lib/query';
import { MOBILE_TABS, NAV, type NavItem } from './nav';
import { useCan, useSession } from './session';
import { useUi } from './ui';
import { BookingDrawer } from '../features/bookings/BookingDrawer';
import { NewBookingDialog } from '../features/bookings/NewBookingDialog';
import { CommandPalette } from './CommandPalette';
import { RouteHint } from './hints';

function useNavItems(): NavItem[][] {
  const can = useCan();
  const { tenant } = useSession();
  return NAV.map((g) =>
    g.items.filter(
      (i) => (!i.cap || can(i.cap)) && (!i.vertical || i.vertical === tenant.vertical),
    ),
  );
}

function useBadges() {
  const can = useCan();
  const bookings = useTenantQuery(['bookings'], api.bookings.list, {
    enabled: can('booking.approve'),
  });
  const messages = useTenantQuery(['messages'], api.messages.list, {
    enabled: can('message.reply'),
  });
  return {
    requests: bookings.data?.filter((b) => b.state === 'requested').length ?? 0,
    messages: messages.data?.reduce((n, c) => n + c.unread, 0) ?? 0,
  };
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const groups = useNavItems();
  const badges = useBadges();
  return (
    <div className="flex h-full flex-col bg-emerald-sheen text-ivory">
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <LogoMark on="dark" className="size-9" />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Stayvinci</div>
          <div className="text-[11px] tracking-wider text-gold-300 uppercase">Business</div>
        </div>
      </div>
      <TenantSwitcher />
      <nav
        className="flex-1 space-y-5 overflow-y-auto px-3 pt-2 pb-6 [scrollbar-width:thin]"
        aria-label="Main"
      >
        {NAV.map((g, gi) => {
          const items = groups[gi] ?? [];
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-emerald-300/70 uppercase">
                {g.group}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const count = item.badge ? badges[item.badge] : 0;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        {...(onNavigate ? { onClick: onNavigate } : {})}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
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
                            <span className="flex-1">{item.label}</span>
                            {count > 0 ? (
                              <span className="min-w-5 rounded-full bg-azure-500 px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular-nums">
                                {count}
                              </span>
                            ) : null}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

function TenantSwitcher() {
  const session = useSession();
  const storefront = useTenantQuery(['storefront'], api.storefront.get);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const switchTo = async (id: string) => {
    await api.session.switchTenant(id);
    await qc.invalidateQueries();
    navigate('/today');
  };
  return (
    <div className="px-3 pb-3">
      <Menu>
        <MenuTrigger className="flex w-full items-center gap-3 rounded-xl border border-emerald-800 bg-emerald-950/40 px-3 py-2.5 text-left transition-colors hover:border-emerald-700">
          <StoreLogo
            src={storefront.data?.logo ?? null}
            name={session.tenant.name}
            background="#C8A96A"
            color="#061713"
            className="size-8 rounded-lg text-sm"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{session.tenant.name}</span>
            <span className="block truncate text-[11px] text-emerald-300/80">
              {session.tenant.vertical === 'spa' ? 'Spa' : 'Short-stay'} ·{' '}
              {ROLE_LABELS[session.role]}
            </span>
          </span>
          <ChevronsUpDown className="size-4 text-emerald-300/80" />
        </MenuTrigger>
        <MenuContent align="start" className="w-64">
          <MenuLabel>Your Houses</MenuLabel>
          {session.memberships.map((m) => (
            <MenuItem key={m.tenantId} onSelect={() => void switchTo(m.tenantId)}>
              <span className="flex size-7 items-center justify-center rounded-md bg-emerald-100 text-xs font-semibold text-emerald-800">
                {m.tenantName.slice(0, 1)}
              </span>
              <span className="flex-1">
                <span className="block text-sm">{m.tenantName}</span>
                <span className="block text-xs text-ink-subtle">{ROLE_LABELS[m.role]}</span>
              </span>
              {m.tenantId === session.tenant.id ? (
                <Check className="size-4 text-emerald-700" />
              ) : null}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}

function UserMenu() {
  const session = useSession();
  const qc = useQueryClient();
  const viewAs = async (role: TenantRole | null) => {
    await api.session.setViewAs(role);
    await qc.invalidateQueries();
  };
  return (
    <Menu>
      <MenuTrigger className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-emerald-50">
        <Avatar name={session.personName} size="sm" tone="gold" />
        <span className="hidden text-sm font-medium md:block">
          {session.personName.split(' ')[0]}
        </span>
      </MenuTrigger>
      <MenuContent className="w-60">
        <div className="px-2.5 py-2">
          <div className="text-sm font-medium">{session.personName}</div>
          <div className="text-xs text-ink-subtle">{ROLE_LABELS[session.role]} · 2FA on</div>
        </div>
        {session.role === 'owner' || session.viewAs ? (
          <>
            <MenuSeparator />
            <MenuLabel>See the app as</MenuLabel>
            {(Object.keys(ROLE_LABELS) as TenantRole[]).map((r) => (
              <MenuItem key={r} onSelect={() => void viewAs(r === 'owner' ? null : r)}>
                <Eye className="size-4 text-ink-subtle" />
                <span className="flex-1">{ROLE_LABELS[r]}</span>
                {(session.viewAs ?? 'owner') === r ? (
                  <Check className="size-4 text-emerald-700" />
                ) : null}
              </MenuItem>
            ))}
          </>
        ) : null}
        <MenuSeparator />
        <MenuItem
          onSelect={() => {
            void api.session.signOut().then(() => qc.invalidateQueries());
          }}
        >
          <LogOut className="size-4 text-ink-subtle" /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { openNewBooking, setPaletteOpen } = useUi();
  const can = useCan();
  const alerts = useTenantQuery(['alerts'], api.alerts);
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenNav}
        aria-label="Open menu"
      >
        <MenuIcon className="size-5" />
      </Button>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex h-10 min-w-0 max-w-md flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-ink-subtle transition-colors hover:border-line-strong"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search or ask anything…</span>
        <span className="hidden sm:inline">
          <Kbd>Ctrl K</Kbd>
        </span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Menu>
          <MenuTrigger
            className="relative rounded-lg p-2 text-ink-muted hover:bg-emerald-50 hover:text-ink"
            aria-label="Notifications"
          >
            <Bell className="size-5" />
            {alerts.data?.length ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-azure-500 ring-2 ring-canvas" />
            ) : null}
          </MenuTrigger>
          <MenuContent className="w-80">
            <MenuLabel>Alerts</MenuLabel>
            {alerts.data?.length ? (
              alerts.data.map((a) => (
                <MenuItem key={a.id} onSelect={() => navigate(a.to)}>
                  <span
                    className={cn(
                      'mt-1 size-2 shrink-0 self-start rounded-full',
                      a.tone === 'red'
                        ? 'bg-red-600'
                        : a.tone === 'amber'
                          ? 'bg-amber-500'
                          : 'bg-azure-500',
                    )}
                  />
                  <span>
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="block text-xs text-ink-muted">{a.body}</span>
                  </span>
                </MenuItem>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-ink-muted">All clear.</div>
            )}
          </MenuContent>
        </Menu>
        {can('booking.create') ? (
          <Button onClick={() => openNewBooking()} className="hidden sm:inline-flex">
            <Plus className="size-4" /> New booking
          </Button>
        ) : null}
        <UserMenu />
      </div>
    </header>
  );
}

function MobileTabs({ onMore }: { onMore: () => void }) {
  const groups = useNavItems();
  const items = groups.flat().filter((i) => MOBILE_TABS.includes(i.to));
  const badges = useBadges();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
              isActive ? 'text-emerald-800' : 'text-ink-subtle',
            )
          }
        >
          <item.icon className="size-5" />
          {item.label}
          {item.badge && badges[item.badge] > 0 ? (
            <span className="absolute top-1 left-1/2 ml-2 min-w-4 rounded-full bg-azure-500 px-1 text-[10px] leading-4 text-white">
              {badges[item.badge]}
            </span>
          ) : null}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMore}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-subtle"
      >
        <MoreHorizontal className="size-5" />
        More
      </button>
    </nav>
  );
}

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const session = useSession();
  const location = useLocation();
  const { setPaletteOpen, openNewBooking } = useUi();
  const can = useCan();

  useEffect(() => setNavOpen(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar />
      </aside>
      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-emerald-950/40"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 animate-fade-in shadow-pop">
            <Sidebar onNavigate={() => setNavOpen(false)} />
            <button
              type="button"
              className="absolute top-4 right-3 rounded-lg p-1.5 text-emerald-200 hover:bg-emerald-800"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      ) : null}
      <div className="min-w-0 lg:pl-64">
        {session.assistBy ? (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gold-400 px-4 py-2 text-[13px] font-medium text-emerald-950">
            <Wrench className="size-4" />
            <span>
              Stayvinci support ({session.assistBy}) is managing {session.tenant.name} with full
              control. Every change shows in this House&apos;s activity log.
            </span>
            <button
              type="button"
              className="rounded-lg bg-emerald-900 px-2.5 py-1 text-ivory hover:bg-emerald-800"
              onClick={() =>
                void api.session.signOut().then(() => {
                  window.location.replace('/');
                })
              }
            >
              Finish helping
            </button>
          </div>
        ) : null}
        {session.viewAs ? (
          <div className="flex items-center justify-center gap-2 bg-azure-500 px-4 py-1.5 text-[13px] font-medium text-white">
            <Eye className="size-4" /> Previewing as {ROLE_LABELS[session.viewAs]}: you see what
            they see.
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => void api.session.setViewAs(null).then(() => window.location.reload())}
            >
              Exit preview
            </button>
          </div>
        ) : null}
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
          {session.tenant.status === 'past_due' ? (
            <Badge tone="red">Your Stayvinci invoice is past due</Badge>
          ) : null}
          <RouteHint />
          <Outlet />
        </main>
      </div>
      {can('booking.create') ? (
        <button
          type="button"
          onClick={() => openNewBooking()}
          className="fixed right-4 bottom-20 z-30 flex size-14 items-center justify-center rounded-full bg-emerald-sheen-soft text-ivory shadow-pop sm:hidden"
          aria-label="New booking"
        >
          <Plus className="size-6" />
        </button>
      ) : null}
      <MobileTabs onMore={() => setNavOpen(true)} />
      <BookingDrawer />
      <NewBookingDialog />
      <CommandPalette />
    </div>
  );
}
