/**
 * Card manager — orchestrates up to 2 entry editor panes in a flex row.
 */

import { EntryCard } from './entryCard';
import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { resizeGraph } from '../graph/graphManager';

let cards: [EntryCard, EntryCard] | null = null;

/**
 * Initialize the card manager: create 2 EntryCard instances inside the given parent.
 */
export function initCardManager(parent: HTMLElement): void {
  cards = [
    new EntryCard(0, parent),
    new EntryCard(1, parent),
  ];
}

/**
 * Open an entry in an available card slot.
 * - If entry already open → focus that card
 * - Find empty slot → open there
 * - Both full → close slot 0, open new entry there
 */
export function openEntryCard(uid: number, bookName: string): void {
  if (!cards) return;

  // Already open in a card? Focus it.
  for (const card of cards) {
    if (card.isOpen() && card.getEntryUid() === uid) {
      return; // already visible
    }
  }

  // Find first empty slot
  for (const card of cards) {
    if (!card.isOpen()) {
      card.open(uid, bookName);
      onCardLayoutChanged();
      return;
    }
  }

  // Both full — close slot 0, open new entry there
  cards[0].close();
  cards[0].open(uid, bookName);
  onCardLayoutChanged();
}

/**
 * Close all open cards.
 */
export function closeAllCards(): void {
  if (!cards) return;
  for (const card of cards) {
    if (card.isOpen()) card.close();
  }
}

/**
 * Close the card showing a specific entry uid (if any).
 */
export function closeCardByUid(uid: number): void {
  if (!cards) return;
  for (const card of cards) {
    if (card.isOpen() && card.getEntryUid() === uid) {
      card.close();
      onCardLayoutChanged();
      return;
    }
  }
}

/**
 * Check if any card is currently open.
 */
export function hasOpenCards(): boolean {
  if (!cards) return false;
  return cards[0].isOpen() || cards[1].isOpen();
}

/**
 * Called after card open/close to let the graph resize to its new flex size.
 */
function onCardLayoutChanged(): void {
  setTimeout(() => resizeGraph(), 350);
}

// Listen for card close events to trigger graph resize
EventBus.on(STUDIO_EVENTS.ENTRY_CARD_CLOSED, () => {
  onCardLayoutChanged();
});
