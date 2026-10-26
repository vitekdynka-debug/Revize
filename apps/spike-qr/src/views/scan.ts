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
import { activeInspection, summarize } from '../inspection.js';
import { addLog } from '../log.js';
import { RESOLUTIONS, loadSettings } from '../settings.js';

const ZOOM_PRESETS = [1, 2, 3];
/** In tap mode, give up after this long without a code. */
const TAP_TIMEOUT_MS = 4000;

/** Continuous camera scanning ("rychlá kontrola"). Returns a cleanup function. */
export function scanView(root: HTMLElement): () => void {
  const settings = loadSettings();
  const tapMode = settings.trigger === 'tap';
  const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
  const roiSize = `${settings.roiFraction * 100}vmin`;
  const roi = h(
    'div',
    { class: 'scan-roi', style: `width:${roiSize};height:${roiSize}` },
    h('div', { class: 'scan-crosshair' }),
  );
  const stats = h('div', { class: 'scan-stats mono' }, 'Spouštím kameru…');
  const status = h(
    'div',
    { class: 'scan-status' },
    tapMode ? 'Zaměřte kříž na kód a stiskněte Načíst' : 'Zaměřte kříž na QR kód',
  );
  const progress = h('a', { href: '#/inspection', class: 'scan-progress' }, '');
  const torchButton = h('button', { class: 'btn btn-small hidden' }, 'Svítilna');
  const zoomBox = h('div', { class: 'scan-zoom hidden' });
  const tapButton = h('button', { class: 'btn btn-ok scan-tap' }, 'Načíst');

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
        progress,
        torchButton,
      ),
      zoomBox,
      stats,
      status,
      tapMode && tapButton,
    ),
  );

  let camera: CameraHandle | null = null;
  let engine: DecodeEngine | null = null;
  let session: ScanSession | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let torchOn = false;
  let disposed = false;
  let starting: Promise<void> | null = null;
  let tapTimer: ReturnType<typeof setTimeout> | undefined;

  const refreshProgress = async () => {
    const inspection = await activeInspection();
    if (!inspection || disposed) return;
    const s = await summarize(inspection.id);
    progress.textContent = `Zkontrolováno ${s.checked} z ${s.total} ›`;
  };

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
    torchOn = false;
    torchButton.classList.remove('active');
    torchButton.classList.toggle('hidden', !cam.torchSupported);
    torchButton.onclick = () => {
      torchOn = !torchOn;
      torchButton.classList.toggle('active', torchOn);
      void cam.setTorch(torchOn);
    };

    const zoom = cam.zoom;
    if (!zoom || zoom.max <= zoom.min) return;
    // Changes are coalesced by the camera's constraint queue, so dragging cannot flood iOS.
    const slider = h('input', {
      type: 'range',
      min: zoom.min,
      max: zoom.max,
      step: zoom.step || 0.1,
      value: zoom.min,
      'aria-label': 'Zoom',
    });
    slider.oninput = () => void cam.setZoom(Number(slider.value));
    const presets = ZOOM_PRESETS.filter((z) => z >= zoom.min && z <= zoom.max).map((z) =>
      h(
        'button',
        {
          class: 'btn btn-small',
          onclick: () => {
            slider.value = String(z);
            void cam.setZoom(z);
          },
        },
        `${z}×`,
      ),
    );
    zoomBox.replaceChildren(...presets, slider);
    zoomBox.classList.remove('hidden');
  };

  const start = async () => {
    await startCamera('start');
    engine =
      settings.engine === 'native'
        ? new NativeDetectorEngine()
        : new ZxingWorkerEngine(() => new DecodeWorker(), {
            tryHarder: settings.tryHarder,
            formats: ['QRCode'],
            maxSymbols: 4,
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
      confirmHits: settings.confirmHits,
      rearmDelayMs: tapMode ? 0 : settings.rearmDelayMs,
      centerZone: settings.centerZone,
      onStats: (s) => {
        stats.textContent =
          `${engine?.name} · ${s.fps.toFixed(1)} sn/s · dekód ${s.avgDecodeMs.toFixed(1)} ms · ` +
          `výřez ${s.avgGrabMs.toFixed(1)} ms · ${s.frameWidth}×${s.frameHeight} · ` +
          `kamera ${camera?.width}×${camera?.height}`;
      },
      onError: (error) => (status.textContent = `Chyba dekodéru: ${error.message}`),
      onScan: (scan) => {
        clearTimeout(tapTimer);
        void runCheck({
          mode: 'camera',
          raw: scan.text,
          toReadMs: scan.sinceResumeMs ?? 0,
          decodeMs: scan.decodeMs,
        }).then(afterCard);
      },
    });
    session.start();
    if (tapMode) session.pause();
    await requestWakeLock();
  };

  tapButton.onclick = () => {
    if (!session) return;
    status.textContent = 'Hledám kód…';
    session.resume(true);
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      session?.pause();
      status.textContent = 'Kód nenalezen – zaměřte kříž na kód a zkuste znovu';
    }, TAP_TIMEOUT_MS);
  };

  // Taking a photo with the system camera can stop our stream on iOS – recover it.
  const afterCard = async () => {
    if (disposed) return;
    void refreshProgress();
    if (camera && camera.track.readyState === 'ended') {
      camera.stop();
      await startCamera('restart');
    } else if (video.paused) {
      await video.play().catch(() => undefined);
    }
    if (tapMode) {
      status.textContent = 'Zaměřte kříž na kód a stiskněte Načíst';
      return;
    }
    status.textContent = 'Zaměřte kříž na QR kód';
    session?.resume();
  };

  const stopAll = () => {
    clearTimeout(tapTimer);
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
  void refreshProgress();
  run();

  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibility);
    stopAll();
  };
}
