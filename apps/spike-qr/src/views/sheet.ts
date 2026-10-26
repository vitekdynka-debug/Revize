import QRCode from 'qrcode';
import { h } from '../dom.js';
import { FIRST_ITEM, LABEL_URL_BASE, MOCK_ITEMS } from '../mock-items.js';

type Ecc = 'L' | 'M' | 'Q' | 'H';

interface LabelSpec {
  itemIndex: number;
  /** Side of the QR symbol without quiet zone (mm). */
  sizeMm: number;
  payload: 'number' | 'url';
  ecc: Ecc;
  gray?: boolean;
}

const SIZES_MM = [8, 10, 12, 15, 20, 25, 30, 40];

function specs(): { title: string; labels: LabelSpec[] }[] {
  let index = 0;
  const next = () => index++;
  const sizes = SIZES_MM.flatMap((sizeMm) => [
    { itemIndex: next(), sizeMm, payload: 'number' as const, ecc: 'M' as Ecc },
    { itemIndex: next(), sizeMm, payload: 'url' as const, ecc: 'M' as Ecc },
  ]);
  const quality: LabelSpec[] = [
    { itemIndex: next(), sizeMm: 15, payload: 'url', ecc: 'L' },
    { itemIndex: next(), sizeMm: 15, payload: 'url', ecc: 'H' },
    { itemIndex: next(), sizeMm: 15, payload: 'number', ecc: 'M', gray: true },
    { itemIndex: next(), sizeMm: 20, payload: 'url', ecc: 'M', gray: true },
  ];
  const speed: LabelSpec[] = [];
  while (index < MOCK_ITEMS.length) {
    speed.push({ itemIndex: next(), sizeMm: 20, payload: 'url', ecc: 'M' });
  }
  return [
    { title: 'A – velikosti (číslo / URL)', labels: sizes },
    { title: 'B – korekce chyb a nízký kontrast', labels: quality },
    { title: 'C – rychlostní test (20 mm, URL)', labels: speed },
  ];
}

function payloadFor(spec: LabelSpec): string {
  const item = MOCK_ITEMS[spec.itemIndex]!;
  return spec.payload === 'number' ? item.itemNumber : LABEL_URL_BASE + item.qrCode;
}

function label(spec: LabelSpec): HTMLElement {
  const text = payloadFor(spec);
  const options = { errorCorrectionLevel: spec.ecc, margin: 0 } as const;
  const modules = QRCode.create(text, options).modules.size;
  const quietMm = (4 * spec.sizeMm) / modules;
  const holder = h('div', {
    class: 'qr',
    style: `width:${spec.sizeMm}mm;height:${spec.sizeMm}mm;padding:${quietMm}mm`,
  });
  void QRCode.toString(text, {
    ...options,
    type: 'svg',
    color: { dark: spec.gray ? '#8a8a8a' : '#000000', light: '#ffffff' },
  }).then((svg) => (holder.innerHTML = svg));
  const item = MOCK_ITEMS[spec.itemIndex]!;
  const caption = `${spec.sizeMm} mm · ${spec.payload === 'url' ? 'URL' : 'číslo'} · ${spec.ecc}${
    spec.gray ? ' · šedá' : ''
  } · ${modules}×${modules}`;
  return h(
    'figure',
    { class: 'label' },
    holder,
    h('figcaption', {}, h('strong', {}, item.itemNumber), h('br'), caption),
  );
}

export function sheetView(root: HTMLElement): () => void {
  root.replaceChildren(
    h(
      'div',
      { class: 'page sheet' },
      h(
        'div',
        { class: 'no-print' },
        h('a', { href: '#/', class: 'btn btn-small' }, '← Zpět'),
        h('button', { class: 'btn btn-small', onclick: () => window.print() }, 'Tisk / uložit PDF'),
        h(
          'p',
          { class: 'muted' },
          `Tiskněte na A4 ve 100 % (bez „přizpůsobit stránce“). Rozměr je strana kódu bez tichého okraje. Artikly ${FIRST_ITEM}–${FIRST_ITEM + MOCK_ITEMS.length - 1}.`,
        ),
      ),
      h('h1', { class: 'print-only' }, 'Revize – testovací arch QR kódů'),
      ...specs().map((section) =>
        h(
          'section',
          {},
          h('h2', {}, section.title),
          h('div', { class: 'labels' }, ...section.labels.map(label)),
        ),
      ),
    ),
  );
  return () => undefined;
}
