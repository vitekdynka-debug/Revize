import { Button, Group, Stack, TextInput, Textarea } from '@mantine/core';
import type { Customer } from '@revize/shared';
import { useState, type FormEvent } from 'react';
import type { ApiRequestError } from '../api/client.js';
import { useCreateCustomer, useUpdateCustomer } from '../api/hooks.js';
import { notifyError, notifySaved } from '../lib/notify.js';

const FIELDS = [
  ['name', 'Název', true],
  ['companyId', 'IČO', false],
  ['address', 'Adresa', false],
  ['contactName', 'Kontaktní osoba', false],
  ['contactEmail', 'E-mail', false],
  ['contactPhone', 'Telefon', false],
] as const;

type Values = Record<(typeof FIELDS)[number][0] | 'note', string>;

export function CustomerForm({
  customer,
  onDone,
}: {
  customer: Customer | null;
  onDone: (c: Customer) => void;
}) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const [values, setValues] = useState<Values>({
    name: customer?.name ?? '',
    companyId: customer?.companyId ?? '',
    address: customer?.address ?? '',
    contactName: customer?.contactName ?? '',
    contactEmail: customer?.contactEmail ?? '',
    contactPhone: customer?.contactPhone ?? '',
    note: customer?.note ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof Values) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const handlers = {
      onSuccess: (saved: Customer) => {
        notifySaved();
        onDone(saved);
      },
      onError: (error: ApiRequestError) => {
        setErrors(error.fieldErrors());
        notifyError(error);
      },
    };
    if (customer)
      update.mutate({ id: customer.id, version: customer.version, ...values }, handlers);
    else create.mutate(values, handlers);
  };

  return (
    <form onSubmit={submit}>
      <Stack>
        {FIELDS.map(([key, label, required]) => (
          <TextInput
            key={key}
            label={label}
            required={required}
            value={values[key]}
            error={errors[key]}
            onChange={(e) => set(key)(e.currentTarget.value)}
          />
        ))}
        <Textarea
          label="Poznámka"
          autosize
          minRows={2}
          value={values.note}
          onChange={(e) => set('note')(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button type="submit" loading={create.isPending || update.isPending}>
            Uložit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
