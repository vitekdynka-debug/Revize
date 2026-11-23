# ADR-0023: Ukázková instance pro prezentace

**Stav:** přijato (2026-11-23)

## Kontext

Systém je potřeba předvádět a nechat lidi, ať si ho vyzkouší (focení závad, protokoly, exporty),
aniž by se dostali k ostré databázi. Ukázka na GitHub Pages běží v prohlížeči, ale neumí PDF
(Chromium je jen na serveru) a naplnit ji větším množstvím dat s fotkami trvá v prohlížeči
desítky sekund.

## Rozhodnutí

- **Samostatná instance na serveru** (`docker-compose.showcase.yml`, projekt `revize-ukazka`):
  vlastní databáze, vlastní úložiště fotek, vlastní síť. S ostrou instancí nesdílí nic kromě
  kódu (stejné obrazy, takže všechno funguje stejně, včetně PDF a exportů).
- `SHOWCASE=true`: prázdná databáze se naplní ukázkovými daty (`seed/showcase.ts`):
  smyšlený zákazník _Logistika Vzor s.r.o._, provozovna se dvěma halami a venkovní plochou,
  přes 50 artiklů pěti typů (regály bez čísla TZ, žebříky, vázací prostředky, ocelové
  konstrukce, pevné žebříky), ilustrační fotky (kreslené, `apps/api/assets/showcase`,
  `scripts/showcase-photos.mjs`), loňská uzavřená kontrola a letošní rozpracovaná kontrola
  se závadami všech úrovní, nesplněnými kontrolními body a nezkontrolovanými artikly.
  Data jsou vztažená k dnešku, takže po obnově jsou vždy aktuální.
- **Každou noc** (`SHOWCASE_RESET_HOUR`, výchozí 3:00) se celá databáze i fotky smažou a ukázka
  se založí znovu. Návštěvníci tedy můžou cokoli měnit i mazat.
- Přihlašovací stránka ukázky nabízí účty Administrátor a Technik jedním klepnutím
  (`GET /api/showcase`); hesla jsou veřejná záměrně (`SHOWCASE_PASSWORD`). Na ostré instanci
  (`SHOWCASE` vypnuté) endpoint nic neprozradí.
- **Typy vybavení z ostré instance:** Typy vybavení → _Stáhnout nastavení_ (JSON), soubor
  uložený jako `apps/api/assets/showcase/typy-vybaveni.json` ukázka při každém založení nahraje
  (stejné jako _Nahrát nastavení_ v kanceláři; typ stejného názvu se upraví, jinak založí).
- Ukázka na GitHub Pages zůstává jednodušší (vlastní data v prohlížeči, bez PDF).

## Důsledky

- Na serveru běží dvě aplikace v Dokploy; ukázka má vlastní doménu a vlastní heslo k databázi.
- Účty a data ukázky jsou veřejné: nikdy do ní nenahrávat skutečné údaje zákazníků.
