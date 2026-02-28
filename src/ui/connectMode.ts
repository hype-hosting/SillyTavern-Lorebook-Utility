/**
 * Connect mode: two-click flow for creating manual links between entries.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';
import {
  disableNodeSelect, enableNodeSelect,
  setConnectModeClickHandler, setNodeConnectSource,
} from '../graph/graphManager';
import { addManualLink } from '../data/manualLinks';
import { getCurrentBookName } from './drawer';

let isActive = false;
let sourceNodeId: string | null = null;

/**
 * Initialize connect mode: wire up button and event listeners.
 */
export function initConnectMode(): void {
  // Link button in toolbar
  document.getElementById('ls-btn-connect')?.addEventListener('click', toggleConnectMode);

  // Listen for context menu "Connect To..." action (with a pre-set source node)
  EventBus.on(STUDIO_EVENTS.CONNECT_MODE_START, (data: unknown) => {
    const { sourceUid } = (data || {}) as { sourceUid?: number };
    // Guard: only react if a sourceUid was provided (avoids self-trigger
    // from enterConnectMode's own emission which sends an empty object)
    if (sourceUid === undefined) return;
    enterConnectMode();
    setSource(String(sourceUid));
  });

  // ESC exits connect mode
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && isActive) {
      exitConnectMode();
    }
  });
}

/**
 * Toggle connect mode on/off.
 */
function toggleConnectMode(): void {
  if (isActive) {
    exitConnectMode();
  } else {
    enterConnectMode();
  }
}

/**
 * Enter connect mode.
 */
function enterConnectMode(): void {
  if (isActive) return;
  isActive = true;
  sourceNodeId = null;

  // Suppress normal node-tap → sidebar behavior
  disableNodeSelect();

  // Visual feedback
  const btn = document.getElementById('ls-btn-connect');
  btn?.classList.add('active');

  const container = document.getElementById('ls-graph-container');
  if (container) container.style.cursor = 'crosshair';

  updateStatus('Click a source node...');

  // Register our click handler with graphManager
  setConnectModeClickHandler(handleNodeTap);

  EventBus.emit(STUDIO_EVENTS.CONNECT_MODE_START, {});
}

/**
 * Exit connect mode and clean up.
 */
export function exitConnectMode(): void {
  if (!isActive) return;
  isActive = false;

  // Remove source glow
  clearSourceGlow();
  sourceNodeId = null;

  // Restore normal node selection
  enableNodeSelect();

  // Visual cleanup
  const btn = document.getElementById('ls-btn-connect');
  btn?.classList.remove('active');

  const container = document.getElementById('ls-graph-container');
  if (container) container.style.cursor = '';

  // Unregister connect-mode click handler
  setConnectModeClickHandler(null);

  // Hide status
  hideStatus();

  EventBus.emit(STUDIO_EVENTS.CONNECT_MODE_END, {});
}

/**
 * Check if connect mode is currently active.
 */
export function isConnectModeActive(): boolean {
  return isActive;
}

// --- Internal ---

function handleNodeTap(nodeId: string): void {
  if (!sourceNodeId) {
    // First click: select source
    setSource(nodeId);
  } else if (nodeId === sourceNodeId) {
    // Clicked same node: deselect source
    clearSourceGlow();
    sourceNodeId = null;
    updateStatus('Click a source node...');
  } else {
    // Second click: create link
    const bookName = getCurrentBookName();
    if (bookName) {
      const added = addManualLink(bookName, sourceNodeId, nodeId);
      if (added) {
        updateStatus(`Linked! Click next source node...`);
      } else {
        updateStatus('Link already exists. Click a source node...');
      }
    }

    // Clear source and stay in connect mode for next link
    clearSourceGlow();
    sourceNodeId = null;
  }
}

function setSource(nodeId: string): void {
  clearSourceGlow();
  sourceNodeId = nodeId;

  // Highlight the source node via graphManager
  setNodeConnectSource(nodeId);

  updateStatus('Click a target node to connect...');
}

function clearSourceGlow(): void {
  if (!sourceNodeId) return;
  // Clear the source highlight
  setNodeConnectSource(null);
}

function updateStatus(text: string): void {
  let statusEl = document.getElementById('ls-connect-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'ls-connect-status';
    statusEl.className = 'ls-connect-status';
    document.getElementById('ls-graph-container')?.appendChild(statusEl);
  }
  statusEl.textContent = text;
  statusEl.style.display = 'block';
}

function hideStatus(): void {
  const statusEl = document.getElementById('ls-connect-status');
  if (statusEl) {
    statusEl.style.display = 'none';
  }
}
