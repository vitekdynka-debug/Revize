import { h } from './dom.js';
import type { Outcome } from './log.js';
import type { MockItem } from './mock-items.js';

export interface Decision {
  outcome: Outcome;
  photos: number;
  /** Time from showing the card to the decision (ms). */
  decisionMs: number;
}

let dismissActive: (() => void) | null = null;

/** Closes an open card without a decision (e.g. when navigating away). */
export function dismissItemCard(): void {
  dismissActive?.();
}

/**
 * Full-screen card with the scanned item and big OK / Závada buttons.
 * Resolves when the technician decides (OK is a single tap), or with null when dismissed.
 */
export function showItemCard(item: MockItem | null, raw: string): Promise<Decision | null> {
  const shownAt = performance.now();
  return new Promise((resolve) => {
    const close = (decision: Decision | null) => {
      overlay.remove();
      dismissActive = null;
      resolve(decision);
    };
    const finish = (outcome: Outcome, photos = 0) =>
      close({ outcome, photos, decisionMs: performance.now() - shownAt });

    const body = item
      ? h(
          'div',
          { class: 'card-body' },
          h('div', { class: 'card-number' }, item.itemNumber),
          h('div', { class: 'card-meta' }, `${item.type} · ${item.location}`),
          h(
            'div',
            { class: 'card-actions' },
            h('button', { class: 'btn btn-ok', onclick: () => finish('ok') }, 'V pořádku'),
            h('button', { class: 'btn btn-defect', onclick: () => showDefectForm() }, 'Závada'),
          ),
        )
      : h(
          'div',
          { class: 'card-body' },
          h('div', { class: 'card-number unknown' }, 'Neznámý kód'),
          h('div', { class: 'card-meta mono' }, raw),
          h(
            'div',
            { class: 'card-actions' },
            h(
              'button',
              { class: 'btn btn-neutral', onclick: () => finish('unknown') },
              'Pokračovat',
            ),
          ),
        );

    const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, body);
    document.body.append(overlay);
    dismissActive = () => close(null);

    function showDefectForm() {
      let photos = 0;
      const photoCount = h('span', {}, '0');
      const photoInput = h('input', {
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        class: 'hidden',
        onchange: () => {
          photos += photoInput.files?.length ?? 0;
          photoCount.textContent = String(photos);
          photoInput.value = '';
        },
      });
      body.replaceChildren(
        h('div', { class: 'card-number' }, item?.itemNumber ?? raw),
        h('label', { class: 'field' }, 'Popis závady', h('textarea', { rows: 3 })),
        h(
          'label',
          { class: 'toggle' },
          h('input', { type: 'checkbox' }),
          ' Závažná – vyřadit z provozu',
        ),
        photoInput,
        h(
          'button',
          { class: 'btn btn-neutral', onclick: () => photoInput.click() },
          'Vyfotit závadu (',
          photoCount,
          ')',
        ),
        h(
          'div',
          { class: 'card-actions' },
          h(
            'button',
            { class: 'btn btn-defect', onclick: () => finish('defect', photos) },
            'Uložit závadu',
          ),
        ),
      );
    }
  });
}
