import 'reflect-metadata';
import { timingSafeEqual } from 'node:crypto';
import { type DynamicModule, Module, type LoggerService } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Database } from '@stayvinci/db';
import type { Config } from './config.js';
import { ErrorFilter } from './common/error.filter.js';
import { CONFIG, DATABASE, MAILER, SMS } from './common/http.js';
import { requestMiddleware } from './common/request.middleware.js';
import { openApiComponents } from './common/validation.js';
import { Data } from './database.js';
import { HealthController } from './modules/health/health.controller.js';
import { IdentityController } from './modules/identity/identity.controller.js';
import { IdentityService } from './modules/identity/identity.service.js';
import { MeController } from './modules/me/me.controller.js';
import { PlatformController } from './modules/platform/platform.controller.js';
import { TenantsController } from './modules/tenants/tenants.controller.js';
import type { Mailer } from './notifications/mailer.js';
import type { Sms } from './notifications/sms.js';
import { AuthGuard, CapabilityGuard, PlatformGuard, TenantGuard } from './security/guards.js';
import { IdempotencyInterceptor } from './security/idempotency.interceptor.js';

export interface AppDeps {
  config: Config;
  database: Database;
  mailer: Mailer;
  sms: Sms;
}

// Nest's dynamic-module pattern: a class whose static register() builds the module.
@Module({})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class AppModule {
  static register(deps: AppDeps): DynamicModule {
    return {
      module: AppModule,
      imports: [
        // Per-IP limits for everything; sign-in routes set stricter ones.
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
          skipIf: () => !deps.config.rateLimit,
        }),
      ],
      controllers: [
        HealthController,
        IdentityController,
        MeController,
        TenantsController,
        PlatformController,
      ],
      providers: [
        { provide: CONFIG, useValue: deps.config },
        { provide: DATABASE, useValue: deps.database },
        { provide: MAILER, useValue: deps.mailer },
        { provide: SMS, useValue: deps.sms },
        Data,
        IdentityService,
        // Order matters: rate limit, then who you are, then which House, then what you may do.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: TenantGuard },
        { provide: APP_GUARD, useClass: CapabilityGuard },
        { provide: APP_GUARD, useClass: PlatformGuard },
        { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
      ],
    };
  }
}

/** Builds the configured application without listening (used by main.ts and tests). */
export async function createApp(
  deps: AppDeps,
  logger?: LoggerService | false,
): Promise<NestExpressApplication> {
  const { config } = deps;
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(deps), {
    logger:
      logger ??
      (config.env === 'production' ? ['log', 'warn', 'error'] : ['log', 'warn', 'error', 'debug']),
    bodyParser: false,
  });

  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '100kb', strict: true });
  app.use(requestMiddleware(config.env === 'test'));

  // Strict security headers for JSON responses; the docs page gets just enough to render.
  const apiHelmet = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
  });
  const docsHelmet = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path.startsWith('/docs') ? docsHelmet : apiHelmet)(req, res, next),
  );

  // Only the listed browser apps may call the API from a browser.
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Idempotent-Replayed', 'Retry-After'],
    credentials: false,
    maxAge: 600,
  });

  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();

  if (config.docs.enabled) setupDocs(app, config);
  return app;
}

export function buildOpenApi(app: NestExpressApplication, config: Config): OpenAPIObject {
  const doc = new DocumentBuilder()
    .setTitle('Stayvinci API')
    .setVersion('v1')
    .setDescription(
      [
        'Private booking and storefront platform for Houses and Ateliers.',
        '',
        '**Signing in**: `POST /v1/auth/otp/request` then `/otp/verify` (or a magic link). Send the access token as `Authorization: Bearer <token>`.',
        'If `second_factor` is `setup_required` or `required`, finish two-step verification (`/v1/auth/totp/...`) before using House or staff routes.',
        '',
        '**Houses**: business routes live under `/v1/tenants/{tenantId}/...`. You only see Houses you belong to; anything else is a 404.',
        '**Idempotency**: POSTs that create things or move money need an `Idempotency-Key` header.',
        '**Errors** always look like `{ "error": { "code", "message", "request_id" } }`.',
        '**Money** is integer minor units plus currency; times are ISO 8601 in UTC.',
      ].join('\n'),
    )
    .addServer(config.publicApiUrl)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token from a sign-in endpoint',
      },
      'access-token',
    )
    .addTag('Sign-in', 'Phone codes, email links, passwords, two-step verification and sessions')
    .addTag('Me', 'The signed-in person')
    .addTag('Houses', 'One House: settings, team, guests and activity (business app)')
    .addTag('Platform (staff)', 'Stayvinci staff console')
    .addTag('Health', 'Load-balancer checks')
    .build();
  const document = SwaggerModule.createDocument(app, doc);
  document.components = {
    ...document.components,
    schemas: {
      ...((document.components?.schemas ?? {}) as Record<string, never>),
      ...(openApiComponents() as Record<string, never>),
    },
  };
  return document;
}

/** API docs at /docs (UI) and /docs/openapi.json. Behind basic auth whenever credentials are set. */
function setupDocs(app: NestExpressApplication, config: Config) {
  const { user, password } = config.docs;
  if (user && password) {
    const expected = Buffer.from(`Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`);
    app.use('/docs', (req: Request, res: Response, next: NextFunction) => {
      const given = Buffer.from(req.header('authorization') ?? '');
      if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
      res.setHeader('WWW-Authenticate', 'Basic realm="Stayvinci API docs"');
      res
        .status(401)
        .json({
          error: { code: 'unauthorized', message: 'Sign in to view the API docs.', request_id: '' },
        });
    });
  }
  const document = buildOpenApi(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/openapi.json',
    customSiteTitle: 'Stayvinci API',
    swaggerOptions: { persistAuthorization: false, displayRequestDuration: true },
  });
}
