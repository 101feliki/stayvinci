import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Search, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  Segmented,
  Select,
  StatTile,
  Table,
  Td,
  Th,
  Tr,
} from '@stayvinci/ui';
import { dateTime, money, pct } from '@stayvinci/demo-data/format';
import { api, type TxnFilter } from '../../mock/api';
import { BarList, ColumnChart } from '../../components/charts';
import { ErrorState, PageSkeleton, downloadCsv } from '../../components/common';
import { FLOW_LABEL, PAY_LABEL, PROVIDER_STATE, TXN_STATUS } from '../../lib/labels';

const TZ = 'Africa/Nairobi';

/**
 * Clean, cross-House payment data (spec §13 "Payments monitor").
 * These are records of money that went straight to each House; Stayvinci never holds it.
 * Guests appear only as pseudonymous references, so repeat visits can be counted
 * without exposing who they are.
 */
export function TransactionsPage() {
  const [params] = useSearchParams();
  const [f, setF] = useState<TxnFilter>({
    tenantId: params.get('house') ?? 'all',
    status: 'all',
    method: 'all',
    days: 30,
    query: '',
  });
  const q = useQuery({
    queryKey: ['transactions', f],
    queryFn: () => api.transactions.list(f),
    placeholderData: keepPreviousData,
  });
  const conns = useQuery({ queryKey: ['connections'], queryFn: api.transactions.connections });

  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const d = q.data;
  const s = d.summary;
  const name = (id: string) => d.tenants.find((t) => t.id === id)?.name ?? id;

  const exportCsv = () =>
    downloadCsv(`stayvinci-transactions-${f.days}d.csv`, [
      [
        'time_utc',
        'house',
        'booking_ref',
        'guest_ref',
        'new_guest',
        'source',
        'method',
        'flow',
        'purpose',
        'status',
        'failure',
        'amount_kes',
        'confirm_seconds',
      ],
      ...d.rows.map((x) => [
        x.at,
        name(x.tenantId),
        x.bookingRef,
        x.guestRef,
        x.newGuest ? 'yes' : 'no',
        x.attribution,
        x.method,
        x.flow,
        x.purpose,
        x.status,
        x.failure ?? '',
        x.amount / 100,
        x.confirmSeconds ?? '',
      ]),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Every guest payment across all Houses. Money goes straight to each House's own M-Pesa; this is the record."
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={String(f.days) as '1' | '7' | '30' | '90'}
          onChange={(v) => setF({ ...f, days: Number(v) as TxnFilter['days'] })}
          items={[
            { value: '1', label: 'Today' },
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
        />
        <Select
          value={f.tenantId}
          onChange={(e) => setF({ ...f, tenantId: e.target.value })}
          aria-label="House"
          className="w-56"
        >
          <option value="all">All Houses</option>
          {d.tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value as TxnFilter['status'] })}
          aria-label="Status"
          className="w-36"
        >
          <option value="all">Any status</option>
          {(Object.keys(TXN_STATUS) as (keyof typeof TXN_STATUS)[]).map((k) => (
            <option key={k} value={k}>
              {TXN_STATUS[k].label}
            </option>
          ))}
        </Select>
        <Select
          value={f.method}
          onChange={(e) => setF({ ...f, method: e.target.value as TxnFilter['method'] })}
          aria-label="Method"
          className="w-44"
        >
          <option value="all">Paybill and Till</option>
          <option value="paybill">Paybill</option>
          <option value="till">Till (Buy Goods)</option>
        </Select>
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={f.query}
            onChange={(e) => setF({ ...f, query: e.target.value })}
            placeholder="Booking or guest ref"
            className="pl-9"
            aria-label="Search"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Paid to Houses"
          value={money(s.volume, 'KES', { compact: true })}
          sub={`${s.count.toLocaleString('en-KE')} attempts`}
        />
        <StatTile
          label="Success rate"
          value={pct(s.successRate)}
          sub={`${s.pending} still waiting`}
          accent="azure"
        />
        <StatTile
          label="Typical confirmation"
          value={s.medianConfirm !== null ? `${s.medianConfirm}s` : '—'}
          sub="Automatic (Daraja) payments"
          accent="gold"
        />
        <StatTile
          label="From the marketplace"
          value={pct(s.marketplaceShare)}
          sub={`Refunded ${money(s.refunded, 'KES', { compact: true })}`}
          accent="plum"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="min-w-0">
          <CardHeader title="Daily volume" description="Successful payments only." />
          <div className="p-5">
            <ColumnChart
              ariaLabel="Daily volume"
              data={d.daily.map((x) => ({ label: x.day.slice(8), value: x.value, sub: x.day }))}
              format={(v) => money(v, 'KES', { compact: true })}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Why payments failed" />
          <div className="p-5">
            {s.failures.length ? (
              <BarList
                data={s.failures.map((x) => ({ label: x.reason, value: x.count }))}
                format={(v) => String(v)}
              />
            ) : (
              <p className="text-sm text-ink-muted">No failures in this period.</p>
            )}
          </div>
        </Card>
      </div>

      {conns.data ? (
        <Card className="overflow-hidden">
          <CardHeader
            title="M-Pesa connections"
            description="Health of each House's Paybill or Till over the last 7 days."
          />
          <Table>
            <thead>
              <tr>
                <Th>House</Th>
                <Th>Shortcode</Th>
                <Th>Mode</Th>
                <Th>State</Th>
                <Th className="text-right">Success, 7 days</Th>
              </tr>
            </thead>
            <tbody>
              {conns.data.map((c) => (
                <Tr key={c.tenantId}>
                  <Td>
                    <Link to={`/houses/${c.tenantId}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </Td>
                  <Td className="text-ink-muted">{c.payment?.shortcodeMasked}</Td>
                  <Td>{c.payment?.mode === 'daraja' ? 'Automatic' : 'Manual'}</Td>
                  <Td>
                    {c.payment ? (
                      <Badge tone={PROVIDER_STATE[c.payment.state].tone}>
                        {PROVIDER_STATE[c.payment.state].label}
                      </Badge>
                    ) : null}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {c.last7.count ? pct(c.last7.successRate) : '—'}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title={`Payments (${d.total.toLocaleString('en-KE')})`}
          description={
            d.total > d.rows.length
              ? `Showing the latest ${d.rows.length}. Export for the rest.`
              : undefined
          }
          action={
            <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <ShieldCheck className="size-3.5" /> Guests shown as anonymous references
            </span>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>House</Th>
              <Th>Booking</Th>
              <Th>Guest</Th>
              <Th>How</Th>
              <Th>Status</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {d.rows.slice(0, 150).map((x) => (
              <Tr key={x.id}>
                <Td className="whitespace-nowrap text-ink-muted">{dateTime(x.at, TZ)}</Td>
                <Td>
                  <Link to={`/houses/${x.tenantId}`} className="hover:underline">
                    {name(x.tenantId)}
                  </Link>
                </Td>
                <Td className="font-mono text-xs">{x.bookingRef}</Td>
                <Td>
                  <span className="font-mono text-xs">{x.guestRef}</span>
                  <div className="text-xs text-ink-subtle">
                    {x.newGuest ? 'New' : 'Returning'}
                    {x.attribution === 'marketplace' ? ' · Marketplace' : ''}
                  </div>
                </Td>
                <Td>
                  {PAY_LABEL[x.method]}
                  <div className="text-xs text-ink-subtle">{FLOW_LABEL[x.flow]}</div>
                </Td>
                <Td>
                  <Badge tone={TXN_STATUS[x.status].tone}>{TXN_STATUS[x.status].label}</Badge>
                  {x.failure ? (
                    <div className="mt-1 text-xs text-ink-subtle">{x.failure}</div>
                  ) : null}
                </Td>
                <Td className="text-right tabular-nums">{money(x.amount)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
