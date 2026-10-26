import {
  apiErrorSchema,
  createCustomerSchema,
  createSiteSchema,
  customerSchema,
  idSchema,
  siteSchema,
  updateCustomerSchema,
  updateSiteSchema,
} from '@revize/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authOf, requirePermission } from '../../auth/plugin.js';
import type { CustomersService } from './service.js';

const params = z.object({ id: idSchema });
const archivedQuery = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
const errors = { 400: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };

export const customersRoutes: FastifyPluginAsyncZod<{ customers: CustomersService }> = async (
  app,
  { customers },
) => {
  const read = requirePermission('customer.read');
  const write = requirePermission('customer.write');
  const tags = ['Zákazníci'];

  app.get(
    '/customers',
    {
      preHandler: read,
      schema: {
        tags,
        summary: 'Seznam zákazníků',
        querystring: archivedQuery,
        response: { 200: z.array(customerSchema) },
      },
    },
    (req) => customers.list(authOf(req), req.query.includeArchived),
  );
  app.get(
    '/customers/:id',
    {
      preHandler: read,
      schema: {
        tags,
        summary: 'Detail zákazníka',
        params,
        response: { 200: customerSchema, ...errors },
      },
    },
    (req) => customers.get(authOf(req), req.params.id),
  );
  app.post(
    '/customers',
    {
      preHandler: write,
      schema: {
        tags,
        summary: 'Založit zákazníka',
        body: createCustomerSchema,
        response: { 201: customerSchema, ...errors },
      },
    },
    async (req, reply) => reply.code(201).send(await customers.create(authOf(req), req.body)),
  );
  app.patch(
    '/customers/:id',
    {
      preHandler: write,
      schema: {
        tags,
        summary: 'Upravit nebo archivovat zákazníka',
        params,
        body: updateCustomerSchema,
        response: { 200: customerSchema, ...errors },
      },
    },
    (req) => customers.update(authOf(req), req.params.id, req.body),
  );

  const siteTags = ['Provozovny'];
  app.get(
    '/customers/:id/sites',
    {
      preHandler: read,
      schema: {
        tags: siteTags,
        summary: 'Provozovny zákazníka',
        params,
        querystring: archivedQuery,
        response: { 200: z.array(siteSchema), ...errors },
      },
    },
    (req) => customers.listSites(authOf(req), req.params.id, req.query.includeArchived),
  );
  app.post(
    '/customers/:id/sites',
    {
      preHandler: write,
      schema: {
        tags: siteTags,
        summary: 'Založit provozovnu',
        params,
        body: createSiteSchema,
        response: { 201: siteSchema, ...errors },
      },
    },
    async (req, reply) =>
      reply.code(201).send(await customers.createSite(authOf(req), req.params.id, req.body)),
  );
  app.get(
    '/sites/:id',
    {
      preHandler: read,
      schema: {
        tags: siteTags,
        summary: 'Detail provozovny',
        params,
        response: { 200: siteSchema, ...errors },
      },
    },
    (req) => customers.getSite(authOf(req), req.params.id),
  );
  app.patch(
    '/sites/:id',
    {
      preHandler: write,
      schema: {
        tags: siteTags,
        summary: 'Upravit nebo archivovat provozovnu',
        params,
        body: updateSiteSchema,
        response: { 200: siteSchema, ...errors },
      },
    },
    (req) => customers.updateSite(authOf(req), req.params.id, req.body),
  );
};
