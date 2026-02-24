/**
 * Entry editing functionality for Lorebook Studio.
 * Handles inline editing of lorebook entries from the sidebar.
 */

// Entry editing is handled directly in sidebar.ts since the sidebar IS the editor.
// This module provides additional validation and helper utilities.

import { LorebookEntry, getEntries } from '../data/lorebookData';

/**
 * Validate entry data before saving.
 * Returns an array of warning messages (empty if valid).
 */
export function validateEntry(
  entry: Partial<LorebookEntry>,
  allEntries: LorebookEntry[],
  currentUid: number,
): string[] {
  const warnings: string[] = [];

  // Check for empty keys (unless constant)
  if (
    !entry.constant &&
    (!entry.key || entry.key.length === 0 || entry.key.every((k) => !k.trim()))
  ) {
    warnings.push('Entry has no primary keys and is not constant. It may never activate.');
  }

  // Check for empty content
  if (!entry.content || !entry.content.trim()) {
    warnings.push('Entry has no content.');
  }

  // Check for duplicate keys across entries
  if (entry.key) {
    for (const key of entry.key) {
      if (!key.trim()) continue;
      const duplicates = allEntries.filter(
        (e) =>
          e.uid !== currentUid &&
          e.key.some((k) => k.trim().toLowerCase() === key.trim().toLowerCase()),
      );
      if (duplicates.length > 0) {
        const names = duplicates.map((d) => d.comment || `Entry ${d.uid}`).join(', ');
        warnings.push(`Key "${key}" also exists in: ${names}`);
      }
    }
  }

  return warnings;
}

/**
 * Check if an entry has been modified compared to its original state.
 */
export function isEntryModified(
  current: Partial<LorebookEntry>,
  original: LorebookEntry,
): boolean {
  return (
    current.comment !== original.comment ||
    current.content !== original.content ||
    JSON.stringify(current.key) !== JSON.stringify(original.key) ||
    JSON.stringify(current.keysecondary) !== JSON.stringify(original.keysecondary) ||
    current.position !== original.position ||
    current.depth !== original.depth ||
    current.order !== original.order ||
    current.disable !== original.disable ||
    current.constant !== original.constant ||
    current.selective !== original.selective ||
    current.excludeRecursion !== original.excludeRecursion ||
    current.preventRecursion !== original.preventRecursion
  );
}

/**
 * Get entries sorted by various criteria.
 */
export function getSortedEntries(
  bookName: string,
  sortBy: 'name' | 'order' | 'uid' | 'connections' = 'name',
): LorebookEntry[] {
  const entries = getEntries(bookName);

  switch (sortBy) {
    case 'name':
      return [...entries].sort((a, b) =>
        (a.comment || '').localeCompare(b.comment || ''),
      );
    case 'order':
      return [...entries].sort((a, b) => a.order - b.order);
    case 'uid':
      return [...entries].sort((a, b) => a.uid - b.uid);
    default:
      return entries;
  }
}
