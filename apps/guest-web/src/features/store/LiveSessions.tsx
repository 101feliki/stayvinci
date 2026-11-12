import { useEffect, useState } from 'react';
import { Bell, CalendarClock, Crown, Lock, Radio, Send, Ticket, Users, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Avatar, Badge, Button } from '@stayvinci/ui';
import { dateTime, money } from '@stayvinci/demo-data/format';
import type { StoreView } from '../../lib/api';
import { useMe, useSignIn } from '../../app/shared';

type Item = StoreView['content'][number];

/** Live classes, demos and Q&As from the House or Atelier (spec §9 content, live). */
export function LiveSessions({ s }: { s: StoreView }) {
  const lives = s.content
    .filter((c) => c.kind === 'live' && c.live && c.live.status !== 'ended')
    .sort(
      (a, b) =>
        (a.live?.status === 'live' ? 0 : 1) - (b.live?.status === 'live' ? 0 : 1) ||
        (a.live?.startsAt ?? '').localeCompare(b.live?.startsAt ?? ''),
    );
  const [watching, setWatching] = useState<Item | null>(null);
  const [reminded, setReminded] = useState<string[]>([]);
  const me = useMe();
  const { requireSignIn } = useSignIn();
  if (!lives.length) return null;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-[0.22em] text-ink-subtle uppercase">
            Live sessions
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Watch, learn, ask</h2>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {lives.map((c) => {
          const l = c.live;
          if (!l) return null;
          const isLive = l.status === 'live';
          const locked = !c.unlocked && (c.price !== null || c.tierIds.length > 0);
          return (
            <article
              key={c.id}
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
            >
              <div className="relative flex aspect-[16/8] items-end bg-obsidian-sheen p-4 text-white">
                <div
                  className="absolute inset-0 opacity-60"
                  style={{
                    background: `radial-gradient(70% 90% at 80% 20%, ${s.palette.accent}55, transparent 60%)`,
                  }}
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  {isLive ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase">
                      <Radio className="size-3.5 animate-pulse" /> Live
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                      <CalendarClock className="size-3.5" />{' '}
                      {dateTime(l.startsAt, s.tenant.timezone)}
                    </span>
                  )}
                </div>
                <div className="relative flex items-center gap-3">
                  <Avatar name={l.host} size="md" tone="gold" />
                  <div>
                    <div className="text-sm font-semibold">{l.host}</div>
                    <div className="flex items-center gap-1 text-xs text-white/70">
                      <Users className="size-3.5" /> {l.attending} {isLive ? 'watching' : 'going'}
                      {l.capacity ? ` · ${l.capacity} places` : ''}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{c.title}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge>{l.durationMin} min</Badge>
                    {c.price ? (
                      <Badge tone="gold">
                        <Ticket className="size-3" /> {money(c.price)}
                      </Badge>
                    ) : c.tierIds.length ? (
                      <Badge tone="plum">
                        <Crown className="size-3" /> Members
                      </Badge>
                    ) : (
                      <Badge tone="emerald">Free</Badge>
                    )}
                    {l.replay ? <Badge tone="azure">Replay kept</Badge> : null}
                  </div>
                </div>
                {locked ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      requireSignIn(me.data, () =>
                        toast.message(
                          c.price
                            ? `Ticket ${money(c.price)}: pay by M-Pesa at checkout (demo)`
                            : 'Join a membership to watch',
                        ),
                      )
                    }
                  >
                    <Lock className="size-4" /> {c.price ? 'Get ticket' : 'Members'}
                  </Button>
                ) : isLive ? (
                  <Button size="sm" onClick={() => requireSignIn(me.data, () => setWatching(c))}>
                    <Radio className="size-4" /> Join
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={reminded.includes(c.id)}
                    onClick={() =>
                      requireSignIn(me.data, () => {
                        setReminded((r) => [...r, c.id]);
                        toast.success('We’ll remind you 15 minutes before (neutral notification).');
                      })
                    }
                  >
                    <Bell className="size-4" />{' '}
                    {reminded.includes(c.id) ? 'Reminder set' : 'Remind me'}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {watching ? <LiveViewer item={watching} s={s} onClose={() => setWatching(null)} /> : null}
    </section>
  );
}

const SAMPLE_CHAT = [
  { who: 'Njeri', text: 'This stretch is exactly what I needed after work' },
  { who: 'K.', text: 'How often should we do this?' },
  { who: 'Wanjiru (host)', text: 'Three times a week is perfect to start' },
];

/** Prototype live viewer: stream area, viewer count and chat (guests appear by alias). */
function LiveViewer({ item, s, onClose }: { item: Item; s: StoreView; onClose: () => void }) {
  const [viewers, setViewers] = useState(item.live?.attending ?? 0);
  const [chat, setChat] = useState(SAMPLE_CHAT);
  const [text, setText] = useState('');
  const me = useMe();
  useEffect(() => {
    const t = setInterval(() => setViewers((v) => v + (Math.random() < 0.6 ? 1 : -1)), 2500);
    return () => clearInterval(t);
  }, []);
  const name = me.data?.signedIn ? (me.data.alias ?? me.data.firstName) : 'You';
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/80 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 grid max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 animate-scale-in overflow-hidden rounded-2xl bg-obsidian-900 text-white shadow-pop focus:outline-none md:grid-cols-[1fr_320px]">
          <DialogPrimitive.Title className="sr-only">{item.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Live session from {s.tenant.name}
          </DialogPrimitive.Description>
          <div className="relative flex aspect-video items-center justify-center bg-obsidian-sheen md:aspect-auto md:min-h-[460px]">
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(60% 70% at 50% 40%, ${s.palette.accent}40, transparent 70%)`,
              }}
            />
            <div className="relative text-center">
              <Avatar
                name={item.live?.host ?? 'Host'}
                size="lg"
                tone="gold"
                className="mx-auto size-20 text-2xl"
              />
              <div className="mt-3 text-sm text-white/70">Live video plays here</div>
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase">
                <Radio className="size-3.5 animate-pulse" /> Live
              </span>
              <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs backdrop-blur">
                <Users className="size-3.5" /> {viewers}
              </span>
            </div>
            <DialogPrimitive.Close className="absolute top-3 right-3 rounded-full bg-black/40 p-2 backdrop-blur hover:bg-black/60">
              <X className="size-4" />
              <span className="sr-only">Leave</span>
            </DialogPrimitive.Close>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="font-semibold">{item.title}</div>
              <div className="text-xs text-white/70">
                {s.tenant.name} · with {item.live?.host}
              </div>
            </div>
          </div>
          <div className="flex max-h-[50vh] flex-col border-t border-white/10 md:max-h-none md:border-t-0 md:border-l">
            <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">
              Live chat
            </div>
            <ul className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
              {chat.map((m, i) => (
                <li key={i}>
                  <span className="font-semibold text-gold-300">{m.who}</span>{' '}
                  <span className="text-white/85">{m.text}</span>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2 border-t border-white/10 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                setChat((c) => [...c, { who: name, text: text.trim() }]);
                setText('');
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Say something kind…"
                className="h-10 flex-1 rounded-xl bg-white/10 px-3 text-sm outline-none placeholder:text-white/40 focus:ring-2 focus:ring-azure-500"
                aria-label="Chat message"
              />
              <button
                type="submit"
                className="rounded-xl bg-white px-3 text-obsidian-900"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            </form>
            <p className="px-4 pb-3 text-[11px] text-white/45">
              You appear as {name}. Your phone number is never shown.
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
