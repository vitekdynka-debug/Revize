# ADR-0001: Monorepo, TypeScript, pnpm workspaces

**Stav:** přijato (2026-10-26)

## Kontext

Frontend, backend i import sdílejí doménová pravidla (validace polí podle typu vybavení, číslo
artiklu, stavy kontroly). Duplicitní implementace by se rozcházely.

## Rozhodnutí

- TypeScript (strict) všude, ESM, pnpm workspaces: `apps/*`, `packages/*`.
- `packages/shared` je platformně nezávislý (žádné DOM ani Node API) a obsahuje typy, Zod schémata
  a doménovou logiku. `packages/scanner` obsahuje jádro skenování nezávislé na frameworku.
- Vitest (projekty pro každý balíček), ESLint (flat config, typescript-eslint), Prettier.
- TypeScript je dočasně připnutý na 6.0.x, protože typescript-eslint zatím TypeScript 7 nepodporuje.

## Důsledky

- Jedna změna doménového pravidla se projeví na klientu, v API i v importu.
- Balíčky se zatím nesestavují (exportují přímo `.ts`). Bundlery (Vite, tsx/esbuild) je zpracují;
  pokud by API vyžadovalo build, přidá se `tsc -b` s project references.
