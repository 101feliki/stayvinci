import { createContext, useContext, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Button, Dialog, Field, Input } from '@stayvinci/ui';
import { api, type Me } from '../lib/api';

/* ---------- Store themes (curated, contrast-safe; spec §5.2) ---------- */

export const THEMES: Record<string, { bg: string; fg: string; soft: string; muted: string }> = {
  emerald: { bg: '#092720', fg: '#F5F1E8', soft: '#eef5f2', muted: 'rgba(245,241,232,0.72)' },
  noir: { bg: '#1C1C1E', fg: '#F5F1E8', soft: '#f3f2ef', muted: 'rgba(245,241,232,0.7)' },
  ivory: { bg: '#F5F1E8', fg: '#1C1C1E', soft: '#faf8f4', muted: 'rgba(28,28,30,0.65)' },
  plum: { bg: '#3B2A3F', fg: '#F5F1E8', soft: '#f5f0f6', muted: 'rgba(245,241,232,0.72)' },
};

export function themeOf(name: string) {
  return (
    THEMES[name] ?? (THEMES.emerald as { bg: string; fg: string; soft: string; muted: string })
  );
}

/* ---------- Data helpers ---------- */

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: api.me.get });
}

export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); onSuccess?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r) => {
      await qc.invalidateQueries();
      if (opts.success)
        toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onSuccess?.(r);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  });
}

/* ---------- Sign-in sheet (email link; SMS sign-in is on hold) ---------- */

interface SignInCtx {
  requireSignIn: (me: Me | undefined, then: () => void) => void;
}
const Ctx = createContext<SignInCtx | null>(null);
const RETURN_KEY = 'sv.guest.return';

/** Where to go back to after the emailed link signs the guest in. */
export function takeReturnPath(): string {
  try {
    const v = sessionStorage.getItem(RETURN_KEY) ?? localStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    localStorage.removeItem(RETURN_KEY);
    return v && v.startsWith('/') ? v : '/';
  } catch {
    return '/';
  }
}

export function SignInProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const send = useAction(() => api.me.requestLink(email), {
    onSuccess: () => {
      setSent(true);
      try {
        localStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search);
      } catch {
        // ignore
      }
    },
  });
  return (
    <Ctx.Provider
      value={{
        requireSignIn: (me, then) => (me?.signedIn ? then() : setOpen(true)),
      }}
    >
      {children}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSent(false);
        }}
        size="sm"
        title={sent ? 'Check your email' : 'Sign in to book'}
        description={
          sent
            ? `We sent a sign-in link to ${email}. Open it on this device to continue. It works once and expires in 15 minutes.`
            : 'We’ll email you a sign-in link. No password needed.'
        }
        footer={
          sent ? (
            <Button className="w-full" variant="ghost" onClick={() => setSent(false)}>
              Use another email
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => send.mutate(undefined)}
              loading={send.isPending}
              disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
            >
              <Mail className="size-4" /> Email me a link
            </Button>
          )
        }
      >
        {sent ? null : (
          <Field label="Email">
            {(id) => (
              <Input
                id={id}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send.mutate(undefined);
                }}
                className="h-12 text-base"
              />
            )}
          </Field>
        )}
        <p className="mt-4 text-xs text-ink-subtle">
          You can browse without an account. You only need one to book. New here? The link creates
          your account.
        </p>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useSignIn(): SignInCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('SignInProvider missing');
  return v;
}

export function Stars({ value, size = 'size-3.5' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={size}
          fill={i <= Math.round(value) ? '#C8A96A' : '#d6d3d1'}
          aria-hidden
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}
