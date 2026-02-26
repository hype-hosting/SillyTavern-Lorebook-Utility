/**
 * Sidebar panel for entry editing in Lorebook Studio.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { LorebookEntry, getEntries, updateEntry, deleteEntry, createEntry } from '../data/lorebookData';
import { addManualLink, removeManualLink, getLinksForEntry } from '../data/manualLinks';
import { focusNode, resizeGraph } from '../graph/graphManager';
import { getCurrentBookName } from './drawer';

let selectedEntry: LorebookEntry | null = null;
let originalEntry: LorebookEntry | null = null;

// Resize state
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH_RATIO = 0.6; // max 60% of the drawer width

/**
 * Initialize sidebar events.
 */
export function initSidebar(): void {
  // Listen for node selection from graph
  EventBus.on(STUDIO_EVENTS.NODE_SELECTED, (data: unknown) => {
    const { uid, bookName } = data as { uid: number; bookName: string };
    loadEntryIntoSidebar(uid, bookName);
    openSidebar();
  });

  EventBus.on(STUDIO_EVENTS.NODE_DESELECTED, () => {
    closeSidebar();
  });

  // Sidebar close button
  document.getElementById('ls-sidebar-close')?.addEventListener('click', closeSidebar);

  // Save button
  document.getElementById('ls-btn-save-entry')?.addEventListener('click', saveEntry);

  // Revert button
  document.getElementById('ls-btn-revert-entry')?.addEventListener('click', revertEntry);

  // Duplicate button
  document.getElementById('ls-btn-duplicate-entry')?.addEventListener('click', duplicateEntry);

  // Delete button
  document.getElementById('ls-btn-delete-entry')?.addEventListener('click', deleteCurrentEntry);

  // Add manual link button
  document.getElementById('ls-btn-add-link')?.addEventListener('click', addLink);

  // Sidebar resize handle
  initResizeHandle();

  // Listen for create entry requests from toolbar
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
  // Resize graph after sidebar transition completes
  setTimeout(() => resizeGraph(), 350);
}

/**
 * Close the sidebar panel.
 */
export function closeSidebar(): void {
  const sidebar = document.getElementById('ls-sidebar');
  sidebar?.classList.add('ls-sidebar-hidden');
  selectedEntry = null;
  originalEntry = null;
  // Resize graph after sidebar transition completes
  setTimeout(() => resizeGraph(), 350);
}

// --- Internal ---

function loadEntryIntoSidebar(uid: number, bookName: string): void {
  const entries = getEntries(bookName);
  const entry = entries.find((e) => e.uid === uid);
  if (!entry) return;

  selectedEntry = { ...entry };
  originalEntry = { ...entry };

  // Update sidebar title
  const titleEl = document.getElementById('ls-sidebar-title');
  if (titleEl) titleEl.textContent = entry.comment || `Entry ${entry.uid}`;

  // Populate form fields
  setInputValue('ls-entry-comment', entry.comment);
  setInputValue('ls-entry-keys', entry.key.join(', '));
  setInputValue('ls-entry-keysecondary', entry.keysecondary.join(', '));
  setTextareaValue('ls-entry-content', entry.content);
  setSelectValue('ls-entry-position', String(entry.position));
  setInputValue('ls-entry-depth', String(entry.depth));
  setInputValue('ls-entry-order', String(entry.order));
  setInputValue('ls-entry-probability', String(entry.probability));
  setInputValue('ls-entry-group', entry.group);
  setCheckbox('ls-entry-enabled', !entry.disable);
  setCheckbox('ls-entry-constant', entry.constant);
  setCheckbox('ls-entry-selective', entry.selective);
  setCheckbox('ls-entry-exclude-recursion', entry.excludeRecursion);
  setCheckbox('ls-entry-prevent-recursion', entry.preventRecursion);

  // Populate manual links list
  populateManualLinks(uid, bookName);

  // Populate link target dropdown
  populateLinkTargets(uid, bookName);
}

function saveEntry(): void {
  if (!selectedEntry) return;
  const bookName = getCurrentBookName();
  if (!bookName) return;

  // Read form values
  const comment = getInputValue('ls-entry-comment');
  const keysStr = getInputValue('ls-entry-keys');
  const keysecondaryStr = getInputValue('ls-entry-keysecondary');
  const content = getTextareaValue('ls-entry-content');
  const position = parseInt(getSelectValue('ls-entry-position') || '0');
  const depth = parseInt(getInputValue('ls-entry-depth') || '4');
  const order = parseInt(getInputValue('ls-entry-order') || '100');
  const probability = parseInt(getInputValue('ls-entry-probability') || '100');
  const group = getInputValue('ls-entry-group');
  const enabled = getCheckbox('ls-entry-enabled');
  const constant = getCheckbox('ls-entry-constant');
  const selective = getCheckbox('ls-entry-selective');
  const excludeRecursion = getCheckbox('ls-entry-exclude-recursion');
  const preventRecursion = getCheckbox('ls-entry-prevent-recursion');

  const fields: Partial<LorebookEntry> = {
    comment,
    key: keysStr.split(',').map((k) => k.trim()).filter(Boolean),
    keysecondary: keysecondaryStr.split(',').map((k) => k.trim()).filter(Boolean),
    content,
    position,
    depth,
    order,
    probability,
    group,
    disable: !enabled,
    constant,
    selective,
    excludeRecursion,
    preventRecursion,
  };

  const success = updateEntry(bookName, selectedEntry.uid, fields);
  if (success) {
    // Update original for revert tracking
    originalEntry = { ...selectedEntry, ...fields };
    selectedEntry = { ...originalEntry };

    // Show brief save confirmation via title flash
    const titleEl = document.getElementById('ls-sidebar-title');
    if (titleEl) {
      titleEl.textContent = 'Saved!';
      setTimeout(() => {
        titleEl.textContent = comment || `Entry ${selectedEntry?.uid}`;
      }, 1000);
    }
  }
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

  // Copy fields from selected entry
  const fields: Partial<LorebookEntry> = {
    comment: (selectedEntry.comment || 'Entry') + ' (copy)',
    key: [...selectedEntry.key],
    keysecondary: [...selectedEntry.keysecondary],
    content: selectedEntry.content,
    position: selectedEntry.position,
    depth: selectedEntry.depth,
    order: selectedEntry.order,
    probability: selectedEntry.probability,
    group: selectedEntry.group,
    disable: selectedEntry.disable,
    constant: selectedEntry.constant,
    selective: selectedEntry.selective,
    excludeRecursion: selectedEntry.excludeRecursion,
    preventRecursion: selectedEntry.preventRecursion,
  };

  updateEntry(bookName, newEntry.uid, fields);
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

function addLink(): void {
  if (!selectedEntry) return;
  const bookName = getCurrentBookName();
  if (!bookName) return;

  const targetSelect = document.getElementById('ls-link-target-select') as HTMLSelectElement | null;
  const targetUid = targetSelect?.value;
  if (!targetUid) return;

  addManualLink(bookName, String(selectedEntry.uid), targetUid);
  populateManualLinks(selectedEntry.uid, bookName);

  // Reset dropdown
  if (targetSelect) targetSelect.value = '';
}

function populateManualLinks(uid: number, bookName: string): void {
  const container = document.getElementById('ls-manual-links-list');
  if (!container) return;

  const links = getLinksForEntry(bookName, String(uid));
  const entries = getEntries(bookName);

  container.innerHTML = '';

  if (links.length === 0) {
    container.innerHTML = '<div style="font-size: 11px; color: var(--ls-text-muted); padding: 4px 0;">No manual links</div>';
    return;
  }

  for (const link of links) {
    const isSource = link.sourceUid === String(uid);
    const otherUid = isSource ? link.targetUid : link.sourceUid;
    const otherEntry = entries.find((e) => String(e.uid) === otherUid);
    const otherName = otherEntry?.comment || `Entry ${otherUid}`;
    const direction = isSource ? '\u2192' : '\u2190';

    const item = document.createElement('div');
    item.className = 'ls-manual-link-item';
    item.innerHTML = `
      <span>${direction} ${escapeHtml(otherName)}${link.label ? ` (${escapeHtml(link.label)})` : ''}</span>
      <button class="ls-link-remove" data-source="${link.sourceUid}" data-target="${link.targetUid}" title="Remove link">&times;</button>
    `;

    const removeBtn = item.querySelector('.ls-link-remove') as HTMLElement;
    removeBtn?.addEventListener('click', () => {
      removeManualLink(bookName, link.sourceUid, link.targetUid);
      populateManualLinks(uid, bookName);
    });

    container.appendChild(item);
  }
}

function populateLinkTargets(uid: number, bookName: string): void {
  const select = document.getElementById('ls-link-target-select') as HTMLSelectElement | null;
  if (!select) return;

  const entries = getEntries(bookName);
  select.innerHTML = '<option value="">-- Connect to... --</option>';

  for (const entry of entries) {
    if (entry.uid === uid) continue;
    const option = document.createElement('option');
    option.value = String(entry.uid);
    option.textContent = entry.comment || `Entry ${entry.uid}`;
    select.appendChild(option);
  }
}

// --- Resize handle ---

function initResizeHandle(): void {
  const handle = document.getElementById('ls-sidebar-resize-handle');
  const sidebar = document.getElementById('ls-sidebar');
  const drawer = document.getElementById('ls-drawer');
  if (!handle || !sidebar || !drawer) return;

  let startX = 0;
  let startWidth = 0;

  function onMouseMove(e: MouseEvent): void {
    e.preventDefault();
    const delta = startX - e.clientX;
    const maxWidth = drawer!.clientWidth * SIDEBAR_MAX_WIDTH_RATIO;
    const newWidth = Math.min(maxWidth, Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta));
    sidebar!.style.width = newWidth + 'px';
    resizeGraph();
  }

  function onMouseUp(): void {
    handle!.classList.remove('ls-dragging');
    sidebar!.classList.remove('ls-resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    resizeGraph();
  }

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    handle.classList.add('ls-dragging');
    sidebar.classList.add('ls-resizing');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
