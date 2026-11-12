import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, Skeleton } from '@stayvinci/ui';

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
        <div className="text-sm font-semibold text-red-800">Couldn&apos;t load this</div>
        <div className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    </Card>
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

/** Signed percentage change, e.g. "+18%". */
export function Change({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-ink-subtle">—</span>;
  const text = `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
  return (
    <span className={value >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
      {text}
    </span>
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
