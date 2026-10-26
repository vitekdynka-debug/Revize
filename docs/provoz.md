# Provoz – instalace a spuštění

Celý systém běží na jednom stroji (PC v kanceláři, NAS, domácí server) v Dockeru. Nepotřebuje
žádný placený účet ani službu.

## Požadavky

- Docker Engine s Docker Compose v2 (Linux), případně Docker Desktop (Windows/Mac). Na NASu
  Container Manager (Synology) nebo obdobný.
- Asi 2 GB RAM a disk podle počtu fotek (zhruba 0,5 MB na fotku).
- Procesor x86-64 nebo ARM64.

## První spuštění

```sh
git clone https://github.com/vitekdynka-debug/Revize.git
cd Revize
cp .env.example .env
#   v .env nastavte aspoň POSTGRES_PASSWORD (dlouhé náhodné heslo) a ADMIN_PASSWORD
docker compose up -d --build
docker compose ps        # db, api a web musí být „healthy“ / „running“
```

- Kancelářská aplikace běží na `https://localhost` (při `SITE_ADDRESS=localhost`), QR spike pro
  test skeneru na `https://localhost/spike/`. Prohlížeč upozorní na certifikát místní
  certifikační autority Caddy. Pro první vyzkoušení na stejném PC to stačí.
- Přihlášení: `ADMIN_EMAIL` / `ADMIN_PASSWORD` z `.env`. Pokud jste heslo nevyplnili, vygeneruje
  se náhodné a najdete ho v `docker compose logs api`.
- S `SEED_DEMO=true` se při prvním spuštění vloží ukázková data: zákazník „Ukázkový sklad
  s.r.o.“, celá knihovna typů vybavení podle norem, 35 artiklů (pětimístná i čtyřmístná řada)
  a technik `technik@revize.local` / `technik-demo-heslo`.
- API dokumentace (OpenAPI) je na `https://<adresa>/api/docs`.
- Kontrolu běžící instance udělá `scripts/smoke-test.sh https://<adresa> <admin-email> <heslo>`.

## Přístup z iPadu (HTTPS)

Kamera v PWA vyžaduje platné HTTPS. Varianty a jejich kompromisy popisuje
[ADR-0008](adr/0008-remote-access-https.md). Podrobný návod a výběr varianty patří do M9.
Nejrychlejší cesta k vyzkoušení:

**Tailscale** (doporučeno)

1. Nainstalujte Tailscale na server i na iPad a přihlaste je do stejného účtu (tailnetu).
2. V administraci Tailscale zapněte _MagicDNS_ a _HTTPS Certificates_.
3. Na serveru spusťte `tailscale serve --bg https+insecure://localhost:443`, nebo nastavte
   `SITE_ADDRESS=<stroj>.<tailnet>.ts.net` a předejte Caddy certifikát z `tailscale cert`.
   Přesný postup doplní M9.
4. Na iPadu otevřete `https://<stroj>.<tailnet>.ts.net`.

## Běžná správa

| Úkol                                   | Příkaz                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Stav služeb                            | `docker compose ps`                                                                                                             |
| Logy                                   | `docker compose logs -f api`                                                                                                    |
| Aktualizace na novou verzi             | `git pull && docker compose up -d --build` (migrace databáze proběhnou samy)                                                    |
| Zastavení                              | `docker compose down` (data zůstanou ve svazcích)                                                                               |
| Nový uživatel / obnova přístupu admina | `docker compose exec api node dist/cli/create-user.js --email x@firma.cz --name "Jméno" --role admin --password "dlouhé-heslo"` |
| Ukázková data do prázdné instance      | `docker compose exec api node dist/cli/seed.js`                                                                                 |

Data jsou ve svazcích Dockeru: `revize_db-data` (databáze), `revize_files` (fotky) a
`revize_caddy-data` (certifikáty). Zálohování a ověřenou obnovu přinese M9.

> **Pozor:** `docker compose down -v` smaže i svazky, tedy všechna data.

## Vývoj

```sh
pnpm install
pnpm db:test                       # PostgreSQL v Dockeru pro testy a vývoj (port 5432)
cp apps/api/.env.example apps/api/.env
pnpm api:dev                       # API na http://localhost:3000, dokumentace /api/docs
pnpm --filter @revize/web dev      # kancelář na http://localhost:5173 (API přes proxy)
pnpm check                         # formát, lint, typy, všechny testy (vyžaduje db:test)
```
