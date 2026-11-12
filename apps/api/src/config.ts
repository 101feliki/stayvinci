import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PUBLIC_API_URL: z.url().default('http://localhost:4000'),
  TRUST_PROXY: bool.default(false),
  DATABASE_URL: z.string().min(1).default('pglite://./.data/pglite'),
  MIGRATE_ON_START: bool.optional(),
  CORS_ORIGINS: z.string().default(''),
  GUEST_APP_URL: z.url().default('http://localhost:5174'),
  BUSINESS_APP_URL: z.url().default('http://localhost:5173'),
  CONSOLE_URL: z.url().default('http://localhost:5175'),
  JWT_SECRET: z.string().optional(),
  OTP_PEPPER: z.string().optional(),
  DATA_ENCRYPTION_KEY: z.string().optional(),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  DOCS_ENABLED: bool.optional(),
  DOCS_USER: z.string().optional(),
  DOCS_PASSWORD: z.string().optional(),
  // "smtp" sends through SMTP_*; "console" prints emails (with their links) to the API log, development only.
  MAIL_TRANSPORT: z.enum(['smtp', 'console']).default('smtp'),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: bool.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('Stayvinci <no-reply@stayvinci.com>'),
  // SMS sign-in is on hold: email (magic link, password) is the sign-in method for now.
  SMS_PROVIDER: z.enum(['off', 'console', 'memory', 'africastalking']).default('off'),
  RATE_LIMIT: bool.default(true),
});

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  publicApiUrl: string;
  trustProxy: boolean;
  databaseUrl: string;
  migrateOnStart: boolean;
  corsOrigins: string[];
  appUrls: { guest: string; business: string; console: string };
  jwtSecret: Uint8Array;
  otpPepper: Buffer;
  dataKey: Buffer;
  accessTtl: number;
  refreshTtlDays: number;
  docs: { enabled: boolean; user: string | null; password: string | null };
  mailTransport: 'smtp' | 'console';
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string | null;
    password: string | null;
    from: string;
  };
  smsProvider: 'off' | 'console' | 'memory' | 'africastalking';
  rateLimit: boolean;
}

const PLACEHOLDER = /change|example|secret|password|local-only|^x+$/i;

/**
 * Reads and validates configuration. In production every secret must be set, long and
 * not a placeholder, or the API refuses to start. In development, missing secrets get a
 * random per-process value (sessions reset on restart) and a warning.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const e = parsed.data;
  const prod = e.NODE_ENV === 'production';
  const warnings: string[] = [];

  const secret = (name: string, value: string | undefined, minBytes: number): Buffer => {
    if (value && value.length >= minBytes && !PLACEHOLDER.test(value)) return Buffer.from(value);
    if (prod)
      throw new Error(
        `${name} must be set to a strong random value (at least ${minBytes} characters).`,
      );
    warnings.push(name);
    return randomBytes(48);
  };

  const jwt = secret('JWT_SECRET', e.JWT_SECRET, 32);
  const pepper = secret('OTP_PEPPER', e.OTP_PEPPER, 32);
  let dataKey: Buffer;
  const decoded = e.DATA_ENCRYPTION_KEY ? Buffer.from(e.DATA_ENCRYPTION_KEY, 'base64') : null;
  if (decoded && decoded.length === 32) dataKey = decoded;
  else if (prod) throw new Error('DATA_ENCRYPTION_KEY must be 32 random bytes, base64-encoded.');
  else {
    warnings.push('DATA_ENCRYPTION_KEY');
    dataKey = randomBytes(32);
  }

  if (prod && e.DATABASE_URL.startsWith('pglite://'))
    throw new Error('Use PostgreSQL in production; PGlite is for development and tests.');
  if (prod && e.MAIL_TRANSPORT === 'console')
    throw new Error('MAIL_TRANSPORT=console prints sign-in links; use smtp in production.');
  if (prod && (e.SMS_PROVIDER === 'console' || e.SMS_PROVIDER === 'memory'))
    throw new Error(
      'SMS_PROVIDER must be "off" or a real provider in production (console prints codes).',
    );

  const docsCredentials = !!(e.DOCS_USER && e.DOCS_PASSWORD);
  if (prod && e.DOCS_ENABLED && !docsCredentials)
    throw new Error(
      'API docs in production need DOCS_USER and DOCS_PASSWORD (they are behind basic auth).',
    );

  if (warnings.length && e.NODE_ENV === 'development')
    console.warn(
      `[config] Using temporary random values for: ${warnings.join(', ')}. Set them in apps/api/.env.`,
    );

  return {
    env: e.NODE_ENV,
    port: e.PORT,
    publicApiUrl: e.PUBLIC_API_URL,
    trustProxy: e.TRUST_PROXY,
    databaseUrl: e.DATABASE_URL,
    migrateOnStart: e.MIGRATE_ON_START ?? !prod,
    corsOrigins: e.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    appUrls: { guest: e.GUEST_APP_URL, business: e.BUSINESS_APP_URL, console: e.CONSOLE_URL },
    jwtSecret: new Uint8Array(jwt),
    otpPepper: pepper,
    dataKey,
    accessTtl: e.ACCESS_TOKEN_TTL_SECONDS,
    refreshTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
    docs: {
      enabled: e.DOCS_ENABLED ?? !prod,
      user: e.DOCS_USER ?? null,
      password: e.DOCS_PASSWORD ?? null,
    },
    mailTransport: e.MAIL_TRANSPORT,
    smtp: {
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      user: e.SMTP_USER ?? null,
      password: e.SMTP_PASSWORD ?? null,
      from: e.MAIL_FROM,
    },
    smsProvider: e.SMS_PROVIDER,
    // Rate limiting can only be switched off outside production (tests).
    rateLimit: prod ? true : e.RATE_LIMIT,
  };
}
