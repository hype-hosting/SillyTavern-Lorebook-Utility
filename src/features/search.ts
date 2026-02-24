/**
 * Search and filter functionality for Lorebook Studio.
 */

import { getEntries, LorebookEntry } from '../data/lorebookData';
import { detectRecursions } from '../data/recursionDetector';

export type FilterPreset = 'all' | 'orphans' | 'disabled' | 'most-connected' | 'no-keys' | 'empty-content';

/**
 * Search entries by query string across multiple fields.
 */
export function searchEntries(
  bookName: string,
  query: string,
): LorebookEntry[] {
  if (!query.trim()) return [];

  const entries = getEntries(bookName);
  const lowerQuery = query.toLowerCase();

  return entries.filter((entry) => {
    const searchable = [
      entry.comment,
      ...entry.key,
      ...entry.keysecondary,
      entry.content,
      entry.group,
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(lowerQuery);
  });
}

/**
 * Filter entries by preset criteria.
 */
export function filterEntries(
  bookName: string,
  preset: FilterPreset,
): LorebookEntry[] {
  const entries = getEntries(bookName);

  switch (preset) {
    case 'all':
      return entries;

    case 'disabled':
      return entries.filter((e) => e.disable);

    case 'no-keys':
      return entries.filter(
        (e) => !e.constant && (e.key.length === 0 || e.key.every((k) => !k.trim())),
      );

    case 'empty-content':
      return entries.filter((e) => !e.content.trim());

    case 'orphans': {
      const edges = detectRecursions(entries);
      const connectedUids = new Set<number>();
      for (const edge of edges) {
        connectedUids.add(edge.sourceUid);
        connectedUids.add(edge.targetUid);
      }
      return entries.filter((e) => !connectedUids.has(e.uid));
    }

    case 'most-connected': {
      const edges = detectRecursions(entries);
      const counts = new Map<number, number>();
      for (const entry of entries) {
        counts.set(entry.uid, 0);
      }
      for (const edge of edges) {
        counts.set(edge.sourceUid, (counts.get(edge.sourceUid) || 0) + 1);
        counts.set(edge.targetUid, (counts.get(edge.targetUid) || 0) + 1);
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const topUids = new Set(sorted.slice(0, 10).map(([uid]) => uid));
      return entries.filter((e) => topUids.has(e.uid));
    }

    default:
      return entries;
  }
}

/**
 * Get UIDs from search/filter results as a Set of strings.
 */
export function getMatchingUids(entries: LorebookEntry[]): Set<string> {
  return new Set(entries.map((e) => String(e.uid)));
}
