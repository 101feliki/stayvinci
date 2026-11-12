// Time zone helpers without a library (spec rule 8: UTC in storage, IANA zone for slots).

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: (parts.weekday ?? 'Mon').slice(0, 3).toLowerCase(),
  };
}

/** Offset of a time zone from UTC at an instant, in milliseconds. */
function offsetMs(instant: number, timeZone: string) {
  const p = zonedParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The UTC instant of a local date ("2026-11-12") and time ("09:30") in a time zone. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(guess, timeZone);
  // Second pass settles daylight-saving edges.
  return new Date(guess - offsetMs(first, timeZone));
}

/** Weekday key ("mon".."sun") of a local date. */
export function weekdayOf(date: string): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ] as 'mon';
}

/** Local date ("YYYY-MM-DD") of an instant in a time zone. */
export function localDate(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export const addMinutes = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

/** Postgres tstzrange literal, half-open. */
export const range = (from: Date, to: Date) => `[${from.toISOString()},${to.toISOString()})`;

/** Parses a tstzrange text value back into its bounds. */
export function parseRange(r: string): [Date, Date] {
  const m = /^[[(]"?([^",]+)"?,"?([^")]+)"?[\])]$/.exec(r.trim());
  if (!m) throw new Error('Unreadable time range');
  return [new Date(m[1] as string), new Date(m[2] as string)];
}
