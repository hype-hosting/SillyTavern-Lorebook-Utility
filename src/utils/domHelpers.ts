/**
 * Shared DOM utility functions for Lorebook Studio.
 */

/**
 * Escape a string for safe insertion into HTML.
 * Uses the browser's own text-node escaping for correctness.
 */
const escapeDiv = document.createElement('div');

export function escapeHtml(str: string): string {
  escapeDiv.textContent = str;
  return escapeDiv.innerHTML;
}
