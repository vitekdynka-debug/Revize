# QR spike – testovací protokol pro iPad

Cíl: rozhodnout, zda terénní část zvládne PWA, nebo ji zabalíme do Capacitoru s nativní čtečkou
(ADR-0009). Kritérium úspěchu: **skenování musí být rychlejší než ruční zadání pětimístného čísla**,
a to spolehlivě i v reálných podmínkách.

## Příprava

1. Vytiskněte testovací arch: v aplikaci _Testovací arch QR → Tisk / uložit PDF_, A4, měřítko 100 %.
   Pravítkem ověřte, že kód 40 mm má opravdu 40 mm.
2. Část štítků nalepte na reálné místo (regál, žebřík), část na šikmou nebo zakřivenou plochu.
3. Na iPadu otevřete adresu spiku v Safari a dejte _Sdílet → Přidat na plochu_. Test spouštějte
   z ikony na ploše.
4. Zaznamenejte model iPadu a verzi iPadOS (_Nastavení → Prostředí_ ve spiku ukazuje i user agent).

## Testy

Po každém bloku si poznamenejte dojmy. Čísla se ukládají sama do _Měření_.

| #   | Test                      | Jak                                                                                                            | Co sledovat                                                  |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| T1  | První spuštění            | Spusťte z plochy, _Rychlá kontrola_, povolte kameru.                                                           | Výzva k oprávnění, doba startu kamery                        |
| T2  | **Oprávnění po restartu** | Zavřete aplikaci (swipe z přepínače aplikací), znovu spusťte, _Rychlá kontrola_. Opakujte i po restartu iPadu. | Ptá se iPad znovu na kameru? (v logu `kamera start … perm=`) |
| T3  | Rychlost – kamera         | Arch C (30 štítků 20 mm): naskenujte postupně všechny, u každého _V pořádku_.                                  | Medián „Celkem" pro _Kamera (QR)_                            |
| T4  | Rychlost – číselník       | Stejných 30 čísel zadejte přes _Ruční zadání – číselník_.                                                      | Medián „Celkem" pro _Číselník_                               |
| T5  | Rychlost – klávesnice     | Totéž přes _Ruční zadání – klávesnice_.                                                                        | Objeví se klávesnice sama po každém artiklu?                 |
| T6  | Malé štítky               | Arch A: zkuste 8, 10, 12 a 15 mm z běžné vzdálenosti, potom se zoomem.                                         | Nejmenší spolehlivě čitelná velikost, číslo vs. URL          |
| T7  | Šero                      | Totéž ve skladu se zhasnutým světlem nebo v šeru, se svítilnou i bez ní (pokud se tlačítko zobrazí).           | Úspěšnost, doba načtení                                      |
| T8  | Šikmý úhel, odlesky       | Štítky pod úhlem 30–60°, na lesklé fólii nebo za stretch fólií.                                                | Úspěšnost                                                    |
| T9  | Nízký kontrast            | Arch B (šedé kódy, korekce L/H).                                                                               | Rozdíl L vs. H                                               |
| T10 | Dvojí načtení             | Nechte kód v záběru i po OK.                                                                                   | Nesmí se znovu otevřít karta                                 |
| T11 | Fotka závady              | U artiklu _Závada → Vyfotit závadu_, potom _Uložit_.                                                           | Naběhne skener po návratu sám?                               |
| T12 | Bluetooth čtečka          | Pokud ji máte: spárujte v režimu klávesnice (HID) se sufixem Enter a skenujte na libovolné obrazovce.          | Otevře se karta?                                             |
| T13 | Zvuk a haptika            | Zkuste se zapnutým i vypnutým tichým režimem.                                                                  | Je zvuk slyšet? Je cítit haptika (iOS 18+)?                  |
| T14 | Nastavení                 | Zopakujte T3 s ROI 40 % / 80 % a s rozlišením 720p / 4k.                                                       | Vliv na rychlost a spolehlivost                              |

## Kolo 2 (po úpravách 2026-10-26)

| #   | Test             | Jak                                                                                                                                                                                                                                                   | Co sledovat                                                               |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| R1  | Sousední štítky  | Arch C: míříte křížem na jeden štítek, sousedé jsou v záběru.                                                                                                                                                                                         | Načte se vždy ten pod křížem? Je rychlost pořád v pohodě?                 |
| R2  | Citlivost        | _Nastavení_: Potvrzení 1/2/3/5, Prodleva 0–1,5 s, Zóna úzká/střední/široká.                                                                                                                                                                           | Která kombinace je nejlepší? (výchozí: 3, 0,8 s, střední)                 |
| R3  | Režim „Načíst“   | _Nastavení → Spouštění skenu → Až po stisku „Načíst“_.                                                                                                                                                                                                | Je to pro hustě nalepené štítky lepší než automatický režim?              |
| R4  | Svítilna + zoom  | Zapněte svítilnu a táhněte posuvníkem zoomu tam a zpět, zkuste i tlačítka 1×/2×/3×.                                                                                                                                                                   | Nesmí se zaseknout. Zůstane svítilna zapnutá?                             |
| R5  | Celá kontrola    | _Zahájit kontrolu_, část artiklů skenem, část ze _Seznamu_, jednu závadu s fotkami a vyřazením, pak zavřete aplikaci (swipe), znovu otevřete a zkontrolujte, že nic nezmizelo. _Ukončit kontrolu → Výsledky (CSV) a Fotky (ZIP)_ → Uložit do Souborů. | Data po restartu, obsah CSV/ZIP v aplikaci Soubory, otevření CSV v Excelu |
| R6  | Oprávnění kamery | Zkuste _Nastavení iPadu → Aplikace → Safari → Kamera → Povolit_ a znovu T2.                                                                                                                                                                           | Ptá se pořád? (pokud ano, je to omezení PWA, viz ADR-0009)                |

## Kolo 3 (po úpravách fotek a exportu)

Před testem: na úvodní obrazovce dole **„Aktualizovat aplikaci“**. Verze musí být z 26. 10. 2026
nebo novější.

| #   | Test              | Jak                                                                                             | Co sledovat                                                                              |
| --- | ----------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| F1  | Fotky             | Závada → _Vyfotit závadu_ (2–3 fotky) a hned _Uložit závadu_. Potom artikl otevřete znovu.      | Karta ukazuje „(N foto)“? Po vyfocení se tlačítko krátce přepne na „Zpracovávám fotku…“. |
| F2  | Fotky po restartu | Zavřete aplikaci (swipe), otevřete a zkontrolujte totéž.                                        | Počet fotek sedí.                                                                        |
| F3  | Export            | _Ukončit kontrolu → Připravit export_. U každého souboru _Uložit / sdílet → Uložit do Souborů_. | V Souborech je .xlsx, .csv a -fotky.zip.                                                 |
| F4  | Tabulka           | Otevřete .xlsx v Numbers nebo Excelu.                                                           | Sloupce, zamčené záhlaví, filtr, list Souhrn.                                            |
| F5  | Fotky v ZIP       | Rozbalte ZIP v Souborech.                                                                       | `10005_01.jpg`… a `fotky.csv`                                                            |

## Kolo 4 (fotky, nové artikly)
Před testem: na úvodní obrazovce **„Aktualizovat aplikaci“**.

| # | Test | Co sledovat |
|---|---|---|
| N1 | Závada se 2–3 fotkami → Uložit. Artikl otevřete znovu → Závada → ťukněte na náhled. | Fotka na celou obrazovku, listování ‹ ›, Smazat. Fotky zůstanou i po dalším „Uložit závadu“. |
| N2 | U artiklu v pořádku *Vyfotit artikl (štítek…)* → V pořádku. | Fotka je u artiklu vidět i příště. |
| N3 | *Seznam artiklů → Fotky ke kontrole* → vyfotit halu. | Fotka v sekci a v ZIPu jako `kontrola_01.jpg` |
| N4 | *＋ Nový artikl*: typ, číslo (nabídne další volné), umístění, pole, fotka štítku → *Uložit a zkontrolovat*. | Ihned se otevře karta nového artiklu. V seznamu je označený „nový“. |
| N5 | *Uložit a založit další* | Stejná hala a řada, další pozice a další volné číslo |
| N6 | Načtěte QR kód, který v evidenci není → *Založit nový artikl*. | QR kód je předvyplněný. Po uložení ho skener najde. |
| N7 | Export → `.csv` a `fotky.csv` otevřete v Excelu. | Sloupce rozložené (oddělovač je teď čárka) |

## Výstup

_Měření → Sdílet CSV_ (nebo _Stáhnout CSV_) a soubor mi pošlete spolu s poznámkami:

- model iPadu a verze iPadOS,
- nejmenší spolehlivá velikost štítku a doporučený obsah (číslo nebo URL),
- odpovědi k T2, T5, T7, T11, T13,
- subjektivně: je skenování pohodlnější a rychlejší než číselník?

## Rozhodovací pravidla

- Medián „Celkem" u kamery je **výrazně nižší** než u číselníku a T2, T7 a T11 jsou bez zásadních
  problémů → **PWA stačí**.
- Kamera je pomalejší, nespolehlivá v šeru nebo na malých štítcích, nebo iPad žádá o oprávnění
  při každém spuštění → **Capacitor s nativní čtečkou** (stejné rozhraní `ScannerService`).
- Bluetooth čtečka funguje vždy a je nezávislá na volbě PWA nebo Capacitor.
