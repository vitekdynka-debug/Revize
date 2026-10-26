import { h } from '../dom.js';
import { isStandalone } from '../env.js';

export function homeView(root: HTMLElement): () => void {
  const tile = (href: string, title: string, text: string, accent = false) =>
    h(
      'a',
      { href, class: `tile${accent ? ' tile-accent' : ''}` },
      h('strong', {}, title),
      h('span', {}, text),
    );

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
        tile('#/sheet', 'Testovací arch QR', 'Vytisknout štítky na A4'),
        tile('#/log', 'Měření', 'Souhrn, export CSV'),
        tile('#/settings', 'Nastavení', 'Dekodér, rozlišení, oblast, prostředí'),
      ),
      h(
        'p',
        { class: 'muted small' },
        'Bluetooth čtečka (režim klávesnice) funguje na kterékoli obrazovce. Build ',
        __BUILD_TIME__,
      ),
    ),
  );
  return () => undefined;
}
