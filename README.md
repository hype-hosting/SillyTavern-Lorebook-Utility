# Lorebook Studio

A visual **3D node-graph** lorebook editor for [SillyTavern](https://github.com/SillyTavern/SillyTavern). See your lorebook entries as interactive nodes floating in a 3D space, visualize recursion links between them, and edit everything from a single graph workspace.

Built for botmakers who think visually.

## Features

### 3D Graph Visualization
- Lorebook entries rendered as **floating card nodes** in an interactive 3D space powered by WebGL
- **Orbit, rotate, and zoom** -- click-drag to rotate the graph, scroll to zoom, right-drag to pan
- **Two view modes** -- toggle between detailed **Card view** (name + keyword preview) and minimal **Label view** for a constellation-like feel
- **Automatic recursion detection** -- scans entry content for keywords that trigger other entries and draws directed connection lines
- **Manual links** -- create your own custom connections between entries for organizational purposes
- **Color-coded nodes** -- purple (enabled), gray (disabled), yellow (selected), orange border (orphan/no connections), green border (constant)
- Directional arrow edges with labels showing the triggering keyword
- Auto-detected links shown as straight blue lines; manual links as curved pink lines

### Full Editing Suite
- Click any node to open the **editing sidebar** with all World Info fields: name, keys, secondary keys, content, position, depth, order, probability, group, and all toggles
- **Create** new entries directly from the graph view
- **Duplicate** entries with one click
- **Delete** entries with confirmation
- **Manual link creation** via "Connect to..." dropdown in the sidebar
- **Right-click context menu** on any node for quick actions

### Search and Filter
- Real-time **full-text search** across entry names, keys, and content
- Non-matching nodes fade out while matches stay highlighted
- Quick filter buttons: **Orphans** (entries with no connections), **Disabled** entries

### Statistics Dashboard
- Total entry count with enabled/disabled/constant breakdown
- Connection counts (auto-detected vs manual, primary vs secondary key links)
- **Most connected entries** (top 5) -- click to navigate
- **Orphan entries** list -- click to navigate
- **Health checks**: empty content warnings, missing keys, duplicate key detection

### 3D Layout Options
- **Force-Directed 3D** -- default, organic force-simulated clustering in 3D space
- **3D Grid** -- ordered cubic grid arrangement
- **Sphere** -- entries distributed on a sphere surface (Fibonacci distribution)
- **Helix** -- entries arranged along a helical spiral
- Zoom in/out and fit-to-screen controls
- **Node positions are saved** per lorebook and persist across sessions (drag to pin)

### Seamless Integration
- Full-page **drawer UI** slides in from the right (~95% viewport width)
- One-click launch from SillyTavern's World Info panel
- Close with ESC key, backdrop click, or the close button
- Auto-refreshes when lorebook data changes in SillyTavern
- All settings saved through SillyTavern's extension settings system
- Keyboard shortcuts: ESC (close sidebar/drawer), Delete (delete selected node), Ctrl+D (duplicate)

## Installation

1. Open SillyTavern
2. Go to **Extensions** (puzzle piece icon)
3. Click **Install Extension**
4. Paste this URL:
   ```
   https://github.com/hype-hosting/SillyTavern-Lorebook-Utility
   ```
5. Click Install and reload SillyTavern

The extension comes pre-built -- no additional setup required.

## Usage

1. Open any lorebook in SillyTavern's **World Info** panel
2. Click the **Lorebook Studio** button that appears in the panel header
3. The graph view opens as a full-page drawer showing all your entries as 3D nodes
4. **Select a lorebook** from the dropdown if not auto-detected
5. **Click-drag the background** to orbit and rotate the 3D view
6. **Scroll** to zoom in and out
7. **Click a node** to open the editing sidebar
8. **Drag nodes** to rearrange -- positions are saved automatically
9. Use the **Cards/Labels** button to toggle between view modes
10. Use the **toolbar** to search, filter, switch layouts, or toggle link visibility
11. Click **Stats** to see connection analysis and health checks

## Building from Source

If you want to modify the extension or contribute:

```bash
# Clone the repo
git clone https://github.com/hype-hosting/SillyTavern-Lorebook-Utility.git
cd SillyTavern-Lorebook-Utility

# Install dependencies
npm install

# Build for production
npm run build

# Build for development (unminified, with source maps)
npm run build:dev

# Lint
npm run lint
```

The compiled output goes to `dist/index.js`.

### Tech Stack

- **TypeScript** + **Webpack** build system
- **3d-force-graph** (Three.js / WebGL) for 3D graph rendering
- **three-spritetext** for billboard text node labels
- **d3-force-3d** for physics simulation
- SillyTavern extension API for data access and persistence

## Project Structure

```
src/
  index.ts                 # Extension entry point
  style.css                # UI stylesheet (dark theme)
  templates/drawer.html    # Drawer HTML template
  data/
    lorebookData.ts        # SillyTavern World Info read/write
    recursionDetector.ts   # Key-in-content scanning algorithm
    manualLinks.ts         # Manual link storage and CRUD
  graph/
    graphManager.ts        # 3d-force-graph instance lifecycle
    nodeStyles.ts          # SpriteText card/label node rendering
    edgeStyles.ts          # Edge styling (auto vs manual links)
    layouts.ts             # 3D layout algorithms (force, grid, sphere, helix)
  ui/
    drawer.ts              # Full-page drawer component
    toolbar.ts             # Search, filters, layout controls
    sidebar.ts             # Entry editing panel
    contextMenu.ts         # Right-click context menu
    connectMode.ts         # Two-click manual link creation
    statsPanel.ts          # Statistics dashboard
  features/
    entryCrud.ts           # Create/duplicate/delete operations
  utils/
    events.ts              # Internal event bus + ST events
    settings.ts            # Extension settings persistence
```

## Support

If you find Lorebook Studio useful, consider supporting development:

- [Support on Ko-fi](https://ko-fi.com/hype)
- [Join the Discord](https://discord.gg/therealhype)

## License

[GPL-3.0](LICENSE)
