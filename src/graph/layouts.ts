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
    case 'cose':
      return {
        name: 'cose',
        animate: nodeCount < 100,
        animationDuration: 500,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        edgeElasticity: () => 100,
        nestingFactor: 1.2,
        gravity: 1,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
        padding: 50,
        randomize: false,
      };

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
