import { useQuery } from '@tanstack/react-query';
import { Check, Lock, Minus } from 'lucide-react';
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th, Tr, cn } from '@stayvinci/ui';
import type { FeatureKey, PlanId } from '@stayvinci/demo-data/platform';
import { api } from '../../mock/api';
import { ErrorState, PageSkeleton } from '../../components/common';
import { STAGE } from '../../lib/labels';
import { useAction } from '../../lib/query';
import { useCan } from '../../app/session';

/**
 * Which features each plan includes (entitlements). Changes apply to every House
 * on that plan immediately; per-House exceptions live on the House page.
 */
export function PlansPage() {
  const can = useCan();
  const editable = can('plan.manage');
  const q = useQuery({ queryKey: ['plans'], queryFn: api.plans.list });
  const toggle = useAction(
    ({ plan, feature }: { plan: PlanId; feature: FeatureKey }) =>
      api.plans.toggleFeature(plan, feature),
    { success: (p) => `${p.name} updated` },
  );
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const { plans, features, counts } = q.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans & features"
        description={
          editable
            ? 'Tick a box to add a feature to a plan. Every House on that plan gets it straight away.'
            : 'What each plan includes. Only a Super admin can change plans.'
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{p.name}</div>
              <Badge>{counts[p.id]} Houses</Badge>
            </div>
            <div className="mt-1 text-[13px] text-ink-muted">{p.audience}</div>
            <div className="mt-4 text-sm">
              <span className="font-medium">{p.features.length}</span>{' '}
              <span className="text-ink-muted">features · price not set yet</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="What's in each plan"
          description="Core features are on for everyone. Beta and internal features reach only their testers until released."
        />
        <Table>
          <thead>
            <tr>
              <Th>Feature</Th>
              <Th>Release</Th>
              {plans.map((p) => (
                <Th key={p.id} className="text-center">
                  {p.name}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <Tr key={f.key}>
                <Td>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-ink-subtle">{f.description}</div>
                </Td>
                <Td>
                  {f.core ? (
                    <Badge tone="dark">Core</Badge>
                  ) : (
                    <Badge tone={STAGE[f.stage].tone}>{STAGE[f.stage].label}</Badge>
                  )}
                </Td>
                {plans.map((p) => {
                  const on = p.features.includes(f.key);
                  return (
                    <Td key={p.id} className="text-center">
                      {f.core ? (
                        <Lock
                          className="mx-auto size-4 text-ink-subtle"
                          aria-label="Always included"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={!editable || toggle.isPending}
                          onClick={() => toggle.mutate({ plan: p.id, feature: f.key })}
                          aria-label={`${on ? 'Remove' : 'Add'} ${f.name} ${on ? 'from' : 'to'} ${p.name}`}
                          aria-pressed={on}
                          className={cn(
                            'mx-auto flex size-7 items-center justify-center rounded-lg border transition-colors',
                            on
                              ? 'border-emerald-700 bg-emerald-900 text-gold-300'
                              : 'border-line-strong bg-surface text-ink-subtle',
                            editable ? 'hover:border-azure-500' : 'cursor-default',
                          )}
                        >
                          {on ? <Check className="size-4" /> : <Minus className="size-3.5" />}
                        </button>
                      )}
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
