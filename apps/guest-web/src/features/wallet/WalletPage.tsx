import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Crown, Gift, Package, Plus, Smartphone } from 'lucide-react';
import { Skeleton } from '@stayvinci/ui';
import { money } from '@stayvinci/demo-data/format';
import { api } from '../../lib/api';

/** Packages, memberships, gift cards and saved methods, per place (spec §7, §10.7). */
export function WalletPage() {
  const q = useQuery({ queryKey: ['wallet'], queryFn: api.wallet });
  if (!q.data) return <Skeleton className="h-60 rounded-2xl" />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="text-sm text-ink-muted">
          Credits and gift cards belong to each place and can’t be moved between them.
        </p>
      </div>
      {q.data.map((w) => (
        <section
          key={w.handle}
          className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
        >
          <Link
            to={`/s/${w.handle}`}
            className="flex items-center justify-between border-b border-line px-5 py-3.5 text-sm font-semibold hover:bg-canvas"
          >
            {w.store}
            <span className="text-[13px] font-medium text-azure-700">Open</span>
          </Link>
          <div className="grid gap-px bg-line sm:grid-cols-3">
            <div className="bg-surface p-5">
              <Package className="size-5 text-emerald-700" />
              <div className="mt-3 text-2xl font-semibold">{w.credits}</div>
              <div className="text-[13px] text-ink-muted">Package sessions left</div>
            </div>
            <div className="bg-surface p-5">
              <Crown className="size-5 text-plum-500" />
              <div className="mt-3 text-lg font-semibold">
                {w.membership?.name ?? 'No membership'}
              </div>
              <div className="text-[13px] text-ink-muted">
                {w.membership ? `Renews ${w.membership.renews}` : 'See Memberships in the store'}
              </div>
            </div>
            <div className="bg-surface p-5">
              <Gift className="size-5 text-gold-600" />
              <div className="mt-3 text-lg font-semibold">
                {w.giftCard ? money(w.giftCard) : '—'}
              </div>
              <div className="text-[13px] text-ink-muted">Gift card balance</div>
            </div>
          </div>
        </section>
      ))}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[15px] font-semibold">Saved payment methods</h2>
        <p className="text-[13px] text-ink-muted">
          Stored securely by the payment provider, never by Stayvinci.
        </p>
        <ul className="mt-4 space-y-2">
          <li className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
            <Smartphone className="size-5 text-emerald-700" />{' '}
            <span className="flex-1">M-Pesa •••• 678</span>
            <span className="text-xs text-ink-subtle">Default</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
            <CreditCard className="size-5 text-azure-600" />{' '}
            <span className="flex-1">Visa •••• 4242</span>
          </li>
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-muted hover:text-ink"
            >
              <Plus className="size-5" /> Add a card
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}
