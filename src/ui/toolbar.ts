/**
 * Toolbar event handling for search, filter, and controls.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { applySearchHighlight } from '../graph/graphManager';
import { getEntries } from '../data/lorebookData';
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

  // Filter buttons
  document.getElementById('ls-filter-orphans')?.addEventListener('click', (evt) => {
    const btn = evt.currentTarget as HTMLElement;
    btn.classList.toggle('active');
    applyFilters();
  });

  document.getElementById('ls-filter-disabled')?.addEventListener('click', (evt) => {
    const btn = evt.currentTarget as HTMLElement;
    btn.classList.toggle('active');
    applyFilters();
  });
}

/**
 * Perform search across entries and highlight matches in graph.
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
    const searchableText = [
      entry.comment,
      entry.key.join(' '),
      entry.keysecondary.join(' '),
      entry.content,
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
 * Apply active filter buttons to the graph.
 */
function applyFilters(): void {
  const bookName = getCurrentBookName();
  if (!bookName) return;

  const orphansActive = document.getElementById('ls-filter-orphans')?.classList.contains('active');
  const disabledActive = document.getElementById('ls-filter-disabled')?.classList.contains('active');

  if (!orphansActive && !disabledActive) {
    // No filters active, clear highlighting
    applySearchHighlight(new Set());
    return;
  }

  const entries = getEntries(bookName);
  const matchingIds = new Set<string>();

  // For orphan detection, we need edge info - use a simple approach
  // checking if any entry references another's keys
  for (const entry of entries) {
    let matches = true;

    if (orphansActive) {
      // Check if this entry has any connections (simplified check)
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

    if (disabledActive && !entry.disable) {
      matches = false;
    }

    if (matches) {
      matchingIds.add(String(entry.uid));
    }
  }

  applySearchHighlight(matchingIds);
}
