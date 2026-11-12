import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  CreditCard,
  MapPin,
  Package,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { Avatar, Button, Checkbox, Input, Skeleton, Switch, Textarea, cn } from '@stayvinci/ui';
import {
  addDaysKey,
  dateTime,
  dayKey,
  dayLabel,
  durationLabel,
  money,
  zonedToUtc,
} from '@stayvinci/demo-data/format';
import type { Booking } from '@stayvinci/demo-data/types';
import { api } from '../../lib/api';
import { useAction, useMe, useSignIn } from '../../app/shared';

type Step = 'time' | 'details' | 'pay';
const STEPS: { key: Step; label: string }[] = [
  { key: 'time', label: 'Time' },
  { key: 'details', label: 'Details' },
  { key: 'pay', label: 'Confirm' },
];

/** Guest booking flow (spec §10.1): option → time → details → pay → confirmation. */
export function CheckoutPage() {
  const { handle = '', serviceId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const me = useMe();
  const { requireSignIn } = useSignIn();
  const store = useQuery({ queryKey: ['store', handle], queryFn: () => api.store(handle) });
  const tz = store.data?.tenant.timezone ?? 'Africa/Nairobi';
  const today = dayKey(new Date(), tz);

  const [step, setStep] = useState<Step>('time');
  const [variantId, setVariantId] = useState(params.get('v') ?? '');
  const [staffChoice, setStaffChoice] = useState<string | null>(null); // null = any available
  const [day, setDay] = useState(today);
  const [slot, setSlot] = useState<{ start: string; staffId: string } | null>(null);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [useAlias, setUseAlias] = useState(false);
  const [alias, setAlias] = useState('');
  const [method, setMethod] = useState<'mpesa' | 'card' | 'credit'>('mpesa');
  const [phone, setPhone] = useState('');
  const [idem] = useState(() => crypto.randomUUID());
  const [booking, setBooking] = useState<Booking | null>(null);

  const svc = store.data?.services.find((s) => s.id === serviceId);
  const variant = svc?.variants.find((v) => v.id === variantId) ?? svc?.variants[0];
  useEffect(() => {
    if (variant && !variantId) setVariantId(variant.id);
  }, [variant, variantId]);
  useEffect(() => {
    if (me.data?.phone && !phone) setPhone(me.data.phone);
  }, [me.data, phone]);

  const slots = useQuery({
    queryKey: ['slots', handle, serviceId, variant?.id, staffChoice, day],
    queryFn: () => api.slots(handle, serviceId, variant?.id ?? '', staffChoice, day),
    enabled: Boolean(variant),
  });

  const addOns = useMemo(() => store.data?.addOns.slice(0, 3) ?? [], [store.data]);
  const extras = addOns.filter((a) => addOnIds.includes(a.id));
  const total = (variant?.price ?? 0) + extras.reduce((n, a) => n + a.price, 0);
  const pol = store.data?.policies;
  const deposit =
    method === 'credit'
      ? 0
      : pol?.paymentAtBooking === 'percent_deposit'
        ? Math.round((total * pol.depositValue) / 100)
        : pol?.paymentAtBooking === 'full'
          ? total
          : 0;

  const book = useAction(
    () =>
      api.book({
        handle,
        variantId: variant?.id ?? '',
        staffId: slot?.staffId || staffChoice || '',
        start: slot?.start ?? '',
        notes: useAlias && alias.trim() ? `Please call me ${alias.trim()}. ${notes}` : notes,
        idempotencyKey: idem,
      }),
    { onSuccess: (b) => setBooking(b) },
  );

  if (!store.data || !svc || !variant)
    return (
      <div className="mx-auto max-w-xl space-y-4 p-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  const s = store.data;
  const th = s.palette;
  const staff = s.staff.filter((p) => svc.staffIds.includes(p.id));
  const chosenStaff = s.staff.find((p) => p.id === slot?.staffId);

  if (booking)
    return (
      <AfterBooking
        booking={booking}
        storeName={s.tenant.name}
        handle={handle}
        method={method}
        phone={phone}
        tz={tz}
        address={s.address}
      />
    );

  const stepIdx = STEPS.findIndex((x) => x.key === step);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() =>
              stepIdx > 0 ? setStep(STEPS[stepIdx - 1]?.key ?? 'time') : navigate(-1)
            }
            className="rounded-full p-1.5 hover:bg-canvas"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{svc.name}</div>
            <div className="truncate text-xs text-ink-muted">{s.tenant.name}</div>
          </div>
        </div>
        <div className="mx-auto flex max-w-xl gap-1.5 px-4 pb-3">
          {STEPS.map((x, i) => (
            <div key={x.key} className="flex-1">
              <div className={cn('h-1 rounded-full', i <= stepIdx ? 'bg-azure-500' : 'bg-line')} />
              <div
                className={cn(
                  'mt-1 text-[11px] font-medium',
                  i === stepIdx ? 'text-ink' : 'text-ink-subtle',
                )}
              >
                {x.label}
              </div>
            </div>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-5 pb-40">
        {step === 'time' ? (
          <div className="space-y-6">
            {svc.variants.length > 1 ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold">Option</h2>
                <div className="flex flex-wrap gap-2">
                  {svc.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setVariantId(v.id);
                        setSlot(null);
                      }}
                      className={cn(
                        'rounded-full border px-4 py-2 text-sm',
                        v.id === variant.id
                          ? 'border-emerald-800 bg-emerald-900 text-ivory'
                          : 'border-line bg-surface',
                      )}
                    >
                      {v.name} · {money(v.price)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <section>
              <h2 className="mb-2 text-sm font-semibold">With</h2>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                <button
                  type="button"
                  onClick={() => {
                    setStaffChoice(null);
                    setSlot(null);
                  }}
                  className={cn(
                    'flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-4 py-3 text-xs',
                    staffChoice === null
                      ? 'border-azure-500 bg-azure-50'
                      : 'border-line bg-surface',
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-stone-100">
                    <UserRound className="size-4" />
                  </span>
                  Anyone
                </button>
                {staff
                  .filter((p) => p.guestsCanChoose)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setStaffChoice(p.id);
                        setSlot(null);
                      }}
                      className={cn(
                        'flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-4 py-3 text-xs',
                        staffChoice === p.id
                          ? 'border-azure-500 bg-azure-50'
                          : 'border-line bg-surface',
                      )}
                    >
                      <Avatar name={p.name} />
                      {p.name.split(' ')[0]}
                    </button>
                  ))}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold">Day</h2>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {Array.from({ length: 14 }, (_, i) => addDaysKey(today, i)).map((d, i) => {
                  const label = dayLabel(zonedToUtc(d, '12:00', tz), tz).split(' ');
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDay(d);
                        setSlot(null);
                      }}
                      className={cn(
                        'flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5',
                        d === day
                          ? 'border-emerald-900 bg-emerald-900 text-ivory'
                          : 'border-line bg-surface',
                      )}
                    >
                      <span className="text-[11px] uppercase opacity-80">
                        {i === 0 ? 'Today' : label[0]}
                      </span>
                      <span className="text-lg font-semibold">{label[1]}</span>
                      <span className="text-[11px] opacity-80">{label[2]}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold">Time</h2>
              {slots.isLoading ? (
                <Skeleton className="h-32 rounded-2xl" />
              ) : !slots.data?.length ? (
                <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-muted">
                  Fully booked this day. Try another day{staffChoice ? ' or anyone available' : ''}.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.data.map((x) => (
                    <button
                      key={x.start}
                      type="button"
                      onClick={() => setSlot({ start: x.start, staffId: x.staffId })}
                      className={cn(
                        'rounded-xl border py-2.5 text-sm font-medium tabular-nums transition-colors',
                        slot?.start === x.start
                          ? 'border-azure-500 bg-azure-500 text-white'
                          : 'border-line bg-surface hover:border-azure-400',
                      )}
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {step === 'details' ? (
          <div className="space-y-6">
            {addOns.length ? (
              <section className="rounded-2xl border border-line bg-surface p-4">
                <h2 className="mb-3 text-sm font-semibold">Add something?</h2>
                <div className="space-y-3">
                  {addOns.map((a) => (
                    <div key={a.id} className="flex items-center justify-between">
                      <Checkbox
                        checked={addOnIds.includes(a.id)}
                        onChange={(on) =>
                          setAddOnIds((cur) =>
                            on ? [...cur, a.id] : cur.filter((x) => x !== a.id),
                          )
                        }
                        label={
                          <span>
                            {a.name}
                            {a.durationMin ? (
                              <span className="text-ink-subtle"> · +{a.durationMin} min</span>
                            ) : null}
                          </span>
                        }
                      />
                      <span className="text-sm text-ink-muted">+{money(a.price)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Book under another name</h2>
                  <p className="text-[13px] text-ink-muted">
                    The House sees only this name. Stayvinci keeps your real identity for safety.
                  </p>
                </div>
                <Switch checked={useAlias} onChange={setUseAlias} label="Use an alias" />
              </div>
              {useAlias ? (
                <Input
                  className="mt-3"
                  placeholder="e.g. Ms. K"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
              ) : null}
            </section>
            <section className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">Anything we should know?</h2>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, pressure preference, running late…"
              />
              <p className="mt-2 text-xs text-ink-subtle">Shared only with {s.tenant.name}.</p>
            </section>
          </div>
        ) : null}

        {step === 'pay' ? (
          <div className="space-y-6">
            {deposit === 0 ? (
              <section className="rounded-2xl border border-line bg-surface p-4">
                <h2 className="text-sm font-semibold">Pay at your visit</h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Nothing to pay now. You pay {s.tenant.name} directly when you arrive, by M-Pesa or
                  card. Free cancellation up to {pol?.freeCancelHours ?? 2} hours before.
                </p>
              </section>
            ) : null}
            <section
              className={cn(
                'rounded-2xl border border-line bg-surface p-4',
                deposit === 0 && 'hidden',
              )}
            >
              <h2 className="mb-3 text-sm font-semibold">How would you like to pay?</h2>
              <div className="space-y-2">
                {[
                  {
                    v: 'mpesa' as const,
                    label: 'M-Pesa',
                    sub: 'A payment prompt appears on your phone',
                    icon: Smartphone,
                  },
                  {
                    v: 'card' as const,
                    label: 'Card',
                    sub: 'Visa or Mastercard, secured by the gateway',
                    icon: CreditCard,
                  },
                  ...(s.credits > 0
                    ? [
                        {
                          v: 'credit' as const,
                          label: 'Package credit',
                          sub: `${s.credits} session${s.credits > 1 ? 's' : ''} left`,
                          icon: Package,
                        },
                      ]
                    : []),
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setMethod(o.v)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left',
                      method === o.v
                        ? 'border-emerald-800 bg-emerald-50 ring-1 ring-emerald-800'
                        : 'border-line',
                    )}
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-canvas text-emerald-700">
                      <o.icon className="size-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{o.label}</span>
                      <span className="text-xs text-ink-muted">{o.sub}</span>
                    </span>
                    {method === o.v ? <Check className="size-5 text-emerald-700" /> : null}
                  </button>
                ))}
              </div>
              {method === 'mpesa' ? (
                <div className="mt-3">
                  <label className="text-[13px] font-medium" htmlFor="mpesa-phone">
                    M-Pesa number
                  </label>
                  <Input
                    id="mpesa-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              ) : null}
            </section>
            <p className="flex items-start gap-2 text-xs text-ink-subtle">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              You pay {s.tenant.name} directly. Your statement shows a neutral reference, not the
              service name.
            </p>
          </div>
        ) : null}
      </main>

      {/* Summary + primary action, pinned to the thumb zone */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2.5 flex items-center justify-between text-sm">
            <span className="min-w-0 truncate text-ink-muted">
              {variant.name}
              {slot ? ` · ${dateTime(slot.start, tz)}` : ''}
              {chosenStaff ? ` · ${chosenStaff.name.split(' ')[0]}` : ''}
            </span>
            <span className="shrink-0 pl-3 text-right">
              <span className="block font-semibold">{money(total)}</span>
              {step === 'pay' && deposit > 0 && deposit < total ? (
                <span className="block text-xs text-ink-muted">{money(deposit)} deposit today</span>
              ) : null}
            </span>
          </div>
          {step === 'time' ? (
            <Button
              size="lg"
              className="w-full rounded-full"
              disabled={!slot}
              onClick={() => setStep('details')}
            >
              Continue
            </Button>
          ) : step === 'details' ? (
            <Button
              size="lg"
              className="w-full rounded-full"
              onClick={() => requireSignIn(me.data, () => setStep('pay'))}
            >
              Continue to payment
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full rounded-full"
              loading={book.isPending}
              style={{ background: th.bg === '#F5F1E8' ? '#092720' : undefined }}
              onClick={() => book.mutate(undefined)}
            >
              {method === 'credit'
                ? 'Book with 1 credit'
                : deposit > 0
                  ? `Pay ${money(deposit)} and book`
                  : 'Confirm booking'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AfterBooking({
  booking,
  storeName,
  handle,
  method,
  phone,
  tz,
  address,
}: {
  booking: Booking;
  storeName: string;
  handle: string;
  method: 'mpesa' | 'card' | 'credit';
  phone: string;
  tz: string;
  address: string | null;
}) {
  const [b, setB] = useState(booking);
  const [seconds, setSeconds] = useState(600);
  // In-app payment (M-Pesa to the House's own account) arrives in phase P2. Until then
  // bookings confirm straight away and are paid at the visit.
  const confirm = useAction(async (_ok: boolean) => b, { onSuccess: (r) => setB(r) });
  const waiting = b.state === 'pending_payment';
  const cancelled = waiting && b.events.some((e) => e.label === 'Payment cancelled');
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setSeconds((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-10 text-center">
      {waiting ? (
        <div className="w-full max-w-sm">
          <div className="relative mx-auto mb-6 flex size-24 items-center justify-center">
            {!cancelled ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-azure-400/30" />
            ) : null}
            <span
              className={cn(
                'relative flex size-20 items-center justify-center rounded-full text-white',
                cancelled ? 'bg-stone-400' : 'bg-azure-500',
              )}
            >
              {method === 'card' ? (
                <CreditCard className="size-8" />
              ) : (
                <Smartphone className="size-8" />
              )}
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {cancelled
              ? 'Payment not completed'
              : method === 'card'
                ? 'Confirm with your bank'
                : 'Check your phone'}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {cancelled
              ? 'No money was taken. Your time is still held for a few minutes.'
              : method === 'card'
                ? 'Approve the payment in your banking app or the 3-D Secure window.'
                : `We sent an M-Pesa prompt to ${phone}. Enter your PIN to pay ${money(b.deposit)}.`}
          </p>
          <p className="mt-3 text-[13px] text-ink-subtle">
            Your time is held for{' '}
            <span className="font-semibold text-ink tabular-nums">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </span>{' '}
            · Ref <span className="font-mono">{b.ref}</span>
          </p>
          <div className="mt-8 space-y-2">
            <Button
              size="lg"
              className="w-full rounded-full"
              onClick={() => confirm.mutate(true)}
              loading={confirm.isPending}
            >
              {cancelled ? 'Send the prompt again' : 'Simulate: I entered my PIN'}
            </Button>
            {!cancelled ? (
              <Button variant="ghost" className="w-full" onClick={() => confirm.mutate(false)}>
                Simulate: I cancelled the prompt
              </Button>
            ) : null}
          </div>
          <p className="mt-6 text-xs text-ink-subtle">
            Didn't get it? Make sure your phone is on and has network, then resend.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <span className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="size-10" strokeWidth={2.5} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            {b.state === 'requested' ? 'Request sent' : 'You’re booked'}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {b.state === 'requested'
              ? `${storeName} will confirm shortly. If they can't, your deposit is refunded automatically.`
              : `${storeName} is expecting you.`}
          </p>
          <div className="mt-6 rounded-2xl border border-line bg-surface p-5 text-left shadow-card">
            <div className="flex items-center gap-3">
              <CalendarCheck className="size-5 text-emerald-700" />
              <span className="text-sm font-semibold">{dateTime(b.start, tz)}</span>
            </div>
            <div className="mt-1 pl-8 text-[13px] text-ink-muted">
              {durationLabel(
                Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000),
              )}{' '}
              · Ref <span className="font-mono">{b.ref}</span>
            </div>
            <div className="mt-4 flex items-start gap-3 border-t border-line pt-4">
              <MapPin className="mt-0.5 size-5 text-emerald-700" />
              <span className="text-[13px]">
                {address ?? 'The exact address and directions come with your booking reminder.'}
              </span>
            </div>
            {b.paid > 0 ? (
              <div className="mt-4 border-t border-line pt-4 text-[13px] text-ink-muted">
                Paid {money(b.paid)} · balance {money(b.total - b.paid)} at your visit
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-ink-subtle">
            Reminders arrive without the place or service name on your lock screen.
          </p>
          <div className="mt-6 space-y-2">
            <Link to="/bookings">
              <Button size="lg" className="w-full rounded-full">
                View my bookings
              </Button>
            </Link>
            <Link to={`/s/${handle}`} className="block py-2 text-sm font-medium text-azure-700">
              Back to {storeName}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
