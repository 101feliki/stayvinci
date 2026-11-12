import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageCircleOff, Send, ShieldCheck } from 'lucide-react';
import { Button, Textarea, cn } from '@stayvinci/ui';
import { time } from '@stayvinci/demo-data/format';
import { api } from '../../lib/api';
import { useAction, useMe, useSignIn } from '../../app/shared';

/** In-app chat with the House; no phone numbers exchanged (spec §9). */
export function ChatPage() {
  const { handle = '' } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const { requireSignIn } = useSignIn();
  const signedIn = !!me.data?.signedIn;
  const chat = useQuery({
    queryKey: ['chat', handle],
    queryFn: () => api.chat.get(handle),
    enabled: signedIn,
    // New replies show within a few seconds while the chat is open (paused in background).
    refetchInterval: 4000,
  });
  const store = useQuery({ queryKey: ['store', handle], queryFn: () => api.store(handle) });
  const tz = store.data?.tenant.timezone ?? 'Africa/Nairobi';
  const enabled = chat.data ? chat.data.enabled : (store.data?.chatEnabled ?? true);
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const send = useAction((body: string) => api.chat.send(handle, body), {
    onSuccess: () => {
      setDraft('');
      void chat.refetch();
    },
  });
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect
    // must return nothing (or a clean-up function).
    void end.current?.scrollIntoView({ block: 'end' });
  }, [chat.data?.messages.length]);

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full p-1.5 hover:bg-canvas"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 truncate text-sm font-semibold">
          {chat.data?.storeName ?? store.data?.tenant.name ?? 'Messages'}
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[11px] text-ink-subtle shadow-sm">
          <ShieldCheck className="size-3.5 text-emerald-600" /> Private chat. Your number stays
          hidden.
        </div>
        {chat.data?.messages.map((m) => (
          <div
            key={m.id}
            className={cn('flex', m.from === 'guest' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                m.from === 'guest'
                  ? 'rounded-br-md bg-emerald-900 text-ivory'
                  : 'rounded-bl-md bg-surface',
              )}
            >
              {m.body}
              <div
                className={cn(
                  'mt-1 text-[10px]',
                  m.from === 'guest' ? 'text-emerald-200' : 'text-ink-subtle',
                )}
              >
                {time(m.at, tz)}
              </div>
            </div>
          </div>
        ))}
        {!signedIn && !me.isLoading ? (
          <div className="mx-auto max-w-xs pt-10 text-center">
            <p className="text-sm text-ink-muted">
              Sign in to message this House. Your phone number and email stay hidden from them.
            </p>
            <Button className="mt-4" onClick={() => requireSignIn(me.data, () => undefined)}>
              Sign in
            </Button>
          </div>
        ) : null}
        {chat.data && chat.data.messages.length === 0 && enabled ? (
          <p className="pt-10 text-center text-sm text-ink-muted">
            Ask about times, services or directions.
          </p>
        ) : null}
        {chat.isError ? (
          <p className="pt-10 text-center text-sm text-ink-muted">
            {chat.error instanceof Error ? chat.error.message : 'Messages could not load.'}
          </p>
        ) : null}
        <div ref={end} />
      </div>
      {!enabled ? (
        <div className="flex items-center justify-center gap-2 border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-ink-muted">
          <MessageCircleOff className="size-4" />
          This House isn’t taking messages here. You can still book.
        </div>
      ) : signedIn ? (
        <form
          className="flex items-end gap-2 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) send.mutate(draft.trim());
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message"
            rows={1}
            className="min-h-11 flex-1 resize-none"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 rounded-full"
            aria-label="Send"
            loading={send.isPending}
          >
            {send.isPending ? null : <Send className="size-4" />}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
