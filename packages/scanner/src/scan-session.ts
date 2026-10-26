import { computeCropRect, fitWithin } from './crop.js';
import { ScanDeduper } from './dedupe.js';
import { ZxingWorkerEngine } from './engines.js';
import { pickCentralCode } from './pick.js';
import { StableReadFilter } from './stable-read.js';
import type { DecodeEngine, ScanEvent, ScanStats } from './types.js';

export interface ScanSessionOptions {
  video: HTMLVideoElement;
  engine: DecodeEngine;
  /** Side of the centered scan square relative to the shorter side of the video element. */
  roiFraction?: number;
  /** Frames are downscaled so that their longer side is at most this many pixels. */
  maxDecodeSide?: number;
  /** The same code is ignored for this long after it was last seen (ms). */
  cooldownMs?: number;
  /** Pause decoding after a successful scan until `resume()` is called. */
  pauseOnScan?: boolean;
  /** A code must be read this many times (within `confirmWindowMs`) before it is accepted. */
  confirmHits?: number;
  confirmWindowMs?: number;
  /** After `start()`/`resume()` nothing is accepted for this long (ms) – time to aim. */
  rearmDelayMs?: number;
  /** Only codes whose center is within this fraction of the frame side from the center count. */
  centerZone?: number;
  onScan: (event: ScanEvent) => void;
  onStats?: (stats: ScanStats) => void;
  onError?: (error: Error) => void;
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
};

/**
 * Continuous scanning loop: grabs the scan area of the current video frame, decodes it,
 * and reports de-duplicated results. At most one frame is being decoded at a time.
 */
export class ScanSession {
  roiFraction: number;
  maxDecodeSide: number;
  private readonly deduper: ScanDeduper;
  private readonly stable: StableReadFilter;
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private running = false;
  private paused = false;
  private busy = false;
  private resumedAt = 0;
  private window = { start: 0, frames: 0, decodeMs: 0, grabMs: 0 };
  private lastFrame = { width: 0, height: 0 };

  constructor(private readonly options: ScanSessionOptions) {
    this.roiFraction = options.roiFraction ?? 0.6;
    this.maxDecodeSide = options.maxDecodeSide ?? 720;
    this.deduper = new ScanDeduper(options.cooldownMs ?? 2500);
    this.stable = new StableReadFilter(options.confirmHits ?? 2, options.confirmWindowMs ?? 700);
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D context is not available');
    this.context = context;
  }

  start(): void {
    this.running = true;
    this.paused = false;
    this.resumedAt = performance.now();
    this.window = { start: this.resumedAt, frames: 0, decodeMs: 0, grabMs: 0 };
    this.scheduleNext();
  }

  pause(): void {
    this.paused = true;
  }

  /** Resumes decoding. Pass `forgetLast` to allow the previous code to be read again at once. */
  resume(forgetLast = false): void {
    if (forgetLast) this.deduper.reset();
    this.stable.reset();
    this.paused = false;
    this.resumedAt = performance.now();
  }

  stop(): void {
    this.running = false;
  }

  private scheduleNext() {
    if (!this.running) return;
    const video = this.options.video as VideoWithFrameCallback;
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => this.tick());
    else requestAnimationFrame(() => this.tick());
  }

  private tick() {
    if (!this.running) return;
    if (!this.paused && !this.busy && this.options.video.readyState >= 2) {
      this.busy = true;
      this.processFrame()
        .catch((error: unknown) => this.options.onError?.(error as Error))
        .finally(() => {
          this.busy = false;
        });
    }
    this.scheduleNext();
  }

  private async processFrame() {
    const { video, engine } = this.options;
    const grabStart = performance.now();
    const crop = computeCropRect(
      { width: video.videoWidth, height: video.videoHeight },
      { width: video.clientWidth, height: video.clientHeight },
      this.roiFraction,
    );
    const out = fitWithin(crop, this.maxDecodeSide);
    if (this.canvas.width !== out.width || this.canvas.height !== out.height) {
      this.canvas.width = out.width;
      this.canvas.height = out.height;
    }
    this.context.drawImage(
      video,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      out.width,
      out.height,
    );
    const frame = this.context.getImageData(0, 0, out.width, out.height);
    const decodeStart = performance.now();

    const codes = await engine.decode(frame);
    const now = performance.now();
    // The worker engine measures pure decoder time; the round trip adds transfer overhead.
    const decodeMs = engine instanceof ZxingWorkerEngine ? engine.lastDecodeMs : now - decodeStart;
    this.recordStats(decodeStart - grabStart, decodeMs, out, now);

    if (this.paused || !this.running) return;
    if (now - this.resumedAt < (this.options.rearmDelayMs ?? 0)) return;
    const code = pickCentralCode(codes, out, this.options.centerZone);
    const confirmed = this.stable.push(code?.text ?? null, now);
    if (!code || confirmed === null) return;
    if (!this.deduper.accept(code.text, now)) return;
    if (this.options.pauseOnScan ?? true) this.paused = true;
    this.options.onScan({
      text: code.text,
      format: code.format,
      source: 'camera',
      at: now,
      decodeMs,
      sinceResumeMs: now - this.resumedAt,
    });
  }

  private recordStats(
    grabMs: number,
    decodeMs: number,
    frame: { width: number; height: number },
    now: number,
  ) {
    this.window.frames += 1;
    this.window.decodeMs += decodeMs;
    this.window.grabMs += grabMs;
    this.lastFrame = frame;
    const elapsed = now - this.window.start;
    if (elapsed < 1000) return;
    const { frames } = this.window;
    this.options.onStats?.({
      fps: (frames * 1000) / elapsed,
      avgDecodeMs: this.window.decodeMs / frames,
      avgGrabMs: this.window.grabMs / frames,
      frameWidth: this.lastFrame.width,
      frameHeight: this.lastFrame.height,
    });
    this.window = { start: now, frames: 0, decodeMs: 0, grabMs: 0 };
  }
}
