import { runCheck } from '../check-flow.js';
import type { ResultRow } from '../db.js';
import { h } from '../dom.js';
import {
  activeInspection,
  finishInspection,
  resultsOf,
  startInspection,
  summarize,
  type InspectionSummary,
} from '../inspection.js';
import { MOCK_ITEMS, compareByLocation, locationLabel, type MockItem } from '../mock-items.js';

type Filter = 'unchecked' | 'checked' | 'all';

const FILTERS: [Filter, string][] = [
  ['unchecked', 'Nezkontrolované'],
  ['checked', 'Zkontrolované'],
  ['all', 'Vše'],
];

export function summaryLine(s: InspectionSummary): string {
  return `OK ${s.ok} · závady ${s.defect} (vyřazeno ${s.outOfService}) · nezkontrolováno ${s.unchecked}`;
}

export function progressBar(s: InspectionSummary): HTMLElement {
  const percent = Math.round((s.checked / s.total) * 100);
  return h(
    'div',
    { class: 'progress', role: 'progressbar', 'aria-valuenow': percent },
    h('div', { class: 'progress-fill', style: `width:${percent}%` }),
    h('span', {}, `Zkontrolováno ${s.checked} z ${s.total}`),
  );
}

/** Active inspection: progress, items sorted by location, end of inspection. */
export function inspectionView(root: HTMLElement): () => void {
  let filter: Filter = 'unchecked';
  let disposed = false;

  const render = async () => {
    const inspection = (await activeInspection()) ?? (await startInspection());
    const [results, summary] = await Promise.all([
      resultsOf(inspection.id),
      summarize(inspection.id),
    ]);
    if (disposed) return;

    const items = [...MOCK_ITEMS].sort(compareByLocation).filter((item) => {
      const checked = results.has(item.itemNumber);
      return filter === 'all' || (filter === 'checked' ? checked : !checked);
    });

    root.replaceChildren(
      h(
        'div',
        { class: 'page' },
        h(
          'div',
          { class: 'row' },
          h('a', { href: '#/', class: 'btn btn-small' }, '← Zpět'),
          h('a', { href: '#/scan', class: 'btn btn-small btn-accent' }, 'Skener'),
          h('a', { href: '#/keypad', class: 'btn btn-small' }, 'Číselník'),
          h(
            'button',
            {
              class: 'btn btn-small btn-end',
              onclick: () => void confirmFinish(inspection.id, summary),
            },
            'Ukončit kontrolu',
          ),
        ),
        h('h1', {}, inspection.customer),
        h('p', { class: 'muted' }, inspection.site),
        progressBar(summary),
        h('p', {}, summaryLine(summary)),
        h(
          'div',
          { class: 'segmented' },
          ...FILTERS.map(([value, label]) =>
            h(
              'button',
              {
                class: `btn btn-small${value === filter ? ' active' : ''}`,
                onclick: () => {
                  filter = value;
                  void render();
                },
              },
              label,
            ),
          ),
        ),
        items.length === 0
          ? h('p', { class: 'muted' }, 'Žádné artikly.')
          : h(
              'ul',
              { class: 'item-list' },
              ...items.map((item) => itemRow(item, results.get(item.itemNumber))),
            ),
        h(
          'button',
          { class: 'btn btn-finish', onclick: () => void confirmFinish(inspection.id, summary) },
          'Ukončit kontrolu a exportovat',
        ),
      ),
    );
  };

  const itemRow = (item: MockItem, result: ResultRow | undefined) =>
    h(
      'li',
      {},
      h(
        'button',
        {
          class: 'item-row',
          onclick: () =>
            void runCheck({ mode: 'list', raw: item.itemNumber, toReadMs: 0 }).then(render),
        },
        h('span', { class: 'item-number mono' }, item.itemNumber),
        h(
          'span',
          { class: 'item-main' },
          h('strong', {}, item.type),
          h('small', {}, locationLabel(item)),
        ),
        h(
          'span',
          { class: `chip ${result ? result.outcome : 'none'}` },
          !result
            ? '–'
            : result.outcome === 'ok'
              ? 'OK'
              : result.outOfService
                ? 'Vyřazeno'
                : 'Závada',
        ),
      ),
    );

  const confirmFinish = async (inspectionId: string, summary: InspectionSummary) => {
    const warning =
      summary.unchecked > 0 ? `\n\nPozor: ${summary.unchecked} artiklů není zkontrolováno.` : '';
    if (!confirm(`Ukončit kontrolu?\n\n${summaryLine(summary)}${warning}`)) return;
    await finishInspection(inspectionId);
    location.hash = '#/exports';
  };

  void render();
  return () => {
    disposed = true;
  };
}
