/**
 * Statistics dashboard for Lorebook Studio.
 * Shows entry counts, connection analysis, studio metadata stats, and health checks.
 */

import { getEntries } from '../data/lorebookData';
import { detectRecursions, getRecursionStats } from '../data/recursionDetector';
import { getManualLinks } from '../data/manualLinks';
import { getCategories, getEntryMeta, getAllTags } from '../data/studioData';
import { getCurrentBookName } from './drawer';
import { focusNode } from '../graph/graphManager';

/**
 * Initialize stats panel events.
 */
export function initStatsPanel(): void {
  document.getElementById('ls-btn-stats')?.addEventListener('click', toggleStatsPanel);
  document.getElementById('ls-stats-close')?.addEventListener('click', closeStatsPanel);
}

function toggleStatsPanel(): void {
  const panel = document.getElementById('ls-stats-panel');
  if (!panel) return;

  if (panel.classList.contains('ls-stats-hidden')) {
    openStatsPanel();
  } else {
    closeStatsPanel();
  }
}

function openStatsPanel(): void {
  const panel = document.getElementById('ls-stats-panel');
  if (!panel) return;

  computeAndRender();
  panel.classList.remove('ls-stats-hidden');
}

function closeStatsPanel(): void {
  const panel = document.getElementById('ls-stats-panel');
  panel?.classList.add('ls-stats-hidden');
}

function computeAndRender(): void {
  const bookName = getCurrentBookName();
  if (!bookName) return;

  const body = document.getElementById('ls-stats-body');
  if (!body) return;

  const entries = getEntries(bookName);
  const recursionEdges = detectRecursions(entries);
  const manualLinksList = getManualLinks(bookName);
  const recursionStats = getRecursionStats(recursionEdges);
  const categories = getCategories(bookName);

  // Basic stats
  const totalEntries = entries.length;
  const enabledEntries = entries.filter((e) => !e.disable).length;
  const disabledEntries = totalEntries - enabledEntries;
  const constantEntries = entries.filter((e) => e.constant).length;

  const avgContentLength =
    totalEntries > 0
      ? Math.round(
          entries.reduce((sum, e) => sum + e.content.length, 0) / totalEntries,
        )
      : 0;

  const emptyContentEntries = entries.filter((e) => !e.content.trim());
  const noKeysEntries = entries.filter(
    (e) => e.key.length === 0 || e.key.every((k) => !k.trim()),
  );

  // Orphans
  const connectedUids = new Set<number>();
  for (const edge of recursionEdges) {
    connectedUids.add(edge.sourceUid);
    connectedUids.add(edge.targetUid);
  }
  for (const link of manualLinksList) {
    connectedUids.add(parseInt(link.sourceUid));
    connectedUids.add(parseInt(link.targetUid));
  }
  const orphanEntries = entries.filter((e) => !connectedUids.has(e.uid));

  // Most connected
  const connectionCounts = new Map<number, number>();
  for (const entry of entries) {
    connectionCounts.set(entry.uid, 0);
  }
  for (const edge of recursionEdges) {
    connectionCounts.set(edge.sourceUid, (connectionCounts.get(edge.sourceUid) || 0) + 1);
    connectionCounts.set(edge.targetUid, (connectionCounts.get(edge.targetUid) || 0) + 1);
  }
  const topConnected = [...connectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .filter(([, count]) => count > 0);

  // Duplicate keys
  const keyToEntries = new Map<string, number[]>();
  for (const entry of entries) {
    for (const key of entry.key) {
      const normalized = key.trim().toLowerCase();
      if (!normalized) continue;
      if (!keyToEntries.has(normalized)) keyToEntries.set(normalized, []);
      keyToEntries.get(normalized)!.push(entry.uid);
    }
  }
  const duplicateKeys = [...keyToEntries.entries()].filter(([, uids]) => uids.length > 1);

  // --- Studio stats ---
  const categoryCounts = new Map<string, number>();
  let uncategorizedCount = 0;
  let pinnedCount = 0;
  let withNotesCount = 0;
  const statusCounts = new Map<string, number>();

  for (const entry of entries) {
    const meta = getEntryMeta(bookName, String(entry.uid));
    if (meta.categoryId) {
      categoryCounts.set(meta.categoryId, (categoryCounts.get(meta.categoryId) || 0) + 1);
    } else {
      uncategorizedCount++;
    }
    if (meta.pinned) pinnedCount++;
    if (meta.notes.length > 0) withNotesCount++;
    if (meta.status) {
      statusCounts.set(meta.status, (statusCounts.get(meta.status) || 0) + 1);
    }
  }

  // Tags
  const allTags = getAllTags(bookName);
  const tagCounts = new Map<string, number>();
  for (const entry of entries) {
    const meta = getEntryMeta(bookName, String(entry.uid));
    for (const tag of meta.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Render HTML
  body.innerHTML = `
    <!-- Overview -->
    <div class="ls-stat-row">
      <span class="ls-stat-label">Total Entries</span>
      <span class="ls-stat-value">${totalEntries}</span>
    </div>
    <div class="ls-stat-row">
      <span class="ls-stat-label">Enabled / Disabled</span>
      <span class="ls-stat-value">${enabledEntries} / ${disabledEntries}</span>
    </div>
    <div class="ls-stat-row">
      <span class="ls-stat-label">Constant</span>
      <span class="ls-stat-value">${constantEntries}</span>
    </div>
    <div class="ls-stat-row">
      <span class="ls-stat-label">Avg Content Length</span>
      <span class="ls-stat-value">${avgContentLength} chars</span>
    </div>
    <div class="ls-stat-row">
      <span class="ls-stat-label">Pinned</span>
      <span class="ls-stat-value">${pinnedCount}</span>
    </div>
    <div class="ls-stat-row">
      <span class="ls-stat-label">With Notes</span>
      <span class="ls-stat-value">${withNotesCount}</span>
    </div>

    <!-- Categories -->
    ${categories.length > 0 ? `
    <div class="ls-stat-section">
      <h4>Categories</h4>
      ${categories.map((cat) => {
        const count = categoryCounts.get(cat.id) || 0;
        return `<div class="ls-stat-row">
          <span class="ls-stat-label"><span class="ls-stat-swatch" style="background:${cat.color}"></span>${escapeHtml(cat.name)}</span>
          <span class="ls-stat-value">${count}</span>
        </div>`;
      }).join('')}
      <div class="ls-stat-row">
        <span class="ls-stat-label" style="color: var(--ls-text-muted);">Uncategorized</span>
        <span class="ls-stat-value">${uncategorizedCount}</span>
      </div>
    </div>` : ''}

    <!-- Status Breakdown -->
    ${statusCounts.size > 0 ? `
    <div class="ls-stat-section">
      <h4>Workflow Status</h4>
      ${['draft', 'in-progress', 'review', 'complete'].map((s) => {
        const count = statusCounts.get(s) || 0;
        if (count === 0) return '';
        const label = s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ');
        return `<div class="ls-stat-row">
          <span class="ls-stat-label">${label}</span>
          <span class="ls-stat-value">${count}</span>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Tags -->
    ${topTags.length > 0 ? `
    <div class="ls-stat-section">
      <h4>Tags (${allTags.length} unique)</h4>
      ${topTags.map(([tag, count]) => {
        return `<div class="ls-stat-row">
          <span class="ls-stat-label"><span class="ls-tag-pill ls-tag-pill-sm">${escapeHtml(tag)}</span></span>
          <span class="ls-stat-value">${count}</span>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Connections -->
    <div class="ls-stat-section">
      <h4>Connections</h4>
      <div class="ls-stat-row">
        <span class="ls-stat-label">Auto-detected Links</span>
        <span class="ls-stat-value">${recursionStats.totalConnections}</span>
      </div>
      <div class="ls-stat-row">
        <span class="ls-stat-label">Manual Links</span>
        <span class="ls-stat-value">${manualLinksList.length}</span>
      </div>
      <div class="ls-stat-row">
        <span class="ls-stat-label">Primary / Secondary</span>
        <span class="ls-stat-value">${recursionStats.primaryConnections} / ${recursionStats.secondaryConnections}</span>
      </div>
    </div>

    <!-- Most Connected -->
    ${topConnected.length > 0 ? `
    <div class="ls-stat-section">
      <h4>Most Connected</h4>
      ${topConnected.map(([uid, count]) => {
        const entry = entries.find((e) => e.uid === uid);
        const name = entry?.comment || `Entry ${uid}`;
        return `<div class="ls-stat-list-item" data-uid="${uid}">
          <span>${escapeHtml(name)}</span>
          <span class="ls-stat-value">${count}</span>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Orphans -->
    ${orphanEntries.length > 0 ? `
    <div class="ls-stat-section">
      <h4>Orphans (${orphanEntries.length})</h4>
      ${orphanEntries.slice(0, 10).map((entry) => {
        return `<div class="ls-stat-list-item" data-uid="${entry.uid}">
          <span>${escapeHtml(entry.comment || `Entry ${entry.uid}`)}</span>
        </div>`;
      }).join('')}
      ${orphanEntries.length > 10 ? `<div style="font-size: 11px; color: var(--ls-text-muted);">...and ${orphanEntries.length - 10} more</div>` : ''}
    </div>` : ''}

    <!-- Health Checks -->
    <div class="ls-stat-section">
      <h4>Health Checks</h4>
      ${emptyContentEntries.length > 0 ? `<div class="ls-stat-row">
        <span class="ls-stat-label" style="color: var(--ls-warning);">Empty Content</span>
        <span class="ls-stat-value">${emptyContentEntries.length}</span>
      </div>` : ''}
      ${noKeysEntries.length > 0 ? `<div class="ls-stat-row">
        <span class="ls-stat-label" style="color: var(--ls-warning);">No Primary Keys</span>
        <span class="ls-stat-value">${noKeysEntries.length}</span>
      </div>` : ''}
      ${duplicateKeys.length > 0 ? `<div class="ls-stat-row">
        <span class="ls-stat-label" style="color: var(--ls-warning);">Duplicate Keys</span>
        <span class="ls-stat-value">${duplicateKeys.length}</span>
      </div>` : ''}
      ${emptyContentEntries.length === 0 && noKeysEntries.length === 0 && duplicateKeys.length === 0
        ? '<div style="color: var(--ls-success); font-size: 12px;">All checks passed</div>'
        : ''}
    </div>
  `;

  // Make clickable items navigate to nodes
  body.querySelectorAll('.ls-stat-list-item[data-uid]').forEach((item) => {
    item.addEventListener('click', () => {
      const uid = (item as HTMLElement).dataset.uid;
      if (uid) {
        focusNode(uid);
        closeStatsPanel();
      }
    });
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
