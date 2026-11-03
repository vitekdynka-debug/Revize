import { describe, expect, it } from 'vitest';
import { createDatabase } from './client.js';

const server = new URL(
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres',
);

describe('createDatabase', () => {
  it('connects with a password passed apart from the URL (reserved characters allowed)', async () => {
    const password = decodeURIComponent(server.password);
    const withoutPassword = new URL(server);
    withoutPassword.password = '';
    const database = createDatabase(withoutPassword.toString(), password);
    try {
      const { rows } = await database.pool.query<{ ok: number }>('select 1 as ok');
      expect(rows).toEqual([{ ok: 1 }]);
    } finally {
      await database.close();
    }
  });

  it('keeps special characters of the password intact', async () => {
    const password = 'p@ss:word/with%reserved#chars';
    const database = createDatabase('postgres://revize@db:5432/revize', password);
    const client = new (await import('pg')).default.Client(database.pool.options);
    expect(client.password).toBe(password);
    await database.close();
  });
});
