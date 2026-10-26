import { h, download } from '../dom.js';
import { clearLog, getLog, median, toCsv, type CheckMeasurement, type InputMode } from '../log.js';

const MODE_LABELS: Record<InputMode, string> = {
  camera: 'Kamera (QR)',
  wedge: 'Bluetooth čtečka',
  manual: 'Systémová klávesnice',
  keypad: 'Číselník v aplikaci',
  list: 'Výběr ze seznamu',
};

const fmt = (value: number | null) => (value === null ? '–' : `${(value / 1000).toFixed(2)} s`);

export function logView(root: HTMLElement): () => void {
  const render = () => {
    const entries = getLog();
    const checks = entries.filter((e): e is CheckMeasurement => e.kind === 'check');
    const summary = (Object.keys(MODE_LABELS) as InputMode[]).map((mode) => {
      const rows = checks.filter((c) => c.mode === mode && c.outcome !== 'unknown');
      return h(
        'tr',
        {},
        h('td', {}, MODE_LABELS[mode]),
        h('td', {}, String(rows.length)),
        h('td', {}, fmt(median(rows.map((r) => r.toReadMs)))),
        h('td', {}, fmt(median(rows.map((r) => r.decisionMs)))),
        h('td', {}, h('strong', {}, fmt(median(rows.map((r) => r.totalMs))))),
      );
    });
    const csvName = `qr-spike-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`;

    root.replaceChildren(
      h(
        'div',
        { class: 'page' },
        h('a', { href: '#/', class: 'btn btn-small' }, '← Zpět'),
        h('h1', {}, 'Měření'),
        h(
          'table',
          { class: 'table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              ...['Způsob', 'Počet', 'Do načtení', 'Rozhodnutí', 'Celkem (medián)'].map((t) =>
                h('th', {}, t),
              ),
            ),
          ),
          h('tbody', {}, ...summary),
        ),
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            { class: 'btn', onclick: () => download(csvName, toCsv(getLog()), 'text/csv') },
            'Stáhnout CSV',
          ),
          h('button', { class: 'btn', onclick: () => void share(csvName) }, 'Sdílet CSV'),
          h(
            'button',
            {
              class: 'btn btn-defect',
              onclick: () => {
                if (confirm('Smazat všechna měření?')) {
                  clearLog();
                  render();
                }
              },
            },
            'Smazat',
          ),
        ),
        h('h2', {}, `Posledních 40 záznamů (celkem ${entries.length})`),
        h(
          'table',
          { class: 'table small mono' },
          h(
            'tbody',
            {},
            ...entries
              .slice(-40)
              .reverse()
              .map((e) => h('tr', {}, h('td', {}, describe(e)))),
          ),
        ),
      ),
    );
  };
  render();
  return () => undefined;
}

function describe(entry: ReturnType<typeof getLog>[number]): string {
  const time = entry.at.slice(11, 19);
  if (entry.kind === 'camera') {
    return `${time} kamera ${entry.event} ${entry.startMs ?? '–'} ms ${entry.width ?? ''}×${entry.height ?? ''} standalone=${entry.standalone} perm=${entry.permission} ${entry.detail}`;
  }
  return `${time} ${entry.mode} ${entry.itemNumber ?? entry.raw} ${entry.outcome} načtení ${entry.toReadMs} ms, rozhodnutí ${entry.decisionMs} ms${entry.decodeMs !== null ? `, dekód ${entry.decodeMs} ms` : ''} ${entry.config}`;
}

async function share(filename: string) {
  const file = new File([toCsv(getLog())], filename, { type: 'text/csv' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'QR spike – měření' }).catch(() => undefined);
  } else {
    download(filename, toCsv(getLog()), 'text/csv');
  }
}
