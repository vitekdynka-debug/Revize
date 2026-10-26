# ADR-0008: HTTPS a vzdálený přístup zdarma

**Stav:** navrženo – rozhodnout před M5

## Kontext

PWA potřebuje HTTPS kvůli kameře a service workeru. iPad v terénu musí server dosáhnout
přes internet. Server stojí v kanceláři nebo doma a nesmí stát nic navíc.

## Varianty

| Varianta                           | Plusy                                                                                                                       | Minusy                                                                                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tailscale** (výchozí doporučení) | žádné otevřené porty, funguje za CGNAT, platný certifikát přes `tailscale cert` (`*.ts.net`), server není vidět z internetu | aplikace Tailscale na každém zařízení; koordinační server je cizí služba (data jdou E2E šifrovaně); **ověřit podmínky free plánu pro firemní použití**; plně OSS alternativa Headscale potřebuje veřejně dosažitelný server |
| Cloudflare Tunnel                  | bez aplikace na klientech, funguje za CGNAT, free plán                                                                      | **vyžaduje vlastní doménu (placená)**, Cloudflare terminuje TLS a vidí data, server je veřejně dostupný                                                                                                                     |
| Caddy + Let's Encrypt              | plně vlastní řešení bez prostředníka, DuckDNS subdoména zdarma                                                              | nutná veřejná IP bez CGNAT, port forwarding 80/443, server vystavený do internetu (fail2ban, rate-limit, aktualizace)                                                                                                       |

## Rozhodnutí (navržené)

Docker Compose dostane profily `tailscale`, `cloudflared` a `public-caddy`. Aplikace na volbě
nezávisí a uvnitř vždy běží Caddy jako reverse proxy. Výchozí je Tailscale.

## Otevřené

Zjistit síť u serveru (veřejná IP / CGNAT) a ověřit podmínky Tailscale.
