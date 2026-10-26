import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import QRCode from 'qrcode';

const DIR = 'e2e/.generated';

const ffmpeg = (args: string[]) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);

/** Renders QR labels into looping Y4M videos that Chromium uses as a fake camera. */
export default async function globalSetup() {
  mkdirSync(DIR, { recursive: true });
  const url = (code: string) => `https://revize.example/q/${code}`;
  await QRCode.toFile(`${DIR}/R10001.png`, url('R10001'), { width: 240, margin: 4 });
  await QRCode.toFile(`${DIR}/R10002-small.png`, url('R10002'), { width: 140, margin: 2 });
  await QRCode.toFile(`${DIR}/R10001-small.png`, url('R10001'), { width: 140, margin: 2 });

  // One label inside the centered scan area, on a grey background.
  ffmpeg([
    '-loop',
    '1',
    '-i',
    `${DIR}/R10001.png`,
    '-t',
    '2',
    '-r',
    '15',
    '-vf',
    'pad=1280:720:520:240:gray,format=yuv420p',
    `${DIR}/qr-R10001.y4m`,
  ]);

  // Two labels next to each other: R10002 under the crosshair, R10001 just left of it.
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    'color=c=gray:s=1280x720:r=15:d=2',
    '-i',
    `${DIR}/R10002-small.png`,
    '-i',
    `${DIR}/R10001-small.png`,
    '-filter_complex',
    '[0][1]overlay=570:290[a];[a][2]overlay=400:290,format=yuv420p',
    '-t',
    '2',
    `${DIR}/qr-neighbours.y4m`,
  ]);
}
