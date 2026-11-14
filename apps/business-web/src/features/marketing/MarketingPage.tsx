import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bell, Mail, MessageCircle, Plus, Send, ShieldCheck, Smartphone, Star } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Field,
  Input,
  PageHeader,
  Select,
  Switch,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
} from '@stayvinci/ui';
import { api } from '../../lib/api';
import type { Campaign } from '../../mock/types';
import { useSession } from '../../app/session';
import { ErrorState, PageSkeleton } from '../../components/common';
import { date, money } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

type Tab = 'campaigns' | 'reviews' | 'loyalty';
const CHANNEL_ICON = { whatsapp: MessageCircle, sms: Smartphone, email: Mail, push: Bell } as const;

export function MarketingPage() {
  const { tenant } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'campaigns';
  const q = useTenantQuery(['marketing'], api.marketing.get);
  const [open, setOpen] = useState(false);

  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const avg = q.data.reviews.length
    ? q.data.reviews.reduce((n, r) => n + r.rating, 0) / q.data.reviews.length
    : 0;

  return (
    <div>
      <PageHeader
        title="Marketing"
        description="Reach your guests through Stayvinci. Contacts stay private: you send messages, you never export numbers."
        actions={
          tab === 'campaigns' ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> New campaign
            </Button>
          ) : null
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        className="mb-5"
        items={[
          { value: 'campaigns', label: 'Campaigns', count: q.data.campaigns.length },
          {
            value: 'reviews',
            label: 'Reviews',
            count: q.data.reviews.filter((r) => !r.reply).length,
          },
          { value: 'loyalty', label: 'Referrals & loyalty' },
        ]}
      />

      {tab === 'campaigns' ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Campaign</Th>
                <Th className="hidden md:table-cell">Audience</Th>
                <Th>Channel</Th>
                <Th>Status</Th>
                <Th className="text-right">Bookings</Th>
              </tr>
            </thead>
            <tbody>
              {q.data.campaigns.map((c) => {
                const Icon = CHANNEL_ICON[c.channel];
                return (
                  <Tr key={c.id}>
                    <Td>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-ink-subtle">
                        {c.sentAt
                          ? `${c.status === 'scheduled' ? 'Scheduled for' : 'Sent'} ${date(c.sentAt, tenant.timezone)}`
                          : 'Draft'}
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <div>{c.segment}</div>
                      <div className="text-xs text-ink-subtle">{c.audience} guests</div>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5 capitalize">
                        <Icon className="size-4 text-ink-subtle" />{' '}
                        {c.channel === 'sms' ? 'SMS' : c.channel}
                      </span>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          c.status === 'sent'
                            ? 'emerald'
                            : c.status === 'scheduled'
                              ? 'azure'
                              : 'neutral'
                        }
                      >
                        {c.status}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{c.bookings}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {tab === 'reviews' ? (
        <div className="space-y-4">
          <Card className="flex items-center gap-4 p-5">
            <div className="text-4xl font-semibold tabular-nums">{avg.toFixed(1)}</div>
            <div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={
                      i <= Math.round(avg)
                        ? 'size-4 fill-gold-400 text-gold-400'
                        : 'size-4 text-stone-300'
                    }
                  />
                ))}
              </div>
              <div className="text-[13px] text-ink-muted">
                {q.data.reviews.length} reviews from verified bookings
              </div>
            </div>
          </Card>
          {q.data.reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      ) : null}

      {tab === 'loyalty' ? <LoyaltyPanel initial={q.data.loyalty} /> : null}
      {open ? <CampaignDialog onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function ReviewCard({
  review,
}: {
  review: {
    id: string;
    rating: number;
    body: string;
    at: string;
    reply: string | null;
    serviceName: string;
    guestName: string;
  };
}) {
  const { tenant } = useSession();
  const [reply, setReply] = useState('');
  const [open, setOpen] = useState(false);
  const send = useAction(() => api.marketing.reply(review.id, reply), {
    success: 'Reply posted',
    onSuccess: () => setOpen(false),
  });
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{review.guestName}</span>
            <span className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={
                    i <= review.rating
                      ? 'size-3.5 fill-gold-400 text-gold-400'
                      : 'size-3.5 text-stone-300'
                  }
                />
              ))}
            </span>
          </div>
          <div className="text-xs text-ink-subtle">
            {review.serviceName} · {date(review.at, tenant.timezone)}
          </div>
        </div>
        {!review.reply && !open ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Reply
          </Button>
        ) : null}
      </div>
      <p className="mt-3 text-sm">{review.body}</p>
      {review.reply ? (
        <div className="mt-3 rounded-xl border-l-2 border-gold-400 bg-canvas px-4 py-2.5 text-[13px]">
          <div className="text-xs font-semibold text-gold-700">Your reply</div>
          {review.reply}
        </div>
      ) : null}
      {open ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Thank the guest, keep it warm and brief."
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => send.mutate(undefined)}
              disabled={!reply.trim()}
              loading={send.isPending}
            >
              <Send className="size-3.5" /> Post reply
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function LoyaltyPanel({
  initial,
}: {
  initial: {
    referralsOn: boolean;
    referralReward: number;
    loyaltyOn: boolean;
    visitsForReward: number;
  };
}) {
  const [l, setL] = useState(initial);
  const save = useAction(() => api.marketing.saveLoyalty(l), { success: 'Saved' });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Referrals"
          description="Guests share a personal invite link. New guests arrive as your own channel."
          action={
            <Switch
              checked={l.referralsOn}
              onChange={(v) => setL({ ...l, referralsOn: v })}
              label="Referrals"
            />
          }
        />
        <div className="p-5">
          <Field
            label="Reward per successful referral (KES credit)"
            hint={`Currently ${money(l.referralReward)} as store credit`}
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                disabled={!l.referralsOn}
                value={l.referralReward / 100}
                onChange={(e) =>
                  setL({ ...l, referralReward: Math.round(Number(e.target.value) * 100) })
                }
              />
            )}
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Loyalty"
          description="Reward regulars automatically."
          action={
            <Switch
              checked={l.loyaltyOn}
              onChange={(v) => setL({ ...l, loyaltyOn: v })}
              label="Loyalty"
            />
          }
        />
        <div className="p-5">
          <Field label="Free session after this many visits">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={2}
                disabled={!l.loyaltyOn}
                value={l.visitsForReward}
                onChange={(e) => setL({ ...l, visitsForReward: Number(e.target.value) })}
              />
            )}
          </Field>
        </div>
      </Card>
      <div className="lg:col-span-2">
        <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
          Save settings
        </Button>
      </div>
    </div>
  );
}

function CampaignDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('Guests with 2+ visits');
  const [channel, setChannel] = useState<Campaign['channel']>('whatsapp');
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState('');
  const create = useAction(
    () =>
      api.marketing.createCampaign({
        name,
        segment,
        channel,
        schedule: when ? new Date(when).toISOString() : null,
      }),
    {
      success: (c) => (c.status === 'scheduled' ? 'Campaign scheduled' : 'Saved as draft'),
      onSuccess: onClose,
    },
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      size="lg"
      title="New campaign"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate(undefined)}
            disabled={!name || !message}
            loading={create.isPending}
          >
            {when ? 'Schedule' : 'Save draft'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Campaign name" className="sm:col-span-2">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Audience">
          {(id) => (
            <Select id={id} value={segment} onChange={(e) => setSegment(e.target.value)}>
              <option>All admitted guests</option>
              <option>Guests with 2+ visits</option>
              <option>No visit in 60 days</option>
              <option>Members</option>
            </Select>
          )}
        </Field>
        <Field label="Channel">
          {(id) => (
            <Select
              id={id}
              value={channel}
              onChange={(e) => setChannel(e.target.value as Campaign['channel'])}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="push">App notification</option>
            </Select>
          )}
        </Field>
        <Field
          label="Message"
          className="sm:col-span-2"
          hint="Guests who opted out of marketing are skipped automatically."
        >
          {(id) => (
            <Textarea
              id={id}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-24"
            />
          )}
        </Field>
        <Field label="Send at (optional)" className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          )}
        </Field>
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-900 sm:col-span-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          Lock-screen previews stay neutral unless the guest opted into detailed notifications.
        </div>
      </div>
    </Dialog>
  );
}
