/**
 * Layout configurations for the 3D force graph.
 * Provides force-directed and geometric layout alternatives.
 */

export type LayoutName = 'force' | 'grid' | 'sphere' | 'helix';

/**
 * Configure d3-force-3d forces on the graph based on node count.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configureForces(graph: any, nodeCount: number): void {
  const chargeStrength = -100 - nodeCount * 2;
  const linkDistance = 60 + Math.min(nodeCount * 0.5, 100);

  const charge = graph.d3Force('charge');
  if (charge) charge.strength(chargeStrength);

  const link = graph.d3Force('link');
  if (link) link.distance(linkDistance);
}

/**
 * Apply a layout to the graph nodes.
 * For 'force', releases fixed positions and reheats the simulation.
 * For geometric layouts, computes positions and sets them as fixed.
 */
export function applyLayout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graph: any,
  name: LayoutName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[],
): void {
  switch (name) {
    case 'force':
      // Release all fixed positions and reheat
      nodes.forEach((n) => {
        n.fx = undefined;
        n.fy = undefined;
        n.fz = undefined;
      });
      graph.d3ReheatSimulation();
      break;

    case 'grid':
      applyGridLayout(nodes);
      graph.d3ReheatSimulation();
      break;

    case 'sphere':
      applySphereLayout(nodes);
      graph.d3ReheatSimulation();
      break;

    case 'helix':
      applyHelixLayout(nodes);
      graph.d3ReheatSimulation();
      break;

    default:
      applyLayout(graph, 'force', nodes);
  }
}

function applyGridLayout(nodes: { fx?: number; fy?: number; fz?: number }[]): void {
  const count = nodes.length;
  const cols = Math.max(1, Math.ceil(Math.cbrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const spacing = 50;

  nodes.forEach((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols) % rows;
    const layer = Math.floor(i / (cols * rows));
    node.fx = (col - cols / 2) * spacing;
    node.fy = (row - rows / 2) * spacing;
    node.fz = (layer - 1) * spacing;
  });
}

function applySphereLayout(nodes: { fx?: number; fy?: number; fz?: number }[]): void {
  const count = nodes.length;
  const radius = 40 + count * 2;

  nodes.forEach((node, i) => {
    // Fibonacci sphere distribution
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    node.fx = radius * Math.sin(phi) * Math.cos(theta);
    node.fy = radius * Math.sin(phi) * Math.sin(theta);
    node.fz = radius * Math.cos(phi);
  });
}

function applyHelixLayout(nodes: { fx?: number; fy?: number; fz?: number }[]): void {
  const count = nodes.length;
  const radius = 30 + count;
  const heightStep = 8;
  const turns = Math.max(2, count / 8);

  nodes.forEach((node, i) => {
    const t = i / Math.max(1, count - 1);
    const angle = t * turns * 2 * Math.PI;
    node.fx = radius * Math.cos(angle);
    node.fy = (i - count / 2) * heightStep;
    node.fz = radius * Math.sin(angle);
  });
}

/**
 * Get all available layout names with display labels.
 */
export function getAvailableLayouts(): Array<{ name: LayoutName; label: string }> {
  return [
    { name: 'force', label: 'Force-Directed 3D' },
    { name: 'grid', label: '3D Grid' },
    { name: 'sphere', label: 'Sphere' },
    { name: 'helix', label: 'Helix' },
  ];
}
