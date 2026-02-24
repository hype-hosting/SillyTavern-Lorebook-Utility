/**
 * Interface with SillyTavern's World Info / Lorebook system.
 * Reads and writes lorebook entries through ST's context API.
 *
 * SillyTavern exposes world info through functions on getContext():
 *   - loadWorldInfo(name) — async, returns { entries: Record<string, WorldInfoEntry> }
 *   - saveWorldInfo(name, data) — async, saves data to backend
 *   - reloadWorldInfoEditor() — refreshes ST's WI editor panel
 *
 * Book names are NOT directly exposed via getContext(). They are read from
 * ST's DOM selectors (#world_editor_select and #world_info) where each
 * <option> has textContent = book name and value = numeric index.
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

// --- Module-level cache ---

/** The raw book data object returned by loadWorldInfo() */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadedData: any = null;
/** Name of the currently loaded book */
let loadedBookName: string | null = null;
/** Normalized entries cache */
let cachedEntries: LorebookEntry[] = [];

/**
 * Get all available world info book names from SillyTavern's DOM.
 *
 * ST populates #world_editor_select and #world_info with <option> elements
 * where textContent is the book name and value is the numeric index.
 */
export function getWorldInfoBookNames(): string[] {
  try {
    const names = new Set<string>();

    // Read from ST's world info book selectors
    const selectors = ['#world_editor_select', '#world_info'];
    for (const sel of selectors) {
      const options = document.querySelectorAll(`${sel} option`);
      options.forEach((opt) => {
        const text = opt.textContent?.trim();
        if (text && text !== '' && text !== 'None' && text !== '— None —') {
          names.add(text);
        }
      });
    }

    if (names.size > 0) {
      return [...names];
    }

    // Fallback: try to get book names from any world info related element
    const wiElements = document.querySelectorAll('.world_info_name, [data-world-name]');
    wiElements.forEach((el) => {
      const name = el.textContent?.trim() || (el as HTMLElement).dataset?.worldName;
      if (name) names.add(name);
    });

    return [...names];
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
    // Try to read from ST's world editor selector (the currently selected book)
    const editorSelect = document.getElementById('world_editor_select') as HTMLSelectElement | null;
    if (editorSelect && editorSelect.selectedIndex > 0) {
      const selectedOption = editorSelect.options[editorSelect.selectedIndex];
      const name = selectedOption?.textContent?.trim();
      if (name && name !== 'None' && name !== '— None —') {
        return name;
      }
    }

    // Try the global world info selector
    const globalSelect = document.getElementById('world_info') as HTMLSelectElement | null;
    if (globalSelect && globalSelect.selectedIndex > 0) {
      const selectedOption = globalSelect.options[globalSelect.selectedIndex];
      const name = selectedOption?.textContent?.trim();
      if (name && name !== 'None' && name !== '— None —') {
        return name;
      }
    }

    // Fallback: get first available book
    const names = getWorldInfoBookNames();
    return names.length > 0 ? names[0] : null;
  } catch {
    return null;
  }
}

/**
 * Load book data from SillyTavern's API into the module cache.
 * Must be called before getEntries() will return data for this book.
 */
export async function loadBookData(bookName: string): Promise<boolean> {
  try {
    const ctx = SillyTavern.getContext();
    const data = await ctx.loadWorldInfo(bookName);

    if (!data || !data.entries) {
      console.warn(`[Lorebook Studio] loadWorldInfo("${bookName}") returned no data`);
      loadedData = null;
      loadedBookName = null;
      cachedEntries = [];
      return false;
    }

    loadedData = data;
    loadedBookName = bookName;
    // Pre-build normalized entries cache
    cachedEntries = buildEntryList(data.entries);

    console.log(`[Lorebook Studio] Loaded "${bookName}" with ${cachedEntries.length} entries`);
    return cachedEntries.length > 0;
  } catch (e) {
    console.error('[Lorebook Studio] Error loading world info:', e);
    loadedData = null;
    loadedBookName = null;
    cachedEntries = [];
    return false;
  }
}

/**
 * Get all entries from the currently loaded lorebook (synchronous).
 * Returns cached entries. Call loadBookData() first to populate the cache.
 */
export function getEntries(bookName: string): LorebookEntry[] {
  if (loadedBookName === bookName && cachedEntries.length > 0) {
    return cachedEntries;
  }

  // If asking for a different book or cache is empty, return empty
  // Caller should have called loadBookData() first
  if (loadedBookName !== bookName) {
    return [];
  }

  // Re-build from loaded data if cache was cleared
  if (loadedData && loadedData.entries) {
    cachedEntries = buildEntryList(loadedData.entries);
    return cachedEntries;
  }

  return [];
}

/**
 * Update specific fields on a lorebook entry.
 * Modifies the cached data and triggers a background save.
 */
export function updateEntry(
  bookName: string,
  uid: number,
  fields: Partial<LorebookEntry>,
): boolean {
  try {
    if (loadedBookName !== bookName || !loadedData || !loadedData.entries) {
      return false;
    }

    // Find the entry in the raw data by UID
    const entryKey = Object.keys(loadedData.entries).find(
      (k) => loadedData.entries[k].uid === uid,
    );
    if (!entryKey) return false;

    const entry = loadedData.entries[entryKey];

    // Apply field updates to the raw entry
    Object.assign(entry, fields);

    // Rebuild normalized cache
    cachedEntries = buildEntryList(loadedData.entries);

    // Fire-and-forget save to backend
    saveBookData(bookName);

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
    // Ensure data is loaded
    if (loadedBookName !== bookName || !loadedData) {
      const loaded = await loadBookData(bookName);
      if (!loaded && !loadedData) {
        // Create with empty entries if book is new/empty
        loadedData = { entries: {} };
        loadedBookName = bookName;
      }
    }

    if (!loadedData) return null;
    if (!loadedData.entries) {
      loadedData.entries = {};
    }

    // Calculate next UID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingUids = Object.values(loadedData.entries).map(
      (e: any) => (e as WorldInfoEntry).uid,
    );
    const maxUid = existingUids.length > 0 ? Math.max(...existingUids) : 0;
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

    loadedData.entries[String(newUid)] = newEntry;

    // Save to backend
    await saveBookData(bookName);

    // Rebuild cache
    cachedEntries = buildEntryList(loadedData.entries);

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
 * Modifies cache and triggers background save.
 */
export function deleteEntry(bookName: string, uid: number): boolean {
  try {
    if (loadedBookName !== bookName || !loadedData || !loadedData.entries) {
      return false;
    }

    const entryKey = Object.keys(loadedData.entries).find(
      (k) => loadedData.entries[k].uid === uid,
    );
    if (!entryKey) return false;

    delete loadedData.entries[entryKey];

    // Rebuild cache
    cachedEntries = buildEntryList(loadedData.entries);

    // Fire-and-forget save
    saveBookData(bookName);

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
  if (loadedBookName === bookName && cachedEntries.length > 0) {
    return cachedEntries;
  }
  return getEntries(bookName);
}

/**
 * Clear all caches (call when lorebook changes externally).
 */
export function clearCache(): void {
  loadedData = null;
  loadedBookName = null;
  cachedEntries = [];
}

// --- Internal helpers ---

/**
 * Build a normalized array of LorebookEntry from raw ST entry data.
 */
function buildEntryList(entries: Record<string, WorldInfoEntry>): LorebookEntry[] {
  return Object.values(entries).map((entry) => normalizeEntry(entry));
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
 * Save the current loaded data back to SillyTavern.
 */
async function saveBookData(bookName: string): Promise<void> {
  try {
    if (!loadedData) return;
    const ctx = SillyTavern.getContext();
    await ctx.saveWorldInfo(bookName, loadedData);
  } catch (e) {
    console.error('[Lorebook Studio] Error saving world info:', e);
  }
}
