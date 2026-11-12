import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, Clock, ShieldCheck } from 'lucide-react';
import { Avatar, Button, cn, ServiceVisual } from '@stayvinci/ui';
import { durationLabel, money } from '@stayvinci/demo-data/format';
import { useStore } from './StoreLayout';

export function OfferingPage() {
  const s = useStore();
  const { handle = '', serviceId = '' } = useParams();
  const navigate = useNavigate();
  const svc = s.services.find((x) => x.id === serviceId);
  const [variantId, setVariantId] = useState(svc?.variants[0]?.id ?? '');
  const th = s.palette;
  if (!svc)
    return (
      <p className="py-10 text-center text-sm text-ink-muted">This service isn't available.</p>
    );
  const variant = svc.variants.find((v) => v.id === variantId) ?? svc.variants[0];
  const team = s.staff.filter((p) => svc.staffIds.includes(p.id) && p.guestsCanChoose);
  const addOns = s.addOns
    .filter((a) =>
      a.appliesTo.toLowerCase().includes('massage') ? svc.categoryId === 'cat_massage' : true,
    )
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <div className="relative h-56 sm:h-80">
          <ServiceVisual
            image={svc.image}
            icon={svc.icon}
            name={svc.name}
            from={th.bg}
            to={th.accent}
            iconColor={th.fg}
          />
        </div>
        <div className="p-5 sm:p-7">
          <h1 className="text-2xl font-semibold tracking-tight">{svc.name}</h1>
          <p className="mt-2 text-[15px] text-ink-muted">{svc.description}</p>

          <h2 className="mt-7 mb-3 text-[13px] font-semibold tracking-wider text-ink-muted uppercase">
            Choose an option
          </h2>
          <div className="space-y-2">
            {svc.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors',
                  v.id === variant?.id
                    ? 'border-emerald-800 bg-emerald-50 ring-1 ring-emerald-800'
                    : 'border-line hover:border-line-strong',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border',
                    v.id === variant?.id
                      ? 'border-emerald-800 bg-emerald-800 text-white'
                      : 'border-line-strong',
                  )}
                >
                  {v.id === variant?.id ? <Check className="size-3" /> : null}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{v.name}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted">
                    <Clock className="size-3" /> {durationLabel(v.durationMin)}
                  </span>
                </span>
                <span className="text-sm font-semibold">{money(v.price)}</span>
              </button>
            ))}
          </div>

          {addOns.length ? (
            <>
              <h2 className="mt-7 mb-3 text-[13px] font-semibold tracking-wider text-ink-muted uppercase">
                Add-ons available
              </h2>
              <ul className="space-y-1.5 text-sm">
                {addOns.map((a) => (
                  <li key={a.id} className="flex justify-between">
                    <span>{a.name}</span>
                    <span className="text-ink-muted">+{money(a.price)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {team.length ? (
            <>
              <h2 className="mt-7 mb-3 text-[13px] font-semibold tracking-wider text-ink-muted uppercase">
                Who can do it
              </h2>
              <div className="flex flex-wrap gap-2">
                {team.map((p) => (
                  <span
                    key={p.id}
                    className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-sm"
                  >
                    <Avatar name={p.name} size="sm" /> {p.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          <div className="mt-7 flex items-start gap-2 rounded-2xl bg-canvas p-4 text-[13px] text-ink-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />
            {s.policies.paymentAtBooking === 'percent_deposit'
              ? `A ${s.policies.depositValue}% deposit secures your time. Free cancellation up to ${s.policies.freeCancelHours} hours before.`
              : `Free cancellation up to ${s.policies.freeCancelHours} hours before.`}
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-[var(--color-canvas)] via-[var(--color-canvas)] to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          className="w-full rounded-full"
          onClick={() => navigate(`/s/${handle}/book/${svc.id}?v=${variant?.id ?? ''}`)}
        >
          Choose a time · {variant ? money(variant.price) : ''}
        </Button>
      </div>
    </div>
  );
}
