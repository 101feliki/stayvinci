import { useState } from 'react';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Field,
  Input,
  SocialIcon,
  SOCIAL_COLOR,
  SOCIAL_LABEL,
  Switch,
  type SocialNetwork,
} from '@stayvinci/ui';
import { api } from '../../lib/api';
import { useSession } from '../../app/session';
import { relative } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

const WHY: Record<SocialNetwork, string> = {
  instagram: 'Show your feed link and add a “Book” button to your Instagram profile.',
  facebook: 'Link your page and add a “Book now” button that opens your store.',
  x: 'Link your profile from your store.',
  tiktok: 'Link your TikTok so guests can see your work.',
  whatsapp: 'Let guests start a chat from your store. Your number stays hidden from staff.',
};

/** Connect Instagram, Facebook, X, TikTok and WhatsApp (spec §5.2 contact & channels). */
export function SocialAccounts() {
  const { tenant } = useSession();
  const sf = useTenantQuery(['storefront'], api.storefront.get);
  const [connecting, setConnecting] = useState<SocialNetwork | null>(null);
  const update = useAction(
    ({
      network,
      patch,
    }: {
      network: SocialNetwork;
      patch: { showOnStore?: boolean; bookButton?: boolean };
    }) => api.storefront.updateSocial(network, patch),
  );
  const disconnect = useAction((n: SocialNetwork) => api.storefront.disconnectSocial(n), {
    success: 'Disconnected',
  });
  const link = `https://${tenant.handle.toLowerCase()}.stayvinci.com`;

  if (!sf.data) return null;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Your booking link"
          description="Paste it in your Instagram, TikTok and X bios, or your WhatsApp Business profile."
        />
        <div className="flex flex-wrap items-center gap-2 p-5">
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 font-mono text-sm">
            <Link2 className="size-4 shrink-0 text-ink-subtle" />
            <span className="truncate">{link}</span>
          </span>
          <Button
            variant="secondary"
            onClick={() =>
              void navigator.clipboard
                .writeText(link)
                .then(() => toast.success('Link copied'))
                .catch(() => toast.message(link))
            }
          >
            <Copy className="size-4" /> Copy
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Social accounts"
          description="Connect once; choose what shows on your store. Stayvinci never posts for you."
        />
        <ul className="divide-y divide-line">
          {sf.data.socials.map((a) => (
            <li
              key={a.network}
              className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: SOCIAL_COLOR[a.network] }}
                >
                  <SocialIcon network={a.network} className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {SOCIAL_LABEL[a.network]}
                    {a.connected ? (
                      <Badge tone="emerald">
                        <Check className="size-3" /> Connected
                      </Badge>
                    ) : null}
                  </div>
                  <div className="truncate text-[13px] text-ink-muted">
                    {a.connected
                      ? `${a.network === 'whatsapp' ? a.handle : `@${a.handle}`}${a.followers ? ` · ${a.followers.toLocaleString('en-KE')} followers` : ''}${a.connectedAt ? ` · since ${relative(a.connectedAt)}` : ''}`
                      : WHY[a.network]}
                  </div>
                </div>
              </div>
              {a.connected ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <label className="flex items-center gap-2 text-[13px] text-ink-muted">
                    <Switch
                      checked={a.showOnStore}
                      onChange={(v) =>
                        update.mutate({ network: a.network, patch: { showOnStore: v } })
                      }
                      label={`Show ${SOCIAL_LABEL[a.network]} on store`}
                    />
                    Show on store
                  </label>
                  {a.network === 'instagram' || a.network === 'facebook' ? (
                    <label className="flex items-center gap-2 text-[13px] text-ink-muted">
                      <Switch
                        checked={a.bookButton}
                        onChange={(v) =>
                          update.mutate({ network: a.network, patch: { bookButton: v } })
                        }
                        label="Book button on profile"
                      />
                      “Book” button
                    </label>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => disconnect.mutate(a.network)}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConnecting(a.network)}>
                  Connect
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {connecting ? (
        <ConnectDialog network={connecting} onClose={() => setConnecting(null)} />
      ) : null}
    </div>
  );
}

/** Prototype of the OAuth hand-off: in production this opens the network's own sign-in. */
function ConnectDialog({ network, onClose }: { network: SocialNetwork; onClose: () => void }) {
  const [handle, setHandle] = useState('');
  const connect = useAction(() => api.storefront.connectSocial(network, handle), {
    success: `${SOCIAL_LABEL[network]} connected`,
    onSuccess: onClose,
  });
  const isWa = network === 'whatsapp';
  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? null : onClose())}
      title={`Connect ${SOCIAL_LABEL[network]}`}
      description={
        isWa
          ? 'Use your WhatsApp Business number. Guests start chats from your store; staff never see the number.'
          : `You'll approve Stayvinci on ${SOCIAL_LABEL[network]}. We only read your public profile; we never post.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={connect.isPending}
            onClick={() => connect.mutate(undefined)}
            disabled={handle.trim().length < 2}
          >
            <ExternalLink className="size-4" />{' '}
            {isWa ? 'Verify number' : `Continue to ${SOCIAL_LABEL[network]}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-canvas p-3">
          <span
            className="flex size-10 items-center justify-center rounded-xl text-white"
            style={{ background: SOCIAL_COLOR[network] }}
          >
            <SocialIcon network={network} className="size-5" />
          </span>
          <div className="text-[13px] text-ink-muted">
            Demo: type an account name. In the live app this step opens {SOCIAL_LABEL[network]} to
            sign in and approve.
          </div>
        </div>
        <Field label={isWa ? 'WhatsApp Business number' : 'Account name'}>
          {(id) => (
            <Input
              id={id}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={isWa ? '+254 7…' : '@yourhouse'}
              autoFocus
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
