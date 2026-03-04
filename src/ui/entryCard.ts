/**
 * Floating entry editor card for Lorebook Studio.
 * Each instance manages its own entry state, DOM, and lifecycle.
 */

import { EventBus, STUDIO_EVENTS } from '../utils/events';
import { LorebookEntry, getEntries, updateEntry, createEntry } from '../data/lorebookData';
import {
  getEntryMeta, updateEntryMeta, getCategories, getAllTags,
} from '../data/studioData';
import { EntryMeta, EntryStatus } from '../utils/settings';
import { focusNode } from '../graph/graphManager';
import { getCurrentBookName } from './drawer';
import { escapeHtml } from '../utils/domHelpers';

export class EntryCard {
  readonly slot: 0 | 1;
  private selectedEntry: LorebookEntry | null = null;
  private originalEntry: LorebookEntry | null = null;
  private currentTags: string[] = [];
  private element: HTMLElement;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private _isOpen = false;

  constructor(slot: 0 | 1, parent: HTMLElement) {
    this.slot = slot;
    this.element = this.createDOM();
    parent.appendChild(this.element);
    this.initEventListeners();
    this.initDragBehavior();
    this.initTagInput();

    // Refresh category dropdown when categories change
    EventBus.on(STUDIO_EVENTS.CATEGORIES_CHANGED, () => {
      const bookName = getCurrentBookName();
      if (bookName && this.selectedEntry && this._isOpen) {
        this.populateCategoryDropdown(bookName);
      }
    });
  }

  // --- Public API ---

  open(uid: number, bookName: string): void {
    this.loadEntry(uid, bookName);
    this.element.classList.remove('ls-card-hidden');
    this._isOpen = true;
    EventBus.emit(STUDIO_EVENTS.ENTRY_CARD_OPENED, { slot: this.slot, uid });
  }

  close(): void {
    this.element.classList.add('ls-card-hidden');
    this.selectedEntry = null;
    this.originalEntry = null;
    this.currentTags = [];
    this._isOpen = false;
    EventBus.emit(STUDIO_EVENTS.ENTRY_CARD_CLOSED, { slot: this.slot });
  }

  getEntryUid(): number | null {
    return this.selectedEntry?.uid ?? null;
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  snapToDefault(): void {
    // Remove any manual positioning
    this.element.style.left = '';
    this.element.style.top = '';
    this.element.style.right = '';
    this.element.classList.remove('ls-snap-right', 'ls-snap-pair-left', 'ls-snap-pair-right');
  }

  setSnapClass(cls: string): void {
    this.element.classList.remove('ls-snap-right', 'ls-snap-pair-left', 'ls-snap-pair-right');
    this.element.style.left = '';
    this.element.style.top = '';
    this.element.style.right = '';
    this.element.classList.add(cls);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  // --- DOM Creation ---

  private createDOM(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'ls-entry-card ls-glass ls-card-hidden';
    card.dataset.slot = String(this.slot);

    card.innerHTML = `
      <div class="ls-entry-card-header">
        <h3 class="ls-entry-card-title">Entry Details</h3>
        <button class="ls-btn ls-btn-icon ls-ec-close" title="Close">&times;</button>
      </div>
      <div class="ls-entry-card-body">
        <div class="ls-field">
          <label class="ls-label">Name / Comment</label>
          <input type="text" class="ls-input ls-ec-comment" />
        </div>
        <div class="ls-field">
          <label class="ls-label">Primary Keys <span class="ls-hint">(comma-separated)</span></label>
          <input type="text" class="ls-input ls-ec-keys" />
        </div>
        <div class="ls-field-row">
          <div class="ls-field ls-flex-grow">
            <label class="ls-label">Secondary Keys <span class="ls-hint">(comma-separated)</span></label>
            <input type="text" class="ls-input ls-ec-keysecondary" />
          </div>
          <div class="ls-field" style="min-width: 110px;">
            <label class="ls-label">Logic</label>
            <select class="ls-select ls-ec-selective-logic">
              <option value="0">AND ANY</option>
              <option value="1">AND ALL</option>
              <option value="2">NOT ANY</option>
              <option value="3">NOT ALL</option>
            </select>
          </div>
        </div>
        <div class="ls-field">
          <label class="ls-label">Content</label>
          <textarea class="ls-textarea ls-ec-content" rows="8"></textarea>
        </div>
        <div class="ls-field-row">
          <div class="ls-field ls-field-half">
            <label class="ls-label">Position</label>
            <select class="ls-select ls-ec-position">
              <option value="0">Before Character Defs</option>
              <option value="1">After Character Defs</option>
              <option value="2">Before Example Messages</option>
              <option value="3">After Example Messages</option>
              <option value="4">Top of AN</option>
              <option value="5">Bottom of AN</option>
              <option value="6">@ Depth</option>
            </select>
          </div>
          <div class="ls-field ls-field-half">
            <label class="ls-label">Depth</label>
            <input type="number" class="ls-input ls-ec-depth" min="0" max="999" />
          </div>
        </div>
        <div class="ls-field-row">
          <div class="ls-field ls-field-half">
            <label class="ls-label">Order</label>
            <input type="number" class="ls-input ls-ec-order" min="0" max="999" />
          </div>
          <div class="ls-field ls-field-half">
            <label class="ls-label">Trigger %</label>
            <input type="number" class="ls-input ls-ec-probability" min="0" max="100" />
          </div>
        </div>
        <div class="ls-field-row">
          <div class="ls-field ls-field-half">
            <label class="ls-label">Scan Depth <span class="ls-hint">(null = default)</span></label>
            <input type="number" class="ls-input ls-ec-scan-depth" min="0" max="100" placeholder="null" />
          </div>
          <div class="ls-field ls-field-half">
            <label class="ls-label">Automation ID</label>
            <input type="text" class="ls-input ls-ec-automation-id" placeholder="" />
          </div>
        </div>
        <div class="ls-field-row">
          <div class="ls-field ls-field-half">
            <label class="ls-label">Group</label>
            <input type="text" class="ls-input ls-ec-group" />
          </div>
          <div class="ls-field ls-field-half">
            <label class="ls-label">Group Weight</label>
            <input type="number" class="ls-input ls-ec-group-weight" min="0" max="9999" />
          </div>
        </div>
        <div class="ls-field-row ls-toggles">
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-enabled" /><span>Enabled</span></label>
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-constant" /><span>Constant</span></label>
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-selective" /><span>Selective</span></label>
        </div>
        <div class="ls-field-row ls-toggles">
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-case-sensitive" /><span>Case-Sensitive</span></label>
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-match-whole-words" /><span>Match Whole Words</span></label>
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-use-group-scoring" /><span>Group Scoring</span></label>
        </div>
        <div class="ls-field-row ls-toggles">
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-exclude-recursion" /><span>Non-Recursable</span></label>
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-prevent-recursion" /><span>Prevent Recursion</span></label>
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-delay-until-recursion" /><span>Delay Until Recursion</span></label>
        </div>
        <div class="ls-field-row ls-toggles">
          <label class="ls-toggle"><input type="checkbox" class="ls-ec-group-override" /><span>Prioritize</span></label>
        </div>
        <div class="ls-field-row">
          <div class="ls-field ls-field-third">
            <label class="ls-label">Sticky</label>
            <input type="number" class="ls-input ls-ec-sticky" min="0" max="999" placeholder="null" />
          </div>
          <div class="ls-field ls-field-third">
            <label class="ls-label">Cooldown</label>
            <input type="number" class="ls-input ls-ec-cooldown" min="0" max="999" placeholder="null" />
          </div>
          <div class="ls-field ls-field-third">
            <label class="ls-label">Delay</label>
            <input type="number" class="ls-input ls-ec-delay" min="0" max="999" placeholder="null" />
          </div>
        </div>

        <!-- Studio Metadata -->
        <div class="ls-studio-section">
          <div class="ls-studio-divider">
            <span class="ls-studio-divider-text">Studio</span>
          </div>
          <div class="ls-field">
            <label class="ls-label">Category</label>
            <div class="ls-field-row">
              <select class="ls-select ls-flex-grow ls-ec-category">
                <option value="">-- None --</option>
              </select>
              <button class="ls-btn ls-btn-sm ls-ec-manage-categories" title="Manage categories">Manage</button>
            </div>
          </div>
          <div class="ls-field">
            <label class="ls-label">Tags</label>
            <div class="ls-tag-container ls-ec-tag-container"></div>
            <div class="ls-tag-input-wrapper">
              <input type="text" class="ls-input ls-ec-tag-input" placeholder="Add tag..." />
              <div class="ls-tag-autocomplete ls-hidden ls-ec-tag-autocomplete"></div>
            </div>
          </div>
          <div class="ls-field-row">
            <div class="ls-field ls-field-half">
              <label class="ls-label">Status</label>
              <select class="ls-select ls-ec-status">
                <option value="">-- None --</option>
                <option value="draft">Draft</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div class="ls-field ls-field-half">
              <label class="ls-label">&nbsp;</label>
              <label class="ls-toggle ls-pin-toggle">
                <input type="checkbox" class="ls-ec-pinned" />
                <span>&#9733; Pinned</span>
              </label>
            </div>
          </div>
          <div class="ls-field">
            <label class="ls-label">Studio Notes</label>
            <textarea class="ls-textarea ls-ec-notes" rows="3" placeholder="Private notes..."></textarea>
          </div>
          <div class="ls-field">
            <label class="ls-label">Color Override</label>
            <div class="ls-color-override-row">
              <input type="color" class="ls-color-input ls-ec-color-override" value="#5a52a0" />
              <label class="ls-toggle">
                <input type="checkbox" class="ls-ec-color-enabled" />
                <span>Enable</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      <div class="ls-entry-card-footer">
        <button class="ls-btn ls-btn-primary ls-ec-save">Save</button>
        <button class="ls-btn ls-ec-revert">Revert</button>
        <button class="ls-btn ls-ec-duplicate">Duplicate</button>
        <button class="ls-btn ls-btn-danger ls-ec-delete">Delete</button>
      </div>
    `;

    return card;
  }

  // --- Event Listeners ---

  private initEventListeners(): void {
    this.q('.ls-ec-close')?.addEventListener('click', () => this.close());
    this.q('.ls-ec-save')?.addEventListener('click', () => this.saveEntry());
    this.q('.ls-ec-revert')?.addEventListener('click', () => this.revertEntry());
    this.q('.ls-ec-duplicate')?.addEventListener('click', () => this.duplicateEntry());
    this.q('.ls-ec-delete')?.addEventListener('click', () => this.deleteEntry());
    this.q('.ls-ec-manage-categories')?.addEventListener('click', () => {
      EventBus.emit('ls:open-category-manager');
    });
  }

  // --- Drag Behavior ---

  private initDragBehavior(): void {
    const header = this.q('.ls-entry-card-header') as HTMLElement | null;
    if (!header) return;

    header.addEventListener('pointerdown', (e: PointerEvent) => {
      // Don't drag if clicking a button
      if ((e.target as HTMLElement).closest('button')) return;

      this.isDragging = true;
      const rect = this.element.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      // Remove snap classes when user starts dragging
      this.element.classList.remove('ls-snap-right', 'ls-snap-pair-left', 'ls-snap-pair-right');
      this.element.style.transition = 'none';

      const onMove = (ev: PointerEvent) => {
        const parent = this.element.parentElement;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        let left = ev.clientX - parentRect.left - this.dragOffset.x;
        let top = ev.clientY - parentRect.top - this.dragOffset.y;

        // Clamp to stay visible
        left = Math.max(0, Math.min(left, parentRect.width - 100));
        top = Math.max(0, Math.min(top, parentRect.height - 50));

        this.element.style.left = left + 'px';
        this.element.style.top = top + 'px';
        this.element.style.right = 'auto';
      };

      const onUp = () => {
        this.isDragging = false;
        this.element.style.transition = '';
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  // --- Entry Loading ---

  private loadEntry(uid: number, bookName: string): void {
    const entries = getEntries(bookName);
    const entry = entries.find((e) => e.uid === uid);
    if (!entry) return;

    this.selectedEntry = { ...entry };
    this.originalEntry = { ...entry };

    const titleEl = this.q('.ls-entry-card-title');
    if (titleEl) titleEl.textContent = entry.comment || `Entry ${entry.uid}`;

    this.setInput('.ls-ec-comment', entry.comment);
    this.setInput('.ls-ec-keys', entry.key.join(', '));
    this.setInput('.ls-ec-keysecondary', entry.keysecondary.join(', '));
    this.setSelect('.ls-ec-selective-logic', String(entry.selectiveLogic));
    this.setTextarea('.ls-ec-content', entry.content);
    this.setSelect('.ls-ec-position', String(entry.position));
    this.setInput('.ls-ec-depth', String(entry.depth));
    this.setInput('.ls-ec-order', String(entry.order));
    this.setInput('.ls-ec-probability', String(entry.probability));
    this.setNullableNumber('.ls-ec-scan-depth', entry.scanDepth);
    this.setInput('.ls-ec-automation-id', entry.automationId);
    this.setInput('.ls-ec-group', entry.group);
    this.setInput('.ls-ec-group-weight', String(entry.groupWeight));
    this.setCheckbox('.ls-ec-enabled', !entry.disable);
    this.setCheckbox('.ls-ec-constant', entry.constant);
    this.setCheckbox('.ls-ec-selective', entry.selective);
    this.setCheckbox('.ls-ec-case-sensitive', entry.caseSensitive === true);
    this.setCheckbox('.ls-ec-match-whole-words', entry.matchWholeWords === true);
    this.setCheckbox('.ls-ec-use-group-scoring', entry.useGroupScoring === true);
    this.setCheckbox('.ls-ec-exclude-recursion', entry.excludeRecursion);
    this.setCheckbox('.ls-ec-prevent-recursion', entry.preventRecursion);
    this.setCheckbox('.ls-ec-delay-until-recursion', entry.delayUntilRecursion);
    this.setCheckbox('.ls-ec-group-override', entry.groupOverride);
    this.setNullableNumber('.ls-ec-sticky', entry.sticky);
    this.setNullableNumber('.ls-ec-cooldown', entry.cooldown);
    this.setNullableNumber('.ls-ec-delay', entry.delay);

    this.populateStudioSection(uid, bookName);
  }

  private populateStudioSection(uid: number, bookName: string): void {
    const meta = getEntryMeta(bookName, String(uid));

    this.populateCategoryDropdown(bookName);
    this.setSelect('.ls-ec-category', meta.categoryId || '');

    this.currentTags = [...meta.tags];
    this.renderTags();

    this.setSelect('.ls-ec-status', meta.status || '');
    this.setCheckbox('.ls-ec-pinned', meta.pinned);
    this.setTextarea('.ls-ec-notes', meta.notes);

    const colorEnabled = meta.colorOverride !== null;
    this.setCheckbox('.ls-ec-color-enabled', colorEnabled);
    const colorInput = this.q('.ls-ec-color-override') as HTMLInputElement | null;
    if (colorInput) {
      colorInput.value = meta.colorOverride || '#5a52a0';
      colorInput.disabled = !colorEnabled;
    }
  }

  private populateCategoryDropdown(bookName: string): void {
    const select = this.q('.ls-ec-category') as HTMLSelectElement | null;
    if (!select) return;

    const currentValue = select.value;
    const categories = getCategories(bookName);

    select.innerHTML = '<option value="">-- None --</option>';
    for (const cat of categories) {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      option.style.borderLeft = `4px solid ${cat.color}`;
      select.appendChild(option);
    }

    select.value = currentValue;
  }

  // --- Save / Revert / Duplicate / Delete ---

  private saveEntry(): void {
    if (!this.selectedEntry) return;
    const bookName = getCurrentBookName();
    if (!bookName) return;

    const comment = this.getInput('.ls-ec-comment');
    const keysStr = this.getInput('.ls-ec-keys');
    const keysecondaryStr = this.getInput('.ls-ec-keysecondary');
    const selectiveLogic = parseInt(this.getSelect('.ls-ec-selective-logic') || '0');
    const content = this.getTextarea('.ls-ec-content');
    const position = parseInt(this.getSelect('.ls-ec-position') || '0');
    const depth = parseInt(this.getInput('.ls-ec-depth') || '4');
    const order = parseInt(this.getInput('.ls-ec-order') || '100');
    const probability = parseInt(this.getInput('.ls-ec-probability') || '100');
    const scanDepth = this.getNullableNumber('.ls-ec-scan-depth');
    const automationId = this.getInput('.ls-ec-automation-id');
    const group = this.getInput('.ls-ec-group');
    const groupWeight = parseInt(this.getInput('.ls-ec-group-weight') || '100');
    const enabled = this.getCheckbox('.ls-ec-enabled');
    const constant = this.getCheckbox('.ls-ec-constant');
    const selective = this.getCheckbox('.ls-ec-selective');
    const caseSensitive = this.getCheckbox('.ls-ec-case-sensitive') || null;
    const matchWholeWords = this.getCheckbox('.ls-ec-match-whole-words') || null;
    const useGroupScoring = this.getCheckbox('.ls-ec-use-group-scoring') || null;
    const excludeRecursion = this.getCheckbox('.ls-ec-exclude-recursion');
    const preventRecursion = this.getCheckbox('.ls-ec-prevent-recursion');
    const delayUntilRecursion = this.getCheckbox('.ls-ec-delay-until-recursion');
    const groupOverride = this.getCheckbox('.ls-ec-group-override');
    const sticky = this.getNullableNumber('.ls-ec-sticky');
    const cooldown = this.getNullableNumber('.ls-ec-cooldown');
    const delay = this.getNullableNumber('.ls-ec-delay');

    const fields: Partial<LorebookEntry> = {
      comment,
      key: keysStr.split(',').map((k) => k.trim()).filter(Boolean),
      keysecondary: keysecondaryStr.split(',').map((k) => k.trim()).filter(Boolean),
      selectiveLogic,
      content, position, depth, order, probability, group,
      groupWeight, scanDepth, automationId,
      caseSensitive, matchWholeWords, useGroupScoring,
      disable: !enabled, constant, selective, excludeRecursion, preventRecursion,
      delayUntilRecursion, groupOverride,
      sticky, cooldown, delay,
    };

    const success = updateEntry(bookName, this.selectedEntry.uid, fields);
    if (success) {
      this.originalEntry = { ...this.selectedEntry, ...fields };
      this.selectedEntry = { ...this.originalEntry };

      this.saveStudioMeta(bookName, this.selectedEntry.uid);

      const titleEl = this.q('.ls-entry-card-title');
      if (titleEl) {
        titleEl.textContent = 'Saved!';
        setTimeout(() => {
          titleEl.textContent = comment || `Entry ${this.selectedEntry?.uid}`;
        }, 1000);
      }
    }
  }

  private saveStudioMeta(bookName: string, uid: number): void {
    const categoryId = this.getSelect('.ls-ec-category') || null;
    const status = (this.getSelect('.ls-ec-status') || null) as EntryStatus | null;
    const pinned = this.getCheckbox('.ls-ec-pinned');
    const notes = this.getTextarea('.ls-ec-notes');
    const colorEnabled = this.getCheckbox('.ls-ec-color-enabled');
    const colorValue = (this.q('.ls-ec-color-override') as HTMLInputElement | null)?.value || '#5a52a0';

    const meta: Partial<EntryMeta> = {
      categoryId,
      tags: [...this.currentTags],
      notes, status, pinned,
      colorOverride: colorEnabled ? colorValue : null,
    };

    updateEntryMeta(bookName, String(uid), meta);
  }

  private revertEntry(): void {
    if (!this.originalEntry) return;
    const bookName = getCurrentBookName();
    if (!bookName) return;
    this.loadEntry(this.originalEntry.uid, bookName);
  }

  private async duplicateEntry(): Promise<void> {
    if (!this.selectedEntry) return;
    const bookName = getCurrentBookName();
    if (!bookName) return;

    const newEntry = await createEntry(bookName);
    if (!newEntry) return;

    const fields: Partial<LorebookEntry> = {
      comment: (this.selectedEntry.comment || 'Entry') + ' (copy)',
      key: [...this.selectedEntry.key],
      keysecondary: [...this.selectedEntry.keysecondary],
      selectiveLogic: this.selectedEntry.selectiveLogic,
      content: this.selectedEntry.content,
      position: this.selectedEntry.position,
      depth: this.selectedEntry.depth,
      order: this.selectedEntry.order,
      probability: this.selectedEntry.probability,
      scanDepth: this.selectedEntry.scanDepth,
      automationId: this.selectedEntry.automationId,
      group: this.selectedEntry.group,
      groupWeight: this.selectedEntry.groupWeight,
      disable: this.selectedEntry.disable,
      constant: this.selectedEntry.constant,
      selective: this.selectedEntry.selective,
      caseSensitive: this.selectedEntry.caseSensitive,
      matchWholeWords: this.selectedEntry.matchWholeWords,
      useGroupScoring: this.selectedEntry.useGroupScoring,
      excludeRecursion: this.selectedEntry.excludeRecursion,
      preventRecursion: this.selectedEntry.preventRecursion,
      delayUntilRecursion: this.selectedEntry.delayUntilRecursion,
      groupOverride: this.selectedEntry.groupOverride,
      sticky: this.selectedEntry.sticky,
      cooldown: this.selectedEntry.cooldown,
      delay: this.selectedEntry.delay,
    };

    updateEntry(bookName, newEntry.uid, fields);

    // Copy studio metadata
    const meta = getEntryMeta(bookName, String(this.selectedEntry.uid));
    updateEntryMeta(bookName, String(newEntry.uid), { ...meta });

    this.loadEntry(newEntry.uid, bookName);
    focusNode(String(newEntry.uid));
  }

  private deleteEntry(): void {
    if (!this.selectedEntry) return;
    const bookName = getCurrentBookName();
    if (!bookName) return;

    const confirmed = confirm(
      `Delete entry "${this.selectedEntry.comment || 'Unnamed'}" (UID: ${this.selectedEntry.uid})?\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;

    // Import dynamically to avoid circular deps
    import('../features/entryCrud').then(({ deleteEntryById }) => {
      if (this.selectedEntry && bookName) {
        deleteEntryById(bookName, this.selectedEntry.uid);
        this.close();
      }
    });
  }

  // --- Tag Input ---

  private initTagInput(): void {
    const input = this.q('.ls-ec-tag-input') as HTMLInputElement | null;
    if (!input) return;

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tag = input.value.trim().toLowerCase();
        if (tag && !this.currentTags.includes(tag)) {
          this.currentTags.push(tag);
          this.renderTags();
        }
        input.value = '';
        this.hideAutocomplete();
      }
      if (e.key === 'Escape') {
        this.hideAutocomplete();
      }
    });

    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      if (query.length < 1) {
        this.hideAutocomplete();
        return;
      }

      const bookName = getCurrentBookName();
      if (!bookName) return;

      const allTags = getAllTags(bookName);
      const suggestions = allTags
        .filter((t) => t.includes(query) && !this.currentTags.includes(t))
        .slice(0, 6);

      if (suggestions.length === 0) {
        this.hideAutocomplete();
        return;
      }

      const container = this.q('.ls-ec-tag-autocomplete');
      if (!container) return;

      container.innerHTML = '';
      for (const tag of suggestions) {
        const item = document.createElement('div');
        item.className = 'ls-tag-autocomplete-item';
        item.textContent = tag;
        item.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          if (!this.currentTags.includes(tag)) {
            this.currentTags.push(tag);
            this.renderTags();
          }
          input.value = '';
          this.hideAutocomplete();
        });
        container.appendChild(item);
      }
      container.classList.remove('ls-hidden');
    });

    input.addEventListener('blur', () => {
      setTimeout(() => this.hideAutocomplete(), 150);
    });
  }

  private renderTags(): void {
    const container = this.q('.ls-ec-tag-container');
    if (!container) return;

    container.innerHTML = '';
    for (const tag of this.currentTags) {
      const pill = document.createElement('span');
      pill.className = 'ls-tag-pill';
      pill.innerHTML = `${escapeHtml(tag)}<button class="ls-tag-remove">&times;</button>`;
      pill.querySelector('.ls-tag-remove')?.addEventListener('click', () => {
        this.currentTags = this.currentTags.filter((t) => t !== tag);
        this.renderTags();
      });
      container.appendChild(pill);
    }
  }

  private hideAutocomplete(): void {
    this.q('.ls-ec-tag-autocomplete')?.classList.add('ls-hidden');
  }

  // --- Scoped DOM Helpers ---

  private q(selector: string): Element | null {
    return this.element.querySelector(selector);
  }

  private setInput(selector: string, value: string): void {
    const el = this.q(selector) as HTMLInputElement | null;
    if (el) el.value = value;
  }

  private setTextarea(selector: string, value: string): void {
    const el = this.q(selector) as HTMLTextAreaElement | null;
    if (el) el.value = value;
  }

  private setSelect(selector: string, value: string): void {
    const el = this.q(selector) as HTMLSelectElement | null;
    if (el) el.value = value;
  }

  private setCheckbox(selector: string, checked: boolean): void {
    const el = this.q(selector) as HTMLInputElement | null;
    if (el) el.checked = checked;
  }

  private getInput(selector: string): string {
    return (this.q(selector) as HTMLInputElement | null)?.value || '';
  }

  private getTextarea(selector: string): string {
    return (this.q(selector) as HTMLTextAreaElement | null)?.value || '';
  }

  private getSelect(selector: string): string {
    return (this.q(selector) as HTMLSelectElement | null)?.value || '';
  }

  private getCheckbox(selector: string): boolean {
    return (this.q(selector) as HTMLInputElement | null)?.checked || false;
  }

  private setNullableNumber(selector: string, value: number | null): void {
    const el = this.q(selector) as HTMLInputElement | null;
    if (el) el.value = value !== null && value !== undefined ? String(value) : '';
  }

  private getNullableNumber(selector: string): number | null {
    const el = this.q(selector) as HTMLInputElement | null;
    if (!el || el.value === '') return null;
    const num = parseInt(el.value);
    return isNaN(num) ? null : num;
  }
}
