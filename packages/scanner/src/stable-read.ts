/**
 * Accepts a code only after it was read `requiredHits` times within `windowMs`, without a
 * different code in between. Prevents accidental reads while the camera sweeps across labels.
 * Frames without any code neither count nor reset (decoders miss frames regularly).
 */
export class StableReadFilter {
  private candidate: string | null = null;
  private hits: number[] = [];

  constructor(
    private readonly requiredHits: number,
    private readonly windowMs: number,
  ) {}

  /** @returns the confirmed code, or null while still unconfirmed. */
  push(text: string | null, now: number): string | null {
    if (text === null) return null;
    if (text !== this.candidate) {
      this.candidate = text;
      this.hits = [];
    }
    this.hits = this.hits.filter((at) => now - at <= this.windowMs);
    this.hits.push(now);
    if (this.hits.length < this.requiredHits) return null;
    this.reset();
    return text;
  }

  reset(): void {
    this.candidate = null;
    this.hits = [];
  }
}
