/**
 * Keeps the field being typed into visible above the on-screen keyboard.
 *
 * The full iPad keyboard covers about 40 % of the screen, but Safari does not shrink fixed
 * layers (drawers, dialogs) for it: the description of a defect at the bottom of the item card
 * ended up under the keyboard. The covered height is published as `--keyboard-inset` (used as
 * extra bottom padding of drawers and dialogs, see app.css) and the focused field is scrolled
 * into the visible part. Returns the cleanup.
 */
export function keepFieldAboveKeyboard(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => undefined;
  const root = document.documentElement;
  const update = () => {
    const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    // Small differences are browser bars, not a keyboard.
    root.style.setProperty('--keyboard-inset', covered > 80 ? `${Math.round(covered)}px` : '0px');
    const field = document.activeElement;
    if (covered > 80 && field instanceof HTMLElement && isTextField(field)) {
      field.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };
  viewport.addEventListener('resize', update);
  return () => {
    viewport.removeEventListener('resize', update);
    root.style.removeProperty('--keyboard-inset');
  };
}

function isTextField(element: HTMLElement): boolean {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      !['checkbox', 'radio', 'button', 'submit', 'file'].includes(element.type))
  );
}
