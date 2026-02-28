/**
 * Full-page drawer component for Lorebook Studio.
 * Opens as a full-viewport overlay with fade/scale animation.
 */

import drawerHtml from '../templates/drawer.html';
import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { getEntries, getWorldInfoBookNames, getActiveBookName, loadBookData } from '../data/lorebookData';
import { detectRecursions, clearRecursionCache } from '../data/recursionDetector';
import { getManualLinks } from '../data/manualLinks';
import { initGraph, destroyGraph, refreshGraph, runLayout, fitGraph, zoomIn, zoomOut, toggleAutoEdges, toggleManualEdges, setViewMode, getViewMode, setAutoOrbit, getAutoOrbit, getGraph, resizeGraph } from '../graph/graphManager';
import { LayoutName } from '../graph/layouts';
import { getSettings, updateSettings, ThemeName } from '../utils/settings';
import { initToolbarEvents } from './toolbar';
import { initSidebar, closeSidebar } from './sidebar';
import { initStatsPanel } from './statsPanel';
import { initContextMenu } from './contextMenu';
import { initCategoryManager } from './categoryManager';
import { initConnectMode, exitConnectMode, isConnectModeActive } from './connectMode';
import { getSelectedNodeUid } from '../graph/graphManager';
import { deleteEntryById, duplicateEntryById } from '../features/entryCrud';
import { focusNode } from '../graph/graphManager';
import { getEntryMeta, getCategoryById } from '../data/studioData';

let isOpen = false;
let currentBookName: string | null = null;
let drawerElement: HTMLElement | null = null;
let entryListVisible = false;

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
      // Priority: popover > connect mode > sidebar > drawer
      if (closeAllPopovers()) return;
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

  // View mode toggle
  const viewModeBtn = document.getElementById('ls-btn-view-mode');
  viewModeBtn?.addEventListener('click', () => {
    const current = getViewMode();
    const next = current === 'cards' ? 'sprites' : 'cards';
    setViewMode(next);
    viewModeBtn.classList.toggle('active', next === 'sprites');
  });

  // Auto-orbit toggle
  const orbitBtn = document.getElementById('ls-btn-auto-orbit');
  if (orbitBtn) {
    // Restore saved state
    const savedOrbit = getSettings().autoOrbit;
    if (savedOrbit) orbitBtn.classList.add('active');
    orbitBtn.addEventListener('click', () => {
      const next = !getAutoOrbit();
      setAutoOrbit(next);
      updateSettings({ autoOrbit: next });
      orbitBtn.classList.toggle('active', next);
    });
  }

  // Theme selector
  const themeSelector = document.getElementById('ls-theme-selector') as HTMLSelectElement | null;
  if (themeSelector) {
    // Restore saved theme
    const savedTheme = getSettings().theme || 'midnight';
    themeSelector.value = savedTheme;
    applyTheme(savedTheme);
    themeSelector.addEventListener('change', () => {
      const theme = themeSelector.value as ThemeName;
      applyTheme(theme);
      updateSettings({ theme });
    });
  }

  // Entry list toggle
  document.getElementById('ls-btn-entry-list')?.addEventListener('click', () => {
    toggleEntryList();
  });

  // Initialize popovers
  initPopovers();

  // Initialize sub-components
  initToolbarEvents();
  initSidebar();
  initStatsPanel();
  initContextMenu();
  initCategoryManager();
  initConnectMode();

  // Listen for internal events that require graph refresh
  EventBus.on(STUDIO_EVENTS.ENTRY_UPDATED, () => {
    refreshCurrentGraph();
    renderEntryList();
  });
  EventBus.on(STUDIO_EVENTS.ENTRY_CREATED, () => {
    refreshCurrentGraph();
    renderEntryList();
  });
  EventBus.on(STUDIO_EVENTS.ENTRY_DELETED, () => {
    closeSidebar();
    refreshCurrentGraph();
    renderEntryList();
  });
  EventBus.on(STUDIO_EVENTS.MANUAL_LINK_ADDED, () => refreshCurrentGraph());
  EventBus.on(STUDIO_EVENTS.MANUAL_LINK_REMOVED, () => refreshCurrentGraph());
  EventBus.on(STUDIO_EVENTS.STUDIO_META_UPDATED, () => {
    refreshCurrentGraph();
    renderEntryList();
  });
  EventBus.on(STUDIO_EVENTS.CATEGORIES_CHANGED, () => {
    refreshCurrentGraph();
    renderEntryList();
  });

  // Listen for node selection to highlight in entry list
  EventBus.on(STUDIO_EVENTS.NODE_SELECTED, (data: unknown) => {
    const uid = (data as { uid: string })?.uid;
    if (uid) updateEntryListSelection(uid);
  });
  EventBus.on(STUDIO_EVENTS.NODE_DESELECTED, () => {
    updateEntryListSelection(null);
  });
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
    setTimeout(() => loadBook(activeName), 300);
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
  closeAllPopovers();

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

// --- Popover management ---

function initPopovers(): void {
  // Each button with data-popover toggles its target popover
  const drawer = document.getElementById('ls-drawer');
  if (!drawer) return;

  const popoverBtns = drawer.querySelectorAll<HTMLButtonElement>('[data-popover]');
  for (const btn of popoverBtns) {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const targetId = btn.getAttribute('data-popover');
      if (!targetId) return;
      const popover = document.getElementById(targetId);
      if (!popover) return;

      const isVisible = !popover.classList.contains('ls-hidden');

      // Close all other popovers first
      closeAllPopovers();

      // Toggle this one
      if (!isVisible) {
        popover.classList.remove('ls-hidden');
        btn.classList.add('active');
      }
    });
  }

  // Click-outside closes all popovers
  document.addEventListener('click', (evt) => {
    if (!isOpen) return;
    const target = evt.target as HTMLElement;
    // Don't close if clicking inside a popover
    if (target.closest('.ls-ltb-popover')) return;
    // Don't close if clicking a popover trigger button
    if (target.closest('[data-popover]')) return;
    closeAllPopovers();
  });
}

function closeAllPopovers(): boolean {
  const drawer = document.getElementById('ls-drawer');
  if (!drawer) return false;
  const popovers = drawer.querySelectorAll<HTMLElement>('.ls-ltb-popover');
  let hadOpen = false;
  for (const pop of popovers) {
    if (!pop.classList.contains('ls-hidden')) {
      pop.classList.add('ls-hidden');
      hadOpen = true;
    }
  }
  // Also deactivate trigger buttons
  const btns = drawer.querySelectorAll<HTMLButtonElement>('[data-popover]');
  for (const btn of btns) {
    btn.classList.remove('active');
  }
  return hadOpen;
}

// --- Entry list panel ---

function toggleEntryList(): void {
  const panel = document.getElementById('ls-entry-list-panel');
  const btn = document.getElementById('ls-btn-entry-list');
  if (!panel) return;

  entryListVisible = !entryListVisible;
  panel.classList.toggle('ls-hidden', !entryListVisible);
  btn?.classList.toggle('active', entryListVisible);

  if (entryListVisible) {
    renderEntryList();
  }

  // Resize graph after CSS transition
  setTimeout(() => resizeGraph(), 300);
}

function renderEntryList(): void {
  if (!entryListVisible || !currentBookName) return;

  const body = document.getElementById('ls-entry-list-body');
  const countEl = document.getElementById('ls-entry-list-count');
  if (!body) return;

  const entries = getEntries(currentBookName);
  if (countEl) countEl.textContent = String(entries.length);

  const selectedUid = getSelectedNodeUid();
  const fragment = document.createDocumentFragment();

  for (const entry of entries) {
    const uidStr = String(entry.uid);
    const meta = getEntryMeta(currentBookName, uidStr);
    const category = meta.categoryId ? getCategoryById(currentBookName, meta.categoryId) : undefined;
    const color = meta.colorOverride || (category ? category.color : 'var(--ls-node-enabled)');

    const item = document.createElement('div');
    item.className = 'ls-entry-list-item';
    item.dataset.uid = uidStr;
    if (entry.disable) item.classList.add('ls-disabled-entry');
    if (selectedUid !== null && String(selectedUid) === uidStr) {
      item.classList.add('ls-active');
    }

    const dot = document.createElement('span');
    dot.className = 'ls-entry-list-dot';
    dot.style.background = color;

    const name = document.createElement('span');
    name.className = 'ls-entry-list-name';
    name.textContent = entry.comment || `Entry ${entry.uid}`;

    item.appendChild(dot);
    item.appendChild(name);

    item.addEventListener('click', () => {
      focusNode(uidStr);
      // Emit NODE_SELECTED which triggers sidebar to open + load entry
      EventBus.emit(STUDIO_EVENTS.NODE_SELECTED, { uid: entry.uid, bookName: currentBookName });
    });

    fragment.appendChild(item);
  }

  body.innerHTML = '';
  body.appendChild(fragment);
}

function updateEntryListSelection(uid: string | null): void {
  const body = document.getElementById('ls-entry-list-body');
  if (!body) return;

  const items = body.querySelectorAll<HTMLElement>('.ls-entry-list-item');
  for (const item of items) {
    item.classList.toggle('ls-active', item.dataset.uid === uid);
  }

  // Scroll into view
  if (uid) {
    const active = body.querySelector<HTMLElement>(`.ls-entry-list-item[data-uid="${uid}"]`);
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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
    renderEntryList();
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

  // Render entry list if visible
  renderEntryList();
}

function refreshCurrentGraph(): void {
  if (!currentBookName) return;

  // Use cached data (already updated by updateEntry/createEntry/deleteEntry)
  // Do NOT re-load from backend — that races with the fire-and-forget save
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

// --- Theme support ---

const THEME_BACKGROUNDS: Record<ThemeName, string> = {
  midnight: '#13111c',
  nebula: '#0f0a1a',
  ember: '#161010',
  arctic: '#0a1218',
};

function applyTheme(theme: ThemeName): void {
  const drawer = document.getElementById('ls-drawer');
  if (!drawer) return;

  // "midnight" is the default — remove data-theme to use :root vars
  if (theme === 'midnight') {
    drawer.removeAttribute('data-theme');
  } else {
    drawer.setAttribute('data-theme', theme);
  }

  // Update the 3D graph background color (set programmatically by 3d-force-graph)
  const graph = getGraph();
  if (graph) {
    graph.backgroundColor(THEME_BACKGROUNDS[theme] || THEME_BACKGROUNDS.midnight);
  }
}
