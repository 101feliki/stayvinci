import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CalendarClock, Mic, MicOff, Radio, Users, Video, VideoOff, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  Segmented,
  Switch,
} from '@stayvinci/ui';
import { api } from '../../mock/api';
import type { ContentItem } from '../../mock/types';
import { useSession } from '../../app/session';
import { addDaysKey, dateTime, money, zonedToUtc } from '../../lib/format';
import { useAction } from '../../lib/query';
import { todayKey } from '../../mock/api';

/** Live classes, demos and Q&As for guests: scheduled, live now, or ended. */
export function LiveSessionsPanel({
  items,
  tiers,
  onSchedule,
}: {
  items: ContentItem[];
  tiers: { id: string; name: string }[];
  onSchedule: () => void;
}) {
  const { tenant } = useSession();
  const [studio, setStudio] = useState<ContentItem | null>(null);
  const setStatus = useAction(
    ({ id, status }: { id: string; status: 'live' | 'ended' }) =>
      api.content.setLiveStatus(id, status),
    {
      success: (c) => (c.live?.status === 'live' ? 'You are live' : 'Live session ended'),
      onSuccess: (c) => setStudio(c.live?.status === 'live' ? c : null),
    },
  );
  const lives = items
    .filter((c) => c.kind === 'live' && c.live)
    .sort((a, b) => (a.live?.startsAt ?? '').localeCompare(b.live?.startsAt ?? ''));

  if (!lives.length)
    return (
      <Card>
        <EmptyState
          icon={<Radio className="size-5" />}
          title="No live sessions yet"
          description="Host a class, a product demo or a Q&A. Free, for members, or with tickets."
          action={<Button onClick={onSchedule}>Schedule a live session</Button>}
        />
      </Card>
    );

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {lives.map((c) => {
          const l = c.live;
          if (!l) return null;
          return (
            <Card key={c.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-card text-ivory">
                {l.status === 'live' ? (
                  <Radio className="size-6 animate-pulse text-red-400" />
                ) : (
                  <CalendarClock className="size-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.title}</span>
                  {l.status === 'live' ? (
                    <Badge tone="red" dot>
                      Live now
                    </Badge>
                  ) : l.status === 'ended' ? (
                    <Badge>Ended</Badge>
                  ) : (
                    <Badge tone="azure">Scheduled</Badge>
                  )}
                </div>
                <div className="mt-1 text-[13px] text-ink-muted">
                  {dateTime(l.startsAt, tenant.timezone)} · {l.durationMin} min · with {l.host}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
                  <Users className="size-3.5" /> {l.attending}{' '}
                  {l.status === 'live' ? 'watching' : 'going'}
                  {l.capacity ? ` of ${l.capacity}` : ''}
                  <span>·</span>
                  {c.price
                    ? money(c.price)
                    : c.tierIds.length
                      ? tiers
                          .filter((t) => c.tierIds.includes(t.id))
                          .map((t) => t.name)
                          .join(', ') || 'Members'
                      : 'Free'}
                  {l.replay ? <span>· replay kept</span> : null}
                </div>
              </div>
              <div className="flex gap-2">
                {l.status === 'scheduled' ? (
                  <Button size="sm" onClick={() => setStatus.mutate({ id: c.id, status: 'live' })}>
                    <Radio className="size-4" /> Go live
                  </Button>
                ) : null}
                {l.status === 'live' ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setStudio(c)}>
                      Open studio
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setStatus.mutate({ id: c.id, status: 'ended' })}
                    >
                      End
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
      {studio ? (
        <Studio
          item={studio}
          onClose={() => setStudio(null)}
          onEnd={() => setStatus.mutate({ id: studio.id, status: 'ended' })}
        />
      ) : null}
    </>
  );
}

/** Schedule a live session (spec §9 content: live sessions). */
export function ScheduleLiveDialog({
  tiers,
  onClose,
}: {
  tiers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { tenant, personName } = useSession();
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(addDaysKey(todayKey(tenant.timezone), 1));
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState('45');
  const [audience, setAudience] = useState<'public' | 'members' | 'paid'>('public');
  const [price, setPrice] = useState('1000');
  const [tierIds, setTierIds] = useState<string[]>([]);
  const [capacity, setCapacity] = useState('');
  const [replay, setReplay] = useState(true);
  const [host, setHost] = useState(personName);
  const create = useAction(
    () =>
      api.content.scheduleLive({
        title,
        startsAt: zonedToUtc(day, time, tenant.timezone),
        durationMin: Number(duration) || 45,
        audience,
        price: audience === 'paid' ? Math.round(Number(price) * 100) : null,
        tierIds,
        capacity: capacity ? Number(capacity) : null,
        replay,
        host,
      }),
    { success: 'Live session scheduled. Guests can set a reminder.', onSuccess: onClose },
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      size="lg"
      title="Schedule a live session"
      description="A class, a product demo or a Q&A, streamed to guests in the app. Guests appear by their alias; phone numbers are never shown."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate(undefined)}
            loading={create.isPending}
            disabled={!title.trim()}
          >
            Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" hint="e.g. Ask a therapist: neck and shoulder tension">
          {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Day">
            {(id) => (
              <Input id={id} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            )}
          </Field>
          <Field label="Start time">
            {(id) => (
              <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            )}
          </Field>
          <Field label="Length (min)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={10}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Host">
          {(id) => <Input id={id} value={host} onChange={(e) => setHost(e.target.value)} />}
        </Field>
        <div>
          <div className="mb-2 text-[13px] font-medium">Who can watch</div>
          <Segmented
            value={audience}
            onChange={setAudience}
            items={[
              { value: 'public', label: 'Everyone in your store' },
              { value: 'members', label: 'Members' },
              { value: 'paid', label: 'Ticket' },
            ]}
          />
        </div>
        {audience === 'paid' ? (
          <Field label="Ticket price (KES)" hint="Paid by M-Pesa straight to your Paybill or Till.">
            {(id) => (
              <Input
                id={id}
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            )}
          </Field>
        ) : null}
        {audience === 'members' ? (
          <div className="flex flex-wrap gap-3">
            {tiers.map((t) => (
              <Checkbox
                key={t.id}
                checked={tierIds.includes(t.id)}
                onChange={(v) =>
                  setTierIds((cur) => (v ? [...cur, t.id] : cur.filter((x) => x !== t.id)))
                }
                label={t.name}
              />
            ))}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Places (optional)" hint="Leave empty for no limit">
            {(id) => (
              <Input
                id={id}
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            )}
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4">
            <div>
              <div className="text-sm font-medium">Keep a replay</div>
              <div className="text-xs text-ink-subtle">For guests who missed it</div>
            </div>
            <Switch checked={replay} onChange={setReplay} label="Keep a replay" />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/** Host studio: camera preview (when allowed), viewers and controls. */
function Studio({
  item,
  onClose,
  onEnd,
}: {
  item: ContentItem;
  onClose: () => void;
  onEnd: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<'pending' | 'on' | 'off' | 'blocked'>('pending');
  const [mic, setMic] = useState(true);
  const [viewers, setViewers] = useState(item.live?.attending ?? 3);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (video.current) video.current.srcObject = stream;
        setCamera('on');
      } catch {
        setCamera('blocked');
      }
    };
    void start();
    const t = setInterval(
      () => setViewers((v) => Math.max(1, v + (Math.random() < 0.65 ? 1 : -1))),
      3000,
    );
    return () => {
      clearInterval(t);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/80" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 animate-scale-in overflow-hidden rounded-2xl bg-obsidian-900 text-white shadow-pop focus:outline-none">
          <DialogPrimitive.Title className="sr-only">
            Live studio: {item.title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Your camera preview and live controls
          </DialogPrimitive.Description>
          <div className="relative aspect-video bg-obsidian-sheen">
            <video
              ref={video}
              autoPlay
              muted
              playsInline
              className={camera === 'on' ? 'h-full w-full object-cover' : 'hidden'}
            />
            {camera !== 'on' ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-white/70">
                <VideoOff className="size-8" />
                {camera === 'pending'
                  ? 'Starting your camera…'
                  : camera === 'blocked'
                    ? 'Camera not available. Allow camera access in your browser to stream.'
                    : 'Camera off'}
              </div>
            ) : null}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase">
                <Radio className="size-3.5 animate-pulse" /> Live
              </span>
              <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs backdrop-blur">
                <Users className="size-3.5" /> {viewers} watching
              </span>
            </div>
            <DialogPrimitive.Close className="absolute top-3 right-3 rounded-full bg-black/40 p-2 backdrop-blur hover:bg-black/60">
              <X className="size-4" />
              <span className="sr-only">Close studio (stay live)</span>
            </DialogPrimitive.Close>
          </div>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{item.title}</div>
              <div className="text-xs text-white/60">
                Closing this window keeps you live. Press End to finish.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMic((m) => !m)}
              className="rounded-full bg-white/10 p-3 hover:bg-white/20"
              aria-label={mic ? 'Mute microphone' : 'Unmute microphone'}
            >
              {mic ? <Mic className="size-5" /> : <MicOff className="size-5 text-red-400" />}
            </button>
            <button
              type="button"
              onClick={() => setCamera((c) => (c === 'on' ? 'off' : c === 'off' ? 'on' : c))}
              className="rounded-full bg-white/10 p-3 hover:bg-white/20"
              aria-label="Toggle camera"
            >
              {camera === 'on' ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </button>
            <Button variant="danger" onClick={onEnd}>
              End live
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
