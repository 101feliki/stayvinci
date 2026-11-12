import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  Info,
  Megaphone,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  Store,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Field,
  Input,
  PageHeader,
  Segmented,
  Select,
  StatTile,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
  cn,
  type BadgeTone,
} from '@stayvinci/ui';
import { money, pct } from '@stayvinci/demo-data/format';
import type { AdCampaign, AdChannel, AdObjective, MarketCode } from '@stayvinci/demo-data/platform';
import { api } from '../../mock/api';
import { ErrorState, PageSkeleton } from '../../components/common';
import { useAction } from '../../lib/query';

const CHANNEL: Record<AdChannel, { label: string; color: string; sub: string }> = {
  meta: { label: 'Meta', color: '#1877F2', sub: 'Instagram + Facebook' },
  google: { label: 'Google', color: '#34A853', sub: 'Search, YouTube, Display' },
  tiktok: { label: 'TikTok', color: '#111111', sub: 'For You feed' },
  x: { label: 'X', color: '#111111', sub: 'Promoted posts' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', sub: 'Business owners' },
};

const OBJECTIVE: Record<AdObjective, string> = {
  house_signups: 'Houses sign up',
  guest_installs: 'Guests get the app',
  awareness: 'Awareness',
};

const MARKET: Record<MarketCode, string> = {
  KE: 'Kenya',
  TZ: 'Tanzania',
  UG: 'Uganda',
  ZA: 'South Africa',
  AE: 'UAE (Dubai)',
  NG: 'Nigeria',
};

const STATUS: Record<AdCampaign['status'], { label: string; tone: BadgeTone }> = {
  active: { label: 'Running', tone: 'emerald' },
  paused: { label: 'Paused', tone: 'amber' },
  draft: { label: 'Draft', tone: 'neutral' },
  ended: { label: 'Ended', tone: 'neutral' },
};

/** Ads that market Stayvinci itself, across ad networks, with results per campaign. */
export function AdsPage() {
  const q = useQuery({ queryKey: ['ads'], queryFn: api.ads.list });
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState<AdChannel | null>(null);
  const toggle = useAction(
    ({ id, status }: { id: string; status: 'active' | 'paused' }) => api.ads.setStatus(id, status),
    { success: (c) => `${c.name}: ${STATUS[c.status].label}` },
  );
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const { accounts, campaigns, totals } = q.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ads"
        description="Market Stayvinci to businesses and guests across Instagram, Facebook, Google, TikTok, X and LinkedIn."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New campaign
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Ad spend"
          value={money(totals.spend, 'KES', { compact: true })}
          sub="All campaigns"
          icon={<Megaphone className="size-4" />}
        />
        <StatTile
          label="Houses signed up"
          value={totals.houses}
          sub={
            totals.costPerHouse
              ? `${money(totals.costPerHouse, 'KES', { compact: true })} per House`
              : '—'
          }
          icon={<Store className="size-4" />}
          accent="gold"
        />
        <StatTile
          label="Guests reached the app"
          value={totals.guests}
          sub="From install campaigns"
          icon={<Users className="size-4" />}
          accent="azure"
        />
        <StatTile
          label="Click-through rate"
          value={pct(totals.ctr)}
          sub={`${totals.clicks.toLocaleString('en-KE')} clicks`}
          icon={<MousePointerClick className="size-4" />}
          accent="plum"
        />
      </div>

      <Card>
        <CardHeader
          title="Ad accounts"
          description="Stayvinci's own accounts. Ads are paid from the marketing budget, never from guest money."
        />
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-5">
          {accounts.map((a) => (
            <div key={a.channel} className="flex flex-col gap-3 bg-surface p-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="size-3 rounded-full"
                  style={{ background: CHANNEL[a.channel].color }}
                />
                <div>
                  <div className="text-sm font-semibold">{CHANNEL[a.channel].label}</div>
                  <div className="text-[11px] text-ink-subtle">{CHANNEL[a.channel].sub}</div>
                </div>
              </div>
              {a.connected ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <Check className="size-3.5" /> <span className="truncate">{a.accountName}</span>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConnecting(a.channel)}>
                  Connect
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Campaigns"
          description="Results update daily from each network (demo figures)."
        />
        <Table>
          <thead>
            <tr>
              <Th>Campaign</Th>
              <Th>Status</Th>
              <Th className="text-right">Daily budget</Th>
              <Th className="text-right">Spend</Th>
              <Th className="text-right">Clicks</Th>
              <Th className="text-right">Results</Th>
              <Th className="text-right">Cost per result</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <img
                      src={c.creative.image.replace('.jpg', '-sm.jpg')}
                      alt=""
                      className="size-11 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-xs text-ink-subtle">
                        {CHANNEL[c.channel].label} · {MARKET[c.market]} · {OBJECTIVE[c.objective]}
                      </div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge tone={STATUS[c.status].tone} dot>
                    {STATUS[c.status].label}
                  </Badge>
                </Td>
                <Td className="text-right tabular-nums">{money(c.dailyBudget)}</Td>
                <Td className="text-right tabular-nums">
                  {c.spend ? money(c.spend, 'KES', { compact: true }) : '—'}
                </Td>
                <Td className="text-right tabular-nums">
                  {c.clicks ? c.clicks.toLocaleString('en-KE') : '—'}
                </Td>
                <Td className="text-right tabular-nums">
                  {c.conversions || '—'}
                  {c.conversions ? (
                    <div className="text-[11px] text-ink-subtle">
                      {c.objective === 'house_signups'
                        ? 'Houses'
                        : c.objective === 'guest_installs'
                          ? 'guests'
                          : 'visits'}
                    </div>
                  ) : null}
                </Td>
                <Td className="text-right tabular-nums">
                  {c.conversions ? money(c.spend / c.conversions, 'KES', { compact: true }) : '—'}
                </Td>
                <Td className="text-right">
                  {c.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle.mutate({ id: c.id, status: 'paused' })}
                    >
                      <Pause className="size-4" /> Pause
                    </Button>
                  ) : c.status === 'paused' || c.status === 'draft' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle.mutate({ id: c.id, status: 'active' })}
                    >
                      <Play className="size-4" /> {c.status === 'draft' ? 'Launch' : 'Resume'}
                    </Button>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="flex gap-3 p-4 text-[13px] text-ink-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-azure-600" />
        <p>
          In production, campaigns are created through each network&apos;s ads API (Meta Marketing
          API, Google Ads API, TikTok, X and LinkedIn) and results sync back nightly. Sign-ups are
          matched to campaigns through tracked links, so you can see which ads bring Houses that
          stay.
        </p>
      </Card>

      {creating ? <NewCampaign onClose={() => setCreating(false)} accounts={accounts} /> : null}
      {connecting ? (
        <ConnectAccount channel={connecting} onClose={() => setConnecting(null)} />
      ) : null}
    </div>
  );
}

const PRESETS: Record<
  AdObjective,
  { headline: string; body: string; cta: string; audience: string; image: string }
> = {
  house_signups: {
    headline: 'Your spa, run beautifully.',
    body: 'Private store, M-Pesa straight to your Till, and clients that stay yours.',
    cta: 'Start free setup',
    audience: 'Spa, salon and wellness owners · 25–55',
    image: '/demo/stones.jpg',
  },
  guest_installs: {
    headline: 'Quiet places, one quiet app.',
    body: 'Enter your spa’s private code and book in seconds.',
    cta: 'Get the app',
    audience: 'Adults 22–45 · interests: wellness, beauty, self-care',
    image: '/demo/massage.jpg',
  },
  awareness: {
    headline: 'Meet Stayvinci',
    body: 'Booking, beautifully private.',
    cta: 'Learn more',
    audience: 'Lifestyle audiences in the chosen market',
    image: '/demo/candles.jpg',
  },
};

function NewCampaign({
  onClose,
  accounts,
}: {
  onClose: () => void;
  accounts: { channel: AdChannel; connected: boolean }[];
}) {
  const [objective, setObjective] = useState<AdObjective>('house_signups');
  const [channel, setChannel] = useState<AdChannel>('meta');
  const [market, setMarket] = useState<MarketCode>('KE');
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('2000');
  const [audience, setAudience] = useState(PRESETS.house_signups.audience);
  const [creative, setCreative] = useState({ ...PRESETS.house_signups });
  const connected = accounts.find((a) => a.channel === channel)?.connected ?? false;
  const create = useAction(
    (status: 'active' | 'draft') =>
      api.ads.create({
        name: name || `${OBJECTIVE[objective]} · ${MARKET[market]}`,
        channel,
        objective,
        market,
        audience,
        status,
        dailyBudget: Math.round(Number(budget) * 100),
        creative: {
          headline: creative.headline,
          body: creative.body,
          cta: creative.cta,
          image: creative.image,
        },
      }),
    {
      success: (c) => (c.status === 'active' ? 'Campaign launched' : 'Saved as draft'),
      onSuccess: onClose,
    },
  );
  const pick = (o: AdObjective) => {
    setObjective(o);
    setAudience(PRESETS[o].audience);
    setCreative({ ...PRESETS[o] });
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? null : onClose())}
      size="lg"
      title="New campaign"
      description="Choose a goal, where to run it and who should see it. The preview shows the ad."
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => create.mutate('draft')}
            loading={create.isPending}
          >
            Save draft
          </Button>
          <Button
            onClick={() => create.mutate('active')}
            loading={create.isPending}
            disabled={!connected}
            title={connected ? undefined : 'Connect this ad account first'}
          >
            Launch
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_240px]">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-[13px] font-medium">Goal</div>
            <Segmented
              value={objective}
              onChange={pick}
              items={[
                { value: 'house_signups', label: 'Houses sign up' },
                { value: 'guest_installs', label: 'Guests' },
                { value: 'awareness', label: 'Awareness' },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Network">
              {(id) => (
                <Select
                  id={id}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as AdChannel)}
                >
                  {(Object.keys(CHANNEL) as AdChannel[]).map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL[c].label} ({CHANNEL[c].sub})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Market">
              {(id) => (
                <Select
                  id={id}
                  value={market}
                  onChange={(e) => setMarket(e.target.value as MarketCode)}
                >
                  {(Object.keys(MARKET) as MarketCode[]).map((m) => (
                    <option key={m} value={m}>
                      {MARKET[m]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {!connected ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
              {CHANNEL[channel].label} isn&apos;t connected yet. Save as a draft, or connect it on
              the Ads page.
            </p>
          ) : null}
          <Field label="Audience">
            {(id) => (
              <Input id={id} value={audience} onChange={(e) => setAudience(e.target.value)} />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Campaign name (optional)">
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Daily budget (KES)">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label="Headline">
            {(id) => (
              <Input
                id={id}
                value={creative.headline}
                maxLength={60}
                onChange={(e) => setCreative({ ...creative, headline: e.target.value })}
              />
            )}
          </Field>
          <Field label="Text">
            {(id) => (
              <Textarea
                id={id}
                value={creative.body}
                maxLength={140}
                onChange={(e) => setCreative({ ...creative, body: e.target.value })}
                className="min-h-16"
              />
            )}
          </Field>
          <div>
            <div className="mb-2 text-[13px] font-medium">Image</div>
            <div className="flex gap-2">
              {[
                '/demo/stones.jpg',
                '/demo/massage.jpg',
                '/demo/candles.jpg',
                '/demo/hotstone.jpg',
                '/demo/pool.jpg',
              ].map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setCreative({ ...creative, image: src })}
                  className={cn(
                    'size-12 overflow-hidden rounded-lg ring-2 ring-offset-1 ring-offset-surface',
                    creative.image === src ? 'ring-azure-500' : 'ring-transparent',
                  )}
                  aria-label="Use this image"
                >
                  <img
                    src={src.replace('.jpg', '-sm.jpg')}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ad preview (feed style) */}
        <div>
          <div className="mb-2 text-[13px] font-medium">Preview</div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <img
                src="/brand/mark-on-light.svg"
                alt=""
                className="size-7 rounded-full bg-obsidian-900 p-0.5 dark:hidden"
              />
              <img
                src="/brand/mark-on-dark.svg"
                alt=""
                className="hidden size-7 rounded-full bg-obsidian-900 p-0.5 dark:block"
              />
              <div className="leading-tight">
                <div className="text-[12px] font-semibold">stayvinci</div>
                <div className="text-[10px] text-ink-subtle">Sponsored</div>
              </div>
            </div>
            <img src={creative.image} alt="" className="aspect-square w-full object-cover" />
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-[12px] font-semibold">
              {creative.cta}
              <span aria-hidden>›</span>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[13px] font-semibold">{creative.headline}</div>
              <div className="mt-0.5 text-[12px] text-ink-muted">{creative.body}</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ink-subtle">
            {CHANNEL[channel].label} · {MARKET[market]} ·{' '}
            {money(Math.round(Number(budget) * 100) || 0)}/day
          </p>
        </div>
      </div>
    </Dialog>
  );
}

function ConnectAccount({ channel, onClose }: { channel: AdChannel; onClose: () => void }) {
  const [name, setName] = useState('Stayvinci');
  const connect = useAction(() => api.ads.connect(channel, name), {
    success: `${CHANNEL[channel].label} connected`,
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? null : onClose())}
      title={`Connect ${CHANNEL[channel].label}`}
      description={`In production you'll sign in to ${CHANNEL[channel].label} Business and pick the ad account. Demo: name it below.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={connect.isPending} onClick={() => connect.mutate(undefined)}>
            Connect
          </Button>
        </>
      }
    >
      <Field label="Ad account name">
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
    </Dialog>
  );
}
