/**
 * Studio metadata management for Lorebook Studio.
 * Handles categories, tags, notes, status, pins, and color overrides.
 * All data is stored in extension settings per-lorebook.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';
import {
  getSettings, saveSettings,
  StudioData, CategoryDef, EntryMeta, EntryStatus,
} from '../utils/settings';

export type { CategoryDef, EntryMeta, EntryStatus };

const DEFAULT_ENTRY_META: EntryMeta = {
  categoryId: null,
  tags: [],
  notes: '',
  status: null,
  pinned: false,
  colorOverride: null,
};

function generateId(): string {
  return 'cat-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Get the full studio data for a lorebook (creates if missing).
 */
export function getStudioData(bookName: string): StudioData {
  const settings = getSettings();
  if (!settings.studioData[bookName]) {
    settings.studioData[bookName] = { categories: [], entryMeta: {} };
  }
  return settings.studioData[bookName];
}

/**
 * Get metadata for a specific entry (returns defaults if none set).
 */
export function getEntryMeta(bookName: string, uid: string): EntryMeta {
  const data = getStudioData(bookName);
  return data.entryMeta[uid] || { ...DEFAULT_ENTRY_META };
}

/**
 * Update metadata for a specific entry.
 */
export function updateEntryMeta(
  bookName: string,
  uid: string,
  partial: Partial<EntryMeta>,
): void {
  const data = getStudioData(bookName);
  if (!data.entryMeta[uid]) {
    data.entryMeta[uid] = { ...DEFAULT_ENTRY_META };
  }
  Object.assign(data.entryMeta[uid], partial);
  saveSettings();
  EventBus.emit(STUDIO_EVENTS.STUDIO_META_UPDATED, { bookName, uid });
}

/**
 * Remove metadata for a deleted entry.
 */
export function cleanupEntryMeta(bookName: string, uid: string): void {
  const data = getStudioData(bookName);
  delete data.entryMeta[uid];
  saveSettings();
}

// --- Categories ---

/**
 * Get all categories for a lorebook.
 */
export function getCategories(bookName: string): CategoryDef[] {
  return getStudioData(bookName).categories;
}

/**
 * Add a new category.
 */
export function addCategory(
  bookName: string,
  name: string,
  color: string,
): CategoryDef {
  const data = getStudioData(bookName);
  const cat: CategoryDef = { id: generateId(), name, color };
  data.categories.push(cat);
  saveSettings();
  EventBus.emit(STUDIO_EVENTS.CATEGORIES_CHANGED, { bookName });
  return cat;
}

/**
 * Update a category's name or color.
 */
export function updateCategory(
  bookName: string,
  id: string,
  partial: Partial<Omit<CategoryDef, 'id'>>,
): void {
  const data = getStudioData(bookName);
  const cat = data.categories.find((c) => c.id === id);
  if (!cat) return;
  Object.assign(cat, partial);
  saveSettings();
  EventBus.emit(STUDIO_EVENTS.CATEGORIES_CHANGED, { bookName });
}

/**
 * Delete a category and clear it from all entries using it.
 */
export function deleteCategory(bookName: string, id: string): void {
  const data = getStudioData(bookName);
  data.categories = data.categories.filter((c) => c.id !== id);
  // Clear category from entries that had it
  for (const meta of Object.values(data.entryMeta)) {
    if (meta.categoryId === id) {
      meta.categoryId = null;
    }
  }
  saveSettings();
  EventBus.emit(STUDIO_EVENTS.CATEGORIES_CHANGED, { bookName });
}

/**
 * Get a category by ID.
 */
export function getCategoryById(
  bookName: string,
  id: string,
): CategoryDef | undefined {
  return getStudioData(bookName).categories.find((c) => c.id === id);
}

// --- Tags ---

/**
 * Collect all unique tags across all entries in a lorebook.
 */
export function getAllTags(bookName: string): string[] {
  const data = getStudioData(bookName);
  const tags = new Set<string>();
  for (const meta of Object.values(data.entryMeta)) {
    for (const tag of meta.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}
