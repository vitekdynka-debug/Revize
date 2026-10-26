/**
 * Materialized path of a location in the site tree (docs/architecture.md §3).
 * `pathIds` lists ancestors and the location itself (root first) for subtree queries
 * (`path_ids @> array[id]`); `sortPath` orders a whole site "by location" with a plain ORDER BY.
 */
export interface LocationPath {
  pathIds: string[];
  sortPath: string;
}

const SEGMENT_WIDTH = 6;

export function sortSegment(sortOrder: number): string {
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder >= 10 ** SEGMENT_WIDTH) {
    throw new RangeError(`sortOrder out of range: ${sortOrder}`);
  }
  return String(sortOrder).padStart(SEGMENT_WIDTH, '0');
}

export function locationPath(
  parent: LocationPath | null,
  id: string,
  sortOrder: number,
): LocationPath {
  const segment = sortSegment(sortOrder);
  return parent
    ? { pathIds: [...parent.pathIds, id], sortPath: `${parent.sortPath}.${segment}` }
    : { pathIds: [id], sortPath: segment };
}
