import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Inbox, X } from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader } from '@stayvinci/ui';
import { api } from '../../mock/api';
import { useCan, useSession } from '../../app/session';
import { useBookingDrawer } from '../../app/ui';
import { ErrorState, PageSkeleton } from '../../components/common';
import { dateTime, guestName, money } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Countdown({ until }: { until: string }) {
  const now = useNow();
  const left = new Date(until).getTime() - now;
  const h = Math.max(0, Math.floor(left / 3600_000));
  const m = Math.max(0, Math.floor((left % 3600_000) / 60_000));
  const urgent = left < 2 * 3600_000;
  return (
    <Badge tone={urgent ? 'red' : 'azure'}>
      <Clock className="size-3" /> {h}h {m}m left
    </Badge>
  );
}

/** Request-to-book queue (spec §5.6 approval, §10.3 `requested`). */
export function RequestsPage() {
  const { tenant } = useSession();
  const can = useCan();
  const tz = tenant.timezone;
  const bookings = useTenantQuery(['bookings'], api.bookings.list);
  const guests = useTenantQuery(['guests'], api.guests.list, { enabled: can('guest.view') });
  const catalogue = useTenantQuery(['catalogue'], api.catalogue.get);
  const team = useTenantQuery(['team'], api.team.list);
  const drawer = useBookingDrawer();
  const decide = useAction(
    (a: { id: string; approve: boolean }) =>
      api.bookings.transition(
        a.id,
        a.approve ? 'confirmed' : 'cancelled_by_tenant',
        a.approve ? undefined : 'Not available',
      ),
    {
      success: (b) =>
        b.state === 'confirmed' ? `Approved ${b.ref}` : `Declined ${b.ref}, refund issued`,
    },
  );

  const requests = useMemo(
    () =>
      (bookings.data ?? [])
        .filter((b) => b.state === 'requested')
        .sort((a, b) => (a.requestExpiresAt ?? '').localeCompare(b.requestExpiresAt ?? '')),
    [bookings.data],
  );

  if (bookings.error) return <ErrorState error={bookings.error} />;
  if (!bookings.data) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Booking requests"
        description="Guests asked to book and paid a deposit. Approve or decline before the window ends; otherwise we decline and refund automatically."
      />
      {requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="No requests waiting"
            description="New requests appear here and in your notifications."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {requests.map((b) => {
            const g = guests.data?.find((x) => x.id === b.guestId);
            const s = catalogue.data?.services.find((x) => x.id === b.serviceId);
            const v = s?.variants.find((x) => x.id === b.variantId);
            const who = team.data?.resources.find((r) => r.id === (b.staffId ?? b.unitId));
            return (
              <Card key={b.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={guestName(g)} />
                    <div>
                      <div className="font-medium">{guestName(g)}</div>
                      <div className="text-xs text-ink-subtle">
                        {g ? `${g.visits} past visits` : ''}{' '}
                        {b.attribution === 'marketplace' ? '· via marketplace' : ''}
                      </div>
                    </div>
                  </div>
                  {b.requestExpiresAt ? <Countdown until={b.requestExpiresAt} /> : null}
                </div>
                <button
                  type="button"
                  onClick={() => drawer.open(b.id)}
                  className="mt-4 rounded-xl bg-canvas p-3 text-left hover:bg-emerald-50"
                >
                  <div className="text-sm font-semibold">{s?.name ?? who?.name}</div>
                  <div className="mt-0.5 text-[13px] text-ink-muted">
                    {dateTime(b.start, tz)}
                    {v ? ` · ${v.name}` : ''}
                    {who && s ? ` · ${who.name.split(' ')[0]}` : ''}
                  </div>
                  <div className="mt-2 text-[13px]">
                    {money(b.total)} ·{' '}
                    <span className="text-emerald-700">{money(b.paid)} deposit held</span>
                  </div>
                </button>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => decide.mutate({ id: b.id, approve: false })}
                  >
                    <X className="size-4" /> Decline
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => decide.mutate({ id: b.id, approve: true })}
                  >
                    <Check className="size-4" /> Approve
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
