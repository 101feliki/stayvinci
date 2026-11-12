import { createContext, useContext, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Smartphone } from 'lucide-react';
import { Button, Dialog, Field, Input } from '@stayvinci/ui';
import { api, type Me } from '../mock/api';

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

/* ---------- Sign-in sheet (phone + OTP; spec §7) ---------- */

interface SignInCtx {
  requireSignIn: (me: Me | undefined, then: () => void) => void;
}
const Ctx = createContext<SignInCtx | null>(null);

export function SignInProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [phone, setPhone] = useState('+254 7');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const signIn = useAction(() => api.me.signIn(phone, otp), {
    success: 'Signed in',
    onSuccess: () => {
      const next = pending;
      setPending(null);
      setStep('phone');
      setOtp('');
      next?.();
    },
  });
  return (
    <Ctx.Provider
      value={{
        requireSignIn: (me, then) => (me?.signedIn ? then() : setPending(() => then)),
      }}
    >
      {children}
      <Dialog
        open={pending !== null}
        onOpenChange={(o) => (!o ? setPending(null) : undefined)}
        size="sm"
        title={step === 'phone' ? 'Sign in to book' : 'Enter your code'}
        description={
          step === 'phone'
            ? 'We’ll text you a code. No password needed.'
            : `Sent to ${phone}. Demo: any 6 digits.`
        }
        footer={
          step === 'phone' ? (
            <Button
              className="w-full"
              onClick={() => setStep('otp')}
              disabled={phone.replace(/\D/g, '').length < 9}
            >
              <Smartphone className="size-4" /> Send code
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => signIn.mutate(undefined)}
              loading={signIn.isPending}
            >
              Continue
            </Button>
          )
        }
      >
        {step === 'phone' ? (
          <Field label="Mobile number">
            {(id) => (
              <Input
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 text-base"
              />
            )}
          </Field>
        ) : (
          <Field label="6-digit code">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="h-12 text-center text-xl tracking-[0.5em]"
              />
            )}
          </Field>
        )}
        <p className="mt-4 text-xs text-ink-subtle">
          You can browse without an account. You only need one to book.
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
