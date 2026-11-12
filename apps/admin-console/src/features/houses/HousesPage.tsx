import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus, Search, Sparkles, UserRound } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
} from '@stayvinci/ui';
import { money, relative } from '@stayvinci/demo-data/format';
import type { PlanId } from '@stayvinci/demo-data/platform';
import type { TenantStatus } from '@stayvinci/demo-data/types';
import { api } from '../../mock/api';
import { ErrorState, PageSkeleton } from '../../components/common';
import { PLAN_LABEL, PROVIDER_STATE, STATUS_ORDER, TENANT_STATUS } from '../../lib/labels';
import { useCan } from '../../app/session';
import { NewHouseDialog } from './NewHouseDialog';

export function HousesPage() {
  const can = useCan();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'all') as TenantStatus | 'all';
  const [plan, setPlan] = useState<PlanId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['tenants'], queryFn: api.tenants.list });

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (q.data ?? []).filter(
      (t) =>
        (status === 'all' || t.status === status) &&
        (plan === 'all' || t.plan === plan) &&
        (!term ||
          t.name.toLowerCase().includes(term) ||
          t.handle.includes(term) ||
          t.owner.name.toLowerCase().includes(term) ||
          t.area.toLowerCase().includes(term)),
    );
  }, [q.data, status, plan, query]);

  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Houses"
        description="Every business on Stayvinci. Open one to manage its plan, features, payments and store."
        actions={
          can('tenant.create') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Add a House
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, owner, area"
            className="pl-9"
            aria-label="Search Houses"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            setParams(v === 'all' ? {} : { status: v });
          }}
          aria-label="Filter by stage"
          className="w-44"
        >
          <option value="all">All stages</option>
          {STATUS_ORDER.map((st) => (
            <option key={st} value={st}>
              {TENANT_STATUS[st].label}
            </option>
          ))}
        </Select>
        <Select
          value={plan}
          onChange={(e) => setPlan(e.target.value as PlanId | 'all')}
          aria-label="Filter by plan"
          className="w-40"
        >
          <option value="all">All plans</option>
          {(Object.keys(PLAN_LABEL) as PlanId[]).map((p) => (
            <option key={p} value={p}>
              {PLAN_LABEL[p]}
            </option>
          ))}
        </Select>
        <span className="text-sm text-ink-muted">{rows.length} shown</span>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="No Houses match"
            description="Clear the filters or search for something else."
            className="py-16"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>House</Th>
                <Th>Stage</Th>
                <Th>Plan</Th>
                <Th>Owner</Th>
                <Th>M-Pesa</Th>
                <Th className="text-right">Paid in, 30 days</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <Tr
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => void navigate(`/houses/${t.id}`)}
                >
                  <Td>
                    <Link
                      to={`/houses/${t.id}`}
                      className="font-medium text-ink hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t.name}
                    </Link>
                    <div className="text-xs text-ink-subtle">
                      {t.kind === 'atelier' ? 'Atelier' : t.category} · {t.area}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={TENANT_STATUS[t.status].tone} dot>
                      {TENANT_STATUS[t.status].label}
                    </Badge>
                    {t.status === 'onboarding' ? (
                      <div className="mt-1 text-xs text-ink-subtle">
                        Setup {t.checklist.done}/{t.checklist.total}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    {PLAN_LABEL[t.plan]}
                    {t.overrides.length ? (
                      <div className="flex items-center gap-1 text-xs text-gold-700">
                        <Sparkles className="size-3" /> {t.overrides.length} custom
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <UserRound className="size-3.5 text-ink-subtle" /> {t.owner.name}
                    </div>
                    <div className="text-xs text-ink-subtle">
                      {t.source === 'self_signup' ? 'Signed up online' : 'Invited by Stayvinci'}
                    </div>
                  </Td>
                  <Td>
                    {t.payment ? (
                      <>
                        <Badge tone={PROVIDER_STATE[t.payment.state].tone}>
                          {PROVIDER_STATE[t.payment.state].label}
                        </Badge>
                        <div className="mt-1 text-xs text-ink-subtle">
                          {t.payment.method === 'paybill' ? 'Paybill' : 'Till'} ·{' '}
                          {t.payment.mode === 'daraja' ? 'automatic' : 'manual'}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-ink-subtle">Not set up</span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {t.volume30 ? money(t.volume30, 'KES', { compact: true }) : '—'}
                    {t.bookings30 ? (
                      <div className="text-xs text-ink-subtle">{t.bookings30} payments</div>
                    ) : null}
                  </Td>
                  <Td className="text-ink-muted">{relative(t.joinedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <NewHouseDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => void navigate(`/houses/${id}`)}
      />
    </div>
  );
}
