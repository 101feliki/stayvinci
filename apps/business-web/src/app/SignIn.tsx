import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Button, Field, Input, Logo } from '@stayvinci/ui';
import { auth, type AuthStage } from '../lib/api';
import { ROLE_LABELS } from '../lib/capabilities';

type Step = 'email' | 'password' | 'sent' | 'link' | Exclude<AuthStage, 'signed_in' | 'signed_out'>;

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/**
 * Sign-in for owners and staff (spec §2): an emailed link or a password, then two-step
 * verification. SMS sign-in is on hold, so email is the way in.
 */
export function SignIn() {
  const qc = useQueryClient();
  const linkToken =
    window.location.pathname === '/auth/magic'
      ? new URLSearchParams(window.location.search).get('token')
      : null;
  const initial = auth.stage();
  const [step, setStep] = useState<Step>(
    linkToken ? 'link' : initial === 'signed_out' || initial === 'signed_in' ? 'email' : initial,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const advance = async (stage: AuthStage) => {
    setCode('');
    if (stage === 'signed_out') return setStep('email');
    if (stage === 'verify_2fa' || stage === 'setup_2fa') return setStep(stage);
    // Second factor done (or not needed): load the session; no House means invitations.
    await qc.invalidateQueries({ queryKey: ['session'] });
    if (auth.stage() === 'no_house') setStep('no_house');
  };

  // The emailed link lands on /auth/magic?token=…
  useEffect(() => {
    if (!linkToken) return;
    window.history.replaceState(null, '', '/auth/magic');
    auth
      .verifyLink(linkToken)
      .then(async (stage) => {
        window.history.replaceState(null, '', '/');
        await advance(stage);
      })
      .catch((e: unknown) => {
        window.history.replaceState(null, '', '/');
        toast.error(errText(e));
        setStep('email');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (step === 'email') {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter your work email.');
        await auth.requestLink(email.trim());
        setStep('sent');
      } else if (step === 'password') {
        await advance(await auth.password(email.trim(), password));
      } else if (step === 'verify_2fa') {
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code.');
        await advance(await auth.totpVerify(code));
      } else if (step === 'setup_2fa') {
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code.');
        await advance(await auth.totpEnable(code));
      }
    });
  };

  const back =
    step === 'password' || step === 'sent'
      ? () => setStep('email')
      : step === 'verify_2fa' || step === 'setup_2fa' || step === 'no_house'
        ? () => void auth.signOut().then(() => setStep('email'))
        : null;

  const title: Record<Step, string> = {
    email: 'Sign in',
    password: 'Sign in with a password',
    sent: 'Check your email',
    link: 'Signing you in…',
    verify_2fa: 'Two-step verification',
    setup_2fa: 'Turn on two-step verification',
    no_house: 'Almost there',
  };
  const lead: Record<Step, string> = {
    email: 'We will email you a secure sign-in link.',
    password: 'Use the password you set for Stayvinci.',
    sent: `If ${email || 'that address'} belongs to a Stayvinci team, a sign-in link is on its way. It works once and expires soon.`,
    link: 'One moment.',
    verify_2fa: 'Enter the code from your authenticator app.',
    setup_2fa:
      'Owners and staff protect their House with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).',
    no_house: 'Your account is ready.',
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
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo className="h-auto w-48" />
          </div>
          {back ? (
            <button
              type="button"
              onClick={back}
              className="mb-6 flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="size-4" />{' '}
              {step === 'password' || step === 'sent' ? 'Back' : 'Sign out'}
            </button>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{title[step]}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">{lead[step]}</p>

          <div className="mt-8 space-y-4">
            {step === 'email' || step === 'password' ? (
              <Field label="Work email">
                {(id) => (
                  <Input
                    id={id}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-base"
                  />
                )}
              </Field>
            ) : null}
            {step === 'password' ? (
              <Field label="Password">
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 text-base"
                  />
                )}
              </Field>
            ) : null}
            {step === 'setup_2fa' ? <TotpSetup /> : null}
            {step === 'verify_2fa' || step === 'setup_2fa' ? (
              <Field label="Authenticator code">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus={step === 'verify_2fa'}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="h-12 text-center text-xl tracking-[0.5em]"
                  />
                )}
              </Field>
            ) : null}
            {step === 'no_house' ? <Invitations onJoined={() => void advance('no_house')} /> : null}

            {step === 'email' ? (
              <>
                <Button type="submit" size="lg" className="w-full" loading={busy}>
                  <Mail className="size-4" /> Email me a sign-in link
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-azure-700 hover:underline"
                >
                  <KeyRound className="size-3.5" /> Use a password instead
                </button>
              </>
            ) : null}
            {step === 'password' ? (
              <>
                <Button type="submit" size="lg" className="w-full" loading={busy}>
                  Continue
                </Button>
                <button
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      if (!/^\S+@\S+\.\S+$/.test(email.trim()))
                        throw new Error('Enter your work email first.');
                      await auth.forgotPassword(email.trim());
                      toast.success('If that account exists, a reset link is on its way.');
                    })
                  }
                  className="w-full text-center text-sm text-azure-700 hover:underline"
                >
                  Forgot your password?
                </button>
              </>
            ) : null}
            {step === 'sent' ? (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                loading={busy}
                onClick={() => void run(async () => void (await auth.requestLink(email.trim())))}
              >
                Send the link again
              </Button>
            ) : null}
            {step === 'verify_2fa' || step === 'setup_2fa' ? (
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                {step === 'setup_2fa' ? 'Turn on and continue' : 'Verify and continue'}
              </Button>
            ) : null}
          </div>
          <p className="mt-8 text-center text-xs text-ink-subtle">
            New to Stayvinci? Ask your account manager for an invitation.
          </p>
        </form>
      </div>
    </div>
  );
}

/** Shows the QR code and the secret once, for the authenticator app. */
function TotpSetup() {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    auth
      .totpSetup()
      .then(async (s) => {
        setSecret(s.secret);
        setQr(await QRCode.toDataURL(s.otpauth_url, { margin: 1, width: 360 }));
      })
      .catch((e: unknown) => setError(errText(e)));
  }, []);
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-center">
      {qr ? (
        <img src={qr} alt="QR code for your authenticator app" className="mx-auto size-44" />
      ) : (
        <div className="mx-auto size-44 animate-pulse rounded-lg bg-line" />
      )}
      <p className="mt-3 text-xs text-ink-muted">Scan it, or enter this key:</p>
      <p className="mt-1 font-mono text-sm tracking-wider break-all select-all">{secret}</p>
    </div>
  );
}

/** Teams that invited this person. */
function Invitations({ onJoined }: { onJoined: () => void }) {
  const [list, setList] = useState<Awaited<ReturnType<typeof auth.invitations>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    auth
      .invitations()
      .then(setList)
      .catch(() => setList([]));
  }, []);
  if (!list) return <div className="h-20 animate-pulse rounded-xl bg-line" />;
  if (!list.length)
    return (
      <Note>
        You are not part of a House yet. Ask the owner to invite this email, then sign in again.
      </Note>
    );
  return (
    <ul className="space-y-3">
      {list.map((i) => (
        <li
          key={i.membership_id}
          className="flex items-center justify-between gap-3 rounded-xl border border-line p-4"
        >
          <div>
            <p className="font-medium">{i.tenant_name}</p>
            <p className="text-xs text-ink-muted">Invited as {ROLE_LABELS[i.role]}</p>
          </div>
          <Button
            type="button"
            loading={busy === i.membership_id}
            onClick={() => {
              setBusy(i.membership_id);
              auth
                .accept(i.membership_id)
                .then(() => {
                  toast.success(`Welcome to ${i.tenant_name}`);
                  onJoined();
                })
                .catch((e: unknown) => toast.error(errText(e)))
                .finally(() => setBusy(null));
            }}
          >
            Join
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-ivory p-4 text-sm text-ink-muted">{children}</p>;
}
