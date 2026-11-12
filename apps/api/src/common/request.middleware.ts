import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AppRequest } from './http.js';

const log = new Logger('HTTP');
const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Gives every request an id (echoed as X-Request-Id) and logs one line when it finishes:
 * method, route pattern, status and duration. Never bodies, query strings, phone numbers
 * or emails (CLAUDE.md rule 5: no guest personal data in logs).
 */
export function requestMiddleware(quiet: boolean) {
  return (req: AppRequest, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    req.requestId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    // Responses about people and money must never be cached by browsers or proxies.
    res.setHeader('Cache-Control', 'no-store');
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      if (quiet) return;
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const route = (req.route as { path?: string } | undefined)?.path ?? '(unmatched)';
      log.log(
        `${req.method} ${req.baseUrl}${route} ${res.statusCode} ${ms.toFixed(1)}ms [${req.requestId}]`,
      );
    });
    next();
  };
}
