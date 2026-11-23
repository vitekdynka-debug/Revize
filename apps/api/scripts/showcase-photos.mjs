// Illustrative photos of the showcase (drawn here, no third-party images): SVG → JPEG with sharp.
// Run: node apps/api/scripts/showcase-photos.mjs  (writes apps/api/assets/showcase/*.jpg)
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '../assets/showcase');
mkdirSync(out, { recursive: true });
const W = 1600;
const H = 1200;
const RED = '#e03131';

const frame = (body, bg = ['#cfd4da', '#868e96']) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#adb5bd"/><stop offset="1" stop-color="#6c757d"/>
    </linearGradient>
    <pattern id="holes" width="24" height="48" patternUnits="userSpaceOnUse">
      <rect width="24" height="48" fill="#1c5fa8"/><rect x="8" y="10" width="8" height="16" rx="3" fill="#0d3a6b"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${body}
  <rect x="${W - 430}" y="${H - 86}" width="400" height="56" rx="10" fill="rgba(0,0,0,0.45)"/>
  <text x="${W - 230}" y="${H - 48}" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" fill="#fff" text-anchor="middle">ILUSTRAČNÍ FOTO</text>
</svg>`;

const arrow = (tipX, tipY, tailX, tailY) => {
  const a = Math.atan2(tailY - tipY, tailX - tipX);
  const head = (d) => `${tipX + 70 * Math.cos(a + d)},${tipY + 70 * Math.sin(a + d)}`;
  const line = (stroke, width) =>
    `<g stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" fill="none">
      <line x1="${tailX}" y1="${tailY}" x2="${tipX}" y2="${tipY}"/>
      <polyline points="${head(0.5)} ${tipX},${tipY} ${head(-0.5)}"/></g>`;
  return line('rgba(255,255,255,0.85)', 30) + line(RED, 16);
};
const ring = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="30"/>
   <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${RED}" stroke-width="16"/>`;

const floor = `<rect y="1000" width="${W}" height="200" fill="url(#floor)"/>
  <line x1="0" y1="1060" x2="${W}" y2="1060" stroke="#f1c40f" stroke-width="14"/>`;
const upright = (x, bend = 0) =>
  bend
    ? `<path d="M${x} 80 L${x} 640 Q${x + bend} 760 ${x} 880 L${x} 1000 L${x + 48} 1000 L${x + 48} 880 Q${x + 48 + bend} 760 ${x + 48} 640 L${x + 48} 80 Z" fill="url(#holes)"/>`
    : `<rect x="${x}" y="80" width="48" height="920" fill="url(#holes)"/>`;
const beam = (
  x1,
  x2,
  y,
) => `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="44" fill="#e8590c"/>
  <rect x="${x1}" y="${y + 36}" width="${x2 - x1}" height="8" fill="#a63c06"/>`;
const pallet = (
  x,
  y,
  w,
  colour = '#c9a66b',
) => `<rect x="${x}" y="${y - 30}" width="${w}" height="30" fill="#8d6e3f"/>
  <rect x="${x + 10}" y="${y - 250}" width="${w - 20}" height="220" fill="${colour}" stroke="#6d5330" stroke-width="4"/>
  <line x1="${x + 10}" y1="${y - 140}" x2="${x + w - 10}" y2="${y - 140}" stroke="#6d5330" stroke-width="3"/>`;
const rackBay = (bend = 0) => `${floor}
  ${upright(220)}${upright(760, bend)}${upright(1300)}
  ${[340, 640, 940].map((y) => beam(268, 760, y) + beam(808, 1300, y)).join('')}
  ${pallet(300, 340, 420)}${pallet(840, 340, 420, '#b5c4d1')}${pallet(300, 640, 420, '#d9c39a')}${pallet(840, 640, 420)}
  ${pallet(300, 940, 420, '#b5c4d1')}`;
const sign = (
  x,
  y,
  text,
) => `<rect x="${x}" y="${y}" width="360" height="220" rx="12" fill="#fff" stroke="#212529" stroke-width="6"/>
  <text x="${x + 180}" y="${y + 70}" font-family="DejaVu Sans, Arial" font-size="34" font-weight="bold" text-anchor="middle">${text[0]}</text>
  <text x="${x + 180}" y="${y + 130}" font-family="DejaVu Sans, Arial" font-size="30" text-anchor="middle">${text[1]}</text>
  <text x="${x + 180}" y="${y + 180}" font-family="DejaVu Sans, Arial" font-size="30" text-anchor="middle">${text[2]}</text>`;
const ladder = (crack = false, missingFoot = false) => `${floor}
  <g transform="rotate(-12 800 1000)">
    <rect x="600" y="40" width="40" height="960" fill="#ced4da" stroke="#868e96" stroke-width="4"/>
    <rect x="960" y="40" width="40" height="960" fill="#ced4da" stroke="#868e96" stroke-width="4"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="640" y="${110 + i * 105}" width="320" height="26" fill="#adb5bd" stroke="#868e96" stroke-width="3"/>`).join('')}
    ${crack ? '<path d="M780 530 l20 22 l-14 12 l22 26" stroke="#212529" stroke-width="6" fill="none"/>' : ''}
    <rect x="585" y="990" width="70" height="40" rx="8" fill="#212529"/>
    ${missingFoot ? '' : '<rect x="945" y="990" width="70" height="40" rx="8" fill="#212529"/>'}
  </g>`;

const photos = {
  'regal-prehled': frame(rackBay()),
  'regal-ohnuty-stojan': frame(rackBay(70) + arrow(800, 760, 1180, 520)),
  'regal-chybi-pojistka': frame(
    `${upright(700)}${beam(748, 1500, 520)}
    <rect x="700" y="500" width="120" height="120" fill="#c92a2a" opacity="0.15"/>
    <circle cx="790" cy="545" r="14" fill="#0d3a6b"/>${ring(790, 545, 120)}`,
    ['#dee2e6', '#adb5bd'],
  ),
  'regal-bez-stitku': frame(
    rackBay() +
      `<rect x="1360" y="420" width="200" height="140" fill="#dee2e6" stroke="#495057" stroke-dasharray="14 10" stroke-width="6"/>` +
      ring(1460, 490, 130),
  ),
  'regal-stitek': frame(
    `${upright(400)}${sign(520, 420, ['NOSNOST POLE', '2 × 1000 kg', 'max. 3 úrovně'])}`,
    ['#e9ecef', '#ced4da'],
  ),
  'regal-kotveni': frame(
    `${floor}${upright(760)}<rect x="700" y="960" width="170" height="40" fill="#495057"/>
    <circle cx="730" cy="980" r="12" fill="#adb5bd"/>` + ring(840, 980, 90),
  ),
  'zebrik-prehled': frame(ladder()),
  'zebrik-praskla-pricka': frame(ladder(true) + ring(780, 560, 120)),
  'zebrik-chybi-patka': frame(ladder(false, true) + arrow(1000, 1000, 1300, 760)),
  'zebrik-stitek': frame(sign(620, 480, ['EN 131-2', 'Professional', 'max. 150 kg']), [
    '#e9ecef',
    '#ced4da',
  ]),
  'vazak-prehled': frame(
    `<path d="M200 600 C 500 380, 1100 820, 1400 600" stroke="#7048e8" stroke-width="120" fill="none"/>
    <path d="M200 600 C 500 380, 1100 820, 1400 600" stroke="#5f3dc4" stroke-width="10" stroke-dasharray="30 30" fill="none"/>`,
    ['#f1f3f5', '#ced4da'],
  ),
  'vazak-poskozeny': frame(
    `<path d="M200 600 C 500 380, 1100 820, 1400 600" stroke="#2f9e44" stroke-width="120" fill="none"/>
    <path d="M760 560 l40 30 l-30 30 l40 30" stroke="#f8f9fa" stroke-width="18" fill="none"/>` +
      ring(790, 600, 150),
    ['#f1f3f5', '#ced4da'],
  ),
  'vazak-stitek': frame(sign(620, 480, ['WLL 2 000 kg', 'PES · 2 m', 'EN 1492-1']), [
    '#f1f3f5',
    '#ced4da',
  ]),
  'konstrukce-koroze': frame(
    `<rect x="0" y="420" width="${W}" height="160" fill="#495057"/><rect x="0" y="440" width="${W}" height="120" fill="#5c677d"/>
    ${[300, 620, 680, 1050, 1110].map((x, i) => `<circle cx="${x}" cy="${500 + (i % 2) * 20}" r="${40 + (i % 3) * 18}" fill="#a0522d" opacity="0.85"/>`).join('')}` +
      arrow(650, 500, 900, 820),
  ),
  'hala-prehled': frame(
    `${floor}${[100, 520, 940].map((x) => `<g transform="translate(${x} 0) scale(0.32 1)">${rackBay()}</g>`).join('')}`,
  ),
};

for (const [name, svg] of Object.entries(photos)) {
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(join(out, `${name}.jpg`));
}
console.log(`${Object.keys(photos).length} photos → ${out}`);
