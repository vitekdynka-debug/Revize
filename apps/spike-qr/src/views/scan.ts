import {
  NativeDetectorEngine,
  ScanSession,
  ZxingWorkerEngine,
  openCamera,
  type CameraHandle,
  type DecodeEngine,
} from '@revize/scanner';
import DecodeWorker from '@revize/scanner/decode-worker?worker';
import { runCheck } from '../check-flow.js';
import { h } from '../dom.js';
import { cameraPermission, isStandalone } from '../env.js';
import { addLog } from '../log.js';
import { RESOLUTIONS, loadSettings } from '../settings.js';

/** Continuous camera scanning ("rychlá kontrola"). Returns a cleanup function. */
export function scanView(root: HTMLElement): () => void {
  const settings = loadSettings();
  const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
  const roiSize = `${settings.roiFraction * 100}vmin`;
  const roi = h('div', { class: 'scan-roi', style: `width:${roiSize};height:${roiSize}` });
  const stats = h('div', { class: 'scan-stats mono' }, 'Spouštím kameru…');
  const status = h('div', { class: 'scan-status' }, 'Namiřte na QR kód');
  const torchButton = h('button', { class: 'btn btn-small hidden' }, 'Svítilna');
  const zoomInput = h('input', { type: 'range', class: 'scan-zoom hidden', 'aria-label': 'Zoom' });

  root.replaceChildren(
    h(
      'div',
      { class: 'scan' },
      video,
      roi,
      h(
        'div',
        { class: 'scan-top' },
        h('a', { href: '#/', class: 'btn btn-small' }, '← Zpět'),
        torchButton,
        zoomInput,
      ),
      stats,
      status,
    ),
  );

  let camera: CameraHandle | null = null;
  let engine: DecodeEngine | null = null;
  let session: ScanSession | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let torchOn = false;
  let disposed = false;
  let starting: Promise<void> | null = null;

  const requestWakeLock = async () => {
    try {
      wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      wakeLock = null;
    }
  };

  const startCamera = async (event: 'start' | 'restart') => {
    const permission = await cameraPermission();
    try {
      const resolution = RESOLUTIONS[settings.resolution];
      camera = await openCamera(video, {
        deviceId: settings.deviceId || undefined,
        idealWidth: resolution.width,
        idealHeight: resolution.height,
      });
      addLog({
        kind: 'camera',
        at: new Date().toISOString(),
        event,
        startMs: Math.round(camera.startMs),
        width: camera.width,
        height: camera.height,
        standalone: isStandalone(),
        permission,
        detail: camera.track.label,
      });
      setupControls(camera);
    } catch (error) {
      addLog({
        kind: 'camera',
        at: new Date().toISOString(),
        event: 'error',
        startMs: null,
        width: null,
        height: null,
        standalone: isStandalone(),
        permission,
        detail: String(error),
      });
      throw error;
    }
  };

  const setupControls = (cam: CameraHandle) => {
    torchButton.classList.toggle('hidden', !cam.torchSupported);
    torchButton.onclick = async () => {
      torchOn = !torchOn;
      await cam.setTorch(torchOn).catch(() => (torchOn = false));
      torchButton.classList.toggle('active', torchOn);
    };
    if (cam.zoom && cam.zoom.max > cam.zoom.min) {
      zoomInput.classList.remove('hidden');
      zoomInput.min = String(cam.zoom.min);
      zoomInput.max = String(cam.zoom.max);
      zoomInput.step = String(cam.zoom.step || 0.1);
      zoomInput.value = String(cam.zoom.min);
      zoomInput.oninput = () => void cam.setZoom(Number(zoomInput.value));
    }
  };

  const start = async () => {
    await startCamera('start');
    engine =
      settings.engine === 'native'
        ? new NativeDetectorEngine()
        : new ZxingWorkerEngine(() => new DecodeWorker(), {
            tryHarder: settings.tryHarder,
            formats: ['QRCode'],
          });
    await engine.init();
    // The app may have been closed or backgrounded while the camera was starting.
    if (disposed || document.visibilityState === 'hidden') {
      stopAll();
      return;
    }
    session = new ScanSession({
      video,
      engine,
      roiFraction: settings.roiFraction,
      maxDecodeSide: settings.maxDecodeSide,
      cooldownMs: settings.cooldownMs,
      onStats: (s) => {
        stats.textContent =
          `${engine?.name} · ${s.fps.toFixed(1)} sn/s · dekód ${s.avgDecodeMs.toFixed(1)} ms · ` +
          `výřez ${s.avgGrabMs.toFixed(1)} ms · ${s.frameWidth}×${s.frameHeight} · ` +
          `kamera ${camera?.width}×${camera?.height}`;
      },
      onError: (error) => (status.textContent = `Chyba dekodéru: ${error.message}`),
      onScan: (scan) => {
        void runCheck({
          mode: 'camera',
          raw: scan.text,
          toReadMs: scan.sinceResumeMs ?? 0,
          decodeMs: scan.decodeMs,
        }).then(afterCard);
      },
    });
    session.start();
    await requestWakeLock();
  };

  // Taking a photo with the system camera can stop our stream on iOS – recover it.
  const afterCard = async () => {
    if (disposed) return;
    if (camera && camera.track.readyState === 'ended') {
      camera.stop();
      await startCamera('restart');
    } else if (video.paused) {
      await video.play().catch(() => undefined);
    }
    session?.resume();
  };

  const stopAll = () => {
    session?.stop();
    session = null;
    engine?.dispose();
    engine = null;
    camera?.stop();
    camera = null;
    void wakeLock?.release().catch(() => undefined);
    wakeLock = null;
  };

  const run = () => {
    starting ??= start()
      .catch((error: unknown) => {
        status.textContent = `Kameru nelze spustit: ${String(error)}`;
      })
      .finally(() => (starting = null));
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') stopAll();
    else if (!session) run();
  };
  document.addEventListener('visibilitychange', onVisibility);
  run();

  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibility);
    stopAll();
  };
}
