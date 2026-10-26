import type { InspectionRow } from '../db.js';
import { h, saveFile } from '../dom.js';
import {
  activeInspection,
  closedInspections,
  deleteInspection,
  exportBaseName,
  photosZip,
  resultsCsv,
  summarize,
} from '../inspection.js';
import { progressBar, summaryLine } from './inspection.js';

/** Finished (and the running) inspections with CSV and photo ZIP export. */
export function exportsView(root: HTMLElement): () => void {
  let disposed = false;

  const card = async (inspection: InspectionRow) => {
    const summary = await summarize(inspection.id);
    const base = exportBaseName(inspection);
    const status = h('p', { class: 'muted small' });
    const run = async (label: string, task: () => Promise<void>) => {
      status.textContent = `${label}…`;
      try {
        await task();
        status.textContent = '';
      } catch (error) {
        status.textContent = `Chyba: ${String(error)}`;
      }
    };
    return h(
      'section',
      { class: 'panel' },
      h(
        'h2',
        {},
        new Date(inspection.startedAt).toLocaleString('cs-CZ'),
        inspection.status === 'open' ? ' – rozpracovaná' : ' – ukončená',
      ),
      h('p', { class: 'muted' }, `${inspection.customer} · ${inspection.site}`),
      progressBar(summary),
      h('p', {}, `${summaryLine(summary)} · fotek ${summary.photos}`),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            class: 'btn',
            onclick: () =>
              void run('Připravuji CSV', async () =>
                saveFile(`${base}.csv`, await resultsCsv(inspection), 'text/csv'),
              ),
          },
          'Výsledky (CSV)',
        ),
        h(
          'button',
          {
            class: 'btn',
            disabled: summary.photos === 0,
            onclick: () =>
              void run('Balím fotky', async () =>
                saveFile(`${base}-fotky.zip`, await photosZip(inspection), 'application/zip'),
              ),
          },
          'Fotky (ZIP)',
        ),
        inspection.status === 'closed' &&
          h(
            'button',
            {
              class: 'btn btn-defect',
              onclick: async () => {
                if (!confirm('Smazat tuto kontrolu včetně fotek z iPadu?')) return;
                await deleteInspection(inspection.id);
                void render();
              },
            },
            'Smazat',
          ),
      ),
      status,
    );
  };

  const render = async () => {
    const active = await activeInspection();
    const list = [...(active ? [active] : []), ...(await closedInspections())];
    const cards = await Promise.all(list.map(card));
    if (disposed) return;
    root.replaceChildren(
      h(
        'div',
        { class: 'page' },
        h('a', { href: '#/', class: 'btn btn-small' }, '← Zpět'),
        h('h1', {}, 'Kontroly a export'),
        h(
          'p',
          { class: 'muted' },
          'Data jsou uložená v iPadu (IndexedDB). Export otevře nabídku Sdílet – zvolte „Uložit do Souborů“, AirDrop nebo e‑mail.',
        ),
        ...(cards.length ? cards : [h('p', {}, 'Zatím žádná kontrola.')]),
      ),
    );
  };

  void render();
  return () => {
    disposed = true;
  };
}
