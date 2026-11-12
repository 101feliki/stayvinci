import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import { Badge, Button, Dialog, Segmented, Skeleton, type BadgeTone } from '@stayvinci/ui';
import { dateTime, money } from '@stayvinci/demo-data/format';
import type { BookingState } from '@stayvinci/demo-data/types';
import { api, type GuestBooking } from '../../lib/api';
import { useAction, useMe, useSignIn } from '../../app/shared';

const STATE: Record<BookingState, { label: string; tone: BadgeTone }> = {
  held: { label: 'Held', tone: 'neutral' },
  pending_payment: { label: 'Awaiting payment', tone: 'amber' },
  requested: { label: 'Waiting for the House', tone: 'azure' },
  confirmed: { label: 'Confirmed', tone: 'emerald' },
  checked_in: { label: 'In progress', tone: 'gold' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled_by_guest: { label: 'Cancelled', tone: 'red' },
  cancelled_by_tenant: { label: 'Cancelled by the House', tone: 'red' },
  no_show: { label: 'Missed', tone: 'red' },
  disputed: { label: 'Under review', tone: 'plum' },
};

export function BookingsPage() {
  const me = useMe();
  const { requireSignIn } = useSignIn();
  const q = useQuery({ queryKey: ['bookings'], queryFn: api.bookings });
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancel, setCancel] = useState<GuestBooking | null>(null);

  if (me.data && !me.data.signedIn) {
    return (
      <div className="py-16 text-center">
        <CalendarDays className="mx-auto size-8 text-ink-subtle" />
        <h1 className="mt-3 text-lg font-semibold">Your bookings live here</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to see upcoming and past visits.</p>
        <Button className="mt-5" onClick={() => requireSignIn(me.data, () => undefined)}>
          Sign in
        </Button>
      </div>
    );
  }
  if (!q.data) return <Skeleton className="h-60 rounded-2xl" />;
  const now = new Date().toISOString();
  const rows = q.data.filter((b) =>
    tab === 'upcoming'
      ? b.end >= now && !b.state.startsWith('cancelled')
      : b.end < now || b.state.startsWith('cancelled'),
  );
  if (tab === 'upcoming') rows.sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <Segmented
          value={tab}
          onChange={setTab}
          items={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong py-12 text-center text-sm text-ink-muted">
          {tab === 'upcoming'
            ? 'Nothing booked yet. Visit one of your places to book.'
            : 'No past visits yet.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => {
            const hoursLeft = (new Date(b.start).getTime() - Date.now()) / 3600_000;
            const free = hoursLeft >= b.freeCancelHours;
            const st = STATE[b.state];
            return (
              <li key={b.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold">{b.serviceName}</div>
                    <div className="text-[13px] text-ink-muted">
                      {b.storeName}
                      {b.staffName ? ` · with ${b.staffName}` : ''}
                    </div>
                  </div>
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <CalendarDays className="size-4 text-emerald-700" />{' '}
                  {dateTime(b.start, b.timezone)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[13px] text-ink-muted">
                  <span>
                    {money(b.total)}
                    {b.paid > 0 && b.paid < b.total
                      ? ` · ${money(b.paid)} paid`
                      : b.paid >= b.total && b.total > 0
                        ? ' · paid'
                        : ''}
                  </span>
                  <span className="font-mono text-xs">{b.ref}</span>
                </div>
                {tab === 'upcoming' ? (
                  <div className="mt-4 flex gap-2 border-t border-line pt-3">
                    {b.paid > 0 ? (
                      <Link to={`/s/${b.handle}/about`} className="flex-1">
                        <Button size="sm" variant="secondary" className="w-full">
                          <MapPin className="size-3.5" /> Directions
                        </Button>
                      </Link>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 text-red-700 hover:bg-red-50"
                      onClick={() => setCancel(b)}
                    >
                      Cancel{free ? ' (free)' : ''}
                    </Button>
                  </div>
                ) : b.state === 'completed' ? (
                  <Link
                    to={`/s/${b.handle}/o/${b.serviceId}`}
                    className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm font-medium text-azure-700"
                  >
                    Book again <ChevronRight className="size-4" />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {cancel ? <CancelDialog b={cancel} onClose={() => setCancel(null)} /> : null}
    </div>
  );
}

/** Shows the refund outcome before the guest confirms (spec §10.4). */
function CancelDialog({ b, onClose }: { b: GuestBooking; onClose: () => void }) {
  const hoursLeft = (new Date(b.start).getTime() - Date.now()) / 3600_000;
  const free = hoursLeft >= b.freeCancelHours;
  const go = useAction(() => api.cancel(b.id), {
    success: 'Booking cancelled',
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      size="sm"
      title="Cancel this booking?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" onClick={() => go.mutate(undefined)} loading={go.isPending}>
            Cancel booking
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-canvas p-4 text-sm">
        {b.paid === 0 ? (
          'Nothing has been paid, so there is nothing to refund.'
        ) : free ? (
          <>
            You’ll get <span className="font-semibold">{money(b.paid)}</span> back, because you’re
            cancelling more than {b.freeCancelHours} hours ahead.
          </>
        ) : (
          <>
            It’s less than {b.freeCancelHours} hours before your visit, so the{' '}
            <span className="font-semibold">{money(b.paid)}</span> deposit is kept under the House’s
            policy.
          </>
        )}
      </div>
    </Dialog>
  );
}
