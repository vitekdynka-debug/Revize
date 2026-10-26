# ADR-0005: Autentizace – vlastní, argon2id + serverové session

**Stav:** přijato (2026-10-26)

## Rozhodnutí

- E-mail + heslo, hash **argon2id** (`@node-rs/argon2`, MIT).
- Serverové session v tabulce `session` (ukládá se hash tokenu), cookie `httpOnly; Secure;
SameSite=Lax`, platnost 30 dní se při používání prodlužuje. Technik se v terénu neodhlašuje
  a revokace znamená smazání řádku.
- API přijímá token i v `Authorization: Bearer` (pro budoucí Capacitor).
- CSRF: SameSite cookie + kontrola hlavičky `Origin` u zápisových požadavků. Rate-limit přihlášení.
- JWT s refresh tokeny jsme zamítli: jeden origin je nepotřebuje a revokace je u nich složitější.

## Důsledky

- Každý požadavek znamená jeden dotaz do DB na session (s indexem, zanedbatelné).
