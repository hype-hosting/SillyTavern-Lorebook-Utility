/**
 * Lorebook Studio - SillyTavern Extension
 *
 * A visual node-graph interface for lorebook/world info editing.
 * Presents lorebook entries as draggable card-style nodes with
 * connection lines showing recursion relationships.
 *
 * @version 1.0.0
 * @author Hyperion
 * @license GPL-3.0
 */

import './style.css';
import { getSettings, getDefaultSettings, getModuleName } from './utils/settings';
import { onSTEvent, removeAllHandlers } from './utils/events';
import { clearCache } from './data/lorebookData';
import { clearRecursionCache } from './data/recursionDetector';
import { initDrawer, injectTriggerButton, openDrawer, isDrawerOpen } from './ui/drawer';

/**
 * Extension initialization.
 * Called when SillyTavern loads the extension.
 */
function init(): void {
  console.log('[Lorebook Studio] Initializing...');

  // Ensure default settings exist
  initializeSettings();

  // Initialize the drawer UI (injects HTML into DOM)
  initDrawer();

  // Inject the trigger button into ST's World Info panel
  injectTriggerButton();

  // Register SillyTavern event listeners
  registerSTEvents();

  console.log('[Lorebook Studio] Initialized successfully.');
}

/**
 * Initialize extension settings with defaults.
 */
function initializeSettings(): void {
  const extensionSettings = SillyTavern.extension_settings as Record<string, unknown>;
  const moduleName = getModuleName();

  if (!extensionSettings[moduleName]) {
    extensionSettings[moduleName] = getDefaultSettings();
    SillyTavern.saveSettingsDebounced();
  } else {
    // Merge any missing default keys into existing settings
    const defaults = getDefaultSettings();
    const current = extensionSettings[moduleName] as Record<string, unknown>;
    let changed = false;

    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in current)) {
        current[key] = value;
        changed = true;
      }
    }

    if (changed) {
      SillyTavern.saveSettingsDebounced();
    }
  }
}

/**
 * Register event listeners on SillyTavern's event system.
 */
function registerSTEvents(): void {
  try {
    const eventTypes = SillyTavern.event_types;

    // Listen for world info updates to refresh graph if drawer is open
    if (eventTypes.WORLDINFO_UPDATED) {
      onSTEvent(eventTypes.WORLDINFO_UPDATED, () => {
        const settings = getSettings();
        if (settings.autoRefresh && isDrawerOpen()) {
          clearCache();
          clearRecursionCache();
          // The drawer's internal listeners will handle the refresh
        }
      });
    }

    // Listen for world info force activation (entries loaded)
    if (eventTypes.WORLDINFO_FORCE_ACTIVATE) {
      onSTEvent(eventTypes.WORLDINFO_FORCE_ACTIVATE, () => {
        if (isDrawerOpen()) {
          clearCache();
          clearRecursionCache();
        }
      });
    }
  } catch (e) {
    console.warn(
      '[Lorebook Studio] Could not register all ST events. Some auto-refresh features may not work.',
      e,
    );
  }
}

// --- Bootstrap ---

// Use jQuery ready if available (ST environment), otherwise DOMContentLoaded
if (typeof $ !== 'undefined') {
  $(() => {
    init();
  });
} else {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
