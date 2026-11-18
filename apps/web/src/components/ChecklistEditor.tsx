import { ActionIcon, Button, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import type { ChecklistItem, CheckSeverity } from '@revize/shared';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { slugKey } from '../lib/format.js';

export interface ChecklistEditorProps {
  value: ChecklistItem[];
  onChange: (value: ChecklistItem[]) => void;
  /** Keys already stored: answers refer to them, so they do not change with the label. */
  savedKeys: ReadonlySet<string>;
  riskLevels: boolean;
  disabled?: boolean;
  /** Errors by "index.field". */
  errors?: Record<string, string>;
}

/** Check points of an equipment type answered ANO / NE in the field (ADR-0021). */
export function ChecklistEditor({
  value,
  onChange,
  savedKeys,
  riskLevels,
  disabled,
  errors = {},
}: ChecklistEditorProps) {
  const severities: { value: CheckSeverity; label: string }[] = riskLevels
    ? [
        { value: 'green', label: 'Zelená' },
        { value: 'amber', label: 'Žlutá' },
        { value: 'red', label: 'Červená' },
      ]
    : [
        { value: 'amber', label: 'Závada – provoz možný' },
        { value: 'red', label: 'Nevyhovuje' },
      ];
  const set = (index: number, patch: Partial<ChecklistItem>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const uniqueKey = (label: string, index: number) => {
    const base = slugKey(label) || 'bod';
    let key = base;
    for (let n = 2; value.some((item, i) => i !== index && item.key === key); n++) {
      key = `${base}_${n}`;
    }
    return key;
  };

  return (
    <Stack gap="xs">
      {value.length === 0 && (
        <Text size="sm" c="dimmed">
          Žádné kontrolní body.
        </Text>
      )}
      {value.map((item, index) => (
        <Group key={index} align="flex-start" wrap="nowrap" gap="xs">
          <TextInput
            aria-label={`Kontrolní bod ${index + 1}`}
            placeholder="Např. Kotvení do podlahy"
            style={{ flex: 2 }}
            disabled={disabled}
            value={item.label}
            error={errors[`${index}.label`]}
            onChange={(e) => {
              const label = e.currentTarget.value;
              // New points take their key from the label; stored keys stay.
              set(
                index,
                savedKeys.has(item.key) ? { label } : { label, key: uniqueKey(label, index) },
              );
            }}
          />
          <TextInput
            aria-label={`Text závady ${index + 1}`}
            placeholder="Text závady při NE"
            style={{ flex: 3 }}
            disabled={disabled}
            value={item.defectText}
            error={errors[`${index}.defectText`]}
            onChange={(e) => set(index, { defectText: e.currentTarget.value })}
          />
          <Select
            aria-label={`Úroveň závady ${index + 1}`}
            w={190}
            disabled={disabled}
            allowDeselect={false}
            data={severities}
            value={riskLevels || item.severity === 'red' ? item.severity : 'amber'}
            onChange={(v) => v && set(index, { severity: v as CheckSeverity })}
          />
          <Tooltip label="Odebrat">
            <ActionIcon
              variant="subtle"
              color="red"
              mt={4}
              aria-label={`Odebrat kontrolní bod ${index + 1}`}
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ))}
      {!disabled && (
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          style={{ alignSelf: 'flex-start' }}
          onClick={() =>
            onChange([
              ...value,
              { key: uniqueKey('bod', -1), label: '', defectText: '', severity: 'amber' },
            ])
          }
        >
          Přidat kontrolní bod
        </Button>
      )}
    </Stack>
  );
}
