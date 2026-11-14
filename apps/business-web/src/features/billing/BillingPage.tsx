import { useState } from 'react';
import { Info, Receipt, Smartphone } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Field,
  PageHeader,
  StatTile,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '@stayvinci/ui';
import { api } from '../../lib/api';
import { SAMPLE_FEE_RULE, SAMPLE_PLAN } from '../../mock/seed';
import { useSession } from '../../app/session';
import { ErrorState, PageSkeleton } from '../../components/common';
import { date, money } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

/** Stayvinci billing and the marketplace fee dashboard (spec §12). Owner only. */
export function BillingPage() {
  const { tenant } = useSession();
  const q = useTenantQuery(['billing'], api.billing.get);
  const [dispute, setDispute] = useState<string | null>(null);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const { invoices, feeLines, attributed } = q.data;
  const raised = feeLines.filter((f) => f.status === 'raised').reduce((n, f) => n + f.fee, 0);
  const open = invoices.find((i) => i.status === 'open');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="What you pay Stayvinci. This is completely separate from your guests' payments."
      />
      <div className="flex items-start gap-3 rounded-2xl border border-azure-200 bg-azure-50 px-4 py-3 text-[13px] text-azure-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        Pricing is not final. Plan and fee amounts below are sample configuration for this
        prototype.
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-1">
          <div className="bg-emerald-card p-5 text-ivory">
            <div className="text-xs tracking-wider text-gold-300 uppercase">Your plan</div>
            <div className="mt-1 text-2xl font-semibold">{SAMPLE_PLAN.name}</div>
            <div className="mt-1 text-sm text-emerald-200">
              Billed {SAMPLE_PLAN.interval} · {SAMPLE_PLAN.note}
            </div>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-emerald-700" /> M-Pesa standing authority · ••••
              678
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary">
                Change plan
              </Button>
              <Button size="sm" variant="ghost">
                Update payment method
              </Button>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatTile
            label="Current invoice"
            value={open ? money(open.subscription + open.fees - open.credits) : '—'}
            sub={open ? `${open.period} · due on billing date` : 'Nothing due'}
            accent="gold"
          />
          <StatTile
            label="Marketplace fees raised"
            value={money(raised)}
            sub="All time"
            accent="plum"
          />
          <StatTile
            label="Own-channel guests"
            value={attributed.own}
            sub="Never charged a fee"
            accent="emerald"
          />
          <StatTile
            label="Marketplace guests"
            value={attributed.marketplace}
            sub="Fee on first completed booking only"
            accent="azure"
          />
        </div>
      </div>

      <Card>
        <CardHeader
          title="Marketplace fee dashboard"
          description={`A fee applies only once per marketplace guest: on their first completed booking. Sample rule ${SAMPLE_FEE_RULE.percent}% (min ${money(SAMPLE_FEE_RULE.minimum)}, max ${money(SAMPLE_FEE_RULE.maximum)}), version ${SAMPLE_FEE_RULE.version}.`}
        />
        <Table>
          <thead>
            <tr>
              <Th>Guest</Th>
              <Th className="hidden md:table-cell">Explanation</Th>
              <Th className="text-right">Booking</Th>
              <Th className="text-right">Fee</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {feeLines.map((f) => (
              <Tr key={f.id}>
                <Td>
                  <div className="font-medium">{f.guestName}</div>
                  <div className="font-mono text-xs text-ink-subtle">{f.bookingRef}</div>
                </Td>
                <Td className="hidden max-w-md text-[13px] text-ink-muted md:table-cell">
                  {f.explanation}
                </Td>
                <Td className="text-right tabular-nums">{money(f.bookingValue)}</Td>
                <Td className="text-right font-medium tabular-nums">
                  {f.status === 'voided' ? (
                    <span className="text-ink-subtle line-through">{money(f.fee)}</span>
                  ) : (
                    money(f.fee)
                  )}
                </Td>
                <Td>
                  <Badge
                    tone={
                      f.status === 'raised'
                        ? 'gold'
                        : f.status === 'disputed'
                          ? 'plum'
                          : f.status === 'voided'
                            ? 'neutral'
                            : 'amber'
                    }
                  >
                    {f.status}
                  </Badge>
                </Td>
                <Td className="text-right">
                  {f.status === 'raised' ? (
                    <Button size="sm" variant="ghost" onClick={() => setDispute(f.id)}>
                      Dispute
                    </Button>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Invoices" />
        <Table>
          <thead>
            <tr>
              <Th>Invoice</Th>
              <Th>Period</Th>
              <Th className="hidden text-right sm:table-cell">Subscription</Th>
              <Th className="hidden text-right sm:table-cell">Fees</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <Tr key={i.id}>
                <Td>
                  <div className="flex items-center gap-2 font-mono text-[13px]">
                    <Receipt className="size-4 text-ink-subtle" /> {i.number}
                  </div>
                  <div className="text-xs text-ink-subtle">
                    Issued {date(i.issuedAt, tenant.timezone)}
                  </div>
                </Td>
                <Td>{i.period}</Td>
                <Td className="hidden text-right tabular-nums sm:table-cell">
                  {money(i.subscription)}
                </Td>
                <Td className="hidden text-right tabular-nums sm:table-cell">
                  {money(i.fees)}
                  {i.credits ? (
                    <div className="text-xs text-emerald-700">−{money(i.credits)} credit</div>
                  ) : null}
                </Td>
                <Td className="text-right font-medium tabular-nums">
                  {money(i.subscription + i.fees - i.credits)}
                </Td>
                <Td>
                  <Badge
                    tone={i.status === 'paid' ? 'emerald' : i.status === 'open' ? 'azure' : 'red'}
                  >
                    {i.status}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {dispute ? <DisputeDialog feeId={dispute} onClose={() => setDispute(null)} /> : null}
    </div>
  );
}

function DisputeDialog({ feeId, onClose }: { feeId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const go = useAction(() => api.billing.dispute(feeId, reason), {
    success: 'Dispute sent to Stayvinci Finance',
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title="Dispute this fee"
      description="Stayvinci Finance reviews every dispute. You'll see the outcome here."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => go.mutate(undefined)}
            disabled={!reason.trim()}
            loading={go.isPending}
          >
            Send dispute
          </Button>
        </>
      }
    >
      <Field
        label="Why is this fee wrong?"
        hint="e.g. This guest was already our client before they found us on the marketplace."
      >
        {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
    </Dialog>
  );
}
