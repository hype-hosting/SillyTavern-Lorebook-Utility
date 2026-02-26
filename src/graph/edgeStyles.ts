/**
 * Edge/link styling helpers for the 3D force graph.
 * Used as callbacks in graphManager's link configuration.
 */

import { GraphLink } from './nodeStyles';

// --- Colors ---
const AUTO_COLOR = '#5a72a0';
const MANUAL_COLOR = '#b07898';
const SECONDARY_COLOR = '#4a5568';
const DIMMED_COLOR = '#1a1825';

// --- Module state set by graphManager ---
let showAutoLinks = true;
let showManualLinks = true;
let dimmedLinkIds: Set<string> | null = null;

export function setAutoLinksVisible(visible: boolean): void {
  showAutoLinks = visible;
}

export function setManualLinksVisible(visible: boolean): void {
  showManualLinks = visible;
}

export function setDimmedLinks(ids: Set<string> | null): void {
  dimmedLinkIds = ids;
}

/**
 * Get the color for a link based on its type and state.
 */
export function getLinkColor(link: GraphLink): string {
  const id = link.id;
  if (dimmedLinkIds && dimmedLinkIds.size > 0 && dimmedLinkIds.has(id)) {
    return DIMMED_COLOR;
  }
  if (link.type === 'manual') return MANUAL_COLOR;
  if (link.keyType === 'secondary') return SECONDARY_COLOR;
  return AUTO_COLOR;
}

/**
 * Get the width for a link.
 */
export function getLinkWidth(link: GraphLink): number {
  if (link.type === 'manual') return 0.6;
  if (link.keyType === 'secondary') return 0.4;
  return 0.8;
}

/**
 * Get the opacity for a link.
 */
export function getLinkOpacity(link: GraphLink): number {
  const id = link.id;
  if (dimmedLinkIds && dimmedLinkIds.size > 0 && dimmedLinkIds.has(id)) {
    return 0.05;
  }
  if (link.type === 'manual') return 0.5;
  if (link.keyType === 'secondary') return 0.3;
  return 0.5;
}

/**
 * Determine if a link should be visible.
 */
export function getLinkVisibility(link: GraphLink): boolean {
  if (link.type === 'auto' && !showAutoLinks) return false;
  if (link.type === 'manual' && !showManualLinks) return false;
  return true;
}

/**
 * Get curvature for a link (curved manual links, straight auto links).
 */
export function getLinkCurvature(link: GraphLink): number {
  return link.type === 'manual' ? 0.15 : 0;
}
