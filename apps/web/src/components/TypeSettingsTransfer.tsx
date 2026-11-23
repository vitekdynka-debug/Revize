import { Alert, Button, FileButton, Group, List, Modal, Text } from '@mantine/core';
import { equipmentTypesExportSchema, type EquipmentTypesImportResult } from '@revize/shared';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import { useState } from 'react';
import { api, stampedFileName } from '../api/client.js';
import { useImportTypeSettings } from '../api/hooks.js';
import { notifyError } from '../lib/notify.js';

/**
 * Copying the equipment types between instances (e.g. into the showcase, ADR-0023): download
 * their settings as JSON here, upload them there (types of the same name are updated).
 */
export function TypeSettingsTransfer({ canWrite }: { canWrite: boolean }) {
  const importSettings = useImportTypeSettings();
  const [result, setResult] = useState<EquipmentTypesImportResult | null>(null);

  const download = async () => {
    try {
      const data = await api.get<unknown>('/equipment-types/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = stampedFileName(
        `typy-vybaveni-${new Date().toISOString().slice(0, 10)}.json`,
      );
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      notifyError(error);
    }
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    try {
      const parsed = equipmentTypesExportSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error('Soubor není nastavení typů vybavení z Revize.');
      importSettings.mutate(parsed.data, { onSuccess: setResult, onError: notifyError });
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <Group gap="xs">
        <Button
          variant="default"
          leftSection={<IconDownload size={16} />}
          onClick={() => void download()}
        >
          Stáhnout nastavení
        </Button>
        {canWrite && (
          <FileButton accept="application/json,.json" onChange={(f) => void upload(f)}>
            {(props) => (
              <Button
                {...props}
                variant="default"
                leftSection={<IconUpload size={16} />}
                loading={importSettings.isPending}
              >
                Nahrát nastavení
              </Button>
            )}
          </FileButton>
        )}
      </Group>
      <Modal
        opened={result !== null}
        onClose={() => setResult(null)}
        title="Nastavení typů nahráno"
      >
        {result && (
          <>
            {result.created.length > 0 && (
              <Text size="sm">Založeno: {result.created.join(', ')}</Text>
            )}
            {result.updated.length > 0 && (
              <Text size="sm">Upraveno: {result.updated.join(', ')}</Text>
            )}
            {result.skipped.length > 0 && (
              <Alert color="yellow" mt="sm" title="Přeskočeno">
                <List size="sm">
                  {result.skipped.map((s) => (
                    <List.Item key={s.name}>
                      {s.name}: {s.reason}
                    </List.Item>
                  ))}
                </List>
              </Alert>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
