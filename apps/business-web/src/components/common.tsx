import type { ReactNode } from 'react';
import { AlertTriangle, EyeOff } from 'lucide-react';
import { Badge, Card, Skeleton, cn } from '@stayvinci/ui';
import type { BookingState, ItemVisibility } from '../mock/types';
import { BOOKING_STATE, VISIBILITY } from '../lib/states';

export function StateBadge({ state }: { state: BookingState }) {
  const s = BOOKING_STATE[state];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function VisibilityBadge({ value }: { value: ItemVisibility }) {
  const v = VISIBILITY[value];
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Card className="space-y-3 p-5">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </Card>
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <Card className="flex items-start gap-3 border-red-200 bg-red-50/50 p-5">
      <AlertTriangle className="mt-0.5 size-5 text-red-700" />
      <div>
        <div className="text-sm font-semibold text-red-800">Couldn't load this</div>
        <div className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    </Card>
  );
}

/** Shown where contact data was omitted by the API (no guest.contact.view). */
export function HiddenContact({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs text-ink-subtle', className)}
      title="Only the owner can see guest contact details"
    >
      <EyeOff className="size-3.5" /> Hidden
    </span>
  );
}

export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium text-ink">{children}</span>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold tracking-wider text-ink-muted uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
