import { useState } from 'react';
import {
  Bell,
  Download,
  Fingerprint,
  LogOut,
  Megaphone,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Input,
  LogoMark,
  Segmented,
  Skeleton,
  Switch,
  ThemeSwitcher,
} from '@stayvinci/ui';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { appLock } from '../../lib/appLock';
import { useAction, useMe, useSignIn } from '../../app/shared';

/** Profile and privacy controls (spec §7 discretion features). */
export function ProfilePage() {
  const me = useMe();
  const { requireSignIn } = useSignIn();
  const update = useAction((p: Parameters<typeof api.me.update>[0]) => api.me.update(p), {
    success: 'Saved',
  });
  const signOut = useAction(
    async () => {
      appLock.disable();
      return api.me.signOut();
    },
    { success: 'Signed out' },
  );
  // Called straight from the tap: phones only show Face ID/fingerprint after a tap.
  const toggleLock = async (on: boolean) => {
    try {
      if (on) {
        if (!(await appLock.supported())) {
          toast.error(
            'This phone or browser can’t lock the app. Set a screen lock (PIN, fingerprint or Face ID) on the phone first.',
          );
          return;
        }
        await appLock.enable();
        update.mutate({ appLock: true });
        toast.success('App lock is on. You’ll be asked when the app opens.');
      } else {
        if (!(await appLock.unlock())) return;
        appLock.disable();
        update.mutate({ appLock: false });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') return; // cancelled
      toast.error(e instanceof Error ? e.message : 'Could not change the app lock.');
    }
  };
  const [alias, setAlias] = useState<string | null>(null);

  if (!me.data) return <Skeleton className="h-80 rounded-2xl" />;
  const m = me.data;
  if (!m.signedIn)
    return (
      <div className="py-16 text-center">
        <UserRound className="mx-auto size-8 text-ink-subtle" />
        <h1 className="mt-3 text-lg font-semibold">You’re browsing as a visitor</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sign in with your email to book and keep your places.
        </p>
        <Button className="mt-5" onClick={() => requireSignIn(m, () => undefined)}>
          Sign in
        </Button>
      </div>
    );

  const preview =
    m.notificationDetail === 'neutral'
      ? 'Your appointment is confirmed for tomorrow at 10:30.'
      : 'Serenity Spa: Deep tissue massage confirmed for tomorrow at 10:30.';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={`${m.firstName} ${m.lastName}`} size="lg" tone="gold" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {m.firstName} {m.lastName}
          </h1>
          <div className="text-sm text-ink-muted">{m.email ?? m.phone}</div>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[15px] font-semibold">Appearance</h2>
        <p className="mb-4 text-[13px] text-ink-muted">
          Follow your phone&apos;s setting, or always use light or dark.
        </p>
        <ThemeSwitcher />
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <UserRound className="size-4 text-emerald-700" /> Default alias
        </h2>
        <p className="text-[13px] text-ink-muted">
          Places see this name instead of your real one. Leave empty to use your first name.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            value={alias ?? m.alias ?? ''}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g. Ms. K"
          />
          <Button
            variant="secondary"
            disabled={alias === null}
            onClick={() => update.mutate({ alias: alias || null })}
          >
            Save
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Bell className="size-4 text-emerald-700" /> Lock-screen notifications
        </h2>
        <p className="text-[13px] text-ink-muted">
          Neutral messages never name the place or the service.
        </p>
        <Segmented
          className="mt-3"
          value={m.notificationDetail}
          onChange={(v) => update.mutate({ notificationDetail: v })}
          items={[
            { value: 'neutral', label: 'Neutral (recommended)' },
            { value: 'detailed', label: 'Detailed' },
          ]}
        />
        <div className="mt-4 rounded-2xl bg-charcoal p-3 text-ivory">
          <div className="flex items-center gap-2 text-[11px] text-stone-400">
            <LogoMark on="dark" className="size-4" />{' '}
            {m.notificationDetail === 'neutral' ? 'Reminder' : 'Stayvinci'} · now
          </div>
          <div className="mt-1 text-sm">{preview}</div>
        </div>
      </section>

      <section className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center gap-4 p-5">
          <Fingerprint className="size-5 text-emerald-700" />
          <div className="flex-1">
            <div className="text-sm font-medium">App lock</div>
            <div className="text-[13px] text-ink-muted">
              Ask for Face ID, fingerprint or your phone’s PIN when the app opens, and after a
              minute away.
            </div>
          </div>
          <Switch checked={m.appLock} onChange={(v) => void toggleLock(v)} label="App lock" />
        </div>
        <div className="flex items-center gap-4 p-5">
          <Megaphone className="size-5 text-emerald-700" />
          <div className="flex-1">
            <div className="text-sm font-medium">Offers from my places</div>
            <div className="text-[13px] text-ink-muted">
              Places message you through Stayvinci; they never get your number.
            </div>
          </div>
          <Switch
            checked={m.marketing}
            onChange={(v) => update.mutate({ marketing: v })}
            label="Offers"
          />
        </div>
        <div className="flex items-center gap-4 p-5">
          <Smartphone className="size-5 text-emerald-700" />
          <div className="flex-1">
            <div className="text-sm font-medium">Signed-in devices</div>
            <div className="text-[13px] text-ink-muted">
              This browser. Signing out here ends this session only.
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <ShieldCheck className="size-4 text-emerald-700" /> Your data
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm">
            <Download className="size-4" /> Download my data
          </Button>
          <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50">
            <Trash2 className="size-4" /> Delete account
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-subtle">
          Payment and dispute records are kept for the period the law requires.
        </p>
      </section>

      <Button variant="ghost" className="w-full" onClick={() => signOut.mutate(undefined)}>
        <LogOut className="size-4" /> Sign out
      </Button>
    </div>
  );
}
