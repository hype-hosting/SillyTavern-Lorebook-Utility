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
const AUTO_HIGHLIGHT_COLOR = '#8aa0e0';
const MANUAL_HIGHLIGHT_COLOR = '#e0a0c8';

// --- Module state set by graphManager ---
let showAutoLinks = true;
let showManualLinks = true;
let dimmedLinkIds: Set<string> | null = null;
let selectedNodeForEdges: string | null = null;

export function setAutoLinksVisible(visible: boolean): void {
  showAutoLinks = visible;
}

export function setManualLinksVisible(visible: boolean): void {
  showManualLinks = visible;
}

export function setDimmedLinks(ids: Set<string> | null): void {
  dimmedLinkIds = ids;
}

export function setSelectedNodeForEdges(nodeId: string | null): void {
  selectedNodeForEdges = nodeId;
}

/**
 * Check if a link connects to a given node.
 */
function isLinkConnectedTo(link: GraphLink, nodeId: string): boolean {
  const srcId = typeof link.source === 'string' ? link.source : link.source.id;
  const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
  return srcId === nodeId || tgtId === nodeId;
}

/**
 * Get the color for a link based on its type and state.
 */
export function getLinkColor(link: GraphLink): string {
  const id = link.id;
  if (dimmedLinkIds && dimmedLinkIds.size > 0 && dimmedLinkIds.has(id)) {
    return DIMMED_COLOR;
  }
  // Boost color for links connected to the selected node
  if (selectedNodeForEdges && isLinkConnectedTo(link, selectedNodeForEdges)) {
    return link.type === 'manual' ? MANUAL_HIGHLIGHT_COLOR : AUTO_HIGHLIGHT_COLOR;
  }
  if (link.type === 'manual') return MANUAL_COLOR;
  if (link.keyType === 'secondary') return SECONDARY_COLOR;
  return AUTO_COLOR;
}

/**
 * Get the width for a link.
 */
export function getLinkWidth(link: GraphLink): number {
  // Thicker for links connected to the selected node
  if (selectedNodeForEdges && isLinkConnectedTo(link, selectedNodeForEdges)) {
    return link.type === 'manual' ? 0.5 : 0.6;
  }
  if (link.type === 'manual') return 0.25;
  if (link.keyType === 'secondary') return 0.15;
  return 0.3;
}

/**
 * Get the opacity for a link.
 */
export function getLinkOpacity(link: GraphLink): number {
  const id = link.id;
  if (dimmedLinkIds && dimmedLinkIds.size > 0 && dimmedLinkIds.has(id)) {
    return 0.05;
  }
  // More visible for links connected to the selected node
  if (selectedNodeForEdges && isLinkConnectedTo(link, selectedNodeForEdges)) {
    return 0.8;
  }
  // Dim non-connected links when a node is selected
  if (selectedNodeForEdges) {
    return 0.1;
  }
  if (link.type === 'manual') return 0.4;
  if (link.keyType === 'secondary') return 0.25;
  return 0.35;
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
