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
- `apps/api` (M2+) – Fastify, modules `routes → service → repository (Drizzle)`.
- `apps/web` (M3+) – React + Vite; `/field/*` (touch, PWA) and `/office/*` (tables).
  Platform access (camera, scanner, files, storage, feedback) only through `src/platform/` adapters
  (`web` now, `capacitor` later). Never call `navigator.mediaDevices` etc. from components.
- `docs/` – `architecture.md`, `adr/NNNN-*.md`, `licenses.md`, milestone notes.

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
pnpm test             # vitest (all projects)
pnpm typecheck
pnpm lint
pnpm run check:licenses   # dependency license policy (docs/licenses.md)
pnpm spike:dev        # QR spike dev server (camera needs localhost or HTTPS, see apps/spike-qr/README.md)
pnpm spike:build      # static build into apps/spike-qr/dist
pnpm --filter @revize/spike-qr e2e   # Playwright, fake camera feeding a QR video (needs ffmpeg)
```

## Conventions

- TypeScript strict, ESM, `import type` for types (lint-enforced), Prettier (single quotes, 100 cols).
- Tests next to code as `*.test.ts`. Domain logic in `packages/shared` must be unit-tested.
  Vitest only runs packages that have their own `vitest.config.ts`; Playwright specs live in `e2e/`.
- Playwright is pinned to the preinstalled browser build (`@playwright/test` 1.63.0).
- TypeScript is pinned to 6.0.x until typescript-eslint supports 7.
- Commits: English, imperative, one milestone step per commit; `pnpm check` must pass.
- After each milestone: update this file, `docs/architecture.md` and add/adjust ADRs.

## Status

- M0 repo skeleton – done.
- M1 QR spike – iteration 2 after the first iPad test (findings in ADR-0009); waiting for round 2
  results (`docs/spike-qr-test-protocol.md`). Decision PWA vs Capacitor pending.
