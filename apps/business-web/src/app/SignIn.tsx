import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input, Logo } from '@stayvinci/ui';
import { api } from '../mock/api';

type Step = 'phone' | 'otp' | 'totp';

/** Phone OTP sign-in with TOTP second factor for owners and staff (spec §2, P0 task 5). */
export function SignIn() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+254 712 345 678');
  const [otp, setOtp] = useState('');
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === 'phone') {
      setStep('otp');
      toast.message('Demo: any 6 digits work as the SMS code.');
      return;
    }
    if (step === 'otp') {
      if (!/^\d{6}$/.test(otp)) return toast.error('Enter the 6-digit code.');
      setStep('totp');
      return;
    }
    setBusy(true);
    try {
      await api.session.signIn(phone, otp, totp);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-emerald-sheen p-12 text-ivory lg:flex">
        <div
          className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full border border-gold-400/20"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-20 -right-20 size-[360px] rounded-full border border-gold-400/10"
          aria-hidden
        />
        <Logo on="dark" className="h-auto w-72" />
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            Your House, run quietly and beautifully.
          </h2>
          <p className="mt-4 text-[15px] text-emerald-100/80">
            Bookings, guests, payments into your own accounts, and a private store only your guests
            can enter.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-300/80">
          <ShieldCheck className="size-4 text-gold-300" /> Two-step verification is required for
          owners and staff.
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm">
          <Logo className="mb-8 h-auto w-48 lg:hidden" />
          {step !== 'phone' ? (
            <button
              type="button"
              onClick={() => setStep(step === 'totp' ? 'otp' : 'phone')}
              className="mb-6 flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">
            {step === 'phone'
              ? 'Sign in'
              : step === 'otp'
                ? 'Check your phone'
                : 'Two-step verification'}
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {step === 'phone'
              ? 'Use the mobile number linked to your House.'
              : step === 'otp'
                ? `We sent a 6-digit code by SMS to ${phone}.`
                : 'Enter the code from your authenticator app.'}
          </p>

          <div className="mt-8 space-y-4">
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
            ) : null}
            {step === 'otp' ? (
              <Field label="SMS code" hint="Demo: any 6 digits">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="h-12 text-center text-xl tracking-[0.5em]"
                  />
                )}
              </Field>
            ) : null}
            {step === 'totp' ? (
              <Field label="Authenticator code" hint="Demo: any 6 digits">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                    className="h-12 text-center text-xl tracking-[0.5em]"
                  />
                )}
              </Field>
            ) : null}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {step === 'phone' ? (
                <>
                  <Smartphone className="size-4" /> Send code
                </>
              ) : step === 'otp' ? (
                'Continue'
              ) : (
                'Verify and sign in'
              )}
            </Button>
          </div>
          <p className="mt-8 text-center text-xs text-ink-subtle">
            New to Stayvinci? Ask your account manager for an invitation.
          </p>
        </form>
      </div>
    </div>
  );
}
