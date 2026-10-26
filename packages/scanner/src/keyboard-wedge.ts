export interface KeyboardWedgeOptions {
  /** Average gap between characters of one scan must not exceed this (ms). Humans type slower. */
  maxAverageIntervalMs?: number;
  /** A longer pause ends the burst (human pause); shorter hiccups (Bluetooth buffering) are tolerated. */
  maxGapMs?: number;
  /** Minimum number of characters for a valid scan. */
  minLength?: number;
}

/**
 * Recognizes input from Bluetooth/USB barcode scanners in keyboard ("HID wedge") mode:
 * a fast burst of characters terminated by Enter. Bluetooth scanners occasionally pause for
 * a moment in the middle of a code, so the decision uses the average speed of the burst,
 * not every single gap. Pure logic – feed it key events with timestamps.
 */
export class KeyboardWedgeDetector {
  private buffer = '';
  private firstAt = 0;
  private lastAt = Number.NEGATIVE_INFINITY;
  private readonly maxAverageIntervalMs: number;
  private readonly maxGapMs: number;
  private readonly minLength: number;

  constructor(options: KeyboardWedgeOptions = {}) {
    this.maxAverageIntervalMs = options.maxAverageIntervalMs ?? 35;
    this.maxGapMs = options.maxGapMs ?? 300;
    this.minLength = options.minLength ?? 3;
  }

  /**
   * @param key `KeyboardEvent.key`
   * @returns the scanned text when `key` completes a scan, otherwise null.
   */
  feed(key: string, now: number): string | null {
    const gap = now - this.lastAt;
    if (key === 'Enter') {
      const text = this.buffer;
      const average = text.length > 1 ? (this.lastAt - this.firstAt) / (text.length - 1) : Infinity;
      this.reset();
      const fast = average <= this.maxAverageIntervalMs && gap <= this.maxGapMs;
      return fast && text.length >= this.minLength ? text : null;
    }
    if (key.length !== 1) return null; // Shift, Alt, … sent by some scanners

    if (gap > this.maxGapMs) {
      this.buffer = '';
      this.firstAt = now;
    }
    this.buffer += key;
    this.lastAt = now;
    return null;
  }

  reset(): void {
    this.buffer = '';
    this.firstAt = 0;
    this.lastAt = Number.NEGATIVE_INFINITY;
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Listens for keyboard-wedge scans anywhere in the document. Keystrokes into editable fields
 * are left alone (the field gets the text and its own Enter handling).
 * @returns a function that removes the listener.
 */
export function attachKeyboardWedge(
  onScan: (text: string) => void,
  options: KeyboardWedgeOptions = {},
  target: Document = document,
): () => void {
  const detector = new KeyboardWedgeDetector(options);
  const listener = (event: KeyboardEvent) => {
    if (isEditable(event.target)) return;
    const text = detector.feed(event.key, event.timeStamp);
    if (text !== null) {
      event.preventDefault();
      onScan(text);
    }
  };
  target.addEventListener('keydown', listener, { capture: true });
  return () => target.removeEventListener('keydown', listener, { capture: true });
}
