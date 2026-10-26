import { attachKeyboardWedge } from '@revize/scanner';
import { catalogReady } from './catalog.js';
import { feedback, isCardOpen, runCheck } from './check-flow.js';
import { dismissItemCard } from './item-card.js';
import './styles.css';
import { setupUpdates } from './update.js';
import { exportsView } from './views/exports.js';
import { homeView } from './views/home.js';
import { inspectionView } from './views/inspection.js';
import { logView } from './views/log.js';
import { manualView } from './views/manual.js';
import { newItemView } from './views/new-item.js';
import { scanView } from './views/scan.js';
import { settingsView } from './views/settings.js';
import { sheetView } from './views/sheet.js';

setupUpdates();

const root = document.getElementById('app')!;
type View = (root: HTMLElement, params: URLSearchParams) => () => void;
const routes: Record<string, View> = {
  '/': homeView,
  '/scan': scanView,
  '/inspection': inspectionView,
  '/exports': exportsView,
  '/new-item': newItemView,
  '/manual': (r) => manualView(r, 'manual'),
  '/keypad': (r) => manualView(r, 'keypad'),
  '/sheet': sheetView,
  '/log': logView,
  '/settings': settingsView,
};

let cleanup: () => void = () => undefined;
let readyAt = performance.now();

function render() {
  dismissItemCard();
  cleanup();
  const [path = '/', query = ''] = location.hash.replace(/^#/, '').split('?');
  cleanup = (routes[path || '/'] ?? homeView)(root, new URLSearchParams(query));
  readyAt = performance.now();
}

// Items created in the field live in IndexedDB; render once they are loaded. The keyboard
// wedge below is attached right away so that an early scan is not lost (runCheck waits).
void catalogReady.then(() => {
  window.addEventListener('hashchange', render);
  render();
});

// iOS only plays audio after a user gesture; unlock on the first tap anywhere.
document.addEventListener('pointerdown', () => feedback.unlock(), { capture: true });

// Bluetooth scanners in keyboard mode work on every screen.
attachKeyboardWedge((text) => {
  if (isCardOpen()) return;
  void runCheck({ mode: 'wedge', raw: text, toReadMs: performance.now() - readyAt }).then(() => {
    readyAt = performance.now();
  });
});
