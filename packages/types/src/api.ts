// Request and response contracts for the v1 API (spec §20 API conventions).
// The API validates with these schemas and generates its OpenAPI docs from them;
// the apps and the SDK use the same types.
import { z } from 'zod';
import { CAPABILITIES, PLATFORM_ROLES, TENANT_ROLES } from './capabilities.js';

/* ---------- Shared pieces ---------- */

export const Uuid = z.uuid().describe('UUID');
export const PhoneE164 = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/, 'Use international format, e.g. +254712345678')
  .describe('Phone number in E.164 format');
export const Email = z
  .email()
  .max(254)
  .transform((e) => e.toLowerCase());
export const Audience = z
  .enum(['guest', 'business', 'console'])
  .describe('Which app is signing in');
export const Money = z
  .object({ amount_minor: z.number().int(), currency: z.string().length(3) })
  .describe('Integer minor units plus ISO currency code');

export const ErrorBody = z
  .object({
    error: z.object({
      code: z
        .string()
        .describe('Machine-readable code, e.g. forbidden, not_found, validation_failed'),
      message: z.string().describe('Safe, human-readable message'),
      request_id: z.string().describe('Quote this when contacting support'),
      details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    }),
  })
  .meta({ id: 'Error' });

export const CursorQuery = z.object({
  cursor: z.string().max(200).optional().describe('Opaque cursor from the previous page'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), next_cursor: z.string().nullable() });

/* ---------- Auth ---------- */

export const OtpRequest = z.object({ phone: PhoneE164 }).meta({ id: 'OtpRequest' });
export const OtpRequested = z
  .object({ sent: z.literal(true), expires_in_seconds: z.number().int() })
  .meta({ id: 'OtpRequested' });

export const OtpVerify = z
  .object({ phone: PhoneE164, code: z.string().regex(/^\d{6}$/), audience: Audience })
  .meta({ id: 'OtpVerify' });

export const MagicLinkRequest = z
  .object({ email: Email, audience: Audience })
  .meta({ id: 'MagicLinkRequest' });
export const EmailTokenBody = z
  .object({ token: z.string().min(20).max(200) })
  .meta({ id: 'EmailToken' });
export const MagicLinkVerify = z
  .object({ token: z.string().min(20).max(200), audience: Audience })
  .meta({ id: 'MagicLinkVerify' });
export const Accepted = z.object({ accepted: z.literal(true) }).meta({ id: 'Accepted' });

export const PasswordLogin = z
  .object({ email: Email, password: z.string().min(1).max(200) })
  .meta({ id: 'PasswordLogin' });
export const PasswordForgot = z.object({ email: Email }).meta({ id: 'PasswordForgot' });
export const PasswordReset = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(12, 'Use at least 12 characters').max(200),
  })
  .meta({ id: 'PasswordReset' });

export const RefreshBody = z
  .object({ refresh_token: z.string().min(20).max(200) })
  .meta({ id: 'Refresh' });
export const TotpCode = z.object({ code: z.string().regex(/^\d{6}$/) }).meta({ id: 'TotpCode' });

export const Tokens = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.literal('Bearer'),
    expires_in: z.number().int().describe('Seconds until the access token expires'),
    second_factor: z
      .enum(['not_required', 'required', 'setup_required', 'completed'])
      .describe(
        'Whether this person must complete two-step verification before using protected areas',
      ),
  })
  .meta({ id: 'Tokens' });

export const TotpSetup = z
  .object({ otpauth_url: z.string(), secret: z.string() })
  .meta({
    id: 'TotpSetup',
    description: 'Shown once. Add to an authenticator app, then call /totp/enable.',
  });

/* ---------- Me ---------- */

export const Me = z
  .object({
    id: Uuid,
    full_name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    email_verified: z.boolean(),
    two_factor_enabled: z.boolean(),
    platform_role: z.enum(PLATFORM_ROLES).nullable(),
  })
  .meta({ id: 'Me' });

export const MeUpdate = z
  .object({ full_name: z.string().trim().min(2).max(120).optional(), email: Email.optional() })
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field')
  .meta({ id: 'MeUpdate' });

export const MyTenant = z
  .object({
    tenant_id: Uuid,
    name: z.string(),
    handle: z.string(),
    kind: z.enum(['house', 'atelier']),
    role: z.enum(TENANT_ROLES),
    capabilities: z.array(z.enum(CAPABILITIES)),
  })
  .meta({ id: 'MyTenant' });

/* ---------- Tenants ---------- */

export const TenantStatus = z.enum([
  'onboarding_unpaid',
  'onboarding',
  'pending_verification',
  'ready',
  'live',
  'past_due',
  'suspended',
  'closed',
]);

export const Tenant = z
  .object({
    id: Uuid,
    handle: z.string(),
    name: z.string(),
    kind: z.enum(['house', 'atelier']),
    vertical: z.enum(['spa', 'short_stay', 'atelier']),
    market_code: z.string(),
    timezone: z.string(),
    currency: z.string(),
    status: TenantStatus,
    visibility: z.enum(['private', 'listed', 'listed_limited']),
    plan_code: z.string(),
    created_at: z.string(),
  })
  .meta({ id: 'Tenant' });

export const TenantUpdate = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    timezone: z.string().min(3).max(64).optional(),
    visibility: z.enum(['private', 'listed', 'listed_limited']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field')
  .meta({ id: 'TenantUpdate' });

/* ---------- Team ---------- */

export const Member = z
  .object({
    id: Uuid,
    user_id: Uuid,
    full_name: z.string().nullable(),
    role: z.enum(TENANT_ROLES),
    caps_added: z.array(z.string()),
    caps_removed: z.array(z.string()),
    status: z.enum(['invited', 'active', 'suspended']),
    created_at: z.string(),
  })
  .meta({ id: 'Member' });

export const MemberInvite = z
  .object({
    full_name: z.string().trim().min(2).max(120),
    phone: PhoneE164,
    email: Email.optional(),
    role: z.enum(TENANT_ROLES).exclude(['owner']),
  })
  .meta({ id: 'MemberInvite' });

export const MemberUpdate = z
  .object({
    role: z.enum(TENANT_ROLES).optional(),
    caps_added: z.array(z.enum(CAPABILITIES)).max(40).optional(),
    caps_removed: z.array(z.enum(CAPABILITIES)).max(40).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field')
  .meta({ id: 'MemberUpdate' });

/* ---------- Guests (contact omission demo of rule 5) ---------- */

export const Guest = z
  .object({
    id: Uuid,
    display_name: z.string(),
    first_touch_source: z.enum(['own_channel', 'marketplace']),
    tags: z.array(z.string()),
    phone: z.string().optional().describe('Only present with the guest.contact.view capability'),
    email: z.string().optional().describe('Only present with the guest.contact.view capability'),
  })
  .meta({ id: 'Guest' });

/* ---------- Audit ---------- */

export const AuditEntry = z
  .object({
    id: z.number().int(),
    actor: z.string(),
    action: z.string(),
    target_type: z.string().nullable(),
    target_id: z.string().nullable(),
    occurred_at: z.string(),
  })
  .meta({ id: 'AuditEntry' });

/* ---------- Platform ---------- */

export const PlatformTenantCreate = z
  .object({
    name: z.string().trim().min(2).max(120),
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/, '3–30 characters: letters, numbers and hyphens'),
    kind: z.enum(['house', 'atelier']),
    vertical: z.enum(['spa', 'short_stay', 'atelier']),
    market_code: z.string().length(2).default('KE'),
    plan_code: z.string().min(2).max(30),
    owner: z.object({
      full_name: z.string().trim().min(2).max(120),
      phone: PhoneE164,
      email: Email,
    }),
  })
  .meta({ id: 'PlatformTenantCreate' });

export const Health = z
  .object({
    status: z.enum(['ok', 'degraded']),
    checks: z.record(z.string(), z.enum(['ok', 'fail'])),
  })
  .meta({ id: 'Health' });
