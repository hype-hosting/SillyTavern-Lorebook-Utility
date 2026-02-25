/**
 * Context menu for right-clicking nodes in the graph.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { duplicateEntryById, deleteEntryById, toggleEntryEnabled } from '../features/entryCrud';
import { getEntries } from '../data/lorebookData';
import { focusNode } from '../graph/graphManager';
import { getCurrentBookName } from './drawer';

let menuElement: HTMLDivElement | null = null;

export function initContextMenu(): void {
  menuElement = document.createElement('div');
  menuElement.className = 'ls-context-menu';
  menuElement.style.display = 'none';
  document.getElementById('ls-drawer')?.appendChild(menuElement);

  // Listen for context-menu event from graph
  EventBus.on('ls:context-menu', (data: unknown) => {
    const { uid, nodeData, position } = data as {
      uid: number;
      bookName: string;
      nodeData: Record<string, unknown>;
      position: { x: number; y: number };
    };
    showMenu(uid, nodeData, position);
  });

  // Hide menu when clicking elsewhere
  document.addEventListener('click', hideMenu);

  // Hide on ESC
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') hideMenu();
  });
}

function showMenu(
  uid: number,
  nodeData: Record<string, unknown>,
  position: { x: number; y: number },
): void {
  if (!menuElement) return;
  const bookName = getCurrentBookName();
  if (!bookName) return;

  // Hide tooltip if visible
  document.getElementById('ls-tooltip')?.classList.add('ls-tooltip-hidden');

  const isDisabled = nodeData.disabled as boolean;

  menuElement.innerHTML = `
    <button class="ls-context-menu-item" data-action="edit">Edit in Sidebar</button>
    <button class="ls-context-menu-item" data-action="toggle-enable">
      ${isDisabled ? 'Enable Entry' : 'Disable Entry'}
    </button>
    <div class="ls-context-menu-separator"></div>
    <button class="ls-context-menu-item" data-action="duplicate">Duplicate</button>
    <button class="ls-context-menu-item" data-action="connect">Connect To...</button>
    <div class="ls-context-menu-separator"></div>
    <button class="ls-context-menu-item" data-action="delete" style="color: var(--ls-danger);">Delete</button>
  `;

  // Position the menu relative to the drawer
  const container = document.getElementById('ls-graph-container');
  const drawer = document.getElementById('ls-drawer');
  if (!container || !drawer) return;
  const containerRect = container.getBoundingClientRect();
  const drawerRect = drawer.getBoundingClientRect();

  let left = position.x + containerRect.left - drawerRect.left;
  let top = position.y + containerRect.top - drawerRect.top;

  // Keep within drawer bounds
  const menuWidth = 180;
  const menuHeight = 200;
  if (left + menuWidth > drawerRect.width) {
    left -= menuWidth;
  }
  if (top + menuHeight > drawerRect.height) {
    top -= menuHeight;
  }

  menuElement.style.left = left + 'px';
  menuElement.style.top = top + 'px';
  menuElement.style.display = 'block';

  // Wire up action buttons
  menuElement.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const action = (btn as HTMLElement).dataset.action;
      handleAction(action || '', uid, bookName);
      hideMenu();
    }, { once: true });
  });
}

export function hideMenu(): void {
  if (menuElement) {
    menuElement.style.display = 'none';
  }
}

async function handleAction(action: string, uid: number, bookName: string): Promise<void> {
  switch (action) {
    case 'edit':
      EventBus.emit(STUDIO_EVENTS.NODE_SELECTED, {
        uid,
        bookName,
        nodeData: {},
      });
      break;

    case 'toggle-enable':
      toggleEntryEnabled(bookName, uid);
      break;

    case 'duplicate': {
      const newEntry = await duplicateEntryById(bookName, uid);
      if (newEntry) {
        focusNode(String(newEntry.uid));
      }
      break;
    }

    case 'connect':
      EventBus.emit(STUDIO_EVENTS.CONNECT_MODE_START, { sourceUid: uid });
      break;

    case 'delete': {
      const entries = getEntries(bookName);
      const entry = entries.find((e) => e.uid === uid);
      const name = entry?.comment || `Entry ${uid}`;
      const confirmed = confirm(`Delete "${name}"?\n\nThis cannot be undone.`);
      if (confirmed) {
        deleteEntryById(bookName, uid);
      }
      break;
    }
  }
}
