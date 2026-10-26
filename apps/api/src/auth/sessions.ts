import { newId, permissionsOf, type Role } from '@revize/shared';
import { and, eq, gt, ne } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.js';
import { appUser, session } from '../db/schema.js';
import type { AuthContext } from './context.js';
import { generateToken, hashToken } from './tokens.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sliding expiry is refreshed at most this often to avoid a write on every request. */
const RENEW_AFTER_MS = 60 * 60 * 1000;

export interface NewSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

export async function createSession(
  db: DbOrTx,
  userId: string,
  ttlDays: number,
  meta: { deviceLabel?: string | undefined; userAgent?: string | undefined },
): Promise<NewSession> {
  const token = generateToken();
  const sessionId = newId();
  const expiresAt = new Date(Date.now() + ttlDays * DAY_MS);
  await db.insert(session).values({
    id: sessionId,
    userId,
    tokenHash: hashToken(token),
    deviceLabel: meta.deviceLabel ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    expiresAt,
  });
  return { token, sessionId, expiresAt };
}

/** Returns the caller for a valid, unexpired token of an active user, extending its expiry. */
export async function resolveSession(
  db: DbOrTx,
  token: string,
  ttlDays: number,
  via: AuthContext['via'],
): Promise<AuthContext | null> {
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: session.id,
      lastSeenAt: session.lastSeenAt,
      userId: appUser.id,
      organizationId: appUser.organizationId,
      role: appUser.role,
    })
    .from(session)
    .innerJoin(appUser, eq(appUser.id, session.userId))
    .where(
      and(
        eq(session.tokenHash, hashToken(token)),
        gt(session.expiresAt, now),
        eq(appUser.active, true),
      ),
    )
    .limit(1);
  if (!row) return null;

  if (now.getTime() - row.lastSeenAt.getTime() > RENEW_AFTER_MS) {
    await db
      .update(session)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + ttlDays * DAY_MS) })
      .where(eq(session.id, row.sessionId));
  }
  const role = row.role as Role;
  return {
    userId: row.userId,
    organizationId: row.organizationId,
    role,
    permissions: permissionsOf(role),
    sessionId: row.sessionId,
    via,
  };
}

export async function deleteSession(db: DbOrTx, sessionId: string): Promise<void> {
  await db.delete(session).where(eq(session.id, sessionId));
}

/** Ends all sessions of a user, optionally keeping the current one. */
export async function deleteUserSessions(db: DbOrTx, userId: string, exceptSessionId?: string) {
  await db
    .delete(session)
    .where(
      exceptSessionId
        ? and(eq(session.userId, userId), ne(session.id, exceptSessionId))
        : eq(session.userId, userId),
    );
}
