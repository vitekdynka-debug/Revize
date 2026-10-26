export interface KeyboardWedgeOptions {
  /** Maximum gap between two characters of one scan (ms). Humans type slower. */
  maxIntervalMs?: number;
  /** Minimum number of characters for a valid scan. */
  minLength?: number;
}

/**
 * Recognizes input from Bluetooth/USB barcode scanners in keyboard ("HID wedge") mode:
 * a burst of characters with very short gaps, terminated by Enter.
 * Pure logic – feed it key events with timestamps.
 */
export class KeyboardWedgeDetector {
  private buffer = '';
  private lastAt = Number.NEGATIVE_INFINITY;
  private readonly maxIntervalMs: number;
  private readonly minLength: number;

  constructor(options: KeyboardWedgeOptions = {}) {
    this.maxIntervalMs = options.maxIntervalMs ?? 50;
    this.minLength = options.minLength ?? 3;
  }

  /**
   * @param key `KeyboardEvent.key`
   * @returns the scanned text when `key` completes a scan, otherwise null.
   */
  feed(key: string, now: number): string | null {
    const gap = now - this.lastAt;
    this.lastAt = now;

    if (key === 'Enter') {
      const text = this.buffer;
      this.buffer = '';
      return gap <= this.maxIntervalMs && text.length >= this.minLength ? text : null;
    }
    if (key.length !== 1) return null; // Shift, Alt, … sent by some scanners

    if (gap > this.maxIntervalMs) this.buffer = '';
    this.buffer += key;
    return null;
  }

  reset(): void {
    this.buffer = '';
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
