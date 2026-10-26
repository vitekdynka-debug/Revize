# Kancelář – návod k evidenci (M3)

Přihlášení na `https://<server>/` (účet administrátora z `.env`).

1. **Zákazníci → Nový zákazník:** název, IČO, adresa, kontakt.
2. **Detail zákazníka → Nová provozovna.**
3. **Provozovna → Umístění:**
   - _Hlavní umístění_ (např. Hala A), pod ním **＋** (např. Řada 1).
   - Pro pozice zvolte v menu **⋯ → Přidat řadu podřízených** („Pozice“ od 1 do 20).
   - Šipky mění pořadí, **⋯ → Přesunout** přesune umístění i s podřízenými a artikly.
   - Archivovat jde jen umístění, ve kterém nejsou artikly.
4. **Typy vybavení → Nový typ:**
   - _Z knihovny podle norem:_ žebříky, pevné žebříky a regály paletové, policové, konzolové
     a vjezdové, viz [typy-vybaveni.md](typy-vybaveni.md).
   - _Prázdný typ:_ vlastní pole.
   - **Pole:** popisek (z něj vznikne klíč), druh, povinnost, jednotka, hodnoty číselníku
     a nabízené hodnoty. Uložené pole nejde smazat ani mu změnit druh, jde jen archivovat,
     aby se neztratila data.
   - **Text protokolu** se zástupnými údaji (Zákazník, Datum kontroly…) a náhled.
5. **Artikly:**
   - Filtrujte zákazníka a provozovnu, pak **Nový artikl**. Pole se nabídnou podle typu.
     Bez čísla se přidělí další volné. Čísla mají 1–8 číslic a `04001` = `4001`.
   - Kliknutím na řádek artikl upravíte. Změna stavu (vyřazen z provozu ↔ v provozu) vyžaduje
     důvod a zapíše se do auditu.
   - Hromadné akce na zaškrtnutých artiklech: přesun, stav, datum příští kontroly, vyřazení
     z evidence.
6. **Uživatelé:** technici (role Technik) a další administrátoři. Reset hesla a deaktivace
   uživatele okamžitě odhlásí ze všech zařízení.
