import { mkdirSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';
import sharp from 'sharp';

const DIR = 'e2e/.generated';
const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 15;
const GRAY = 128;

interface Label {
  text: string;
  /** Top-left corner and side of the label including its quiet zone (px). */
  x: number;
  y: number;
  size: number;
  margin: number;
}

/** Draws QR labels into the luma plane of a grey frame. */
function drawFrame(labels: Label[]): Buffer {
  const luma = Buffer.alloc(WIDTH * HEIGHT, GRAY);
  for (const label of labels) {
    const { modules } = QRCode.create(label.text, { errorCorrectionLevel: 'M' });
    const cells = modules.size + 2 * label.margin;
    const px = Math.floor(label.size / cells);
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const mx = cx - label.margin;
        const my = cy - label.margin;
        const inside = mx >= 0 && my >= 0 && mx < modules.size && my < modules.size;
        const value = inside && modules.get(my, mx) ? 0 : 255;
        for (let dy = 0; dy < px; dy++) {
          const row = (label.y + cy * px + dy) * WIDTH + label.x + cx * px;
          luma.fill(value, row, row + px);
        }
      }
    }
  }
  return luma;
}

/**
 * Writes a Y4M (raw YUV 4:2:0) video that Chromium plays in a loop as a fake camera.
 * Generated in Node so that the tests need no ffmpeg.
 */
function writeY4m(path: string, labels: Label[], seconds = 2) {
  const luma = drawFrame(labels);
  const chroma = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma]);
  const header = Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F${FPS}:1 Ip A1:1 C420jpeg\n`);
  writeFileSync(path, Buffer.concat([header, ...Array<Buffer>(FPS * seconds).fill(frame)]));
}

export default async function globalSetup() {
  mkdirSync(DIR, { recursive: true });
  const url = (code: string) => `https://revize.example/q/${code}`;

  // One label inside the centered scan area, on a grey background.
  writeY4m(`${DIR}/qr-R10001.y4m`, [{ text: url('R10001'), x: 520, y: 240, size: 240, margin: 4 }]);

  // Two labels next to each other: R10002 under the crosshair, R10001 just left of it.
  writeY4m(`${DIR}/qr-neighbours.y4m`, [
    { text: url('R10002'), x: 570, y: 290, size: 140, margin: 2 },
    { text: url('R10001'), x: 400, y: 290, size: 140, margin: 2 },
  ]);

  // A "defect photo" (camera-sized JPEG) for the photo tests.
  const png = await QRCode.toBuffer(url('R10001'), { width: 1200, margin: 4 });
  await sharp(png)
    .resize(1600, 1200, { fit: 'contain', background: '#808080' })
    .jpeg()
    .toFile(`${DIR}/defect.jpg`);
}
