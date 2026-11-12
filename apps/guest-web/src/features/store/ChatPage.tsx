import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { Button, Textarea, cn } from '@stayvinci/ui';
import { time } from '@stayvinci/demo-data/format';
import { api } from '../../mock/api';
import { useAction } from '../../app/shared';

/** In-app chat with the House; no phone numbers exchanged (spec §9). */
export function ChatPage() {
  const { handle = '' } = useParams();
  const navigate = useNavigate();
  const chat = useQuery({
    queryKey: ['chat', handle],
    queryFn: () => api.chat.get(handle),
    refetchInterval: 2000,
  });
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const send = useAction((body: string) => api.chat.send(handle, body), {
    onSuccess: () => setDraft(''),
  });
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [chat.data?.messages.length]);

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
        <div className="flex-1 text-sm font-semibold">{chat.data?.storeName ?? 'Messages'}</div>
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
                {time(m.at, 'Africa/Nairobi')}
              </div>
            </div>
          </div>
        ))}
        {chat.data && chat.data.messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-ink-muted">
            Ask about times, services or directions.
          </p>
        ) : null}
        <div ref={end} />
      </div>
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
    </div>
  );
}
