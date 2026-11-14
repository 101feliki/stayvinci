import { useMemo, useState } from 'react';
import { Download, Table2, BarChart3 } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  PageHeader,
  Segmented,
  StatTile,
  Table,
  Td,
  Th,
  Tr,
} from '@stayvinci/ui';
import { api, addDaysKey, todayKey } from '../../lib/api';
import { useCan, useSession } from '../../app/session';
import { ErrorState, PageSkeleton, downloadCsv } from '../../components/common';
import { BarList, ColumnChart, type Datum } from '../../components/charts';
import { dayKey, dayLabel, money, pct, zonedToUtc } from '../../lib/format';
import { useTenantQuery } from '../../lib/query';

type Range = '7' | '30' | '90';

export function ReportsPage() {
  const { tenant } = useSession();
  const can = useCan();
  const tz = tenant.timezone;
  const [range, setRange] = useState<Range>('30');
  const [asTable, setAsTable] = useState(false);
  const bookings = useTenantQuery(['bookings'], api.bookings.list);
  const catalogue = useTenantQuery(['catalogue'], api.catalogue.get);
  const team = useTenantQuery(['team'], api.team.list);
  const financial = can('report.financial.view');

  const r = useMemo(() => {
    const days = Number(range);
    const end = todayKey(tz);
    const start = addDaysKey(end, -(days - 1));
    const inRange = (bookings.data ?? []).filter((b) => {
      const k = dayKey(b.start, tz);
      return k >= start && k <= end;
    });
    const completed = inRange.filter((b) => b.state === 'completed' || b.state === 'checked_in');
    const revenue = completed.reduce((n, b) => n + b.total, 0);
    const byDay: Datum[] = Array.from({ length: days }, (_, i) => {
      const k = addDaysKey(start, i);
      const v = completed.filter((b) => dayKey(b.start, tz) === k).reduce((n, b) => n + b.total, 0);
      return { label: k.slice(8), value: v, sub: dayLabel(zonedToUtc(k, '12:00', tz), tz) };
    });
    const sum = (
      key: (b: (typeof completed)[number]) => string | null,
      name: (id: string) => string,
    ) => {
      const m = new Map<string, number>();
      for (const b of completed) {
        const k = key(b);
        if (k) m.set(k, (m.get(k) ?? 0) + b.total);
      }
      return [...m.entries()]
        .map(([id, value]) => ({ label: name(id), value }))
        .sort((a, b) => b.value - a.value);
    };
    const svc = new Map((catalogue.data?.services ?? []).map((s) => [s.id, s.name]));
    const res = new Map((team.data?.resources ?? []).map((x) => [x.id, x.name]));
    const byService = sum(
      (b) => b.serviceId,
      (id) => svc.get(id) ?? 'Other',
    ).slice(0, 8);
    const byStaff = sum(
      (b) => b.staffId ?? b.unitId,
      (id) => res.get(id) ?? 'Other',
    );
    const noShow = inRange.filter((b) => b.state === 'no_show').length;
    const cancelled = inRange.filter((b) => b.state.startsWith('cancelled')).length;
    const staffCount = Math.max(
      1,
      (team.data?.resources ?? []).filter(
        (x) => x.type === (tenant.vertical === 'spa' ? 'staff' : 'unit'),
      ).length,
    );
    const bookedMinutes = completed.reduce(
      (n, b) => n + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000,
      0,
    );
    const capacity =
      tenant.vertical === 'spa' ? staffCount * days * 10 * 60 : staffCount * days * 24 * 60;
    const memberships = (catalogue.data?.tiers ?? []).reduce(
      (n, t) => n + t.members * t.monthly,
      0,
    );
    const packageLiability = (catalogue.data?.packages ?? []).reduce(
      (n, p) => n + Math.round(p.sold * 0.35) * (p.price / p.credits),
      0,
    );
    return {
      inRange,
      completed,
      revenue,
      byDay,
      byService,
      byStaff,
      noShowRate: inRange.length ? noShow / inRange.length : 0,
      cancelRate: inRange.length ? cancelled / inRange.length : 0,
      utilisation: Math.min(1, bookedMinutes / capacity),
      avg: completed.length ? revenue / completed.length : 0,
      memberships,
      packageLiability,
    };
  }, [bookings.data, catalogue.data, team.data, range, tz, tenant.vertical]);

  if (bookings.error) return <ErrorState error={bookings.error} />;
  if (!bookings.data || !catalogue.data || !team.data) return <PageSkeleton />;

  const fmt = (v: number) => money(v, 'KES', { compact: true });
  const exportCsv = () =>
    downloadCsv(`revenue-${range}d.csv`, [
      ['Date', 'Revenue (KES)'],
      ...r.byDay.map((d) => [d.sub ?? d.label, d.value / 100]),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Revenue counts completed and in-progress bookings, in your time zone."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!financial}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={range}
          onChange={setRange}
          items={[
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {financial ? (
          <StatTile label="Revenue" value={fmt(r.revenue)} sub={`${r.completed.length} bookings`} />
        ) : (
          <StatTile label="Bookings" value={r.completed.length} />
        )}
        {financial ? (
          <StatTile label="Average booking" value={money(Math.round(r.avg))} accent="gold" />
        ) : null}
        <StatTile
          label={tenant.vertical === 'spa' ? 'Team utilisation' : 'Occupancy'}
          value={pct(r.utilisation)}
          accent="azure"
        />
        <StatTile
          label="No-shows"
          value={pct(r.noShowRate)}
          sub={`Cancellations ${pct(r.cancelRate)}`}
          accent="plum"
        />
      </div>

      {financial ? (
        <Card>
          <CardHeader
            title="Revenue by day"
            action={
              <Button size="sm" variant="ghost" onClick={() => setAsTable((v) => !v)}>
                {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}{' '}
                {asTable ? 'Chart' : 'Table'}
              </Button>
            }
          />
          <div className="p-5">
            {asTable ? (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th className="text-right">Revenue</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.byDay.map((d) => (
                      <Tr key={d.sub}>
                        <Td>{d.sub}</Td>
                        <Td className="text-right tabular-nums">{money(d.value)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <ColumnChart
                data={r.byDay}
                format={fmt}
                ariaLabel={`Revenue by day, last ${range} days`}
              />
            )}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {financial && tenant.vertical === 'spa' ? (
          <Card>
            <CardHeader title="Revenue by service" />
            <div className="p-5">
              <BarList data={r.byService} format={(v) => money(v)} />
            </div>
          </Card>
        ) : null}
        {financial ? (
          <Card>
            <CardHeader
              title={tenant.vertical === 'spa' ? 'Revenue by team member' : 'Revenue by unit'}
            />
            <div className="p-5">
              <BarList data={r.byStaff} format={(v) => money(v)} />
            </div>
          </Card>
        ) : null}
        {financial && tenant.vertical === 'spa' ? (
          <Card>
            <CardHeader
              title="Liabilities"
              description="Value owed to guests as future sessions."
            />
            <div className="grid grid-cols-2 gap-4 p-5">
              <div>
                <div className="text-[13px] text-ink-muted">Unused package credits</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {money(r.packageLiability)}
                </div>
              </div>
              <div>
                <div className="text-[13px] text-ink-muted">Monthly membership revenue</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {money(r.memberships)}
                </div>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
      {!financial ? (
        <p className="text-sm text-ink-muted">
          Financial figures need the “View financial reports” permission.
        </p>
      ) : null}
    </div>
  );
}
