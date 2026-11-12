// Formatting helpers. Money is integer minor units; times are stored in UTC and
// displayed in the tenant's IANA time zone.

export function money(minor: number, currency = 'KES', opts: { compact?: boolean } = {}): string {
  const major = minor / 100;
  if (opts.compact === true && Math.abs(major) >= 10_000) {
    return `${currency} ${new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 }).format(major)}`;
  }
  return `${currency} ${new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(major)}`;
}

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = tz + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...options });
    cache.set(key, f);
  }
  return f;
}

export function time(iso: string, tz: string): string {
  return fmt(tz, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export function date(iso: string, tz: string): string {
  return fmt(tz, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function dayLabel(iso: string, tz: string): string {
  return fmt(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
}

export function dateTime(iso: string, tz: string): string {
  return `${dayLabel(iso, tz)}, ${time(iso, tz)}`;
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(iso: string | Date, tz: string) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = fmt(tz, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  };
}

/** YYYY-MM-DD of an instant in a time zone. */
export function dayKey(iso: string | Date, tz: string): string {
  const p = zonedParts(iso, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Offset (minutes) of a time zone from UTC at a given instant. */
function tzOffsetMin(at: Date, tz: string): number {
  const p = zonedParts(at, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Convert a wall-clock time in a time zone to a UTC ISO string. */
export function zonedToUtc(day: string, hhmm: string, tz: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0));
  const offset = tzOffsetMin(guess, tz);
  return new Date(guess.getTime() - offset * 60000).toISOString();
}

export function addDaysKey(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n));
  return dt.toISOString().slice(0, 10);
}

export function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 3600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3600_000), 'hour');
  return rtf.format(Math.round(diff / 86_400_000), 'day');
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function guestName(
  g: { firstName: string; lastName: string; alias: string | null } | undefined,
): string {
  if (!g) return 'Guest';
  if (g.alias) return g.alias;
  return `${g.firstName} ${g.lastName}`.trim();
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
