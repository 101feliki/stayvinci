import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, Building2, CheckCircle2, Sparkles, TriangleAlert, Wallet } from 'lucide-react';
import { Badge, Card, CardHeader, PageHeader, StatTile, cn } from '@stayvinci/ui';
import { money, pct, relative } from '@stayvinci/demo-data/format';
import { api } from '../../mock/api';
import { ColumnChart } from '../../components/charts';
import { Change, ErrorState, PageSkeleton } from '../../components/common';
import { STATUS_ORDER, TENANT_STATUS } from '../../lib/labels';
import { useSession } from '../../app/session';

const TONE_DOT = { red: 'bg-red-500', amber: 'bg-amber-500', azure: 'bg-azure-500' } as const;

export function OverviewPage() {
  const s = useSession();
  const q = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const d = q.data;
  const live = d.byStatus.live ?? 0;
  const growth =
    d.money && d.money.prev30Volume ? d.money.last30.volume / d.money.prev30Volume - 1 : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date())}
        title={`Hello, ${s.staff.name.split(' ')[0] ?? s.staff.name}`}
        description="How the platform is doing right now."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Houses"
          value={d.tenants}
          sub={`${live} live · ${d.newSignups30} joined in 30 days`}
          icon={<Building2 className="size-4" />}
        />
        {d.money ? (
          <>
            <StatTile
              label="Paid to Houses, 30 days"
              value={money(d.money.last30.volume, 'KES', { compact: true })}
              sub={
                <>
                  <Change value={growth} /> vs previous 30 days
                </>
              }
              icon={<Wallet className="size-4" />}
              accent="gold"
            />
            <StatTile
              label="Payment success, 30 days"
              value={pct(d.money.last30.successRate)}
              sub={`${d.money.last30.count.toLocaleString('en-KE')} payment attempts`}
              icon={<CheckCircle2 className="size-4" />}
              accent="azure"
            />
            <StatTile
              label="Today"
              value={money(d.money.today.volume, 'KES', { compact: true })}
              sub={`${d.money.today.count} payments · ${d.money.today.pending} waiting`}
              icon={<Activity className="size-4" />}
              accent="plum"
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {d.money ? (
            <Card>
              <CardHeader
                title="Money paid to Houses, last 30 days"
                description="Successful guest payments into Houses' own Paybills and Tills."
                action={
                  <Link to="/transactions" className="text-sm font-medium text-azure-700">
                    All transactions
                  </Link>
                }
              />
              <div className="p-5">
                <ColumnChart
                  ariaLabel="Daily payment volume, last 30 days"
                  data={d.money.daily.map((x) => ({
                    label: x.day.slice(8),
                    value: x.value,
                    sub: new Intl.DateTimeFormat('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    }).format(new Date(x.day)),
                  }))}
                  format={(v) => money(v, 'KES', { compact: true })}
                />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Houses by stage"
              action={
                <Link to="/onboarding" className="text-sm font-medium text-azure-700">
                  Onboarding board
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl bg-line sm:grid-cols-4">
              {STATUS_ORDER.map((st) => (
                <Link
                  key={st}
                  to={`/houses?status=${st}`}
                  className="min-w-0 bg-surface p-4 transition-colors hover:bg-canvas"
                >
                  <div className="text-2xl font-semibold tabular-nums">{d.byStatus[st] ?? 0}</div>
                  <Badge tone={TENANT_STATUS[st].tone} dot>
                    {TENANT_STATUS[st].label}
                  </Badge>
                </Link>
              ))}
              <Link
                to="/houses"
                className="min-w-0 bg-surface p-4 transition-colors hover:bg-canvas"
              >
                <div className="text-2xl font-semibold tabular-nums">{d.tenants}</div>
                <span className="text-[13px] font-medium text-azure-700">All Houses</span>
              </Link>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Needs attention" description="Sorted by urgency." />
            {d.attention.length === 0 ? (
              <div className="flex items-center gap-2 p-5 text-sm text-ink-muted">
                <Sparkles className="size-4 text-gold-500" /> All clear.
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {d.attention.map((a) => (
                  <li key={a.title}>
                    <Link
                      to={`/houses/${a.tenantId}`}
                      className="flex gap-3 px-5 py-3.5 hover:bg-canvas"
                    >
                      <span
                        className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_DOT[a.tone])}
                      />
                      <span>
                        <span className="block text-sm font-medium">{a.title}</span>
                        <span className="block text-[13px] text-ink-muted">{a.body}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Latest activity"
              action={
                <Link to="/activity" className="text-sm font-medium text-azure-700">
                  Activity log
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {d.recentActivity.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex items-start gap-2">
                    {a.role === 'system' ? (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    ) : null}
                    <div className="min-w-0">
                      <div className="text-sm">{a.detail}</div>
                      <div className="text-xs text-ink-subtle">
                        {a.actor} · {relative(a.at)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
