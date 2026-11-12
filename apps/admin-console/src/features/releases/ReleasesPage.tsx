import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus, Rocket, X } from 'lucide-react';
import { Badge, Card, PageHeader, Segmented, Select } from '@stayvinci/ui';
import { date } from '@stayvinci/demo-data/format';
import type { FeatureDef, FeatureStage } from '@stayvinci/demo-data/platform';
import { api } from '../../mock/api';
import { ErrorState, PageSkeleton } from '../../components/common';
import { STAGE } from '../../lib/labels';
import { useAction } from '../../lib/query';
import { useCan } from '../../app/session';

/**
 * Feature releases: decide who gets a new feature before it reaches the plans.
 * Internal (test Houses) → Beta (pilot Houses) → Released (follows the plans).
 * Only features that are already built and deployed appear here.
 */
export function ReleasesPage() {
  const plans = useQuery({ queryKey: ['plans'], queryFn: api.plans.list });
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: api.tenants.list });
  if (plans.error) return <ErrorState error={plans.error} />;
  if (!plans.data || !tenants.data) return <PageSkeleton />;
  const rollout = plans.data.features.filter((f) => !f.core);
  const upcoming = rollout.filter((f) => f.stage !== 'general');
  const released = rollout.filter((f) => f.stage === 'general');
  const houses = tenants.data.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature releases"
        description="Turn new features on for test Houses first, then pilots, then everyone on the right plans."
      />
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
        <Badge>Internal</Badge> test Houses you pick <ArrowRight className="size-3.5" />
        <Badge tone="azure">Beta</Badge> pilot Houses <ArrowRight className="size-3.5" />
        <Badge tone="emerald">Released</Badge> follows Plans & features
      </div>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold tracking-wider text-ink-muted uppercase">
          Rolling out
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {upcoming.map((f) => (
            <FeatureCard key={f.key} f={f} houses={houses} />
          ))}
          {upcoming.length === 0 ? (
            <Card className="p-6 text-sm text-ink-muted">Nothing rolling out right now.</Card>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold tracking-wider text-ink-muted uppercase">
          Released
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {released.map((f) => (
            <FeatureCard key={f.key} f={f} houses={houses} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ f, houses }: { f: FeatureDef; houses: { id: string; name: string }[] }) {
  const can = useCan();
  const [adding, setAdding] = useState('');
  const stage = useAction((s: FeatureStage) => api.features.setStage(f.key, s), {
    success: (x) => `${x.name}: ${STAGE[x.stage].label}`,
  });
  const tester = useAction(
    ({ id, on }: { id: string; on: boolean }) => api.features.setTester(f.key, id, on),
    { success: 'Testers updated', onSuccess: () => setAdding('') },
  );
  const nameOf = (id: string) => houses.find((h) => h.id === id)?.name ?? id;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Rocket className="size-4" />
          </span>
          <div>
            <div className="font-semibold">{f.name}</div>
            <div className="text-[13px] text-ink-muted">{f.description}</div>
            {f.releasedAt ? (
              <div className="mt-1 text-xs text-ink-subtle">
                Released {date(f.releasedAt, 'Africa/Nairobi')}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-4">
        {can('plan.manage') ? (
          <Segmented
            value={f.stage}
            onChange={(s) => stage.mutate(s)}
            items={[
              { value: 'internal', label: 'Internal' },
              { value: 'beta', label: 'Beta' },
              { value: 'general', label: 'Released' },
            ]}
          />
        ) : (
          <Badge tone={STAGE[f.stage].tone}>{STAGE[f.stage].label}</Badge>
        )}
      </div>
      {f.stage !== 'general' ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-2 text-[13px] font-medium">
            {f.stage === 'beta' ? 'Pilot Houses' : 'Test Houses'} ({f.testers.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {f.testers.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-azure-50 py-1 pr-1.5 pl-3 text-[13px] text-azure-800"
              >
                {nameOf(id)}
                <button
                  type="button"
                  onClick={() => tester.mutate({ id, on: false })}
                  className="rounded-full p-0.5 hover:bg-azure-100"
                  aria-label={`Remove ${nameOf(id)}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Select
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              aria-label="Add a House"
              className="w-60"
            >
              <option value="">Add a House…</option>
              {houses
                .filter((h) => !f.testers.includes(h.id))
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
            </Select>
            <button
              type="button"
              disabled={!adding}
              onClick={() => tester.mutate({ id: adding, on: true })}
              className="inline-flex items-center gap-1 text-sm font-medium text-azure-700 disabled:opacity-40"
            >
              <Plus className="size-4" /> Add
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-ink-muted">
          Available to Houses whose plan includes it. Change that in Plans & features.
        </p>
      )}
    </Card>
  );
}
