import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import QRCode from 'qrcode';

/** Renders a QR label into a looping Y4M video that Chromium uses as a fake camera. */
export default async function globalSetup() {
  const dir = 'e2e/.generated';
  mkdirSync(dir, { recursive: true });
  const png = `${dir}/qr-R10001.png`;
  await QRCode.toFile(png, 'https://revize.example/q/R10001', { width: 240, margin: 4 });
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-loop',
    '1',
    '-i',
    png,
    '-t',
    '2',
    '-r',
    '15',
    // Small label inside the centered scan area, on a grey background.
    '-vf',
    'pad=1280:720:520:240:gray,format=yuv420p',
    `${dir}/qr-R10001.y4m`,
  ]);
}
