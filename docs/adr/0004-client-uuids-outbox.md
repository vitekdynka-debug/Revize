# ADR-0004: Klientská UUID, online-first s frontou zápisů (outbox)

**Stav:** přijato (2026-10-26)

## Kontext

iPad je online zhruba v 95 % případů. Žádná data pořízená v terénu se nesmí ztratit, ani při
zavření aplikace, a opakované odeslání nesmí vytvořit duplicity.

## Rozhodnutí

- Všechna ID jsou UUID (v7, časově řaditelná) a generuje je i klient.
- **Cache** (Dexie/IndexedDB): snapshot zákazníka při zahájení kontroly, potom delta podle `updated_at`.
- **Outbox** v IndexedDB: příkaz `{id, kind, entityId, payload, dependsOn[], attempts, status,
lastError}`, fotky jako Bloby. Zápis do outboxu proběhne před potvrzením v UI.
- Idempotentní endpointy: `PUT` s klientským ID (upsert, stejný obsah = 200 bez změny). Výsledek
  kontroly je unikátní pár (kontrola, artikl); při souběhu vyhrává novější `recorded_at` a
  přepsaná verze jde do auditu.
- Odesílání FIFO se závislostmi, exponenciální backoff (1 s → 5 min). Spouští se po přidání do
  fronty, při události `online`, při návratu do aplikace a periodicky. Background Sync API iOS
  nepodporuje.
- Chyby: síť nebo 5xx → opakovat. 4xx → stav „vyžaduje pozornost“, data se **nikdy nemažou**.
  401 frontu pozastaví.
- Pojistky: `navigator.storage.persist()`, indikátor počtu neodeslaných položek, varování
  při odhlášení a nouzový export neodeslaných dat do ZIPu.
- Číslo nového artiklu offline se vezme z bloku rezervovaného předem (`item_number_lease`).
  Když blok dojde, artikl dostane dočasné označení a číslo mu přidělí server.

## Důsledky

- Plná offline-first synchronizace (CRDT, obousměrné konflikty) se nedělá. Pokud bude potřeba,
  outbox zůstane a doplní se stahování změn.
