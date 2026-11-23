import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { useShowcaseInfo } from '../api/hooks.js';

/**
 * Login page of a showcase instance (ADR-0023): what it is and its accounts in one click.
 * Shows nothing on a real server.
 */
export function ShowcaseLoginHint({
  onPick,
}: {
  onPick: (email: string, password: string) => void;
}) {
  const info = useShowcaseInfo();
  if (!info.data?.enabled) return null;
  return (
    <Alert color="blue" title="Ukázková verze pro prezentaci" data-testid="showcase-hint">
      <Stack gap="xs">
        <Text size="sm">
          Vyzkoušejte si vše: kontrolu v terénu, fotky závad, protokoly i exporty. Data jsou
          smyšlená
          {info.data.resetHour !== null
            ? ` a každou noc ve ${info.data.resetHour}:00 se vrátí do výchozího stavu`
            : ''}
          . Nezadávejte skutečné údaje zákazníků.
        </Text>
        <Group gap="xs">
          {info.data.accounts.map((a) => (
            <Button
              key={a.email}
              size="xs"
              variant="light"
              onClick={() => onPick(a.email, a.password)}
            >
              {a.label}
            </Button>
          ))}
        </Group>
      </Stack>
    </Alert>
  );
}
