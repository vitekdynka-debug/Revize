import type { ResultRow } from './db.js';
import { h } from './dom.js';
import { displayFields, locationLabel, type CatalogItem } from './mock-items.js';
import { createPhotoGallery, type PhotoGallery } from './photo-gallery.js';
import { deletePhoto } from './photos.js';

export interface CardResult {
  outcome: 'ok' | 'defect';
  defectDescription: string;
  outOfService: boolean;
}

export interface Decision {
  outcome: 'ok' | 'defect' | 'unknown';
  photos: number;
  /** Time from showing the card to the decision (ms). */
  decisionMs: number;
}

export interface ItemCardOptions {
  item: CatalogItem | null;
  raw: string;
  inspectionId: string;
  /** Result already recorded for this item in the current inspection. */
  existing: ResultRow | null;
  existingPhotos: number;
  /** Persists the result; the card stays open (and shows an error) until this resolves. */
  onSave: (result: CardResult) => Promise<void>;
  /** "Založit nový artikl" on an unknown code. */
  onCreateItem?: (raw: string) => void;
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
 * Photos are stored the moment they are taken; cancelling removes defect photos taken in
 * this card (item photos such as a nameplate are kept – they belong to the item).
 */
export function showItemCard(options: ItemCardOptions): Promise<Decision | null> {
  const { item, raw, existing, inspectionId } = options;
  const shownAt = performance.now();
  const galleries: PhotoGallery[] = [];
  let resultGallery: PhotoGallery | null = null;
  let itemGallery: PhotoGallery | null = null;

  return new Promise((resolve) => {
    const body = h('div', { class: 'card-body' });
    const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, body);

    const close = (decision: Decision | null) => {
      overlay.remove();
      galleries.forEach((g) => g.dispose());
      dismissActive = null;
      resolve(decision);
    };
    const cancel = async () => {
      // Discard defect photos taken in this card when the result is not saved.
      await resultGallery?.settled();
      for (const id of resultGallery?.addedIds ?? []) await deletePhoto(id);
      close(null);
    };
    const cancelButton = (label = 'Zrušit') =>
      h('button', { class: 'btn btn-cancel', onclick: () => void cancel() }, label);

    const save = async (result: CardResult, buttons: HTMLButtonElement[], error: HTMLElement) => {
      buttons.forEach((b) => (b.disabled = true));
      error.textContent = '';
      try {
        await Promise.all(galleries.map((g) => g.settled()));
        await options.onSave(result);
        close({
          outcome: result.outcome,
          photos: resultGallery?.count() ?? options.existingPhotos,
          decisionMs: performance.now() - shownAt,
        });
      } catch (e) {
        error.textContent = `Uložení selhalo: ${String(e)}. Zkuste to znovu.`;
        buttons.forEach((b) => (b.disabled = false));
      }
    };

    const head = (it: CatalogItem) => [
      h(
        'div',
        { class: 'card-head' },
        h('div', { class: 'card-number' }, it.itemNumber),
        h('span', { class: 'badge' }, it.type),
        it.local ? h('span', { class: 'badge badge-new' }, 'nový') : '',
      ),
      h('div', { class: 'card-location' }, locationLabel(it)),
    ];

    const showUnknown = () => {
      body.replaceChildren(
        h('div', { class: 'card-number unknown' }, 'Neznámý kód'),
        h('div', { class: 'card-meta mono' }, raw),
        h('p', { class: 'muted' }, 'Artikl s tímto kódem v evidenci není.'),
        h(
          'div',
          { class: 'card-actions' },
          options.onCreateItem
            ? h(
                'button',
                {
                  class: 'btn btn-accent',
                  onclick: () => {
                    close(null);
                    options.onCreateItem!(raw);
                  },
                },
                'Založit nový artikl',
              )
            : '',
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

    // Item photos (nameplate, overview) – kept across inspections, also for items that are OK.
    const itemPhotos = (it: CatalogItem) => {
      if (!itemGallery) {
        itemGallery = createPhotoGallery(
          { owner: 'item', inspectionId, itemNumber: it.itemNumber },
          { addLabel: 'Vyfotit artikl (štítek…)', emptyText: 'Bez fotek artiklu.' },
        );
        galleries.push(itemGallery);
      }
      return itemGallery.element;
    };

    const showDetail = (it: CatalogItem) => {
      const error = h('div', { class: 'card-error' });
      const ok = h('button', { class: 'btn btn-ok' }, 'V pořádku');
      const defect = h('button', { class: 'btn btn-defect' }, 'Závada');
      ok.onclick = () =>
        void save(
          { outcome: 'ok', defectDescription: '', outOfService: false },
          [ok, defect],
          error,
        );
      defect.onclick = () => showDefectForm(it);

      body.replaceChildren(
        ...head(it),
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
          ...displayFields(it).flatMap(([label, value]) => [
            h('dt', {}, label),
            h('dd', {}, value),
          ]),
          h('dt', {}, 'Poslední kontrola'),
          h(
            'dd',
            {},
            it.lastInspection
              ? `${new Date(it.lastInspection.date).toLocaleDateString('cs-CZ')} – ${it.lastInspection.result}`
              : '–',
          ),
          h('dt', {}, 'Příští kontrola'),
          h(
            'dd',
            {},
            it.nextInspection ? new Date(it.nextInspection).toLocaleDateString('cs-CZ') : '–',
          ),
          h('dt', {}, 'QR kód'),
          h('dd', { class: 'mono' }, it.qrCode ?? '–'),
        ),
        h('h3', { class: 'section-title' }, 'Fotky artiklu'),
        itemPhotos(it),
        error,
        h('div', { class: 'card-actions' }, ok, defect),
        cancelButton(),
      );
    };

    const showDefectForm = (it: CatalogItem) => {
      const error = h('div', { class: 'card-error' });
      const description = h('textarea', {
        rows: 3,
        placeholder: 'Např. ohnutý příčník, chybí pojistka…',
      });
      description.value = existing?.outcome === 'defect' ? existing.defectDescription : '';
      const outOfService = h('input', { type: 'checkbox' });
      outOfService.checked = existing?.outOfService ?? false;
      const saveButton = h('button', { class: 'btn btn-defect' }, 'Uložit závadu');
      const backButton = h(
        'button',
        { class: 'btn btn-cancel', onclick: () => showDetail(it) },
        'Zpět',
      );

      resultGallery ??= (() => {
        const gallery = createPhotoGallery(
          { owner: 'result', inspectionId, itemNumber: it.itemNumber },
          {
            addLabel: 'Vyfotit závadu',
            emptyText: 'Zatím žádná fotka závady.',
            // A quick tap on "Uložit" right after taking a photo must wait for it.
            onBusyChange: (busy) => {
              const button = currentSave;
              button.disabled = busy;
              button.textContent = busy ? 'Ukládám fotku…' : 'Uložit závadu';
            },
          },
        );
        galleries.push(gallery);
        return gallery;
      })();
      currentSave = saveButton;

      saveButton.onclick = () => {
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
          },
          [saveButton, backButton],
          error,
        );
      };

      body.replaceChildren(
        ...head(it),
        h('label', { class: 'field' }, 'Popis závady', description),
        h('label', { class: 'toggle' }, outOfService, ' Závažná – vyřadit z provozu'),
        h('h3', { class: 'section-title' }, 'Fotky závady'),
        resultGallery.element,
        error,
        h('div', { class: 'card-actions' }, saveButton),
        backButton,
      );
    };
    // The defect form can be opened repeatedly (Zpět → Závada); the gallery outlives each form.
    let currentSave = h('button');

    if (item) showDetail(item);
    else showUnknown();
    document.body.append(overlay);
    dismissActive = () => close(null);
  });
}
