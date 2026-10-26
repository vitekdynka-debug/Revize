# CLAUDE.md – Revize

System for inspection technicians: records of customer equipment (racks, ladders, …), field
inspections on iPad (PWA), office administration and exports. Self-hosted, free, open source only.

## Hard constraints

- **No paid services / SaaS.** Everything runs via Docker Compose on the user's own machine.
  Anything that would cost money → stop and ask. External services get an adapter interface,
  with a free local implementation.
- **Licenses:** permissive only (MIT, Apache-2.0, BSD, ISC, PostgreSQL). Anything else must be
  approved first and recorded in `docs/licenses.md`. Approved exceptions: sharp/libvips (LGPL-3.0),
  ExifTool (Artistic/GPL, external process).
- **No field data may be lost.** Every field write goes to IndexedDB before the UI confirms it.
- Decisions that are hard to change later → stop and ask, then record an ADR in `docs/adr/`.

## Language

- UI texts: **Czech**. Code, identifiers, DB names, comments, commits, CLAUDE.md: **English**.
- Docs in `docs/` (ADRs, guides for the user): Czech.

## Repository layout (pnpm workspaces)

- `packages/shared` – domain types, Zod schemas, domain rules. Platform-agnostic: no DOM, no Node APIs.
- `packages/scanner` – framework-agnostic QR scanning core (camera, decode worker, dedupe,
  keyboard-wedge scanner). Used by the spike now and by `apps/web` later.
- `apps/spike-qr` – milestone M1 QR spike (static PWA, deployed to GitHub Pages).
- `apps/api` – Fastify 5 + Zod type provider, Drizzle + node-postgres.
  - `src/modules/<domain>/{routes,service,repository}.ts`; routes validate with schemas from
    `@revize/shared` (they also generate the OpenAPI doc at `/api/docs`).
  - `src/db/schema.ts` is the whole data model; migrations in `drizzle/` (`pnpm --filter
@revize/api db:generate` after schema changes, commit the SQL). Applied on server start.
  - `src/auth/` sessions (cookie or bearer), `requirePermission()`, Origin check for cookie writes.
  - Errors: throw `AppError` helpers from `src/errors.ts` (Czech message + machine code).
  - Every change in a service goes with `recordAudit(tx, …)` in the same transaction.
  - `src/bootstrap.ts` creates org + first admin on an empty DB; `src/seed/demo.ts` demo data.
  - Tests in `test/` hit a real PostgreSQL (fresh database per run, `TEST_DATABASE_URL`).
- `apps/web` (M3+) – React + Vite; `/field/*` (touch, PWA) and `/office/*` (tables).
  Platform access (camera, scanner, files, storage, feedback) only through `src/platform/` adapters
  (`web` now, `capacitor` later). Never call `navigator.mediaDevices` etc. from components.
- `deploy/` – Caddyfile and the web image (serves the front end, proxies `/api`).
- `docker-compose.yml` + `.env.example` – db, api, web; `scripts/smoke-test.sh` checks a running stack.
- `docs/` – `architecture.md`, `adr/NNNN-*.md`, `licenses.md`, `provoz.md` (operations, Czech).

## Architecture rules

- IDs are UUIDs and may be generated on the client (offline writes). Write endpoints are idempotent
  (`PUT` with client id).
- Every tenant table has `organization_id` (single org for now). Authorization checks
  **permissions**, never role names directly.
- Dynamic equipment fields: definition stored on `equipment_type`, values in `item.field_values`
  JSONB, validated by the Zod schema built in `packages/shared` (same code on client, API, import).
- Closed inspections are read-only; reopening is audited.
- Infrastructure behind interfaces: `FileStorage`, `PdfRenderer`, `ImageProcessor`, `MetadataWriter`.

## Commands

```sh
pnpm install          # install all workspaces
pnpm check            # format:check + lint + typecheck + test (run before every commit)
pnpm test             # vitest (all projects; API tests need PostgreSQL → pnpm db:test)
pnpm db:test          # throwaway PostgreSQL 16 in Docker on :5432 (db:test:stop)
pnpm api:dev          # API with reload on :3000 (apps/api/.env from .env.example)
pnpm typecheck
pnpm lint
pnpm run check:licenses   # dependency license policy (docs/licenses.md)
pnpm spike:dev        # QR spike dev server (camera needs localhost or HTTPS, see apps/spike-qr/README.md)
pnpm spike:build      # static build into apps/spike-qr/dist
pnpm --filter @revize/spike-qr e2e   # Playwright, fake camera feeding a generated QR video
docker compose up -d --build         # whole system (needs .env)
pnpm smoke https://localhost admin@revize.local <heslo>   # smoke test of a running stack
```

## Conventions

- TypeScript strict, ESM, `import type` for types (lint-enforced), Prettier (single quotes, 100 cols).
- Tests next to code as `*.test.ts`. Domain logic in `packages/shared` must be unit-tested.
  Vitest only runs packages that have their own `vitest.config.ts`; Playwright specs live in `e2e/`.
- Playwright is pinned to the preinstalled browser build (`@playwright/test` 1.63.0).
- TypeScript is pinned to 6.0.x until typescript-eslint supports 7.
- API responses never contain secrets; DTO mappers (`toUserDto`…) define what leaves the server.
- Dates leave the API as ISO strings; e-mails are stored trimmed and lower-cased.
- Commits: English, imperative, one milestone step per commit; `pnpm check` must pass.
- After each milestone: update this file, `docs/architecture.md` and add/adjust ADRs.

## Status

- M0 repo skeleton – done.
- M1 QR spike – iteration 2 after the first iPad test (findings in ADR-0009); waiting for round 2
  results (`docs/spike-qr-test-protocol.md`). Decision PWA vs Capacitor pending.
- M2 backend foundation – done: full DB schema + migration, auth (sessions, roles/permissions),
  users, audit, OpenAPI, FileStorage (local disk), Docker Compose stack, demo seed.
- Next: M3 master data in the office UI (`apps/web`).
