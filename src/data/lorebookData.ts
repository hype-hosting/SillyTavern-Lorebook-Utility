/**
 * Interface with SillyTavern's World Info / Lorebook system.
 * Reads and writes lorebook entries through ST's context API.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';

export interface LorebookEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  selectiveLogic: number;
  disable: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  position: number;
  depth: number;
  order: number;
  group: string;
  probability: number;
  useProbability: boolean;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
}

export interface LorebookInfo {
  name: string;
  entries: LorebookEntry[];
}

/** Cache for current lorebook data to avoid repeated lookups */
let cachedBookName: string | null = null;
let cachedEntries: LorebookEntry[] = [];

/**
 * Get all available world info book names from SillyTavern.
 */
export function getWorldInfoBookNames(): string[] {
  try {
    const ctx = SillyTavern.getContext();
    const worldInfo = ctx.worldInfoData;
    if (worldInfo) {
      return Object.keys(worldInfo);
    }

    // Fallback: try to find world info through other paths
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wi = (window as any).world_info as Record<string, WorldInfoBook> | undefined;
    if (wi) {
      return Object.keys(wi);
    }

    return [];
  } catch (e) {
    console.warn('[Lorebook Studio] Could not enumerate world info books:', e);
    return [];
  }
}

/**
 * Get the currently selected/active world info book name.
 */
export function getActiveBookName(): string | null {
  try {
    // Try to get the active book from ST's world info panel
    const selectedBook = $('#world_info_book_selector').val() as string | undefined;
    if (selectedBook && selectedBook !== 'None') {
      return selectedBook;
    }

    // Fallback: get first available book
    const names = getWorldInfoBookNames();
    return names.length > 0 ? names[0] : null;
  } catch {
    return null;
  }
}

/**
 * Get all entries from a specific lorebook.
 */
export function getEntries(bookName: string): LorebookEntry[] {
  try {
    const ctx = SillyTavern.getContext();
    // Try multiple access paths since ST's API varies by version
    const worldInfo = ctx.worldInfoData;
    let book: WorldInfoBook | undefined;

    if (worldInfo && worldInfo[bookName]) {
      book = worldInfo[bookName];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wi = (window as any).world_info as Record<string, WorldInfoBook> | undefined;
      if (wi && wi[bookName]) {
        book = wi[bookName];
      }
    }

    if (!book || !book.entries) {
      return [];
    }

    const entries: LorebookEntry[] = Object.values(book.entries).map((entry) => ({
      uid: entry.uid,
      key: Array.isArray(entry.key) ? entry.key : [String(entry.key)],
      keysecondary: Array.isArray(entry.keysecondary) ? entry.keysecondary : [],
      comment: entry.comment || '',
      content: entry.content || '',
      constant: entry.constant || false,
      selective: entry.selective || false,
      selectiveLogic: entry.selectiveLogic ?? 0,
      disable: entry.disable || false,
      excludeRecursion: entry.excludeRecursion || false,
      preventRecursion: entry.preventRecursion || false,
      position: entry.position ?? 0,
      depth: entry.depth ?? 4,
      order: entry.order ?? 100,
      group: entry.group || '',
      probability: entry.probability ?? 100,
      useProbability: entry.useProbability || false,
      sticky: entry.sticky ?? null,
      cooldown: entry.cooldown ?? null,
      delay: entry.delay ?? null,
    }));

    cachedBookName = bookName;
    cachedEntries = entries;
    return entries;
  } catch (e) {
    console.error('[Lorebook Studio] Error reading entries:', e);
    return [];
  }
}

/**
 * Update specific fields on a lorebook entry.
 */
export function updateEntry(
  bookName: string,
  uid: number,
  fields: Partial<LorebookEntry>,
): boolean {
  try {
    const ctx = SillyTavern.getContext();
    const worldInfo = ctx.worldInfoData;
    let book: WorldInfoBook | undefined;

    if (worldInfo && worldInfo[bookName]) {
      book = worldInfo[bookName];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wi = (window as any).world_info as Record<string, WorldInfoBook> | undefined;
      if (wi && wi[bookName]) {
        book = wi[bookName];
      }
    }

    if (!book || !book.entries) return false;

    const entry = Object.values(book.entries).find((e) => e.uid === uid);
    if (!entry) return false;

    // Apply field updates
    Object.assign(entry, fields);

    // Trigger ST's save mechanism
    triggerWorldInfoSave();

    // Notify internal listeners
    EventBus.emit(STUDIO_EVENTS.ENTRY_UPDATED, { bookName, uid, fields });

    return true;
  } catch (e) {
    console.error('[Lorebook Studio] Error updating entry:', e);
    return false;
  }
}

/**
 * Create a new blank entry in the specified lorebook.
 */
export async function createEntry(bookName: string): Promise<LorebookEntry | null> {
  try {
    // Use ST's built-in world info creation if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createFn = (window as any).createWorldInfoEntry as
      | ((name: string) => Promise<WorldInfoEntry>)
      | undefined;

    if (createFn) {
      const newEntry = await createFn(bookName);
      const entry = normalizeEntry(newEntry);
      EventBus.emit(STUDIO_EVENTS.ENTRY_CREATED, { bookName, entry });
      return entry;
    }

    // Fallback: manually create entry in the data structure
    const ctx = SillyTavern.getContext();
    const worldInfo = ctx.worldInfoData;
    const book = worldInfo?.[bookName];
    if (!book) return null;

    const maxUid = Object.values(book.entries).reduce(
      (max, e) => Math.max(max, e.uid),
      0,
    );
    const newUid = maxUid + 1;

    const newEntry: WorldInfoEntry = {
      uid: newUid,
      key: [],
      keysecondary: [],
      comment: 'New Entry',
      content: '',
      constant: false,
      vectorized: false,
      selective: false,
      selectiveLogic: 0,
      addMemo: true,
      order: 100,
      position: 0,
      disable: false,
      excludeRecursion: false,
      preventRecursion: false,
      delayUntilRecursion: false,
      probability: 100,
      useProbability: false,
      depth: 4,
      group: '',
      groupOverride: false,
      groupWeight: 100,
      scanDepth: null,
      caseSensitive: null,
      matchWholeWords: null,
      useGroupScoring: null,
      automationId: '',
      role: null,
      sticky: null,
      cooldown: null,
      delay: null,
    };

    book.entries[String(newUid)] = newEntry;
    triggerWorldInfoSave();

    const normalized = normalizeEntry(newEntry);
    EventBus.emit(STUDIO_EVENTS.ENTRY_CREATED, { bookName, entry: normalized });
    return normalized;
  } catch (e) {
    console.error('[Lorebook Studio] Error creating entry:', e);
    return null;
  }
}

/**
 * Delete an entry from the specified lorebook.
 */
export function deleteEntry(bookName: string, uid: number): boolean {
  try {
    const ctx = SillyTavern.getContext();
    const worldInfo = ctx.worldInfoData;
    const book = worldInfo?.[bookName];
    if (!book) return false;

    const key = Object.keys(book.entries).find(
      (k) => book.entries[k].uid === uid,
    );
    if (!key) return false;

    delete book.entries[key];
    triggerWorldInfoSave();

    EventBus.emit(STUDIO_EVENTS.ENTRY_DELETED, { bookName, uid });
    return true;
  } catch (e) {
    console.error('[Lorebook Studio] Error deleting entry:', e);
    return false;
  }
}

/**
 * Get cached entries (avoids re-reading if book hasn't changed).
 */
export function getCachedEntries(bookName: string): LorebookEntry[] {
  if (cachedBookName === bookName && cachedEntries.length > 0) {
    return cachedEntries;
  }
  return getEntries(bookName);
}

/**
 * Clear the entry cache (call when lorebook changes externally).
 */
export function clearCache(): void {
  cachedBookName = null;
  cachedEntries = [];
}

function normalizeEntry(entry: WorldInfoEntry): LorebookEntry {
  return {
    uid: entry.uid,
    key: Array.isArray(entry.key) ? entry.key : [String(entry.key)],
    keysecondary: Array.isArray(entry.keysecondary) ? entry.keysecondary : [],
    comment: entry.comment || '',
    content: entry.content || '',
    constant: entry.constant || false,
    selective: entry.selective || false,
    selectiveLogic: entry.selectiveLogic ?? 0,
    disable: entry.disable || false,
    excludeRecursion: entry.excludeRecursion || false,
    preventRecursion: entry.preventRecursion || false,
    position: entry.position ?? 0,
    depth: entry.depth ?? 4,
    order: entry.order ?? 100,
    group: entry.group || '',
    probability: entry.probability ?? 100,
    useProbability: entry.useProbability || false,
    sticky: entry.sticky ?? null,
    cooldown: entry.cooldown ?? null,
    delay: entry.delay ?? null,
  };
}

/**
 * Trigger SillyTavern's world info save mechanism.
 */
function triggerWorldInfoSave(): void {
  try {
    // Try to trigger ST's save
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saveFn = (window as any).saveWorldInfo as
      | (() => void)
      | undefined;
    if (saveFn) {
      saveFn();
      return;
    }

    // Fallback: trigger the input event on world info elements to
    // activate ST's debounced save
    $('#world_info').trigger('change');
  } catch (e) {
    console.warn('[Lorebook Studio] Could not trigger world info save:', e);
  }
}
