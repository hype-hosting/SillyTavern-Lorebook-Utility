/**
 * Entry CRUD (Create, Read, Update, Delete) operations for Lorebook Studio.
 * Provides higher-level operations that coordinate between data layer and graph.
 */

import { createEntry, deleteEntry, updateEntry, getEntries, LorebookEntry } from '../data/lorebookData';
import { removeLinksForEntry } from '../data/manualLinks';
import { cleanupEntryMeta } from '../data/studioData';

/**
 * Create a new entry and notify the graph.
 * Note: the data layer (lorebookData.ts) emits ENTRY_CREATED internally.
 */
export async function createNewEntry(bookName: string): Promise<LorebookEntry | null> {
  return await createEntry(bookName);
}

/**
 * Duplicate an existing entry.
 */
export async function duplicateEntryById(
  bookName: string,
  sourceUid: number,
): Promise<LorebookEntry | null> {
  const entries = getEntries(bookName);
  const source = entries.find((e) => e.uid === sourceUid);
  if (!source) return null;

  const newEntry = await createEntry(bookName);
  if (!newEntry) return null;

  const fields: Partial<LorebookEntry> = {
    comment: (source.comment || 'Entry') + ' (copy)',
    key: [...source.key],
    keysecondary: [...source.keysecondary],
    selectiveLogic: source.selectiveLogic,
    content: source.content,
    position: source.position,
    depth: source.depth,
    order: source.order,
    probability: source.probability,
    scanDepth: source.scanDepth,
    automationId: source.automationId,
    group: source.group,
    groupWeight: source.groupWeight,
    groupOverride: source.groupOverride,
    disable: source.disable,
    constant: source.constant,
    selective: source.selective,
    caseSensitive: source.caseSensitive,
    matchWholeWords: source.matchWholeWords,
    useGroupScoring: source.useGroupScoring,
    excludeRecursion: source.excludeRecursion,
    preventRecursion: source.preventRecursion,
    delayUntilRecursion: source.delayUntilRecursion,
    sticky: source.sticky,
    cooldown: source.cooldown,
    delay: source.delay,
  };

  updateEntry(bookName, newEntry.uid, fields);
  return { ...newEntry, ...fields };
}

/**
 * Delete an entry and clean up related manual links.
 * Note: the data layer (lorebookData.ts) emits ENTRY_DELETED internally.
 */
export function deleteEntryById(bookName: string, uid: number): boolean {
  // Remove manual links referencing this entry
  removeLinksForEntry(bookName, String(uid));

  // Remove studio metadata for this entry
  cleanupEntryMeta(bookName, String(uid));

  // Delete the entry itself
  return deleteEntry(bookName, uid);
}

/**
 * Toggle an entry's enabled/disabled state.
 */
export function toggleEntryEnabled(bookName: string, uid: number): boolean {
  const entries = getEntries(bookName);
  const entry = entries.find((e) => e.uid === uid);
  if (!entry) return false;

  return updateEntry(bookName, uid, { disable: !entry.disable });
}
