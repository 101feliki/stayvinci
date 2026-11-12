// In-browser mock of the Stayvinci API. It mirrors the server rules so the UI is
// built against the right contract:
//  - every call is scoped to the session's current tenant (request context)
//  - capability checks happen here, not only in the UI
//  - guest contact fields are omitted unless the caller has guest.contact.view
//  - privileged actions and money movements write an audit entry
// Swap this module for the generated SDK (packages/sdk) once apps/api exists.
import { effectiveCapabilities } from '../lib/capabilities';
import { addDaysKey, dayKey, guestName, money, zonedToUtc } from '../lib/format';
import { TRANSITIONS } from '../lib/states';
import { createSeed, type Db } from './seed';
import type {
  AccessCode,
  Booking,
  BookingState,
  Capability,
  Campaign,
  ContentItem,
  Guest,
  ItemVisibility,
  Policies,
  Resource,
  Service,
  SocialNetwork,
  Storefront,
  TeamMember,
  Tenant,
  TenantRole,
  VisibilityMode,
} from './types';

let db: Db = createSeed();

export class ApiError extends Error {
  constructor(
    public code: 'forbidden' | 'not_found' | 'conflict' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

/* ---------- Session / request context ---------- */

interface Session {
  signedIn: boolean;
  personName: string;
  tenantId: string;
  viewAs: TenantRole | null; // demo-only: preview the app as another role
  /** Stayvinci staff member managing this House from the console (full owner control). */
  assistBy: string | null;
}

const SESSION_KEY = 'sv.business.session';
const ASSIST_KEY = 'sv.business.assist';

function loadSession(): Session {
  const fallback: Session = {
    signedIn: false,
    personName: 'Amani Mwangi',
    tenantId: 't_serenity',
    viewAs: null,
    assistBy: null,
  };
  // Assist mode, opened from the console's "Manage store". Kept for this browser tab only.
  // In production this is a short-lived platform token checked by the API, not a URL flag.
  const p = new URLSearchParams(window.location.search);
  const assistTenant = p.get('assist');
  const assistBy = p.get('by');
  if (assistTenant && assistBy) {
    const assist: Session = { ...fallback, signedIn: true, tenantId: assistTenant, assistBy };
    try {
      sessionStorage.setItem(ASSIST_KEY, JSON.stringify(assist));
    } catch {
      // ignore
    }
    return assist;
  }
  try {
    const raw = sessionStorage.getItem(ASSIST_KEY);
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<Session>) };
  } catch {
    // ignore
  }
  // Dev-only shortcut for screenshots and demos: ?demo=1 skips sign-in, ?tenant=t_karibu picks the House.
  if (import.meta.env.DEV) {
    if (p.get('demo') === '1')
      return { ...fallback, signedIn: true, tenantId: p.get('tenant') ?? fallback.tenantId };
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<Session>) };
  } catch {
    // storage unavailable (private mode): fall back to defaults
  }
  return fallback;
}

let session: Session = loadSession();
if (session.assistBy) {
  // First load of an assist session: record it in the House's own activity log.
  setTimeout(
    () => audit('assist.started', 'Session', 'Stayvinci support opened this House to help'),
    0,
  );
}

function saveSession() {
  if (session.assistBy) return; // assist sessions never replace the House's own sign-in
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

function member(): TeamMember {
  if (session.assistBy)
    return {
      id: 'stayvinci_support',
      tenantId: session.tenantId,
      name: `Stayvinci support (${session.assistBy})`,
      email: 'support@stayvinci.com',
      role: 'owner',
      added: [],
      removed: [],
      status: 'active',
      twoFactor: true,
      lastActive: new Date().toISOString(),
      staffId: null,
    };
  const m = db.team.find((t) => t.tenantId === session.tenantId && t.name === session.personName);
  if (!m) throw new ApiError('forbidden', 'No membership in this House');
  return session.viewAs ? { ...m, role: session.viewAs, added: [], removed: [] } : m;
}

function caps(): Set<Capability> {
  return effectiveCapabilities(member());
}

function need(cap: Capability) {
  if (!caps().has(cap))
    throw new ApiError('forbidden', `You need the "${cap}" permission for this.`);
}

/** Name recorded on events and messages; assist sessions show as Stayvinci support. */
function actorName(): string {
  return session.assistBy ? `Stayvinci support (${session.assistBy})` : session.personName;
}

function tid(): string {
  return session.tenantId;
}

function tenant(): Tenant {
  const t = db.tenants.find((x) => x.id === tid());
  if (!t) throw new ApiError('not_found', 'House not found');
  return t;
}

function audit(action: string, target: string, detail: string) {
  db.audit.unshift({
    id: `au_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    tenantId: tid(),
    at: new Date().toISOString(),
    actor: session.assistBy
      ? `Stayvinci support (${session.assistBy})`
      : session.viewAs
        ? `${session.personName} (as ${session.viewAs})`
        : session.personName,
    action,
    target,
    detail,
  });
}

/** Simulated network: latency + a deep copy so callers never mutate the store. */
function respond<T>(fn: () => T, ms = 180): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(
      () => {
        try {
          resolve(structuredClone(fn()));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
      ms + Math.random() * 120,
    );
  });
}

/** Field-level omission of guest contact data (spec §1, CLAUDE.md rule 5). */
function shapeGuest(g: Guest): Guest {
  if (caps().has('guest.contact.view')) return g;
  const { phone: _p, email: _e, ...rest } = g;
  return rest;
}

function mine<T extends { tenantId: string }>(rows: T[]): T[] {
  return rows.filter((r) => r.tenantId === tid());
}

function findMine<T extends { tenantId: string; id: string }>(
  rows: T[],
  id: string,
  what: string,
): T {
  const row = rows.find((r) => r.id === id && r.tenantId === tid());
  if (!row) throw new ApiError('not_found', `${what} not found`);
  return row;
}

function overlaps(aS: string, aE: string, bS: string, bE: string) {
  return aS < bE && bS < aE;
}

const BLOCKING: BookingState[] = [
  'held',
  'pending_payment',
  'requested',
  'confirmed',
  'checked_in',
];

function assertFree(
  resourceIds: (string | null)[],
  start: string,
  end: string,
  ignoreBookingId?: string,
) {
  for (const rid of resourceIds) {
    if (!rid) continue;
    const clash = mine(db.bookings).find(
      (b) =>
        b.id !== ignoreBookingId &&
        BLOCKING.includes(b.state) &&
        (b.staffId === rid || b.roomId === rid || b.unitId === rid) &&
        overlaps(b.start, b.end, start, end),
    );
    if (clash) {
      const res = db.resources.find((r) => r.id === rid);
      throw new ApiError(
        'conflict',
        `${res?.name ?? 'Resource'} is already booked at that time (${clash.ref}).`,
      );
    }
    const block = mine(db.blocks).find(
      (b) => b.resourceId === rid && overlaps(b.start, b.end, start, end),
    );
    if (block) {
      const res = db.resources.find((r) => r.id === rid);
      throw new ApiError(
        'conflict',
        `${res?.name ?? 'Resource'} is blocked at that time (${block.reason}).`,
      );
    }
  }
}

/* ===================================================================== */

export const api = {
  /* ---------- session ---------- */
  session: {
    get: () =>
      respond(() => {
        const memberships = db.team
          .filter((t) => t.name === session.personName && t.status === 'active')
          .map((m) => {
            const t = db.tenants.find((x) => x.id === m.tenantId);
            return {
              tenantId: m.tenantId,
              tenantName: t?.name ?? '',
              vertical: t?.vertical ?? 'spa',
              role: m.role,
            };
          });
        if (!session.signedIn) return { signedIn: false as const, memberships };
        const me = member();
        return {
          signedIn: true as const,
          personName: session.assistBy ?? session.personName,
          assistBy: session.assistBy,
          tenant: tenant(),
          role: me.role,
          viewAs: session.viewAs,
          capabilities: [...effectiveCapabilities(me)],
          memberships: session.assistBy
            ? [
                {
                  tenantId: tid(),
                  tenantName: tenant().name,
                  vertical: tenant().vertical,
                  role: 'owner' as TenantRole,
                },
              ]
            : memberships,
        };
      }, 60),
    signIn: (phone: string, otp: string, totp: string) =>
      respond(() => {
        if (
          !/^\+?254\s?7\d{2}\s?\d{3}\s?\d{3}$/.test(phone.replace(/\s+/g, ' ').trim()) &&
          phone.replace(/\D/g, '').length < 9
        )
          throw new ApiError('invalid', 'Enter a valid Kenyan mobile number.');
        if (!/^\d{6}$/.test(otp))
          throw new ApiError('invalid', 'Enter the 6-digit code we sent by SMS.');
        if (!/^\d{6}$/.test(totp))
          throw new ApiError('invalid', 'Enter the 6-digit code from your authenticator app.');
        session = { ...session, signedIn: true };
        saveSession();
        audit('session.signed_in', 'Session', '2FA verified');
        return true;
      }, 500),
    signOut: () =>
      respond(() => {
        if (session.assistBy) {
          audit('assist.ended', 'Session', 'Stayvinci support finished managing this House');
          try {
            sessionStorage.removeItem(ASSIST_KEY);
          } catch {
            // ignore
          }
          session = { ...session, signedIn: false, viewAs: null, assistBy: null };
          return true;
        }
        session = { ...session, signedIn: false, viewAs: null };
        saveSession();
        return true;
      }, 100),
    switchTenant: (tenantId: string) =>
      respond(() => {
        if (session.assistBy)
          throw new ApiError(
            'forbidden',
            'Assist mode is for one House. Open another from the console.',
          );
        if (!db.team.some((t) => t.tenantId === tenantId && t.name === session.personName))
          throw new ApiError('forbidden', 'You are not a member of that House');
        session = { ...session, tenantId, viewAs: null };
        saveSession();
        return true;
      }, 120),
    setViewAs: (role: TenantRole | null) =>
      respond(() => {
        session = { ...session, viewAs: role };
        saveSession();
        return true;
      }, 60),
    resetDemo: () =>
      respond(() => {
        db = createSeed();
        return true;
      }),
  },

  /* ---------- today / alerts / setup ---------- */
  alerts: () =>
    respond(() => {
      const out: {
        id: string;
        tone: 'amber' | 'red' | 'azure';
        title: string;
        body: string;
        to: string;
      }[] = [];
      const c = caps();
      for (const p of mine(db.providers)) {
        if (p.state === 'failing')
          out.push({
            id: `al_${p.id}`,
            tone: 'red',
            title: `${p.label} is failing`,
            body: 'Guests cannot pay with it. Reconnect it in Payments.',
            to: '/payments',
          });
        if (p.state === 'testing')
          out.push({
            id: `al_t_${p.id}`,
            tone: 'amber',
            title: `${p.label} is waiting for its test payment`,
            body: 'Send a small test payment to verify the connection.',
            to: '/payments',
          });
      }
      const req = mine(db.bookings).filter((b) => b.state === 'requested').length;
      if (req && c.has('booking.approve'))
        out.push({
          id: 'al_req',
          tone: 'azure',
          title: `${req} booking request${req > 1 ? 's' : ''} waiting`,
          body: 'Requests are declined and refunded automatically when their window ends.',
          to: '/requests',
        });
      const un = mine(db.unmatched).length;
      if (un && c.has('payment.view'))
        out.push({
          id: 'al_un',
          tone: 'amber',
          title: `${un} unmatched payment${un > 1 ? 's' : ''}`,
          body: 'Payments received without a booking reference. Attach them to a booking.',
          to: '/payments?tab=unmatched',
        });
      const low = mine(db.products).filter(
        (p) => p.stock <= p.lowStockAt && p.visibility !== 'hidden',
      ).length;
      if (low && c.has('catalogue.edit'))
        out.push({
          id: 'al_stock',
          tone: 'amber',
          title: `${low} product${low > 1 ? 's' : ''} low on stock`,
          body: 'Restock or hide them from the store.',
          to: '/catalogue?tab=products',
        });
      const t = tenant();
      if (t.vertical === 'short_stay') {
        const missing = mine(db.resources).filter((r) => r.type === 'unit' && !r.traLicence).length;
        if (missing && c.has('compliance.view'))
          out.push({
            id: 'al_tra',
            tone: 'red',
            title: `${missing} unit without a TRA licence`,
            body: 'Add the licence before the unit can be listed.',
            to: '/compliance',
          });
      }
      return out;
    }),

  setup: () =>
    respond(() => {
      const t = tenant();
      const providers = mine(db.providers);
      const items = [
        {
          key: 'profile',
          label: 'Business profile',
          done: Boolean(t.description),
          to: '/settings',
        },
        {
          key: 'location',
          label: 'At least one location',
          done: mine(db.locations).length > 0,
          to: '/settings?tab=locations',
        },
        {
          key: 'offering',
          label: 'At least one bookable offering',
          done: mine(db.services).length > 0 || mine(db.ratePlans).length > 0,
          to: '/catalogue',
        },
        {
          key: 'resource',
          label: 'A resource with availability',
          done: mine(db.resources).length > 0,
          to: '/team?tab=resources',
        },
        {
          key: 'payment',
          label: 'A verified payment provider',
          done: providers.some((p) => p.state === 'verified'),
          to: '/payments',
        },
        {
          key: 'policy',
          label: 'Cancellation policy',
          done: Boolean(db.policies[t.id]),
          to: '/policies',
        },
        {
          key: 'verification',
          label: 'Verification approved',
          done: t.verification === 'approved',
          to: '/settings',
        },
      ];
      return { status: t.status, items };
    }),

  /* ---------- bookings ---------- */
  bookings: {
    list: () =>
      respond(() => {
        need('booking.view');
        const me = member();
        let rows = mine(db.bookings);
        // Practitioners see only their own bookings (spec §1).
        if (me.role === 'practitioner')
          rows = rows.filter((b) => b.staffId === (me.staffId ?? 'st_1'));
        return rows;
      }),
    get: (id: string) =>
      respond(() => {
        need('booking.view');
        const b = findMine(db.bookings, id, 'Booking');
        const g = db.guests.find((x) => x.id === b.guestId);
        return {
          booking: b,
          guest: g ? shapeGuest(g) : null,
          payments: caps().has('payment.view')
            ? mine(db.payments).filter((p) => p.bookingId === b.id)
            : [],
        };
      }),
    transition: (id: string, to: BookingState, reason?: string) =>
      respond(() => {
        const b = findMine(db.bookings, id, 'Booking');
        const allowed = TRANSITIONS[b.state] ?? [];
        if (!allowed.includes(to))
          throw new ApiError('invalid', `Cannot move a ${b.state} booking to ${to}.`);
        if (b.state === 'requested') need('booking.approve');
        else need('booking.edit');
        const from = b.state;
        b.state = to;
        const labels: Partial<Record<BookingState, string>> = {
          confirmed: from === 'requested' ? 'Request approved' : 'Payment confirmed manually',
          checked_in: 'Checked in',
          completed: 'Completed',
          no_show: 'Marked no-show, deposit kept per policy',
          cancelled_by_tenant:
            from === 'requested'
              ? 'Request declined, refund issued'
              : 'Cancelled by you, full refund issued',
        };
        b.events.push({
          at: new Date().toISOString(),
          label: `${labels[to] ?? to}${reason ? `: ${reason}` : ''}`,
          actor: actorName(),
        });
        if (to === 'cancelled_by_tenant' && b.paid > 0) {
          for (const p of mine(db.payments).filter(
            (x) => x.bookingId === b.id && x.status === 'succeeded',
          )) {
            p.refunded = p.amount;
            p.status = 'refunded';
          }
          audit('payment.refunded', b.ref, `Full refund ${money(b.paid)} (tenant cancellation)`);
        }
        if (to === 'completed') {
          const g = db.guests.find((x) => x.id === b.guestId);
          if (g) {
            g.visits += 1;
            g.spend += b.total;
            g.lastVisit = b.start;
          }
          b.paid = b.total;
        }
        audit(`booking.${to}`, b.ref, `${from} → ${to}`);
        return b;
      }),
    reschedule: (id: string, start: string, resourceId?: string) =>
      respond(() => {
        need('booking.edit');
        const b = findMine(db.bookings, id, 'Booking');
        if (!BLOCKING.includes(b.state))
          throw new ApiError('invalid', 'Only upcoming bookings can be moved.');
        const dur = new Date(b.end).getTime() - new Date(b.start).getTime();
        const end = new Date(new Date(start).getTime() + dur).toISOString();
        const staffId = resourceId ?? b.staffId;
        assertFree([staffId, b.roomId, b.unitId], start, end, b.id);
        const before = b.start;
        b.start = start;
        b.end = end;
        b.staffId = staffId;
        b.events.push({
          at: new Date().toISOString(),
          label: 'Rescheduled',
          actor: actorName(),
        });
        audit('booking.rescheduled', b.ref, `${before} → ${start}`);
        return b;
      }),
    create: (input: {
      guestId: string | null;
      newGuest: { firstName: string; lastName: string; phone: string } | null;
      serviceId: string;
      variantId: string;
      staffId: string;
      start: string;
      payment: 'stk' | 'cash' | 'card_link' | 'none';
      notes: string;
      idempotencyKey: string;
    }) =>
      respond(() => {
        need('booking.create');
        const dupe = mine(db.bookings).find((b) =>
          b.events.some((e) => e.label === `idem:${input.idempotencyKey}`),
        );
        if (dupe) return dupe; // idempotent replay
        const s = findMine(db.services, input.serviceId, 'Service');
        const v = s.variants.find((x) => x.id === input.variantId);
        if (!v) throw new ApiError('invalid', 'Choose a variant');
        let guestId = input.guestId;
        if (!guestId) {
          if (!input.newGuest?.firstName)
            throw new ApiError('invalid', 'Choose a guest or add a new one');
          const g: Guest = {
            id: `g_new_${Date.now()}`,
            tenantId: tid(),
            firstName: input.newGuest.firstName,
            lastName: input.newGuest.lastName,
            alias: null,
            phone: input.newGuest.phone,
            attribution: 'own_channel',
            attributionDetail: 'Created by front desk',
            admittedAt: new Date().toISOString(),
            visits: 0,
            spend: 0,
            lastVisit: null,
            notes: '',
            preferences: [],
            tags: [],
            membershipTierId: null,
            packageCredits: 0,
            imported: false,
          };
          db.guests.push(g);
          guestId = g.id;
        }
        const guest = db.guests.find((x) => x.id === guestId && x.tenantId === tid());
        if (!guest) throw new ApiError('not_found', 'Guest not found');
        const end = new Date(
          new Date(input.start).getTime() + v.durationMin * 60_000,
        ).toISOString();
        const room = mine(db.resources).find(
          (r) =>
            r.type === 'room' &&
            !mine(db.bookings).some(
              (b) =>
                BLOCKING.includes(b.state) &&
                b.roomId === r.id &&
                overlaps(b.start, b.end, input.start, end),
            ),
        );
        assertFree([input.staffId, room?.id ?? null], input.start, end);
        const t = tenant();
        const pol = db.policies[t.id];
        const deposit =
          pol?.paymentAtBooking === 'percent_deposit'
            ? Math.round((v.price * (pol.depositValue ?? 0)) / 100)
            : pol?.paymentAtBooking === 'full'
              ? v.price
              : 0;
        const now = new Date().toISOString();
        const b: Booking = {
          id: `bk_${Date.now()}`,
          ref: `SV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          tenantId: tid(),
          guestId,
          serviceId: s.id,
          variantId: v.id,
          staffId: input.staffId,
          roomId: room?.id ?? null,
          unitId: null,
          start: input.start,
          end,
          guests: 1,
          state:
            input.payment === 'stk' || input.payment === 'card_link'
              ? 'pending_payment'
              : 'confirmed',
          total: v.price,
          paid: input.payment === 'cash' ? v.price : 0,
          deposit,
          attribution: guest.attribution,
          channel: 'front_desk',
          notes: input.notes,
          createdAt: now,
          requestExpiresAt: null,
          events: [
            { at: now, label: 'Created by front desk', actor: actorName() },
            { at: now, label: `idem:${input.idempotencyKey}`, actor: 'system' },
          ],
        };
        if (input.payment === 'cash') {
          db.payments.push({
            id: `pay_${Date.now()}`,
            tenantId: tid(),
            bookingId: b.id,
            guestId,
            provider: 'cash',
            purpose: 'balance',
            amount: v.price,
            refunded: 0,
            status: 'succeeded',
            providerRef: 'CASH',
            at: now,
            reconciled: false,
          });
          b.events.push({
            at: now,
            label: `Cash ${money(v.price)} recorded`,
            actor: actorName(),
          });
          audit('payment.cash_recorded', b.ref, money(v.price));
        }
        if (input.payment === 'stk') {
          db.payments.push({
            id: `pay_${Date.now()}`,
            tenantId: tid(),
            bookingId: b.id,
            guestId,
            provider: 'mpesa',
            purpose: 'deposit',
            amount: deposit || v.price,
            refunded: 0,
            status: 'pending',
            providerRef: '—',
            at: now,
            reconciled: false,
          });
          b.events.push({
            at: now,
            label: `M-Pesa request sent for ${money(deposit || v.price)}`,
            actor: 'System',
          });
        }
        db.bookings.push(b);
        audit('booking.created', b.ref, `${s.name} for ${guestName(guest)}`);
        return b;
      }, 400),
    /** Simulate the M-Pesa callback arriving for a pending booking. */
    simulateCallback: (bookingId: string, success: boolean) =>
      respond(() => {
        const b = findMine(db.bookings, bookingId, 'Booking');
        const p = mine(db.payments).find((x) => x.bookingId === b.id && x.status === 'pending');
        if (!p) throw new ApiError('invalid', 'No pending payment');
        if (success) {
          p.status = 'succeeded';
          p.providerRef = `S${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
          b.paid += p.amount;
          b.state = 'confirmed';
          b.events.push(
            {
              at: new Date().toISOString(),
              label: `M-Pesa payment received (${p.providerRef})`,
              actor: 'M-Pesa',
            },
            { at: new Date().toISOString(), label: 'Confirmed', actor: 'System' },
          );
          audit('payment.succeeded', b.ref, `${money(p.amount)} via M-Pesa`);
        } else {
          p.status = 'failed';
          b.events.push({
            at: new Date().toISOString(),
            label: 'M-Pesa request cancelled by guest',
            actor: 'M-Pesa',
          });
        }
        return b;
      }, 300),
    slots: (serviceId: string, variantId: string, staffId: string, day: string) =>
      respond(() => {
        const t = tenant();
        const s = findMine(db.services, serviceId, 'Service');
        const v = s.variants.find((x) => x.id === variantId);
        if (!v) return [];
        const out: { start: string; label: string; free: boolean }[] = [];
        const nowIso = new Date().toISOString();
        for (let m = 9 * 60; m + v.durationMin <= 20 * 60; m += 15) {
          const label = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          const start = zonedToUtc(day, label, t.timezone);
          const end = new Date(
            new Date(start).getTime() + (v.durationMin + s.bufferAfterMin) * 60_000,
          ).toISOString();
          const busy =
            start < nowIso ||
            mine(db.bookings).some(
              (b) =>
                BLOCKING.includes(b.state) &&
                b.staffId === staffId &&
                overlaps(b.start, b.end, start, end),
            ) ||
            mine(db.blocks).some(
              (b) => b.resourceId === staffId && overlaps(b.start, b.end, start, end),
            );
          out.push({ start, label, free: !busy });
        }
        return out;
      }, 120),
  },

  /* ---------- guests ---------- */
  guests: {
    list: () =>
      respond(() => {
        need('guest.view');
        return mine(db.guests).map(shapeGuest);
      }),
    get: (id: string) =>
      respond(() => {
        need('guest.view');
        const g = findMine(db.guests, id, 'Guest');
        return {
          guest: shapeGuest(g),
          bookings: mine(db.bookings)
            .filter((b) => b.guestId === id)
            .sort((a, b) => b.start.localeCompare(a.start)),
        };
      }),
    update: (id: string, patch: Partial<Pick<Guest, 'notes' | 'tags' | 'preferences'>>) =>
      respond(() => {
        need('guest.view');
        const g = findMine(db.guests, id, 'Guest');
        Object.assign(g, patch);
        return shapeGuest(g);
      }),
    import: (rows: { firstName: string; lastName: string; phone: string }[]) =>
      respond(() => {
        need('guest.import');
        for (const r of rows) {
          db.guests.push({
            id: `g_imp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
            tenantId: tid(),
            firstName: r.firstName,
            lastName: r.lastName,
            alias: null,
            phone: r.phone,
            attribution: 'own_channel',
            attributionDetail: 'Imported list',
            admittedAt: new Date().toISOString(),
            visits: 0,
            spend: 0,
            lastVisit: null,
            notes: '',
            preferences: [],
            tags: [],
            membershipTierId: null,
            packageCredits: 0,
            imported: true,
          });
        }
        audit(
          'guest.imported',
          'Guests',
          `${rows.length} guests imported (pre-attributed own channel)`,
        );
        return rows.length;
      }, 500),
    remove: (id: string) =>
      respond(() => {
        need('guest.view');
        need('booking.edit');
        const g = findMine(db.guests, id, 'Guest');
        db.guests = db.guests.filter((x) => x.id !== id);
        for (const b of mine(db.bookings).filter(
          (x) => x.guestId === id && BLOCKING.includes(x.state),
        ))
          b.state = 'cancelled_by_tenant';
        audit('guest.removed', guestName(g), 'Access revoked, future bookings cancelled');
        return true;
      }),
  },

  /* ---------- messages ---------- */
  messages: {
    list: () =>
      respond(() => {
        need('message.reply');
        return mine(db.conversations).map((c) => {
          const g = db.guests.find((x) => x.id === c.guestId);
          return { ...c, guest: g ? shapeGuest(g) : null };
        });
      }),
    send: (conversationId: string, body: string) =>
      respond(() => {
        need('message.reply');
        const c = findMine(db.conversations, conversationId, 'Conversation');
        // Discretion: block phone numbers in staff messages unless the House shows contacts.
        if (/(\+?254|0)7\d{8}/.test(body.replace(/\s/g, '')))
          throw new ApiError(
            'invalid',
            'Phone numbers are not shared in chat. Keep the conversation in Stayvinci.',
          );
        c.messages.push({
          id: `m_${Date.now()}`,
          from: 'staff',
          author: actorName(),
          body,
          at: new Date().toISOString(),
        });
        c.unread = 0;
        return c;
      }, 150),
    markRead: (conversationId: string) =>
      respond(() => {
        const c = findMine(db.conversations, conversationId, 'Conversation');
        c.unread = 0;
        return c;
      }, 40),
    assign: (conversationId: string, memberId: string | null) =>
      respond(() => {
        const c = findMine(db.conversations, conversationId, 'Conversation');
        c.assignedTo = memberId;
        return c;
      }),
  },

  /* ---------- catalogue ---------- */
  catalogue: {
    get: () =>
      respond(() => ({
        categories: mine(db.categories),
        services: mine(db.services),
        ratePlans: mine(db.ratePlans),
        addOns: mine(db.addOns),
        packages: mine(db.packages),
        tiers: mine(db.tiers),
        products: mine(db.products),
        giftCards: mine(db.giftCards),
      })),
    saveService: (s: Service) =>
      respond(() => {
        need('catalogue.edit');
        if (!s.name.trim()) throw new ApiError('invalid', 'Give the service a name');
        if (!s.variants.length) throw new ApiError('invalid', 'Add at least one variant');
        const existing = db.services.find((x) => x.id === s.id && x.tenantId === tid());
        if (existing) {
          const priceChanged =
            existing.variants.map((v) => v.price).join() !== s.variants.map((v) => v.price).join();
          Object.assign(existing, s);
          audit(
            priceChanged ? 'catalogue.price_changed' : 'catalogue.service_updated',
            s.name,
            priceChanged ? 'Variant prices updated' : 'Details updated',
          );
          return existing;
        }
        const created = { ...s, id: `sv_${Date.now()}`, tenantId: tid() };
        db.services.push(created);
        audit('catalogue.service_created', s.name, `${s.variants.length} variant(s)`);
        return created;
      }),
    setVisibility: (
      kind:
        | 'services'
        | 'categories'
        | 'addOns'
        | 'packages'
        | 'tiers'
        | 'products'
        | 'giftCards'
        | 'ratePlans',
      id: string,
      visibility: ItemVisibility,
    ) =>
      respond(() => {
        need('catalogue.edit');
        const rows = db[kind] as { id: string; tenantId: string; visibility: ItemVisibility }[];
        const row = findMine(rows, id, 'Item');
        row.visibility = visibility;
        audit('catalogue.visibility_changed', id, visibility);
        return true;
      }, 100),
    bulkPrice: (serviceIds: string[], pctChange: number) =>
      respond(() => {
        need('catalogue.edit');
        for (const s of mine(db.services).filter((x) => serviceIds.includes(x.id))) {
          s.variants = s.variants.map((v) => ({
            ...v,
            price: Math.round((v.price * (100 + pctChange)) / 100 / 1000) * 1000,
          }));
        }
        audit(
          'catalogue.price_changed',
          `${serviceIds.length} services`,
          `Bulk ${pctChange > 0 ? '+' : ''}${pctChange}%`,
        );
        return true;
      }),
    restock: (productId: string, qty: number) =>
      respond(() => {
        need('catalogue.edit');
        const p = findMine(db.products, productId, 'Product');
        p.stock += qty;
        return p;
      }),
  },

  /* ---------- team & resources ---------- */
  team: {
    list: () =>
      respond(() => ({
        members: mine(db.team),
        resources: mine(db.resources),
        locations: mine(db.locations),
      })),
    updateMember: (id: string, patch: Pick<TeamMember, 'role' | 'added' | 'removed'>) =>
      respond(() => {
        need('staff.manage');
        const m = findMine(db.team, id, 'Member');
        if (patch.role !== m.role && (patch.role === 'owner' || m.role === 'owner'))
          need('billing.manage');
        if (
          m.role === 'owner' &&
          patch.role !== 'owner' &&
          mine(db.team).filter((x) => x.role === 'owner').length < 2
        )
          throw new ApiError('invalid', 'A House must always have at least one owner.');
        const before = m.role;
        Object.assign(m, patch);
        audit(
          'member.permissions_changed',
          m.name,
          `${before} → ${patch.role}; +${patch.added.length} / -${patch.removed.length} overrides`,
        );
        return m;
      }),
    invite: (name: string, email: string, role: TenantRole) =>
      respond(() => {
        need('staff.manage');
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError('invalid', 'Enter a valid email');
        const m: TeamMember = {
          id: `tm_${Date.now()}`,
          tenantId: tid(),
          name,
          email,
          role,
          added: [],
          removed: [],
          status: 'invited',
          twoFactor: false,
          lastActive: null,
          staffId: null,
        };
        db.team.push(m);
        audit('member.invited', name, role);
        return m;
      }),
    removeMember: (id: string) =>
      respond(() => {
        need('staff.manage');
        const m = findMine(db.team, id, 'Member');
        if (m.role === 'owner') throw new ApiError('invalid', 'Owners cannot be removed here.');
        db.team = db.team.filter((x) => x.id !== id);
        audit('member.removed', m.name, m.role);
        return true;
      }),
    saveResource: (r: Resource) =>
      respond(() => {
        need('staff.manage');
        const existing = db.resources.find((x) => x.id === r.id && x.tenantId === tid());
        if (existing) Object.assign(existing, r);
        else db.resources.push({ ...r, id: `res_${Date.now()}`, tenantId: tid() });
        audit('resource.saved', r.name, r.type);
        return true;
      }),
    addBlock: (resourceId: string, start: string, end: string, reason: string) =>
      respond(() => {
        need('booking.edit');
        assertFree([resourceId], start, end);
        db.blocks.push({
          id: `blk_${Date.now()}`,
          tenantId: tid(),
          resourceId,
          start,
          end,
          reason,
          source: 'manual',
        });
        return true;
      }),
  },
  blocks: () => respond(() => mine(db.blocks)),

  /* ---------- storefront & content ---------- */
  storefront: {
    get: () =>
      respond(() => {
        const s = db.storefronts.find((x) => x.tenantId === tid());
        if (!s) throw new ApiError('not_found', 'No storefront');
        return s;
      }),
    save: (patch: Partial<Storefront>) =>
      respond(() => {
        need('storefront.edit');
        const s = db.storefronts.find((x) => x.tenantId === tid());
        if (!s) throw new ApiError('not_found', 'No storefront');
        Object.assign(s, patch, { hasDraft: true });
        return s;
      }, 120),
    publish: () =>
      respond(() => {
        need('storefront.edit');
        const s = db.storefronts.find((x) => x.tenantId === tid());
        if (!s) throw new ApiError('not_found', 'No storefront');
        const n = s.versions.length + 1;
        s.versions.forEach((v) => (v.live = false));
        s.versions.unshift({
          id: `v${n}`,
          label: `Version ${n}`,
          at: new Date().toISOString(),
          by: actorName(),
          live: true,
        });
        s.hasDraft = false;
        audit('storefront.published', 'Storefront', `Version ${n} published`);
        return s;
      }, 500),
    /** Social accounts are account-level: connecting applies at once (no draft). */
    connectSocial: (network: SocialNetwork, handle: string) =>
      respond(() => {
        need('storefront.edit');
        const s = db.storefronts.find((x) => x.tenantId === tid());
        if (!s) throw new ApiError('not_found', 'No storefront');
        const clean = handle.trim().replace(/^@/, '');
        if (clean.length < 2) throw new ApiError('invalid', 'Enter your account name.');
        const a = s.socials.find((x) => x.network === network);
        if (!a) throw new ApiError('not_found', 'Unknown network');
        Object.assign(a, {
          handle: clean,
          connected: true,
          connectedAt: new Date().toISOString(),
          followers: network === 'whatsapp' ? null : 800 + Math.floor(Math.random() * 9000),
          showOnStore: true,
          bookButton: network === 'instagram' || network === 'facebook',
        });
        audit('social.connected', network, `@${clean}`);
        return a;
      }, 900),
    updateSocial: (
      network: SocialNetwork,
      patch: { showOnStore?: boolean; bookButton?: boolean },
    ) =>
      respond(() => {
        need('storefront.edit');
        const a = db.storefronts
          .find((x) => x.tenantId === tid())
          ?.socials.find((x) => x.network === network);
        if (!a) throw new ApiError('not_found', 'Unknown network');
        Object.assign(a, patch);
        return a;
      }, 120),
    disconnectSocial: (network: SocialNetwork) =>
      respond(() => {
        need('storefront.edit');
        const a = db.storefronts
          .find((x) => x.tenantId === tid())
          ?.socials.find((x) => x.network === network);
        if (!a) throw new ApiError('not_found', 'Unknown network');
        Object.assign(a, {
          connected: false,
          connectedAt: null,
          followers: null,
          showOnStore: false,
          bookButton: false,
        });
        audit('social.disconnected', network, 'Disconnected');
        return a;
      }, 300),
    rollback: (versionId: string) =>
      respond(() => {
        need('storefront.edit');
        const s = db.storefronts.find((x) => x.tenantId === tid());
        if (!s) throw new ApiError('not_found', 'No storefront');
        s.versions.forEach((v) => (v.live = v.id === versionId));
        audit('storefront.rolled_back', 'Storefront', `Rolled back to ${versionId}`);
        return s;
      }),
  },
  content: {
    list: () => respond(() => mine(db.content)),
    create: (item: Pick<ContentItem, 'title' | 'kind' | 'price' | 'tierIds'>) =>
      respond(() => {
        need('content.edit');
        const c: ContentItem = {
          ...item,
          id: `ct_${Date.now()}`,
          tenantId: tid(),
          durationSec: item.kind === 'video' ? 600 : null,
          items: item.kind === 'gallery' ? 8 : 1,
          views: 0,
          moderation: 'pending',
          visibility: item.tierIds.length ? 'members_only' : 'public',
          createdAt: new Date().toISOString(),
          live: null,
        };
        db.content.push(c);
        audit('content.uploaded', c.title, 'Sent to moderation');
        return c;
      }, 700),
    remove: (id: string) =>
      respond(() => {
        need('content.edit');
        db.content = db.content.filter((c) => !(c.id === id && c.tenantId === tid()));
        return true;
      }),
    /** Schedule a live class, demo or Q&A. Free, members-only or ticketed. */
    scheduleLive: (input: {
      title: string;
      startsAt: string;
      durationMin: number;
      audience: 'public' | 'members' | 'paid';
      price: number | null;
      tierIds: string[];
      capacity: number | null;
      replay: boolean;
      host: string;
    }) =>
      respond(() => {
        need('content.edit');
        if (input.title.trim().length < 3)
          throw new ApiError('invalid', 'Give the session a title.');
        if (input.startsAt < new Date(Date.now() - 5 * 60000).toISOString())
          throw new ApiError('invalid', 'Pick a time in the future.');
        if (input.audience === 'paid' && !input.price)
          throw new ApiError('invalid', 'Set a ticket price, or make it free.');
        const c: ContentItem = {
          id: `ct_live_${Date.now()}`,
          tenantId: tid(),
          title: input.title.trim(),
          kind: 'live',
          durationSec: null,
          items: 1,
          price: input.audience === 'paid' ? input.price : null,
          tierIds: input.audience === 'members' ? input.tierIds : [],
          views: 0,
          // Live sessions are watched in real time; guests can report, and staff can end a stream.
          moderation: 'approved',
          visibility: input.audience === 'members' ? 'members_only' : 'public',
          createdAt: new Date().toISOString(),
          live: {
            startsAt: input.startsAt,
            durationMin: input.durationMin,
            host: input.host,
            capacity: input.capacity,
            status: 'scheduled',
            attending: 0,
            replay: input.replay,
          },
        };
        db.content.push(c);
        audit(
          'live.scheduled',
          c.title,
          `Live session on ${input.startsAt.slice(0, 16).replace('T', ' ')} UTC`,
        );
        return c;
      }, 400),
    setLiveStatus: (id: string, status: 'live' | 'ended') =>
      respond(() => {
        need('content.edit');
        const c = findMine(db.content, id, 'Live session');
        if (!c.live) throw new ApiError('invalid', 'Not a live session');
        c.live.status = status;
        if (status === 'live') c.live.attending = Math.max(c.live.attending, 3);
        audit(
          status === 'live' ? 'live.started' : 'live.ended',
          c.title,
          status === 'live' ? 'Went live' : 'Ended the live session',
        );
        return c;
      }, 300),
  },

  /* ---------- access ---------- */
  access: {
    get: () =>
      respond(() => ({
        visibility: tenant().visibility,
        handle: tenant().handle,
        codes: mine(db.codes),
      })),
    setVisibility: (mode: VisibilityMode) =>
      respond(() => {
        need('access.manage');
        const t = tenant();
        const before = t.visibility;
        t.visibility = mode;
        audit('access.visibility_changed', 'Store', `${before} → ${mode}`);
        return t;
      }),
    createCode: (
      c: Pick<AccessCode, 'code' | 'label' | 'kind' | 'scope' | 'expiresAt' | 'usageLimit'>,
    ) =>
      respond(() => {
        need('access.manage');
        const code = c.code.trim().toUpperCase();
        if (!/^[A-Z0-9-]{4,16}$/.test(code))
          throw new ApiError('invalid', 'Codes are 4–16 letters, numbers or dashes.');
        if (db.codes.some((x) => x.code === code && x.status === 'active'))
          throw new ApiError('conflict', 'That code is already in use.');
        const row: AccessCode = {
          ...c,
          code,
          id: `ac_${Date.now()}`,
          tenantId: tid(),
          uses: 0,
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        db.codes.push(row);
        audit('access_code.created', code, c.label);
        return row;
      }),
    revoke: (id: string) =>
      respond(() => {
        need('access.manage');
        const c = findMine(db.codes, id, 'Code');
        if (c.kind === 'primary')
          throw new ApiError('invalid', 'The primary code cannot be revoked.');
        c.status = 'revoked';
        audit('access_code.revoked', c.code, 'New entries stopped; admitted guests keep access');
        return c;
      }),
  },

  /* ---------- policies ---------- */
  policies: {
    get: () => respond(() => db.policies[tid()] as Policies),
    save: (p: Policies) =>
      respond(() => {
        need('policy.edit');
        db.policies[tid()] = p;
        audit('policy.updated', 'Booking rules', 'Tenant-level rules saved');
        return p;
      }),
  },

  /* ---------- payments ---------- */
  payments: {
    overview: () =>
      respond(() => {
        need('payment.view');
        return {
          providers: mine(db.providers).sort((a, b) => a.order - b.order),
          payments: mine(db.payments).sort((a, b) => b.at.localeCompare(a.at)),
          unmatched: mine(db.unmatched),
          bookings: mine(db.bookings).map((b) => ({
            id: b.id,
            ref: b.ref,
            guestId: b.guestId,
            total: b.total,
            paid: b.paid,
            start: b.start,
            state: b.state,
          })),
          guests: mine(db.guests).map((g) => ({ id: g.id, name: guestName(g) })),
        };
      }),
    testProvider: (id: string) =>
      respond(() => {
        need('payment_account.manage');
        const p = findMine(db.providers, id, 'Provider');
        p.state = 'verified';
        p.lastCallbackAt = new Date().toISOString();
        p.detail = p.detail.replace(' · awaiting test callback', '');
        audit(
          'payment_account.verified',
          p.label,
          'Test transaction confirmed by callback and reversed',
        );
        return p;
      }, 1500),
    reorder: (id: string, dir: -1 | 1) =>
      respond(() => {
        need('payment_account.manage');
        const list = mine(db.providers).sort((a, b) => a.order - b.order);
        const i = list.findIndex((p) => p.id === id);
        const j = i + dir;
        const a = list[i];
        const b = list[j];
        if (a && b) [a.order, b.order] = [b.order, a.order];
        return true;
      }, 80),
    refund: (paymentId: string, amount: number, reason: string) =>
      respond(() => {
        need('payment.refund');
        const p = findMine(db.payments, paymentId, 'Payment');
        if (!reason.trim()) throw new ApiError('invalid', 'A reason is required for refunds.');
        if (amount <= 0 || amount > p.amount - p.refunded)
          throw new ApiError('invalid', 'Refund amount is more than what is left on this payment.');
        p.refunded += amount;
        p.status = p.refunded >= p.amount ? 'refunded' : 'partially_refunded';
        const b = p.bookingId ? db.bookings.find((x) => x.id === p.bookingId) : null;
        if (b)
          b.events.push({
            at: new Date().toISOString(),
            label: `Refund ${money(amount)}: ${reason}`,
            actor: actorName(),
          });
        audit('payment.refunded', b?.ref ?? p.providerRef, `${money(amount)}: ${reason}`);
        return p;
      }, 600),
    attachUnmatched: (unmatchedId: string, bookingId: string) =>
      respond(() => {
        need('payment.view');
        need('booking.edit');
        const u = findMine(db.unmatched, unmatchedId, 'Payment');
        const b = findMine(db.bookings, bookingId, 'Booking');
        db.unmatched = db.unmatched.filter((x) => x.id !== unmatchedId);
        db.payments.push({
          id: `pay_${Date.now()}`,
          tenantId: tid(),
          bookingId: b.id,
          guestId: b.guestId,
          provider: 'mpesa',
          purpose: 'balance',
          amount: u.amount,
          refunded: 0,
          status: 'succeeded',
          providerRef: u.providerRef,
          at: u.at,
          reconciled: true,
        });
        b.paid += u.amount;
        b.events.push({
          at: new Date().toISOString(),
          label: `Unmatched payment ${u.providerRef} attached`,
          actor: actorName(),
        });
        audit('payment.attached', b.ref, `${u.providerRef} ${money(u.amount)}`);
        return true;
      }),
  },

  /* ---------- marketing ---------- */
  marketing: {
    get: () =>
      respond(() => ({
        campaigns: mine(db.campaigns),
        reviews: mine(db.reviews).map((r) => {
          const g = db.guests.find((x) => x.id === r.guestId);
          return {
            ...r,
            guestName: g ? (g.alias ?? `${g.firstName} ${g.lastName.slice(0, 1)}.`) : 'Guest',
          };
        }),
        loyalty: db.loyalty[tid()] ?? {
          referralsOn: false,
          referralReward: 0,
          loyaltyOn: false,
          visitsForReward: 5,
        },
      })),
    createCampaign: (
      c: Pick<Campaign, 'name' | 'segment' | 'channel'> & { schedule: string | null },
    ) =>
      respond(() => {
        need('marketing.manage');
        const audience =
          {
            'All admitted guests': mine(db.guests).length,
            'Guests with 2+ visits': mine(db.guests).filter((g) => g.visits >= 2).length,
            'No visit in 60 days': Math.round(mine(db.guests).length * 0.3),
            Members: mine(db.guests).filter((g) => g.membershipTierId).length,
          }[c.segment] ?? 0;
        const row: Campaign = {
          id: `cp_${Date.now()}`,
          tenantId: tid(),
          name: c.name,
          segment: c.segment,
          channel: c.channel,
          status: c.schedule ? 'scheduled' : 'draft',
          audience,
          sentAt: c.schedule,
          bookings: 0,
        };
        db.campaigns.unshift(row);
        audit('campaign.created', c.name, `${c.channel} to ${audience} guests`);
        return row;
      }),
    reply: (reviewId: string, reply: string) =>
      respond(() => {
        need('review.reply');
        const r = findMine(db.reviews, reviewId, 'Review');
        r.reply = reply;
        return r;
      }),
    saveLoyalty: (l: Db['loyalty'][string]) =>
      respond(() => {
        need('marketing.manage');
        db.loyalty[tid()] = l;
        return l;
      }),
  },

  /* ---------- compliance (short-stay) ---------- */
  compliance: {
    get: () =>
      respond(() => {
        need('compliance.view');
        return {
          units: mine(db.resources).filter((r) => r.type === 'unit'),
          registrations: mine(db.registrations),
          levy: mine(db.levyReports),
        };
      }),
    saveLicence: (unitId: string, licence: string) =>
      respond(() => {
        need('compliance.view');
        const u = findMine(db.resources, unitId, 'Unit');
        u.traLicence = licence;
        audit('compliance.licence_updated', u.name, licence);
        return u;
      }),
  },

  /* ---------- billing ---------- */
  billing: {
    get: () =>
      respond(() => {
        need('billing.manage');
        return {
          invoices: mine(db.invoices),
          feeLines: mine(db.feeLines).map((f) => {
            const g = db.guests.find((x) => x.id === f.guestId);
            const b = db.bookings.find((x) => x.id === f.bookingId);
            return { ...f, guestName: guestName(g), bookingRef: b?.ref ?? '' };
          }),
          attributed: {
            own: mine(db.guests).filter((g) => g.attribution === 'own_channel').length,
            marketplace: mine(db.guests).filter((g) => g.attribution === 'marketplace').length,
          },
        };
      }),
    dispute: (feeId: string, reason: string) =>
      respond(() => {
        need('billing.manage');
        const f = findMine(db.feeLines, feeId, 'Fee line');
        if (!reason.trim())
          throw new ApiError('invalid', 'Tell Finance why you are disputing this fee.');
        f.status = 'disputed';
        audit('fee.disputed', f.id, reason);
        return f;
      }),
  },

  /* ---------- settings ---------- */
  settings: {
    get: () =>
      respond(() => ({
        tenant: tenant(),
        locations: mine(db.locations),
        notifications: db.notificationPrefs[tid()] ?? {},
      })),
    saveTenant: (patch: Partial<Pick<Tenant, 'name' | 'description' | 'tagline' | 'area'>>) =>
      respond(() => {
        need('settings.manage');
        Object.assign(tenant(), patch);
        audit('tenant.profile_updated', 'Business profile', Object.keys(patch).join(', '));
        return tenant();
      }),
    saveNotifications: (prefs: Record<string, boolean>) =>
      respond(() => {
        db.notificationPrefs[tid()] = prefs;
        return prefs;
      }),
    saveLocation: (id: string, patch: Partial<Db['locations'][number]>) =>
      respond(() => {
        need('settings.manage');
        const l = findMine(db.locations, id, 'Location');
        Object.assign(l, patch);
        audit('location.updated', l.name, 'Hours or details changed');
        return l;
      }),
    audit: () =>
      respond(() => {
        need('audit.view');
        return mine(db.audit);
      }),
    exportData: () =>
      respond(() => {
        need('guest.export');
        audit('data.exported', 'Tenant data', 'Full export requested');
        return true;
      }, 800),
  },

  /** Global search across bookings and guests (Ctrl+K). */
  /** Universal search for the top bar: guests, bookings, services, team, codes, memberships. */
  search: (q: string) =>
    respond(() => {
      const query = q.trim().toLowerCase();
      const empty = { guests: [], bookings: [], services: [], team: [], codes: [], tiers: [] };
      if (query.length < 2) return empty;
      const has = (text: string) => query.split(/\s+/).every((w) => text.toLowerCase().includes(w));
      const c = caps();
      const guests = c.has('guest.view')
        ? mine(db.guests)
            .filter((g) => has(`${g.firstName} ${g.lastName} ${g.alias ?? ''}`))
            .slice(0, 5)
            .map((g) => ({ id: g.id, name: guestName(g) }))
        : [];
      const bookings = c.has('booking.view')
        ? mine(db.bookings)
            .filter((b) => has(b.ref))
            .slice(0, 5)
            .map((b) => ({ id: b.id, ref: b.ref, start: b.start }))
        : [];
      const services = mine(db.services)
        .filter((x) => has(`${x.name} ${x.description}`))
        .slice(0, 5)
        .map((x) => ({
          id: x.id,
          name: x.name,
          price: Math.min(...x.variants.map((v) => v.price)),
        }));
      const team =
        c.has('staff.manage') || c.has('booking.view')
          ? mine(db.resources)
              .filter(
                (r) =>
                  r.type === 'staff' &&
                  has(`${r.name} ${r.title ?? ''} ${(r.specialties ?? []).join(' ')}`),
              )
              .slice(0, 4)
              .map((r) => ({ id: r.id, name: r.name, title: r.title ?? '' }))
          : [];
      const codes = c.has('access.manage')
        ? mine(db.codes)
            .filter((x) => has(`${x.code} ${x.label}`))
            .slice(0, 4)
            .map((x) => ({ id: x.id, code: x.code, label: x.label }))
        : [];
      const tiers = mine(db.tiers)
        .filter((x) => has(x.name))
        .slice(0, 3)
        .map((x) => ({ id: x.id, name: x.name }));
      return { guests, bookings, services, team, codes, tiers };
    }, 80),
};

export type Api = typeof api;
export type SessionInfo = Awaited<ReturnType<typeof api.session.get>>;

/** Day keys helper for UI date pickers (tenant time zone). */
export function todayKey(tz: string): string {
  return dayKey(new Date(), tz);
}
export { addDaysKey };
