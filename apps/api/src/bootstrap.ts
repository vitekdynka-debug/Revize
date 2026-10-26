import { randomBytes } from 'node:crypto';
import { newId } from '@revize/shared';
import type { FastifyBaseLogger } from 'fastify';
import { hashPassword } from './auth/passwords.js';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import { appUser, organization } from './db/schema.js';
import { recordAudit } from './modules/audit/service.js';
import { usersRepository } from './modules/users/repository.js';
import { seedDemo } from './seed/demo.js';

/**
 * First start on an empty database: creates the organization and the first administrator
 * (and demo data when SEED_DEMO=true). Does nothing once any user exists.
 */
export async function bootstrap(db: Db, config: Config, log: FastifyBaseLogger): Promise<void> {
  if ((await usersRepository.countAll(db)) > 0) return;

  const generated = config.ADMIN_PASSWORD === undefined || config.ADMIN_PASSWORD === '';
  const password = generated ? randomBytes(12).toString('base64url') : config.ADMIN_PASSWORD!;
  const organizationId = newId();
  const adminId = newId();

  await db.transaction(async (tx) => {
    await tx.insert(organization).values({ id: organizationId, name: config.ORG_NAME });
    await tx.insert(appUser).values({
      id: adminId,
      organizationId,
      email: config.ADMIN_EMAIL.trim().toLowerCase(),
      displayName: 'Administrátor',
      role: 'admin',
      passwordHash: await hashPassword(password),
    });
    await recordAudit(tx, {
      organizationId,
      actorUserId: null,
      action: 'system.bootstrap',
      entityType: 'organization',
      entityId: organizationId,
      after: { name: config.ORG_NAME, adminEmail: config.ADMIN_EMAIL },
    });
  });

  if (generated) {
    log.warn(
      `První spuštění: vytvořen administrátor ${config.ADMIN_EMAIL} s heslem ${password} ` +
        '– po přihlášení ho změňte.',
    );
  } else {
    log.info(`První spuštění: vytvořen administrátor ${config.ADMIN_EMAIL}.`);
  }

  if (config.SEED_DEMO) {
    await seedDemo(db, organizationId);
    log.info('Vložena ukázková data (zákazník, typy vybavení, artikly).');
  }
}
