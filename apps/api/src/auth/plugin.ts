import type { Permission } from '@revize/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import { forbidden, unauthorized } from '../errors.js';
import { resolveSession } from './sessions.js';

export const SESSION_COOKIE = 'revize_session';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Resolves `request.auth` from the session cookie or an `Authorization: Bearer` token and
 * protects cookie-authenticated writes against CSRF by checking the `Origin` header
 * (in addition to the SameSite=Lax cookie).
 */
export const authPlugin = fp<{ db: Db; config: Config }>(async (app, { db, config }) => {
  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (request) => {
    const header = request.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const cookie = request.cookies[SESSION_COOKIE];
    const token = bearer ?? cookie;
    if (!token) return;

    const via = bearer ? 'bearer' : 'cookie';
    if (via === 'cookie' && UNSAFE_METHODS.has(request.method)) {
      assertSameOrigin(request, config.TRUSTED_ORIGINS);
    }
    request.auth = await resolveSession(db, token, config.SESSION_TTL_DAYS, via);
  });
});

function assertSameOrigin(request: FastifyRequest, trusted: string[]) {
  const origin = request.headers.origin;
  // Non-browser clients do not send Origin; browsers always do for cross-site writes.
  if (!origin) return;
  const host = request.headers['x-forwarded-host'] ?? request.headers.host;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden('Neplatný původ požadavku.');
  }
  if (originHost === host || trusted.includes(origin)) return;
  throw forbidden('Požadavek z cizí stránky byl odmítnut.');
}

/** preHandler: the caller must be signed in. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.auth) throw unauthorized();
}

/** preHandler factory: the caller must hold the permission. */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.auth) throw unauthorized();
    if (!request.auth.permissions.has(permission)) throw forbidden();
  };
}

/** The signed-in caller inside handlers protected by requireAuth/requirePermission. */
export function authOf(request: FastifyRequest) {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

export type { FastifyInstance };
