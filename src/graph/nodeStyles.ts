/**
 * Node styling for 3D force graph.
 * Provides SpriteText-based node objects and color helpers.
 */

import SpriteText from 'three-spritetext';

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
const CONSTANT_BORDER = '#4ade80';
const CONSTANT_BG = '#1f2e38';
const ORPHAN_BORDER = '#b87333';
const ORPHAN_BG = '#2a2220';
const SELECTED_BG = '#3d3520';
const SELECTED_BORDER = '#fbbf24';
const SELECTED_TEXT = '#fde68a';
const HIGHLIGHTED_BG = '#352b5e';
const HIGHLIGHTED_BORDER = '#a78bfa';
const HIGHLIGHTED_TEXT = '#e0d7ff';
const CONNECT_SOURCE_BORDER = '#d4a0c0';

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

  // Build display text
  const label = buildNodeLabel(node.comment, node.keys, true);

  const sprite = new SpriteText(label);
  sprite.textHeight = 3;
  sprite.fontFace = 'system-ui, -apple-system, sans-serif';
  sprite.padding = 3;
  sprite.borderRadius = 3;

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
    sprite.borderColor = DISABLED_BORDER;
    sprite.color = DISABLED_TEXT;
  } else if (node.constant) {
    sprite.backgroundColor = CONSTANT_BG;
    sprite.borderWidth = 0.8;
    sprite.borderColor = CONSTANT_BORDER;
    sprite.color = NODE_TEXT;
  } else if (node.orphan) {
    sprite.backgroundColor = ORPHAN_BG;
    sprite.borderWidth = 0.5;
    sprite.borderColor = ORPHAN_BORDER;
    sprite.color = NODE_TEXT;
  } else {
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

  const name = node.comment || 'Unnamed';
  const sprite = new SpriteText(name);
  sprite.textHeight = 2.5;
  sprite.fontFace = 'system-ui, -apple-system, sans-serif';
  sprite.padding = 1.5;
  sprite.borderRadius = 2;

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
  if (node.disabled) return DISABLED_BORDER;
  if (node.constant) return CONSTANT_BORDER;
  if (node.orphan) return ORPHAN_BORDER;
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
