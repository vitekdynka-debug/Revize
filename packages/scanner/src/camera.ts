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

  const applyOrThrow = (constraint: Record<string, unknown>) => applyAdvanced(track, constraint);
  return {
    stream,
    track,
    torchSupported: capabilities.torch === true,
    zoom: capabilities.zoom ?? null,
    width: video.videoWidth,
    height: video.videoHeight,
    startMs: performance.now() - startedAt,
    setTorch: (on) => applyOrThrow({ torch: on }),
    setZoom: (value) => applyOrThrow({ zoom: value }),
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

function applyAdvanced(track: MediaStreamTrack, constraint: Record<string, unknown>) {
  return track.applyConstraints({ advanced: [constraint as MediaTrackConstraintSet] });
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}
