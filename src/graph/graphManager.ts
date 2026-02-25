/**
 * Manages the Cytoscape.js graph instance for Lorebook Studio.
 * Handles initialization, data conversion, event wiring, and lifecycle.
 */

import cytoscape from 'cytoscape';
import { LorebookEntry } from '../data/lorebookData';
import { RecursionEdge } from '../data/recursionDetector';
import { ManualLinkData, getSettings } from '../utils/settings';
import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { getNodeStylesheet, buildNodeLabel } from './nodeStyles';
import { getEdgeStylesheet } from './edgeStyles';
import { getLayoutConfig, LayoutName } from './layouts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cy: any = null;
let currentBookName: string = '';

// Node-select handler reference (for connect mode to disable/enable)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nodeSelectHandler: ((evt: any) => void) | null = null;

// Tooltip state
let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize the Cytoscape graph in the given container.
 */
export function initGraph(
  container: HTMLElement,
  entries: LorebookEntry[],
  recursionEdges: RecursionEdge[],
  manualLinks: ManualLinkData[],
  bookName: string,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // Destroy previous instance
  if (cy) {
    cy.destroy();
  }

  currentBookName = bookName;
  const settings = getSettings();

  // Convert entries to Cytoscape nodes
  const nodes = entries.map((entry) => buildNode(entry, recursionEdges, manualLinks, settings.showKeywordsOnNodes));

  // Convert edges
  const edges = [
    ...recursionEdges.map((edge) => buildAutoEdge(edge)),
    ...manualLinks.map((link) => buildManualEdge(link)),
  ];

  // Merge stylesheet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stylesheet: any[] = [
    ...getNodeStylesheet(),
    ...getEdgeStylesheet(),
  ];

  cy = cytoscape({
    container,
    elements: [...nodes, ...edges],
    style: stylesheet,
    layout: getLayoutConfig(settings.defaultLayout as LayoutName, nodes.length) as cytoscape.LayoutOptions,
    minZoom: 0.1,
    maxZoom: 3,
    wheelSensitivity: 0.3,
    boxSelectionEnabled: false,
    selectionType: 'single',
  });

  // Prevent browser context menu on the graph container
  container.addEventListener('contextmenu', (e) => e.preventDefault());

  // Restore saved positions if available
  restorePositions(bookName);

  // Wire up events
  setupEvents();

  // Apply edge label visibility
  if (!settings.showEdgeLabels) {
    cy.edges().addClass('ls-no-label');
  }

  // Ensure graph is properly sized after container is fully rendered
  setTimeout(() => {
    if (cy) {
      cy.resize();
      cy.fit(undefined, 50);
    }
  }, 100);

  return cy;
}

/**
 * Get the current Cytoscape instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGraph(): any {
  return cy;
}

/**
 * Resize the graph to fit its container. Call after layout changes (sidebar open/close).
 */
export function resizeGraph(): void {
  if (cy) {
    cy.resize();
  }
}

/**
 * Temporarily disable node selection (for connect mode).
 */
export function disableNodeSelect(): void {
  if (cy && nodeSelectHandler) {
    cy.off('tap', 'node', nodeSelectHandler);
  }
}

/**
 * Re-enable node selection (when exiting connect mode).
 */
export function enableNodeSelect(): void {
  if (cy && nodeSelectHandler) {
    cy.on('tap', 'node', nodeSelectHandler);
  }
}

/**
 * Destroy the graph instance and save positions.
 */
export function destroyGraph(): void {
  if (cy) {
    savePositions(currentBookName);
    cy.destroy();
    cy = null;
  }
  hideTooltip();
}

/**
 * Refresh the graph with updated data.
 */
export function refreshGraph(
  entries: LorebookEntry[],
  recursionEdges: RecursionEdge[],
  manualLinks: ManualLinkData[],
): void {
  if (!cy) return;

  const settings = getSettings();

  cy.startBatch();

  // Build sets of current and new element IDs
  const newNodeIds = new Set(entries.map((e) => String(e.uid)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentNodeIds = new Set(cy.nodes().map((n: any) => n.id()));

  // Remove nodes that no longer exist
  for (const id of currentNodeIds as Set<string>) {
    if (!newNodeIds.has(id)) {
      cy.getElementById(id).remove();
    }
  }

  // Add or update nodes
  for (const entry of entries) {
    const id = String(entry.uid);
    const existing = cy.getElementById(id);

    if (existing.length > 0) {
      // Update existing node data
      existing.data(
        'label',
        buildNodeLabel(entry.comment, entry.key, settings.showKeywordsOnNodes),
      );
      existing.data('disabled', entry.disable);
      existing.data('constant', entry.constant);
      existing.data('keys', entry.key);
      existing.data('content', entry.content);
      existing.data('contentPreview', entry.content.substring(0, 100));
    } else {
      // Add new node
      const node = buildNode(entry, recursionEdges, manualLinks, settings.showKeywordsOnNodes);
      cy.add(node);
    }
  }

  // Remove all edges and re-add (simpler than diffing)
  cy.edges().remove();

  const autoEdges = recursionEdges.map((edge) => buildAutoEdge(edge));
  const manualEdges = manualLinks.map((link) => buildManualEdge(link));
  cy.add([...autoEdges, ...manualEdges]);

  // Update orphan status
  updateOrphanStatus();

  cy.endBatch();

  // Apply visibility settings
  applyEdgeVisibility();

  if (!settings.showEdgeLabels) {
    cy.edges().addClass('ls-no-label');
  }
}

/**
 * Run a layout on the graph.
 */
export function runLayout(layoutName: LayoutName): void {
  if (!cy) return;
  const config = getLayoutConfig(layoutName, cy.nodes().length);
  cy.layout(config as cytoscape.LayoutOptions).run();
  EventBus.emit(STUDIO_EVENTS.LAYOUT_CHANGED, layoutName);
}

/**
 * Fit all elements in view.
 */
export function fitGraph(): void {
  cy?.fit(undefined, 50);
}

/**
 * Zoom in.
 */
export function zoomIn(): void {
  if (!cy) return;
  cy.zoom({ level: cy.zoom() * 1.2, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
}

/**
 * Zoom out.
 */
export function zoomOut(): void {
  if (!cy) return;
  cy.zoom({ level: cy.zoom() / 1.2, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
}

/**
 * Focus on a specific node by ID.
 */
export function focusNode(nodeId: string): void {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (node.length > 0) {
    cy.animate({
      center: { eles: node },
      zoom: 1.5,
      duration: 300,
    });
    node.select();
  }
}

/**
 * Apply search highlighting: highlight matching nodes, dim others.
 */
export function applySearchHighlight(matchingIds: Set<string>): void {
  if (!cy) return;

  cy.startBatch();

  if (matchingIds.size === 0) {
    cy.elements().removeClass('ls-highlighted ls-dimmed');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cy.nodes().forEach((node: any) => {
      if (matchingIds.has(node.id())) {
        node.removeClass('ls-dimmed').addClass('ls-highlighted');
      } else {
        node.removeClass('ls-highlighted').addClass('ls-dimmed');
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cy.edges().forEach((edge: any) => {
      const srcMatch = matchingIds.has(edge.source().id());
      const tgtMatch = matchingIds.has(edge.target().id());
      if (srcMatch || tgtMatch) {
        edge.removeClass('ls-dimmed');
      } else {
        edge.addClass('ls-dimmed');
      }
    });
  }

  cy.endBatch();
}

/**
 * Toggle visibility of auto-detected edges.
 */
export function toggleAutoEdges(visible: boolean): void {
  if (!cy) return;
  cy.edges('[type = "auto"]').toggleClass('ls-hidden', !visible);
}

/**
 * Toggle visibility of manual link edges.
 */
export function toggleManualEdges(visible: boolean): void {
  if (!cy) return;
  cy.edges('[type = "manual"]').toggleClass('ls-hidden', !visible);
}

/**
 * Toggle edge label visibility.
 */
export function toggleEdgeLabels(visible: boolean): void {
  if (!cy) return;
  cy.edges().toggleClass('ls-no-label', !visible);
}

/**
 * Get the currently selected node's UID, or null.
 */
export function getSelectedNodeUid(): number | null {
  if (!cy) return null;
  const selected = cy.$(':selected');
  if (selected.length > 0 && selected[0].isNode()) {
    return parseInt(selected[0].id());
  }
  return null;
}

/**
 * Get the current book name from the graph context.
 */
export function getGraphBookName(): string {
  return currentBookName;
}

// --- Internal helpers ---

function buildNode(
  entry: LorebookEntry,
  recursionEdges: RecursionEdge[],
  manualLinks: ManualLinkData[],
  showKeywords: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const uidStr = String(entry.uid);
  const connectionCount =
    recursionEdges.filter(
      (e) => String(e.sourceUid) === uidStr || String(e.targetUid) === uidStr,
    ).length +
    manualLinks.filter(
      (l) => l.sourceUid === uidStr || l.targetUid === uidStr,
    ).length;

  const isOrphan = connectionCount === 0;

  return {
    group: 'nodes',
    data: {
      id: uidStr,
      label: buildNodeLabel(entry.comment, entry.key, showKeywords),
      keys: entry.key,
      keysecondary: entry.keysecondary,
      comment: entry.comment,
      content: entry.content,
      contentPreview: entry.content.substring(0, 100),
      disabled: entry.disable,
      constant: entry.constant,
      selective: entry.selective,
      orphan: isOrphan,
      connectionCount,
      entryPosition: entry.position,
      depth: entry.depth,
      order: entry.order,
      group: entry.group,
      bookName: currentBookName,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAutoEdge(edge: RecursionEdge): any {
  return {
    group: 'edges',
    data: {
      id: `auto-${edge.sourceUid}-${edge.targetUid}-${edge.triggerKey}`,
      source: String(edge.sourceUid),
      target: String(edge.targetUid),
      type: 'auto',
      keyType: edge.keyType,
      triggerKey: edge.triggerKey.length > 20
        ? edge.triggerKey.substring(0, 17) + '...'
        : edge.triggerKey,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildManualEdge(link: ManualLinkData): any {
  return {
    group: 'edges',
    data: {
      id: `manual-${link.sourceUid}-${link.targetUid}`,
      source: link.sourceUid,
      target: link.targetUid,
      type: 'manual',
      triggerKey: link.label || 'manual',
    },
  };
}

function updateOrphanStatus(): void {
  if (!cy) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.nodes().forEach((node: any) => {
    const degree = node.degree(false);
    node.data('orphan', degree === 0);
  });
}

function applyEdgeVisibility(): void {
  const settings = getSettings();
  toggleAutoEdges(settings.showAutoLinks);
  toggleManualEdges(settings.showManualLinks);
}

// --- Tooltip helpers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function showTooltip(nodeData: Record<string, any>, renderedPos: { x: number; y: number }): void {
  const tooltip = document.getElementById('ls-tooltip');
  if (!tooltip) return;

  const badges: string[] = [];
  if (nodeData.constant) badges.push('<span class="ls-tooltip-badge ls-tooltip-badge-constant">Constant</span>');
  if (nodeData.disabled) badges.push('<span class="ls-tooltip-badge ls-tooltip-badge-disabled">Disabled</span>');
  if (nodeData.selective) badges.push('<span class="ls-tooltip-badge ls-tooltip-badge-selective">Selective</span>');

  const keys = (nodeData.keys || []) as string[];
  const keysPreview = keys.length > 0
    ? `<div class="ls-tooltip-keys"><strong>Keys:</strong> ${escapeHtml(keys.slice(0, 5).join(', '))}${keys.length > 5 ? ` +${keys.length - 5}` : ''}</div>`
    : '';

  const content = (nodeData.content || '') as string;
  const contentPreview = content.length > 0
    ? `<div class="ls-tooltip-content">${escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}</div>`
    : '';

  const connCount = nodeData.connectionCount as number || 0;

  tooltip.innerHTML = `
    <div class="ls-tooltip-name">${escapeHtml(nodeData.comment || 'Unnamed Entry')}</div>
    ${badges.length > 0 ? `<div class="ls-tooltip-badges">${badges.join('')}</div>` : ''}
    ${keysPreview}
    ${contentPreview}
    <div class="ls-tooltip-meta">${connCount} connection${connCount !== 1 ? 's' : ''}</div>
  `;

  const container = document.getElementById('ls-graph-container');
  if (!container) return;
  const containerRect = container.getBoundingClientRect();

  let left = renderedPos.x + containerRect.left + 15;
  let top = renderedPos.y + containerRect.top - 10;

  // Keep tooltip within viewport
  const tooltipWidth = 320;
  if (left + tooltipWidth > window.innerWidth) {
    left = renderedPos.x + containerRect.left - tooltipWidth - 15;
  }
  if (top < 0) top = 10;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.classList.remove('ls-tooltip-hidden');
}

function hideTooltip(): void {
  if (tooltipTimer) {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }
  const tooltip = document.getElementById('ls-tooltip');
  tooltip?.classList.add('ls-tooltip-hidden');
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Event setup ---

function setupEvents(): void {
  if (!cy) return;

  // Node tap -> select and emit (stored as named handler for connect mode toggle)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodeSelectHandler = (evt: any) => {
    const node = evt.target;
    hideTooltip();
    EventBus.emit(STUDIO_EVENTS.NODE_SELECTED, {
      uid: parseInt(node.id()),
      bookName: currentBookName,
      nodeData: node.data(),
    });
  };
  cy.on('tap', 'node', nodeSelectHandler);

  // Tap on background -> deselect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.on('tap', (evt: any) => {
    if (evt.target === cy) {
      hideTooltip();
      EventBus.emit(STUDIO_EVENTS.NODE_DESELECTED);
    }
  });

  // Mouse hover effects + tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.on('mouseover', 'node', (evt: any) => {
    evt.target.addClass('ls-hover');
    evt.target.connectedEdges().addClass('ls-hover');
    // Show tooltip after brief delay
    const nodeData = evt.target.data();
    const renderedPos = evt.target.renderedPosition();
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => showTooltip(nodeData, renderedPos), 150);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.on('mouseout', 'node', (evt: any) => {
    evt.target.removeClass('ls-hover');
    evt.target.connectedEdges().removeClass('ls-hover');
    hideTooltip();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.on('mouseover', 'edge', (evt: any) => {
    evt.target.addClass('ls-hover');
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.on('mouseout', 'edge', (evt: any) => {
    evt.target.removeClass('ls-hover');
  });

  // Right-click context menu
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.on('cxttap', 'node', (evt: any) => {
    const node = evt.target;
    const pos = evt.renderedPosition || evt.position;
    hideTooltip();
    EventBus.emit('ls:context-menu', {
      uid: parseInt(node.id()),
      bookName: currentBookName,
      nodeData: node.data(),
      position: { x: pos.x, y: pos.y },
    });
  });

  // Save positions when nodes are dragged
  cy.on('dragfree', 'node', () => {
    savePositions(currentBookName);
  });
}

function savePositions(bookName: string): void {
  if (!cy || !bookName) return;

  const settings = getSettings();
  const positions: Record<string, { x: number; y: number }> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.nodes().forEach((node: any) => {
    const pos = node.position();
    positions[node.id()] = { x: pos.x, y: pos.y };
  });

  settings.savedPositions[bookName] = positions;
}

function restorePositions(bookName: string): void {
  if (!cy || !bookName) return;

  const settings = getSettings();
  const positions = settings.savedPositions[bookName];
  if (!positions) return;

  let hasPositions = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.nodes().forEach((node: any) => {
    const saved = positions[node.id()];
    if (saved) {
      node.position(saved);
      hasPositions = true;
    }
  });

  if (hasPositions) {
    cy.fit(undefined, 50);
  }
}
