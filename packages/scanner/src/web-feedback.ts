export interface ScanFeedback {
  /** Must be called from a user gesture (tap) – iOS only allows audio after that. */
  unlock(): void;
  success(): void;
  failure(): void;
  readonly vibrationSupported: boolean;
}

export interface WebFeedbackOptions {
  sound?: boolean;
  /**
   * iOS 18+ Safari plays a system haptic when a `<input type="checkbox" switch>` is toggled
   * through its label. Experimental; only reliable within a user gesture.
   */
  iosSwitchHaptic?: boolean;
}

export function createWebFeedback(options: WebFeedbackOptions = {}): ScanFeedback {
  let audio: AudioContext | null = null;
  const vibrationSupported = typeof navigator.vibrate === 'function';
  const haptic = options.iosSwitchHaptic ? createSwitchHaptic() : null;

  const beep = (frequency: number, durationMs: number) => {
    if (!options.sound || !audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.15;
    oscillator.connect(gain).connect(audio.destination);
    const now = audio.currentTime;
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000);
  };

  return {
    vibrationSupported,
    unlock() {
      if (!options.sound) return;
      audio ??= new AudioContext();
      void audio.resume();
    },
    success() {
      beep(1760, 70);
      if (vibrationSupported) navigator.vibrate(40);
      haptic?.();
    },
    failure() {
      beep(330, 180);
      if (vibrationSupported) navigator.vibrate([60, 60, 60]);
    },
  };
}

function createSwitchHaptic(): () => void {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.append(input);
  label.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
  label.setAttribute('aria-hidden', 'true');
  document.body.append(label);
  return () => label.click();
}
