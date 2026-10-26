import { newId } from '@revize/shared';
import type { DbOrTx } from '../../db/client.js';
import { auditLog } from '../../db/schema.js';

export interface AuditEntry {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

const SECRET_KEYS = new Set(['passwordHash', 'password', 'tokenHash']);

/** Removes secrets and turns dates into strings before the snapshot goes into JSONB. */
function snapshot(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  return JSON.parse(
    JSON.stringify(value, (key, v: unknown) => (SECRET_KEYS.has(key) ? undefined : v)),
  );
}

/** Writes an audit record; call it inside the same transaction as the change. */
export async function recordAudit(db: DbOrTx, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    id: newId(),
    organizationId: entry.organizationId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: snapshot(entry.before),
    after: snapshot(entry.after),
    reason: entry.reason ?? null,
  });
}
