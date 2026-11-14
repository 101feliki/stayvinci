import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  Circle,
  LogIn,
  LogOut,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatTile,
  cn,
} from '@stayvinci/ui';
import { api } from '../../lib/api';
import type { Booking } from '../../mock/types';
import { useCan, useSession } from '../../app/session';
import { useBookingDrawer } from '../../app/ui';
import { ErrorState, PageSkeleton, StateBadge } from '../../components/common';
import { dayKey, guestName, money, time } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

function greeting() {
  const h = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Africa/Nairobi',
    }).format(new Date()),
  );
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function TodayPage() {
  const session = useSession();
  const { tenant } = session;
  const can = useCan();
  const tz = tenant.timezone;
  const bookings = useTenantQuery(['bookings'], api.bookings.list);
  const guests = useTenantQuery(['guests'], api.guests.list, { enabled: can('guest.view') });
  const catalogue = useTenantQuery(['catalogue'], api.catalogue.get);
  const team = useTenantQuery(['team'], api.team.list);
  const alerts = useTenantQuery(['alerts'], api.alerts);
  const setup = useTenantQuery(['setup'], api.setup);
  const drawer = useBookingDrawer();
  const checkIn = useAction((id: string) => api.bookings.transition(id, 'checked_in'), {
    success: 'Checked in',
  });

  const today = dayKey(new Date(), tz);
  const data = useMemo(() => {
    const all = bookings.data ?? [];
    const live = all.filter((b) => !b.state.startsWith('cancelled'));
    if (tenant.vertical === 'short_stay') {
      const arrivals = live.filter((b) => dayKey(b.start, tz) === today);
      const departures = live.filter((b) => dayKey(b.end, tz) === today);
      const inHouse = live.filter((b) => b.state === 'checked_in');
      return { arrivals, departures, inHouse, todays: [...arrivals, ...departures] };
    }
    const todays = live
      .filter((b) => dayKey(b.start, tz) === today)
      .sort((a, b) => a.start.localeCompare(b.start));
    return {
      todays,
      arrivals: [] as Booking[],
      departures: [] as Booking[],
      inHouse: [] as Booking[],
    };
  }, [bookings.data, tenant.vertical, today, tz]);

  if (bookings.error) return <ErrorState error={bookings.error} />;
  if (!bookings.data) return <PageSkeleton />;

  const guestMap = new Map((guests.data ?? []).map((g) => [g.id, g]));
  const svcMap = new Map((catalogue.data?.services ?? []).map((s) => [s.id, s]));
  const resMap = new Map((team.data?.resources ?? []).map((r) => [r.id, r]));
  const nowIso = new Date().toISOString();
  const expected = data.todays.reduce((n, b) => n + b.total, 0);
  const unpaid = data.todays.filter((b) => b.total > b.paid && b.state !== 'no_show');
  const unpaidSum = unpaid.reduce((n, b) => n + (b.total - b.paid), 0);
  const arrived = data.todays.filter(
    (b) => b.state === 'checked_in' || b.state === 'completed',
  ).length;
  const next = data.todays.find((b) => b.start > nowIso && b.state === 'confirmed');
  const setupIncomplete = setup.data && setup.data.status !== 'live';

  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  }).format(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={dateLabel}
        title={`${greeting()}, ${session.personName.split(' ')[0]}`}
        description={
          tenant.vertical === 'spa'
            ? next
              ? `Next up at ${time(next.start, tz)}: ${svcMap.get(next.serviceId ?? '')?.name ?? 'booking'} with ${resMap.get(next.staffId ?? '')?.name.split(' ')[0] ?? 'your team'}.`
              : 'No more upcoming bookings today.'
            : `${data.arrivals.length} arriving, ${data.departures.length} departing, ${data.inHouse.length} in house.`
        }
      />

      {setupIncomplete && setup.data ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 bg-emerald-card p-5 text-ivory sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="text-xs font-semibold tracking-wider text-gold-300 uppercase">
                Setup checklist
              </div>
              <div className="mt-1 text-lg font-semibold">
                Finish these steps to open your store
              </div>
              <div className="mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-emerald-800">
                <div
                  className="h-full rounded-full bg-gold-400"
                  style={{
                    width: `${(setup.data.items.filter((i) => i.done).length / setup.data.items.length) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-1.5 text-xs text-emerald-200">
                {setup.data.items.filter((i) => i.done).length} of {setup.data.items.length}{' '}
                complete
              </div>
            </div>
            <Button variant="gold" disabled>
              Publish store
            </Button>
          </div>
          <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {setup.data.items.map((i) => (
              <li key={i.key} className="bg-surface">
                <Link
                  to={i.to}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-canvas"
                >
                  {i.done ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <Circle className="size-4 text-ink-subtle" />
                  )}
                  <span className={cn('flex-1', i.done && 'text-ink-muted line-through')}>
                    {i.label}
                  </span>
                  {!i.done ? <ArrowRight className="size-4 text-azure-600" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tenant.vertical === 'spa' ? (
          <>
            <StatTile
              label="Bookings today"
              value={data.todays.length}
              sub={`${arrived} arrived so far`}
              icon={<CalendarCheck className="size-4" />}
            />
            <StatTile
              label="Expected revenue"
              value={money(expected, 'KES', { compact: true })}
              sub="Today, all states"
              icon={<Wallet className="size-4" />}
              accent="gold"
            />
            <StatTile
              label="Balances due"
              value={money(unpaidSum, 'KES', { compact: true })}
              sub={`${unpaid.length} bookings`}
              icon={<AlertTriangle className="size-4" />}
              accent="plum"
            />
            <StatTile
              label="Team on duty"
              value={(team.data?.resources ?? []).filter((r) => r.type === 'staff').length}
              sub="See calendar"
              icon={<Users className="size-4" />}
              accent="azure"
            />
          </>
        ) : (
          <>
            <StatTile
              label="Arrivals"
              value={data.arrivals.length}
              icon={<LogIn className="size-4" />}
            />
            <StatTile
              label="Departures"
              value={data.departures.length}
              icon={<LogOut className="size-4" />}
              accent="gold"
            />
            <StatTile
              label="In house"
              value={data.inHouse.length}
              icon={<BedDouble className="size-4" />}
              accent="azure"
            />
            <StatTile
              label="Occupancy tonight"
              value={`${Math.round((data.inHouse.length / Math.max(1, (team.data?.resources ?? []).filter((r) => r.type === 'unit').length)) * 100)}%`}
              icon={<Users className="size-4" />}
              accent="plum"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title={tenant.vertical === 'spa' ? 'Today’s schedule' : 'Arrivals and departures'}
            description={
              tenant.vertical === 'spa'
                ? 'Tap a booking for details. Check guests in as they arrive.'
                : 'Check-in details release only when payment and registration are complete.'
            }
            action={
              <Link
                to="/calendar"
                className="text-[13px] font-medium text-azure-700 hover:underline"
              >
                Open calendar
              </Link>
            }
          />
          {data.todays.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck className="size-5" />}
              title="Nothing booked today"
              description="Walk-ins and phone bookings can be added with New booking."
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.todays.map((b) => {
                const g = guestMap.get(b.guestId);
                const past = b.end < nowIso;
                const current = b.start <= nowIso && b.end > nowIso;
                const isDeparture = tenant.vertical === 'short_stay' && dayKey(b.end, tz) === today;
                return (
                  <li
                    key={`${b.id}${isDeparture ? 'd' : 'a'}`}
                    className={cn(
                      'flex items-center gap-4 px-5 py-3',
                      past && 'opacity-60',
                      current && 'bg-azure-50/50',
                    )}
                  >
                    <div className="w-14 shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {time(isDeparture ? b.end : b.start, tz)}
                      </div>
                      {tenant.vertical === 'spa' ? (
                        <div className="text-xs text-ink-subtle tabular-nums">
                          {time(b.end, tz)}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className="h-10 w-1 shrink-0 rounded-full"
                      style={{
                        background:
                          resMap.get(b.staffId ?? '')?.colour ??
                          (isDeparture ? '#c8a96a' : '#236e56'),
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => drawer.open(b.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-medium">
                        {g ? guestName(g) : 'Guest'}
                        {tenant.vertical === 'short_stay' ? (
                          <Badge tone={isDeparture ? 'gold' : 'emerald'} className="ml-2">
                            {isDeparture ? 'Departure' : 'Arrival'}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="truncate text-[13px] text-ink-muted">
                        {svcMap.get(b.serviceId ?? '')?.name ?? resMap.get(b.unitId ?? '')?.name}
                        {b.staffId ? ` · ${resMap.get(b.staffId)?.name.split(' ')[0]}` : ''}
                        {b.roomId ? ` · ${resMap.get(b.roomId)?.name}` : ''}
                      </div>
                    </button>
                    <div className="hidden sm:block">
                      <StateBadge state={b.state} />
                    </div>
                    {b.state === 'confirmed' && can('booking.edit') && !isDeparture ? (
                      <Button size="sm" variant="secondary" onClick={() => checkIn.mutate(b.id)}>
                        <LogIn className="size-3.5" /> Check in
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Needs attention" />
            {alerts.data?.length ? (
              <ul className="divide-y divide-line">
                {alerts.data.map((a) => (
                  <li key={a.id}>
                    <Link to={a.to} className="flex gap-3 px-5 py-3.5 hover:bg-canvas">
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          a.tone === 'red'
                            ? 'bg-red-600'
                            : a.tone === 'amber'
                              ? 'bg-amber-500'
                              : 'bg-azure-500',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{a.title}</span>
                        <span className="block text-[13px] text-ink-muted">{a.body}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-ink-muted">
                All clear. Nothing needs you right now.
              </div>
            )}
          </Card>
          {tenant.vertical === 'spa' && team.data ? (
            <Card>
              <CardHeader title="Team today" />
              <ul className="divide-y divide-line">
                {team.data.resources
                  .filter((r) => r.type === 'staff')
                  .map((s) => {
                    const mine = data.todays.filter((b) => b.staffId === s.id);
                    const busy = mine.some((b) => b.start <= nowIso && b.end > nowIso);
                    return (
                      <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                        <Avatar name={s.name} size="sm" />
                        <span className="flex-1 text-sm">{s.name}</span>
                        <span className="text-xs text-ink-subtle">{mine.length} booked</span>
                        <span
                          className={cn(
                            'size-2 rounded-full',
                            busy ? 'bg-azure-500' : 'bg-emerald-400',
                          )}
                          title={busy ? 'In session' : 'Free'}
                        />
                      </li>
                    );
                  })}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
