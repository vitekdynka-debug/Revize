// Demo build replacement of src/api/transport.ts (ADR-0015).
import { demoFetch } from './runtime.js';

export function send(path: string, init: RequestInit): Promise<Response> {
  return demoFetch(`/api${path}`, init);
}

export { resetDemo } from './runtime.js';

/** The API runs in the page: nothing the browser could download from by itself. */
export function directUrl(_path: string): string | null {
  return null;
}
