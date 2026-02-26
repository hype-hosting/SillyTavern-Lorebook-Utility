/**
 * Category manager panel for Lorebook Studio.
 * Allows creating, editing, and deleting categories.
 */

import {
  getCategories, addCategory, updateCategory, deleteCategory,
} from '../data/studioData';
import { getCurrentBookName } from './drawer';

/**
 * Initialize the category manager panel.
 */
export function initCategoryManager(): void {
  document.getElementById('ls-category-close')?.addEventListener('click', closeCategoryPanel);
  document.getElementById('ls-btn-manage-categories')?.addEventListener('click', openCategoryPanel);
  document.getElementById('ls-btn-add-category')?.addEventListener('click', handleAddCategory);

  // Enter key on name input
  document.getElementById('ls-category-new-name')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    }
  });
}

function openCategoryPanel(): void {
  const panel = document.getElementById('ls-category-panel');
  if (!panel) return;
  renderCategoryList();
  panel.classList.remove('ls-stats-hidden');
}

function closeCategoryPanel(): void {
  const panel = document.getElementById('ls-category-panel');
  panel?.classList.add('ls-stats-hidden');
}

function handleAddCategory(): void {
  const bookName = getCurrentBookName();
  if (!bookName) return;

  const nameInput = document.getElementById('ls-category-new-name') as HTMLInputElement | null;
  const colorInput = document.getElementById('ls-category-new-color') as HTMLInputElement | null;
  if (!nameInput || !colorInput) return;

  const name = nameInput.value.trim();
  if (!name) return;

  addCategory(bookName, name, colorInput.value);
  nameInput.value = '';
  renderCategoryList();
}

function renderCategoryList(): void {
  const container = document.getElementById('ls-category-list');
  if (!container) return;

  const bookName = getCurrentBookName();
  if (!bookName) {
    container.innerHTML = '<div style="color: var(--ls-text-muted); font-size: 12px;">No lorebook selected</div>';
    return;
  }

  const categories = getCategories(bookName);

  if (categories.length === 0) {
    container.innerHTML = '<div style="color: var(--ls-text-muted); font-size: 12px; padding: 8px 0;">No categories yet. Add one below.</div>';
    return;
  }

  container.innerHTML = '';
  for (const cat of categories) {
    const row = document.createElement('div');
    row.className = 'ls-category-item';
    row.innerHTML = `
      <input type="color" class="ls-color-input ls-category-color" value="${cat.color}" data-id="${cat.id}" />
      <input type="text" class="ls-input ls-category-name" value="${escapeAttr(cat.name)}" data-id="${cat.id}" />
      <button class="ls-btn ls-btn-sm ls-btn-danger ls-category-delete" data-id="${cat.id}" title="Delete">&times;</button>
    `;

    // Color change
    const colorInput = row.querySelector('.ls-category-color') as HTMLInputElement;
    colorInput?.addEventListener('change', () => {
      updateCategory(bookName, cat.id, { color: colorInput.value });
    });

    // Name change
    const nameInput = row.querySelector('.ls-category-name') as HTMLInputElement;
    nameInput?.addEventListener('change', () => {
      const newName = nameInput.value.trim();
      if (newName) {
        updateCategory(bookName, cat.id, { name: newName });
      }
    });

    // Delete
    const deleteBtn = row.querySelector('.ls-category-delete') as HTMLElement;
    deleteBtn?.addEventListener('click', () => {
      if (confirm(`Delete category "${cat.name}"? Entries using it will become uncategorized.`)) {
        deleteCategory(bookName, cat.id);
        renderCategoryList();
      }
    });

    container.appendChild(row);
  }
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
