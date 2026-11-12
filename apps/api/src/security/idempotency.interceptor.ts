import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { catchError, concatMap, from, map, of, switchMap, throwError, type Observable } from 'rxjs';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { idempotencyKey, withContext, type Database } from '@stayvinci/db';
import { AppError, DATABASE, Errors, type AppRequest } from '../common/http.js';
import { sha256, safeEqual } from './crypto.js';
import { isIdempotent } from './guards.js';

const KEY = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Idempotency for POSTs that create bookings or move money (CLAUDE.md rule 4).
 * Same key + same request => the stored first response. Same key + different request =>
 * 422. A request still running => 409. A failed request releases its key for a retry.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly database: Database,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!isIdempotent(this.reflector, ctx)) return next.handle();
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.header('idempotency-key') ?? '';
    if (!KEY.test(key))
      throw Errors.badRequest(
        'idempotency_key_required',
        'Send an Idempotency-Key header (8–128 letters, digits, - or _).',
      );
    if (!req.auth) throw Errors.unauthorized();
    const userId = req.auth.userId;
    const tenantId = req.tenant?.id ?? null;
    // The status Nest will send: @HttpCode on the handler, else 201 for POST.
    const status =
      this.reflector.get<number | undefined>(HTTP_CODE_METADATA, ctx.getHandler()) ??
      (req.method === 'POST' ? 201 : 200);
    const hash = sha256(`${req.method} ${req.path}\n${JSON.stringify(req.body ?? null)}`);
    const run = <T>(fn: Parameters<typeof withContext<T>>[2]) =>
      withContext(this.database.db, { role: 'sv_app', userId, tenantId }, fn);
    const scope = and(
      eq(idempotencyKey.userId, userId),
      tenantId ? eq(idempotencyKey.tenantId, tenantId) : isNull(idempotencyKey.tenantId),
      eq(idempotencyKey.key, key),
    );

    return from(
      run(async (tx) => {
        const inserted = await tx
          .insert(idempotencyKey)
          .values({
            userId,
            tenantId,
            key,
            method: req.method,
            path: req.path,
            requestHash: hash,
            expiresAt: sql`now() + interval '24 hours'` as unknown as string,
          })
          .onConflictDoNothing()
          .returning({ id: idempotencyKey.id });
        if (inserted.length) return { replay: null as null | { code: number; body: unknown } };
        const [existing] = await tx.select().from(idempotencyKey).where(scope);
        if (!existing) throw Errors.conflict('Try again.');
        if (!safeEqual(Buffer.from(existing.requestHash), hash))
          throw new AppError(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'idempotency_key_reused',
            'This Idempotency-Key was used for a different request.',
          );
        if (existing.status !== 'completed')
          throw Errors.conflict('A request with this Idempotency-Key is still being processed.');
        return { replay: { code: existing.responseCode ?? 200, body: existing.responseBody } };
      }),
    ).pipe(
      switchMap(({ replay }) => {
        if (replay) {
          res.status(replay.code).setHeader('Idempotent-Replayed', 'true');
          return of(replay.body);
        }
        return next.handle().pipe(
          // Store the response before it is sent, so an immediate retry replays it.
          concatMap((body) =>
            from(
              run((tx) =>
                tx
                  .update(idempotencyKey)
                  .set({ status: 'completed', responseCode: status, responseBody: body ?? null })
                  .where(scope),
              ),
            ).pipe(map(() => body)),
          ),
          catchError((err: unknown) =>
            from(run((tx) => tx.delete(idempotencyKey).where(scope)).catch(() => undefined)).pipe(
              switchMap(() => throwError(() => err)),
            ),
          ),
        );
      }),
    );
  }
}
