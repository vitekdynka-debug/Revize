import type { DecodeEngine, DecodedCode } from './types.js';
import type { DecoderSettings, WorkerRequest, WorkerResponse } from './worker-protocol.js';

export type { DecoderSettings } from './worker-protocol.js';

interface Pending {
  resolve: (code: DecodedCode | null) => void;
  reject: (error: Error) => void;
}

/**
 * zxing-cpp (WASM) running in a dedicated worker. The worker is created by the app so that its
 * bundler can process it, e.g. `import DecodeWorker from '@revize/scanner/decode-worker?worker'`.
 */
export class ZxingWorkerEngine implements DecodeEngine {
  readonly name = 'zxing-wasm';
  /** Decoder time of the last frame as measured inside the worker (ms). */
  lastDecodeMs = 0;
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(
    private readonly createWorker: () => Worker,
    private readonly settings: DecoderSettings = { tryHarder: true, formats: ['QRCode'] },
  ) {}

  init(): Promise<void> {
    const worker = this.createWorker();
    this.worker = worker;
    return new Promise((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.type === 'ready') return resolve();
        if (message.type === 'error' && message.id === undefined) {
          return reject(new Error(message.message));
        }
        if (message.id === undefined) return;
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.type === 'error') pending?.reject(new Error(message.message));
        else if (message.type === 'result') {
          this.lastDecodeMs = message.ms;
          pending?.resolve(message.code);
        }
      };
      worker.onerror = (event) => reject(new Error(event.message));
      this.post({ type: 'init', settings: this.settings });
    });
  }

  decode(frame: ImageData): Promise<DecodedCode | null> {
    const id = this.nextId++;
    const buffer = frame.data.buffer as ArrayBuffer;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post({ type: 'decode', id, width: frame.width, height: frame.height, buffer }, [buffer]);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.forEach((p) => p.reject(new Error('Engine disposed')));
    this.pending.clear();
  }

  private post(message: WorkerRequest, transfer: Transferable[] = []) {
    if (!this.worker) throw new Error('Engine not initialized');
    this.worker.postMessage(message, transfer);
  }
}

// Shape Detection API – not in TypeScript's DOM typings, and not available in iOS Safari (2026).
interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
}

function barcodeDetectorClass(): BarcodeDetectorConstructor | undefined {
  return (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

export async function isNativeDetectorAvailable(): Promise<boolean> {
  const Detector = barcodeDetectorClass();
  if (!Detector) return false;
  try {
    return (await Detector.getSupportedFormats()).includes('qr_code');
  } catch {
    return false;
  }
}

/** Platform `BarcodeDetector` (runs in the browser's native code, off the JS thread). */
export class NativeDetectorEngine implements DecodeEngine {
  readonly name = 'BarcodeDetector';
  private detector: BarcodeDetectorInstance | null = null;

  async init(): Promise<void> {
    const Detector = barcodeDetectorClass();
    if (!Detector) throw new Error('BarcodeDetector is not available');
    this.detector = new Detector({ formats: ['qr_code'] });
  }

  async decode(frame: ImageData): Promise<DecodedCode | null> {
    if (!this.detector) throw new Error('Engine not initialized');
    const [first] = await this.detector.detect(frame);
    return first ? { text: first.rawValue, format: first.format } : null;
  }

  dispose(): void {
    this.detector = null;
  }
}
