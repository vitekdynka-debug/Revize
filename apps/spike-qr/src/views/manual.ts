import { ITEM_NUMBER_MAX_LENGTH, KEYPAD_AUTO_LENGTH } from '@revize/shared';
import { findItem } from '../catalog.js';
import { runCheck } from '../check-flow.js';
import { h } from '../dom.js';

/**
 * Manual item-number entry. `keypad` uses an on-screen numeric keypad (no iOS keyboard),
 * otherwise the system numeric keyboard. A 5-digit number of an existing item opens it right
 * away (4-digit series are typed with a leading 0); any other length is confirmed with OK.
 */
export function manualView(root: HTMLElement, variant: 'manual' | 'keypad'): () => void {
  let readyAt = performance.now();
  const input = h('input', {
    class: 'manual-input mono',
    type: 'text',
    inputmode: variant === 'keypad' ? 'none' : 'numeric',
    pattern: '[0-9]*',
    maxlength: ITEM_NUMBER_MAX_LENGTH,
    enterkeyhint: 'search',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    placeholder: '_____',
    'aria-label': 'Číslo artiklu',
    readonly: variant === 'keypad',
  });

  const submit = async () => {
    const value = input.value;
    if (value === '') return;
    await runCheck({ mode: variant, raw: value, toReadMs: performance.now() - readyAt });
    input.value = '';
    readyAt = performance.now();
    if (variant === 'manual') input.focus();
  };

  /** Auto lookup after the 5th digit, but only for a number that exists. */
  const maybeAutoSubmit = () => {
    if (input.value.length === KEYPAD_AUTO_LENGTH && findItem(input.value)) void submit();
  };

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, ITEM_NUMBER_MAX_LENGTH);
    maybeAutoSubmit();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void submit();
  });

  const press = (key: string) => {
    if (key === '⌫') input.value = input.value.slice(0, -1);
    else if (key === 'C') input.value = '';
    else if (input.value.length < ITEM_NUMBER_MAX_LENGTH) input.value += key;
    maybeAutoSubmit();
  };
  const keypad =
    variant === 'keypad'
      ? h(
          'div',
          { class: 'keypad' },
          ...['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) =>
            h(
              'button',
              {
                class: 'btn key',
                onpointerdown: (event: Event) => {
                  event.preventDefault();
                  press(key);
                },
              },
              key,
            ),
          ),
          h(
            'button',
            {
              class: 'btn btn-ok key key-ok',
              onpointerdown: (event: Event) => {
                event.preventDefault();
                void submit();
              },
            },
            'OK',
          ),
        )
      : null;

  root.replaceChildren(
    h(
      'div',
      { class: 'page manual' },
      h('a', { href: '#/', class: 'btn btn-small' }, '← Zpět'),
      h('h1', {}, variant === 'keypad' ? 'Číselník v aplikaci' : 'Systémová klávesnice'),
      h(
        'p',
        { class: 'muted' },
        'Pětimístné číslo se otevře hned. Čtyřmístné zadejte s nulou na začátku (např. 04001), ' +
          'nebo napište číslo a potvrďte OK.',
      ),
      input,
      keypad,
      variant === 'manual'
        ? h('button', { class: 'btn btn-ok', onclick: () => void submit() }, 'Vyhledat')
        : '',
    ),
  );
  if (variant === 'manual') input.focus();
  return () => undefined;
}
