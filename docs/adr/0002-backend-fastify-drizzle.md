# ADR-0002: Backend Fastify + Drizzle + PostgreSQL

**Stav:** přijato (2026-10-26)

## Kontext

Potřebujeme REST API s OpenAPI, validaci sdílenou s klientem, migrace a dobrou práci s JSONB
(vlastní pole artiklů) a se stromem umístění.

## Rozhodnutí

- **Fastify 5** (MIT) s `fastify-type-provider-zod` a `@fastify/swagger`: Zod schémata ze `shared`
  slouží zároveň k validaci i ke generování OpenAPI. NestJS jsme zamítli: přidává dekorátory a DI
  framework, které při této velikosti týmu nic nepřinesou, a Zod tam funguje hůř.
- Struktura: `src/modules/<domain>/{routes,service,repository}.ts`; infrastruktura v `src/infra/`
  za rozhraními.
- **Drizzle ORM** (Apache-2.0) + drizzle-kit: schéma v TS, migrace jako čitelné SQL soubory
  v repozitáři. Prisma jsme zamítli: má vlastní binární engine, slabší podporu JSONB a polí
  a horší kontrolu nad SQL (rekurzivní CTE, `uuid[]`).
- **PostgreSQL 16**: umístění jako adjacency list s materializovanými `path_ids uuid[]` a `sort_path`.

## Upřesnění při implementaci (M2)

- Výčtové hodnoty (`role`, `status`, `outcome`) jsou `text` s `CHECK`, ne PG enum. Přidání
  hodnoty je pak jednořádková migrace bez `ALTER TYPE`.
- ID se generují jako UUIDv7 (`newId()` ze `shared`). Jsou časově řaditelná, takže mají dobrou
  lokalitu indexu a slouží i ke stránkování auditu.
- Migrace leží v `apps/api/drizzle/` a spouští se automaticky při startu API
  (`MIGRATE_ON_START`). Ručně se dají spustit přes `node dist/cli/migrate.js`.
- Produkční build: esbuild sbalí API i workspace balíčky do `dist/`, npm závislosti zůstávají
  v `node_modules` image (`pnpm deploy`).
- Testy API běží proti skutečnému PostgreSQL. Každý běh si založí vlastní databázi
  (`test/global-setup.ts`) a v CI je k tomu služba `postgres`.

## Důsledky

- Migrace se generují (`drizzle-kit generate`) a commitují a v produkci se spouští při startu API.
- Složitější dotazy (historie, filtrované exporty) píšeme v SQL přes Drizzle `sql` helper.
