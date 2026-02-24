/**
 * Event handling and SillyTavern event integration for Lorebook Studio.
 */

type EventCallback = (...args: unknown[]) => void;

const registeredHandlers: Array<{ event: string; callback: EventCallback }> = [];

/**
 * Register an event handler on ST's event source, tracking it for cleanup.
 */
export function onSTEvent(event: string, callback: EventCallback): void {
  SillyTavern.eventSource.on(event, callback);
  registeredHandlers.push({ event, callback });
}

/**
 * Remove a specific event handler.
 */
export function offSTEvent(event: string, callback: EventCallback): void {
  SillyTavern.eventSource.off(event, callback);
  const idx = registeredHandlers.findIndex(
    (h) => h.event === event && h.callback === callback,
  );
  if (idx !== -1) registeredHandlers.splice(idx, 1);
}

/**
 * Remove all registered event handlers (for cleanup on extension unload).
 */
export function removeAllHandlers(): void {
  for (const { event, callback } of registeredHandlers) {
    SillyTavern.eventSource.off(event, callback);
  }
  registeredHandlers.length = 0;
}

/**
 * Simple internal event bus for communication between extension modules.
 */
type InternalCallback = (...args: unknown[]) => void;
const internalListeners: Map<string, Set<InternalCallback>> = new Map();

export const EventBus = {
  on(event: string, callback: InternalCallback): void {
    if (!internalListeners.has(event)) {
      internalListeners.set(event, new Set());
    }
    internalListeners.get(event)!.add(callback);
  },

  off(event: string, callback: InternalCallback): void {
    internalListeners.get(event)?.delete(callback);
  },

  emit(event: string, ...args: unknown[]): void {
    const listeners = internalListeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`[Lorebook Studio] EventBus error on "${event}":`, err);
        }
      }
    }
  },

  clear(): void {
    internalListeners.clear();
  },
};

// Internal event names used across the extension
export const STUDIO_EVENTS = {
  LOREBOOK_CHANGED: 'ls:lorebook-changed',
  NODE_SELECTED: 'ls:node-selected',
  NODE_DESELECTED: 'ls:node-deselected',
  ENTRY_UPDATED: 'ls:entry-updated',
  ENTRY_CREATED: 'ls:entry-created',
  ENTRY_DELETED: 'ls:entry-deleted',
  MANUAL_LINK_ADDED: 'ls:manual-link-added',
  MANUAL_LINK_REMOVED: 'ls:manual-link-removed',
  LAYOUT_CHANGED: 'ls:layout-changed',
  SEARCH_CHANGED: 'ls:search-changed',
  GRAPH_REFRESH: 'ls:graph-refresh',
  DRAWER_OPENED: 'ls:drawer-opened',
  DRAWER_CLOSED: 'ls:drawer-closed',
} as const;
