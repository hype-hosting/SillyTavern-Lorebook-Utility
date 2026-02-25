/**
 * Cytoscape.js node style definitions for card-style lorebook entry nodes.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StyleDef = { selector: string; style: Record<string, any> };

export function getNodeStylesheet(): StyleDef[] {
  return [
    // Base node: soft purple-blue with rounded feel
    {
      selector: 'node',
      style: {
        'shape': 'roundrectangle',
        'width': 170,
        'height': 50,
        'background-color': '#2d2b4e',
        'border-width': 1.5,
        'border-color': '#5a52a0',
        'border-opacity': 0.7,
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'ellipsis',
        'text-max-width': '150px',
        'font-size': 11,
        'color': '#d0ccdf',
        'text-outline-width': 0,
        'padding': 8,
        'overlay-opacity': 0,
      },
    },
    // Disabled entries — faded and dashed
    {
      selector: 'node[?disabled]',
      style: {
        'background-color': '#25232e',
        'border-color': '#454050',
        'border-style': 'dashed',
        'color': '#7a7588',
        'opacity': 0.6,
      },
    },
    // Constant entries — green accent
    {
      selector: 'node[?constant]',
      style: {
        'border-color': '#4ade80',
        'border-width': 2,
        'border-opacity': 0.8,
        'background-color': '#1f2e38',
      },
    },
    // Selected node — warm gold glow
    {
      selector: 'node:selected',
      style: {
        'background-color': '#3d3520',
        'border-color': '#fbbf24',
        'border-width': 2.5,
        'border-opacity': 1,
        'color': '#fde68a',
        'overlay-color': '#fbbf24',
        'overlay-padding': 6,
        'overlay-opacity': 0.08,
      },
    },
    // Orphan nodes — soft amber hint (not harsh red)
    {
      selector: 'node[?orphan]',
      style: {
        'border-color': '#b87333',
        'border-style': 'dashed',
        'border-width': 1.5,
        'border-opacity': 0.5,
        'background-color': '#2a2220',
      },
    },
    // Nodes with many connections — slightly larger
    {
      selector: 'node[connectionCount > 5]',
      style: {
        'width': 195,
        'height': 58,
        'font-size': 12,
        'border-width': 2,
      },
    },
    // Highlighted (search match) — vivid purple
    {
      selector: 'node.ls-highlighted',
      style: {
        'background-color': '#352b5e',
        'border-color': '#a78bfa',
        'border-width': 2.5,
        'border-opacity': 1,
        'color': '#e0d7ff',
      },
    },
    // Dimmed (search non-match)
    {
      selector: 'node.ls-dimmed',
      style: {
        'opacity': 0.15,
      },
    },
    // Hover — subtle lift
    {
      selector: 'node.ls-hover',
      style: {
        'border-width': 2,
        'border-color': '#8b80cc',
        'border-opacity': 1,
        'overlay-color': '#7c6bde',
        'overlay-padding': 4,
        'overlay-opacity': 0.06,
      },
    },
    // Connect mode: source node glow
    {
      selector: 'node.ls-connect-source',
      style: {
        'border-width': 3,
        'border-color': '#d4a0c0',
        'border-opacity': 1,
        'overlay-color': '#d4a0c0',
        'overlay-padding': 8,
        'overlay-opacity': 0.2,
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
