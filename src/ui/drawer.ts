/**
 * Full-page drawer component for Lorebook Studio.
 * Slides in from the right side of the viewport.
 */

import drawerHtml from '../templates/drawer.html';
import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { getEntries, getWorldInfoBookNames, getActiveBookName, loadBookData } from '../data/lorebookData';
import { detectRecursions, clearRecursionCache } from '../data/recursionDetector';
import { getManualLinks } from '../data/manualLinks';
import { initGraph, destroyGraph, refreshGraph, runLayout, fitGraph, zoomIn, zoomOut, toggleAutoEdges, toggleManualEdges } from '../graph/graphManager';
import { LayoutName } from '../graph/layouts';
import { initToolbarEvents } from './toolbar';
import { initSidebar, openSidebar, closeSidebar } from './sidebar';
import { initStatsPanel } from './statsPanel';
import { initContextMenu } from './contextMenu';
import { initConnectMode, exitConnectMode, isConnectModeActive } from './connectMode';
import { getSelectedNodeUid } from '../graph/graphManager';
import { deleteEntryById, duplicateEntryById } from '../features/entryCrud';
import { focusNode } from '../graph/graphManager';

let isOpen = false;
let currentBookName: string | null = null;
let drawerElement: HTMLElement | null = null;

/**
 * Initialize the drawer: inject HTML into the DOM and set up events.
 */
export function initDrawer(): void {
  // Inject drawer HTML into body
  const wrapper = document.createElement('div');
  wrapper.innerHTML = drawerHtml;
  const overlay = wrapper.firstElementChild as HTMLElement;
  document.body.appendChild(overlay);
  drawerElement = overlay;

  // Set up close handlers
  const closeBtn = document.getElementById('ls-btn-close');
  closeBtn?.addEventListener('click', closeDrawer);

  // Close on overlay backdrop click
  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) {
      closeDrawer();
    }
  });

  // Keyboard shortcuts (only when drawer is open)
  document.addEventListener('keydown', (evt) => {
    if (!isOpen) return;

    if (evt.key === 'Escape') {
      // Priority: connect mode > sidebar > drawer
      if (isConnectModeActive()) {
        exitConnectMode();
      } else {
        const sidebar = document.getElementById('ls-sidebar');
        if (sidebar && !sidebar.classList.contains('ls-sidebar-hidden')) {
          closeSidebar();
        } else {
          closeDrawer();
        }
      }
      return;
    }

    // Delete selected node
    if (evt.key === 'Delete' && !isConnectModeActive()) {
      const uid = getSelectedNodeUid();
      if (uid !== null && currentBookName) {
        const entries = getEntries(currentBookName);
        const entry = entries.find((e) => e.uid === uid);
        const name = entry?.comment || `Entry ${uid}`;
        if (confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) {
          deleteEntryById(currentBookName, uid);
        }
      }
      return;
    }

    // Ctrl+D: duplicate selected node
    if (evt.key === 'd' && (evt.ctrlKey || evt.metaKey) && !isConnectModeActive()) {
      evt.preventDefault();
      const uid = getSelectedNodeUid();
      if (uid !== null && currentBookName) {
        duplicateEntryById(currentBookName, uid).then((newEntry) => {
          if (newEntry) focusNode(String(newEntry.uid));
        });
      }
      return;
    }
  });

  // Book selector change
  const bookSelector = document.getElementById('ls-book-selector') as HTMLSelectElement | null;
  bookSelector?.addEventListener('change', () => {
    const selected = bookSelector.value;
    if (selected) {
      loadBook(selected);
    }
  });

  // Layout selector
  const layoutSelector = document.getElementById('ls-layout-selector') as HTMLSelectElement | null;
  layoutSelector?.addEventListener('change', () => {
    const layout = layoutSelector.value as LayoutName;
    runLayout(layout);
  });

  // Zoom controls
  document.getElementById('ls-zoom-in')?.addEventListener('click', zoomIn);
  document.getElementById('ls-zoom-out')?.addEventListener('click', zoomOut);
  document.getElementById('ls-zoom-fit')?.addEventListener('click', fitGraph);

  // Link visibility toggles
  const autoToggle = document.getElementById('ls-toggle-auto-links') as HTMLInputElement | null;
  autoToggle?.addEventListener('change', () => {
    toggleAutoEdges(autoToggle.checked);
  });

  const manualToggle = document.getElementById('ls-toggle-manual-links') as HTMLInputElement | null;
  manualToggle?.addEventListener('change', () => {
    toggleManualEdges(manualToggle.checked);
  });

  // Add entry button
  document.getElementById('ls-btn-add-entry')?.addEventListener('click', () => {
    EventBus.emit('ls:create-entry-request', { bookName: currentBookName });
  });

  // Initialize sub-components
  initToolbarEvents();
  initSidebar();
  initStatsPanel();
  initContextMenu();
  initConnectMode();

  // Listen for internal events that require graph refresh
  EventBus.on(STUDIO_EVENTS.ENTRY_UPDATED, () => refreshCurrentGraph());
  EventBus.on(STUDIO_EVENTS.ENTRY_CREATED, () => refreshCurrentGraph());
  EventBus.on(STUDIO_EVENTS.ENTRY_DELETED, () => {
    closeSidebar();
    refreshCurrentGraph();
  });
  EventBus.on(STUDIO_EVENTS.MANUAL_LINK_ADDED, () => refreshCurrentGraph());
  EventBus.on(STUDIO_EVENTS.MANUAL_LINK_REMOVED, () => refreshCurrentGraph());
}

/**
 * Open the drawer and load the active lorebook.
 */
export function openDrawer(): void {
  if (!drawerElement) return;

  // Populate book selector
  populateBookSelector();

  // Open animation
  drawerElement.classList.add('ls-open');
  isOpen = true;
  document.body.style.overflow = 'hidden';

  // Load the active book or the previously selected one
  const activeName = currentBookName || getActiveBookName();
  if (activeName) {
    const bookSelector = document.getElementById('ls-book-selector') as HTMLSelectElement | null;
    if (bookSelector) {
      bookSelector.value = activeName;
    }
    // Wait for drawer animation to finish before initializing graph
    setTimeout(() => loadBook(activeName), 350);
  }

  EventBus.emit(STUDIO_EVENTS.DRAWER_OPENED);
}

/**
 * Close the drawer and clean up.
 */
export function closeDrawer(): void {
  if (!drawerElement) return;

  drawerElement.classList.remove('ls-open');
  isOpen = false;
  document.body.style.overflow = '';

  // Destroy graph to free resources
  destroyGraph();
  closeSidebar();

  EventBus.emit(STUDIO_EVENTS.DRAWER_CLOSED);
}

/**
 * Check if the drawer is currently open.
 */
export function isDrawerOpen(): boolean {
  return isOpen;
}

/**
 * Get the current book name being viewed.
 */
export function getCurrentBookName(): string | null {
  return currentBookName;
}

/**
 * Inject the "Open Lorebook Studio" button into SillyTavern's World Info panel.
 */
export function injectTriggerButton(): void {
  // Try to find the World Info panel header to inject our button
  const tryInject = () => {
    // Look for the world info header area
    const wiHeader = document.getElementById('WorldInfo');
    const wiPanel = wiHeader || document.querySelector('.world_info_header');
    const target = wiPanel || document.querySelector('#world_info_button_bar');

    if (target) {
      // Check if button already exists
      if (document.getElementById('ls-open-studio-btn')) return;

      const btn = document.createElement('button');
      btn.id = 'ls-open-studio-btn';
      btn.title = 'Open Lorebook Studio';
      btn.innerHTML = '<span>Lorebook Studio</span>';
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        openDrawer();
      });

      target.appendChild(btn);
      return true;
    }
    return false;
  };

  // Try immediately, then retry with observer if not found
  if (!tryInject()) {
    const observer = new MutationObserver(() => {
      if (tryInject()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Safety timeout: stop observing after 30 seconds
    setTimeout(() => observer.disconnect(), 30000);
  }
}

// --- Internal helpers ---

function populateBookSelector(): void {
  const selector = document.getElementById('ls-book-selector') as HTMLSelectElement | null;
  if (!selector) return;

  const bookNames = getWorldInfoBookNames();
  const currentValue = selector.value;

  // Clear existing options (keep the placeholder)
  selector.innerHTML = '<option value="">-- Select Lorebook --</option>';

  for (const name of bookNames) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    selector.appendChild(option);
  }

  // Restore selection
  if (currentValue && bookNames.includes(currentValue)) {
    selector.value = currentValue;
  }
}

async function loadBook(bookName: string): Promise<void> {
  currentBookName = bookName;
  clearRecursionCache();

  const container = document.getElementById('ls-graph-container');
  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div class="ls-empty-state">
      <p>Loading "${bookName}"...</p>
    </div>
  `;

  // Load data from SillyTavern's API
  await loadBookData(bookName);
  const entries = getEntries(bookName);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="ls-empty-state">
        <p>No entries found in "${bookName}"</p>
        <p>Create a new entry to get started.</p>
      </div>
    `;
    return;
  }

  // Clear any empty state
  const emptyState = container.querySelector('.ls-empty-state');
  if (emptyState) emptyState.remove();

  const recursionEdges = detectRecursions(entries);
  const manualLinksList = getManualLinks(bookName);

  initGraph(container, entries, recursionEdges, manualLinksList, bookName);

  // Update status bar
  updateStatusBar(`Loaded "${bookName}"`, `${entries.length} entries`);
}

async function refreshCurrentGraph(): Promise<void> {
  if (!currentBookName) return;

  // Re-load fresh data from ST
  await loadBookData(currentBookName);
  const entries = getEntries(currentBookName);
  clearRecursionCache();
  const recursionEdges = detectRecursions(entries);
  const manualLinksList = getManualLinks(currentBookName);

  refreshGraph(entries, recursionEdges, manualLinksList);

  // Update entry count in status bar
  updateStatusBar(undefined, `${entries.length} entries`);
}

function updateStatusBar(text?: string, count?: string): void {
  if (text !== undefined) {
    const statusText = document.getElementById('ls-status-text');
    if (statusText) statusText.textContent = text;
  }
  if (count !== undefined) {
    const entryCount = document.getElementById('ls-entry-count');
    if (entryCount) entryCount.textContent = count;
  }
}
