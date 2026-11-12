// Opaque cursors for keyset pagination (spec §20): stable under inserts, no OFFSET scans.

export interface Cursor {
  t: string;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

/** Malformed cursors are ignored (first page) rather than echoed back in an error. */
export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (
      typeof v.t === 'string' &&
      !Number.isNaN(Date.parse(v.t)) &&
      typeof v.id === 'string' &&
      /^[0-9a-f-]{36}$/i.test(v.id)
    )
      return { t: v.t, id: v.id };
  } catch {
    // fall through
  }
  return null;
}
