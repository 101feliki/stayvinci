import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
  type BadgeTone,
} from '@stayvinci/ui';
import { date } from '@stayvinci/demo-data/format';
import type { Subscription } from '@stayvinci/demo-data/platform';
import { api } from '../../mock/api';
import { ErrorState, PageSkeleton } from '../../components/common';
import { PLAN_LABEL } from '../../lib/labels';
import { useAction } from '../../lib/query';

const SUB: Record<Subscription['status'], { label: string; tone: BadgeTone }> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  trial: { label: 'Setting up', tone: 'azure' },
  active: { label: 'Active', tone: 'emerald' },
  past_due: { label: 'Past due', tone: 'amber' },
  suspended: { label: 'Suspended', tone: 'red' },
};

/** Stayvinci's own billing (spec §12): subscriptions and invoices. Amounts come later. */
export function BillingPage() {
  const q = useQuery({ queryKey: ['billing'], queryFn: api.billing.list });
  const [coupon, setCoupon] = useState<{ id: string; name: string } | null>(null);
  const [code, setCode] = useState('');
  const grace = useAction((id: string) => api.billing.extendGrace(id, 7), {
    success: 'Grace extended by 7 days',
  });
  const apply = useAction(() => api.billing.applyCoupon(coupon?.id ?? '', code), {
    success: 'Coupon applied',
    onSuccess: () => {
      setCoupon(null);
      setCode('');
    },
  });
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="What Houses pay Stayvinci: subscriptions now, marketplace fees later."
      />
      <Card className="flex gap-3 p-4 text-[13px] text-ink-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-azure-600" />
        Prices and fee rates aren&apos;t decided yet, so invoices show status only. They&apos;ll
        come from the plan catalogue once set (no prices are hard-coded).
      </Card>
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>House</Th>
              <Th>Plan</Th>
              <Th>Subscription</Th>
              <Th>Invoices</Th>
              <Th>Next billing</Th>
              <Th>Coupon</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {q.data.map((s) => {
              const overdue = s.invoices.filter((i) => i.status === 'overdue').length;
              return (
                <Tr key={s.tenantId}>
                  <Td>
                    <Link to={`/houses/${s.tenantId}`} className="font-medium hover:underline">
                      {s.tenant.name}
                    </Link>
                  </Td>
                  <Td>
                    {PLAN_LABEL[s.tenant.plan]}
                    <div className="text-xs text-ink-subtle">{s.tenant.interval}</div>
                  </Td>
                  <Td>
                    <Badge tone={SUB[s.status].tone} dot>
                      {SUB[s.status].label}
                    </Badge>
                  </Td>
                  <Td className="text-[13px]">
                    {s.invoices.length} issued
                    {overdue ? <span className="text-red-700"> · {overdue} overdue</span> : null}
                  </Td>
                  <Td className="text-ink-muted">
                    {s.nextBillingAt ? date(s.nextBillingAt, 'Africa/Nairobi') : '—'}
                  </Td>
                  <Td className="font-mono text-xs">{s.coupon ?? '—'}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {s.status === 'past_due' || s.status === 'suspended' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => grace.mutate(s.tenantId)}
                      >
                        Give 7 more days
                      </Button>
                    ) : null}{' '}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCoupon({ id: s.tenantId, name: s.tenant.name })}
                    >
                      Coupon
                    </Button>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Dialog
        open={coupon !== null}
        onOpenChange={(o) => (o ? null : setCoupon(null))}
        title={`Apply a coupon to ${coupon?.name ?? ''}`}
        description="For design partners and promotions (spec §2)."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCoupon(null)}>
              Cancel
            </Button>
            <Button loading={apply.isPending} onClick={() => apply.mutate(undefined)}>
              Apply
            </Button>
          </>
        }
      >
        <Field label="Coupon code">
          {(id) => (
            <Input
              id={id}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PILOT-3M"
            />
          )}
        </Field>
      </Dialog>
    </div>
  );
}
