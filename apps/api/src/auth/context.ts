import type { Permission, Role } from '@revize/shared';

/** Who is calling – resolved from the session cookie or bearer token for every request. */
export interface AuthContext {
  userId: string;
  organizationId: string;
  role: Role;
  permissions: ReadonlySet<Permission>;
  sessionId: string;
  via: 'cookie' | 'bearer';
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
