/**
 * Node styling for 3D force graph.
 * Provides SpriteText-based node objects and color helpers.
 */

import SpriteText from 'three-spritetext';
import { EntryStatus } from '../utils/settings';

/** Data shape of a graph node (matches what graphManager builds). */
export interface GraphNode {
  id: string;
  uid: number;
  label: string;
  comment: string;
  keys: string[];
  keysecondary: string[];
  content: string;
  disabled: boolean;
  constant: boolean;
  selective: boolean;
  orphan: boolean;
  connectionCount: number;
  entryPosition: number;
  depth: number;
  order: number;
  group: string;
  bookName: string;
  // Studio metadata
  categoryColor: string | null;
  colorOverride: string | null;
  status: EntryStatus | null;
  pinned: boolean;
  hasNotes: boolean;
  // d3-force managed
  x?: number;
  y?: number;
  z?: number;
  fx?: number | undefined;
  fy?: number | undefined;
  fz?: number | undefined;
}

/** Data shape of a graph link. */
export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'auto' | 'manual';
  keyType?: string;
  triggerKey: string;
}

export type ViewMode = 'cards' | 'sprites';

// --- Colors ---

const NODE_BG = '#2d2b4e';
const NODE_BORDER = '#5a52a0';
const NODE_TEXT = '#d0ccdf';
const DISABLED_BG = '#25232e';
const DISABLED_BORDER = '#454050';
const DISABLED_TEXT = '#7a7588';
const SELECTED_BG = '#3d3520';
const SELECTED_BORDER = '#fbbf24';
const SELECTED_TEXT = '#fde68a';
const HIGHLIGHTED_BG = '#352b5e';
const HIGHLIGHTED_BORDER = '#a78bfa';
const HIGHLIGHTED_TEXT = '#e0d7ff';
const CONNECT_SOURCE_BORDER = '#d4a0c0';

// Status dot colors
const STATUS_COLORS: Record<string, string> = {
  'draft': '#9ca3af',
  'in-progress': '#60a5fa',
  'review': '#fbbf24',
  'complete': '#4ade80',
};

/**
 * Darken a hex color by mixing it toward black.
 */
function darkenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return '#' +
    Math.round(r * f).toString(16).padStart(2, '0') +
    Math.round(g * f).toString(16).padStart(2, '0') +
    Math.round(b * f).toString(16).padStart(2, '0');
}

/**
 * Get the effective border color for a node based on its studio metadata.
 */
function getStudioBorderColor(node: GraphNode): string | null {
  if (node.colorOverride) return node.colorOverride;
  if (node.categoryColor) return node.categoryColor;
  return null;
}

/**
 * Build the display label for a node, including studio indicators.
 */
function buildStudioLabel(node: GraphNode, showKeywords: boolean): string {
  const parts: string[] = [];

  // Pin indicator
  if (node.pinned) parts.push('\u2605 ');

  // Status dot
  if (node.status) {
    const dot = node.status === 'complete' ? '\u2713 ' : '\u25CF ';
    parts.push(dot);
  }

  // Name
  parts.push(node.comment || 'Unnamed Entry');

  // Notes indicator
  if (node.hasNotes) parts.push(' \u270E');

  let label = parts.join('');

  // Keywords
  if (showKeywords && node.keys.length > 0) {
    const keyPreview = node.keys.slice(0, 3).join(', ');
    const suffix = node.keys.length > 3 ? ` +${node.keys.length - 3}` : '';
    label += `\n[${keyPreview}${suffix}]`;
  }

  return label;
}

/**
 * Create a SpriteText node for "cards" view mode.
 * Shows name + key preview, with background and border like a card.
 */
export function createCardSprite(
  node: GraphNode,
  selectedId: string | null,
  highlightedIds: Set<string> | null,
  connectSourceId: string | null,
): SpriteText {
  const isSelected = node.id === selectedId;
  const isHighlighted = highlightedIds?.has(node.id) ?? false;
  const isDimmed = highlightedIds !== null && highlightedIds.size > 0 && !isHighlighted;
  const isConnectSource = node.id === connectSourceId;

  const label = buildStudioLabel(node, true);

  const sprite = new SpriteText(label);
  sprite.textHeight = 3;
  sprite.fontFace = 'system-ui, -apple-system, sans-serif';
  sprite.padding = 3;
  sprite.borderRadius = 3;

  // Get studio color (category or override)
  const studioColor = getStudioBorderColor(node);

  // Apply style based on state (priority order)
  if (isConnectSource) {
    sprite.backgroundColor = NODE_BG;
    sprite.borderWidth = 1.2;
    sprite.borderColor = CONNECT_SOURCE_BORDER;
    sprite.color = NODE_TEXT;
  } else if (isSelected) {
    sprite.backgroundColor = SELECTED_BG;
    sprite.borderWidth = 1;
    sprite.borderColor = SELECTED_BORDER;
    sprite.color = SELECTED_TEXT;
  } else if (isHighlighted) {
    sprite.backgroundColor = HIGHLIGHTED_BG;
    sprite.borderWidth = 1;
    sprite.borderColor = HIGHLIGHTED_BORDER;
    sprite.color = HIGHLIGHTED_TEXT;
  } else if (node.disabled) {
    sprite.backgroundColor = DISABLED_BG;
    sprite.borderWidth = 0.5;
    sprite.borderColor = studioColor ? darkenColor(studioColor, 0.5) : DISABLED_BORDER;
    sprite.color = DISABLED_TEXT;
  } else if (studioColor) {
    // Category/override color takes priority for enabled entries
    sprite.backgroundColor = darkenColor(studioColor, 0.75);
    sprite.borderWidth = 0.8;
    sprite.borderColor = studioColor;
    sprite.color = NODE_TEXT;
  } else {
    // Default: no category assigned
    sprite.backgroundColor = NODE_BG;
    sprite.borderWidth = 0.5;
    sprite.borderColor = NODE_BORDER;
    sprite.color = NODE_TEXT;
  }

  // Dimmed overrides
  if (isDimmed) {
    sprite.backgroundColor = '#1a1825';
    sprite.borderColor = '#2a2740';
    sprite.color = '#4a4660';
    sprite.borderWidth = 0.3;
  }

  return sprite;
}

/**
 * Create a SpriteText node for "sprites" view mode.
 * Minimal: just the name, smaller text.
 */
export function createLabelSprite(
  node: GraphNode,
  selectedId: string | null,
  highlightedIds: Set<string> | null,
  connectSourceId: string | null,
): SpriteText {
  const isSelected = node.id === selectedId;
  const isHighlighted = highlightedIds?.has(node.id) ?? false;
  const isDimmed = highlightedIds !== null && highlightedIds.size > 0 && !isHighlighted;
  const isConnectSource = node.id === connectSourceId;

  const name = (node.pinned ? '\u2605 ' : '') + (node.comment || 'Unnamed');
  const sprite = new SpriteText(name);
  sprite.textHeight = 2.5;
  sprite.fontFace = 'system-ui, -apple-system, sans-serif';
  sprite.padding = 1.5;
  sprite.borderRadius = 2;

  const studioColor = getStudioBorderColor(node);

  if (isConnectSource) {
    sprite.color = CONNECT_SOURCE_BORDER;
    sprite.backgroundColor = false as unknown as string;
    sprite.borderWidth = 0;
  } else if (isSelected) {
    sprite.color = SELECTED_TEXT;
    sprite.backgroundColor = false as unknown as string;
    sprite.borderWidth = 0;
  } else if (isHighlighted) {
    sprite.color = HIGHLIGHTED_TEXT;
    sprite.backgroundColor = false as unknown as string;
    sprite.borderWidth = 0;
  } else if (isDimmed) {
    sprite.color = '#4a4660';
    sprite.backgroundColor = false as unknown as string;
    sprite.borderWidth = 0;
  } else if (studioColor) {
    sprite.color = studioColor;
    sprite.backgroundColor = false as unknown as string;
    sprite.borderWidth = 0;
  } else {
    sprite.color = NODE_TEXT;
    sprite.backgroundColor = false as unknown as string;
    sprite.borderWidth = 0;
  }

  return sprite;
}

/**
 * Get a flat hex color for a node (used for sphere fallback and link coloring).
 */
export function getNodeColor(node: GraphNode, selectedId: string | null): string {
  if (node.id === selectedId) return SELECTED_BORDER;
  if (node.colorOverride) return node.colorOverride;
  if (node.categoryColor) return node.categoryColor;
  if (node.disabled) return DISABLED_BORDER;
  return NODE_BORDER;
}

/**
 * Build a display label for a node.
 */
export function buildNodeLabel(
  comment: string,
  keys: string[],
  showKeywords: boolean,
): string {
  const name = comment || 'Unnamed Entry';
  if (!showKeywords || keys.length === 0) {
    return name;
  }
  const keyPreview = keys.slice(0, 3).join(', ');
  const suffix = keys.length > 3 ? ` +${keys.length - 3}` : '';
  return `${name}\n[${keyPreview}${suffix}]`;
}
