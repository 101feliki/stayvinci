import { useEffect, useState, type ReactNode } from 'react';
import { MessageSquareQuote } from 'lucide-react';
import { Button, Card, CardHeader, Input, PageHeader, Select } from '@stayvinci/ui';
import { api } from '../../lib/api';
import type { Policies } from '../../mock/types';
import { ErrorState, PageSkeleton } from '../../components/common';
import { useAction, useTenantQuery } from '../../lib/query';

/** Plain-language summary shown to guests before payment (spec §5.6). */
function guestSummary(p: Policies): string[] {
  const lines: string[] = [];
  if (p.paymentAtBooking === 'none') lines.push('No payment is needed to book.');
  if (p.paymentAtBooking === 'fixed_deposit')
    lines.push(`A deposit of KES ${p.depositValue.toLocaleString()} secures your booking.`);
  if (p.paymentAtBooking === 'percent_deposit')
    lines.push(`A ${p.depositValue}% deposit secures your booking.`);
  if (p.paymentAtBooking === 'full') lines.push('Full payment is taken when you book.');
  if (p.paymentAtBooking !== 'full')
    lines.push(
      p.balance === 'at_venue'
        ? 'Pay the balance at your visit.'
        : p.balance === 'auto_request'
          ? 'We send a payment request for the balance before your visit.'
          : 'Pay the balance in the app after your visit.',
    );
  lines.push(`Free cancellation up to ${p.freeCancelHours} hours before.`);
  lines.push(
    p.lateCancel === 'deposit_kept'
      ? 'After that, your deposit is kept.'
      : p.lateCancel === 'percent_fee'
        ? `After that, a ${p.lateCancelPct}% fee applies.`
        : 'After that, the full amount is charged.',
  );
  lines.push(
    p.noShow === 'deposit_forfeited'
      ? 'If you miss your booking, the deposit is kept.'
      : 'If you miss your booking, a no-show fee may be requested.',
  );
  if (p.approval === 'request')
    lines.push(
      `Bookings are requests. The House confirms within ${p.approvalWindowHours} hours or your deposit is refunded.`,
    );
  lines.push(`Book at least ${p.leadTimeHours} hours ahead, up to ${p.horizonDays} days out.`);
  return lines;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_280px] sm:items-center">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint ? <div className="text-xs text-ink-subtle">{hint}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function PoliciesPage() {
  const q = useTenantQuery(['policies'], api.policies.get);
  const [p, setP] = useState<Policies | null>(null);
  const save = useAction((v: Policies) => api.policies.save(v), { success: 'Rules saved' });
  useEffect(() => {
    if (q.data) setP(q.data);
  }, [q.data]);
  if (q.error) return <ErrorState error={q.error} />;
  if (!p || !q.data) return <PageSkeleton />;
  const set = <K extends keyof Policies>(k: K, v: Policies[K]) => setP({ ...p, [k]: v });
  const dirty = JSON.stringify(p) !== JSON.stringify(q.data);

  return (
    <div>
      <PageHeader
        title="Policies & rules"
        description="House-wide rules. Categories, services or units can override them; the most specific rule wins."
        actions={
          <Button onClick={() => save.mutate(p)} disabled={!dirty} loading={save.isPending}>
            Save rules
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Payment" />
            <div className="divide-y divide-line">
              <Row label="Payment at booking">
                <Select
                  value={p.paymentAtBooking}
                  onChange={(e) =>
                    set('paymentAtBooking', e.target.value as Policies['paymentAtBooking'])
                  }
                >
                  <option value="none">None</option>
                  <option value="fixed_deposit">Fixed deposit</option>
                  <option value="percent_deposit">Percentage deposit</option>
                  <option value="full">Full prepayment</option>
                </Select>
              </Row>
              {p.paymentAtBooking === 'fixed_deposit' ||
              p.paymentAtBooking === 'percent_deposit' ? (
                <Row
                  label={p.paymentAtBooking === 'fixed_deposit' ? 'Deposit (KES)' : 'Deposit (%)'}
                >
                  <Input
                    type="number"
                    min={0}
                    value={p.depositValue}
                    onChange={(e) => set('depositValue', Number(e.target.value))}
                  />
                </Row>
              ) : null}
              <Row label="Balance">
                <Select
                  value={p.balance}
                  onChange={(e) => set('balance', e.target.value as Policies['balance'])}
                >
                  <option value="at_venue">Pay at venue</option>
                  <option value="auto_request">Payment request before visit</option>
                  <option value="in_app_after">Pay in app after visit</option>
                </Select>
              </Row>
            </div>
          </Card>
          <Card>
            <CardHeader title="Cancellations and no-shows" />
            <div className="divide-y divide-line">
              <Row label="Free cancellation until" hint="Hours before the start">
                <Input
                  type="number"
                  min={0}
                  value={p.freeCancelHours}
                  onChange={(e) => set('freeCancelHours', Number(e.target.value))}
                />
              </Row>
              <Row label="Late cancellation">
                <Select
                  value={p.lateCancel}
                  onChange={(e) => set('lateCancel', e.target.value as Policies['lateCancel'])}
                >
                  <option value="deposit_kept">Keep the deposit</option>
                  <option value="percent_fee">Percentage fee</option>
                  <option value="full_charge">Full charge</option>
                </Select>
              </Row>
              {p.lateCancel === 'percent_fee' ? (
                <Row label="Late cancellation fee (%)">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={p.lateCancelPct}
                    onChange={(e) => set('lateCancelPct', Number(e.target.value))}
                  />
                </Row>
              ) : null}
              <Row label="No-show">
                <Select
                  value={p.noShow}
                  onChange={(e) => set('noShow', e.target.value as Policies['noShow'])}
                >
                  <option value="deposit_forfeited">Deposit forfeited</option>
                  <option value="fee_request">Deposit forfeited + fee request</option>
                </Select>
              </Row>
            </div>
          </Card>
          <Card>
            <CardHeader title="Who and when" />
            <div className="divide-y divide-line">
              <Row label="Minimum notice" hint="Hours">
                <Input
                  type="number"
                  min={0}
                  value={p.leadTimeHours}
                  onChange={(e) => set('leadTimeHours', Number(e.target.value))}
                />
              </Row>
              <Row label="Booking horizon" hint="Days ahead">
                <Input
                  type="number"
                  min={1}
                  value={p.horizonDays}
                  onChange={(e) => set('horizonDays', Number(e.target.value))}
                />
              </Row>
              <Row label="Who can book">
                <Select
                  value={p.whoCanBook}
                  onChange={(e) => set('whoCanBook', e.target.value as Policies['whoCanBook'])}
                >
                  <option value="anyone">Anyone in the store</option>
                  <option value="returning">Returning guests only</option>
                  <option value="members">Members only</option>
                  <option value="invite">Invite-code holders only</option>
                </Select>
              </Row>
              <Row label="Approval">
                <Select
                  value={p.approval}
                  onChange={(e) => set('approval', e.target.value as Policies['approval'])}
                >
                  <option value="instant">Instant confirmation</option>
                  <option value="request">Request to book</option>
                </Select>
              </Row>
              {p.approval === 'request' ? (
                <Row label="Approval window" hint="Hours before auto-decline and refund">
                  <Input
                    type="number"
                    min={1}
                    value={p.approvalWindowHours}
                    onChange={(e) => set('approvalWindowHours', Number(e.target.value))}
                  />
                </Row>
              ) : null}
              <Row label="Max bookings per guest per day">
                <Input
                  type="number"
                  min={1}
                  value={p.maxPerGuestPerDay}
                  onChange={(e) => set('maxPerGuestPerDay', Number(e.target.value))}
                />
              </Row>
              <Row label="Max party size">
                <Input
                  type="number"
                  min={1}
                  value={p.maxPartySize}
                  onChange={(e) => set('maxPartySize', Number(e.target.value))}
                />
              </Row>
            </div>
          </Card>
        </div>
        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 bg-emerald-900 px-5 py-3 text-ivory">
              <MessageSquareQuote className="size-4 text-gold-300" />
              <span className="text-sm font-semibold">What guests see before paying</span>
            </div>
            <ul className="space-y-2.5 p-5 text-sm">
              {guestSummary(p).map((l) => (
                <li key={l} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-400" />
                  {l}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
