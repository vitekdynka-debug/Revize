import { isNativeDetectorAvailable } from '@revize/scanner';

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** 'granted' | 'denied' | 'prompt' | 'unknown' (Safari may not support the camera permission query). */
export async function cameraPermission(): Promise<string> {
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

export interface EnvironmentReport {
  secureContext: boolean;
  standalone: boolean;
  camera: boolean;
  permission: string;
  barcodeDetector: boolean;
  vibrate: boolean;
  wakeLock: boolean;
  persistentStorage: string;
  userAgent: string;
  screen: string;
}

export async function environmentReport(): Promise<EnvironmentReport> {
  let persistentStorage = 'unknown';
  try {
    if (navigator.storage?.persisted) {
      persistentStorage = (await navigator.storage.persisted()) ? 'ano' : 'ne';
    }
  } catch {
    // ignore
  }
  return {
    secureContext: window.isSecureContext,
    standalone: isStandalone(),
    camera: typeof navigator.mediaDevices?.getUserMedia === 'function',
    permission: await cameraPermission(),
    barcodeDetector: await isNativeDetectorAvailable(),
    vibrate: typeof navigator.vibrate === 'function',
    wakeLock: 'wakeLock' in navigator,
    persistentStorage,
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x`,
  };
}
