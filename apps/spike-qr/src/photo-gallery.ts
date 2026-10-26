import type { PhotoRow } from './db.js';
import { h } from './dom.js';
import { compressPhoto } from './photo.js';
import { addPhoto, deletePhoto, photosOf, photoUrl, type PhotoTarget } from './photos.js';

export interface PhotoGallery {
  element: HTMLElement;
  /** Resolves when all taken photos are compressed and stored. */
  settled(): Promise<void>;
  /** Ids of photos added since the gallery was opened (to undo them on cancel). */
  readonly addedIds: readonly string[];
  count(): number;
  dispose(): void;
}

export interface PhotoGalleryOptions {
  addLabel: string;
  emptyText?: string;
  onChange?: (count: number) => void;
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Thumbnails with "take photo" and a full-screen viewer (browse, delete). Every photo is stored
 * in IndexedDB as soon as it is taken (see photos.ts), deletion asks for confirmation.
 */
export function createPhotoGallery(
  target: PhotoTarget,
  options: PhotoGalleryOptions,
): PhotoGallery {
  let photos: PhotoRow[] = [];
  const urls = new Map<string, string>();
  const addedIds: string[] = [];
  let processing: Promise<void> = Promise.resolve();
  let pending = 0;

  const thumbs = h('div', { class: 'thumbs' });
  const error = h('div', { class: 'card-error' });
  const input = h('input', {
    type: 'file',
    accept: 'image/*',
    capture: 'environment',
    class: 'hidden',
  });
  const addButton = h(
    'button',
    { class: 'btn btn-neutral', onclick: () => input.click() },
    options.addLabel,
  );
  const element = h('div', { class: 'gallery' }, thumbs, error, input, addButton);

  const urlOf = async (photo: PhotoRow) => {
    let url = urls.get(photo.id);
    if (!url) {
      url = await photoUrl(photo);
      urls.set(photo.id, url);
    }
    return url;
  };

  const render = async () => {
    const items = await Promise.all(
      photos.map(async (photo, index) =>
        h(
          'button',
          {
            class: 'thumb',
            'aria-label': `Foto ${index + 1}`,
            onclick: () => void openViewer(index),
          },
          h('img', { src: await urlOf(photo), alt: '' }),
        ),
      ),
    );
    thumbs.replaceChildren(
      ...(items.length
        ? items
        : options.emptyText
          ? [h('span', { class: 'muted small' }, options.emptyText)]
          : []),
    );
    addButton.textContent = pending > 0 ? `Ukládám fotku… (${pending})` : options.addLabel;
    addButton.disabled = pending > 0;
    options.onChange?.(photos.length);
    options.onBusyChange?.(pending > 0);
  };

  const reload = async () => {
    photos = await photosOf(target);
    await render();
  };

  input.onchange = () => {
    const files = [...(input.files ?? [])];
    input.value = '';
    pending += files.length;
    void render();
    processing = processing.then(async () => {
      for (const file of files) {
        try {
          const row = await addPhoto(target, await compressPhoto(file));
          addedIds.push(row.id);
          photos.push(row);
        } catch (e) {
          error.textContent = `Fotku se nepodařilo uložit: ${String(e)}`;
        } finally {
          pending -= 1;
          await render();
        }
      }
    });
  };

  const openViewer = async (start: number) => {
    let index = start;
    const image = h('img', { class: 'viewer-image', alt: '' });
    const counter = h('span', { class: 'viewer-counter' });
    const show = async () => {
      const photo = photos[index];
      if (!photo) return close();
      image.src = await urlOf(photo);
      counter.textContent = `${index + 1} / ${photos.length} · ${new Date(photo.takenAt).toLocaleString('cs-CZ')}`;
    };
    const step = (delta: number) => {
      if (photos.length === 0) return;
      index = (index + delta + photos.length) % photos.length;
      void show();
    };
    const close = () => viewer.remove();
    const viewer = h(
      'div',
      { class: 'viewer', role: 'dialog', 'aria-modal': 'true' },
      image,
      h(
        'div',
        { class: 'viewer-bar' },
        h('button', { class: 'btn', onclick: () => step(-1), 'aria-label': 'Předchozí' }, '‹'),
        counter,
        h('button', { class: 'btn', onclick: () => step(1), 'aria-label': 'Další' }, '›'),
        h(
          'button',
          {
            class: 'btn btn-defect',
            onclick: async () => {
              const photo = photos[index];
              if (!photo || !confirm('Smazat tuto fotku?')) return;
              await deletePhoto(photo.id);
              URL.revokeObjectURL(urls.get(photo.id) ?? '');
              urls.delete(photo.id);
              photos.splice(index, 1);
              await render();
              if (photos.length === 0) return close();
              index = Math.min(index, photos.length - 1);
              await show();
            },
          },
          'Smazat',
        ),
        h('button', { class: 'btn btn-neutral', onclick: close }, 'Zavřít'),
      ),
    );
    document.body.append(viewer);
    await show();
  };

  void reload();
  return {
    element,
    settled: () => processing,
    get addedIds() {
      return addedIds;
    },
    count: () => photos.length,
    dispose: () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    },
  };
}
