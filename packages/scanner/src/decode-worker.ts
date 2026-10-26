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
let readerOptions: ReaderOptions = { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 1 };

const reply = (message: WorkerResponse) => scope.postMessage(message);

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'init') {
    readerOptions = {
      formats: request.settings.formats as ReaderOptions['formats'],
      tryHarder: request.settings.tryHarder,
      maxNumberOfSymbols: 1,
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
    const [first] = await readBarcodes(frame, readerOptions);
    reply({
      type: 'result',
      id: request.id,
      code: first?.isValid ? { text: first.text, format: first.format } : null,
      ms: performance.now() - started,
    });
  } catch (error) {
    reply({ type: 'error', id: request.id, message: String(error) });
  }
};
