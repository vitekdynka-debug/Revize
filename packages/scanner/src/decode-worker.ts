/// <reference lib="webworker" />
import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import type { WorkerRequest, WorkerResponse } from './worker-protocol.js';

// Load the WASM binary bundled with the app instead of the default CDN.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm') ? wasmUrl : prefix + path,
  },
});

const scope = self as unknown as DedicatedWorkerGlobalScope;
let readerOptions: ReaderOptions = { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 4 };

const reply = (message: WorkerResponse) => scope.postMessage(message);

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'init') {
    readerOptions = {
      formats: request.settings.formats as ReaderOptions['formats'],
      tryHarder: request.settings.tryHarder,
      maxNumberOfSymbols: request.settings.maxSymbols ?? 4,
    };
    try {
      // Warm up: compiles the WASM module before the first real frame arrives.
      await readBarcodes(new ImageData(8, 8), readerOptions);
      reply({ type: 'ready' });
    } catch (error) {
      reply({ type: 'error', message: String(error) });
    }
    return;
  }

  const started = performance.now();
  try {
    const frame = new ImageData(
      new Uint8ClampedArray(request.buffer),
      request.width,
      request.height,
    );
    const results = await readBarcodes(frame, readerOptions);
    const codes = results
      .filter((result) => result.isValid)
      .map(({ text, format, position: p }) => ({
        text,
        format,
        center: {
          x: (p.topLeft.x + p.topRight.x + p.bottomRight.x + p.bottomLeft.x) / 4,
          y: (p.topLeft.y + p.topRight.y + p.bottomRight.y + p.bottomLeft.y) / 4,
        },
      }));
    reply({ type: 'result', id: request.id, codes, ms: performance.now() - started });
  } catch (error) {
    reply({ type: 'error', id: request.id, message: String(error) });
  }
};
