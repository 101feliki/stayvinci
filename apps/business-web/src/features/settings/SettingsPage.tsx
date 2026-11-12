import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertTriangle, Download, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Switch,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
  ThemeSwitcher,
  resetHints,
} from '@stayvinci/ui';
import { toast } from 'sonner';
import { api } from '../../mock/api';
import { SocialAccounts } from './SocialAccounts';
import type { Location, Tenant } from '../../mock/types';
import { useCan, useSession } from '../../app/session';
import { ErrorState, PageSkeleton } from '../../components/common';
import { dateTime } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

type Tab = 'profile' | 'locations' | 'notifications' | 'audit' | 'data' | 'social' | 'appearance';

export function SettingsPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'profile';
  const q = useTenantQuery(['settings'], api.settings.get);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const items = [
    { value: 'profile' as const, label: 'Business profile' },
    { value: 'locations' as const, label: 'Locations & hours' },
    { value: 'notifications' as const, label: 'Notifications' },
    { value: 'social' as const, label: 'Social accounts' },
    { value: 'appearance' as const, label: 'Appearance' },
    ...(can('audit.view') ? [{ value: 'audit' as const, label: 'Audit log' }] : []),
    ...(can('billing.manage') ? [{ value: 'data' as const, label: 'Data & account' }] : []),
  ];
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Your House profile, locations, notifications and records."
      />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} items={items} className="mb-5" />
      {tab === 'profile' ? (
        <Profile tenant={q.data.tenant} editable={can('settings.manage')} />
      ) : null}
      {tab === 'locations'
        ? q.data.locations.map((l) => (
            <LocationCard key={l.id} location={l} editable={can('settings.manage')} />
          ))
        : null}
      {tab === 'notifications' ? <Notifications prefs={q.data.notifications} /> : null}
      {tab === 'social' ? <SocialAccounts /> : null}
      {tab === 'appearance' ? (
        <Card className="space-y-6 p-5">
          <div>
            <div className="text-[15px] font-semibold">Theme</div>
            <p className="mb-3 text-[13px] text-ink-muted">
              Follow your device, or always use light or dark. Saved on this device.
            </p>
            <ThemeSwitcher />
          </div>
          <div className="border-t border-line pt-5">
            <div className="text-[15px] font-semibold">Setup tips</div>
            <p className="mb-3 text-[13px] text-ink-muted">
              Each page shows a short tip until you close it. Bring them all back here.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                resetHints();
                toast.success('Tips are back on every page');
              }}
            >
              Show tips again
            </Button>
          </div>
        </Card>
      ) : null}
      {tab === 'audit' ? <AuditLog /> : null}
      {tab === 'data' ? <DataAccount /> : null}
    </div>
  );
}

function Profile({ tenant, editable }: { tenant: Tenant; editable: boolean }) {
  const [t, setT] = useState(tenant);
  useEffect(() => setT(tenant), [tenant]);
  const save = useAction(
    () =>
      api.settings.saveTenant({
        name: t.name,
        description: t.description,
        tagline: t.tagline,
        area: t.area,
      }),
    { success: 'Profile saved' },
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader title="Business profile" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Business name" className="sm:col-span-2">
            {(id) => (
              <Input
                id={id}
                disabled={!editable}
                value={t.name}
                onChange={(e) => setT({ ...t, name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Area shown publicly">
            {(id) => (
              <Input
                id={id}
                disabled={!editable}
                value={t.area}
                onChange={(e) => setT({ ...t, area: e.target.value })}
              />
            )}
          </Field>
          <Field label="Store handle" hint="Also your primary access code">
            {(id) => <Input id={id} disabled value={t.handle} className="font-mono" />}
          </Field>
          <Field label="Description" className="sm:col-span-2">
            {(id) => (
              <Textarea
                id={id}
                disabled={!editable}
                value={t.description}
                onChange={(e) => setT({ ...t, description: e.target.value })}
                className="min-h-28"
              />
            )}
          </Field>
        </div>
        {editable ? (
          <div className="flex justify-end border-t border-line px-5 py-3">
            <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
              Save profile
            </Button>
          </div>
        ) : null}
      </Card>
      <Card className="h-fit p-5">
        <div className="text-[13px] font-semibold text-ink-muted uppercase">Status</div>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Store</span>
            <Badge tone={tenant.status === 'live' ? 'emerald' : 'amber'} dot>
              {tenant.status === 'live' ? 'Live' : 'In setup'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Verification</span>
            <Badge tone={tenant.verification === 'approved' ? 'emerald' : 'amber'}>
              {tenant.verification === 'approved' ? (
                <>
                  <ShieldCheck className="size-3" /> Verified
                </>
              ) : (
                'Under review'
              )}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Time zone</span>
            <span>{tenant.timezone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Currency</span>
            <span>{tenant.currency}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function LocationCard({ location, editable }: { location: Location; editable: boolean }) {
  const [l, setL] = useState(location);
  const save = useAction(
    () =>
      api.settings.saveLocation(l.id, {
        hours: l.hours,
        arrivalInstructions: l.arrivalInstructions,
        address: l.address,
      }),
    { success: 'Location saved' },
  );
  return (
    <Card className="mb-6">
      <CardHeader title={l.name} description={l.address} />
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[13px] font-medium">Opening hours</div>
          <div className="space-y-2">
            {l.hours.map((h, i) => (
              <div key={h.day} className="grid grid-cols-[48px_1fr_1fr_auto] items-center gap-2">
                <span className="text-sm font-medium">{h.day}</span>
                <Input
                  type="time"
                  disabled={!editable || h.closed}
                  value={h.open}
                  onChange={(e) =>
                    setL({
                      ...l,
                      hours: l.hours.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)),
                    })
                  }
                  className="h-9"
                />
                <Input
                  type="time"
                  disabled={!editable || h.closed}
                  value={h.close}
                  onChange={(e) =>
                    setL({
                      ...l,
                      hours: l.hours.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)),
                    })
                  }
                  className="h-9"
                />
                <Switch
                  checked={!h.closed}
                  disabled={!editable}
                  onChange={(v) =>
                    setL({
                      ...l,
                      hours: l.hours.map((x, j) => (j === i ? { ...x, closed: !v } : x)),
                    })
                  }
                  label={`Open on ${h.day}`}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Address">
            {(id) => (
              <Input
                id={id}
                disabled={!editable}
                value={l.address}
                onChange={(e) => setL({ ...l, address: e.target.value })}
              />
            )}
          </Field>
          <Field label="Arrival instructions" hint="Released to guests only after payment.">
            {(id) => (
              <Textarea
                id={id}
                disabled={!editable}
                value={l.arrivalInstructions}
                onChange={(e) => setL({ ...l, arrivalInstructions: e.target.value })}
                className="min-h-28"
              />
            )}
          </Field>
          <div className="flex h-40 items-center justify-center rounded-xl border border-line bg-[linear-gradient(135deg,#eef5f2,#faf6ec)] text-sm text-ink-muted">
            Map pin · {l.area}
          </div>
        </div>
      </div>
      {editable ? (
        <div className="flex justify-end border-t border-line px-5 py-3">
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
            Save location
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function Notifications({ prefs }: { prefs: Record<string, boolean> }) {
  const [p, setP] = useState(prefs);
  const save = useAction(() => api.settings.saveNotifications(p), { success: 'Preferences saved' });
  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="Notify me about"
        description="Sent to you by push, email or SMS. Guest names are never shown on your lock screen."
      />
      <ul className="divide-y divide-line">
        {Object.entries(p).map(([k, v]) => (
          <li key={k} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm">{k}</span>
            <Switch checked={v} onChange={(nv) => setP({ ...p, [k]: nv })} label={k} />
          </li>
        ))}
      </ul>
      <div className="flex justify-end border-t border-line px-5 py-3">
        <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
          Save
        </Button>
      </div>
    </Card>
  );
}

function AuditLog() {
  const { tenant } = useSession();
  const q = useTenantQuery(['audit'], api.settings.audit);
  if (!q.data) return <PageSkeleton rows={8} />;
  return (
    <Card>
      <CardHeader
        title="Audit log"
        description="Every privileged action and money movement, including Stayvinci staff access."
      />
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>Action</Th>
            <Th className="hidden md:table-cell">Detail</Th>
          </tr>
        </thead>
        <tbody>
          {q.data.slice(0, 100).map((a) => (
            <Tr key={a.id}>
              <Td className="whitespace-nowrap text-ink-muted">
                {dateTime(a.at, tenant.timezone)}
              </Td>
              <Td>
                {a.actor}
                {a.actor.startsWith('Stayvinci') ? (
                  <Badge tone="azure" className="ml-2">
                    Platform
                  </Badge>
                ) : null}
              </Td>
              <Td>
                <div className="font-mono text-xs">{a.action}</div>
                <div className="text-xs text-ink-subtle">{a.target}</div>
              </Td>
              <Td className="hidden text-[13px] text-ink-muted md:table-cell">{a.detail}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function DataAccount() {
  const exp = useAction(() => api.settings.exportData(), {
    success: 'Export started. We will email a secure download link.',
  });
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader
          title="Export your data"
          description="Bookings, guests, catalogue and payments as CSV. Owners only; recorded in the audit log."
        />
        <div className="p-5">
          <Button variant="secondary" onClick={() => exp.mutate(undefined)} loading={exp.isPending}>
            <Download className="size-4" /> Request export
          </Button>
        </div>
      </Card>
      <Card className="border-red-200">
        <CardHeader
          title="Close account"
          description="Your store goes offline. Confirmed bookings are honoured; payment and dispute records are kept as the law requires."
        />
        <div className="flex items-center gap-3 p-5">
          <AlertTriangle className="size-5 text-red-600" />
          <span className="flex-1 text-sm text-ink-muted">
            Contact your account manager to close this House.
          </span>
          <Button variant="danger" disabled>
            Close account
          </Button>
        </div>
      </Card>
    </div>
  );
}
