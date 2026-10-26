export interface CameraOptions {
  deviceId?: string;
  idealWidth?: number;
  idealHeight?: number;
}

export interface ZoomRange {
  min: number;
  max: number;
  step: number;
}

export interface CameraHandle {
  readonly stream: MediaStream;
  readonly track: MediaStreamTrack;
  readonly torchSupported: boolean;
  readonly zoom: ZoomRange | null;
  /** Resolution actually delivered by the camera. */
  readonly width: number;
  readonly height: number;
  /** Time from requesting the camera until the first frame was playing (ms). */
  readonly startMs: number;
  setTorch(on: boolean): Promise<void>;
  setZoom(value: number): Promise<void>;
  stop(): void;
}

// Image capture constraints are not part of TypeScript's DOM typings yet.
interface ExtendedCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: { min: number; max: number; step: number };
  focusMode?: string[];
}

export async function openCamera(
  video: HTMLVideoElement,
  options: CameraOptions = {},
): Promise<CameraHandle> {
  const startedAt = performance.now();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      ...(options.deviceId
        ? { deviceId: { exact: options.deviceId } }
        : { facingMode: { ideal: 'environment' } }),
      width: { ideal: options.idealWidth ?? 1920 },
      height: { ideal: options.idealHeight ?? 1080 },
    },
  });
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error('Camera stream has no video track');

  video.setAttribute('playsinline', '');
  video.muted = true;
  video.srcObject = stream;
  await video.play();

  const capabilities: ExtendedCapabilities =
    typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
  if (capabilities.focusMode?.includes('continuous')) {
    await applyAdvanced(track, { focusMode: 'continuous' }).catch(() => undefined);
  }

  const torchSupported = capabilities.torch === true;
  const zoom = capabilities.zoom ?? null;
  const constraints = new ConstraintQueue(track);
  return {
    stream,
    track,
    torchSupported,
    zoom,
    width: video.videoWidth,
    height: video.videoHeight,
    startMs: performance.now() - startedAt,
    setTorch: (on) => (torchSupported ? constraints.set({ torch: on }) : Promise.resolve()),
    setZoom: (value) =>
      zoom
        ? constraints.set({ zoom: Math.min(zoom.max, Math.max(zoom.min, value)) })
        : Promise.resolve(),
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

/**
 * Serializes and coalesces camera setting changes. iOS Safari freezes when several
 * `applyConstraints` calls overlap (e.g. dragging the zoom slider with the torch on), so at most
 * one call is in flight and it always carries the complete desired state (torch + zoom together,
 * otherwise iOS may switch the torch off when only zoom changes).
 */
export class ConstraintQueue {
  private readonly desired: Record<string, unknown> = {};
  private running: Promise<void> | null = null;
  private dirty = false;

  constructor(private readonly track: MediaStreamTrack) {}

  set(patch: Record<string, unknown>): Promise<void> {
    Object.assign(this.desired, patch);
    this.dirty = true;
    this.running ??= this.drain().finally(() => (this.running = null));
    return this.running;
  }

  private async drain() {
    while (this.dirty) {
      this.dirty = false;
      await applyAdvanced(this.track, { ...this.desired }).catch(() => undefined);
    }
  }
}

function applyAdvanced(track: MediaStreamTrack, constraint: Record<string, unknown>) {
  return track.applyConstraints({ advanced: [constraint as MediaTrackConstraintSet] });
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}
