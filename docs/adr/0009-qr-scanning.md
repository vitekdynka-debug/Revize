# ADR-0009: Skenování QR kódů

**Stav:** navrženo – potvrdit podle výsledků spike (M1)

## Kontext

Skenování musí být rychlejší než ruční zadání pětimístného čísla. iOS Safari zatím nemá
`BarcodeDetector` a vibrace a svítilna jsou v PWA omezené.

## Rozhodnutí

- Dekodér **zxing-wasm** (zxing-cpp, Apache-2.0, wrapper MIT) ve **Web Workeru**, WASM je
  součástí aplikace (žádné CDN). Pokud prohlížeč nabízí nativní `BarcodeDetector`, spike ho
  změří jako alternativu.
- Snímky se berou jen z **výřezu (ROI)** uprostřed obrazu a zmenší se na nejvýše 720 px. V
  dekodéru je zároveň jen jeden snímek (backpressure).
- Skener zůstává otevřený. Po načtení se dekódování pozastaví, zobrazí se karta s OK / Závada
  a pak se skenování obnoví. Stejný kód načtený znovu do 2,5 s se ignoruje (cooldown).
- **Bluetooth čtečky v režimu klávesnice:** globální posluchač pozná rychlou sérii znaků
  (≤ 50 ms mezi znaky) zakončenou Enterem, kdekoli v terénním režimu.
- **Obsah štítku (fáze 2):** URL `https://<server>/q/<code>`. Kamera iOS pak umí otevřít
  aplikaci i bez spuštěného skeneru. `code` je hodnota `item.qr_code`, která nemusí být rovna
  číslu artiklu. Čistý pětimístný obsah se bere jako číslo artiklu (`parseScanPayload` v `shared`).
- Jádro je v `packages/scanner`, nezávislé na frameworku. Capacitor adaptér by implementoval
  stejné rozhraní `ScannerService` nativní čtečkou.

## Zjištění z 1. testu na iPadu (2026-10-26)

| Zjištění                                                                    | Příčina                                                                                              | Úprava (spike v2)                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Čtení je rychlé, dekodér stíhá                                              | –                                                                                                    | –                                                                                                                                                                                                                                             |
| Na archu se štítky vedle sebe se hned po zavření karty načte náhodný soused | zxing vrací více kódů a brali jsme první; hned po zavření karty se skenovalo znovu                   | výběr kódu **nejblíž zaměřovacímu kříži** (`pickCentralCode`, zóna kolem středu), kód se přijme až po **3 načteních po sobě** (`StableReadFilter`), **prodleva 0,8 s** po zavření karty, volitelný režim „Načíst“ (dekóduje se jen po stisku) |
| Zaseknutí aplikace při zapnuté svítilně a posunu zoomu                      | souběžná volání `applyConstraints` při tažení posuvníku; iOS Safari se zasekne                       | `ConstraintQueue`: nejvýš jedno volání najednou, změny se slučují a vždy se posílá úplný stav (svítilna i zoom), k tomu tlačítka 1×/2×/3×                                                                                                     |
| Po úplném zavření aplikace se iPad znovu ptá na kameru                      | iOS u webových aplikací na ploše nepamatuje oprávnění kamery mezi spuštěními. Z PWA to obejít nejde. | Zdokumentováno. Je to **argument pro Capacitor**, protože nativní aplikace si oprávnění pamatuje trvale.                                                                                                                                      |

Funkční nedostatky spiku (chybějící Zrušit, chybějící detail artiklu, kontrolu nešlo ukončit
a exportovat) jsou opravené. Kontrola se ukládá do IndexedDB a exportuje jako CSV + ZIP fotek.

## Důsledky

- Pokud spike ukáže nedostatečnou rychlost v šeru nebo na malých štítcích, nebo ztrátu oprávnění
  ke kameře po restartu, terénní část zabalíme do Capacitoru (ADR-0003 to umožňuje).
