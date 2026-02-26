/**
 * Detects recursion relationships between lorebook entries by scanning
 * each entry's content for keywords that would trigger other entries.
 */

import { LorebookEntry } from './lorebookData';

export interface RecursionEdge {
  /** UID of the entry whose content triggers the target */
  sourceUid: number;
  /** UID of the entry that gets triggered */
  targetUid: number;
  /** The keyword that causes the trigger */
  triggerKey: string;
  /** Whether this is a primary or secondary key match */
  keyType: 'primary' | 'secondary';
}

/** Cache for recursion detection results */
let cachedEdges: RecursionEdge[] = [];
let cacheHash = '';

/**
 * Detect all recursion relationships between the given entries.
 *
 * For each entry A, check if any of A's activation keys appear in
 * the content of other entries. If entry B's content contains one of
 * entry A's keys, that means B's content would trigger A during
 * ST's recursion scanning.
 *
 * Direction: B -> A (B's content triggers A)
 *
 * Respects per-entry matchWholeWords and caseSensitive settings,
 * matching SillyTavern's own matching behavior.
 */
export function detectRecursions(entries: LorebookEntry[]): RecursionEdge[] {
  const hash = computeHash(entries);
  if (hash === cacheHash && cachedEdges.length > 0) {
    return cachedEdges;
  }

  const edges: RecursionEdge[] = [];

  for (const entryA of entries) {
    // Skip disabled entries or entries with recursion prevention
    if (entryA.disable || entryA.preventRecursion) continue;

    const caseSensitive = entryA.caseSensitive === true;
    const wholeWords = entryA.matchWholeWords === true;

    const primaryKeys = parseKeys(entryA.key, caseSensitive);
    const secondaryKeys = parseKeys(entryA.keysecondary, caseSensitive);

    for (const entryB of entries) {
      if (entryB.uid === entryA.uid) continue;
      if (entryB.disable) continue;
      if (entryB.excludeRecursion) continue;

      const contentToScan = entryB.content;
      if (!contentToScan) continue;

      // Check primary keys
      for (const key of primaryKeys) {
        if (matchKeyInContent(key, contentToScan, caseSensitive, wholeWords)) {
          edges.push({
            sourceUid: entryB.uid,
            targetUid: entryA.uid,
            triggerKey: key.original,
            keyType: 'primary',
          });
          break; // One match per source-target pair for primary keys is enough
        }
      }

      // Check secondary keys if entry uses selective mode
      if (entryA.selective && secondaryKeys.length > 0) {
        for (const key of secondaryKeys) {
          if (matchKeyInContent(key, contentToScan, caseSensitive, wholeWords)) {
            edges.push({
              sourceUid: entryB.uid,
              targetUid: entryA.uid,
              triggerKey: key.original,
              keyType: 'secondary',
            });
            break;
          }
        }
      }
    }
  }

  cachedEdges = edges;
  cacheHash = hash;
  return edges;
}

/**
 * Clear the recursion detection cache.
 */
export function clearRecursionCache(): void {
  cachedEdges = [];
  cacheHash = '';
}

interface ParsedKey {
  original: string;
  regex: RegExp | null;
  plainText: string;
}

/**
 * Parse an array of key strings into searchable patterns.
 * Keys can be plain text or regex patterns (surrounded by / /).
 *
 * @param caseSensitive - Whether the owning entry has case-sensitive matching enabled
 */
function parseKeys(keys: string[], caseSensitive: boolean): ParsedKey[] {
  const parsed: ParsedKey[] = [];

  for (const rawKey of keys) {
    // Each key string might be comma-separated in some ST versions
    const subKeys = rawKey.includes(',')
      ? rawKey.split(',').map((k) => k.trim())
      : [rawKey.trim()];

    for (const key of subKeys) {
      if (!key) continue;

      // Check if it's a regex pattern: /pattern/flags
      const regexMatch = key.match(/^\/(.+)\/([gimsuy]*)$/);
      if (regexMatch) {
        try {
          const regex = new RegExp(regexMatch[1], regexMatch[2] || 'i');
          parsed.push({ original: key, regex, plainText: '' });
        } catch {
          // Invalid regex, treat as plain text
          parsed.push({ original: key, regex: null, plainText: caseSensitive ? key : key.toLowerCase() });
        }
      } else {
        parsed.push({ original: key, regex: null, plainText: caseSensitive ? key : key.toLowerCase() });
      }
    }
  }

  return parsed;
}

/**
 * Check if a parsed key matches within the given content.
 *
 * @param caseSensitive - Whether matching should be case-sensitive
 * @param wholeWords - Whether matching should require whole-word boundaries
 */
function matchKeyInContent(
  key: ParsedKey,
  content: string,
  caseSensitive: boolean,
  wholeWords: boolean,
): boolean {
  if (key.regex) {
    return key.regex.test(content);
  }

  if (!key.plainText) return false;

  const haystack = caseSensitive ? content : content.toLowerCase();

  if (wholeWords) {
    // Use word-boundary regex to match whole words only,
    // matching SillyTavern's own behavior
    const escaped = key.plainText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = caseSensitive ? '' : 'i';
    const wordRegex = new RegExp(`\\b${escaped}\\b`, flags);
    return wordRegex.test(content);
  }

  return haystack.includes(key.plainText);
}

/**
 * Compute a simple hash of entries for cache invalidation.
 */
function computeHash(entries: LorebookEntry[]): string {
  // Use a combination of entry count, UIDs, key content, and matching settings
  const parts = entries.map(
    (e) =>
      `${e.uid}:${e.key.join(',')}:${e.keysecondary.join(',')}:${e.content.length}:${e.disable}:${e.excludeRecursion}:${e.preventRecursion}:${e.caseSensitive}:${e.matchWholeWords}`,
  );
  return parts.join('|');
}

/**
 * Get summary statistics about recursion connections.
 */
export function getRecursionStats(edges: RecursionEdge[]): {
  totalConnections: number;
  primaryConnections: number;
  secondaryConnections: number;
  uniqueSources: number;
  uniqueTargets: number;
} {
  const sources = new Set(edges.map((e) => e.sourceUid));
  const targets = new Set(edges.map((e) => e.targetUid));

  return {
    totalConnections: edges.length,
    primaryConnections: edges.filter((e) => e.keyType === 'primary').length,
    secondaryConnections: edges.filter((e) => e.keyType === 'secondary').length,
    uniqueSources: sources.size,
    uniqueTargets: targets.size,
  };
}
