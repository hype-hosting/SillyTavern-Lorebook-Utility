export {};

declare global {
  interface SillyTavernContext {
    getContext(): STContext;
  }

  interface STContext {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extensionSettings: Record<string, any>;
    saveSettingsDebounced(): void;
    eventSource: STEventSource;
    eventTypes: Record<string, string>;
    chat: unknown[];
    characters: unknown[];
    worldInfoData: Record<string, WorldInfoBook>;
    getWorldInfoData(): Record<string, WorldInfoBook>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderExtensionTemplateAsync(extensionName: string, templateId: string, data?: Record<string, any>): Promise<string>;
    name1: string;
    name2: string;
    chatMetadata: Record<string, unknown>;
    characterId: number;
    groupId: string | null;
    [key: string]: unknown;
  }

  interface WorldInfoBook {
    entries: Record<string, WorldInfoEntry>;
    name: string;
  }

  interface WorldInfoEntry {
    uid: number;
    key: string[];
    keysecondary: string[];
    comment: string;
    content: string;
    constant: boolean;
    vectorized: boolean;
    selective: boolean;
    selectiveLogic: number;
    addMemo: boolean;
    order: number;
    position: number;
    disable: boolean;
    excludeRecursion: boolean;
    preventRecursion: boolean;
    delayUntilRecursion: boolean;
    probability: number;
    useProbability: boolean;
    depth: number;
    group: string;
    groupOverride: boolean;
    groupWeight: number;
    scanDepth: number | null;
    caseSensitive: boolean | null;
    matchWholeWords: boolean | null;
    useGroupScoring: boolean | null;
    automationId: string;
    role: number | null;
    sticky: number | null;
    cooldown: number | null;
    delay: number | null;
    [key: string]: unknown;
  }

  interface STEventSource {
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    emit(event: string, ...args: unknown[]): void;
    once(event: string, callback: (...args: unknown[]) => void): void;
  }

  const SillyTavern: SillyTavernContext;

  interface JQuery {
    on(event: string, handler: (...args: unknown[]) => void): JQuery;
    off(event: string, handler?: (...args: unknown[]) => void): JQuery;
    find(selector: string): JQuery;
    append(content: string | HTMLElement | JQuery): JQuery;
    prepend(content: string | HTMLElement | JQuery): JQuery;
    html(content?: string): JQuery | string;
    text(content?: string): JQuery | string;
    val(value?: string | number): JQuery | string;
    attr(name: string, value?: string): JQuery | string;
    css(property: string, value?: string): JQuery | string;
    addClass(className: string): JQuery;
    removeClass(className: string): JQuery;
    toggleClass(className: string, state?: boolean): JQuery;
    hasClass(className: string): boolean;
    show(): JQuery;
    hide(): JQuery;
    toggle(state?: boolean): JQuery;
    remove(): JQuery;
    empty(): JQuery;
    click(handler?: () => void): JQuery;
    trigger(event: string): JQuery;
    closest(selector: string): JQuery;
    parent(): JQuery;
    children(selector?: string): JQuery;
    first(): JQuery;
    last(): JQuery;
    eq(index: number): JQuery;
    each(callback: (index: number, element: HTMLElement) => void): JQuery;
    prop(name: string, value?: boolean | string): JQuery | boolean | string;
    data(key: string, value?: unknown): unknown;
    length: number;
    [index: number]: HTMLElement;
  }

  function $(selector: string | HTMLElement | (() => void)): JQuery;
}
