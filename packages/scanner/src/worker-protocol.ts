import type { DecodedCode } from './types.js';

export interface DecoderSettings {
  tryHarder: boolean;
  formats: string[];
}

export type WorkerRequest =
  | { type: 'init'; settings: DecoderSettings }
  | { type: 'decode'; id: number; width: number; height: number; buffer: ArrayBuffer };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'error'; id?: number; message: string }
  | { type: 'result'; id: number; code: DecodedCode | null; ms: number };
