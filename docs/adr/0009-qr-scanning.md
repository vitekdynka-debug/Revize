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

## Zjištění z 2. testu na iPadu (2026-10-26)

| Zjištění                                                                              | Příčina                                                                                                                                                     | Úprava (spike v3)                                                                                                                                                                            |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kamera funguje výrazně lépe (výběr u kříže, potvrzení, svítilna a zoom bez zaseknutí) | –                                                                                                                                                           | –                                                                                                                                                                                            |
| Fotky závady se neuložily                                                             | Fotka se zmenšuje asynchronně a „Uložit závadu“ šlo stisknout dřív, než zmenšení doběhlo. Navíc WebKit spolehlivě neukládá `Blob` do IndexedDB.             | „Uložit“ čeká na zpracování fotek (tlačítko ukazuje „Zpracovávám fotku…“). Fotky se ukládají jako `ArrayBuffer`. Po uložení se ověří počet uložených fotek a při nesouladu se zobrazí chyba. |
| Export: „soubory nenalezeny“                                                          | `navigator.share()` se volalo až po asynchronní přípravě souboru, kdy iOS už nebralo gesto za platné. Záložní odkaz ke stažení se navíc po 10 s zneplatnil. | Export má dva kroky: „Připravit export“ a potom „Uložit / sdílet“ přímo v ťuknutí. Odkazy ke stažení platí, dokud je stránka otevřená.                                                       |
| CSV se neotevřelo po sloupcích                                                        | Úvodní řádky s hlavičkou kontroly mátly rozpoznání oddělovače (Numbers, Excel s jiným nastavením).                                                          | Hlavní export je **XLSX** (záhlaví zamčené, filtr, šířky sloupců, druhý list Souhrn). CSV je čistá tabulka.                                                                                  |

## Zjištění z 3. testu na iPadu (2026-10-26)

| Zjištění                                                                                                          | Úprava (spike v4)                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XLSX je v pořádku. CSV (`fotky.csv` i výsledky) se v Excelu na Macu nerozložilo do sloupců.                       | CSV podle RFC 4180 s **čárkou** a UTF-8 BOM, viz ADR-0011                                                                                                                                           |
| Fotky po restartu zůstanou, ale nejdou zobrazit ani smazat. Při opětovném uložení závady se staré fotky ztrácely. | Galerie s náhledy a prohlížečem na celou obrazovku (listování, mazání). Fotky se ukládají hned po vyfocení a výsledek je už nepřepisuje. Zrušení závady zahodí jen fotky pořízené v ní.             |
| Chybí fotky ke kontrole jako celku                                                                                | Sekce „Fotky ke kontrole“ (vlastník = kontrola)                                                                                                                                                     |
| Chybí fotky u artiklu v pořádku (výrobní štítek)                                                                  | „Fotky artiklu“ v kartě (vlastník = artikl, zůstávají i v dalších kontrolách)                                                                                                                       |
| Chybí založení artiklu                                                                                            | Formulář „Nový artikl“: typ, číslo (nabídne další volné), QR kód (lze načíst čtečkou), umístění, pole typu validovaná sdíleným schématem, fotky. Neznámý načtený kód nabídne „Založit nový artikl“. |

Automatické testy při tom odhalily ještě tři chyby:

- Bluetooth čtečce se ztrácel začátek kódu, když se uprostřed na chvíli zastavila, a také
  u kódu načteného hned po spuštění aplikace. Detekce teď posuzuje průměrnou rychlost
  (≤ 35 ms na znak) a krátké výpadky do 300 ms toleruje. Čtečka poslouchá od prvního okamžiku.
- Ťuknutí na popisek „Typ vybavení“ vybralo první tlačítko. Skupiny tlačítek proto mají
  `role="group"` místo `<label>`.
- Změna typu ve formuláři smazala zadané číslo a QR kód.

Pro M7 z toho plyne: exporty na serveru budou primárně XLSX (exceljs) a CSV vždy jako čistá
tabulka bez úvodních řádků.

Funkční nedostatky spiku (chybějící Zrušit, chybějící detail artiklu, kontrolu nešlo ukončit
a exportovat) jsou opravené. Kontrola se ukládá do IndexedDB a exportuje jako CSV + ZIP fotek.

## Důsledky

- Pokud spike ukáže nedostatečnou rychlost v šeru nebo na malých štítcích, nebo ztrátu oprávnění
  ke kameře po restartu, terénní část zabalíme do Capacitoru (ADR-0003 to umožňuje).
