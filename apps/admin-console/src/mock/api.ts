// In-browser mock of the platform (console) API. Mirrors the server rules:
//  - every call checks the signed-in staff member's role capabilities
//  - every write adds a platform audit entry; changes made inside a House are
//    also visible to that House as "Stayvinci" in its own activity log
//  - transactions carry pseudonymous guest references only, never names or phones
// Replace with the generated SDK (packages/sdk) once apps/api exists.
import {
  PLATFORM_ROLE_CAPS,
  createPlatformSeed,
  effectiveFeatures,
  type AdCampaign,
  type AdChannel,
  type FeatureKey,
  type FeatureStage,
  type PayMethod,
  type PayMode,
  type PlanId,
  type PlatformCapability,
  type PlatformDb,
  type PlatformRole,
  type PlatformStaff,
  type PlatformTenant,
  type PlatformTransaction,
} from '@stayvinci/demo-data/platform';
import type { TenantStatus, Vertical } from '@stayvinci/demo-data/types';

let db: PlatformDb = createPlatformSeed();

/** Business app running locally; "Manage store" opens it in assist mode. */
export const BUSINESS_APP_URL = 'http://localhost:5173';

export class ApiError extends Error {
  constructor(
    public code: 'forbidden' | 'not_found' | 'conflict' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

/* ---------- Session ---------- */

interface Session {
  signedIn: boolean;
  staffId: string;
  viewAs: PlatformRole | null; // demo-only: preview the console as another role
}

const SESSION_KEY = 'sv.console.session';

function loadSession(): Session {
  const fallback: Session = { signedIn: false, staffId: 'ps_1', viewAs: null };
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1')
    return { ...fallback, signedIn: true };
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<Session>) };
  } catch {
    // storage unavailable
  }
  return fallback;
}

let session = loadSession();

function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

function me(): PlatformStaff {
  const s = db.staff.find((x) => x.id === session.staffId);
  if (!s) throw new ApiError('forbidden', 'Not a Stayvinci staff account');
  return s;
}

function role(): PlatformRole {
  return session.viewAs ?? me().role;
}

function need(cap: PlatformCapability) {
  if (!PLATFORM_ROLE_CAPS[role()].includes(cap))
    throw new ApiError('forbidden', `Your role can't do this ("${cap}").`);
}

function audit(action: string, tenantId: string | null, detail: string) {
  db.audit.unshift({
    id: `pa_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    at: new Date().toISOString(),
    actor: me().name,
    role: role(),
    action,
    tenantId,
    detail,
  });
}

function respond<T>(fn: () => T, ms = 160): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(
      () => {
        try {
          resolve(structuredClone(fn()));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
      ms + Math.random() * 100,
    );
  });
}

function tenantById(id: string): PlatformTenant {
  const t = db.tenants.find((x) => x.id === id);
  if (!t) throw new ApiError('not_found', 'House not found');
  return t;
}

const DAY = 86400000;
function since(days: number) {
  return new Date(Date.now() - days * DAY).toISOString();
}

/* ---------- Transaction maths ---------- */

export interface TxnFilter {
  tenantId: string | 'all';
  status: PlatformTransaction['status'] | 'all';
  method: PlatformTransaction['method'] | 'all';
  days: 1 | 7 | 30 | 90;
  query: string;
}

function summarise(rows: PlatformTransaction[]) {
  const ok = rows.filter((t) => t.status === 'succeeded');
  const attempted = rows.filter((t) => t.status !== 'pending');
  const failures = new Map<string, number>();
  for (const t of rows) if (t.failure) failures.set(t.failure, (failures.get(t.failure) ?? 0) + 1);
  const confirm = ok.flatMap((t) =>
    t.confirmSeconds !== null && t.flow !== 'manual' ? [t.confirmSeconds] : [],
  );
  confirm.sort((a, b) => a - b);
  return {
    count: rows.length,
    volume: ok.reduce((n, t) => n + t.amount, 0),
    successRate: attempted.length ? ok.length / attempted.length : 0,
    refunded: rows.filter((t) => t.status === 'refunded').reduce((n, t) => n + t.amount, 0),
    pending: rows.filter((t) => t.status === 'pending').length,
    medianConfirm: confirm.length ? (confirm[Math.floor(confirm.length / 2)] ?? null) : null,
    marketplaceShare: ok.length
      ? ok.filter((t) => t.attribution === 'marketplace').length / ok.length
      : 0,
    failures: [...failures.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function dailyVolume(rows: PlatformTransaction[], days: number) {
  const out: { day: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, value: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.day, i]));
  for (const t of rows) {
    if (t.status !== 'succeeded') continue;
    const i = idx.get(t.at.slice(0, 10));
    if (i !== undefined) {
      const row = out[i];
      if (row) row.value += t.amount;
    }
  }
  return out;
}

/* ===================================================================== */

export const api = {
  session: {
    get: () =>
      respond(() => {
        if (!session.signedIn) return { signedIn: false as const };
        const s = me();
        return {
          signedIn: true as const,
          staff: s,
          role: role(),
          viewAs: session.viewAs,
          capabilities: PLATFORM_ROLE_CAPS[role()],
        };
      }, 50),
    signIn: (email: string, password: string, totp: string) =>
      respond(() => {
        const s = db.staff.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!s) throw new ApiError('invalid', 'No Stayvinci staff account uses that email.');
        if (password.length < 8) throw new ApiError('invalid', 'Check your password.');
        if (!/^\d{6}$/.test(totp))
          throw new ApiError('invalid', 'Enter the 6-digit code from your authenticator app.');
        session = { signedIn: true, staffId: s.id, viewAs: null };
        saveSession();
        audit('staff.signed_in', null, '2FA verified');
        return true;
      }, 500),
    signOut: () =>
      respond(() => {
        session = { ...session, signedIn: false, viewAs: null };
        saveSession();
        return true;
      }, 80),
    setViewAs: (r: PlatformRole | null) =>
      respond(() => {
        session = { ...session, viewAs: r };
        saveSession();
        return true;
      }, 50),
    resetDemo: () =>
      respond(() => {
        db = createPlatformSeed();
        return true;
      }),
  },

  overview: () =>
    respond(() => {
      need('tenant.view');
      const canMoney = PLATFORM_ROLE_CAPS[role()].includes('transaction.view');
      const byStatus = new Map<TenantStatus, number>();
      for (const t of db.tenants) byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
      const last30 = db.transactions.filter((t) => t.at >= since(30));
      const prev30 = db.transactions.filter((t) => t.at >= since(60) && t.at < since(30));
      const today = db.transactions.filter((t) => t.at >= since(1));
      const attention = [
        ...db.tenants
          .filter((t) => t.payment?.state === 'failing')
          .map((t) => ({
            tenantId: t.id,
            tone: 'red' as const,
            title: `${t.name}: M-Pesa callbacks failing`,
            body: 'Guests may be charged without bookings confirming. Check the Daraja URL and credentials.',
          })),
        ...db.tenants
          .filter((t) => t.status === 'past_due')
          .map((t) => ({
            tenantId: t.id,
            tone: 'amber' as const,
            title: `${t.name}: subscription past due`,
            body: 'Suspended automatically after 14 days unless paid or given more time.',
          })),
        ...db.tenants
          .filter((t) => t.status === 'onboarding' && t.checklist.done < 4)
          .map((t) => ({
            tenantId: t.id,
            tone: 'azure' as const,
            title: `${t.name}: setup stalled (${t.checklist.done}/${t.checklist.total})`,
            body: 'A good moment to call the owner and set up the store for them.',
          })),
        ...db.tenants
          .filter((t) => t.status === 'draft')
          .map((t) => ({
            tenantId: t.id,
            tone: 'azure' as const,
            title: `${t.name}: invite not accepted yet`,
            body: `Sent to ${t.owner.name}. Resend or call them.`,
          })),
      ];
      return {
        tenants: db.tenants.length,
        byStatus: Object.fromEntries(byStatus) as Partial<Record<TenantStatus, number>>,
        newSignups30: db.tenants.filter((t) => t.joinedAt >= since(30)).length,
        money: canMoney
          ? {
              today: summarise(today),
              last30: summarise(last30),
              prev30Volume: summarise(prev30).volume,
              daily: dailyVolume(last30, 30),
            }
          : null,
        attention,
        recentActivity: db.audit.slice(0, 6),
      };
    }),

  tenants: {
    list: () =>
      respond(() => {
        need('tenant.view');
        const last30 = db.transactions.filter((t) => t.at >= since(30) && t.status === 'succeeded');
        return db.tenants.map((t) => ({
          ...t,
          volume30: last30.filter((x) => x.tenantId === t.id).reduce((n, x) => n + x.amount, 0),
          bookings30: last30.filter((x) => x.tenantId === t.id).length,
        }));
      }),
    get: (id: string) =>
      respond(() => {
        need('tenant.view');
        const t = tenantById(id);
        const rows = db.transactions.filter((x) => x.tenantId === id);
        return {
          tenant: t,
          plan: db.plans.find((p) => p.id === t.plan) ?? null,
          features: effectiveFeatures(db, t),
          subscription: db.subscriptions.find((s) => s.tenantId === id) ?? null,
          money: PLATFORM_ROLE_CAPS[role()].includes('transaction.view')
            ? {
                last30: summarise(rows.filter((x) => x.at >= since(30))),
                daily: dailyVolume(
                  rows.filter((x) => x.at >= since(30)),
                  30,
                ),
                recent: rows.slice(0, 12),
              }
            : null,
          months: db.months.filter((m) => m.tenantId === id),
          activity: db.audit.filter((a) => a.tenantId === id),
        };
      }),
    create: (
      input: {
        name: string;
        handle: string;
        kind: 'house' | 'atelier';
        vertical: Vertical;
        category: string;
        area: string;
        plan: PlanId;
        ownerName: string;
        ownerPhone: string;
        ownerEmail: string;
        payMethod: PayMethod | null;
        setUpForThem: boolean;
      },
      idempotencyKey: string,
    ) =>
      respond(() => {
        need('tenant.create');
        const done = db.audit.find((a) => a.id === `pa_idem_${idempotencyKey}`);
        if (done?.tenantId) return tenantById(done.tenantId);
        const handle = input.handle.trim().toLowerCase();
        if (!/^[a-z0-9-]{3,30}$/.test(handle))
          throw new ApiError(
            'invalid',
            'Handle: 3–30 characters, lowercase letters, numbers and hyphens.',
          );
        if (db.tenants.some((t) => t.handle === handle))
          throw new ApiError('conflict', `The handle "${handle}" is taken.`);
        if (input.name.trim().length < 2) throw new ApiError('invalid', 'Enter the business name.');
        if (input.ownerPhone.replace(/\D/g, '').length < 9)
          throw new ApiError('invalid', "Enter the owner's mobile number.");
        const id = `t_${handle.replace(/-/g, '_')}`;
        const t: PlatformTenant = {
          id,
          name: input.name.trim(),
          handle,
          kind: input.kind,
          vertical: input.vertical,
          category: input.category || (input.vertical === 'short_stay' ? 'Short stays' : 'Spa'),
          area: input.area,
          status: 'draft',
          plan: input.plan,
          interval: 'monthly',
          source: 'invited',
          joinedAt: new Date().toISOString(),
          liveAt: null,
          owner: {
            name: input.ownerName.trim(),
            phoneMasked: `+254 7•• ••• ${input.ownerPhone.replace(/\D/g, '').slice(-3)}`,
            email: input.ownerEmail.trim(),
          },
          staffCount: 0,
          checklist: { done: input.setUpForThem ? 1 : 0, total: 8 },
          onboardingManager: me().name,
          payment: input.payMethod
            ? {
                method: input.payMethod,
                mode: 'daraja',
                shortcodeMasked: `${input.payMethod === 'paybill' ? 'Paybill' : 'Till'} (owner to confirm)`,
                state: 'draft',
                lastCallbackAt: null,
              }
            : null,
          visibility: 'private',
          featured: false,
          overrides: [],
          baselineMonthly: null,
          demoStore: false,
          notes: input.setUpForThem
            ? [
                {
                  at: new Date().toISOString(),
                  by: me().name,
                  text: 'Stayvinci will set up the store for this House during onboarding.',
                },
              ]
            : [],
        };
        db.tenants.unshift(t);
        db.subscriptions.push({
          tenantId: id,
          status: 'not_started',
          nextBillingAt: null,
          coupon: null,
          invoices: [],
        });
        db.audit.unshift({
          id: `pa_idem_${idempotencyKey}`,
          at: new Date().toISOString(),
          actor: me().name,
          role: role(),
          action: 'tenant.invited',
          tenantId: id,
          detail: `Invite sent to ${t.owner.name} by SMS and email · ${input.plan} plan`,
        });
        return t;
      }, 500),
    setStatus: (id: string, status: TenantStatus, reason: string) =>
      respond(() => {
        need('tenant.manage');
        if (reason.trim().length < 3) throw new ApiError('invalid', 'Give a short reason.');
        const t = tenantById(id);
        const from = t.status;
        t.status = status;
        if (status === 'live' && !t.liveAt) t.liveAt = new Date().toISOString();
        audit('tenant.status_changed', id, `${from} → ${status}: ${reason.trim()}`);
        return t;
      }),
    setPlan: (id: string, plan: PlanId) =>
      respond(() => {
        need('tenant.manage');
        const t = tenantById(id);
        const from = t.plan;
        t.plan = plan;
        audit('tenant.plan_changed', id, `${from} → ${plan}`);
        return t;
      }),
    setOverride: (
      id: string,
      feature: FeatureKey,
      value: { on: boolean; reason: string; until: string | null } | null,
    ) =>
      respond(() => {
        need('feature.manage');
        const t = tenantById(id);
        t.overrides = t.overrides.filter((o) => o.feature !== feature);
        const name = db.features.find((f) => f.key === feature)?.name ?? feature;
        if (value) {
          if (value.reason.trim().length < 3)
            throw new ApiError('invalid', 'Say why, so the team knows later.');
          t.overrides.push({
            feature,
            on: value.on,
            reason: value.reason.trim(),
            until: value.until,
            by: me().name,
            at: new Date().toISOString(),
          });
          audit(
            'feature.override_set',
            id,
            `${name} turned ${value.on ? 'on' : 'off'}${value.until ? ` until ${value.until.slice(0, 10)}` : ''}: ${value.reason.trim()}`,
          );
        } else {
          audit('feature.override_removed', id, `${name} back to plan default`);
        }
        return true;
      }),
    setPayment: (id: string, method: PayMethod, mode: PayMode) =>
      respond(() => {
        need('tenant.manage');
        const t = tenantById(id);
        t.payment = {
          method,
          mode,
          shortcodeMasked:
            t.payment?.shortcodeMasked ??
            `${method === 'paybill' ? 'Paybill' : 'Till'} (owner to confirm)`,
          state: mode === 'manual' ? 'verified' : 'testing',
          lastCallbackAt: t.payment?.lastCallbackAt ?? null,
        };
        audit(
          'payment_connection.changed',
          id,
          `${method === 'paybill' ? 'Paybill' : 'Till'} via ${mode === 'daraja' ? 'Daraja (automatic)' : 'manual confirmation'}`,
        );
        return t;
      }),
    addNote: (id: string, text: string) =>
      respond(() => {
        need('tenant.view');
        if (!text.trim()) throw new ApiError('invalid', 'Write a note first.');
        const t = tenantById(id);
        t.notes.unshift({ at: new Date().toISOString(), by: me().name, text: text.trim() });
        return t;
      }),
    resendInvite: (id: string) =>
      respond(() => {
        need('tenant.create');
        const t = tenantById(id);
        audit('tenant.invite_resent', id, `Invite resent to ${t.owner.name}`);
        return true;
      }),
    /** Opens the House's business app with full control; the House sees it in its activity log. */
    startAssist: (id: string) =>
      respond(() => {
        need('tenant.assist');
        const t = tenantById(id);
        if (!t.demoStore)
          throw new ApiError(
            'invalid',
            'In this demo only Serenity and Karibu have store data in the business app.',
          );
        audit('tenant.assist_started', id, 'Opened the business app with full control');
        const by = encodeURIComponent(me().name);
        return `${BUSINESS_APP_URL}/today?assist=${t.id}&by=${by}`;
      }),
  },

  transactions: {
    list: (f: TxnFilter) =>
      respond(() => {
        need('transaction.view');
        const q = f.query.trim().toLowerCase();
        const rows = db.transactions.filter(
          (t) =>
            t.at >= since(f.days) &&
            (f.tenantId === 'all' || t.tenantId === f.tenantId) &&
            (f.status === 'all' || t.status === f.status) &&
            (f.method === 'all' || t.method === f.method) &&
            (!q || t.bookingRef.toLowerCase().includes(q) || t.guestRef.toLowerCase().includes(q)),
        );
        return {
          rows: rows.slice(0, 400),
          total: rows.length,
          summary: summarise(rows),
          daily: dailyVolume(rows, Math.min(f.days, 30)),
          tenants: db.tenants.map((t) => ({ id: t.id, name: t.name })),
        };
      }, 220),
    connections: () =>
      respond(() => {
        need('transaction.view');
        return db.tenants
          .filter((t) => t.payment)
          .map((t) => {
            const rows = db.transactions.filter((x) => x.tenantId === t.id && x.at >= since(7));
            return { tenantId: t.id, name: t.name, payment: t.payment, last7: summarise(rows) };
          });
      }),
  },

  insights: () =>
    respond(() => {
      need('insight.view');
      const live = db.tenants.filter((t) => db.months.some((m) => m.tenantId === t.id));
      const perTenant = live.map((t) => {
        const ms = db.months.filter((m) => m.tenantId === t.id);
        // Ignore the partial first month and the current month when comparing.
        const full = ms.slice(1, -1);
        const first = full[0] ?? ms[0];
        const latest = full[full.length - 1] ?? ms[ms.length - 1];
        const repeatRate = (m: (typeof ms)[number] | undefined) =>
          m && m.guests ? m.repeatGuests / m.guests : 0;
        return {
          tenantId: t.id,
          name: t.name,
          plan: t.plan,
          months: ms,
          baseline: t.baselineMonthly,
          firstRevenue: first?.revenue ?? 0,
          latestRevenue: latest?.revenue ?? 0,
          growth: first && latest && first.revenue ? latest.revenue / first.revenue - 1 : 0,
          vsBaseline: t.baselineMonthly && latest ? latest.revenue / t.baselineMonthly - 1 : null,
          repeatFirst: repeatRate(first),
          repeatLatest: repeatRate(latest),
          marketplaceGuests: ms.reduce((n, m) => n + m.marketplaceGuests, 0),
          monthsLive: ms.length,
        };
      });
      const allMonths = [...new Set(db.months.map((m) => m.month))].sort();
      const platformMonthly = allMonths.map((month) => ({
        month,
        revenue: db.months.filter((m) => m.month === month).reduce((n, m) => n + m.revenue, 0),
        bookings: db.months.filter((m) => m.month === month).reduce((n, m) => n + m.bookings, 0),
      }));
      return { perTenant, platformMonthly };
    }, 260),

  plans: {
    list: () =>
      respond(() => {
        need('tenant.view');
        return {
          plans: db.plans,
          features: db.features,
          counts: Object.fromEntries(
            db.plans.map((p) => [p.id, db.tenants.filter((t) => t.plan === p.id).length]),
          ) as Record<PlanId, number>,
        };
      }),
    toggleFeature: (planId: PlanId, feature: FeatureKey) =>
      respond(() => {
        need('plan.manage');
        const plan = db.plans.find((p) => p.id === planId);
        const f = db.features.find((x) => x.key === feature);
        if (!plan || !f) throw new ApiError('not_found', 'Plan or feature not found');
        if (f.core) throw new ApiError('invalid', `${f.name} is core: every plan has it.`);
        const has = plan.features.includes(feature);
        plan.features = has
          ? plan.features.filter((x) => x !== feature)
          : [...plan.features, feature];
        audit(
          'plan.feature_changed',
          null,
          `${f.name} ${has ? 'removed from' : 'added to'} ${plan.name} (${db.tenants.filter((t) => t.plan === planId).length} Houses affected)`,
        );
        return plan;
      }),
  },

  features: {
    setStage: (key: FeatureKey, stage: FeatureStage) =>
      respond(() => {
        need('plan.manage');
        const f = db.features.find((x) => x.key === key);
        if (!f) throw new ApiError('not_found', 'Feature not found');
        if (f.core) throw new ApiError('invalid', 'Core features are always released.');
        const from = f.stage;
        f.stage = stage;
        if (stage === 'general' && !f.releasedAt) f.releasedAt = new Date().toISOString();
        audit('feature.stage_changed', null, `${f.name}: ${from} → ${stage}`);
        return f;
      }),
    setTester: (key: FeatureKey, tenantId: string, on: boolean) =>
      respond(() => {
        need('feature.manage');
        const f = db.features.find((x) => x.key === key);
        if (!f) throw new ApiError('not_found', 'Feature not found');
        const t = tenantById(tenantId);
        f.testers = on
          ? [...new Set([...f.testers, tenantId])]
          : f.testers.filter((x) => x !== tenantId);
        audit(
          'feature.tester_changed',
          tenantId,
          `${t.name} ${on ? 'added to' : 'removed from'} ${f.name} ${f.stage}`,
        );
        return f;
      }),
  },

  billing: {
    list: () =>
      respond(() => {
        need('billing.manage');
        return db.subscriptions.map((s) => ({ ...s, tenant: tenantById(s.tenantId) }));
      }),
    extendGrace: (tenantId: string, days: number) =>
      respond(() => {
        need('billing.manage');
        const t = tenantById(tenantId);
        const sub = db.subscriptions.find((s) => s.tenantId === tenantId);
        if (sub?.status === 'suspended') {
          sub.status = 'past_due';
          t.status = 'past_due';
        }
        audit('billing.grace_extended', tenantId, `Grace extended by ${days} days`);
        return true;
      }),
    applyCoupon: (tenantId: string, code: string) =>
      respond(() => {
        need('billing.manage');
        const sub = db.subscriptions.find((s) => s.tenantId === tenantId);
        if (!sub) throw new ApiError('not_found', 'Subscription not found');
        if (!/^[A-Z0-9-]{3,30}$/.test(code.trim().toUpperCase()))
          throw new ApiError('invalid', 'Coupon codes use letters, numbers and hyphens.');
        sub.coupon = code.trim().toUpperCase();
        audit('billing.coupon_applied', tenantId, `Coupon ${sub.coupon}`);
        return true;
      }),
  },

  marketplace: {
    list: () =>
      respond(() => {
        need('marketplace.manage');
        return db.tenants
          .filter((t) => t.status === 'live' || t.status === 'past_due')
          .map((t) => ({
            ...t,
            marketplaceGuests: db.months
              .filter((m) => m.tenantId === t.id)
              .reduce((n, m) => n + m.marketplaceGuests, 0),
            entitled:
              effectiveFeatures(db, t).find((f) => f.feature.key === 'marketplace_listing')?.on ??
              false,
          }));
      }),
    setFeatured: (tenantId: string, featured: boolean) =>
      respond(() => {
        need('marketplace.manage');
        const t = tenantById(tenantId);
        if (featured && t.visibility === 'private')
          throw new ApiError('invalid', 'Private Houses never appear in Discover.');
        t.featured = featured;
        audit(
          'marketplace.featured_changed',
          tenantId,
          featured ? 'Featured in Discover' : 'No longer featured',
        );
        return true;
      }),
  },

  staff: {
    list: () =>
      respond(() => {
        need('staff.manage');
        return db.staff;
      }),
    invite: (name: string, email: string, r: PlatformRole) =>
      respond(() => {
        need('staff.manage');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
          throw new ApiError('invalid', 'Enter a valid email.');
        if (db.staff.some((s) => s.email.toLowerCase() === email.trim().toLowerCase()))
          throw new ApiError('conflict', 'That person already has an account.');
        db.staff.push({
          id: `ps_${Date.now()}`,
          name: name.trim(),
          email: email.trim(),
          role: r,
          twoFactor: false,
          status: 'invited',
          lastActive: null,
        });
        audit('staff.invited', null, `${name.trim()} invited as ${r}`);
        return true;
      }),
    setRole: (id: string, r: PlatformRole) =>
      respond(() => {
        need('staff.manage');
        const s = db.staff.find((x) => x.id === id);
        if (!s) throw new ApiError('not_found', 'Staff member not found');
        if (s.id === me().id && r !== 'super_admin')
          throw new ApiError('invalid', "You can't remove your own Super admin role.");
        s.role = r;
        audit('staff.role_changed', null, `${s.name} is now ${r}`);
        return true;
      }),
  },

  /** Ads for Stayvinci itself (Houses to sign up, guests to install). Paid from Stayvinci's ad budget. */
  ads: {
    list: () =>
      respond(() => {
        need('ads.manage');
        const live = db.campaigns.filter((c) => c.status !== 'draft');
        const spend = live.reduce((n, c) => n + c.spend, 0);
        const clicks = live.reduce((n, c) => n + c.clicks, 0);
        const impressions = live.reduce((n, c) => n + c.impressions, 0);
        const houses = live
          .filter((c) => c.objective === 'house_signups')
          .reduce((n, c) => n + c.conversions, 0);
        const guests = live
          .filter((c) => c.objective === 'guest_installs')
          .reduce((n, c) => n + c.conversions, 0);
        return {
          accounts: db.adAccounts,
          campaigns: db.campaigns,
          totals: {
            spend,
            impressions,
            clicks,
            ctr: impressions ? clicks / impressions : 0,
            houses,
            guests,
            costPerHouse: houses ? spend / houses : null,
          },
        };
      }),
    create: (
      input: Omit<
        AdCampaign,
        | 'id'
        | 'spend'
        | 'impressions'
        | 'clicks'
        | 'leads'
        | 'conversions'
        | 'startAt'
        | 'endAt'
        | 'currency'
      >,
    ) =>
      respond(() => {
        need('ads.manage');
        if (input.name.trim().length < 3) throw new ApiError('invalid', 'Name the campaign.');
        if (input.dailyBudget <= 0) throw new ApiError('invalid', 'Set a daily budget.');
        const account = db.adAccounts.find((a) => a.channel === input.channel);
        if (!account?.connected && input.status === 'active')
          throw new ApiError('invalid', 'Connect that ad account first, or save as a draft.');
        const c: AdCampaign = {
          ...input,
          id: `ad_${Date.now()}`,
          currency: 'KES',
          startAt: new Date().toISOString(),
          endAt: null,
          spend: 0,
          impressions: 0,
          clicks: 0,
          leads: 0,
          conversions: 0,
        };
        db.campaigns.unshift(c);
        audit(
          'ads.campaign_created',
          null,
          `${c.name} (${c.channel}, ${c.market}) ${c.status === 'active' ? 'launched' : 'saved as draft'}`,
        );
        return c;
      }, 500),
    setStatus: (id: string, status: 'active' | 'paused') =>
      respond(() => {
        need('ads.manage');
        const c = db.campaigns.find((x) => x.id === id);
        if (!c) throw new ApiError('not_found', 'Campaign not found');
        if (status === 'active' && !db.adAccounts.find((a) => a.channel === c.channel)?.connected)
          throw new ApiError('invalid', 'Connect that ad account first.');
        c.status = status;
        audit('ads.campaign_status', null, `${c.name}: ${status}`);
        return c;
      }),
    connect: (channel: AdChannel, accountName: string) =>
      respond(() => {
        need('ads.manage');
        const a = db.adAccounts.find((x) => x.channel === channel);
        if (!a) throw new ApiError('not_found', 'Unknown channel');
        a.connected = true;
        a.accountName = accountName.trim() || 'Stayvinci';
        audit('ads.account_connected', null, `${channel} ad account connected`);
        return a;
      }, 700),
  },

  audit: {
    list: () =>
      respond(() => {
        need('audit.view');
        return {
          entries: db.audit,
          tenants: db.tenants.map((t) => ({ id: t.id, name: t.name })),
        };
      }),
  },
};

export type SessionInfo = Awaited<ReturnType<typeof api.session.get>>;
export type TenantRow = Awaited<ReturnType<typeof api.tenants.list>>[number];
export type TenantDetail = Awaited<ReturnType<typeof api.tenants.get>>;
