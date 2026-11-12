import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CircleCheck,
  CircleSlash,
  ExternalLink,
  MoreHorizontal,
  Send,
  Smartphone,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Field,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Segmented,
  Select,
  StatTile,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
} from '@stayvinci/ui';
import { date, dateTime, money, pct, relative } from '@stayvinci/demo-data/format';
import type { FeatureKey, PayMethod, PayMode, PlanId } from '@stayvinci/demo-data/platform';
import type { TenantStatus } from '@stayvinci/demo-data/types';
import { api, type TenantDetail } from '../../mock/api';
import { ColumnChart } from '../../components/charts';
import { Change, ErrorState, KeyValue, PageSkeleton } from '../../components/common';
import {
  FLOW_LABEL,
  PLAN_LABEL,
  PROVIDER_STATE,
  STATUS_ORDER,
  TENANT_STATUS,
  TXN_STATUS,
} from '../../lib/labels';
import { useAction } from '../../lib/query';
import { useCan } from '../../app/session';

const TZ = 'Africa/Nairobi';
type Tab = 'overview' | 'features' | 'payments' | 'growth' | 'activity';

export function HouseDetailPage() {
  const { id = '' } = useParams();
  const can = useCan();
  const [tab, setTab] = useState<Tab>('overview');
  const [statusOpen, setStatusOpen] = useState(false);
  const q = useQuery({ queryKey: ['tenant', id], queryFn: () => api.tenants.get(id) });

  const assist = useAction(() => api.tenants.startAssist(id), {
    onSuccess: (url) => {
      window.open(url, '_blank', 'noopener');
    },
  });
  const resend = useAction(() => api.tenants.resendInvite(id), { success: 'Invite resent' });

  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const d = q.data;
  const t = d.tenant;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/houses"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Houses
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{t.name}</h1>
              <Badge tone={TENANT_STATUS[t.status].tone} dot>
                {TENANT_STATUS[t.status].label}
              </Badge>
              <Badge tone="gold">{PLAN_LABEL[t.plan]}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {t.kind === 'atelier' ? 'Atelier' : t.category} · {t.area} · code{' '}
              <span className="font-mono">{t.handle.toUpperCase()}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('tenant.assist') ? (
              <Button
                variant="gold"
                loading={assist.isPending}
                onClick={() => assist.mutate(undefined)}
                title="Open this House's business app with full control. The House sees it in its activity log."
              >
                <Wrench className="size-4" /> Manage store <ExternalLink className="size-3.5" />
              </Button>
            ) : null}
            {can('tenant.manage') ? (
              <Button variant="secondary" onClick={() => setStatusOpen(true)}>
                Change stage
              </Button>
            ) : null}
            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem
                  disabled={!can('tenant.create')}
                  onSelect={() => resend.mutate(undefined)}
                >
                  <Send className="size-4" /> Resend owner invite
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'features', label: 'Plan & features' },
          ...(d.money ? [{ value: 'payments' as const, label: 'Payments' }] : []),
          { value: 'growth', label: 'Growth' },
          { value: 'activity', label: 'Activity & notes', count: d.activity.length },
        ]}
      />

      {tab === 'overview' ? <OverviewTab d={d} /> : null}
      {tab === 'features' ? <FeaturesTab d={d} /> : null}
      {tab === 'payments' && d.money ? <PaymentsTab d={d} /> : null}
      {tab === 'growth' ? <GrowthTab d={d} /> : null}
      {tab === 'activity' ? <ActivityTab d={d} /> : null}

      <StatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        tenantId={t.id}
        current={t.status}
      />
    </div>
  );
}

/* ---------- Overview ---------- */

function OverviewTab({ d }: { d: TenantDetail }) {
  const t = d.tenant;
  const can = useCan();
  const [method, setMethod] = useState<PayMethod>(t.payment?.method ?? 'till');
  const [mode, setMode] = useState<PayMode>(t.payment?.mode ?? 'daraja');
  const savePay = useAction(() => api.tenants.setPayment(t.id, method, mode), {
    success: 'M-Pesa setup updated',
  });
  const progress = t.checklist.total ? t.checklist.done / t.checklist.total : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Owner and account" />
        <div className="divide-y divide-line px-5">
          <KeyValue label="Owner">{t.owner.name}</KeyValue>
          <KeyValue label="Mobile">{t.owner.phoneMasked}</KeyValue>
          <KeyValue label="Email">{t.owner.email}</KeyValue>
          <KeyValue label="How they joined">
            {t.source === 'self_signup' ? 'Signed up online' : 'Invited by Stayvinci'}
          </KeyValue>
          <KeyValue label="Joined">{date(t.joinedAt, TZ)}</KeyValue>
          <KeyValue label="Went live">{t.liveAt ? date(t.liveAt, TZ) : 'Not yet'}</KeyValue>
          <KeyValue label="Onboarding manager">{t.onboardingManager ?? '—'}</KeyValue>
          <KeyValue label="Team">{t.staffCount} people</KeyValue>
          <KeyValue label="Visibility">
            {t.visibility === 'private'
              ? 'Private (code only)'
              : t.visibility === 'listed'
                ? 'Listed in Discover'
                : 'Listed, limited'}
          </KeyValue>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Store setup"
            description={`${t.checklist.done} of ${t.checklist.total} steps done`}
          />
          <div className="p-5">
            <div className="h-2 rounded-full bg-stone-100">
              <div
                className="h-2 rounded-full bg-gold-400"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[13px] text-ink-muted">
              {progress >= 1
                ? 'Setup complete.'
                : 'Stuck? Use "Manage store" to add services, staff and opening hours for them.'}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="M-Pesa"
            description="Guest money goes straight into this House's own Paybill or Till."
            action={
              t.payment ? (
                <Badge tone={PROVIDER_STATE[t.payment.state].tone}>
                  {PROVIDER_STATE[t.payment.state].label}
                </Badge>
              ) : (
                <Badge>Not set up</Badge>
              )
            }
          />
          <div className="space-y-4 p-5">
            {t.payment ? (
              <div className="flex items-center gap-3 text-sm">
                <Smartphone className="size-5 text-emerald-700" />
                <span className="flex-1">
                  {t.payment.shortcodeMasked} ·{' '}
                  {t.payment.mode === 'daraja'
                    ? 'automatic (Daraja)'
                    : 'manual (staff confirm payments)'}
                </span>
                <span className="text-xs text-ink-subtle">
                  {t.payment.lastCallbackAt
                    ? `Last callback ${relative(t.payment.lastCallbackAt)}`
                    : 'No callbacks yet'}
                </span>
              </div>
            ) : null}
            {can('tenant.manage') ? (
              <div className="space-y-3 rounded-xl bg-canvas p-4">
                <div className="flex flex-wrap gap-3">
                  <Segmented
                    value={method}
                    onChange={setMethod}
                    items={[
                      { value: 'till', label: 'Till' },
                      { value: 'paybill', label: 'Paybill' },
                    ]}
                  />
                  <Segmented
                    value={mode}
                    onChange={setMode}
                    items={[
                      { value: 'daraja', label: 'Automatic (Daraja)' },
                      { value: 'manual', label: 'Manual' },
                    ]}
                  />
                </div>
                <p className="text-[13px] text-ink-muted">
                  {mode === 'daraja'
                    ? 'Guests get an M-Pesa prompt and bookings confirm by themselves. The owner adds their Daraja keys in their Payments page.'
                    : 'Guests pay to the shortcode with the booking reference; front desk confirms each payment. Good for Houses without Daraja access yet.'}
                </p>
                <Button
                  size="sm"
                  loading={savePay.isPending}
                  onClick={() => savePay.mutate(undefined)}
                >
                  Save M-Pesa setup
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Plan & features ---------- */

function FeaturesTab({ d }: { d: TenantDetail }) {
  const t = d.tenant;
  const can = useCan();
  const [editing, setEditing] = useState<FeatureKey | null>(null);
  const setPlan = useAction((p: PlanId) => api.tenants.setPlan(t.id, p), {
    success: (x) => `Plan changed to ${PLAN_LABEL[x.plan]}`,
  });
  const clear = useAction((f: FeatureKey) => api.tenants.setOverride(t.id, f, null), {
    success: 'Back to plan default',
  });
  const areas = ['Core', 'Sell more', 'Grow', 'Operations'] as const;
  const editingRow = d.features.find((f) => f.feature.key === editing);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Plan"
          description="Changing the plan switches features on or off immediately. Prices aren't set yet."
          action={
            can('tenant.manage') ? (
              <Segmented
                value={t.plan}
                onChange={(p) => setPlan.mutate(p)}
                items={(Object.keys(PLAN_LABEL) as PlanId[]).map((p) => ({
                  value: p,
                  label: PLAN_LABEL[p],
                }))}
              />
            ) : (
              <Badge tone="gold">{PLAN_LABEL[t.plan]}</Badge>
            )
          }
        />
        <div className="px-5 py-3 text-[13px] text-ink-muted">
          {d.plan?.audience}. Uploads and content have no limits for now.
        </div>
      </Card>

      {areas.map((area) => {
        const rows = d.features.filter((f) => f.feature.area === area);
        return (
          <Card key={area} className="overflow-hidden">
            <CardHeader title={area} />
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li
                  key={r.feature.key}
                  className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center"
                >
                  {r.on ? (
                    <CircleCheck className="size-5 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleSlash className="size-5 shrink-0 text-ink-subtle" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {r.feature.name}
                      {r.feature.stage !== 'general' ? (
                        <Badge tone={r.feature.stage === 'beta' ? 'azure' : 'neutral'}>
                          {r.feature.stage === 'beta' ? 'Beta' : 'Internal'}
                        </Badge>
                      ) : null}
                      {r.override ? (
                        <Badge tone="gold">
                          <Sparkles className="size-3" /> Custom
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-[13px] text-ink-muted">{r.why}</div>
                    {r.override?.until ? (
                      <div className="text-xs text-ink-subtle">
                        Until {date(r.override.until, TZ)}
                      </div>
                    ) : null}
                  </div>
                  {can('feature.manage') && !r.feature.core ? (
                    <div className="flex gap-2">
                      {r.override ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => clear.mutate(r.feature.key)}
                        >
                          Use plan default
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditing(r.feature.key)}
                      >
                        {r.on ? 'Turn off' : 'Turn on'}
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      {editingRow ? (
        <OverrideDialog
          tenantId={t.id}
          feature={editingRow.feature.key}
          name={editingRow.feature.name}
          turnOn={!editingRow.on}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function OverrideDialog({
  tenantId,
  feature,
  name,
  turnOn,
  onClose,
}: {
  tenantId: string;
  feature: FeatureKey;
  name: string;
  turnOn: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const save = useAction(
    () =>
      api.tenants.setOverride(tenantId, feature, {
        on: turnOn,
        reason,
        until: until ? new Date(`${until}T23:59:00+03:00`).toISOString() : null,
      }),
    { success: `${name} turned ${turnOn ? 'on' : 'off'}`, onSuccess: onClose },
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? null : onClose())}
      title={`Turn ${turnOn ? 'on' : 'off'} ${name}`}
      description="Applies to this House only and overrides its plan. It takes effect in their app immediately."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Turn {turnOn ? 'on' : 'off'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Why" hint="Shown to the team later, e.g. 'Pilot partner trial'">
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <Field label="Until (optional)" hint="Leave empty to keep it until you change it">
          {(id) => (
            <Input id={id} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

/* ---------- Payments ---------- */

function PaymentsTab({ d }: { d: TenantDetail }) {
  if (!d.money) return null;
  const m = d.money;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Paid in, 30 days"
          value={money(m.last30.volume, 'KES', { compact: true })}
        />
        <StatTile label="Success rate" value={pct(m.last30.successRate)} accent="azure" />
        <StatTile
          label="Typical confirmation"
          value={m.last30.medianConfirm !== null ? `${m.last30.medianConfirm}s` : '—'}
          sub="From M-Pesa prompt to confirmed"
          accent="gold"
        />
        <StatTile
          label="From the marketplace"
          value={pct(m.last30.marketplaceShare)}
          sub="Share of paid bookings"
          accent="plum"
        />
      </div>
      <Card>
        <CardHeader title="Daily volume, last 30 days" />
        <div className="p-5">
          <ColumnChart
            ariaLabel="Daily payment volume"
            data={m.daily.map((x) => ({ label: x.day.slice(8), value: x.value }))}
            format={(v) => money(v, 'KES', { compact: true })}
          />
        </div>
      </Card>
      {m.last30.failures.length ? (
        <Card>
          <CardHeader title="Why payments failed" />
          <ul className="divide-y divide-line">
            {m.last30.failures.map((f) => (
              <li key={f.reason} className="flex justify-between px-5 py-2.5 text-sm">
                {f.reason} <span className="tabular-nums text-ink-muted">{f.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        <CardHeader
          title="Latest payments"
          action={
            <Link
              to={`/transactions?house=${d.tenant.id}`}
              className="text-sm font-medium text-azure-700"
            >
              See all
            </Link>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Booking</Th>
              <Th>Guest</Th>
              <Th>How</Th>
              <Th>Status</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {m.recent.map((x) => (
              <Tr key={x.id}>
                <Td className="whitespace-nowrap text-ink-muted">{dateTime(x.at, TZ)}</Td>
                <Td className="font-mono text-xs">{x.bookingRef}</Td>
                <Td className="font-mono text-xs">{x.guestRef}</Td>
                <Td>{FLOW_LABEL[x.flow]}</Td>
                <Td>
                  <Badge tone={TXN_STATUS[x.status].tone}>{TXN_STATUS[x.status].label}</Badge>
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

/* ---------- Growth ---------- */

function GrowthTab({ d }: { d: TenantDetail }) {
  const ms = d.months;
  if (!ms.length)
    return (
      <Card className="p-8 text-center text-sm text-ink-muted">
        No bookings yet. Growth shows here once the House is live.
      </Card>
    );
  const full = ms.slice(1, -1);
  const first = full[0] ?? ms[0];
  const latest = full[full.length - 1] ?? ms[ms.length - 1];
  const baseline = d.tenant.baselineMonthly;
  const fmtMonth = (m: string) =>
    new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(
      new Date(`${m}-01`),
    );
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Latest full month"
          value={latest ? money(latest.revenue, 'KES', { compact: true }) : '—'}
          sub={latest ? fmtMonth(latest.month) : ''}
        />
        <StatTile
          label="Since first full month"
          value={
            <Change
              value={first && latest && first.revenue ? latest.revenue / first.revenue - 1 : null}
            />
          }
          sub={first ? `From ${money(first.revenue, 'KES', { compact: true })}` : ''}
          accent="gold"
        />
        <StatTile
          label="Vs before Stayvinci"
          value={<Change value={baseline && latest ? latest.revenue / baseline - 1 : null} />}
          sub={
            baseline
              ? `Owner said ${money(baseline, 'KES', { compact: true })}/month at sign-up`
              : 'No figure given at sign-up'
          }
          accent="azure"
        />
      </div>
      <Card>
        <CardHeader
          title="Revenue through Stayvinci, by month"
          description="Successful payments only. The first and current months are partial."
        />
        <div className="p-5">
          <ColumnChart
            ariaLabel="Monthly revenue"
            data={ms.map((m) => ({ label: fmtMonth(m.month), value: m.revenue }))}
            format={(v) => money(v, 'KES', { compact: true })}
          />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>Month</Th>
              <Th className="text-right">Bookings</Th>
              <Th className="text-right">Guests</Th>
              <Th className="text-right">Returning</Th>
              <Th className="text-right">From marketplace</Th>
              <Th className="text-right">Revenue</Th>
            </tr>
          </thead>
          <tbody>
            {[...ms].reverse().map((m) => (
              <Tr key={m.month}>
                <Td>{fmtMonth(m.month)}</Td>
                <Td className="text-right tabular-nums">{m.bookings}</Td>
                <Td className="text-right tabular-nums">{m.guests}</Td>
                <Td className="text-right tabular-nums">
                  {m.guests ? pct(m.repeatGuests / m.guests) : '—'}
                </Td>
                <Td className="text-right tabular-nums">{m.marketplaceGuests}</Td>
                <Td className="text-right tabular-nums">{money(m.revenue)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

/* ---------- Activity & notes ---------- */

function ActivityTab({ d }: { d: TenantDetail }) {
  const t = d.tenant;
  const [text, setText] = useState('');
  const add = useAction(() => api.tenants.addNote(t.id, text), {
    success: 'Note added',
    onSuccess: () => setText(''),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Team notes" description="Only Stayvinci staff see these." />
        <div className="space-y-3 p-5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Called the owner, walked them through adding staff."
            rows={3}
          />
          <Button size="sm" loading={add.isPending} onClick={() => add.mutate(undefined)}>
            Add note
          </Button>
          <ul className="space-y-3 pt-2">
            {t.notes.map((n) => (
              <li key={n.at + n.text} className="rounded-xl bg-canvas p-3 text-sm">
                {n.text}
                <div className="mt-1 text-xs text-ink-subtle">
                  {n.by} · {relative(n.at)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Activity"
          description="Changes made by Stayvinci here also appear in the House's own activity log."
        />
        {d.activity.length ? (
          <ul className="divide-y divide-line">
            {d.activity.map((a) => (
              <li key={a.id} className="px-5 py-3">
                <div className="text-sm">{a.detail}</div>
                <div className="text-xs text-ink-subtle">
                  {a.actor} · <span className="font-mono">{a.action}</span> · {relative(a.at)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5 text-sm text-ink-muted">Nothing yet.</div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Stage ---------- */

function StatusDialog({
  open,
  onOpenChange,
  tenantId,
  current,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenantId: string;
  current: TenantStatus;
}) {
  const [status, setStatus] = useState<TenantStatus>(current);
  const [reason, setReason] = useState('');
  const save = useAction(() => api.tenants.setStatus(tenantId, status, reason), {
    success: (t) => `Now ${TENANT_STATUS[t.status].label}`,
    onSuccess: () => {
      onOpenChange(false);
      setReason('');
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change stage"
      description="Suspending hides the store from guests but keeps confirmed bookings."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={status === 'suspended' ? 'danger' : 'primary'}
            loading={save.isPending}
            onClick={() => save.mutate(undefined)}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Stage">
          {(id) => (
            <Select
              id={id}
              value={status}
              onChange={(e) => setStatus(e.target.value as TenantStatus)}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {TENANT_STATUS[s].label}: {TENANT_STATUS[s].hint}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Reason" hint="Recorded in the activity log">
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}
