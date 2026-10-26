import { listCameras } from '@revize/scanner';
import { rebuildFeedback } from '../check-flow.js';
import { h } from '../dom.js';
import { environmentReport } from '../env.js';
import { RESOLUTIONS, loadSettings, saveSettings, type SpikeSettings } from '../settings.js';

type Option = [value: string, label: string];

export function settingsView(root: HTMLElement): () => void {
  const settings = loadSettings();
  const update = (patch: Partial<SpikeSettings>) => {
    Object.assign(settings, patch);
    saveSettings(settings);
    rebuildFeedback(settings);
  };

  const select = (label: string, value: string, options: Option[], onChange: (v: string) => void) =>
    h(
      'label',
      { class: 'field' },
      label,
      h(
        'select',
        { onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
        ...options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)),
      ),
    );
  const checkbox = (label: string, checked: boolean, onChange: (v: boolean) => void) =>
    h(
      'label',
      { class: 'toggle' },
      h('input', {
        type: 'checkbox',
        checked,
        onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
      }),
      ` ${label}`,
    );

  const cameraField = h('div');
  const envBox = h('pre', { class: 'env mono' }, 'Načítám…');

  root.replaceChildren(
    h(
      'div',
      { class: 'page' },
      h('a', { href: '#/', class: 'btn btn-small' }, '← Zpět'),
      h('h1', {}, 'Nastavení skeneru'),
      select(
        'Dekodér',
        settings.engine,
        [
          ['zxing', 'zxing-wasm (worker)'],
          ['native', 'BarcodeDetector (nativní)'],
        ],
        (v) => update({ engine: v as SpikeSettings['engine'] }),
      ),
      select(
        'Rozlišení kamery',
        settings.resolution,
        Object.keys(RESOLUTIONS).map((r) => [r, r]),
        (v) => update({ resolution: v as SpikeSettings['resolution'] }),
      ),
      select(
        'Velikost oblasti skenování',
        String(settings.roiFraction),
        ['0.4', '0.6', '0.8', '1'].map((v) => [v, `${Number(v) * 100} %`]),
        (v) => update({ roiFraction: Number(v) }),
      ),
      select(
        'Max. rozlišení pro dekodér',
        String(settings.maxDecodeSide),
        ['480', '720', '1080', '1440'].map((v) => [v, `${v} px`]),
        (v) => update({ maxDecodeSide: Number(v) }),
      ),
      select(
        'Ochrana proti dvojímu načtení',
        String(settings.cooldownMs),
        ['1000', '2500', '5000'].map((v) => [v, `${Number(v) / 1000} s`]),
        (v) => update({ cooldownMs: Number(v) }),
      ),
      select(
        'Spouštění skenu',
        settings.trigger,
        [
          ['auto', 'Automaticky (skener stále běží)'],
          ['tap', 'Až po stisku „Načíst“'],
        ],
        (v) => update({ trigger: v as SpikeSettings['trigger'] }),
      ),
      select(
        'Potvrzení kódu (počet načtení po sobě)',
        String(settings.confirmHits),
        ['1', '2', '3', '5'].map((v) => [v, v === '1' ? '1 (nejrychlejší)' : v]),
        (v) => update({ confirmHits: Number(v) }),
      ),
      select(
        'Prodleva po zavření karty',
        String(settings.rearmDelayMs),
        ['0', '500', '800', '1500'].map((v) => [v, `${Number(v) / 1000} s`]),
        (v) => update({ rearmDelayMs: Number(v) }),
      ),
      select(
        'Zóna kolem zaměřovače',
        String(settings.centerZone),
        [
          ['0.15', 'Úzká – jen kód přesně na kříži'],
          ['0.25', 'Střední'],
          ['0.4', 'Široká'],
        ],
        (v) => update({ centerZone: Number(v) }),
      ),
      checkbox('tryHarder (pomalejší, spolehlivější)', settings.tryHarder, (v) =>
        update({ tryHarder: v }),
      ),
      checkbox('Zvuk při načtení', settings.sound, (v) => update({ sound: v })),
      checkbox('Haptika přes iOS přepínač (experiment)', settings.iosHaptic, (v) =>
        update({ iosHaptic: v }),
      ),
      cameraField,
      h(
        'button',
        {
          class: 'btn btn-small',
          onclick: async () => {
            await navigator.storage?.persist?.();
            void renderEnv();
          },
        },
        'Požádat o trvalé úložiště',
      ),
      h('h2', {}, 'Prostředí'),
      envBox,
    ),
  );

  const renderEnv = async () => {
    const report = await environmentReport();
    envBox.textContent = Object.entries(report)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('\n');
  };
  void renderEnv();

  void listCameras().then((cameras) => {
    const options: Option[] = [
      ['', 'Automaticky (zadní)'],
      ...cameras.map((c, i): Option => [c.deviceId, c.label || `Kamera ${i + 1}`]),
    ];
    cameraField.replaceChildren(
      select('Kamera', settings.deviceId, options, (v) => update({ deviceId: v })),
    );
  });

  return () => undefined;
}
