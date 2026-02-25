/**
 * Layout algorithm configurations for Cytoscape.js.
 */

export type LayoutName = 'cose' | 'grid' | 'circle' | 'breadthfirst';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LayoutConfig = Record<string, any>;

/**
 * Get a layout configuration by name.
 */
export function getLayoutConfig(
  name: LayoutName,
  nodeCount: number,
): LayoutConfig {
  switch (name) {
    case 'cose': {
      // Scale parameters with graph size for better spacing
      const repulsion = 8000 + nodeCount * 50;
      const edgeLen = 120 + Math.min(nodeCount * 0.8, 200);
      const grav = Math.max(0.15, 1 - nodeCount * 0.005);
      const iters = Math.max(1000, nodeCount * 10);
      return {
        name: 'cose',
        animate: nodeCount < 80,
        animationDuration: 500,
        nodeRepulsion: () => repulsion,
        idealEdgeLength: () => edgeLen,
        edgeElasticity: () => 45,
        nestingFactor: 1.2,
        gravity: grav,
        numIter: iters,
        initialTemp: 300,
        coolingFactor: 0.93,
        minTemp: 0.5,
        padding: 60,
        randomize: true,
      };
    }

    case 'grid':
      return {
        name: 'grid',
        animate: true,
        animationDuration: 500,
        padding: 30,
        avoidOverlap: true,
        avoidOverlapPadding: 20,
        condense: false,
      };

    case 'circle':
      return {
        name: 'circle',
        animate: true,
        animationDuration: 500,
        padding: 30,
        avoidOverlap: true,
        spacingFactor: 1.5,
      };

    case 'breadthfirst':
      return {
        name: 'breadthfirst',
        animate: true,
        animationDuration: 500,
        directed: true,
        padding: 30,
        spacingFactor: 1.2,
        avoidOverlap: true,
      };

    default:
      return getLayoutConfig('cose', nodeCount);
  }
}

/**
 * Get all available layout names with display labels.
 */
export function getAvailableLayouts(): Array<{ name: LayoutName; label: string }> {
  return [
    { name: 'cose', label: 'Force-Directed' },
    { name: 'grid', label: 'Grid' },
    { name: 'circle', label: 'Circle' },
    { name: 'breadthfirst', label: 'Hierarchical' },
  ];
}
