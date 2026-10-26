# QR spike (milník M1)

Minimální statická PWA k otestování skenování QR kódů na reálném iPadu. Nemá backend a data
jsou smyšlená: artikly 10001–10050. Jádro skeneru je v `packages/scanner` a později se
použije beze změny v `apps/web`.

## Co umí

- **Kontrola:** zahájení, průběh „zkontrolováno X z Y“, seznam artiklů seřazený podle umístění
  (nezkontrolované / zkontrolované / vše), ukončení se souhrnem a export **tabulky (XLSX** s listy Výsledky a Souhrn, k tomu **CSV)**
  a **fotek (ZIP** se soubory `číslo_01.jpg` a sidecar CSV). Export má dva kroky: Připravit,
  potom Uložit / sdílet, protože iOS otevře nabídku Sdílet jen přímo z ťuknutí. Výsledky i fotky se uloží do
  IndexedDB dřív, než se karta zavře, takže přežijí i zavření aplikace.
- **Rychlá kontrola kamerou:** skener zůstává otevřený. Po načtení se ukáže karta s detailem
  artiklu (umístění, vlastní pole, poslední a příští kontrola) a s tlačítky **V pořádku /
  Závada / Zrušit**. U závady se zadává popis, příznak vyřazení a fotky (zmenšené na 2048 px).
- **Fotky:** u závady, u artiklu (štítek, i u artiklu v pořádku) a ke kontrole jako celku.
  Ukládají se hned po vyfocení, náhledy otevřou prohlížeč na celou obrazovku (listování, mazání).
- **Nový artikl** v terénu: typ, číslo (nabídne další volné), QR kód, umístění, pole typu
  (stejné definice a validace jako na serveru), fotky. Neznámý načtený kód nabídne jeho založení.
- **Výběr správného štítku:** načte se kód nejblíž zaměřovacímu kříži. Přijme se až po několika
  shodných načteních a po zavření karty je krátká prodleva. Volitelně lze skenovat jen po
  stisku „Načíst“.
- Dekodér zxing-wasm ve Web Workeru (WASM je součástí aplikace, nic se nestahuje z CDN), nebo
  nativní `BarcodeDetector`, pokud ho prohlížeč má.
- Skenuje se jen ve výřezu uprostřed obrazu (ROI) a výřez se zmenší pro dekodér. Svítilna
  a zoom (posuvník a tlačítka 1×/2×/3×, změny jdou za sebou, aby se iOS nezasekl) fungují tam,
  kde je zařízení podporuje. Zvuk při načtení, experimentální haptika na
  iOS 18+, ochrana proti dvojímu načtení a Wake Lock (displej nezhasne).
- **Bluetooth čtečka** v režimu klávesnice funguje na kterékoli obrazovce: rychlá série znaků
  zakončená Enterem.
- **Ruční zadání** dvěma způsoby: systémová numerická klávesnice, nebo číselník v aplikaci.
  Artikl se vyhledá hned po páté číslici.
- **Testovací arch QR** k tisku: velikosti 8–40 mm, obsah jako číslo nebo URL, korekce chyb
  L/M/H, nízký kontrast.
- **Měření** každého pokusu (doba do načtení, doba rozhodnutí, čas dekódování, start kamery,
  stav oprávnění) se souhrnem mediánů a exportem do CSV. Postup testu popisuje
  [`docs/spike-qr-test-protocol.md`](../../docs/spike-qr-test-protocol.md).

## Spuštění

```sh
pnpm install
pnpm spike:dev                     # http://localhost:5173 (kamera jen na localhost nebo přes HTTPS)
pnpm spike:build                   # statický build do apps/spike-qr/dist
pnpm --filter @revize/spike-qr e2e # Playwright: falešná kamera s QR kódem, viewport iPadu (potřebuje ffmpeg)
```

## Nasazení pro iPad

Workflow `.github/workflows/pages-spike.yml` po každém pushi do `main` nasadí build na
`https://<uživatel>.github.io/<repo>/`. Před prvním nasazením je potřeba jednou nastavit
**Settings → Pages → Source: GitHub Actions**.

> GitHub Pages je na bezplatném účtu dostupné jen pro **veřejné** repozitáře. Pokud je repo
> soukromé, jsou dvě bezplatné možnosti: repozitář zveřejnit (spike neobsahuje žádná data),
> nebo spustit `pnpm spike:build && pnpm --filter @revize/spike-qr preview` na vlastním počítači
> a zpřístupnit ho přes `tailscale serve --https=443 4173` (HTTPS certifikát `*.ts.net`).
