/**
 * Cytoscape.js edge style definitions for recursion and manual links.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StyleDef = { selector: string; style: Record<string, any> };

export function getEdgeStylesheet(): StyleDef[] {
  return [
    // Base edge — thin, curved, subtle
    {
      selector: 'edge',
      style: {
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [40],
        'control-point-weights': [0.5],
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#5a72a0',
        'line-color': '#5a72a0',
        'width': 1.5,
        'opacity': 0.5,
        'arrow-scale': 0.9,
      },
    },
    // Auto-detected recursion edges — blue-ish
    {
      selector: 'edge[type = "auto"]',
      style: {
        'line-style': 'solid',
        'line-color': '#5a72a0',
        'target-arrow-color': '#5a72a0',
        'label': 'data(triggerKey)',
        'font-size': 8,
        'color': '#7a8fb5',
        'text-rotation': 'autorotate',
        'text-background-color': '#13111c',
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
        'text-margin-y': -8,
      },
    },
    // Manual link edges — warm pink/mauve
    {
      selector: 'edge[type = "manual"]',
      style: {
        'line-style': 'dashed',
        'line-color': '#b07898',
        'target-arrow-color': '#b07898',
        'line-dash-pattern': [8, 4],
        'label': 'data(triggerKey)',
        'font-size': 8,
        'color': '#c8a0b8',
        'text-rotation': 'autorotate',
        'text-background-color': '#13111c',
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
        'text-margin-y': -8,
      },
    },
    // Secondary key edges
    {
      selector: 'edge[keyType = "secondary"]',
      style: {
        'line-style': 'dotted',
        'opacity': 0.35,
      },
    },
    // Selected edge — warm gold
    {
      selector: 'edge:selected',
      style: {
        'width': 2.5,
        'opacity': 0.9,
        'line-color': '#fbbf24',
        'target-arrow-color': '#fbbf24',
      },
    },
    // Hover state
    {
      selector: 'edge.ls-hover',
      style: {
        'width': 2.5,
        'opacity': 0.85,
      },
    },
    // Dimmed (search non-match)
    {
      selector: 'edge.ls-dimmed',
      style: {
        'opacity': 0.05,
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
