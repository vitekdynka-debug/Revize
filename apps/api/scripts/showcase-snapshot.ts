// The browser showcase (/ukazka/, ADR-0023): the demo database with the showcase data built
// once here, so visitors get it at once instead of seeding it in their browser (~30 s).
// Run: tsx scripts/showcase-snapshot.ts <out.tar.gz>
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { hash as demoHash } from '../../web/src/demo/shims/argon2.js';
import type { Db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { PgliteFileStorage } from '../src/demo/files.js';
import { createDemoApi, DEMO_ADMIN } from '../src/demo/index.js';
import { DEMO_INSPECTOR } from '../src/seed/demo.js';
import { SharpImageProcessor } from '../src/infra/sharp-image-processor.js';
import { seedShowcase } from '../src/seed/showcase.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) throw new Error('Usage: showcase-snapshot.ts <out.tar.gz>');

const drizzleDir = join(here, '../drizzle');
const migrations = await Promise.all(
  (await readdir(drizzleDir))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map(async (f) => ({
      tag: f.replace(/\.sql$/, ''),
      sql: await readFile(join(drizzleDir, f), 'utf8'),
    })),
);

const images = new SharpImageProcessor();
const client = await PGlite.create();
await createDemoApi(client, migrations, images);
const db = drizzle(client, { schema, casing: 'snake_case' }) as unknown as Db;
const files = new PgliteFileStorage(client);
await files.init();
const [org] = await db.select({ id: schema.organization.id }).from(schema.organization).limit(1);
await seedShowcase(
  {
    db,
    files,
    images,
    inspectorPassword: DEMO_INSPECTOR.password,
    loadPhoto: async (name) =>
      new Uint8Array(await readFile(join(here, '../assets/showcase', `${name}.jpg`))),
  },
  org!.id,
);
// Passwords as the browser checks them (the demo's stand-in for argon2, not argon2 itself).
for (const account of [DEMO_ADMIN, DEMO_INSPECTOR]) {
  await db
    .update(schema.appUser)
    .set({ passwordHash: await demoHash(account.password) })
    .where(eq(schema.appUser.email, account.email));
}
const dump = await client.dumpDataDir('gzip');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, new Uint8Array(await dump.arrayBuffer()));
await client.close();
console.log(`Showcase snapshot → ${out} (${Math.round(dump.size / 1024)} kB)`);
