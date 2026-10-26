import type { InspectionRow } from '../db.js';
import { canShareFiles, h, shareFiles } from '../dom.js';
import {
  activeInspection,
  closedInspections,
  deleteInspection,
  exportBaseName,
  photosZip,
  resultsCsv,
  resultsXlsx,
  summarize,
} from '../inspection.js';
import { XLSX_MIME } from '../xlsx.js';
import { progressBar, summaryLine } from './inspection.js';

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} kB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function buildFiles(inspection: InspectionRow, photoCount: number): Promise<File[]> {
  const base = exportBaseName(inspection);
  const files = [
    new File([(await resultsXlsx(inspection)) as BlobPart], `${base}.xlsx`, { type: XLSX_MIME }),
    new File([await resultsCsv(inspection)], `${base}.csv`, { type: 'text/csv' }),
  ];
  if (photoCount > 0) {
    files.push(
      new File([await photosZip(inspection)], `${base}-fotky.zip`, { type: 'application/zip' }),
    );
  }
  return files;
}

/**
 * Finished (and the running) inspections with export. Two steps on purpose: "Připravit export"
 * builds the files, then each "Uložit / sdílet" tap opens the share sheet directly – iOS only
 * allows that inside a fresh tap. Download links stay valid while the page is open.
 */
export function exportsView(root: HTMLElement): () => void {
  let disposed = false;
  const objectUrls: string[] = [];

  const fileRow = (file: File) => {
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    const status = h('span', { class: 'muted small' });
    return h(
      'li',
      { class: 'file-row' },
      h(
        'span',
        { class: 'file-name' },
        h('strong', {}, file.name),
        h('small', {}, formatSize(file.size)),
      ),
      canShareFiles([file]) &&
        h(
          'button',
          {
            class: 'btn btn-accent',
            onclick: async () => {
              if (!(await shareFiles([file], file.name)))
                status.textContent = 'Sdílení nejde – použijte Stáhnout.';
            },
          },
          'Uložit / sdílet',
        ),
      h('a', { class: 'btn', href: url, download: file.name }, 'Stáhnout'),
      status,
    );
  };

  const card = async (inspection: InspectionRow) => {
    const summary = await summarize(inspection.id);
    const output = h('div', {});
    const status = h('p', { class: 'muted small' });
    const prepare = h('button', { class: 'btn btn-accent' }, 'Připravit export');
    prepare.onclick = async () => {
      prepare.disabled = true;
      status.textContent = 'Připravuji soubory…';
      try {
        const files = await buildFiles(inspection, summary.photos);
        status.textContent = '';
        output.replaceChildren(
          h('ul', { class: 'file-list' }, ...files.map(fileRow)),
          files.length > 1 && canShareFiles(files)
            ? h(
                'button',
                { class: 'btn', onclick: () => void shareFiles(files, exportBaseName(inspection)) },
                'Uložit / sdílet vše najednou',
              )
            : '',
        );
      } catch (error) {
        status.textContent = `Export se nepodařil: ${String(error)}`;
      } finally {
        prepare.disabled = false;
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
        prepare,
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
      output,
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
          'Data jsou uložená v iPadu. Export: „Připravit export“, potom „Uložit / sdílet“ → Uložit do Souborů, AirDrop nebo e‑mail. ' +
            'Tabulka .xlsx se otevře v Excelu i v Numbers rovnou po sloupcích.',
        ),
        ...(cards.length ? cards : [h('p', {}, 'Zatím žádná kontrola.')]),
      ),
    );
  };

  void render();
  return () => {
    disposed = true;
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
  };
}
