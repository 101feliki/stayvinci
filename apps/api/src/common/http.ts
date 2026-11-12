import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import type { Capability, PlatformRole, TenantRole } from '@stayvinci/types';

/** Dependency-injection tokens. Every constructor uses @Inject(TOKEN) explicitly. */
export const CONFIG = Symbol('CONFIG');
export const DATABASE = Symbol('DATABASE');
export const MAILER = Symbol('MAILER');
export const SMS = Symbol('SMS');

/** Who is calling, from a verified access token. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  audience: 'guest' | 'business' | 'console';
  secondFactor: boolean;
  platformRole: PlatformRole | null;
}

/** The House a tenant-scoped request acts in, after the membership check. */
export interface TenantContext {
  id: string;
  role: TenantRole;
  capabilities: Set<Capability>;
}

export interface AppRequest extends Request {
  requestId: string;
  auth?: AuthContext;
  tenant?: TenantContext;
}

/**
 * Errors the API returns on purpose. Anything else becomes a generic 500 with no details,
 * so internals (stack traces, SQL, file paths) never reach a client.
 */
export class AppError extends Error {
  constructor(
    public readonly status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: (message = 'Sign in to continue.') =>
    new AppError(HttpStatus.UNAUTHORIZED, 'unauthorized', message),
  forbidden: (message = "You don't have permission to do this.") =>
    new AppError(HttpStatus.FORBIDDEN, 'forbidden', message),
  secondFactor: () =>
    new AppError(
      HttpStatus.FORBIDDEN,
      'second_factor_required',
      'Complete two-step verification to continue.',
    ),
  notFound: (what = 'Resource') =>
    new AppError(HttpStatus.NOT_FOUND, 'not_found', `${what} not found.`),
  conflict: (message: string) => new AppError(HttpStatus.CONFLICT, 'conflict', message),
  invalid: (message: string, details?: { path: string; message: string }[]) =>
    new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'validation_failed', message, details),
  badRequest: (code: string, message: string) =>
    new AppError(HttpStatus.BAD_REQUEST, code, message),
  unavailable: (code: string, message: string) =>
    new AppError(HttpStatus.SERVICE_UNAVAILABLE, code, message),
  tooMany: () =>
    new AppError(
      HttpStatus.TOO_MANY_REQUESTS,
      'rate_limited',
      'Too many attempts. Try again later.',
    ),
};
