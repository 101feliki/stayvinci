import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { Avatar, Button, Card, EmptyState, PageHeader, Select, Textarea, cn } from '@stayvinci/ui';
import { api } from '../../mock/api';
import { useSession } from '../../app/session';
import { ErrorState, PageSkeleton } from '../../components/common';
import { guestName, relative, time } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

const QUICK = [
  'Thank you, see you soon!',
  'Your booking is confirmed.',
  'We have availability at that time. Shall I book it for you?',
  'Sorry, that time is taken. Could another time work?',
];

export function MessagesPage() {
  const { tenant } = useSession();
  const convs = useTenantQuery(['messages'], api.messages.list);
  const team = useTenantQuery(['team'], api.team.list);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const send = useAction((a: { id: string; body: string }) => api.messages.send(a.id, a.body), {
    onSuccess: () => setDraft(''),
  });
  const markRead = useAction((id: string) => api.messages.markRead(id));
  const assign = useAction(
    (a: { id: string; to: string | null }) => api.messages.assign(a.id, a.to),
    { success: 'Assigned' },
  );

  const sorted = useMemo(
    () =>
      [...(convs.data ?? [])].sort((a, b) =>
        (b.messages.at(-1)?.at ?? '').localeCompare(a.messages.at(-1)?.at ?? ''),
      ),
    [convs.data],
  );
  const active = sorted.find((c) => c.id === activeId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [active?.messages.length, activeId]);

  if (convs.error) return <ErrorState error={convs.error} />;
  if (!convs.data) return <PageSkeleton />;

  const open = (id: string) => {
    setActiveId(id);
    const c = sorted.find((x) => x.id === id);
    if (c?.unread) markRead.mutate(id);
  };

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Private chat with guests inside Stayvinci. Phone numbers are never exchanged unless you choose to show contacts."
      />
      <Card className="grid h-[calc(100vh-240px)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]">
        <ul className={cn('overflow-y-auto border-r border-line', active && 'hidden md:block')}>
          {sorted.map((c) => {
            const last = c.messages.at(-1);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => open(c.id)}
                  className={cn(
                    'flex w-full gap-3 border-b border-line px-4 py-3.5 text-left hover:bg-canvas',
                    c.id === activeId && 'bg-emerald-50/70',
                  )}
                >
                  <Avatar name={guestName(c.guest ?? undefined)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          c.unread ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {guestName(c.guest ?? undefined)}
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-subtle">
                        {last ? relative(last.at) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-[13px]',
                          c.unread ? 'text-ink' : 'text-ink-muted',
                        )}
                      >
                        {last?.from === 'staff' ? 'You: ' : ''}
                        {last?.body}
                      </span>
                      {c.unread ? (
                        <span className="ml-auto size-2 shrink-0 rounded-full bg-azure-500" />
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {active ? (
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button
                type="button"
                className="md:hidden"
                onClick={() => setActiveId(null)}
                aria-label="Back"
              >
                <ArrowLeft className="size-5" />
              </button>
              <Avatar name={guestName(active.guest ?? undefined)} size="sm" />
              <div className="flex-1">
                <Link
                  to={`/guests/${active.guestId}`}
                  className="text-sm font-semibold hover:underline"
                >
                  {guestName(active.guest ?? undefined)}
                </Link>
                <div className="text-[11px] text-ink-subtle">
                  {active.guest?.visits ?? 0} visits
                </div>
              </div>
              <div className="w-44">
                <Select
                  value={active.assignedTo ?? ''}
                  onChange={(e) => assign.mutate({ id: active.id, to: e.target.value || null })}
                  className="h-9 text-[13px]"
                  aria-label="Assign conversation"
                >
                  <option value="">Unassigned</option>
                  {team.data?.members
                    .filter((m) => m.status === 'active')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-canvas/50 px-4 py-5">
              <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[11px] text-ink-subtle shadow-sm">
                <ShieldCheck className="size-3.5 text-emerald-600" /> Private conversation with{' '}
                {tenant.name}
              </div>
              {active.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn('flex', m.from === 'staff' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                      m.from === 'staff'
                        ? 'rounded-br-md bg-emerald-900 text-ivory'
                        : 'rounded-bl-md bg-surface text-ink',
                    )}
                  >
                    <div>{m.body}</div>
                    <div
                      className={cn(
                        'mt-1 text-[10px]',
                        m.from === 'staff' ? 'text-emerald-200' : 'text-ink-subtle',
                      )}
                    >
                      {m.author} · {time(m.at, tenant.timezone)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="border-t border-line p-3">
              <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {QUICK.map((qr) => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => setDraft(qr)}
                    className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink-muted hover:border-azure-400 hover:text-ink"
                  >
                    {qr}
                  </button>
                ))}
              </div>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) send.mutate({ id: active.id, body: draft.trim() });
                }}
              >
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a reply…"
                  className="min-h-11 flex-1 resize-none"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (draft.trim()) send.mutate({ id: active.id, body: draft.trim() });
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-11 rounded-xl"
                  loading={send.isPending}
                  aria-label="Send"
                >
                  {send.isPending ? null : <Send className="size-4" />}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="hidden md:block">
            <EmptyState
              icon={<MessageSquare className="size-5" />}
              title="Select a conversation"
              description="Messages from guests appear here."
              className="h-full"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
