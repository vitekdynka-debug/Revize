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

## Důsledky

- Pokud spike ukáže nedostatečnou rychlost v šeru nebo na malých štítcích, nebo ztrátu oprávnění
  ke kameře po restartu, terénní část zabalíme do Capacitoru (ADR-0003 to umožňuje).
