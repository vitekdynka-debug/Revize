import { buildFieldValuesSchema, type FieldDefinition } from '@revize/shared';
import {
  addLocalItem,
  checkItemNumber,
  isQrCodeTaken,
  nextFreeItemNumber,
  qrCodeFromScan,
} from '../catalog.js';
import { runCheck } from '../check-flow.js';
import { db } from '../db.js';
import { h } from '../dom.js';
import { startInspection } from '../inspection.js';
import { EQUIPMENT_TYPES, TYPE_NAMES, type TypeName } from '../mock-items.js';
import { createPhotoGallery, type PhotoGallery } from '../photo-gallery.js';

const HALLS = ['A', 'B', 'C', 'D', 'E'];
const LAST_KEY = 'revize-spike-new-item-last';

interface LastUsed {
  type: TypeName;
  hall: string;
  row: number;
  position: number;
}

interface FormState extends LastUsed {
  values: Record<string, unknown>;
  itemNumber: string;
  qrText: string;
}

function loadLast(): LastUsed {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as LastUsed | null;
    if (stored) return { ...stored, position: stored.position + 1 };
  } catch {
    // ignore
  }
  return { type: 'Regál', hall: 'A', row: 1, position: 1 };
}

function saveLast(last: LastUsed) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(last));
  } catch {
    // ignore
  }
}

/** Big touch-friendly choice buttons. */
function segmented<T extends string>(
  options: readonly T[],
  value: T | null,
  onChange: (value: T | null) => void,
  allowEmpty = false,
): HTMLElement {
  const box = h('div', { class: 'segmented choice' });
  const render = (current: T | null) => {
    box.replaceChildren(
      ...options.map((option) =>
        h(
          'button',
          {
            type: 'button',
            class: `btn btn-small${option === current ? ' active' : ''}`,
            onclick: () => {
              const next = allowEmpty && option === current ? null : option;
              onChange(next);
              render(next);
            },
          },
          option,
        ),
      ),
    );
  };
  render(value);
  return box;
}

function stepper(value: number, onChange: (value: number) => void, label: string): HTMLElement {
  const input = h('input', {
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    class: 'stepper-input',
    'aria-label': label,
    value,
  });
  const set = (next: number) => {
    const clamped = Math.max(1, Math.min(999, next));
    input.value = String(clamped);
    onChange(clamped);
  };
  input.oninput = () => set(Number(input.value.replace(/\D/g, '')) || 1);
  return h(
    'div',
    { class: 'stepper' },
    h(
      'button',
      { type: 'button', class: 'btn btn-small', onclick: () => set(Number(input.value) - 1) },
      '−',
    ),
    input,
    h(
      'button',
      { type: 'button', class: 'btn btn-small', onclick: () => set(Number(input.value) + 1) },
      '+',
    ),
  );
}

/** Form control for one configurable field; writes the raw value into `values`. */
function fieldControl(field: FieldDefinition, values: Record<string, unknown>): HTMLElement {
  const set = (value: unknown) => (values[field.key] = value);
  switch (field.kind) {
    case 'select':
      return segmented(field.options, (values[field.key] as string) ?? null, set, !field.required);
    case 'multiselect': {
      const selected = new Set<string>((values[field.key] as string[]) ?? []);
      const box = h('div', { class: 'segmented choice' });
      const render = () =>
        box.replaceChildren(
          ...field.options.map((option) =>
            h(
              'button',
              {
                type: 'button',
                class: `btn btn-small${selected.has(option) ? ' active' : ''}`,
                onclick: () => {
                  if (selected.has(option)) selected.delete(option);
                  else selected.add(option);
                  set([...selected]);
                  render();
                },
              },
              option,
            ),
          ),
        );
      render();
      return box;
    }
    case 'boolean': {
      const current =
        values[field.key] === true ? 'Ano' : values[field.key] === false ? 'Ne' : null;
      return segmented(
        ['Ano', 'Ne'] as const,
        current,
        (v) => set(v === null ? null : v === 'Ano'),
        true,
      );
    }
    case 'integer':
    case 'number': {
      const input = h('input', {
        type: 'text',
        inputmode: field.kind === 'integer' ? 'numeric' : 'decimal',
        class: 'text-input',
        value: values[field.key] === undefined ? '' : String(values[field.key]),
      });
      input.oninput = () => {
        const text = input.value.trim().replace(',', '.');
        set(text === '' ? null : Number(text));
      };
      return field.unit
        ? h('div', { class: 'with-unit' }, input, h('span', {}, field.unit))
        : input;
    }
    case 'date': {
      const input = h('input', {
        type: 'date',
        class: 'text-input',
        value: (values[field.key] as string) ?? '',
      });
      input.oninput = () => set(input.value);
      return input;
    }
    case 'text': {
      const input = h('input', {
        type: 'text',
        class: 'text-input',
        value: (values[field.key] as string) ?? '',
      });
      input.oninput = () => set(input.value);
      return input;
    }
  }
}

/**
 * Creating an item in the field: type, number (next free offered), QR label, location,
 * the type's own fields (validated by the shared schema) and item photos (nameplate…).
 */
export function newItemView(root: HTMLElement, params: URLSearchParams): () => void {
  let disposed = false;
  let gallery: PhotoGallery | null = null;
  // Photos are stored immediately under a draft key and moved to the item number on save.
  const draftKey = `draft-${crypto.randomUUID()}`;
  const scannedCode = params.get('code');

  const fresh = (): FormState => ({
    ...loadLast(),
    values: {},
    itemNumber: nextFreeItemNumber(),
    qrText: scannedCode ? (qrCodeFromScan(scannedCode) ?? '') : '',
  });

  const render = async (state: FormState) => {
    const inspection = await startInspection();
    if (disposed) return;
    const definitions = [...EQUIPMENT_TYPES[state.type]]
      .filter((f) => !f.archived)
      .sort((a, b) => a.order - b.order);
    const errors = new Map<string, HTMLElement>();
    const errorFor = (key: string) => {
      const el = h('div', { class: 'card-error' });
      errors.set(key, el);
      return el;
    };
    const showError = (key: string, message: string) => {
      const el = errors.get(key);
      if (el) el.textContent = message;
    };

    const numberInput = h('input', {
      type: 'text',
      inputmode: 'numeric',
      pattern: '[0-9]*',
      maxlength: 8,
      class: 'text-input mono big',
      value: state.itemNumber,
      'aria-label': 'Číslo artiklu',
    });
    numberInput.oninput = () => (state.itemNumber = numberInput.value);
    const qrInput = h('input', {
      type: 'text',
      class: 'text-input mono',
      placeholder: 'Načtěte čtečkou nebo opište (nepovinné)',
      value: state.qrText,
      'aria-label': 'QR kód',
    });
    qrInput.oninput = () => (state.qrText = qrInput.value);

    gallery?.dispose();
    gallery = createPhotoGallery(
      { owner: 'item', inspectionId: inspection.id, itemNumber: draftKey },
      { addLabel: 'Vyfotit artikl (štítek…)', emptyText: 'Bez fotek.' },
    );

    const formError = h('div', { class: 'card-error' });
    const saveAndCheck = h('button', { class: 'btn btn-accent' }, 'Uložit a zkontrolovat');
    const saveAndNext = h('button', { class: 'btn' }, 'Uložit a založit další');

    const submit = async (then: 'check' | 'next') => {
      errors.forEach((el) => (el.textContent = ''));
      formError.textContent = '';
      let valid = true;

      const numberCheck = checkItemNumber(numberInput.value);
      const itemNumber = numberCheck.ok ? numberCheck.itemNumber : '';
      if (!numberCheck.ok) {
        valid = false;
        showError(
          'itemNumber',
          numberCheck.problem === 'taken'
            ? 'Toto číslo už má jiný artikl.'
            : 'Číslo artiklu: 1–8 číslic (úvodní nuly se nepočítají).',
        );
      }
      const qrCode = qrInput.value.trim() ? qrCodeFromScan(qrInput.value) : null;
      if (qrCode && isQrCodeTaken(qrCode)) {
        valid = false;
        showError('qrCode', 'Tento QR kód už má jiný artikl.');
      }
      const parsed = buildFieldValuesSchema(definitions).safeParse(state.values);
      if (!parsed.success) {
        valid = false;
        for (const issue of parsed.error.issues) showError(String(issue.path[0]), issue.message);
      }
      if (!valid || !parsed.success) {
        formError.textContent = 'Zkontrolujte zvýrazněná pole.';
        return;
      }

      saveAndCheck.disabled = saveAndNext.disabled = true;
      try {
        await gallery!.settled();
        await addLocalItem({
          itemNumber,
          qrCode,
          type: state.type,
          hall: state.hall,
          row: state.row,
          position: state.position,
          fieldValues: parsed.data,
          lastInspection: null,
          nextInspection: null,
          local: { createdAt: new Date().toISOString(), inspectionId: inspection.id },
        });
        await db.photos.where('itemNumber').equals(draftKey).modify({ itemNumber });
        saveLast({ type: state.type, hall: state.hall, row: state.row, position: state.position });
      } catch (e) {
        formError.textContent = `Uložení selhalo: ${String(e)}`;
        saveAndCheck.disabled = saveAndNext.disabled = false;
        return;
      }
      if (then === 'next') {
        void render({ ...fresh(), qrText: '' });
        window.scrollTo(0, 0);
        return;
      }
      await runCheck({ mode: 'list', raw: itemNumber, toReadMs: 0 });
      location.hash = '#/inspection';
    };
    saveAndCheck.onclick = () => void submit('check');
    saveAndNext.onclick = () => void submit('next');

    const cancel = async () => {
      await gallery?.settled();
      await db.photos.where('itemNumber').equals(draftKey).delete();
      location.hash = '#/inspection';
    };

    root.replaceChildren(
      h(
        'div',
        { class: 'page form-page' },
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn btn-small', onclick: () => void cancel() }, '← Zrušit'),
        ),
        h('h1', {}, 'Nový artikl'),
        h(
          'div',
          { class: 'field', role: 'group', 'aria-label': 'Typ vybavení' },
          'Typ vybavení',
          // Switching the type keeps number, QR and location; only the type's fields reset.
          segmented(
            TYPE_NAMES,
            state.type,
            (type) => void render({ ...state, type: type ?? state.type, values: {} }),
          ),
        ),
        h('label', { class: 'field' }, 'Číslo artiklu', numberInput, errorFor('itemNumber')),
        h('label', { class: 'field' }, 'QR kód štítku', qrInput, errorFor('qrCode')),
        h(
          'div',
          { class: 'field', role: 'group', 'aria-label': 'Umístění' },
          'Umístění',
          h(
            'div',
            { class: 'location-row' },
            h('span', { class: 'muted' }, 'Hala'),
            segmented(HALLS, state.hall, (hall) => (state.hall = hall ?? state.hall)),
          ),
          h(
            'div',
            { class: 'location-row' },
            h('span', { class: 'muted' }, 'Řada'),
            stepper(state.row, (v) => (state.row = v), 'Řada'),
            h('span', { class: 'muted' }, 'Pozice'),
            stepper(state.position, (v) => (state.position = v), 'Pozice'),
          ),
        ),
        ...definitions.map((field) =>
          h(
            'div',
            { class: 'field', role: 'group', 'aria-label': field.label },
            `${field.label}${field.required ? ' *' : ''}`,
            fieldControl(field, state.values),
            errorFor(field.key),
          ),
        ),
        h('h3', { class: 'section-title' }, 'Fotky artiklu'),
        gallery.element,
        formError,
        h('div', { class: 'card-actions' }, saveAndCheck, saveAndNext),
      ),
    );
  };

  void render(fresh());
  return () => {
    disposed = true;
    gallery?.dispose();
  };
}
