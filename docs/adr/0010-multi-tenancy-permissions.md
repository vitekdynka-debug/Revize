# ADR-0010: Příprava na multi-tenant a oprávnění

**Stav:** přijato (2026-10-26)

## Rozhodnutí

- Tabulka `organization`, sloupec `organization_id` na všech tenantových tabulkách a v unikátních
  indexech (např. `qr_code` je unikátní v rámci organizace). Ve fázi 1 je jedna organizace.
- Každý dotaz v repository vrstvě filtruje podle `organization_id` z kontextu požadavku. Později
  lze přidat i PostgreSQL Row Level Security.
- Autorizace kontroluje **permissions** (`customer.write`, `inspection.close`, `export.read`…).
  Mapa rolí na oprávnění je v `shared`; role jsou zatím `admin` a `inspector`.

## Důsledky

- Přidat roli znamená přidat řádek do mapy. Multi-tenant pak znamená hlavně registraci organizací
  a přepínání tenantu, bez migrace dat.
