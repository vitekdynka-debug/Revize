// Renders the PWA PNG icons from public/icon.svg. Run after changing the SVG: pnpm icons
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname;

await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'));
// Apple touch icons must not be transparent.
await sharp(svg)
  .resize(180, 180)
  .flatten({ background: '#0f172a' })
  .png()
  .toFile(out('apple-touch-icon.png'));
console.log('icons written');
