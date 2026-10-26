import { db, photoBlob, type PhotoOwner, type PhotoRow } from './db.js';

export interface PhotoTarget {
  owner: PhotoOwner;
  inspectionId: string;
  itemNumber?: string;
}

const resultIdOf = (inspectionId: string, itemNumber: string) => `${inspectionId}:${itemNumber}`;

/**
 * Stores a photo right away, before anything else happens: a photo that was taken must not get
 * lost even if the app is closed before the result is saved. Verifies the write (WebKit).
 */
export async function addPhoto(target: PhotoTarget, blob: Blob): Promise<PhotoRow> {
  if (target.owner !== 'inspection' && !target.itemNumber) throw new Error('Chybí číslo artiklu');
  const row: PhotoRow = {
    id: crypto.randomUUID(),
    owner: target.owner,
    inspectionId: target.inspectionId,
    resultId:
      target.owner === 'result' ? resultIdOf(target.inspectionId, target.itemNumber!) : null,
    itemNumber: target.owner === 'inspection' ? null : target.itemNumber!,
    takenAt: new Date().toISOString(),
    data: await blob.arrayBuffer(),
    type: blob.type || 'image/jpeg',
  };
  await db.photos.add(row);
  if (!(await db.photos.get(row.id))) throw new Error('Fotku se nepodařilo uložit');
  return row;
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

/** Photos of a target, oldest first. Item photos are shown across all inspections. */
export async function photosOf(target: PhotoTarget): Promise<PhotoRow[]> {
  let rows: PhotoRow[];
  if (target.owner === 'result') {
    rows = await db.photos
      .where('resultId')
      .equals(resultIdOf(target.inspectionId, target.itemNumber!))
      .toArray();
  } else if (target.owner === 'item') {
    rows = await db.photos
      .where('itemNumber')
      .equals(target.itemNumber!)
      .filter((p) => p.owner === 'item')
      .toArray();
  } else {
    rows = await db.photos
      .where('inspectionId')
      .equals(target.inspectionId)
      .filter((p) => p.owner === 'inspection')
      .toArray();
  }
  return rows.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

export async function photoUrl(photo: PhotoRow): Promise<string> {
  return URL.createObjectURL(await photoBlob(photo));
}
