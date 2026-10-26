import { createWebFeedback } from '@revize/scanner';
import { showItemCard } from './item-card.js';
import { addLog, type InputMode } from './log.js';
import { findItem } from './mock-items.js';
import { loadSettings, type SpikeSettings } from './settings.js';

const initial = loadSettings();
export let feedback = createWebFeedback({
  sound: initial.sound,
  iosSwitchHaptic: initial.iosHaptic,
});

export function rebuildFeedback(settings: SpikeSettings): void {
  feedback = createWebFeedback({ sound: settings.sound, iosSwitchHaptic: settings.iosHaptic });
}

export function configLabel(s: SpikeSettings): string {
  return `${s.engine}/${s.resolution}/roi${s.roiFraction}/max${s.maxDecodeSide}${s.tryHarder ? '/th' : ''}`;
}

let cardOpen = false;

export function isCardOpen(): boolean {
  return cardOpen;
}

export interface CheckInput {
  mode: InputMode;
  raw: string;
  toReadMs: number;
  decodeMs?: number;
}

/** Shows the quick-check card for a recognized code and records the measurement. */
export async function runCheck(input: CheckInput): Promise<void> {
  if (cardOpen) return;
  cardOpen = true;
  try {
    const item = findItem(input.raw);
    if (item) feedback.success();
    else feedback.failure();

    const decision = await showItemCard(item, input.raw);
    if (!decision) return;
    addLog({
      kind: 'check',
      at: new Date().toISOString(),
      mode: input.mode,
      raw: input.raw,
      itemNumber: item?.itemNumber ?? null,
      outcome: decision.outcome,
      toReadMs: Math.round(input.toReadMs),
      decisionMs: Math.round(decision.decisionMs),
      totalMs: Math.round(input.toReadMs + decision.decisionMs),
      decodeMs: input.decodeMs === undefined ? null : Math.round(input.decodeMs * 10) / 10,
      photos: decision.photos,
      config: input.mode === 'camera' ? configLabel(loadSettings()) : '',
    });
  } finally {
    cardOpen = false;
  }
}
