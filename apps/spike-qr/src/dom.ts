type Child = Node | string | null | undefined | false;
type Props = Record<string, string | number | boolean | EventListener | undefined>;

/** Minimal element factory: `h('button', { class: 'big', onclick: fn }, 'OK')`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2), value);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child);
  }
  return element;
}

export function download(filename: string, content: string | Blob, type: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFiles(files: File[]): boolean {
  try {
    return navigator.canShare?.({ files }) ?? false;
  } catch {
    return false;
  }
}

/**
 * Opens the share sheet (iPad: "Uložit do Souborů", AirDrop, mail). Must be called directly
 * from a tap: iOS rejects share() once the user gesture expired, e.g. after awaiting a database
 * read. Returns false when sharing is not possible or was rejected (not when cancelled).
 */
export async function shareFiles(files: File[], title: string): Promise<boolean> {
  if (!canShareFiles(files)) return false;
  try {
    await navigator.share({ files, title });
    return true;
  } catch (error) {
    return (error as DOMException).name === 'AbortError';
  }
}
