import type { DecodedCode } from './types.js';

export interface DecoderSettings {
  tryHarder: boolean;
  formats: string[];
  /** Codes reported per frame; more than one lets the session pick the most central label. */
  maxSymbols?: number;
}

export type WorkerRequest =
  | { type: 'init'; settings: DecoderSettings }
  | { type: 'decode'; id: number; width: number; height: number; buffer: ArrayBuffer };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'error'; id?: number; message: string }
  | { type: 'result'; id: number; codes: DecodedCode[]; ms: number };
