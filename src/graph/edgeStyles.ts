/**
 * Cytoscape.js edge style definitions for recursion and manual links.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StyleDef = { selector: string; style: Record<string, any> };

export function getEdgeStylesheet(): StyleDef[] {
  return [
    // Base edge style
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#60a5fa',
        'line-color': '#60a5fa',
        'width': 2,
        'opacity': 0.8,
        'arrow-scale': 1.2,
      },
    },
    // Auto-detected recursion edges
    {
      selector: 'edge[type = "auto"]',
      style: {
        'line-style': 'solid',
        'line-color': '#60a5fa',
        'target-arrow-color': '#60a5fa',
        'label': 'data(triggerKey)',
        'font-size': 9,
        'color': '#93c5fd',
        'text-rotation': 'autorotate',
        'text-background-color': '#1a1a2e',
        'text-background-opacity': 0.8,
        'text-background-padding': '2px',
        'text-margin-y': -10,
      },
    },
    // Manual link edges
    {
      selector: 'edge[type = "manual"]',
      style: {
        'line-style': 'dashed',
        'line-color': '#f472b6',
        'target-arrow-color': '#f472b6',
        'line-dash-pattern': [6, 3],
        'label': 'data(triggerKey)',
        'font-size': 9,
        'color': '#f9a8d4',
        'text-rotation': 'autorotate',
        'text-background-color': '#1a1a2e',
        'text-background-opacity': 0.8,
        'text-background-padding': '2px',
        'text-margin-y': -10,
      },
    },
    // Secondary key edges
    {
      selector: 'edge[keyType = "secondary"]',
      style: {
        'line-style': 'dotted',
        'opacity': 0.6,
      },
    },
    // Selected edge
    {
      selector: 'edge:selected',
      style: {
        'width': 3,
        'opacity': 1,
        'line-color': '#f59e0b',
        'target-arrow-color': '#f59e0b',
      },
    },
    // Hover state
    {
      selector: 'edge.ls-hover',
      style: {
        'width': 3,
        'opacity': 1,
      },
    },
    // Dimmed (search non-match)
    {
      selector: 'edge.ls-dimmed',
      style: {
        'opacity': 0.1,
      },
    },
    // Hidden (toggle off)
    {
      selector: 'edge.ls-hidden',
      style: {
        'display': 'none',
      },
    },
    // Edge labels hidden
    {
      selector: 'edge.ls-no-label',
      style: {
        'label': '',
      },
    },
  ];
}
