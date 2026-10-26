import { v7 } from 'uuid';

/**
 * New entity id. UUIDv7 is time-ordered (good index locality) and can be generated on any
 * client, which is what offline writes rely on (ADR-0004).
 */
export function newId(): string {
  return v7();
}
