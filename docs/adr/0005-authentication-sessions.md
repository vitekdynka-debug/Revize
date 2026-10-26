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

## Upřesnění při implementaci (M2)

- V DB se ukládá jen SHA-256 tokenu. Prodloužení platnosti se zapisuje nejvýš jednou za hodinu.
- Reset hesla administrátorem a deaktivace uživatele ukončí všechny jeho session. Změna
  vlastního hesla ukončí všechny ostatní session.
- Při neexistujícím e-mailu se heslo stejně ověřuje proti fiktivnímu hashi, aby doba odpovědi
  neprozradila existující účty. Odpověď je v obou případech stejná.
- Rate-limit přihlášení je 10 pokusů za minutu a IP adresu (`@fastify/rate-limit`, v paměti
  procesu, což při jedné instanci API stačí).
- E-mail se před validací ořízne a převede na malá písmena, protože klávesnice iPadu dává
  první písmeno velké.
- Při prvním startu nad prázdnou databází se vytvoří organizace a první administrátor z `.env`
  (`ADMIN_EMAIL`, `ADMIN_PASSWORD`; bez hesla se vygeneruje a vypíše do logu). Jako záchrana,
  když se ztratí přístup všech adminů, slouží CLI `create-user`.

## Důsledky

- Každý požadavek znamená jeden dotaz do DB na session (s indexem, zanedbatelné).
