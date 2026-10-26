import { h } from '../dom.js';
import { isStandalone } from '../env.js';
import { activeInspection, startInspection, summarize } from '../inspection.js';
import { MOCK_CUSTOMER } from '../mock-items.js';
import { forceReload } from '../update.js';
import { progressBar, summaryLine } from './inspection.js';

export function homeView(root: HTMLElement): () => void {
  let disposed = false;
  const tile = (href: string, title: string, text: string, accent = false) =>
    h(
      'a',
      { href, class: `tile${accent ? ' tile-accent' : ''}` },
      h('strong', {}, title),
      h('span', {}, text),
    );

  const inspectionPanel = h('section', { class: 'panel' }, 'Načítám…');

  const renderPanel = async () => {
    const active = await activeInspection();
    if (disposed) return;
    if (!active) {
      inspectionPanel.replaceChildren(
        h('h2', {}, 'Žádná rozpracovaná kontrola'),
        h('p', { class: 'muted' }, `${MOCK_CUSTOMER.name} · ${MOCK_CUSTOMER.site}`),
        h(
          'button',
          {
            class: 'btn btn-accent',
            onclick: async () => {
              await startInspection();
              location.hash = '#/inspection';
            },
          },
          'Zahájit kontrolu',
        ),
      );
      return;
    }
    const summary = await summarize(active.id);
    if (disposed) return;
    inspectionPanel.replaceChildren(
      h('h2', {}, `Rozpracovaná kontrola – ${active.customer}`),
      progressBar(summary),
      h('p', {}, summaryLine(summary)),
      h(
        'div',
        { class: 'row' },
        h('a', { href: '#/scan', class: 'btn btn-accent' }, 'Skenovat'),
        h('a', { href: '#/inspection', class: 'btn' }, 'Seznam artiklů / ukončit'),
      ),
    );
  };

  root.replaceChildren(
    h(
      'div',
      { class: 'page' },
      h('h1', {}, 'Revize – QR spike'),
      h(
        'p',
        { class: 'muted' },
        isStandalone()
          ? 'Běží jako nainstalovaná aplikace.'
          : 'Běží v prohlížeči. Pro test instalace: Sdílet → Přidat na plochu.',
      ),
      inspectionPanel,
      h(
        'div',
        { class: 'tiles' },
        tile(
          '#/scan',
          'Rychlá kontrola – kamera',
          'Skener zůstává otevřený, OK jedním dotekem',
          true,
        ),
        tile('#/keypad', 'Ruční zadání – číselník', 'Velká tlačítka v aplikaci'),
        tile('#/manual', 'Ruční zadání – klávesnice', 'Systémová numerická klávesnice'),
        tile('#/exports', 'Kontroly a export', 'Výsledky CSV, fotky ZIP'),
        tile('#/sheet', 'Testovací arch QR', 'Vytisknout štítky na A4'),
        tile('#/log', 'Měření', 'Rychlost skenování, export CSV'),
        tile('#/settings', 'Nastavení', 'Dekodér, citlivost, oblast, prostředí'),
      ),
      h(
        'p',
        { class: 'muted small' },
        'Bluetooth čtečka (režim klávesnice) funguje na kterékoli obrazovce.',
      ),
      h(
        'div',
        { class: 'row version' },
        h(
          'span',
          { class: 'muted small' },
          `Verze ${new Date(__BUILD_TIME__).toLocaleString('cs-CZ')}`,
        ),
        h(
          'button',
          {
            class: 'btn btn-small',
            onclick: () => {
              if (confirm('Načíst nejnovější verzi aplikace? Uložené kontroly zůstanou.')) {
                void forceReload();
              }
            },
          },
          'Aktualizovat aplikaci',
        ),
      ),
    ),
  );
  void renderPanel();
  return () => {
    disposed = true;
  };
}
