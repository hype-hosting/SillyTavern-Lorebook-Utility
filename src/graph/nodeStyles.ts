/**
 * Cytoscape.js node style definitions for card-style lorebook entry nodes.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StyleDef = { selector: string; style: Record<string, any> };

export function getNodeStylesheet(): StyleDef[] {
  return [
    {
      selector: 'node',
      style: {
        'shape': 'roundrectangle',
        'width': 220,
        'height': 80,
        'background-color': '#4a9eff',
        'border-width': 2,
        'border-color': '#3a8eef',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '200px',
        'font-size': 12,
        'font-weight': 'bold',
        'color': '#ffffff',
        'text-outline-width': 0,
        'padding': 10,
      },
    },
    // Disabled entries
    {
      selector: 'node[?disabled]',
      style: {
        'background-color': '#6b7280',
        'border-color': '#4b5563',
        'border-style': 'dashed',
        'color': '#d1d5db',
        'opacity': 0.7,
      },
    },
    // Constant entries
    {
      selector: 'node[?constant]',
      style: {
        'border-color': '#10b981',
        'border-width': 3,
        'background-color': '#2d4a5e',
      },
    },
    // Selected node
    {
      selector: 'node:selected',
      style: {
        'background-color': '#f59e0b',
        'border-color': '#d97706',
        'border-width': 3,
        'color': '#1a1a2e',
      },
    },
    // Orphan nodes (no connections) - red dashed border + subtle tint
    {
      selector: 'node[?orphan]',
      style: {
        'border-color': '#ef4444',
        'border-style': 'dashed',
        'border-width': 2,
        'background-color': '#3a2020',
      },
    },
    // Nodes with many connections - slightly larger
    {
      selector: 'node[connectionCount > 5]',
      style: {
        'width': 240,
        'height': 90,
        'font-size': 13,
      },
    },
    // Highlighted (search match)
    {
      selector: 'node.ls-highlighted',
      style: {
        'background-color': '#8b5cf6',
        'border-color': '#7c3aed',
        'border-width': 3,
      },
    },
    // Dimmed (search non-match)
    {
      selector: 'node.ls-dimmed',
      style: {
        'opacity': 0.2,
      },
    },
    // Hover
    {
      selector: 'node.ls-hover',
      style: {
        'border-width': 3,
        'border-color': '#ffffff',
      },
    },
    // Connect mode: source node glow
    {
      selector: 'node.ls-connect-source',
      style: {
        'border-width': 4,
        'border-color': '#f472b6',
        'shadow-blur': 15,
        'shadow-color': '#f472b6',
        'shadow-opacity': 0.6,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
      },
    },
  ];
}

/**
 * Build a label for a node from its entry data.
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

  // Show first 3 keys
  const keyPreview = keys.slice(0, 3).join(', ');
  const suffix = keys.length > 3 ? ` +${keys.length - 3}` : '';
  return `${name}\n[${keyPreview}${suffix}]`;
}
