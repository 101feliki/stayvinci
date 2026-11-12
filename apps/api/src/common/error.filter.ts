import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppError, type AppRequest } from './http.js';

/**
 * One error shape for every failure: { error: { code, message, request_id } }.
 * Unknown errors are logged server-side (with the request id, never the body) and the
 * client only sees a generic message.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<AppRequest>();
    const res = ctx.getResponse<Response>();
    const requestId = req.requestId ?? 'unknown';

    let status = 500;
    let code = 'internal_error';
    let message = 'Something went wrong on our side. Try again in a moment.';
    let details: { path: string; message: string }[] | undefined;

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ThrottlerException) {
      status = 429;
      code = 'rate_limited';
      message = 'Too many requests. Try again later.';
    } else if (
      isBodyParserError(exception) ||
      (exception instanceof HttpException && isBodyParserError(exception.cause))
    ) {
      status = 400;
      code = 'invalid_json';
      message = 'The request body is not valid JSON.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status === 404 ? 'not_found' : status === 413 ? 'payload_too_large' : 'bad_request';
      message =
        status === 404
          ? 'Not found.'
          : status === 413
            ? 'Request body is too large.'
            : 'Bad request.';
    } else {
      this.log.error(
        `${req.method} ${req.route?.path ?? '(unmatched)'} failed [${requestId}]`,
        (exception as Error)?.stack,
      );
    }

    res
      .status(status)
      .json({ error: { code, message, request_id: requestId, ...(details ? { details } : {}) } });
  }
}

function isBodyParserError(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && (e as { type?: string }).type === 'entity.parse.failed'
  );
}
