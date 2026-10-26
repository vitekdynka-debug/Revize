import { registerSW } from 'virtual:pwa-register';

const CHECK_INTERVAL_MS = 60_000;

/**
 * Registers the service worker and keeps looking for new versions. iOS home-screen apps are
 * mostly resumed rather than reloaded, so a check on registration alone would rarely run.
 * With `registerType: 'autoUpdate'` a found update activates and reloads the page by itself.
 */
export function setupUpdates(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}

/** Last resort: drop the service worker and all caches, then load the app fresh from the server. */
export async function forceReload(): Promise<void> {
  const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
  await Promise.all(registrations.map((r) => r.unregister()));
  const keys = (await caches?.keys()) ?? [];
  await Promise.all(keys.map((key) => caches.delete(key)));
  location.reload();
}
