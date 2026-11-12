import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Info, Repeat, TrendingUp, Users } from 'lucide-react';
import { Card, CardHeader, PageHeader, StatTile, Table, Td, Th, Tr } from '@stayvinci/ui';
import { money, pct } from '@stayvinci/demo-data/format';
import { api } from '../../mock/api';
import { ColumnChart } from '../../components/charts';
import { Change, ErrorState, PageSkeleton, downloadCsv } from '../../components/common';
import { PLAN_LABEL } from '../../lib/labels';

const fmtMonth = (m: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(new Date(`${m}-01`));

/**
 * "Does Stayvinci grow revenue for businesses?"
 * Two honest comparisons per House:
 *  - first full month on Stayvinci vs the latest full month (measured)
 *  - latest full month vs the monthly revenue the owner declared at sign-up (self-reported)
 */
export function InsightsPage() {
  const q = useQuery({ queryKey: ['insights'], queryFn: api.insights });
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const rows = [...q.data.perTenant].sort((a, b) => b.growth - a.growth);
  const grew = rows.filter((r) => r.growth > 0).length;
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? (s[Math.floor(s.length / 2)] ?? 0) : 0;
  };
  const medGrowth = median(rows.map((r) => r.growth));
  const withBaseline = rows.filter((r) => r.vsBaseline !== null);
  const medBaseline = median(withBaseline.map((r) => r.vsBaseline ?? 0));
  const repeatUp = rows.filter((r) => r.repeatLatest > r.repeatFirst).length;
  const pm = q.data.platformMonthly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Growth insights"
        description="Is Stayvinci growing revenue for the Houses that use it?"
        actions={
          <button
            type="button"
            className="text-sm font-medium text-azure-700"
            onClick={() =>
              downloadCsv('stayvinci-house-growth.csv', [
                [
                  'house',
                  'plan',
                  'months_live',
                  'first_full_month_kes',
                  'latest_full_month_kes',
                  'growth',
                  'declared_before_kes',
                  'vs_declared',
                  'repeat_first',
                  'repeat_latest',
                  'marketplace_guests',
                ],
                ...rows.map((r) => [
                  r.name,
                  r.plan,
                  r.monthsLive,
                  r.firstRevenue / 100,
                  r.latestRevenue / 100,
                  r.growth.toFixed(3),
                  r.baseline !== null ? r.baseline / 100 : '',
                  r.vsBaseline !== null ? r.vsBaseline.toFixed(3) : '',
                  r.repeatFirst.toFixed(3),
                  r.repeatLatest.toFixed(3),
                  r.marketplaceGuests,
                ]),
              ])
            }
          >
            Export CSV
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Houses growing"
          value={`${grew} of ${rows.length}`}
          sub="Latest month above their first"
          icon={<TrendingUp className="size-4" />}
        />
        <StatTile
          label="Typical growth"
          value={<Change value={medGrowth} />}
          sub="Median, first full month to latest"
          accent="gold"
        />
        <StatTile
          label="Vs before Stayvinci"
          value={<Change value={withBaseline.length ? medBaseline : null} />}
          sub={`Median of ${withBaseline.length} owner-declared figures`}
          icon={<Users className="size-4" />}
          accent="azure"
        />
        <StatTile
          label="More returning guests"
          value={`${repeatUp} of ${rows.length}`}
          sub="Repeat rate up since the first month"
          icon={<Repeat className="size-4" />}
          accent="plum"
        />
      </div>

      <Card>
        <CardHeader
          title="Revenue through Stayvinci, all Houses"
          description="Grows with both new Houses and existing Houses selling more. The current month is partial."
        />
        <div className="p-5">
          <ColumnChart
            ariaLabel="Platform revenue by month"
            data={pm.map((m) => ({
              label: fmtMonth(m.month),
              value: m.revenue,
              sub: `${fmtMonth(m.month)} · ${m.bookings} bookings`,
            }))}
            format={(v) => money(v, 'KES', { compact: true })}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="By House" description="Sorted by growth." />
        <Table>
          <thead>
            <tr>
              <Th>House</Th>
              <Th className="text-right">Months live</Th>
              <Th className="text-right">First full month</Th>
              <Th className="text-right">Latest full month</Th>
              <Th className="text-right">Growth</Th>
              <Th className="text-right">Vs before</Th>
              <Th className="text-right">Returning guests</Th>
              <Th className="text-right">Marketplace guests</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.tenantId}>
                <Td>
                  <Link to={`/houses/${r.tenantId}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <div className="text-xs text-ink-subtle">{PLAN_LABEL[r.plan]}</div>
                </Td>
                <Td className="text-right tabular-nums">{r.monthsLive}</Td>
                <Td className="text-right tabular-nums">
                  {money(r.firstRevenue, 'KES', { compact: true })}
                </Td>
                <Td className="text-right tabular-nums">
                  {money(r.latestRevenue, 'KES', { compact: true })}
                </Td>
                <Td className="text-right tabular-nums">
                  <Change value={r.growth} />
                </Td>
                <Td className="text-right tabular-nums">
                  <Change value={r.vsBaseline} />
                </Td>
                <Td className="text-right tabular-nums">
                  {pct(r.repeatFirst)} → {pct(r.repeatLatest)}
                </Td>
                <Td className="text-right tabular-nums">{r.marketplaceGuests}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="flex gap-3 p-5 text-[13px] text-ink-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-azure-600" />
        <p>
          &quot;Vs before&quot; uses the monthly revenue each owner declared when they signed up, so
          treat it as a guide. The measured comparison is first full month against the latest one.
          Revenue here is only what was paid through Stayvinci; cash and walk-ins outside the app
          aren&apos;t counted.
        </p>
      </Card>
    </div>
  );
}
