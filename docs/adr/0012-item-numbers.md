# ADR-0012: Čísla artiklů – číselné řady 1–8 číslic, úvodní nuly bez významu

**Stav:** přijato (2026-10-26), nahrazuje původní předpoklad pevně pětimístného čísla

## Kontext

V jednom provozu bývají vedle sebe číselné řady různé délky, typicky čtyřmístná a pětimístná.
Technik chce na číselníku zadávat rychle a vyhledání má proběhnout bez potvrzování.

## Rozhodnutí

- Číslo artiklu tvoří **jen číslice, 1–8 znaků**.
- **Úvodní nuly se nepočítají:** `01234` je totéž co `1234`. Ukládá se **kanonický tvar bez
  úvodních nul** (`canonicalItemNumber()` ve `shared`). DB vynucuje `^[1-9][0-9]{0,7}$`
  a unikátnost `(customer_id, item_number)`. Migrace `0002` převede existující čísla.
- **Číselník:** po 5. číslici se artikl otevře sám, pokud existuje. Čtyřmístná čísla technik
  zadá s nulou na začátku (`04001`). Kratší i delší čísla potvrdí tlačítkem OK.
- **Skenování:** čistě číselný obsah QR kódu nebo čtečky se nejdřív hledá jako QR kód artiklu
  a potom jako číslo artiklu.
- **Řazení** čísel je číselné (`compareItemNumbers`), takže `999` je před `1000`.

## Důsledky

- Pokud by někde existovala řada, kde úvodní nuly něco znamenají (`00123` a `123` jako dva
  různé artikly), tento model ji nepodporuje. Taková řada by se musela evidovat přes QR kód
  nebo s jiným prefixem.
- Import (M4) převede čísla na kanonický tvar a duplicity nahlásí po řádcích.
