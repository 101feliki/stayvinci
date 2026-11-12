import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CreditCard,
  Link2,
  Lock,
  Search,
  Smartphone,
  Undo2,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatTile,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
  cn,
} from '@stayvinci/ui';
import { api } from '../../mock/api';
import type { Payment, ProviderConnection, UnmatchedPayment } from '../../mock/types';
import { useCan, useSession } from '../../app/session';
import { useBookingDrawer } from '../../app/ui';
import { ErrorState, PageSkeleton, downloadCsv } from '../../components/common';
import { dateTime, money, relative } from '../../lib/format';
import { PAYMENT_STATUS, PROVIDER_STATE } from '../../lib/states';
import { useAction, useTenantQuery } from '../../lib/query';
import { RefundDialog } from '../bookings/BookingDrawer';

type Tab = 'providers' | 'transactions' | 'unmatched';

const PROVIDER_ICON = { mpesa: Smartphone, card: CreditCard, paypal: Wallet } as const;

/** Own payments (spec §3): guest money lands in the House's own accounts. */
export function PaymentsPage() {
  const { tenant } = useSession();
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'providers';
  const q = useTenantQuery(['payments'], api.payments.overview);
  const drawer = useBookingDrawer();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [refund, setRefund] = useState<Payment | null>(null);
  const [attach, setAttach] = useState<UnmatchedPayment | null>(null);
  const test = useAction((id: string) => api.payments.testProvider(id), {
    success: 'Test payment confirmed. Provider verified.',
  });
  const reorder = useAction((a: { id: string; dir: -1 | 1 }) => api.payments.reorder(a.id, a.dir));

  const data = q.data;
  const guestMap = useMemo(() => new Map((data?.guests ?? []).map((g) => [g.id, g.name])), [data]);
  const bookingMap = useMemo(() => new Map((data?.bookings ?? []).map((b) => [b.id, b])), [data]);
  const rows = useMemo(
    () =>
      (data?.payments ?? []).filter((p) => {
        if (status !== 'all' && p.status !== status) return false;
        if (search) {
          const hay =
            `${p.providerRef} ${bookingMap.get(p.bookingId ?? '')?.ref ?? ''} ${guestMap.get(p.guestId ?? '') ?? ''}`.toLowerCase();
          if (!hay.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [data, status, search, bookingMap, guestMap],
  );

  if (q.error) return <ErrorState error={q.error} />;
  if (!data) return <PageSkeleton />;

  const tz = tenant.timezone;
  const monthStart = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const last30 = data.payments.filter(
    (p) =>
      p.at >= monthStart &&
      p.status !== 'failed' &&
      p.status !== 'expired' &&
      p.status !== 'pending',
  );
  const collected = last30.reduce((n, p) => n + p.amount - p.refunded, 0);
  const refunded = last30.reduce((n, p) => n + p.refunded, 0);
  const attempts = data.payments.filter((p) => p.at >= monthStart && p.provider !== 'cash');
  const success = attempts.length
    ? attempts.filter((p) => p.status === 'succeeded' || p.status.includes('refunded')).length /
      attempts.length
    : 1;

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Guests pay straight into your own M-Pesa and card accounts. Stayvinci never holds your money."
        actions={
          tab === 'transactions' ? (
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv('transactions.csv', [
                  [
                    'Date',
                    'Booking',
                    'Guest',
                    'Method',
                    'Reference',
                    'Amount (KES)',
                    'Refunded (KES)',
                    'Status',
                  ],
                  ...rows.map((p) => [
                    dateTime(p.at, tz),
                    bookingMap.get(p.bookingId ?? '')?.ref ?? '',
                    guestMap.get(p.guestId ?? '') ?? '',
                    p.provider,
                    p.providerRef,
                    p.amount / 100,
                    p.refunded / 100,
                    p.status,
                  ]),
                ])
              }
            >
              Export
            </Button>
          ) : null
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Collected (30 days)"
          value={money(collected, 'KES', { compact: true })}
          accent="emerald"
        />
        <StatTile
          label="Refunded (30 days)"
          value={money(refunded, 'KES', { compact: true })}
          accent="plum"
        />
        <StatTile
          label="Payment success rate"
          value={`${Math.round(success * 100)}%`}
          sub="M-Pesa and card attempts"
          accent="azure"
        />
        <StatTile
          label="Unmatched payments"
          value={data.unmatched.length}
          sub="Need attaching"
          accent="gold"
        />
      </div>
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        className="mb-5"
        items={[
          { value: 'providers', label: 'Payment accounts' },
          { value: 'transactions', label: 'Transactions', count: data.payments.length },
          { value: 'unmatched', label: 'Unmatched', count: data.unmatched.length },
        ]}
      />

      {tab === 'providers' ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
            <Lock className="mt-0.5 size-4 shrink-0" />
            Credentials are encrypted and only the payments service can read them. You see masked
            values here; every view and change is recorded in the audit log.
          </div>
          {data.providers.map((p, i) => (
            <ProviderCard
              key={p.id}
              p={p}
              first={i === 0}
              last={i === data.providers.length - 1}
              canManage={can('payment_account.manage')}
              onTest={() => test.mutate(p.id)}
              testing={test.isPending && test.variables === p.id}
              onMove={(dir) => reorder.mutate({ id: p.id, dir })}
            />
          ))}
        </div>
      ) : null}

      {tab === 'transactions' ? (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
              <Input
                className="pl-9"
                placeholder="Search by M-Pesa code, booking or guest"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="sm:w-48">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Status"
              >
                <option value="all">All statuses</option>
                {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Guest</Th>
                <Th className="hidden md:table-cell">Method</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Reconciled</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 80).map((p) => {
                const b = bookingMap.get(p.bookingId ?? '');
                return (
                  <Tr
                    key={p.id}
                    className={b ? 'cursor-pointer' : ''}
                    onClick={() => b && drawer.open(b.id)}
                  >
                    <Td className="whitespace-nowrap">
                      <div>{dateTime(p.at, tz)}</div>
                      <div className="font-mono text-xs text-ink-subtle">
                        {b?.ref ?? 'No booking'}
                      </div>
                    </Td>
                    <Td>{guestMap.get(p.guestId ?? '') ?? '—'}</Td>
                    <Td className="hidden md:table-cell">
                      <div>
                        {p.provider === 'mpesa'
                          ? 'M-Pesa'
                          : p.provider === 'card'
                            ? 'Card'
                            : p.provider === 'cash'
                              ? 'Cash'
                              : 'PayPal'}
                      </div>
                      <div className="font-mono text-xs text-ink-subtle">{p.providerRef}</div>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {money(p.amount)}
                      {p.refunded ? (
                        <div className="text-xs text-plum-700">−{money(p.refunded)}</div>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={PAYMENT_STATUS[p.status].tone}>
                        {PAYMENT_STATUS[p.status].label}
                      </Badge>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      {p.provider === 'cash' ? (
                        <span className="text-xs text-ink-subtle">Offline</span>
                      ) : p.reconciled ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : (
                        <span className="text-xs text-ink-subtle">Pending</span>
                      )}
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      {can('payment.refund') &&
                      (p.status === 'succeeded' || p.status === 'partially_refunded') &&
                      p.provider !== 'cash' ? (
                        <Button size="sm" variant="ghost" onClick={() => setRefund(p)}>
                          <Undo2 className="size-4" /> Refund
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {tab === 'unmatched' ? (
        <Card>
          {data.unmatched.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-5" />}
              title="Everything matched"
              description="Payments without a booking reference land here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.unmatched.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <div className="text-sm font-semibold tabular-nums">{money(u.amount)}</div>
                    <div className="text-[13px] text-ink-muted">
                      <span className="font-mono">{u.providerRef}</span> · {u.payerHint} ·{' '}
                      {relative(u.at)}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => setAttach(u)}>
                    <Link2 className="size-4" /> Attach to booking
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {refund ? <RefundDialog payment={refund} onClose={() => setRefund(null)} /> : null}
      {attach ? (
        <AttachDialog
          payment={attach}
          bookings={data.bookings}
          guests={guestMap}
          onClose={() => setAttach(null)}
        />
      ) : null}
    </div>
  );
}

function ProviderCard({
  p,
  first,
  last,
  canManage,
  onTest,
  testing,
  onMove,
}: {
  p: ProviderConnection;
  first: boolean;
  last: boolean;
  canManage: boolean;
  onTest: () => void;
  testing: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const Icon = PROVIDER_ICON[p.kind];
  const st = PROVIDER_STATE[p.state];
  return (
    <Card
      className={cn(
        'flex flex-col gap-4 p-5 sm:flex-row sm:items-center',
        p.state === 'failing' && 'border-red-200',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          disabled={first || !canManage}
          onClick={() => onMove(-1)}
          aria-label="Move up"
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          disabled={last || !canManage}
          onClick={() => onMove(1)}
          aria-label="Move down"
        >
          <ArrowDown className="size-3.5" />
        </Button>
      </div>
      <span
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-2xl',
          p.kind === 'mpesa' ? 'bg-emerald-50 text-emerald-700' : 'bg-azure-50 text-azure-700',
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{p.label}</span>
          <Badge tone={st.tone} dot>
            {st.label}
          </Badge>
          {first && p.state === 'verified' ? <Badge tone="azure">Shown first</Badge> : null}
        </div>
        <div className="mt-0.5 text-[13px] text-ink-muted">{p.detail}</div>
        <div className="mt-0.5 font-mono text-xs text-ink-subtle">
          Key {p.masked}
          {p.lastCallbackAt ? ` · last callback ${relative(p.lastCallbackAt)}` : ''}
        </div>
      </div>
      {canManage ? (
        <div className="flex gap-2">
          {p.state === 'testing' || p.state === 'draft' ? (
            <Button onClick={onTest} loading={testing}>
              {p.state === 'draft' ? 'Connect' : 'Send test payment'}
            </Button>
          ) : null}
          {p.state === 'failing' ? (
            <Button variant="danger" onClick={onTest} loading={testing}>
              Reconnect
            </Button>
          ) : null}
          {p.state === 'verified' ? <Button variant="secondary">Manage</Button> : null}
        </div>
      ) : (
        <span className="text-xs text-ink-subtle">Owner manages accounts</span>
      )}
    </Card>
  );
}

function AttachDialog({
  payment,
  bookings,
  guests,
  onClose,
}: {
  payment: UnmatchedPayment;
  bookings: {
    id: string;
    ref: string;
    guestId: string;
    total: number;
    paid: number;
    start: string;
    state: string;
  }[];
  guests: Map<string, string>;
  onClose: () => void;
}) {
  const { tenant } = useSession();
  const candidates = bookings
    .filter((b) => b.total - b.paid > 0 && !b.state.startsWith('cancelled'))
    .sort(
      (a, b) =>
        Math.abs(a.total - a.paid - payment.amount) - Math.abs(b.total - b.paid - payment.amount),
    )
    .slice(0, 8);
  const [pick, setPick] = useState(candidates[0]?.id ?? '');
  const go = useAction(() => api.payments.attachUnmatched(payment.id, pick), {
    success: 'Payment attached',
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title={`Attach ${money(payment.amount)}`}
      description={`${payment.providerRef} · ${payment.payerHint}. Closest balances first.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => go.mutate(undefined)} disabled={!pick} loading={go.isPending}>
            Attach
          </Button>
        </>
      }
    >
      <ul className="space-y-2">
        {candidates.map((b) => (
          <li key={b.id}>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5',
                pick === b.id ? 'border-azure-500 bg-azure-50' : 'border-line',
              )}
            >
              <input
                type="radio"
                name="booking"
                checked={pick === b.id}
                onChange={() => setPick(b.id)}
                className="accent-azure-600"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium">
                  {guests.get(b.guestId) ?? 'Guest'}{' '}
                  <span className="font-mono text-xs text-ink-subtle">{b.ref}</span>
                </span>
                <span className="text-xs text-ink-muted">{dateTime(b.start, tenant.timezone)}</span>
              </span>
              <span className="text-sm tabular-nums">{money(b.total - b.paid)} due</span>
            </label>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
