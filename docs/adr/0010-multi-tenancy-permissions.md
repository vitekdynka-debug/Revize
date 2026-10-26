# ADR-0010: Příprava na multi-tenant a oprávnění

**Stav:** přijato (2026-10-26)

## Rozhodnutí

- Tabulka `organization`, sloupec `organization_id` na všech tenantových tabulkách a v unikátních
  indexech (např. `qr_code` je unikátní v rámci organizace). Ve fázi 1 je jedna organizace.
- Každý dotaz v repository vrstvě filtruje podle `organization_id` z kontextu požadavku. Později
  lze přidat i PostgreSQL Row Level Security.
- Autorizace kontroluje **permissions** (`customer.write`, `inspection.close`, `export.read`…).
  Mapa rolí na oprávnění je v `shared`; role jsou zatím `admin` a `inspector`.

## Upřesnění při implementaci (M2)

- **E-mail uživatele je unikátní globálně, ne jen v rámci organizace.** Přihlášení tak stačí
  e-mailem a heslem bez výběru firmy. Pro multi-tenant to znamená, že jedna osoba nemůže mít
  stejným e-mailem účty ve dvou revizních firmách. Pokud by to bylo potřeba, změní se index na
  `(organization_id, email)` a přihlášení dostane výběr organizace.
- Systém nedovolí odebrat posledního aktivního administrátora (409 `last_admin`).

## Důsledky

- Přidat roli znamená přidat řádek do mapy. Multi-tenant pak znamená hlavně registraci organizací
  a přepínání tenantu, bez migrace dat.
