# ADR-0011: Model kontroly a hodnocení výsledků

**Stav:** přijato (2026-10-26)

## Rozhodnutí

- Kontrola patří k **jedné provozovně** a může na ní pracovat **více techniků současně**
  (`inspection_inspector`). Protokol uvádí hlavního technika. Kontrolu lze omezit na vybrané
  typy vybavení (`inspection_type_scope`, prázdné = všechny).
- Hodnocení je pevné: `outcome = ok | defect` a u závady `taken_out_of_service` (vyřazení z provozu).
  Konfigurovatelné stupně (např. ČSN EN 15635 zelená/oranžová/červená) nyní **nezavádíme**.
  Kdyby byly potřeba, přidá se `severity` jako další sloupec s migrací.
- Artikl bez výsledku v kontrole je nezkontrolovaný (žádný řádek „not_checked“ se neukládá).
- Uzavřená kontrola je jen pro čtení. Znovuotevření vyžaduje důvod a zapíše se do auditu.
- Při uzavření se artiklům přepočítá `next_inspection_date` (datum kontroly + interval typu,
  případně datum příští kontroly zadané v kontrole).
- Číslo artiklu je unikátní v rámci zákazníka. Zadá ho technik, nebo ho přidělí systém
  (ADR-0004, rezervované bloky).

## Fotky (upřesnění 2026-10-26, podle testu v terénu)

Fotka má právě jednoho vlastníka (`photo_owner_check`, migrace `0001`):

- **artikl:** výrobní štítek, celkový pohled. Zůstává u artiklu napříč kontrolami a jde pořídit
  i u artiklu v pořádku.
- **výsledek kontroly:** fotky závady. Patří k výsledku v dané kontrole.
- **kontrola:** celkové fotky (hala, přístup, situace), nepatří k žádnému artiklu.

V terénu se fotka uloží do IndexedDB hned po vyfocení, ještě před uložením výsledku. Do exportu
ZIP jdou všechny fotky pořízené během kontroly: `10005_01.jpg` (výsledek),
`10005_artikl_01.jpg` (artikl) a `kontrola_01.jpg`. Sidecar CSV obsahuje sloupec „Druh fotky“.

## Formát CSV

CSV podle **RFC 4180**: oddělovač čárka, CRLF, UTF-8 s BOM, čistá tabulka bez úvodních řádků.
Excel na Macu, anglický Excel, Numbers, LibreOffice i Google Sheets ji rozloží do sloupců.
Excel s českým místním nastavením ve Windows čeká středník. Pro lidi je proto hlavní export
**XLSX** a CSV slouží hlavně pro strojové zpracování a import. Pokud se ukáže, že zákazníci
používají český Excel ve Windows, přidá se volba oddělovače.
