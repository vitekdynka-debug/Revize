import { Button, Menu, Text } from '@mantine/core';
import { fileNamePart, type Inspection } from '@revize/shared';
import { IconDownload, IconFileSpreadsheet, IconFileText, IconPhoto } from '@tabler/icons-react';
import { useState } from 'react';
import { downloadDirect, downloadFile } from '../api/client.js';
import { usePhotosList } from '../api/hooks.js';
import { notifyError } from '../lib/notify.js';

/** Which photos a ZIP holds: all, only those of the defects, only those of the items. */
type PhotoKind = 'defect' | 'item' | 'inspection';
const PHOTO_SETS: {
  key: string;
  label: string;
  query: 'defects' | 'items' | null;
  suffix: string;
  kinds: readonly PhotoKind[];
}[] = [
  {
    key: 'all',
    label: 'Všechny fotky',
    query: null,
    suffix: '',
    kinds: ['defect', 'item', 'inspection'],
  },
  {
    key: 'defects',
    label: 'Jen fotky závad',
    query: 'defects',
    suffix: '-zavady',
    kinds: ['defect'],
  },
  { key: 'items', label: 'Jen fotky artiklů', query: 'items', suffix: '-artikly', kinds: ['item'] },
];

/** Downloads of an inspection: results (XLSX, CSV) and photos (ZIP). */
export function ExportMenu({ inspection }: { inspection: Inspection }) {
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  // What the server will put into the ZIP (fetched when the menu opens).
  const list = usePhotosList(inspection.id, opened);
  const photoFiles = list.data?.files;
  const base = `${fileNamePart(inspection.siteName)}-${inspection.inspectionDate}`;
  const download = (path: string, fileName: string) => {
    setBusy(true);
    downloadFile(`/inspections/${inspection.id}/${path}`, fileName)
      .catch(notifyError)
      .finally(() => setBusy(false));
  };
  return (
    <Menu position="bottom-end" opened={opened} onChange={setOpened}>
      <Menu.Target>
        <Button variant="light" loading={busy} leftSection={<IconDownload size={18} />}>
          Export
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconFileSpreadsheet size={16} />}
          onClick={() => download('export.xlsx', `kontrola-${base}.xlsx`)}
        >
          Výsledky – Excel (XLSX)
        </Menu.Item>
        <Menu.Item
          leftSection={<IconFileText size={16} />}
          onClick={() => download('export.csv', `kontrola-${base}.csv`)}
        >
          Výsledky – CSV
        </Menu.Item>
        <Menu.Label>Fotky (ZIP s popisy)</Menu.Label>
        {PHOTO_SETS.map((set) => {
          const chosen = photoFiles?.filter((f) => set.kinds.includes(f.kind));
          const missingHere = chosen?.filter((f) => !f.exists).length ?? 0;
          return (
            <Menu.Item
              key={set.key}
              leftSection={<IconPhoto size={16} />}
              disabled={chosen !== undefined && chosen.length === 0}
              onClick={() =>
                // Straight from the server: hundreds of photos stream into the file.
                void downloadDirect(
                  `/inspections/${inspection.id}/${set.query ? `photos.zip?only=${set.query}` : 'photos.zip'}`,
                  `fotky${set.suffix}-${base}.zip`,
                ).catch(notifyError)
              }
            >
              {set.label}
              <Text
                size="xs"
                c={missingHere ? 'red' : 'dimmed'}
                data-testid={`zip-count-${set.key}`}
              >
                {chosen === undefined
                  ? 'zjišťuji počet…'
                  : `${chosen.length} fotek${missingHere ? `, ${missingHere} chybí na serveru` : ''}`}
              </Text>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
