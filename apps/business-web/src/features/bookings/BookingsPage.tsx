import { useMemo, useState } from 'react';
import { ClipboardList, Download, Plus, Search } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Segmented,
  Select,
  Table,
  Td,
  Th,
  Tr,
} from '@stayvinci/ui';
import { api } from '../../lib/api';
import type { BookingState } from '../../mock/types';
import { useCan, useSession } from '../../app/session';
import { useBookingDrawer, useUi } from '../../app/ui';
import { ErrorState, PageSkeleton, StateBadge, downloadCsv } from '../../components/common';
import { dateTime, dayKey, guestName, money } from '../../lib/format';
import { BOOKING_STATE } from '../../lib/states';
import { useTenantQuery } from '../../lib/query';

type Range = 'upcoming' | 'today' | 'past' | 'all';

export function BookingsPage() {
  const { tenant } = useSession();
  const can = useCan();
  const tz = tenant.timezone;
  const bookings = useTenantQuery(['bookings'], api.bookings.list);
  const guests = useTenantQuery(['guests'], api.guests.list, { enabled: can('guest.view') });
  const catalogue = useTenantQuery(['catalogue'], api.catalogue.get);
  const team = useTenantQuery(['team'], api.team.list);
  const drawer = useBookingDrawer();
  const { openNewBooking } = useUi();
  const [range, setRange] = useState<Range>('upcoming');
  const [state, setState] = useState<BookingState | 'all'>('all');
  const [staff, setStaff] = useState('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(50);

  const guestMap = useMemo(() => new Map((guests.data ?? []).map((g) => [g.id, g])), [guests.data]);
  const resMap = useMemo(
    () => new Map((team.data?.resources ?? []).map((r) => [r.id, r])),
    [team.data],
  );
  const svcMap = useMemo(
    () => new Map((catalogue.data?.services ?? []).map((s) => [s.id, s])),
    [catalogue.data],
  );

  const rows = useMemo(() => {
    const now = new Date().toISOString();
    const today = dayKey(new Date(), tz);
    return (bookings.data ?? [])
      .filter((b) => {
        if (range === 'upcoming' && b.end < now) return false;
        if (range === 'past' && b.end >= now) return false;
        if (range === 'today' && dayKey(b.start, tz) !== today) return false;
        if (state !== 'all' && b.state !== state) return false;
        if (staff !== 'all' && b.staffId !== staff && b.unitId !== staff) return false;
        if (q) {
          const g = guestMap.get(b.guestId);
          const hay = `${b.ref} ${g ? guestName(g) : ''}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) =>
        range === 'past' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start),
      );
  }, [bookings.data, range, state, staff, q, guestMap, tz]);

  if (bookings.error) return <ErrorState error={bookings.error} />;
  if (!bookings.data) return <PageSkeleton />;

  const people = (team.data?.resources ?? []).filter(
    (r) => r.type === 'staff' || r.type === 'unit',
  );

  const exportCsv = () =>
    downloadCsv(`bookings-${range}.csv`, [
      ['Reference', 'Start', 'Guest', 'Service', 'With', 'State', 'Total (KES)', 'Paid (KES)'],
      ...rows.map((b) => [
        b.ref,
        dateTime(b.start, tz),
        guestName(guestMap.get(b.guestId)),
        svcMap.get(b.serviceId ?? '')?.name ?? resMap.get(b.unitId ?? '')?.name ?? '',
        resMap.get(b.staffId ?? '')?.name ?? '',
        BOOKING_STATE[b.state].label,
        b.total / 100,
        b.paid / 100,
      ]),
    ]);

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Every booking across your team and rooms. Click one to check in, move, cancel or refund."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="size-4" /> Export
            </Button>
            {can('booking.create') ? (
              <Button onClick={() => openNewBooking()}>
                <Plus className="size-4" /> New booking
              </Button>
            ) : null}
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <Segmented
            value={range}
            onChange={setRange}
            items={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'today', label: 'Today' },
              { value: 'past', label: 'Past' },
              { value: 'all', label: 'All' },
            ]}
          />
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <Input
              className="pl-9"
              placeholder="Search by guest or reference"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-96">
            <Select
              value={state}
              onChange={(e) => setState(e.target.value as BookingState | 'all')}
              aria-label="Filter by state"
            >
              <option value="all">All states</option>
              {(Object.keys(BOOKING_STATE) as BookingState[]).map((s) => (
                <option key={s} value={s}>
                  {BOOKING_STATE[s].label}
                </option>
              ))}
            </Select>
            <Select
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              aria-label="Filter by person or unit"
            >
              <option value="all">{tenant.vertical === 'spa' ? 'All team' : 'All units'}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="No bookings match"
            description="Try a different range or clear the filters."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Guest</Th>
                  <Th>{tenant.vertical === 'spa' ? 'Service' : 'Unit'}</Th>
                  {tenant.vertical === 'spa' ? (
                    <Th className="hidden md:table-cell">With</Th>
                  ) : null}
                  <Th>State</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="hidden text-right sm:table-cell">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((b) => {
                  const g = guestMap.get(b.guestId);
                  const balance = b.total - b.paid;
                  return (
                    <Tr key={b.id} className="cursor-pointer" onClick={() => drawer.open(b.id)}>
                      <Td className="whitespace-nowrap">
                        <div className="font-medium">{dateTime(b.start, tz)}</div>
                        <div className="font-mono text-xs text-ink-subtle">{b.ref}</div>
                      </Td>
                      <Td>{g ? guestName(g) : <span className="text-ink-subtle">Guest</span>}</Td>
                      <Td>
                        {svcMap.get(b.serviceId ?? '')?.name ?? resMap.get(b.unitId ?? '')?.name}
                      </Td>
                      {tenant.vertical === 'spa' ? (
                        <Td className="hidden md:table-cell">
                          {resMap.get(b.staffId ?? '')?.name.split(' ')[0]}
                        </Td>
                      ) : null}
                      <Td>
                        <StateBadge state={b.state} />
                      </Td>
                      <Td className="text-right tabular-nums">{money(b.total)}</Td>
                      <Td className="hidden text-right tabular-nums sm:table-cell">
                        {balance > 0 && !b.state.startsWith('cancelled') ? (
                          <span className="text-amber-700">{money(balance)}</span>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] text-ink-muted">
              <span>
                Showing {Math.min(limit, rows.length)} of {rows.length}
              </span>
              {rows.length > limit ? (
                <Button size="sm" variant="secondary" onClick={() => setLimit((l) => l + 50)}>
                  Show more
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
