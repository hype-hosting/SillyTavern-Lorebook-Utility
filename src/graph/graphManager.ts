/**
 * Manages the 3D force-directed graph for Lorebook Studio.
 * Handles initialization, data conversion, event wiring, and lifecycle.
 *
 * Uses 3d-force-graph (Three.js/WebGL) with d3-force-3d physics.
 */

import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import { LorebookEntry } from '../data/lorebookData';
import { RecursionEdge } from '../data/recursionDetector';
import { getEntryMeta, getCategoryById } from '../data/studioData';
import { ManualLinkData, getSettings, updateSettings, ThemeName } from '../utils/settings';
import { EventBus, STUDIO_EVENTS } from '../utils/events';
import {
  GraphNode, GraphLink, ViewMode,
  createCardSprite, createLabelSprite, buildNodeLabel,
} from './nodeStyles';
import {
  getLinkColor, getLinkWidth, getLinkOpacity,
  getLinkVisibility, getLinkCurvature,
  setAutoLinksVisible, setManualLinksVisible, setDimmedLinks,
} from './edgeStyles';
import { configureForces, applyLayout, LayoutName } from './layouts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let graph: any = null;
let currentBookName = '';
let graphContainer: HTMLElement | null = null;

// Node/link data arrays (owned by us, passed to 3d-force-graph)
let graphNodes: GraphNode[] = [];
let graphLinks: GraphLink[] = [];

// Selection & highlight state
let selectedNodeId: string | null = null;
let highlightedNodeIds: Set<string> | null = null;
let connectSourceId: string | null = null;

// View mode
let currentViewMode: ViewMode = 'cards';

// Interaction flags
let selectDisabled = false;

// Connect mode callback
let connectModeClickHandler: ((nodeId: string) => void) | null = null;

// Tooltip state
let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

// Auto-orbit state
let autoOrbitEnabled = false;

// --- Public API (same exports as the old Cytoscape-based graphManager) ---

/**
 * Initialize the 3D graph in the given container.
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
  if (graph) {
    destroyGraph();
  }

  currentBookName = bookName;
  graphContainer = container;
  const settings = getSettings();

  // Build node and link data
  graphNodes = entries.map((entry) =>
    buildNode(entry, recursionEdges, manualLinks, settings.showKeywordsOnNodes),
  );
  graphLinks = [
    ...recursionEdges.map((edge) => buildAutoLink(edge)),
    ...manualLinks.map((link) => buildManualLink(link)),
  ];

  // Apply edge visibility settings
  setAutoLinksVisible(settings.showAutoLinks);
  setManualLinksVisible(settings.showManualLinks);

  // Restore saved positions
  const hadPositions = restorePositions(bookName, graphNodes);

  // Create the 3D force graph
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graph = (new ForceGraph3D(container, { controlType: 'orbit' }) as any)
    .graphData({ nodes: graphNodes, links: graphLinks })
    .nodeId('id')
    .nodeLabel('')  // We handle tooltips ourselves
    .backgroundColor(getThemeBackground(settings.theme))
    .width(container.clientWidth)
    .height(container.clientHeight)
    .showNavInfo(false)
    // Node rendering
    .nodeThreeObject((node: GraphNode) => createNodeObject(node))
    .nodeThreeObjectExtend(false)
    // Link rendering
    .linkSource('source')
    .linkTarget('target')
    .linkColor((link: GraphLink) => getLinkColor(link))
    .linkWidth((link: GraphLink) => getLinkWidth(link))
    .linkOpacity((link: GraphLink) => getLinkOpacity(link))
    .linkCurvature((link: GraphLink) => getLinkCurvature(link))
    .linkCurveRotation(0.5)
    .linkDirectionalArrowLength(2)
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalArrowColor((link: GraphLink) => getLinkColor(link))
    .linkVisibility((link: GraphLink) => getLinkVisibility(link))
    // Keyword labels on links
    .linkThreeObjectExtend(true)
    .linkThreeObject((link: GraphLink) => {
      const text = link.triggerKey || '';
      if (!text) return null;
      const sprite = new SpriteText(text);
      sprite.textHeight = 1.5;
      sprite.color = getLinkColor(link);
      sprite.fontFace = 'system-ui, -apple-system, sans-serif';
      sprite.backgroundColor = false as unknown as string;
      sprite.borderWidth = 0;
      return sprite;
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .linkPositionUpdate((obj: any, { start, end }: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }) => {
      if (!obj) return;
      obj.position.x = (start.x + end.x) / 2;
      obj.position.y = (start.y + end.y) / 2;
      obj.position.z = (start.z + end.z) / 2;
    })
    // Interactions
    .onNodeClick(handleNodeClick)
    .onNodeRightClick(handleNodeRightClick)
    .onNodeHover(handleNodeHover)
    .onNodeDragEnd(handleNodeDragEnd)
    .onBackgroundClick(handleBackgroundClick)
    .onBackgroundRightClick(handleBackgroundClick)
    .enableNodeDrag(true)
    .enableNavigationControls(true);

  // Configure auto-orbit from settings
  autoOrbitEnabled = settings.autoOrbit;
  const controls = graph.controls();
  if (controls) {
    controls.autoRotate = autoOrbitEnabled;
    controls.autoRotateSpeed = 0.4;
  }

  // Configure forces based on node count
  configureForces(graph, graphNodes.length);

  // Prevent browser context menu on the container
  container.addEventListener('contextmenu', preventContextMenu);

  // If positions were restored, don't run the simulation (keep positions fixed)
  if (hadPositions) {
    graph.cooldownTime(0);
    setTimeout(() => {
      if (graph) {
        graph.cooldownTime(Infinity);
        zoomToFitAll();
      }
    }, 100);
  } else {
    // Let the simulation settle, then zoom to fit
    setTimeout(() => {
      if (graph) zoomToFitAll();
    }, 2000);
  }

  return graph;
}

/**
 * Get the current graph instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGraph(): any {
  return graph;
}

/**
 * Resize the graph to fit its container.
 */
export function resizeGraph(): void {
  if (graph && graphContainer) {
    graph.width(graphContainer.clientWidth).height(graphContainer.clientHeight);
  }
}

/**
 * Destroy the graph instance and save positions.
 */
export function destroyGraph(): void {
  if (graph) {
    savePositions(currentBookName);
    // Clean up the graph
    if (graphContainer) {
      graphContainer.removeEventListener('contextmenu', preventContextMenu);
      graphContainer.innerHTML = '';
    }
    graph._destructor?.();
    graph = null;
  }
  graphNodes = [];
  graphLinks = [];
  selectedNodeId = null;
  highlightedNodeIds = null;
  connectSourceId = null;
  hideTooltip();
}

/**
 * Refresh the graph with updated data (after entry edit/create/delete).
 */
export function refreshGraph(
  entries: LorebookEntry[],
  recursionEdges: RecursionEdge[],
  manualLinks: ManualLinkData[],
): void {
  if (!graph) return;

  const settings = getSettings();

  // Remember the selected node
  const prevSelectedId = selectedNodeId;

  // Build new data, preserving positions from existing nodes
  const positionMap = new Map<string, { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number }>();
  for (const node of graphNodes) {
    positionMap.set(node.id, {
      x: node.x, y: node.y, z: node.z,
      fx: node.fx, fy: node.fy, fz: node.fz,
    });
  }

  graphNodes = entries.map((entry) => {
    const node = buildNode(entry, recursionEdges, manualLinks, settings.showKeywordsOnNodes);
    const saved = positionMap.get(node.id);
    if (saved) {
      node.x = saved.x;
      node.y = saved.y;
      node.z = saved.z;
      node.fx = saved.fx;
      node.fy = saved.fy;
      node.fz = saved.fz;
    }
    return node;
  });

  graphLinks = [
    ...recursionEdges.map((edge) => buildAutoLink(edge)),
    ...manualLinks.map((link) => buildManualLink(link)),
  ];

  // Update the graph
  graph.graphData({ nodes: graphNodes, links: graphLinks });

  // Restore selection
  if (prevSelectedId) {
    selectedNodeId = graphNodes.find((n) => n.id === prevSelectedId) ? prevSelectedId : null;
  }

  // Refresh visual state
  refreshNodeObjects();
}

/**
 * Run a layout on the graph.
 */
export function runLayout(layoutName: LayoutName): void {
  if (!graph) return;
  applyLayout(graph, layoutName, graphNodes);
  EventBus.emit(STUDIO_EVENTS.LAYOUT_CHANGED, layoutName);
}

/**
 * Fit all nodes in view.
 */
export function fitGraph(): void {
  zoomToFitAll();
}

/**
 * Zoom in.
 */
export function zoomIn(): void {
  if (!graph) return;
  const { x, y, z } = graph.cameraPosition();
  const factor = 0.75; // move 25% closer
  graph.cameraPosition(
    { x: x * factor, y: y * factor, z: z * factor },
    undefined,
    300,
  );
}

/**
 * Zoom out.
 */
export function zoomOut(): void {
  if (!graph) return;
  const { x, y, z } = graph.cameraPosition();
  const factor = 1.35; // move 35% further
  graph.cameraPosition(
    { x: x * factor, y: y * factor, z: z * factor },
    undefined,
    300,
  );
}

/**
 * Focus camera on a specific node by ID.
 */
export function focusNode(nodeId: string): void {
  if (!graph) return;
  const node = graphNodes.find((n) => n.id === nodeId);
  if (!node || node.x === undefined) return;

  // Position camera near the node, looking at it
  const distance = 120;
  const pos = { x: (node.x ?? 0) + distance, y: (node.y ?? 0) + distance / 2, z: (node.z ?? 0) + distance };
  graph.cameraPosition(pos, { x: node.x, y: node.y, z: node.z }, 800);

  // Select the node
  selectedNodeId = nodeId;
  refreshNodeObjects();
}

/**
 * Apply search highlighting: highlight matching nodes, dim others.
 */
export function applySearchHighlight(matchingIds: Set<string>): void {
  if (!graph) return;

  if (matchingIds.size === 0) {
    highlightedNodeIds = null;
    setDimmedLinks(null);
  } else {
    highlightedNodeIds = matchingIds;
    // Dim links not connected to highlighted nodes
    const dimmed = new Set<string>();
    for (const link of graphLinks) {
      const srcId = typeof link.source === 'string' ? link.source : link.source.id;
      const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
      if (!matchingIds.has(srcId) && !matchingIds.has(tgtId)) {
        dimmed.add(link.id);
      }
    }
    setDimmedLinks(dimmed);
  }

  refreshNodeObjects();
  // Force link re-render (including keyword labels)
  graph.linkColor(graph.linkColor());
  graph.linkOpacity(graph.linkOpacity());
  graph.linkThreeObject(graph.linkThreeObject());
}

/**
 * Toggle visibility of auto-detected edges.
 */
export function toggleAutoEdges(visible: boolean): void {
  setAutoLinksVisible(visible);
  if (graph) graph.linkVisibility(graph.linkVisibility());
}

/**
 * Toggle visibility of manual link edges.
 */
export function toggleManualEdges(visible: boolean): void {
  setManualLinksVisible(visible);
  if (graph) graph.linkVisibility(graph.linkVisibility());
}

/**
 * Toggle edge label visibility (no-op in 3D for now; labels are minimal).
 */
export function toggleEdgeLabels(_visible: boolean): void {
  // Edge labels in 3D are handled by linkLabel; minimal impact
}

/**
 * Get the currently selected node's UID, or null.
 */
export function getSelectedNodeUid(): number | null {
  if (!selectedNodeId) return null;
  return parseInt(selectedNodeId);
}

/**
 * Get the current book name from the graph context.
 */
export function getGraphBookName(): string {
  return currentBookName;
}

/**
 * Disable node selection (for connect mode).
 */
export function disableNodeSelect(): void {
  selectDisabled = true;
}

/**
 * Re-enable node selection.
 */
export function enableNodeSelect(): void {
  selectDisabled = false;
}

/**
 * Register a callback for connect mode clicks.
 * When set, node clicks route to this handler instead of normal selection.
 */
export function setConnectModeClickHandler(handler: ((nodeId: string) => void) | null): void {
  connectModeClickHandler = handler;
}

/**
 * Set or clear the connect-source highlight on a node.
 */
export function setNodeConnectSource(nodeId: string | null): void {
  connectSourceId = nodeId;
  refreshNodeObjects();
}

/**
 * Set the view mode (cards or sprites) and re-render nodes.
 */
export function setViewMode(mode: ViewMode): void {
  currentViewMode = mode;
  refreshNodeObjects();
}

/**
 * Get the current view mode.
 */
export function getViewMode(): ViewMode {
  return currentViewMode;
}

/**
 * Enable or disable auto-orbit (slow idle rotation).
 */
export function setAutoOrbit(enabled: boolean): void {
  autoOrbitEnabled = enabled;
  if (graph) {
    const controls = graph.controls();
    if (controls) {
      controls.autoRotate = enabled;
      controls.autoRotateSpeed = 0.4;
    }
  }
}

/**
 * Get the current auto-orbit state.
 */
export function getAutoOrbit(): boolean {
  return autoOrbitEnabled;
}

// --- Internal helpers ---

function preventContextMenu(e: Event): void {
  e.preventDefault();
}

function buildNode(
  entry: LorebookEntry,
  recursionEdges: RecursionEdge[],
  manualLinks: ManualLinkData[],
  showKeywords: boolean,
): GraphNode {
  const uidStr = String(entry.uid);
  const connectionCount =
    recursionEdges.filter(
      (e) => String(e.sourceUid) === uidStr || String(e.targetUid) === uidStr,
    ).length +
    manualLinks.filter(
      (l) => l.sourceUid === uidStr || l.targetUid === uidStr,
    ).length;

  // Look up studio metadata
  const meta = getEntryMeta(currentBookName, uidStr);
  let categoryColor: string | null = null;
  if (meta.categoryId) {
    const cat = getCategoryById(currentBookName, meta.categoryId);
    if (cat) categoryColor = cat.color;
  }

  return {
    id: uidStr,
    uid: entry.uid,
    label: buildNodeLabel(entry.comment, entry.key, showKeywords),
    comment: entry.comment,
    keys: entry.key,
    keysecondary: entry.keysecondary,
    content: entry.content,
    disabled: entry.disable,
    constant: entry.constant,
    selective: entry.selective,
    orphan: connectionCount === 0,
    connectionCount,
    entryPosition: entry.position,
    depth: entry.depth,
    order: entry.order,
    group: entry.group,
    bookName: currentBookName,
    categoryColor,
    colorOverride: meta.colorOverride,
    status: meta.status,
    pinned: meta.pinned,
    hasNotes: meta.notes.length > 0,
  };
}

function buildAutoLink(edge: RecursionEdge): GraphLink {
  return {
    id: `auto-${edge.sourceUid}-${edge.targetUid}-${edge.triggerKey}`,
    source: String(edge.sourceUid),
    target: String(edge.targetUid),
    type: 'auto',
    keyType: edge.keyType,
    triggerKey: edge.triggerKey.length > 20
      ? edge.triggerKey.substring(0, 17) + '...'
      : edge.triggerKey,
  };
}

function buildManualLink(link: ManualLinkData): GraphLink {
  return {
    id: `manual-${link.sourceUid}-${link.targetUid}`,
    source: link.sourceUid,
    target: link.targetUid,
    type: 'manual',
    triggerKey: link.label || 'manual',
  };
}

function createNodeObject(node: GraphNode): unknown {
  if (currentViewMode === 'sprites') {
    return createLabelSprite(node, selectedNodeId, highlightedNodeIds, connectSourceId);
  }
  return createCardSprite(node, selectedNodeId, highlightedNodeIds, connectSourceId);
}

/**
 * Force all node objects to be recreated (after selection/highlight changes).
 */
function refreshNodeObjects(): void {
  if (!graph) return;
  graph.nodeThreeObject((node: GraphNode) => createNodeObject(node));
}

// --- Event handlers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleNodeClick(node: any, event: MouseEvent): void {
  hideTooltip();

  // Connect mode takes priority
  if (connectModeClickHandler) {
    connectModeClickHandler(node.id);
    return;
  }

  if (selectDisabled) return;

  selectedNodeId = node.id;
  refreshNodeObjects();

  EventBus.emit(STUDIO_EVENTS.NODE_SELECTED, {
    uid: parseInt(node.id),
    bookName: currentBookName,
    nodeData: node,
  });
  void event;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleNodeRightClick(node: any, event: MouseEvent): void {
  hideTooltip();
  EventBus.emit('ls:context-menu', {
    uid: parseInt(node.id),
    bookName: currentBookName,
    nodeData: node,
    position: { x: event.clientX, y: event.clientY },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleNodeHover(node: any, _prevNode: any): void {
  // Clear pending tooltip
  if (tooltipTimer) {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }

  if (!node) {
    hideTooltip();
    // Reset cursor
    if (graphContainer) graphContainer.style.cursor = '';
    return;
  }

  // Show pointer cursor
  if (graphContainer) graphContainer.style.cursor = 'pointer';

  // Show tooltip after brief delay
  tooltipTimer = setTimeout(() => {
    if (graph && node.x !== undefined) {
      const screenCoords = graph.graph2ScreenCoords(node.x, node.y, node.z);
      showTooltip(node, screenCoords);
    }
  }, 300);
}

function handleBackgroundClick(): void {
  hideTooltip();
  if (selectedNodeId) {
    selectedNodeId = null;
    refreshNodeObjects();
    EventBus.emit(STUDIO_EVENTS.NODE_DESELECTED);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleNodeDragEnd(node: any): void {
  // Pin the node where it was dropped
  node.fx = node.x;
  node.fy = node.y;
  node.fz = node.z;
  savePositions(currentBookName);
}

// --- Tooltip ---

function showTooltip(nodeData: GraphNode, screenPos: { x: number; y: number }): void {
  const tooltip = document.getElementById('ls-tooltip');
  if (!tooltip) return;

  const badges: string[] = [];
  if (nodeData.constant) badges.push('<span class="ls-tooltip-badge ls-tooltip-badge-constant">Constant</span>');
  if (nodeData.disabled) badges.push('<span class="ls-tooltip-badge ls-tooltip-badge-disabled">Disabled</span>');
  if (nodeData.selective) badges.push('<span class="ls-tooltip-badge ls-tooltip-badge-selective">Selective</span>');

  const keys = nodeData.keys || [];
  const keysPreview = keys.length > 0
    ? `<div class="ls-tooltip-keys"><strong>Keys:</strong> ${escapeHtml(keys.slice(0, 5).join(', '))}${keys.length > 5 ? ` +${keys.length - 5}` : ''}</div>`
    : '';

  const content = nodeData.content || '';
  const contentPreview = content.length > 0
    ? `<div class="ls-tooltip-content">${escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}</div>`
    : '';

  const connCount = nodeData.connectionCount || 0;

  tooltip.innerHTML = `
    <div class="ls-tooltip-name">${escapeHtml(nodeData.comment || 'Unnamed Entry')}</div>
    ${badges.length > 0 ? `<div class="ls-tooltip-badges">${badges.join('')}</div>` : ''}
    ${keysPreview}
    ${contentPreview}
    <div class="ls-tooltip-meta">${connCount} connection${connCount !== 1 ? 's' : ''}</div>
  `;

  // Position the tooltip near the node's screen coordinates
  const container = document.getElementById('ls-graph-container');
  if (!container) return;
  const containerRect = container.getBoundingClientRect();

  let left = screenPos.x + containerRect.left + 15;
  let top = screenPos.y + containerRect.top - 10;

  // Keep tooltip within viewport
  const tooltipWidth = 320;
  if (left + tooltipWidth > window.innerWidth) {
    left = screenPos.x + containerRect.left - tooltipWidth - 15;
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

// --- Position persistence ---

function savePositions(bookName: string): void {
  if (!bookName || graphNodes.length === 0) return;

  const settings = getSettings();
  const positions: Record<string, { x: number; y: number; z: number }> = {};

  for (const node of graphNodes) {
    if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
      positions[node.id] = { x: node.x, y: node.y, z: node.z };
    }
  }

  settings.savedPositions[bookName] = positions;
  updateSettings({});
}

function restorePositions(bookName: string, nodes: GraphNode[]): boolean {
  if (!bookName) return false;

  const settings = getSettings();
  const positions = settings.savedPositions[bookName];
  if (!positions) return false;

  let hasPositions = false;
  for (const node of nodes) {
    const saved = positions[node.id] as { x: number; y: number; z?: number } | undefined;
    if (saved) {
      node.x = saved.x;
      node.y = saved.y;
      node.z = saved.z ?? 0;
      node.fx = saved.x;
      node.fy = saved.y;
      node.fz = saved.z ?? 0;
      hasPositions = true;
    }
  }

  return hasPositions;
}

function getThemeBackground(theme?: ThemeName | string): string {
  switch (theme) {
    case 'nebula': return '#0f0a1a';
    case 'ember': return '#161010';
    case 'arctic': return '#0a1218';
    default: return '#13111c';
  }
}

function zoomToFitAll(): void {
  if (graph) {
    graph.zoomToFit(400, 50);
  }
}
