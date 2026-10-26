import type { ResultRow } from './db.js';
import { h } from './dom.js';
import { locationLabel, type MockItem } from './mock-items.js';
import { compressPhoto } from './photo.js';

export interface CardResult {
  outcome: 'ok' | 'defect';
  defectDescription: string;
  outOfService: boolean;
  photos: Blob[];
}

export interface Decision {
  outcome: 'ok' | 'defect' | 'unknown';
  photos: number;
  /** Time from showing the card to the decision (ms). */
  decisionMs: number;
}

export interface ItemCardOptions {
  item: MockItem | null;
  raw: string;
  /** Result already recorded for this item in the current inspection. */
  existing: ResultRow | null;
  existingPhotos: number;
  /** Persists the result; the card stays open (and shows an error) until this resolves. */
  onSave: (result: CardResult) => Promise<void>;
}

let dismissActive: (() => void) | null = null;

/** Closes an open card without a decision (e.g. when navigating away). */
export function dismissItemCard(): void {
  dismissActive?.();
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

/**
 * Bottom sheet with the item detail and big V pořádku / Závada / Zrušit buttons.
 * Resolves with the decision once it is saved, or with null when cancelled or dismissed.
 */
export function showItemCard(options: ItemCardOptions): Promise<Decision | null> {
  const { item, raw, existing } = options;
  const shownAt = performance.now();

  return new Promise((resolve) => {
    const body = h('div', { class: 'card-body' });
    const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, body);
    const objectUrls: string[] = [];

    const close = (decision: Decision | null) => {
      overlay.remove();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      dismissActive = null;
      resolve(decision);
    };
    const cancelButton = (label = 'Zrušit') =>
      h('button', { class: 'btn btn-cancel', onclick: () => close(null) }, label);

    const save = async (result: CardResult, buttons: HTMLButtonElement[], error: HTMLElement) => {
      buttons.forEach((b) => (b.disabled = true));
      error.textContent = '';
      try {
        await options.onSave(result);
        close({
          outcome: result.outcome,
          photos: result.photos.length,
          decisionMs: performance.now() - shownAt,
        });
      } catch (e) {
        error.textContent = `Uložení selhalo: ${String(e)}. Zkuste to znovu.`;
        buttons.forEach((b) => (b.disabled = false));
      }
    };

    const showUnknown = () => {
      body.replaceChildren(
        h('div', { class: 'card-number unknown' }, 'Neznámý kód'),
        h('div', { class: 'card-meta mono' }, raw),
        h('p', { class: 'muted' }, 'Artikl s tímto kódem v evidenci není.'),
        h(
          'div',
          { class: 'card-actions' },
          h(
            'button',
            {
              class: 'btn btn-neutral',
              onclick: () =>
                close({ outcome: 'unknown', photos: 0, decisionMs: performance.now() - shownAt }),
            },
            'Pokračovat',
          ),
        ),
      );
    };

    const showDetail = (it: MockItem) => {
      const error = h('div', { class: 'card-error' });
      const ok = h('button', { class: 'btn btn-ok' }, 'V pořádku');
      const defect = h('button', { class: 'btn btn-defect' }, 'Závada');
      ok.onclick = () =>
        void save(
          { outcome: 'ok', defectDescription: '', outOfService: false, photos: [] },
          [ok, defect],
          error,
        );
      defect.onclick = () => showDefectForm(it);

      body.replaceChildren(
        h(
          'div',
          { class: 'card-head' },
          h('div', { class: 'card-number' }, it.itemNumber),
          h('span', { class: 'badge' }, it.type),
        ),
        h('div', { class: 'card-location' }, locationLabel(it)),
        !existing
          ? ''
          : h(
              'div',
              { class: `card-status ${existing.outcome}` },
              `V této kontrole už zkontrolováno ${time(existing.recordedAt)}: `,
              h(
                'strong',
                {},
                existing.outcome === 'ok'
                  ? 'V pořádku'
                  : `Závada${existing.outOfService ? ' – vyřazeno' : ''}`,
              ),
              existing.defectDescription ? ` – ${existing.defectDescription}` : '',
              options.existingPhotos ? ` (${options.existingPhotos} foto)` : '',
              '. Novým výsledkem ho přepíšete.',
            ),
        h(
          'dl',
          { class: 'card-fields' },
          ...it.fields.flatMap(([label, value]) => [h('dt', {}, label), h('dd', {}, value)]),
          h('dt', {}, 'Poslední kontrola'),
          h(
            'dd',
            {},
            it.lastInspection
              ? `${new Date(it.lastInspection.date).toLocaleDateString('cs-CZ')} – ${it.lastInspection.result}`
              : '–',
          ),
          h('dt', {}, 'Příští kontrola'),
          h('dd', {}, new Date(it.nextInspection).toLocaleDateString('cs-CZ')),
          h('dt', {}, 'QR kód'),
          h('dd', { class: 'mono' }, it.qrCode),
        ),
        error,
        h('div', { class: 'card-actions' }, ok, defect),
        cancelButton(),
      );
    };

    const showDefectForm = (it: MockItem) => {
      const photos: Blob[] = [];
      const error = h('div', { class: 'card-error' });
      const description = h('textarea', {
        rows: 3,
        placeholder: 'Např. ohnutý příčník, chybí pojistka…',
      });
      description.value = existing?.outcome === 'defect' ? existing.defectDescription : '';
      const outOfService = h('input', { type: 'checkbox' });
      outOfService.checked = existing?.outOfService ?? false;
      const thumbs = h('div', { class: 'thumbs' });
      const photoButton = h('button', { class: 'btn btn-neutral' }, 'Vyfotit závadu');
      const saveButton = h('button', { class: 'btn btn-defect' }, 'Uložit závadu');
      const photoInput = h('input', {
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        class: 'hidden',
      });
      // Photos are compressed asynchronously; saving waits for it (a quick tap on "Uložit"
      // right after taking a photo used to save the defect without the photo).
      let processing: Promise<void> = Promise.resolve();
      let pending = 0;
      const refreshButtons = () => {
        photoButton.textContent = photos.length
          ? `Vyfotit další (${photos.length})`
          : 'Vyfotit závadu';
        saveButton.disabled = pending > 0;
        saveButton.textContent = pending > 0 ? 'Zpracovávám fotku…' : 'Uložit závadu';
      };
      photoInput.onchange = () => {
        const files = [...(photoInput.files ?? [])];
        photoInput.value = '';
        pending += files.length;
        refreshButtons();
        processing = processing.then(async () => {
          for (const file of files) {
            try {
              const blob = await compressPhoto(file);
              photos.push(blob);
              const url = URL.createObjectURL(blob);
              objectUrls.push(url);
              thumbs.append(h('img', { src: url, alt: `Foto ${photos.length}` }));
            } catch (e) {
              error.textContent = `Fotku se nepodařilo zpracovat: ${String(e)}`;
            } finally {
              pending -= 1;
              refreshButtons();
            }
          }
        });
      };
      photoButton.onclick = () => photoInput.click();

      const backButton = h(
        'button',
        { class: 'btn btn-cancel', onclick: () => showDetail(it) },
        'Zpět',
      );
      saveButton.onclick = async () => {
        await processing;
        if (description.value.trim() === '') {
          error.textContent = 'Napište popis závady.';
          description.focus();
          return;
        }
        void save(
          {
            outcome: 'defect',
            defectDescription: description.value.trim(),
            outOfService: outOfService.checked,
            photos,
          },
          [saveButton, backButton, photoButton],
          error,
        );
      };

      body.replaceChildren(
        h(
          'div',
          { class: 'card-head' },
          h('div', { class: 'card-number' }, it.itemNumber),
          h('span', { class: 'badge' }, it.type),
        ),
        h('div', { class: 'card-location' }, locationLabel(it)),
        h('label', { class: 'field' }, 'Popis závady', description),
        h('label', { class: 'toggle' }, outOfService, ' Závažná – vyřadit z provozu'),
        photoInput,
        photoButton,
        thumbs,
        error,
        h('div', { class: 'card-actions' }, saveButton),
        backButton,
      );
    };

    if (item) showDetail(item);
    else showUnknown();
    document.body.append(overlay);
    dismissActive = () => close(null);
  });
}
