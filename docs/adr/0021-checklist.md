# ADR-0021: Kontrolní body ANO / NE u typu vybavení

**Stav:** přijato (2026-11-18)

## Kontext

U regálů se při každé kontrole zjišťuje totéž: je regál ukotvený do podlahy, má štítek
s nosností? Technik to dosud psal do popisu závady ručně a u artiklu v pořádku to nikde
zaznamenané nebylo.

## Rozhodnutí

- Typ vybavení má seznam **kontrolních bodů** (`equipment_type.checklist`, JSONB): klíč, název
  („Kotvení do podlahy“), text závady („Chybí nebo je poškozené kotvení do podlahy“) a úroveň
  (výchozí žlutá). Upravuje se v kanceláři v Typech vybavení. Regál z knihovny a stávající typy
  s hodnocením rizika dostanou kotvení do podlahy a štítek s nosností (migrace 0017).
- V terénu je u každého bodu přepínač **ANO / NE** (výchozí ANO). NE vloží text bodu na začátek
  popisu závady a nastaví závadu aspoň na úroveň bodu (u regálů žlutá); ANO text zase odebere.
  S odpovědí NE nejde uložit „V pořádku“.
- Odpovědi se ukládají k výsledku (`inspection_result.checks`, klíč → true/false). Výsledek
  uložený bez odpovědí (kancelář, starší klienti) je nemění.
- Typy bez hodnocení rizika (vyhovuje / nevyhovuje): žlutá a zelená úroveň bodu = závada
  nebránící bezpečnému provozu, červená = nevyhovuje.

## Důsledky

- Protokol a exporty se nemění: text bodu je součástí popisu závady.
- Klíč bodu se po uložení nemění (odpovědi se na něj odkazují); změnit jde název, text a úroveň.
