import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card, PageHeader } from '@stayvinci/ui';
import { relative } from '@stayvinci/demo-data/format';
import type { TenantStatus } from '@stayvinci/demo-data/types';
import { api } from '../../mock/api';
import { ErrorState, PageSkeleton } from '../../components/common';
import { PLAN_LABEL, TENANT_STATUS } from '../../lib/labels';

const COLUMNS: TenantStatus[] = ['draft', 'onboarding', 'verification', 'setup', 'live'];

/** Onboarding pipeline (spec §13): invited → setting up → verification → ready → live. */
export function OnboardingPage() {
  const q = useQuery({ queryKey: ['tenants'], queryFn: api.tenants.list });
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const recentLive = Date.now() - 45 * 86400000;

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Where every new House is on the way to taking bookings. Live shows the last 45 days."
      />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const items = q.data.filter(
            (t) =>
              t.status === col &&
              (col !== 'live' || (t.liveAt !== null && new Date(t.liveAt).getTime() > recentLive)),
          );
          return (
            <div key={col} className="w-72 shrink-0">
              <div className="mb-3 flex items-center justify-between px-1">
                <Badge tone={TENANT_STATUS[col].tone} dot>
                  {TENANT_STATUS[col].label}
                </Badge>
                <span className="text-sm text-ink-muted tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((t) => (
                  <Link key={t.id} to={`/houses/${t.id}`} className="block">
                    <Card className="p-4 transition-shadow hover:shadow-card-hover">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-[13px] text-ink-muted">
                        {PLAN_LABEL[t.plan]} · {t.area}
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-stone-100">
                        <div
                          className="h-1.5 rounded-full bg-gold-400"
                          style={{ width: `${(t.checklist.done / t.checklist.total) * 100}%` }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-xs text-ink-subtle">
                        <span>
                          Setup {t.checklist.done}/{t.checklist.total}
                        </span>
                        <span>{t.onboardingManager ?? 'Self-serve'}</span>
                      </div>
                      <div className="mt-1 text-xs text-ink-subtle">
                        Joined {relative(t.joinedAt)}
                      </div>
                    </Card>
                  </Link>
                ))}
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-[13px] text-ink-subtle">
                    None
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
