# ADR-0022: Oprávnění navíc k roli

**Stav:** přijato (2026-11-18)

## Kontext

Role jsou dvě: Administrátor (vše) a Technik (terén, artikly, import). Některý technik ale
v kanceláři spravuje i zákazníky nebo typy vybavení a nemá dostat všechno, co administrátor.

## Rozhodnutí

- U uživatele se ukládají **oprávnění navíc** (`app_user.extra_permissions`, seznam oprávnění
  z `PERMISSIONS`). Platná oprávnění = oprávnění role ∪ oprávnění navíc (`permissionsOf`).
- Formulář uživatele je nabízí po **oblastech** (`PERMISSION_GROUPS`): Zákazníci a provozovny,
  Typy vybavení, Uzavírání kontrol, Mazání kontrol, Nastavení firmy, Historie změn, Uživatelé.
  Oblast zapne všechna svá oprávnění.
- Kontroly v kódu zůstávají na oprávněních (nikdy na názvu role), takže nová oblast = nový
  záznam v `PERMISSION_GROUPS`.
- Změna se projeví hned (oprávnění se čtou při každém požadavku ze session); zapisuje se do
  historie změn jako úprava uživatele.

## Důsledky

- Oblast _Uživatelé_ dává technikovi fakticky práva administrátora (může měnit role a oprávnění).
- Další role (např. „Vedoucí technik“) jde přidat později jako předvolbu oblastí.
