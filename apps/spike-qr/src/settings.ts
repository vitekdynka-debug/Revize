export type EngineChoice = 'zxing' | 'native';
export type Resolution = '720p' | '1080p' | '4k';

export interface SpikeSettings {
  engine: EngineChoice;
  resolution: Resolution;
  /** Scan square relative to the shorter screen side. */
  roiFraction: number;
  maxDecodeSide: number;
  tryHarder: boolean;
  cooldownMs: number;
  /** 'auto' scans continuously; 'tap' decodes only after tapping "Načíst". */
  trigger: 'auto' | 'tap';
  /** Reads of the same code required before it is accepted. */
  confirmHits: number;
  /** Pause after closing a card before the next code is accepted (ms). */
  rearmDelayMs: number;
  /** How close to the crosshair a code must be (fraction of the scan area side). */
  centerZone: number;
  sound: boolean;
  iosHaptic: boolean;
  deviceId: string;
}

export const RESOLUTIONS: Record<Resolution, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

const DEFAULTS: SpikeSettings = {
  engine: 'zxing',
  resolution: '1080p',
  roiFraction: 0.6,
  maxDecodeSide: 720,
  tryHarder: true,
  cooldownMs: 2500,
  trigger: 'auto',
  confirmHits: 3,
  rearmDelayMs: 800,
  centerZone: 0.25,
  sound: true,
  iosHaptic: true,
  deviceId: '',
};

const KEY = 'revize-spike-settings';

export function loadSettings(): SpikeSettings {
  try {
    const stored = localStorage.getItem(KEY);
    return stored
      ? { ...DEFAULTS, ...(JSON.parse(stored) as Partial<SpikeSettings>) }
      : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: SpikeSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or storage blocked – settings just won't persist.
  }
}
