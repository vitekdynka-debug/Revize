import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { useCzechValidationMessages } from '@revize/shared';
import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { authPlugin } from './auth/plugin.js';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import { AppError } from './errors.js';
import { auditRoutes } from './modules/audit/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { createAuthService } from './modules/auth/service.js';
import { customersRoutes } from './modules/customers/routes.js';
import { createCustomersService } from './modules/customers/service.js';
import { equipmentTypesRoutes } from './modules/equipment-types/routes.js';
import { createEquipmentTypesService } from './modules/equipment-types/service.js';
import { healthRoutes } from './modules/health/routes.js';
import { itemsRoutes } from './modules/items/routes.js';
import { createItemsService } from './modules/items/service.js';
import { locationsRoutes } from './modules/locations/routes.js';
import { createLocationsService } from './modules/locations/service.js';
import { usersRoutes } from './modules/users/routes.js';
import { createUsersService } from './modules/users/service.js';

export interface AppDeps {
  config: Config;
  db: Db;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ config, db, logger }: AppDeps) {
  useCzechValidationMessages();

  const app = Fastify({
    logger: logger ?? { level: config.LOG_LEVEL },
    // Behind Caddy: use X-Forwarded-* for client IP (rate limiting) and host (origin check).
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: 'validation',
        message: 'Zadané údaje nejsou platné.',
        issues: error.validation.map((v) => ({
          path: v.instancePath.split('/').filter(Boolean),
          message: v.message ?? 'Neplatná hodnota',
        })),
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
        ...(error.issues ? { issues: error.issues } : {}),
      });
    }
    if (error.statusCode === 429) {
      return reply
        .code(429)
        .send({ error: 'rate_limited', message: 'Příliš mnoho pokusů. Zkuste to za chvíli.' });
    }
    if (isResponseSerializationError(error)) {
      request.log.error({ issues: error.cause.issues }, 'response does not match schema');
    } else if ((error.statusCode ?? 500) < 500) {
      return reply.code(error.statusCode!).send({ error: 'bad_request', message: error.message });
    } else {
      request.log.error(error);
    }
    return reply.code(500).send({ error: 'internal', message: 'Neočekávaná chyba serveru.' });
  });

  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Revize API',
        description:
          'API systému pro evidenci a kontrolu technického vybavení. Autentizace session cookie ' +
          'nebo hlavičkou `Authorization: Bearer <token>` z odpovědi `/api/auth/login`.',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'revize_session' },
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
      security: [{ cookieAuth: [] }, { bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
  await app.register(authPlugin, { db, config });

  const auth = createAuthService(db, config);
  const users = createUsersService(db);
  await app.register(
    async (api) => {
      await api.register(healthRoutes, { db });
      await api.register(authRoutes, { auth, config });
      await api.register(usersRoutes, { users });
      await api.register(auditRoutes, { db });
      await api.register(customersRoutes, { customers: createCustomersService(db) });
      await api.register(locationsRoutes, { locations: createLocationsService(db) });
      await api.register(equipmentTypesRoutes, { types: createEquipmentTypesService(db) });
      await api.register(itemsRoutes, { items: createItemsService(db) });
    },
    { prefix: '/api' },
  );

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
