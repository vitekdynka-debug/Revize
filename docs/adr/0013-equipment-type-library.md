# ADR-0013: Knihovna typů vybavení podle norem

**Stav:** přijato (2026-10-26)

## Kontext

Typy vybavení jsou konfigurovatelné (ADR-0006). Aby administrátor nezačínal od nuly a pole byla
odborně podložená, systém nabízí knihovnu výchozích typů.

## Rozhodnutí

- `EQUIPMENT_TYPE_PRESETS` ve `shared` (`equipment-presets.ts`) obsahuje typ, pole s číselníky
  a nápovědou, výchozí interval a text protokolu. Ukázková data ji použijí celou. V administraci
  (M3) půjde typ z knihovny přidat a potom libovolně upravit. Upravený typ je nezávislý na knihovně.
- Textová pole mají volitelné `suggestions`, tedy nabídku obvyklých hodnot (výrobci), a `help`.
- Texty protokolů obsahují zástupné symboly `{{zakaznik}}`, `{{provozovna}}`,
  `{{datum_kontroly}}`, `{{technik}}` a `{{datum_pristi_kontroly}}` (`fillProtocolTemplate`).
- Obsah knihovny a zdroje popisuje [docs/typy-vybaveni.md](../typy-vybaveni.md).

## Důsledky

- Texty protokolů jsou **návrhy**. Revizní firma je musí zkontrolovat proti aktuálnímu znění
  norem a vlastní praxi, protože plné texty norem nejsou volně dostupné.
