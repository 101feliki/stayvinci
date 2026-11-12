import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input, Logo } from '@stayvinci/ui';
import { api } from '../mock/api';

/** Staff sign-in: work email + password, then an authenticator code (spec §13: 2FA required). */
export function SignIn() {
  const qc = useQueryClient();
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [email, setEmail] = useState('felix@stayvinci.com');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === 'password') {
      if (password.length < 8) {
        toast.error('Enter your password (at least 8 characters).');
        return;
      }
      setStep('totp');
      return;
    }
    setBusy(true);
    try {
      await api.session.signIn(email, password, totp);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-emerald-sheen p-12 text-ivory lg:flex">
        <Logo on="dark" className="h-auto w-64" />
        <div className="max-w-md">
          <div className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">
            Console
          </div>
          <h2 className="mt-2 text-3xl leading-tight font-semibold tracking-tight">
            Run every House from one place.
          </h2>
          <p className="mt-4 text-[15px] text-emerald-100/80">
            Onboard businesses, set up their stores, release features and watch how the platform
            performs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-300/80">
          <ShieldCheck className="size-4 text-gold-300" /> Stayvinci staff only. Every action is
          recorded.
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm">
          <Logo className="mb-8 h-auto w-44 lg:hidden" />
          {step === 'totp' ? (
            <button
              type="button"
              onClick={() => setStep('password')}
              className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">
            {step === 'password' ? 'Staff sign in' : 'Two-step verification'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {step === 'password'
              ? 'Use your Stayvinci work account.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>
          <div className="mt-8 space-y-4">
            {step === 'password' ? (
              <>
                <Field label="Work email">
                  {(id) => (
                    <Input
                      id={id}
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Password" hint="Demo: any 8 characters">
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                    />
                  )}
                </Field>
              </>
            ) : (
              <Field label="Authenticator code" hint="Demo: any 6 digits">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                    className="text-center font-mono text-lg tracking-[0.4em]"
                    autoFocus
                  />
                )}
              </Field>
            )}
            <Button type="submit" className="w-full" size="lg" loading={busy}>
              <KeyRound className="size-4" /> {step === 'password' ? 'Continue' : 'Sign in'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
