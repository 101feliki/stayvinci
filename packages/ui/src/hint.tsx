import { useState, type ReactNode } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { cn } from './cn';

const KEY = 'sv.hints.dismissed';

function dismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Brings back every hint the person has closed. */
export function resetHints() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * A short, friendly setup tip at the top of a page. Closing it remembers the choice
 * per page; "Show tips again" in settings brings them all back.
 */
export function PageHint({
  id,
  title,
  children,
  action,
  className,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const [hidden, setHidden] = useState(() => dismissed().includes(id));
  if (hidden) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...new Set([...dismissed(), id])]));
    } catch {
      // ignore
    }
    setHidden(true);
  };
  return (
    <div
      className={cn(
        'mb-5 flex items-start gap-3 rounded-2xl border border-azure-200 bg-azure-50/70 px-4 py-3 text-sm dark:border-azure-500/25 dark:bg-azure-500/10',
        className,
      )}
      role="note"
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-azure-500 text-white">
        <Lightbulb className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[13px] text-ink-muted">{children}</div>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      <button
        type="button"
        onClick={close}
        className="rounded-lg p-1 text-ink-subtle hover:bg-black/5 hover:text-ink dark:hover:bg-white/10"
        aria-label="Hide this tip"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
