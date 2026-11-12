import { applyDecorators, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ApiBody, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { Errors, type AppRequest } from './http.js';

/**
 * OpenAPI schema for a Zod schema. Schemas registered with .meta({ id }) become shared
 * components ($ref) so the docs list each model once.
 */
export function openApiSchema(
  schema: z.ZodType,
  io: 'input' | 'output' = 'output',
): Record<string, unknown> {
  const json = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  }) as Record<string, unknown>;
  delete json.$schema;
  delete json.$defs;
  delete json.definitions;
  delete json.id;
  // Nested registered models point at the shared components instead of local definitions.
  return JSON.parse(
    JSON.stringify(json)
      .replaceAll('#/$defs/', '#/components/schemas/')
      .replaceAll('#/definitions/', '#/components/schemas/'),
  ) as Record<string, unknown>;
}

/** All registered models, for the components section of the OpenAPI document. */
export function openApiComponents(): Record<string, unknown> {
  const all = z.toJSONSchema(z.globalRegistry, {
    target: 'openapi-3.0',
    unrepresentable: 'any',
    uri: (id) => `#/components/schemas/${id}`,
  }) as { schemas: Record<string, Record<string, unknown>> };
  for (const s of Object.values(all.schemas)) {
    delete s.$schema;
    delete s.id;
  }
  return all.schemas;
}

function refOrInline(schema: z.ZodType, io: 'input' | 'output') {
  const id = z.globalRegistry.get(schema)?.id;
  return id ? { $ref: `#/components/schemas/${id}` } : openApiSchema(schema, io);
}

function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  throw Errors.invalid(
    'Some fields need attention.',
    r.error.issues.map((i) => ({ path: i.path.join('.') || '(body)', message: i.message })),
  );
}

/** Validated JSON body. Unknown fields are dropped, so they can never reach the database. */
export const ValidBody = <T extends z.ZodType>(schema: T) =>
  createParamDecorator((_: unknown, ctx: ExecutionContext) =>
    parse(schema, ctx.switchToHttp().getRequest<AppRequest>().body),
  )();

export const ValidQuery = <T extends z.ZodType>(schema: T) =>
  createParamDecorator((_: unknown, ctx: ExecutionContext) =>
    parse(schema, ctx.switchToHttp().getRequest<AppRequest>().query),
  )();

const UuidParam = z.uuid();
/** A path parameter that must be a UUID; anything else is a 404 (no hints about ids). */
export const UuidPath = (name: string) =>
  createParamDecorator((_: unknown, ctx: ExecutionContext) => {
    const v = ctx.switchToHttp().getRequest<AppRequest>().params[name] as
      string | string[] | undefined;
    if (!UuidParam.safeParse(v).success) throw Errors.notFound();
    return v as string;
  })();

/** Documents a JSON request body. */
export const DocBody = (schema: z.ZodType) =>
  ApiBody({ schema: refOrInline(schema, 'input') as never });

/** Documents the success response plus the standard error responses. */
export function DocResponse(
  status: number,
  schema: z.ZodType | null,
  description: string,
  errors: number[] = [],
) {
  const err = { $ref: '#/components/schemas/Error' } as never;
  return applyDecorators(
    ApiResponse(
      schema
        ? { status, description, schema: refOrInline(schema, 'output') as never }
        : { status, description },
    ),
    ...errors.map((code) =>
      ApiResponse({ status: code, description: ERROR_TEXT[code] ?? 'Error', schema: err }),
    ),
  );
}

const ERROR_TEXT: Record<number, string> = {
  400: 'Bad request (e.g. missing Idempotency-Key)',
  401: 'Not signed in, or the access token expired',
  403: 'Signed in, but not allowed (role, capability or two-step verification)',
  404: 'Not found, or not visible to you',
  409: 'Conflict (duplicate, or a request with this Idempotency-Key is still running)',
  422: 'Validation failed',
  429: 'Too many requests',
  503: 'Not available right now (e.g. a sign-in method that is switched off)',
};

export const DocQuery = (schema: z.ZodObject) =>
  applyDecorators(
    ...Object.entries(schema.shape).map(([name, s]) =>
      ApiQuery({
        name,
        required: !(s as z.ZodType).safeParse(undefined).success,
        schema: openApiSchema(s as z.ZodType, 'input') as never,
      }),
    ),
  );

export const DocUuidParam = (name: string, description: string) =>
  ApiParam({ name, description, schema: { type: 'string', format: 'uuid' } });
