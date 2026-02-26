/**
 * Extension settings management for Lorebook Studio.
 */

const MODULE_NAME = 'lorebookStudio';

export interface LorebookStudioSettings {
  defaultLayout: string;
  showKeywordsOnNodes: boolean;
  showContentPreview: boolean;
  autoRefresh: boolean;
  showEdgeLabels: boolean;
  showAutoLinks: boolean;
  showManualLinks: boolean;
  manualLinks: Record<string, ManualLinkData[]>;
  savedPositions: Record<string, Record<string, { x: number; y: number; z?: number }>>;
  studioData: Record<string, StudioData>;
}

export interface ManualLinkData {
  sourceUid: string;
  targetUid: string;
  label: string;
  bookName: string;
}

export interface CategoryDef {
  id: string;
  name: string;
  color: string;
}

export type EntryStatus = 'draft' | 'in-progress' | 'review' | 'complete';

export interface EntryMeta {
  categoryId: string | null;
  tags: string[];
  notes: string;
  status: EntryStatus | null;
  pinned: boolean;
  colorOverride: string | null;
}

export interface StudioData {
  categories: CategoryDef[];
  entryMeta: Record<string, EntryMeta>;
}

const DEFAULT_SETTINGS: LorebookStudioSettings = {
  defaultLayout: 'force',
  showKeywordsOnNodes: true,
  showContentPreview: false,
  autoRefresh: true,
  showEdgeLabels: true,
  showAutoLinks: true,
  showManualLinks: true,
  manualLinks: {},
  savedPositions: {},
  studioData: {},
};

export function getSettings(): LorebookStudioSettings {
  const { extensionSettings } = SillyTavern.getContext();
  if (!extensionSettings[MODULE_NAME]) {
    extensionSettings[MODULE_NAME] = { ...DEFAULT_SETTINGS };
  }
  return extensionSettings[MODULE_NAME] as LorebookStudioSettings;
}

export function updateSettings(partial: Partial<LorebookStudioSettings>): void {
  const settings = getSettings();
  Object.assign(settings, partial);
  saveSettings();
}

export function saveSettings(): void {
  SillyTavern.getContext().saveSettingsDebounced();
}

export function getModuleName(): string {
  return MODULE_NAME;
}

export function getDefaultSettings(): LorebookStudioSettings {
  return { ...DEFAULT_SETTINGS };
}
