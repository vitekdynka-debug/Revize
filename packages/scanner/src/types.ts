/** A single decoded code, as produced by a decoding engine. */
export interface DecodedCode {
  text: string;
  format: string;
  /** Center of the code in frame pixel coordinates, when the engine reports a position. */
  center?: { x: number; y: number };
}

export type ScanSource = 'camera' | 'keyboard-wedge';

export interface ScanEvent {
  text: string;
  format: string;
  source: ScanSource;
  /** `performance.now()` timestamp when the code was decoded. */
  at: number;
  /** Time spent in the decoder for the successful frame (ms). Camera only. */
  decodeMs?: number;
  /** Time since the session was started or last resumed (ms). Camera only. */
  sinceResumeMs?: number;
}

/** Decodes still frames. Implementations may run off the main thread. */
export interface DecodeEngine {
  readonly name: string;
  init(): Promise<void>;
  /** All codes found in the frame (possibly several labels next to each other). */
  decode(frame: ImageData): Promise<DecodedCode[]>;
  dispose(): void;
}

export interface ScanStats {
  /** Decoded frames per second over the last second. */
  fps: number;
  /** Average decoder time per frame over the last second (ms). */
  avgDecodeMs: number;
  /** Average frame grab (crop + getImageData) time over the last second (ms). */
  avgGrabMs: number;
  frameWidth: number;
  frameHeight: number;
}
