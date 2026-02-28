/**
 * Sidebar panel for entry editing in Lorebook Studio.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { LorebookEntry, getEntries, updateEntry, deleteEntry, createEntry } from '../data/lorebookData';
import {
  getEntryMeta, updateEntryMeta, getCategories, getAllTags,
} from '../data/studioData';
import { EntryMeta, EntryStatus } from '../utils/settings';
import { focusNode, resizeGraph } from '../graph/graphManager';
import { getCurrentBookName } from './drawer';
import { escapeHtml } from '../utils/domHelpers';

let selectedEntry: LorebookEntry | null = null;
let originalEntry: LorebookEntry | null = null;
let currentTags: string[] = [];

// Resize state
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH_RATIO = 0.6;

/**
 * Initialize sidebar events.
 */
export function initSidebar(): void {
  EventBus.on(STUDIO_EVENTS.NODE_SELECTED, (data: unknown) => {
    const { uid, bookName } = data as { uid: number; bookName: string };
    loadEntryIntoSidebar(uid, bookName);
    openSidebar();
  });

  EventBus.on(STUDIO_EVENTS.NODE_DESELECTED, () => {
    closeSidebar();
  });

  document.getElementById('ls-sidebar-close')?.addEventListener('click', closeSidebar);
  document.getElementById('ls-btn-save-entry')?.addEventListener('click', saveEntry);
  document.getElementById('ls-btn-revert-entry')?.addEventListener('click', revertEntry);
  document.getElementById('ls-btn-duplicate-entry')?.addEventListener('click', duplicateEntry);
  document.getElementById('ls-btn-delete-entry')?.addEventListener('click', deleteCurrentEntry);

  initTagInput();
  initResizeHandle();

  // Refresh category dropdown when categories change
  EventBus.on(STUDIO_EVENTS.CATEGORIES_CHANGED, () => {
    const bookName = getCurrentBookName();
    if (bookName && selectedEntry) {
      populateCategoryDropdown(bookName);
    }
  });

  EventBus.on('ls:create-entry-request', async (data: unknown) => {
    const { bookName } = data as { bookName: string };
    if (!bookName) return;

    const newEntry = await createEntry(bookName);
    if (newEntry) {
      loadEntryIntoSidebar(newEntry.uid, bookName);
      openSidebar();
      focusNode(String(newEntry.uid));
    }
  });
}

/**
 * Open the sidebar panel.
 */
export function openSidebar(): void {
  const sidebar = document.getElementById('ls-sidebar');
  sidebar?.classList.remove('ls-sidebar-hidden');
  setTimeout(() => resizeGraph(), 350);
}

/**
 * Close the sidebar panel.
 */
export function closeSidebar(): void {
  const sidebar = document.getElementById('ls-sidebar');
  if (sidebar) {
    // Clear any inline width from resize dragging so the CSS class can take effect
    sidebar.style.width = '';
    sidebar.classList.add('ls-sidebar-hidden');
  }
  selectedEntry = null;
  originalEntry = null;
  currentTags = [];
  setTimeout(() => resizeGraph(), 350);
}

// --- Internal ---

function loadEntryIntoSidebar(uid: number, bookName: string): void {
  const entries = getEntries(bookName);
  const entry = entries.find((e) => e.uid === uid);
  if (!entry) return;

  selectedEntry = { ...entry };
  originalEntry = { ...entry };

  const titleEl = document.getElementById('ls-sidebar-title');
  if (titleEl) titleEl.textContent = entry.comment || `Entry ${entry.uid}`;

  setInputValue('ls-entry-comment', entry.comment);
  setInputValue('ls-entry-keys', entry.key.join(', '));
  setInputValue('ls-entry-keysecondary', entry.keysecondary.join(', '));
  setSelectValue('ls-entry-selective-logic', String(entry.selectiveLogic));
  setTextareaValue('ls-entry-content', entry.content);
  setSelectValue('ls-entry-position', String(entry.position));
  setInputValue('ls-entry-depth', String(entry.depth));
  setInputValue('ls-entry-order', String(entry.order));
  setInputValue('ls-entry-probability', String(entry.probability));
  setNullableNumber('ls-entry-scan-depth', entry.scanDepth);
  setInputValue('ls-entry-automation-id', entry.automationId);
  setInputValue('ls-entry-group', entry.group);
  setInputValue('ls-entry-group-weight', String(entry.groupWeight));
  setCheckbox('ls-entry-enabled', !entry.disable);
  setCheckbox('ls-entry-constant', entry.constant);
  setCheckbox('ls-entry-selective', entry.selective);
  setCheckbox('ls-entry-case-sensitive', entry.caseSensitive === true);
  setCheckbox('ls-entry-match-whole-words', entry.matchWholeWords === true);
  setCheckbox('ls-entry-use-group-scoring', entry.useGroupScoring === true);
  setCheckbox('ls-entry-exclude-recursion', entry.excludeRecursion);
  setCheckbox('ls-entry-prevent-recursion', entry.preventRecursion);
  setCheckbox('ls-entry-delay-until-recursion', entry.delayUntilRecursion);
  setCheckbox('ls-entry-group-override', entry.groupOverride);
  setNullableNumber('ls-entry-sticky', entry.sticky);
  setNullableNumber('ls-entry-cooldown', entry.cooldown);
  setNullableNumber('ls-entry-delay', entry.delay);

  populateStudioSection(uid, bookName);
}

function populateStudioSection(uid: number, bookName: string): void {
  const meta = getEntryMeta(bookName, String(uid));

  populateCategoryDropdown(bookName);
  setSelectValue('ls-entry-category', meta.categoryId || '');

  currentTags = [...meta.tags];
  renderTags();

  setSelectValue('ls-entry-status', meta.status || '');
  setCheckbox('ls-entry-pinned', meta.pinned);
  setTextareaValue('ls-entry-notes', meta.notes);

  const colorEnabled = meta.colorOverride !== null;
  setCheckbox('ls-entry-color-enabled', colorEnabled);
  const colorInput = document.getElementById('ls-entry-color-override') as HTMLInputElement | null;
  if (colorInput) {
    colorInput.value = meta.colorOverride || '#5a52a0';
    colorInput.disabled = !colorEnabled;
  }
}

function populateCategoryDropdown(bookName: string): void {
  const select = document.getElementById('ls-entry-category') as HTMLSelectElement | null;
  if (!select) return;

  const currentValue = select.value;
  const categories = getCategories(bookName);

  select.innerHTML = '<option value="">-- None --</option>';
  for (const cat of categories) {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    option.style.borderLeft = `4px solid ${cat.color}`;
    select.appendChild(option);
  }

  select.value = currentValue;
}

function saveEntry(): void {
  if (!selectedEntry) return;
  const bookName = getCurrentBookName();
  if (!bookName) return;

  const comment = getInputValue('ls-entry-comment');
  const keysStr = getInputValue('ls-entry-keys');
  const keysecondaryStr = getInputValue('ls-entry-keysecondary');
  const selectiveLogic = parseInt(getSelectValue('ls-entry-selective-logic') || '0');
  const content = getTextareaValue('ls-entry-content');
  const position = parseInt(getSelectValue('ls-entry-position') || '0');
  const depth = parseInt(getInputValue('ls-entry-depth') || '4');
  const order = parseInt(getInputValue('ls-entry-order') || '100');
  const probability = parseInt(getInputValue('ls-entry-probability') || '100');
  const scanDepth = getNullableNumber('ls-entry-scan-depth');
  const automationId = getInputValue('ls-entry-automation-id');
  const group = getInputValue('ls-entry-group');
  const groupWeight = parseInt(getInputValue('ls-entry-group-weight') || '100');
  const enabled = getCheckbox('ls-entry-enabled');
  const constant = getCheckbox('ls-entry-constant');
  const selective = getCheckbox('ls-entry-selective');
  const caseSensitive = getCheckbox('ls-entry-case-sensitive') || null;
  const matchWholeWords = getCheckbox('ls-entry-match-whole-words') || null;
  const useGroupScoring = getCheckbox('ls-entry-use-group-scoring') || null;
  const excludeRecursion = getCheckbox('ls-entry-exclude-recursion');
  const preventRecursion = getCheckbox('ls-entry-prevent-recursion');
  const delayUntilRecursion = getCheckbox('ls-entry-delay-until-recursion');
  const groupOverride = getCheckbox('ls-entry-group-override');
  const sticky = getNullableNumber('ls-entry-sticky');
  const cooldown = getNullableNumber('ls-entry-cooldown');
  const delay = getNullableNumber('ls-entry-delay');

  const fields: Partial<LorebookEntry> = {
    comment,
    key: keysStr.split(',').map((k) => k.trim()).filter(Boolean),
    keysecondary: keysecondaryStr.split(',').map((k) => k.trim()).filter(Boolean),
    selectiveLogic,
    content, position, depth, order, probability, group,
    groupWeight, scanDepth, automationId,
    caseSensitive, matchWholeWords, useGroupScoring,
    disable: !enabled, constant, selective, excludeRecursion, preventRecursion,
    delayUntilRecursion, groupOverride,
    sticky, cooldown, delay,
  };

  const success = updateEntry(bookName, selectedEntry.uid, fields);
  if (success) {
    originalEntry = { ...selectedEntry, ...fields };
    selectedEntry = { ...originalEntry };

    saveStudioMeta(bookName, selectedEntry.uid);

    const titleEl = document.getElementById('ls-sidebar-title');
    if (titleEl) {
      titleEl.textContent = 'Saved!';
      setTimeout(() => {
        titleEl.textContent = comment || `Entry ${selectedEntry?.uid}`;
      }, 1000);
    }
  }
}

function saveStudioMeta(bookName: string, uid: number): void {
  const categoryId = getSelectValue('ls-entry-category') || null;
  const status = (getSelectValue('ls-entry-status') || null) as EntryStatus | null;
  const pinned = getCheckbox('ls-entry-pinned');
  const notes = getTextareaValue('ls-entry-notes');
  const colorEnabled = getCheckbox('ls-entry-color-enabled');
  const colorValue = (document.getElementById('ls-entry-color-override') as HTMLInputElement | null)?.value || '#5a52a0';

  const meta: Partial<EntryMeta> = {
    categoryId,
    tags: [...currentTags],
    notes, status, pinned,
    colorOverride: colorEnabled ? colorValue : null,
  };

  updateEntryMeta(bookName, String(uid), meta);
}

function revertEntry(): void {
  if (!originalEntry) return;
  const bookName = getCurrentBookName();
  if (!bookName) return;
  loadEntryIntoSidebar(originalEntry.uid, bookName);
}

async function duplicateEntry(): Promise<void> {
  if (!selectedEntry) return;
  const bookName = getCurrentBookName();
  if (!bookName) return;

  const newEntry = await createEntry(bookName);
  if (!newEntry) return;

  const fields: Partial<LorebookEntry> = {
    comment: (selectedEntry.comment || 'Entry') + ' (copy)',
    key: [...selectedEntry.key],
    keysecondary: [...selectedEntry.keysecondary],
    selectiveLogic: selectedEntry.selectiveLogic,
    content: selectedEntry.content,
    position: selectedEntry.position,
    depth: selectedEntry.depth,
    order: selectedEntry.order,
    probability: selectedEntry.probability,
    scanDepth: selectedEntry.scanDepth,
    automationId: selectedEntry.automationId,
    group: selectedEntry.group,
    groupWeight: selectedEntry.groupWeight,
    disable: selectedEntry.disable,
    constant: selectedEntry.constant,
    selective: selectedEntry.selective,
    caseSensitive: selectedEntry.caseSensitive,
    matchWholeWords: selectedEntry.matchWholeWords,
    useGroupScoring: selectedEntry.useGroupScoring,
    excludeRecursion: selectedEntry.excludeRecursion,
    preventRecursion: selectedEntry.preventRecursion,
    delayUntilRecursion: selectedEntry.delayUntilRecursion,
    groupOverride: selectedEntry.groupOverride,
    sticky: selectedEntry.sticky,
    cooldown: selectedEntry.cooldown,
    delay: selectedEntry.delay,
  };

  updateEntry(bookName, newEntry.uid, fields);

  // Copy studio metadata too
  const meta = getEntryMeta(bookName, String(selectedEntry.uid));
  updateEntryMeta(bookName, String(newEntry.uid), { ...meta });

  loadEntryIntoSidebar(newEntry.uid, bookName);
  focusNode(String(newEntry.uid));
}

function deleteCurrentEntry(): void {
  if (!selectedEntry) return;
  const bookName = getCurrentBookName();
  if (!bookName) return;

  const confirmed = confirm(
    `Delete entry "${selectedEntry.comment || 'Unnamed'}" (UID: ${selectedEntry.uid})?\n\nThis cannot be undone.`,
  );
  if (!confirmed) return;

  deleteEntry(bookName, selectedEntry.uid);
  closeSidebar();
}

// --- Tag input ---

function initTagInput(): void {
  const input = document.getElementById('ls-tag-input') as HTMLInputElement | null;
  if (!input) return;

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = input.value.trim().toLowerCase();
      if (tag && !currentTags.includes(tag)) {
        currentTags.push(tag);
        renderTags();
      }
      input.value = '';
      hideAutocomplete();
    }
    if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 1) {
      hideAutocomplete();
      return;
    }

    const bookName = getCurrentBookName();
    if (!bookName) return;

    const allTags = getAllTags(bookName);
    const suggestions = allTags
      .filter((t) => t.includes(query) && !currentTags.includes(t))
      .slice(0, 6);

    if (suggestions.length === 0) {
      hideAutocomplete();
      return;
    }

    const container = document.getElementById('ls-tag-autocomplete');
    if (!container) return;

    container.innerHTML = '';
    for (const tag of suggestions) {
      const item = document.createElement('div');
      item.className = 'ls-tag-autocomplete-item';
      item.textContent = tag;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!currentTags.includes(tag)) {
          currentTags.push(tag);
          renderTags();
        }
        input.value = '';
        hideAutocomplete();
      });
      container.appendChild(item);
    }
    container.classList.remove('ls-hidden');
  });

  input.addEventListener('blur', () => {
    setTimeout(hideAutocomplete, 150);
  });
}

function renderTags(): void {
  const container = document.getElementById('ls-tag-container');
  if (!container) return;

  container.innerHTML = '';
  for (const tag of currentTags) {
    const pill = document.createElement('span');
    pill.className = 'ls-tag-pill';
    pill.innerHTML = `${escapeHtml(tag)}<button class="ls-tag-remove">&times;</button>`;
    pill.querySelector('.ls-tag-remove')?.addEventListener('click', () => {
      currentTags = currentTags.filter((t) => t !== tag);
      renderTags();
    });
    container.appendChild(pill);
  }
}

function hideAutocomplete(): void {
  document.getElementById('ls-tag-autocomplete')?.classList.add('ls-hidden');
}

// --- Resize handle ---

function initResizeHandle(): void {
  const handle = document.getElementById('ls-sidebar-resize-handle');
  const sidebar = document.getElementById('ls-sidebar');
  const drawer = document.getElementById('ls-drawer');
  if (!handle || !sidebar || !drawer) return;

  let startX = 0;
  let startWidth = 0;
  let isDragging = false;

  function onPointerMove(e: PointerEvent): void {
    if (!isDragging) return;
    e.preventDefault();
    const delta = startX - e.clientX;
    const maxWidth = drawer!.clientWidth * SIDEBAR_MAX_WIDTH_RATIO;
    const newWidth = Math.min(maxWidth, Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta));
    sidebar!.style.width = newWidth + 'px';
    resizeGraph();
  }

  function onPointerUp(): void {
    if (!isDragging) return;
    isDragging = false;
    handle!.classList.remove('ls-dragging');
    sidebar!.classList.remove('ls-resizing');
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    resizeGraph();
  }

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    handle.classList.add('ls-dragging');
    sidebar.classList.add('ls-resizing');
    // Use document-level listeners so events fire even if pointer drifts off handle
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  });

  // Safety: if window loses focus during drag, end it
  window.addEventListener('blur', () => {
    if (isDragging) onPointerUp();
  });
}

// --- DOM helpers ---

function setInputValue(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.value = value;
}

function setTextareaValue(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLTextAreaElement | null;
  if (el) el.value = value;
}

function setSelectValue(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (el) el.value = value;
}

function setCheckbox(id: string, checked: boolean): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.checked = checked;
}

function getInputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value || '';
}

function getTextareaValue(id: string): string {
  return (document.getElementById(id) as HTMLTextAreaElement | null)?.value || '';
}

function getSelectValue(id: string): string {
  return (document.getElementById(id) as HTMLSelectElement | null)?.value || '';
}

function getCheckbox(id: string): boolean {
  return (document.getElementById(id) as HTMLInputElement | null)?.checked || false;
}

function setNullableNumber(id: string, value: number | null): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.value = value !== null && value !== undefined ? String(value) : '';
}

function getNullableNumber(id: string): number | null {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el || el.value === '') return null;
  const num = parseInt(el.value);
  return isNaN(num) ? null : num;
}
