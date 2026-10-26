import { ITEM_NUMBER_LENGTH } from '@revize/shared';
import { runCheck } from '../check-flow.js';
import { h } from '../dom.js';

/**
 * Manual item-number entry. `keypad` uses an on-screen numeric keypad (no iOS keyboard),
 * otherwise the system numeric keyboard. Lookup fires as soon as 5 digits are entered.
 */
export function manualView(root: HTMLElement, variant: 'manual' | 'keypad'): () => void {
  let readyAt = performance.now();
  const input = h('input', {
    class: 'manual-input mono',
    type: 'text',
    inputmode: variant === 'keypad' ? 'none' : 'numeric',
    pattern: '[0-9]*',
    maxlength: ITEM_NUMBER_LENGTH,
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    placeholder: '_____',
    'aria-label': 'Číslo artiklu',
    readonly: variant === 'keypad',
  });

  const submit = async () => {
    const value = input.value;
    if (value.length !== ITEM_NUMBER_LENGTH) return;
    await runCheck({ mode: variant, raw: value, toReadMs: performance.now() - readyAt });
    input.value = '';
    readyAt = performance.now();
    if (variant === 'manual') input.focus();
  };

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, ITEM_NUMBER_LENGTH);
    void submit();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void submit();
  });

  const press = (key: string) => {
    if (key === '⌫') input.value = input.value.slice(0, -1);
    else if (input.value.length < ITEM_NUMBER_LENGTH) input.value += key;
    void submit();
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
                  if (key === 'C') input.value = '';
                  else press(key);
                },
              },
              key,
            ),
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
        'Zadejte 5místné číslo artiklu (10001–10050). Hledá se hned po 5. číslici.',
      ),
      input,
      keypad,
    ),
  );
  if (variant === 'manual') input.focus();
  return () => undefined;
}
