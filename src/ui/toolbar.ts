/**
 * Toolbar event handling for search, filter, and controls.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { applySearchHighlight } from '../graph/graphManager';
import { getEntries } from '../data/lorebookData';
import { getEntryMeta, getCategories } from '../data/studioData';
import { getCurrentBookName } from './drawer';

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize toolbar event handlers.
 */
export function initToolbarEvents(): void {
  // Search input with debounce
  const searchInput = document.getElementById('ls-search-input') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      performSearch(searchInput.value.trim());
    }, 200);
  });

  // Clear search
  document.getElementById('ls-search-clear')?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      clearSearch();
    }
  });

  // Toggle filter buttons
  document.getElementById('ls-filter-orphans')?.addEventListener('click', (evt) => {
    (evt.currentTarget as HTMLElement).classList.toggle('active');
    applyFilters();
  });

  document.getElementById('ls-filter-disabled')?.addEventListener('click', (evt) => {
    (evt.currentTarget as HTMLElement).classList.toggle('active');
    applyFilters();
  });

  document.getElementById('ls-filter-pinned')?.addEventListener('click', (evt) => {
    (evt.currentTarget as HTMLElement).classList.toggle('active');
    applyFilters();
  });

  // Dropdown filters
  document.getElementById('ls-filter-category')?.addEventListener('change', () => {
    applyFilters();
  });

  document.getElementById('ls-filter-status')?.addEventListener('change', () => {
    applyFilters();
  });

  // Refresh category filter dropdown when categories change
  EventBus.on(STUDIO_EVENTS.CATEGORIES_CHANGED, () => {
    refreshCategoryFilter();
  });
}

/**
 * Refresh the category filter dropdown in the toolbar.
 */
export function refreshCategoryFilter(): void {
  const select = document.getElementById('ls-filter-category') as HTMLSelectElement | null;
  if (!select) return;

  const bookName = getCurrentBookName();
  if (!bookName) return;

  const currentValue = select.value;
  const categories = getCategories(bookName);

  select.innerHTML = '<option value="">All Categories</option><option value="__uncategorized__">Uncategorized</option>';
  for (const cat of categories) {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    select.appendChild(option);
  }

  select.value = currentValue;
}

/**
 * Perform search across entries (including tags and notes) and highlight matches.
 */
function performSearch(query: string): void {
  if (!query) {
    clearSearch();
    return;
  }

  const bookName = getCurrentBookName();
  if (!bookName) return;

  const entries = getEntries(bookName);
  const lowerQuery = query.toLowerCase();

  const matchingIds = new Set<string>();

  for (const entry of entries) {
    const meta = getEntryMeta(bookName, String(entry.uid));
    const searchableText = [
      entry.comment,
      entry.key.join(' '),
      entry.keysecondary.join(' '),
      entry.content,
      meta.tags.join(' '),
      meta.notes,
    ]
      .join(' ')
      .toLowerCase();

    if (searchableText.includes(lowerQuery)) {
      matchingIds.add(String(entry.uid));
    }
  }

  applySearchHighlight(matchingIds);
  EventBus.emit(STUDIO_EVENTS.SEARCH_CHANGED, { query, matchCount: matchingIds.size });
}

/**
 * Clear search highlighting.
 */
function clearSearch(): void {
  applySearchHighlight(new Set());
  EventBus.emit(STUDIO_EVENTS.SEARCH_CHANGED, { query: '', matchCount: 0 });
}

/**
 * Apply all active filters to the graph.
 */
function applyFilters(): void {
  const bookName = getCurrentBookName();
  if (!bookName) return;

  const orphansActive = document.getElementById('ls-filter-orphans')?.classList.contains('active');
  const disabledActive = document.getElementById('ls-filter-disabled')?.classList.contains('active');
  const pinnedActive = document.getElementById('ls-filter-pinned')?.classList.contains('active');
  const categoryValue = (document.getElementById('ls-filter-category') as HTMLSelectElement | null)?.value || '';
  const statusValue = (document.getElementById('ls-filter-status') as HTMLSelectElement | null)?.value || '';

  const hasAnyFilter = orphansActive || disabledActive || pinnedActive || categoryValue || statusValue;

  if (!hasAnyFilter) {
    applySearchHighlight(new Set());
    return;
  }

  const entries = getEntries(bookName);
  const matchingIds = new Set<string>();

  for (const entry of entries) {
    const uidStr = String(entry.uid);
    const meta = getEntryMeta(bookName, uidStr);
    let matches = true;

    // Orphan filter
    if (orphansActive) {
      const hasConnection = entries.some((other) => {
        if (other.uid === entry.uid) return false;
        return entry.key.some(
          (k) => k && other.content.toLowerCase().includes(k.toLowerCase()),
        ) || other.key.some(
          (k) => k && entry.content.toLowerCase().includes(k.toLowerCase()),
        );
      });
      if (hasConnection) matches = false;
    }

    // Disabled filter
    if (disabledActive && !entry.disable) {
      matches = false;
    }

    // Pinned filter
    if (pinnedActive && !meta.pinned) {
      matches = false;
    }

    // Category filter
    if (categoryValue) {
      if (categoryValue === '__uncategorized__') {
        if (meta.categoryId) matches = false;
      } else {
        if (meta.categoryId !== categoryValue) matches = false;
      }
    }

    // Status filter
    if (statusValue) {
      if (meta.status !== statusValue) matches = false;
    }

    if (matches) {
      matchingIds.add(uidStr);
    }
  }

  applySearchHighlight(matchingIds);
}
