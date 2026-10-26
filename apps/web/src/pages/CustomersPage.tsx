import {
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useCustomers, useMe } from '../api/hooks.js';
import { CustomerForm } from '../components/CustomerForm.js';

export function CustomersPage() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const customers = useCustomers(includeArchived);
  const me = useMe();
  const canWrite = me.data?.permissions.includes('customer.write');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [opened, { open, close }] = useDisclosure();

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('cs');
    return (customers.data ?? []).filter(
      (c) =>
        !needle ||
        c.name.toLocaleLowerCase('cs').includes(needle) ||
        (c.companyId ?? '').includes(needle) ||
        (c.address ?? '').toLocaleLowerCase('cs').includes(needle),
    );
  }, [customers.data, search]);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Zákazníci</Title>
        {canWrite && <Button onClick={open}>Nový zákazník</Button>}
      </Group>
      <Group>
        <TextInput
          placeholder="Hledat podle názvu, IČO, adresy"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={360}
          maw="100%"
        />
        <Switch
          label="Zobrazit archivované"
          checked={includeArchived}
          onChange={(e) => setIncludeArchived(e.currentTarget.checked)}
        />
      </Group>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Název</Table.Th>
            <Table.Th>IČO</Table.Th>
            <Table.Th>Adresa</Table.Th>
            <Table.Th ta="right">Provozoven</Table.Th>
            <Table.Th ta="right">Artiklů</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtered.map((c) => (
            <Table.Tr
              key={c.id}
              style={{ cursor: 'pointer' }}
              onClick={() =>
                void navigate({ to: '/zakaznici/$customerId', params: { customerId: c.id } })
              }
            >
              <Table.Td>
                <Text fw={600} span>
                  {c.name}
                </Text>{' '}
                {c.archived && <Badge color="gray">archivován</Badge>}
              </Table.Td>
              <Table.Td>{c.companyId ?? '–'}</Table.Td>
              <Table.Td>{c.address ?? '–'}</Table.Td>
              <Table.Td ta="right">{c.siteCount}</Table.Td>
              <Table.Td ta="right">{c.itemCount}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {customers.isSuccess && filtered.length === 0 && <Text c="dimmed">Žádní zákazníci.</Text>}
      <Modal opened={opened} onClose={close} title="Nový zákazník">
        <CustomerForm
          customer={null}
          onDone={(c) => {
            close();
            void navigate({ to: '/zakaznici/$customerId', params: { customerId: c.id } });
          }}
        />
      </Modal>
    </Stack>
  );
}
