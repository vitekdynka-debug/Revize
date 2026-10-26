/**
 * Suppresses repeated reads of the same code: a code is accepted again only after
 * `cooldownMs` without seeing it, or after a different code was accepted.
 */
export class ScanDeduper {
  private lastText: string | null = null;
  private lastSeenAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly cooldownMs: number) {}

  /** Returns true when the read should be handled, false when it is a duplicate. */
  accept(text: string, now: number): boolean {
    const isRepeat = text === this.lastText && now - this.lastSeenAt < this.cooldownMs;
    // Keep extending the window while the same label stays in view.
    if (text === this.lastText) this.lastSeenAt = now;
    if (isRepeat) return false;
    this.lastText = text;
    this.lastSeenAt = now;
    return true;
  }

  reset(): void {
    this.lastText = null;
    this.lastSeenAt = Number.NEGATIVE_INFINITY;
  }
}
