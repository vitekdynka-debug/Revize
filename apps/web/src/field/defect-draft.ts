/**
 * The defect being written on an item card, kept on the device while typing.
 *
 * iPadOS often reloads the page when the camera app opens (memory), and the card is closed by
 * mistake; the description must not be lost. Draft photos are in IndexedDB already
 * (`saveDraftPhoto`); this keeps the text and the chosen level next to them until the result is
 * saved or undone. Local storage is enough: small, synchronous for the first render.
 */
export interface DefectDraft {
  description: string;
  severity: 'green' | 'amber' | 'red';
  includeInProtocol: boolean;
  photosInProtocol: boolean;
}

const key = (inspectionId: string, itemId: string) => `revize:defect:${inspectionId}:${itemId}`;

export function loadDefectDraft(inspectionId: string, itemId: string): DefectDraft | null {
  try {
    const raw = localStorage.getItem(key(inspectionId, itemId));
    return raw ? (JSON.parse(raw) as DefectDraft) : null;
  } catch {
    return null;
  }
}

export function saveDefectDraft(inspectionId: string, itemId: string, draft: DefectDraft): void {
  try {
    localStorage.setItem(key(inspectionId, itemId), JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the text stays in the open card at least.
  }
}

export function clearDefectDraft(inspectionId: string, itemId: string): void {
  try {
    localStorage.removeItem(key(inspectionId, itemId));
  } catch {
    // Nothing to clear.
  }
}
