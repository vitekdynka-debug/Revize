import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { equipmentTypesExportSchema } from '@revize/shared';
import { sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { bootstrap } from './bootstrap.js';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import { organization, photo } from './db/schema.js';
import type { FileStorage } from './infra/file-storage.js';
import type { ImageProcessor } from './infra/image-processor.js';
import { seedShowcase } from './seed/showcase.js';

interface ShowcaseServer {
  db: Db;
  config: Config;
  files: FileStorage;
  images: ImageProcessor;
  log: FastifyBaseLogger;
}

/** Fills the showcase database (first start) and schedules the nightly reset (ADR-0023). */
export async function startShowcase(server: ShowcaseServer): Promise<void> {
  await seed(server);
  const hour = server.config.SHOWCASE_RESET_HOUR;
  if (hour < 0) return;
  const schedule = () => {
    const wait = msUntilPragueHour(hour);
    server.log.info(`Ukázka: další obnova dat za ${Math.round(wait / 60000)} min.`);
    setTimeout(() => {
      resetShowcase(server)
        .catch((error: unknown) => server.log.error(error, 'Ukázka: obnova dat selhala'))
        .finally(schedule);
    }, wait).unref();
  };
  schedule();
}

async function seed({ db, config, files, images, log }: ShowcaseServer) {
  const [org] = await db.select({ id: organization.id }).from(organization).limit(1);
  if (!org) return;
  const seeded = await seedShowcase(
    {
      db,
      files,
      images,
      inspectorPassword: config.SHOWCASE_PASSWORD,
      loadPhoto: async (name) =>
        new Uint8Array(await readFile(join(config.SHOWCASE_ASSETS_DIR, `${name}.jpg`))),
      // The types of the real instance, when exported there and added as typy-vybaveni.json.
      loadTypes: async () => {
        try {
          const text = await readFile(
            join(config.SHOWCASE_ASSETS_DIR, 'typy-vybaveni.json'),
            'utf8',
          );
          return equipmentTypesExportSchema.parse(JSON.parse(text));
        } catch {
          return null;
        }
      },
    },
    org.id,
  );
  if (seeded) log.info('Ukázka: vložena ukázková data.');
}

/**
 * Back to the start: every photo file and every row of the showcase database go, then the
 * first start runs again (organization, administrator, showcase data).
 */
export async function resetShowcase(server: ShowcaseServer): Promise<void> {
  const { db, files, log } = server;
  log.info('Ukázka: obnovuji data.');
  const stored = await db
    .select({ key: photo.storageKey, thumbnail: photo.thumbnailKey })
    .from(photo);
  const [logo] = await db.select({ key: organization.logoKey }).from(organization).limit(1);
  const tables = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const names = tables.rows.map((t) => `"${t.tablename}"`).join(', ');
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
  for (const key of [...stored.flatMap((p) => [p.key, p.thumbnail]), logo?.key]) {
    if (key) await files.delete(key).catch(() => undefined);
  }
  await bootstrap(db, server.config, log);
  await seed(server);
}

/** Milliseconds until the next `hour`:00 in Czech time. */
export function msUntilPragueHour(hour: number, now = new Date()): number {
  const pragueNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  const target = new Date(pragueNow);
  target.setHours(hour, 0, 0, 0);
  if (target <= pragueNow) target.setDate(target.getDate() + 1);
  return target.getTime() - pragueNow.getTime();
}
