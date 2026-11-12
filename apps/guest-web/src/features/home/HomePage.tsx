import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarClock,
  EyeOff,
  KeyRound,
  MoreHorizontal,
  QrCode,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Input,
  Menu,
  StoreLogo,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Skeleton,
} from '@stayvinci/ui';
import { dateTime } from '@stayvinci/demo-data/format';
import { api } from '../../mock/api';
import { useAction, useMe } from '../../app/shared';

export function EnterCode({ large = false }: { large?: boolean }) {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const enter = useAction((c: string) => api.enter(c), {
    success: (r) =>
      r.unlockedExtras ? `Welcome to ${r.name}. Private offers unlocked.` : `Welcome to ${r.name}`,
    onSuccess: (r) => navigate(`/s/${r.handle}`),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    enter.mutate(code, { onError: (err) => setError(err.message) });
  };
  return (
    <form onSubmit={submit}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gold-600" />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter a private code"
            aria-label="Private code"
            autoCapitalize="characters"
            className={
              large
                ? 'h-13 pl-10 font-mono text-base tracking-wider'
                : 'h-11 pl-10 font-mono tracking-wider'
            }
          />
        </div>
        <Button
          type="submit"
          size={large ? 'lg' : 'md'}
          loading={enter.isPending}
          className={large ? 'h-13' : 'h-11'}
        >
          Enter <ArrowRight className="size-4" />
        </Button>
      </div>
      {error ? <p className="mt-2 text-[13px] text-red-700">{error}</p> : null}
    </form>
  );
}

export function HomePage() {
  const me = useMe();
  const places = useQuery({ queryKey: ['places'], queryFn: api.places });
  const hide = useAction(
    (a: { handle: string; hidden: boolean }) => api.hidePlace(a.handle, a.hidden),
    {
      success: (_r) => 'Updated',
    },
  );
  const [showHidden, setShowHidden] = useState(false);

  if (!me.data || !places.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );

  const visible = places.data.filter((p) => !p.hidden);
  const hidden = places.data.filter((p) => p.hidden);
  const next = visible
    .filter((p) => p.nextBooking)
    .sort((a, b) => (a.nextBooking?.start ?? '').localeCompare(b.nextBooking?.start ?? ''))[0];

  return (
    <div className="space-y-8">
      {/* Welcome + code entry: always visible (spec §7). Edge-to-edge editorial band. */}
      <section className="relative -mt-5 ml-[calc(50%-50vw)] grid w-screen overflow-hidden bg-obsidian-sheen text-white md:-mt-8 md:min-h-[480px] md:grid-cols-[1.15fr_1fr]">
        <div className="relative z-10 flex flex-col justify-center px-5 py-10 sm:px-8 md:py-16 lg:pr-14 lg:pl-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))]">
          <div className="text-[11px] font-semibold tracking-[0.3em] text-white/60 uppercase">
            {me.data.signedIn
              ? `Welcome back, ${me.data.alias ?? me.data.firstName}`
              : 'Welcome to Stayvinci'}
          </div>
          <h1 className="mt-4 max-w-xl text-[2.2rem] leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Your private places, all in one quiet app.
          </h1>
          <p className="mt-4 max-w-md text-[15px] text-white/70">
            Got a code from a spa, salon or stay? Enter it to step inside.
          </p>
          <div className="mt-7 max-w-lg rounded-2xl bg-white p-2 text-ink dark:bg-surface">
            <EnterCode large />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-white/60">
            <span className="flex items-center gap-1.5">
              <QrCode className="size-4" /> Or scan the QR at reception
            </span>
            <span>Demo codes: SERENITY or VIP26</span>
          </div>
        </div>
        <div className="relative hidden md:block">
          <img
            src="/demo/candles.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian-900 via-obsidian-900/20 to-transparent" />
        </div>
      </section>

      {next?.nextBooking ? (
        <Link
          to="/bookings"
          className="flex items-center gap-4 rounded-2xl border border-azure-200 bg-azure-50 p-4 transition-colors hover:border-azure-400 dark:border-azure-200"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-azure-500 text-white">
            <CalendarClock className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-azure-800 uppercase">Coming up</span>
            <span className="block truncate text-sm font-medium">
              {next.name} · {dateTime(next.nextBooking.start, 'Africa/Nairobi')}
            </span>
          </span>
          <ArrowRight className="size-4 text-azure-700" />
        </Link>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold tracking-tight">My places</h2>
          {hidden.length ? (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              className="text-[13px] font-medium text-azure-700"
            >
              {showHidden ? 'Hide hidden' : `${hidden.length} hidden`}
            </button>
          ) : null}
        </div>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
            <Sparkles className="mx-auto size-6 text-gold-500" />
            <p className="mt-2 text-sm font-medium">No places yet</p>
            <p className="text-[13px] text-ink-muted">
              Enter a code above, or explore listed places in Discover.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {[...visible, ...(showHidden ? hidden : [])].map((p) => {
              const th = p.palette;
              return (
                <div
                  key={p.handle}
                  className="group relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow hover:shadow-card-hover"
                >
                  <Link to={`/s/${p.handle}`} className="block">
                    <div className="relative h-28 p-4" style={{ background: th.bg, color: th.fg }}>
                      <div
                        className="absolute -right-8 -bottom-12 size-32 rounded-full border opacity-40"
                        style={{ borderColor: p.accent }}
                      />
                      <StoreLogo
                        src={p.logo}
                        name={p.name}
                        background={th.accent}
                        color={th.onAccent}
                        className="size-11 shadow-sm"
                      />
                      {p.hidden ? (
                        <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[11px]">
                          <EyeOff className="size-3" /> Hidden
                        </span>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-[13px] text-ink-muted">
                        {p.area} · {p.vertical === 'spa' ? 'Spa & wellness' : 'Short stays'}
                      </div>
                    </div>
                  </Link>
                  <div className="absolute top-3 right-3">
                    <Menu>
                      <MenuTrigger
                        className="rounded-full bg-black/25 p-1.5 text-white hover:bg-black/40"
                        aria-label="Place options"
                      >
                        <MoreHorizontal className="size-4" />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem
                          onSelect={() => hide.mutate({ handle: p.handle, hidden: !p.hidden })}
                        >
                          <EyeOff className="size-4" />{' '}
                          {p.hidden ? 'Show in My places' : 'Hide from My places'}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Link
        to="/discover"
        className="flex items-center justify-between rounded-2xl border border-line bg-surface p-5 shadow-card hover:border-line-strong"
      >
        <span>
          <span className="block font-semibold">Discover listed places</span>
          <span className="text-[13px] text-ink-muted">
            Verified spas, salons and stays near you.
          </span>
        </span>
        <ArrowRight className="size-5 text-azure-600" />
      </Link>
    </div>
  );
}
