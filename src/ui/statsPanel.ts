/**
 * Statistics dashboard for Lorebook Studio.
 * Shows entry counts, connection analysis, and health checks.
 */

import { getEntries } from '../data/lorebookData';
import { detectRecursions, getRecursionStats, RecursionEdge } from '../data/recursionDetector';
import { getManualLinks } from '../data/manualLinks';
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

  // Compute stats
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

  // Find orphan entries (no connections)
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

  // Most connected entries
  const connectionCounts = new Map<number, number>();
  for (const entry of entries) {
    connectionCounts.set(entry.uid, 0);
  }
  for (const edge of recursionEdges) {
    connectionCounts.set(
      edge.sourceUid,
      (connectionCounts.get(edge.sourceUid) || 0) + 1,
    );
    connectionCounts.set(
      edge.targetUid,
      (connectionCounts.get(edge.targetUid) || 0) + 1,
    );
  }
  const topConnected = [...connectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .filter(([, count]) => count > 0);

  // Key overlap detection
  const keyToEntries = new Map<string, number[]>();
  for (const entry of entries) {
    for (const key of entry.key) {
      const normalized = key.trim().toLowerCase();
      if (!normalized) continue;
      if (!keyToEntries.has(normalized)) {
        keyToEntries.set(normalized, []);
      }
      keyToEntries.get(normalized)!.push(entry.uid);
    }
  }
  const duplicateKeys = [...keyToEntries.entries()].filter(
    ([, uids]) => uids.length > 1,
  );

  // Render HTML
  body.innerHTML = `
    <!-- Overview -->
    <div class="ls-stat-row">
      <span class="ls-stat-label">Total Entries</span>
      <span class="ls-stat-value">${totalEntries}</span>
    </div>
    <div class="ls-stat-row">
      <span class="ls-stat-label">Enabled</span>
      <span class="ls-stat-value">${enabledEntries}</span>
    </div>
    <div class="ls-stat-row">
      <span class="ls-stat-label">Disabled</span>
      <span class="ls-stat-value">${disabledEntries}</span>
    </div>
    <div class="ls-stat-row">
      <span class="ls-stat-label">Constant</span>
      <span class="ls-stat-value">${constantEntries}</span>
    </div>
    <div class="ls-stat-row">
      <span class="ls-stat-label">Avg Content Length</span>
      <span class="ls-stat-value">${avgContentLength} chars</span>
    </div>

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
        <span class="ls-stat-label">Primary Key Links</span>
        <span class="ls-stat-value">${recursionStats.primaryConnections}</span>
      </div>
      <div class="ls-stat-row">
        <span class="ls-stat-label">Secondary Key Links</span>
        <span class="ls-stat-value">${recursionStats.secondaryConnections}</span>
      </div>
    </div>

    <!-- Most Connected -->
    ${
      topConnected.length > 0
        ? `
    <div class="ls-stat-section">
      <h4>Most Connected Entries</h4>
      ${topConnected
        .map(([uid, count]) => {
          const entry = entries.find((e) => e.uid === uid);
          const name = entry?.comment || `Entry ${uid}`;
          return `<div class="ls-stat-list-item" data-uid="${uid}">
            <span>${escapeHtml(name)}</span>
            <span class="ls-stat-value">${count}</span>
          </div>`;
        })
        .join('')}
    </div>`
        : ''
    }

    <!-- Orphans -->
    ${
      orphanEntries.length > 0
        ? `
    <div class="ls-stat-section">
      <h4>Orphan Entries (${orphanEntries.length})</h4>
      ${orphanEntries
        .slice(0, 10)
        .map((entry) => {
          return `<div class="ls-stat-list-item" data-uid="${entry.uid}">
            <span>${escapeHtml(entry.comment || `Entry ${entry.uid}`)}</span>
          </div>`;
        })
        .join('')}
      ${orphanEntries.length > 10 ? `<div style="font-size: 11px; color: var(--ls-text-muted);">...and ${orphanEntries.length - 10} more</div>` : ''}
    </div>`
        : ''
    }

    <!-- Health Checks -->
    <div class="ls-stat-section">
      <h4>Health Checks</h4>
      ${
        emptyContentEntries.length > 0
          ? `<div class="ls-stat-row">
            <span class="ls-stat-label" style="color: var(--ls-warning);">Empty Content</span>
            <span class="ls-stat-value">${emptyContentEntries.length}</span>
          </div>`
          : ''
      }
      ${
        noKeysEntries.length > 0
          ? `<div class="ls-stat-row">
            <span class="ls-stat-label" style="color: var(--ls-warning);">No Primary Keys</span>
            <span class="ls-stat-value">${noKeysEntries.length}</span>
          </div>`
          : ''
      }
      ${
        duplicateKeys.length > 0
          ? `<div class="ls-stat-row">
            <span class="ls-stat-label" style="color: var(--ls-warning);">Duplicate Keys</span>
            <span class="ls-stat-value">${duplicateKeys.length}</span>
          </div>`
          : ''
      }
      ${
        emptyContentEntries.length === 0 && noKeysEntries.length === 0 && duplicateKeys.length === 0
          ? '<div style="color: var(--ls-success); font-size: 12px;">All checks passed</div>'
          : ''
      }
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
