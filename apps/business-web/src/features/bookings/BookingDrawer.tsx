import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Check, LogIn, Undo2, UserX, X } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  Drawer,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '@stayvinci/ui';
import { api } from '../../mock/api';
import type { BookingState, Payment } from '../../mock/types';
import { useCan, useSession } from '../../app/session';
import { useBookingDrawer } from '../../app/ui';
import { HiddenContact, KeyValue, SectionTitle, StateBadge } from '../../components/common';
import {
  dateTime,
  durationLabel,
  guestName,
  money,
  time,
  zonedToUtc,
  dayKey,
} from '../../lib/format';
import { PAYMENT_STATUS, TRANSITIONS } from '../../lib/states';
import { useAction, useTenantQuery } from '../../lib/query';

export function BookingDrawer() {
  const { id, close } = useBookingDrawer();
  const { tenant } = useSession();
  const can = useCan();
  const q = useQuery({
    queryKey: [tenant.id, 'booking', id],
    queryFn: () => api.bookings.get(id ?? ''),
    enabled: Boolean(id),
  });
  const catalogue = useTenantQuery(['catalogue'], api.catalogue.get);
  const team = useTenantQuery(['team'], api.team.list);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [refund, setRefund] = useState<Payment | null>(null);

  const transition = useAction(
    (args: { to: BookingState; reason?: string }) =>
      api.bookings.transition(id ?? '', args.to, args.reason),
    { success: 'Booking updated' },
  );
  const callback = useAction((ok: boolean) => api.bookings.simulateCallback(id ?? '', ok), {
    success: (b) =>
      b.state === 'confirmed' ? 'Payment received, booking confirmed' : 'Payment request cancelled',
  });

  const data = q.data;
  const b = data?.booking;
  const service = catalogue.data?.services.find((s) => s.id === b?.serviceId);
  const variant = service?.variants.find((v) => v.id === b?.variantId);
  const resources = team.data?.resources ?? [];
  const staff = resources.find((r) => r.id === b?.staffId);
  const room = resources.find((r) => r.id === b?.roomId);
  const unit = resources.find((r) => r.id === b?.unitId);
  const allowed = b ? (TRANSITIONS[b.state] ?? []) : [];
  const tz = tenant.timezone;
  const balance = b ? b.total - b.paid : 0;
  const canAct = (to: BookingState) =>
    allowed.includes(to) &&
    (b?.state === 'requested' ? can('booking.approve') : can('booking.edit'));

  return (
    <Drawer
      open={Boolean(id)}
      onOpenChange={(o) => (!o ? close() : undefined)}
      title={b ? (service?.name ?? unit?.name ?? 'Booking') : 'Booking'}
      description={
        b ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{b.ref}</span>
            <StateBadge state={b.state} />
            {b.attribution === 'marketplace' ? <Badge tone="gold">Marketplace guest</Badge> : null}
          </span>
        ) : undefined
      }
      footer={
        b ? (
          <>
            {canAct('cancelled_by_tenant') ? (
              <Button
                variant="ghost"
                className="mr-auto text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => setCancelOpen(true)}
              >
                <X className="size-4" /> {b.state === 'requested' ? 'Decline' : 'Cancel'}
              </Button>
            ) : null}
            {['confirmed', 'pending_payment', 'requested'].includes(b.state) &&
            can('booking.edit') &&
            b.staffId ? (
              <Button variant="secondary" onClick={() => setMoveOpen(true)}>
                <CalendarClock className="size-4" /> Reschedule
              </Button>
            ) : null}
            {canAct('no_show') ? (
              <Button variant="secondary" onClick={() => transition.mutate({ to: 'no_show' })}>
                <UserX className="size-4" /> No-show
              </Button>
            ) : null}
            {b.state === 'requested' && canAct('confirmed') ? (
              <Button
                onClick={() => transition.mutate({ to: 'confirmed' })}
                loading={transition.isPending}
              >
                <Check className="size-4" /> Approve
              </Button>
            ) : null}
            {canAct('checked_in') ? (
              <Button
                onClick={() => transition.mutate({ to: 'checked_in' })}
                loading={transition.isPending}
              >
                <LogIn className="size-4" /> Check in
              </Button>
            ) : null}
            {canAct('completed') ? (
              <Button
                onClick={() => transition.mutate({ to: 'completed' })}
                loading={transition.isPending}
              >
                <Check className="size-4" /> Complete
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {!data || !b ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="space-y-6">
          {b.state === 'pending_payment' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">
                Waiting for the M-Pesa payment
              </div>
              <p className="mt-0.5 text-[13px] text-amber-800">
                The guest has a payment prompt on their phone. The booking confirms automatically
                when M-Pesa reports the payment.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => callback.mutate(true)}
                  loading={callback.isPending}
                >
                  Simulate payment received
                </Button>
                <Button size="sm" variant="ghost" onClick={() => callback.mutate(false)}>
                  Simulate guest cancelled
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl bg-canvas p-4">
            <div className="text-lg font-semibold tracking-tight">
              {unit
                ? `${dateTime(b.start, tz)} → ${dateTime(b.end, tz)}`
                : `${dateTime(b.start, tz)} – ${time(b.end, tz)}`}
            </div>
            <div className="mt-1 text-sm text-ink-muted">
              {variant
                ? variant.name.includes('min')
                  ? variant.name
                  : `${variant.name} · ${durationLabel(variant.durationMin)}`
                : null}
              {unit ? `${unit.name} · ${b.guests} guest${b.guests > 1 ? 's' : ''}` : null}
              {staff ? ` · with ${staff.name}` : null}
              {room ? ` · ${room.name}` : null}
            </div>
          </div>

          <section>
            <SectionTitle
              action={
                data.guest ? (
                  <Link
                    to={`/guests/${data.guest.id}`}
                    className="text-[13px] font-medium text-azure-700 hover:underline"
                  >
                    View profile
                  </Link>
                ) : null
              }
            >
              Guest
            </SectionTitle>
            <div className="divide-y divide-line">
              <KeyValue label="Name">{guestName(data.guest ?? undefined)}</KeyValue>
              <KeyValue label="Phone">{data.guest?.phone ?? <HiddenContact />}</KeyValue>
              <KeyValue label="Visits">{data.guest?.visits ?? 0}</KeyValue>
              {data.guest?.preferences.length ? (
                <KeyValue label="Preferences">{data.guest.preferences.join(', ')}</KeyValue>
              ) : null}
            </div>
            {b.notes ? (
              <p className="mt-2 rounded-lg bg-gold-50 px-3 py-2 text-[13px] text-gold-800">
                Note: {b.notes}
              </p>
            ) : null}
          </section>

          <section>
            <SectionTitle>Payment</SectionTitle>
            <div className="divide-y divide-line">
              <KeyValue label="Total">{money(b.total)}</KeyValue>
              <KeyValue label="Paid">{money(b.paid)}</KeyValue>
              <KeyValue label="Balance">
                <span className={balance > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                  {balance > 0 ? money(balance) : 'Settled'}
                </span>
              </KeyValue>
            </div>
            {data.payments.length ? (
              <ul className="mt-3 space-y-2">
                {data.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm"
                  >
                    <span className="flex-1">
                      <span className="font-medium">
                        {p.provider === 'mpesa'
                          ? 'M-Pesa'
                          : p.provider === 'card'
                            ? 'Card'
                            : 'Cash'}
                      </span>
                      <span className="ml-2 font-mono text-xs text-ink-subtle">
                        {p.providerRef}
                      </span>
                    </span>
                    <span className="tabular-nums">{money(p.amount)}</span>
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>
                      {PAYMENT_STATUS[p.status].label}
                    </Badge>
                    {can('payment.refund') &&
                    (p.status === 'succeeded' || p.status === 'partially_refunded') &&
                    p.provider !== 'cash' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRefund(p)}
                        aria-label="Refund"
                      >
                        <Undo2 className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            <SectionTitle>Timeline</SectionTitle>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {b.events
                .filter((e) => !e.label.startsWith('idem:'))
                .map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-surface bg-emerald-600" />
                    <div className="text-sm font-medium">{e.label}</div>
                    <div className="text-xs text-ink-subtle">
                      {dateTime(e.at, tz)} · {e.actor}
                    </div>
                  </li>
                ))}
            </ol>
          </section>
        </div>
      )}

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        isRequest={b?.state === 'requested'}
        paid={b?.paid ?? 0}
        onConfirm={(reason) => {
          transition.mutate(
            { to: 'cancelled_by_tenant', reason },
            { onSuccess: () => setCancelOpen(false) },
          );
        }}
        loading={transition.isPending}
      />
      {b && moveOpen ? (
        <RescheduleDialog
          bookingId={b.id}
          start={b.start}
          staffId={b.staffId}
          onClose={() => setMoveOpen(false)}
        />
      ) : null}
      {refund ? <RefundDialog payment={refund} onClose={() => setRefund(null)} /> : null}
    </Drawer>
  );
}

function CancelDialog({
  open,
  onOpenChange,
  isRequest,
  paid,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isRequest: boolean;
  paid: number;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isRequest ? 'Decline this request?' : 'Cancel this booking?'}
      description={
        paid > 0
          ? `The guest gets a full refund of ${money(paid)}. Cancellations by the House always refund in full.`
          : 'The guest will be notified.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(reason)}
            loading={loading}
            disabled={!reason.trim()}
          >
            {isRequest ? 'Decline and refund' : 'Cancel and refund'}
          </Button>
        </>
      }
    >
      <Field label="Reason (shared with the guest)">
        {(id) => (
          <Textarea
            id={id}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Therapist unwell, we're sorry"
          />
        )}
      </Field>
    </Dialog>
  );
}

function RescheduleDialog({
  bookingId,
  start,
  staffId,
  onClose,
}: {
  bookingId: string;
  start: string;
  staffId: string | null;
  onClose: () => void;
}) {
  const { tenant } = useSession();
  const team = useTenantQuery(['team'], api.team.list);
  const [day, setDay] = useState(dayKey(start, tenant.timezone));
  const [at, setAt] = useState(time(start, tenant.timezone));
  const [who, setWho] = useState(staffId ?? '');
  const move = useAction(
    () =>
      api.bookings.reschedule(bookingId, zonedToUtc(day, at, tenant.timezone), who || undefined),
    {
      success: 'Booking moved',
      onSuccess: onClose,
    },
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title="Reschedule booking"
      description="We check the therapist and room are free before moving it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => move.mutate(undefined)} loading={move.isPending}>
            Move booking
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          {(id) => (
            <Input id={id} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          )}
        </Field>
        <Field label="Time">
          {(id) => (
            <Input
              id={id}
              type="time"
              step={900}
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
          )}
        </Field>
        <Field label="With" className="sm:col-span-2">
          {(id) => (
            <Select id={id} value={who} onChange={(e) => setWho(e.target.value)}>
              {team.data?.resources
                .filter((r) => r.type === 'staff')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
      </div>
    </Dialog>
  );
}

export function RefundDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const left = payment.amount - payment.refunded;
  const [amount, setAmount] = useState(String(left / 100));
  const [reason, setReason] = useState('');
  const refund = useAction(
    () => api.payments.refund(payment.id, Math.round(Number(amount) * 100), reason),
    {
      success: 'Refund issued',
      onSuccess: onClose,
    },
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title="Issue a refund"
      description={`Up to ${money(left)} can be refunded on this payment. ${payment.provider === 'mpesa' ? 'M-Pesa refunds use your reversal flow.' : 'Card refunds go back through the gateway.'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => refund.mutate(undefined)}
            loading={refund.isPending}
          >
            Refund {money(Math.round(Number(amount || 0) * 100))}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Amount (KES)">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={left / 100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>
        <Field label="Reason (required, recorded in the audit log)">
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}
