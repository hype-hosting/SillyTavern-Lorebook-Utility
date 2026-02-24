/**
 * Manual link management for Lorebook Studio.
 * Allows users to create custom connections between entries
 * beyond what automatic recursion detection finds.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { getSettings, saveSettings, ManualLinkData } from '../utils/settings';

/**
 * Get all manual links for a specific lorebook.
 */
export function getManualLinks(bookName: string): ManualLinkData[] {
  const settings = getSettings();
  return settings.manualLinks[bookName] || [];
}

/**
 * Add a manual link between two entries.
 */
export function addManualLink(
  bookName: string,
  sourceUid: string,
  targetUid: string,
  label: string = '',
): boolean {
  const settings = getSettings();

  if (!settings.manualLinks[bookName]) {
    settings.manualLinks[bookName] = [];
  }

  // Prevent duplicate links
  const exists = settings.manualLinks[bookName].some(
    (link) => link.sourceUid === sourceUid && link.targetUid === targetUid,
  );
  if (exists) return false;

  const link: ManualLinkData = { sourceUid, targetUid, label, bookName };
  settings.manualLinks[bookName].push(link);
  saveSettings();

  EventBus.emit(STUDIO_EVENTS.MANUAL_LINK_ADDED, link);
  return true;
}

/**
 * Remove a manual link between two entries.
 */
export function removeManualLink(
  bookName: string,
  sourceUid: string,
  targetUid: string,
): boolean {
  const settings = getSettings();
  const links = settings.manualLinks[bookName];
  if (!links) return false;

  const idx = links.findIndex(
    (link) => link.sourceUid === sourceUid && link.targetUid === targetUid,
  );
  if (idx === -1) return false;

  const [removed] = links.splice(idx, 1);
  saveSettings();

  EventBus.emit(STUDIO_EVENTS.MANUAL_LINK_REMOVED, removed);
  return true;
}

/**
 * Remove all manual links referencing a specific entry (for cleanup on delete).
 */
export function removeLinksForEntry(bookName: string, uid: string): void {
  const settings = getSettings();
  const links = settings.manualLinks[bookName];
  if (!links) return;

  settings.manualLinks[bookName] = links.filter(
    (link) => link.sourceUid !== uid && link.targetUid !== uid,
  );
  saveSettings();
}

/**
 * Get all manual links where the given entry is either source or target.
 */
export function getLinksForEntry(
  bookName: string,
  uid: string,
): ManualLinkData[] {
  const links = getManualLinks(bookName);
  return links.filter(
    (link) => link.sourceUid === uid || link.targetUid === uid,
  );
}

/**
 * Update the label on an existing manual link.
 */
export function updateManualLinkLabel(
  bookName: string,
  sourceUid: string,
  targetUid: string,
  newLabel: string,
): boolean {
  const settings = getSettings();
  const links = settings.manualLinks[bookName];
  if (!links) return false;

  const link = links.find(
    (l) => l.sourceUid === sourceUid && l.targetUid === targetUid,
  );
  if (!link) return false;

  link.label = newLabel;
  saveSettings();
  return true;
}
