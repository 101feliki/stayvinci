import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, EyeOff, Globe, KeyRound, Plus, QrCode, Store } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
  cn,
  LogoMark,
} from '@stayvinci/ui';
import { api } from '../../lib/api';
import type { AccessCode, VisibilityMode } from '../../mock/types';
import { useSession } from '../../app/session';
import { ErrorState, PageSkeleton } from '../../components/common';
import { date } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

const MODES: { value: VisibilityMode; title: string; body: string; icon: typeof EyeOff }[] = [
  {
    value: 'private',
    title: 'Private',
    body: 'Never appears in search or maps. Guests enter with your code, link or QR.',
    icon: EyeOff,
  },
  {
    value: 'listed_limited',
    title: 'Listed, menu locked',
    body: 'Your profile is discoverable; guests need a code or request to see the menu.',
    icon: Store,
  },
  {
    value: 'listed',
    title: 'Listed',
    body: 'Discoverable in the Stayvinci marketplace. Marketplace guests carry a one-time fee.',
    icon: Globe,
  },
];

/** Opening the door: visibility modes, access codes, invite links, QR (spec §6). */
export function AccessPage() {
  const { tenant } = useSession();
  const access = useTenantQuery(['access'], api.access.get);
  const setMode = useAction((m: VisibilityMode) => api.access.setVisibility(m), {
    success: 'Visibility updated',
  });
  const revoke = useAction((id: string) => api.access.revoke(id), {
    success: 'Code revoked. Guests already inside keep access.',
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [qr, setQr] = useState<AccessCode | null>(null);

  if (access.error) return <ErrorState error={access.error} />;
  if (!access.data) return <PageSkeleton />;

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => toast.success('Link copied'));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access & visibility"
        description="Decide who can find your store, and give your own guests a private way in."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {MODES.map((m) => {
          const active = access.data.visibility === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => !active && setMode.mutate(m.value)}
              className={cn(
                'rounded-2xl border bg-surface p-5 text-left shadow-card transition-all',
                active
                  ? 'border-emerald-700 ring-2 ring-emerald-700/15'
                  : 'border-line hover:border-line-strong',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl',
                    active ? 'bg-emerald-900 text-gold-300' : 'bg-canvas text-ink-muted',
                  )}
                >
                  <m.icon className="size-5" />
                </span>
                {active ? (
                  <Badge tone="emerald" dot>
                    Current
                  </Badge>
                ) : null}
              </div>
              <div className="mt-4 font-semibold">{m.title}</div>
              <p className="mt-1 text-[13px] text-ink-muted">{m.body}</p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Access codes and invite links"
          description="Everyone who enters through these is your own guest, forever. No marketplace fee ever applies to them."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New code
            </Button>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th className="hidden md:table-cell">Unlocks</Th>
              <Th className="text-right">Used</Th>
              <Th className="hidden sm:table-cell">Expires</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {access.data.codes.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-gold-600" />
                    <span className="font-mono font-semibold tracking-wide">{c.code}</span>
                    {c.kind === 'primary' ? <Badge tone="gold">Primary</Badge> : null}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-subtle">{c.label}</div>
                </Td>
                <Td className="hidden text-ink-muted md:table-cell">
                  {c.scope === 'store' ? 'Whole store' : 'Invite-only items'}
                </Td>
                <Td className="text-right tabular-nums">
                  {c.uses}
                  {c.usageLimit ? <span className="text-ink-subtle"> / {c.usageLimit}</span> : null}
                </Td>
                <Td className="hidden text-ink-muted sm:table-cell">
                  {c.expiresAt ? date(c.expiresAt, tenant.timezone) : 'Never'}
                </Td>
                <Td>
                  <Badge
                    tone={
                      c.status === 'active' ? 'emerald' : c.status === 'revoked' ? 'red' : 'neutral'
                    }
                  >
                    {c.status}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copy(`https://stayvinci.com/i/${c.code}`)}
                      aria-label="Copy invite link"
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setQr(c)}
                      aria-label="QR code"
                    >
                      <QrCode className="size-4" />
                    </Button>
                    {c.kind !== 'primary' && c.status === 'active' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50"
                        onClick={() => revoke.mutate(c.id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {createOpen ? <CreateCode onClose={() => setCreateOpen(false)} /> : null}
      {qr ? <QrDialog code={qr} onClose={() => setQr(null)} /> : null}
    </div>
  );
}

function CreateCode({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<AccessCode['scope']>('store');
  const [kind, setKind] = useState<AccessCode['kind']>('campaign');
  const [expires, setExpires] = useState('');
  const [limit, setLimit] = useState('');
  const create = useAction(
    () =>
      api.access.createCode({
        code,
        label: label || code,
        kind,
        scope,
        expiresAt: expires ? new Date(`${expires}T23:59:00+03:00`).toISOString() : null,
        usageLimit: limit ? Number(limit) : kind === 'personal' ? 1 : null,
      }),
    { success: 'Code created', onSuccess: onClose },
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title="New access code"
      description="Codes are case-insensitive. Revoking a code stops new entries only."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate(undefined)}
            loading={create.isPending}
            disabled={code.length < 4}
          >
            Create code
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" className="sm:col-span-2" hint="4–16 letters, numbers or dashes">
          {(id) => (
            <Input
              id={id}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-wider uppercase"
              placeholder="VIPDEC"
            />
          )}
        </Field>
        <Field label="Label (internal)" className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. December campaign"
            />
          )}
        </Field>
        <Field label="Type">
          {(id) => (
            <Select
              id={id}
              value={kind}
              onChange={(e) => setKind(e.target.value as AccessCode['kind'])}
            >
              <option value="campaign">Campaign (many guests)</option>
              <option value="personal">Personal (single use)</option>
            </Select>
          )}
        </Field>
        <Field label="Unlocks">
          {(id) => (
            <Select
              id={id}
              value={scope}
              onChange={(e) => setScope(e.target.value as AccessCode['scope'])}
            >
              <option value="store">Whole store</option>
              <option value="invite_items">Invite-only items</option>
            </Select>
          )}
        </Field>
        <Field label="Expires (optional)">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          )}
        </Field>
        <Field label="Usage limit (optional)">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

function QrDialog({ code, onClose }: { code: AccessCode; onClose: () => void }) {
  const [svg, setSvg] = useState('');
  const [png, setPng] = useState('');
  const url = `https://stayvinci.com/i/${code.code}`;
  useEffect(() => {
    const opts = {
      margin: 1,
      color: { dark: '#0b2620', light: '#ffffff' },
      errorCorrectionLevel: 'H' as const,
    };
    void QRCode.toString(url, { ...opts, type: 'svg' }).then(setSvg);
    void QRCode.toDataURL(url, { ...opts, width: 1024 }).then(setPng);
  }, [url]);
  const svgUrl = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      size="sm"
      title={`QR for ${code.code}`}
      description="Print for reception cards and table tents."
    >
      <div className="flex flex-col items-center">
        <div className="relative rounded-2xl border border-line bg-white p-4">
          {svgUrl ? (
            <img src={svgUrl} alt={`QR code for ${url}`} className="size-56" />
          ) : (
            <div className="size-56 animate-pulse rounded-lg bg-stone-100" />
          )}
          <LogoMark
            badge
            className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 border-4 border-white"
          />
        </div>
        <div className="mt-3 font-mono text-xs text-ink-muted">{url}</div>
        <div className="mt-5 flex gap-2">
          <a href={png} download={`stayvinci-${code.code}.png`}>
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> PNG
            </Button>
          </a>
          <a href={svgUrl} download={`stayvinci-${code.code}.svg`}>
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> SVG
            </Button>
          </a>
        </div>
      </div>
    </Dialog>
  );
}
