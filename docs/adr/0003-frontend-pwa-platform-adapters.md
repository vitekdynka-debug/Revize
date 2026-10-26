# ADR-0003: Frontend – jedna React aplikace, PWA, platformní adaptéry

**Stav:** přijato (2026-10-26)

## Kontext

Terén (iPad, dotyk, výpadky) a kancelář (tabulky, exporty) mají odlišné UI, ale sdílí data, auth
a doménu. Terénní část možná později zabalíme do Capacitoru (nativní skener, haptika).

## Rozhodnutí

- Jedna aplikace `apps/web` (React, Vite, TanStack Router/Query/Table, Mantine) se dvěma shelly:
  `/field/*` a `/office/*`. Terénní část je instalovatelná PWA (vite-plugin-pwa).
- Přístup k platformě jen přes rozhraní v `src/platform/`: `CameraService`, `ScannerService`,
  `FileExport`, `LocalStore`, `Feedback`, `Connectivity`. Implementace `web/*` teď, `capacitor/*`
  později; výběr implementace proběhne jednou při startu aplikace.
- Komponenty nesmí volat `navigator.mediaDevices`, `navigator.vibrate`, `indexedDB` apod. přímo.

## Důsledky

- Přechod na Capacitor znamená přidat adaptéry, ne přepsat UI.
- Kancelářský kód se do terénní PWA nenačte díky lazy-loadingu rout.
