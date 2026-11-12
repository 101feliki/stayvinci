import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, Crown, Mail, Phone, Trash2 } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Input,
  StatTile,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '@stayvinci/ui';
import { api } from '../../mock/api';
import { useCan, useSession } from '../../app/session';
import { useBookingDrawer, useUi } from '../../app/ui';
import {
  ErrorState,
  HiddenContact,
  KeyValue,
  PageSkeleton,
  StateBadge,
} from '../../components/common';
import { date, dateTime, guestName, money } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

export function GuestDetailPage() {
  const { id = '' } = useParams();
  const { tenant } = useSession();
  const can = useCan();
  const tz = tenant.timezone;
  const navigate = useNavigate();
  const drawer = useBookingDrawer();
  const { openNewBooking } = useUi();
  const q = useQuery({ queryKey: [tenant.id, 'guest', id], queryFn: () => api.guests.get(id) });
  const catalogue = useTenantQuery(['catalogue'], api.catalogue.get);
  const [notes, setNotes] = useState('');
  const [tag, setTag] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);
  const save = useAction(
    (patch: { notes?: string; tags?: string[] }) => api.guests.update(id, patch),
    { success: 'Saved' },
  );
  const remove = useAction(() => api.guests.remove(id), {
    success: 'Guest removed',
    onSuccess: () => navigate('/guests'),
  });

  useEffect(() => {
    if (q.data) setNotes(q.data.guest.notes);
  }, [q.data]);

  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const { guest: g, bookings } = q.data;
  const tier = catalogue.data?.tiers.find((t) => t.id === g.membershipTierId);
  const svcMap = new Map((catalogue.data?.services ?? []).map((s) => [s.id, s]));
  const upcoming = bookings.filter(
    (b) => b.start > new Date().toISOString() && !b.state.startsWith('cancelled'),
  );
  const noShows = bookings.filter((b) => b.state === 'no_show').length;

  return (
    <div className="space-y-6">
      <Link
        to="/guests"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Guests
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={guestName(g)} size="lg" tone={tier ? 'plum' : 'emerald'} />
        <div className="flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {guestName(g)}
            {tier ? (
              <Badge tone="plum">
                <Crown className="size-3" /> {tier.name} member
              </Badge>
            ) : null}
            {g.tags.map((t) => (
              <Badge key={t} tone="gold">
                {t}
              </Badge>
            ))}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {g.alias
              ? 'Books under an alias. Stayvinci keeps the real identity for safety and disputes. '
              : ''}
            Guest since {date(g.admittedAt, tz)} · {g.attributionDetail}
          </p>
        </div>
        <div className="flex gap-2">
          {can('booking.edit') ? (
            <Button
              variant="ghost"
              className="text-red-700 hover:bg-red-50"
              onClick={() => setRemoveOpen(true)}
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          ) : null}
          {can('booking.create') ? (
            <Button onClick={() => openNewBooking({ guestId: g.id })}>
              <CalendarPlus className="size-4" /> Book
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Visits" value={g.visits} />
        <StatTile
          label="Total spend"
          value={money(g.spend, 'KES', { compact: true })}
          accent="gold"
        />
        <StatTile label="Upcoming" value={upcoming.length} accent="azure" />
        <StatTile label="No-shows" value={noShows} accent="plum" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Bookings with you" />
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Service</Th>
                <Th>State</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <Tr key={b.id} className="cursor-pointer" onClick={() => drawer.open(b.id)}>
                  <Td className="whitespace-nowrap">{dateTime(b.start, tz)}</Td>
                  <Td>{svcMap.get(b.serviceId ?? '')?.name ?? 'Stay'}</Td>
                  <Td>
                    <StateBadge state={b.state} />
                  </Td>
                  <Td className="text-right tabular-nums">{money(b.total)}</Td>
                </Tr>
              ))}
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-ink-muted">
                    No bookings yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-2 text-[13px] font-semibold text-ink-muted uppercase">Contact</div>
            <div className="divide-y divide-line">
              <KeyValue
                label={
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" /> Phone
                  </span>
                }
              >
                {g.phone ?? <HiddenContact />}
              </KeyValue>
              <KeyValue
                label={
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" /> Email
                  </span>
                }
              >
                {g.email ?? (can('guest.contact.view') ? '—' : <HiddenContact />)}
              </KeyValue>
            </div>
            {!can('guest.contact.view') ? (
              <p className="mt-2 text-xs text-ink-subtle">
                Contact details are visible to the owner only. Use Messages to reach this guest.
              </p>
            ) : null}
          </Card>
          <Card className="p-5">
            <div className="mb-2 text-[13px] font-semibold text-ink-muted uppercase">
              Preferences
            </div>
            {g.preferences.length ? (
              <div className="flex flex-wrap gap-1.5">
                {g.preferences.map((p) => (
                  <Badge key={p} tone="azure">
                    {p}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">None shared.</p>
            )}
            <div className="mt-4 divide-y divide-line">
              <KeyValue label="Package credits">{g.packageCredits}</KeyValue>
              <KeyValue label="Membership">{tier?.name ?? '—'}</KeyValue>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-2 text-[13px] font-semibold text-ink-muted uppercase">
              Staff notes
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private to your team"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={notes === g.notes}
                onClick={() => save.mutate({ notes })}
              >
                Save notes
              </Button>
            </div>
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Add tag (e.g. VIP)"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="h-9"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!tag.trim()}
                onClick={() => {
                  save.mutate({ tags: [...new Set([...g.tags, tag.trim()])] });
                  setTag('');
                }}
              >
                Add
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Dialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove this guest?"
        description="Their access to your store is revoked and future bookings are cancelled per your policy. This is recorded in the audit log."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoveOpen(false)}>
              Keep guest
            </Button>
            <Button
              variant="danger"
              onClick={() => remove.mutate(undefined)}
              loading={remove.isPending}
            >
              Remove guest
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {upcoming.length} upcoming booking(s) will be cancelled.
        </p>
      </Dialog>
    </div>
  );
}
