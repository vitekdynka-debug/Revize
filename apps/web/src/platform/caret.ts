const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', '']);

/**
 * Puts the caret at the end of a text field when it gets focus.
 *
 * Tapping into a filled field on the iPad put the caret at the start, so a technician adding a
 * word to a description typed in front of it. Only the moment of focusing is changed: a later
 * tap inside the focused field places the caret where tapped, as usual. Returns the cleanup.
 */
export function caretToEndOnFocus(target: Document = document): () => void {
  const onFocus = (event: FocusEvent) => {
    const field = event.target;
    const editable =
      field instanceof HTMLTextAreaElement ||
      (field instanceof HTMLInputElement && TEXT_TYPES.has(field.type));
    if (!editable || field.readOnly || !field.value) return;
    // After the browser has placed the caret for the tap.
    setTimeout(() => {
      if (document.activeElement !== field) return;
      // Only a caret left at the start; a selection (select all) or a tapped position stays.
      if (field.selectionStart !== 0 || field.selectionEnd !== 0) return;
      const end = field.value.length;
      try {
        field.setSelectionRange(end, end);
      } catch {
        // Field types without a text selection.
      }
    }, 0);
  };
  target.addEventListener('focusin', onFocus);
  return () => target.removeEventListener('focusin', onFocus);
}
