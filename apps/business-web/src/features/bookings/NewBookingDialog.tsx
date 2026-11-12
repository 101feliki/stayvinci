import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, CheckCircle2, CreditCard, Link2, Smartphone, UserPlus } from 'lucide-react';
import {
  Avatar,
  Button,
  Dialog,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  cn,
} from '@stayvinci/ui';
import { api, todayKey, addDaysKey } from '../../mock/api';
import type { Booking } from '../../mock/types';
import { useSession } from '../../app/session';
import { useBookingDrawer, useUi } from '../../app/ui';
import { dayLabel, durationLabel, guestName, money, zonedToUtc } from '../../lib/format';
import { newIdempotencyKey, useAction, useTenantQuery } from '../../lib/query';

type Pay = 'stk' | 'cash' | 'card_link' | 'none';

/** Front desk booking for walk-ins and phone calls (spec §10.8). Attributed own_channel. */
export function NewBookingDialog() {
  const { newBooking, closeNewBooking } = useUi();
  if (!newBooking) return null;
  return (
    <NewBookingForm
      key={JSON.stringify(newBooking)}
      prefill={newBooking}
      onClose={closeNewBooking}
    />
  );
}

function NewBookingForm({
  prefill,
  onClose,
}: {
  prefill: { staffId?: string; day?: string; time?: string; guestId?: string };
  onClose: () => void;
}) {
  const { tenant } = useSession();
  const tz = tenant.timezone;
  const catalogue = useTenantQuery(['catalogue'], api.catalogue.get);
  const team = useTenantQuery(['team'], api.team.list);
  const guests = useTenantQuery(['guests'], api.guests.list);
  const drawer = useBookingDrawer();

  const [guestQuery, setGuestQuery] = useState('');
  const [guestId, setGuestId] = useState<string | null>(prefill.guestId ?? null);
  const [newGuest, setNewGuest] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
  } | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [staffId, setStaffId] = useState(prefill.staffId ?? '');
  const [day, setDay] = useState(prefill.day ?? todayKey(tz));
  const [slot, setSlot] = useState<string | null>(
    prefill.time && prefill.day ? zonedToUtc(prefill.day, prefill.time, tz) : null,
  );
  const [pay, setPay] = useState<Pay>('stk');
  const [notes, setNotes] = useState('');
  const [idem] = useState(newIdempotencyKey);
  const [created, setCreated] = useState<Booking | null>(null);

  const services = useMemo(
    () => catalogue.data?.services.filter((s) => s.variants.length) ?? [],
    [catalogue.data],
  );
  const service = services.find((s) => s.id === serviceId);
  const staffOptions = (team.data?.resources ?? []).filter(
    (r) => r.type === 'staff' && (!service || service.staffIds.includes(r.id)),
  );

  useEffect(() => {
    if (!serviceId && services[0]) {
      const first = prefill.staffId
        ? services.find((s) => s.staffIds.includes(prefill.staffId ?? ''))
        : services[0];
      if (first) {
        setServiceId(first.id);
        setVariantId(first.variants[0]?.id ?? '');
      }
    }
  }, [services, serviceId, prefill.staffId]);
  useEffect(() => {
    if (service && staffId && !service.staffIds.includes(staffId))
      setStaffId(service.staffIds[0] ?? '');
    if (service && !staffId) setStaffId(service.staffIds[0] ?? '');
  }, [service, staffId]);

  const slots = useQuery({
    queryKey: [tenant.id, 'slots', serviceId, variantId, staffId, day],
    queryFn: () => api.bookings.slots(serviceId, variantId, staffId, day),
    enabled: Boolean(serviceId && variantId && staffId),
  });

  const create = useAction(
    () =>
      api.bookings.create({
        guestId,
        newGuest,
        serviceId,
        variantId,
        staffId,
        start: slot ?? '',
        payment: pay,
        notes,
        idempotencyKey: idem,
      }),
    {
      onSuccess: (b) => setCreated(b),
      success: (b) => (b.state === 'confirmed' ? `Booked ${b.ref}` : `Booking ${b.ref} created`),
    },
  );

  const matches = (guests.data ?? [])
    .filter((g) => !guestQuery || guestName(g).toLowerCase().includes(guestQuery.toLowerCase()))
    .slice(0, 6);
  const selectedGuest = guests.data?.find((g) => g.id === guestId);
  const variant = service?.variants.find((v) => v.id === variantId);
  const ready =
    (guestId || (newGuest?.firstName && newGuest.phone)) &&
    serviceId &&
    variantId &&
    staffId &&
    slot;

  if (created) {
    return (
      <PaymentWaiting
        booking={created}
        method={pay}
        onClose={onClose}
        onOpenBooking={() => {
          onClose();
          drawer.open(created.id);
        }}
      />
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      size="lg"
      title="New booking"
      description="For walk-ins and phone calls. We only show times when the therapist and a room are free."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate(undefined)}
            loading={create.isPending}
            disabled={!ready}
          >
            {pay === 'stk'
              ? 'Book and send M-Pesa request'
              : pay === 'card_link'
                ? 'Book and send card link'
                : 'Create booking'}
          </Button>
        </>
      }
    >
      {!catalogue.data || !team.data ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Guest */}
          <section className="space-y-2">
            <div className="text-[13px] font-semibold">1. Guest</div>
            {selectedGuest ? (
              <div className="flex items-center gap-3 rounded-xl border border-azure-200 bg-azure-50 px-3 py-2">
                <Avatar name={guestName(selectedGuest)} size="sm" />
                <span className="flex-1 text-sm font-medium">{guestName(selectedGuest)}</span>
                <span className="text-xs text-ink-muted">{selectedGuest.visits} visits</span>
                <Button size="sm" variant="ghost" onClick={() => setGuestId(null)}>
                  Change
                </Button>
              </div>
            ) : newGuest ? (
              <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-3">
                <Input
                  placeholder="First name"
                  value={newGuest.firstName}
                  onChange={(e) => setNewGuest({ ...newGuest, firstName: e.target.value })}
                />
                <Input
                  placeholder="Last name"
                  value={newGuest.lastName}
                  onChange={(e) => setNewGuest({ ...newGuest, lastName: e.target.value })}
                />
                <Input
                  placeholder="+254 7…"
                  type="tel"
                  value={newGuest.phone}
                  onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                />
                <button
                  type="button"
                  className="text-left text-xs text-azure-700 hover:underline sm:col-span-3"
                  onClick={() => setNewGuest(null)}
                >
                  Pick an existing guest instead
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Search guests by name"
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {matches.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGuestId(g.id)}
                      className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm hover:border-azure-400"
                    >
                      <Avatar name={guestName(g)} size="sm" />
                      {guestName(g)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewGuest({ firstName: guestQuery, lastName: '', phone: '' })}
                    className="flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 py-1 text-sm text-ink-muted hover:border-azure-400 hover:text-ink"
                  >
                    <UserPlus className="size-4" /> New guest
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Service */}
          <section className="space-y-2">
            <div className="text-[13px] font-semibold">2. Service</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Service" className="sm:col-span-2">
                {(id) => (
                  <Select
                    id={id}
                    value={serviceId}
                    onChange={(e) => {
                      const s = services.find((x) => x.id === e.target.value);
                      setServiceId(e.target.value);
                      setVariantId(s?.variants[0]?.id ?? '');
                      setSlot(null);
                    }}
                  >
                    {catalogue.data.categories.map((c) => (
                      <optgroup key={c.id} label={c.name}>
                        {services
                          .filter((s) => s.categoryId === c.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {s.visibility === 'hidden' ? ' (internal)' : ''}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Option">
                {(id) => (
                  <Select
                    id={id}
                    value={variantId}
                    onChange={(e) => {
                      setVariantId(e.target.value);
                      setSlot(null);
                    }}
                  >
                    {service?.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} · {money(v.price)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </section>

          {/* Time */}
          <section className="space-y-3">
            <div className="text-[13px] font-semibold">3. Who and when</div>
            <div className="flex flex-wrap gap-2">
              {staffOptions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStaffId(s.id);
                    setSlot(null);
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors',
                    staffId === s.id
                      ? 'border-emerald-700 bg-emerald-50 font-medium'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <Avatar name={s.name} size="sm" />
                  {s.name.split(' ')[0]}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {Array.from({ length: 10 }, (_, i) => addDaysKey(todayKey(tz), i)).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDay(d);
                    setSlot(null);
                  }}
                  className={cn(
                    'shrink-0 rounded-xl border px-3 py-2 text-center text-xs transition-colors',
                    d === day
                      ? 'border-emerald-800 bg-emerald-900 text-ivory'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  {dayLabel(zonedToUtc(d, '12:00', tz), tz)}
                </button>
              ))}
            </div>
            {slots.isLoading ? (
              <Skeleton className="h-24" />
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                {(slots.data ?? []).filter((s) => s.free).length === 0 ? (
                  <p className="col-span-full py-4 text-center text-sm text-ink-muted">
                    No free times this day. Try another day or therapist.
                  </p>
                ) : (
                  slots.data
                    ?.filter((s) => s.free)
                    .map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        onClick={() => setSlot(s.start)}
                        className={cn(
                          'rounded-lg border py-2 text-sm tabular-nums transition-colors',
                          slot === s.start
                            ? 'border-azure-500 bg-azure-500 font-semibold text-white'
                            : 'border-line hover:border-azure-400',
                        )}
                      >
                        {s.label}
                      </button>
                    ))
                )}
              </div>
            )}
            {variant ? (
              <p className="text-xs text-ink-subtle">
                {durationLabel(variant.durationMin)} plus {service?.bufferAfterMin ?? 0} min
                turnover.
              </p>
            ) : null}
          </section>

          {/* Payment */}
          <section className="space-y-2">
            <div className="text-[13px] font-semibold">4. Payment</div>
            <div className="grid gap-2 sm:grid-cols-4">
              {(
                [
                  { v: 'stk', label: 'M-Pesa request', icon: Smartphone },
                  { v: 'card_link', label: 'Card link', icon: CreditCard },
                  { v: 'cash', label: 'Cash now', icon: Banknote },
                  { v: 'none', label: 'Pay at visit', icon: Link2 },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setPay(o.v)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left text-sm transition-colors',
                    pay === o.v
                      ? 'border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <o.icon className="size-4 text-emerald-700" />
                  <span className="font-medium">{o.label}</span>
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Booking note (visible to staff)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-14"
            />
          </section>
        </div>
      )}
    </Dialog>
  );
}

function PaymentWaiting({
  booking,
  method,
  onClose,
  onOpenBooking,
}: {
  booking: Booking;
  method: Pay;
  onClose: () => void;
  onOpenBooking: () => void;
}) {
  const [seconds, setSeconds] = useState(90);
  const [state, setState] = useState(booking.state);
  const callback = useAction((ok: boolean) => api.bookings.simulateCallback(booking.id, ok), {
    onSuccess: (b) => setState(b.state),
  });
  useEffect(() => {
    if (state !== 'pending_payment') return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [state]);

  const waiting = state === 'pending_payment' && method === 'stk';
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      size="sm"
      title={waiting ? 'Waiting for M-Pesa' : 'Booking created'}
      footer={
        <>
          <Button variant="secondary" onClick={onOpenBooking}>
            View booking
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col items-center py-4 text-center">
        {waiting ? (
          <>
            <div className="relative mb-5 flex size-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-azure-400/30" />
              <span className="relative flex size-16 items-center justify-center rounded-full bg-azure-500 text-white">
                <Smartphone className="size-7" />
              </span>
            </div>
            <p className="text-sm font-medium">The guest has a payment prompt on their phone.</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Reference <span className="font-mono">{booking.ref}</span>. The hold expires in{' '}
              <span className="font-semibold text-ink tabular-nums">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
              </span>
              .
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => callback.mutate(true)}
                loading={callback.isPending}
              >
                Simulate payment received
              </Button>
              <Button size="sm" variant="ghost" onClick={() => callback.mutate(false)}>
                Guest cancelled
              </Button>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 className="mb-4 size-14 text-emerald-600" />
            <p className="text-sm font-medium">
              {state === 'confirmed'
                ? 'Confirmed and paid as required.'
                : method === 'card_link'
                  ? 'Card payment link sent to the guest.'
                  : 'Booking saved.'}
            </p>
            <p className="mt-1 font-mono text-[13px] text-ink-muted">{booking.ref}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
