import {
  Badge,
  Breadcrumbs,
  Button,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import type { Site } from '@revize/shared';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { AnchorLink, ButtonLink } from '../components/links.js';
import { useCreateSite, useCustomer, useMe, useSites, useUpdateCustomer } from '../api/hooks.js';
import { CustomerForm } from '../components/CustomerForm.js';
import { notifyError, notifySaved } from '../lib/notify.js';

function SiteForm({ customerId, onDone }: { customerId: string; onDone: (site: Site) => void }) {
  const create = useCreateSite();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { customerId, name, address, note },
      { onSuccess: (s) => (notifySaved(), onDone(s)), onError: notifyError },
    );
  };
  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput
          label="Název provozovny"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <TextInput
          label="Adresa"
          value={address}
          onChange={(e) => setAddress(e.currentTarget.value)}
        />
        <Textarea label="Poznámka" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button type="submit" loading={create.isPending}>
            Uložit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function CustomerPage() {
  const { customerId } = useParams({ from: '/app/zakaznici/$customerId' });
  const customer = useCustomer(customerId);
  const sites = useSites(customerId);
  const update = useUpdateCustomer();
  const me = useMe();
  const canWrite = me.data?.permissions.includes('customer.write');
  const navigate = useNavigate();
  const [editOpened, edit] = useDisclosure();
  const [siteOpened, siteModal] = useDisclosure();

  if (!customer.data) return customer.error ? <Text c="red">{customer.error.message}</Text> : null;
  const c = customer.data;

  const toggleArchive = () =>
    modals.openConfirmModal({
      title: c.archived ? 'Obnovit zákazníka?' : 'Archivovat zákazníka?',
      children: (
        <Text size="sm">
          {c.archived
            ? 'Zákazník se znovu zobrazí v seznamech.'
            : 'Zákazník zmizí ze seznamů, data i historie kontrol zůstanou zachované.'}
        </Text>
      ),
      onConfirm: () =>
        update.mutate(
          { id: c.id, version: c.version, archived: !c.archived },
          { onSuccess: () => notifySaved(), onError: notifyError },
        ),
    });

  return (
    <Stack>
      <Breadcrumbs>
        <AnchorLink to="/zakaznici">Zákazníci</AnchorLink>
        <Text>{c.name}</Text>
      </Breadcrumbs>
      <Group justify="space-between">
        <Group>
          <Title order={2}>{c.name}</Title>
          {c.archived && <Badge color="gray">archivován</Badge>}
        </Group>
        <Group>
          <ButtonLink variant="default" to="/artikly" search={{ customerId: c.id }}>
            Artikly ({c.itemCount})
          </ButtonLink>
          {canWrite && (
            <>
              <Button variant="default" onClick={edit.open}>
                Upravit
              </Button>
              <Button variant="subtle" color="gray" onClick={toggleArchive}>
                {c.archived ? 'Obnovit' : 'Archivovat'}
              </Button>
            </>
          )}
        </Group>
      </Group>
      <Paper withBorder p="md">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <div>
            <Text size="xs" c="dimmed">
              IČO
            </Text>
            <Text>{c.companyId ?? '–'}</Text>
            <Text size="xs" c="dimmed" mt="sm">
              Adresa
            </Text>
            <Text>{c.address ?? '–'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Kontaktní osoba
            </Text>
            <Text>{c.contactName ?? '–'}</Text>
            <Text size="xs" c="dimmed" mt="sm">
              E-mail / telefon
            </Text>
            <Text>
              {c.contactEmail ?? '–'} · {c.contactPhone ?? '–'}
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Poznámka
            </Text>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{c.note ?? '–'}</Text>
          </div>
        </SimpleGrid>
      </Paper>

      <Group justify="space-between" mt="md">
        <Title order={3}>Provozovny</Title>
        {canWrite && <Button onClick={siteModal.open}>Nová provozovna</Button>}
      </Group>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Název</Table.Th>
            <Table.Th>Adresa</Table.Th>
            <Table.Th ta="right">Artiklů</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sites.data?.map((s) => (
            <Table.Tr
              key={s.id}
              style={{ cursor: 'pointer' }}
              onClick={() => void navigate({ to: '/provozovny/$siteId', params: { siteId: s.id } })}
            >
              <Table.Td fw={600}>{s.name}</Table.Td>
              <Table.Td>{s.address ?? '–'}</Table.Td>
              <Table.Td ta="right">{s.itemCount}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {sites.isSuccess && sites.data.length === 0 && (
        <Text c="dimmed">Zákazník zatím nemá žádnou provozovnu.</Text>
      )}

      <Modal opened={editOpened} onClose={edit.close} title="Upravit zákazníka">
        <CustomerForm customer={c} onDone={edit.close} />
      </Modal>
      <Modal opened={siteOpened} onClose={siteModal.close} title="Nová provozovna">
        <SiteForm
          customerId={c.id}
          onDone={(s) => {
            siteModal.close();
            void navigate({ to: '/provozovny/$siteId', params: { siteId: s.id } });
          }}
        />
      </Modal>
    </Stack>
  );
}
