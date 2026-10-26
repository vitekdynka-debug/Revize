import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '../../db/client.js';

export const healthRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Provoz'],
        summary: 'Stav API a databáze (pro healthcheck)',
        response: { 200: z.object({ status: z.literal('ok'), database: z.literal('ok') }) },
      },
    },
    async () => {
      await db.execute(sql`select 1`);
      return { status: 'ok' as const, database: 'ok' as const };
    },
  );
};
