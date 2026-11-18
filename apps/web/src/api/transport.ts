/**
 * Sends an API request over the network. The demo build swaps this module for
 * `src/demo/transport.ts` (vite.config.ts), which answers from the API running in the browser.
 */
export function send(path: string, init: RequestInit): Promise<Response> {
  return fetch(`/api${path}`, init);
}

/**
 * The URL the browser itself can download from (a file streamed by the server, saved as it
 * arrives). Null in the demo build, where the API lives in the page.
 */
export function directUrl(path: string): string | null {
  return `/api${path}`;
}

/** Only the demo build has local data to reset. */
export function resetDemo(): Promise<void> {
  return Promise.reject(new Error('Not a demo build'));
}
