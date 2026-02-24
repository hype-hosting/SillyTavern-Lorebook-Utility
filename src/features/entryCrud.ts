/**
 * Entry CRUD (Create, Read, Update, Delete) operations for Lorebook Studio.
 * Provides higher-level operations that coordinate between data layer and graph.
 */

import { createEntry, deleteEntry, updateEntry, getEntries, LorebookEntry } from '../data/lorebookData';
import { removeLinksForEntry } from '../data/manualLinks';
import { EventBus, STUDIO_EVENTS } from '../utils/events';

/**
 * Create a new entry and notify the graph.
 */
export async function createNewEntry(bookName: string): Promise<LorebookEntry | null> {
  const entry = await createEntry(bookName);
  if (entry) {
    EventBus.emit(STUDIO_EVENTS.ENTRY_CREATED, { bookName, entry });
  }
  return entry;
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
    content: source.content,
    position: source.position,
    depth: source.depth,
    order: source.order,
    probability: source.probability,
    group: source.group,
    disable: source.disable,
    constant: source.constant,
    selective: source.selective,
    excludeRecursion: source.excludeRecursion,
    preventRecursion: source.preventRecursion,
  };

  updateEntry(bookName, newEntry.uid, fields);
  return { ...newEntry, ...fields };
}

/**
 * Delete an entry and clean up related manual links.
 */
export function deleteEntryById(bookName: string, uid: number): boolean {
  // Remove manual links referencing this entry
  removeLinksForEntry(bookName, String(uid));

  // Delete the entry itself
  const success = deleteEntry(bookName, uid);
  if (success) {
    EventBus.emit(STUDIO_EVENTS.ENTRY_DELETED, { bookName, uid });
  }
  return success;
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
