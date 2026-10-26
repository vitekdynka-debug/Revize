import { notifications } from '@mantine/notifications';
import { ApiRequestError } from '../api/client.js';

export function notifySaved(message = 'Uloženo') {
  notifications.show({ color: 'green', message, autoClose: 2500 });
}

export function notifyError(error: unknown) {
  const message =
    error instanceof ApiRequestError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);
  notifications.show({ color: 'red', title: 'Akce se nepodařila', message, autoClose: 6000 });
}
