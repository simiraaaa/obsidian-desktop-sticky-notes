import { MarkdownView, Notice, Platform, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, WorkspaceLeaf, normalizePath, setIcon, setTooltip } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { BrowserWindow, globalShortcut, screen } from "@electron/remote";

const DEFAULT_COLOR = "#fff3a3";
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 360;
const WINDOW_NAME_PREFIX = "desktop-sticky-notes:";
const LEGACY_DEFAULT_GLOBAL_SHORTCUT = "CommandOrControl+Alt+N";
const SETTINGS_SAVE_DEBOUNCE_MS = 500;
const HEADER_MEASURE_ATTEMPTS = 20;
const HEADER_MEASURE_INTERVAL_MS = 50;

type DesktopPlatform = "linux" | "macos" | "windows";

const CURRENT_PLATFORM: DesktopPlatform = Platform.isMacOS ? "macos" : Platform.isWin ? "windows" : "linux";
const DEFAULT_GLOBAL_SHORTCUTS: Record<DesktopPlatform, string> = {
  linux: "Super+F10",
  macos: "Option+F10",
  windows: "Super+F10"
};
const KNOWN_DEFAULT_GLOBAL_SHORTCUTS = new Set([
  LEGACY_DEFAULT_GLOBAL_SHORTCUT,
  ...Object.values(DEFAULT_GLOBAL_SHORTCUTS)
]);

const ACCELERATOR_KEYS_BY_CODE: Record<string, string> = {
  Space: "Space",
  Tab: "Tab",
  CapsLock: "Capslock",
  NumLock: "Numlock",
  ScrollLock: "Scrolllock",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Enter: "Enter",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  PrintScreen: "PrintScreen",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "\"",
  Backquote: "`",
  Comma: ",",
  Period: ".",
  Slash: "/",
  NumpadDecimal: "numdec",
  NumpadAdd: "numadd",
  NumpadSubtract: "numsub",
  NumpadMultiply: "nummult",
  NumpadDivide: "numdiv"
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function acceleratorKeyForEvent(event: KeyboardEvent): string | null {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) return event.code;
  if (/^Numpad[0-9]$/.test(event.code)) return `num${event.code.slice(6)}`;
  return ACCELERATOR_KEYS_BY_CODE[event.code] ?? null;
}

function acceleratorForEvent(event: KeyboardEvent): string | null {
  const key = acceleratorKeyForEvent(event);
  if (!key) return null;

  const modifiers: string[] = [];
  if (event.getModifierState("AltGraph")) {
    modifiers.push("AltGr");
  } else {
    if (event.metaKey) modifiers.push(Platform.isMacOS ? "Command" : "Super");
    if (event.ctrlKey) modifiers.push("Control");
    if (event.altKey) modifiers.push("Alt");
  }
  if (event.shiftKey) modifiers.push("Shift");
  return [...modifiers, key].join("+");
}

function displayAccelerator(accelerator: string): string {
  if (!accelerator) return "Disabled";
  const labels = accelerator.split("+").map((part) => {
    if (Platform.isMacOS) {
      if (["Command", "Cmd", "CommandOrControl", "CmdOrCtrl", "Super", "Meta"].includes(part)) return "⌘";
      if (["Control", "Ctrl"].includes(part)) return "⌃";
      if (["Alt", "Option"].includes(part)) return "⌥";
      if (part === "Shift") return "⇧";
    } else {
      if (["Super", "Meta"].includes(part)) return "Win";
      if (["Control", "Ctrl", "CommandOrControl", "CmdOrCtrl"].includes(part)) return "Ctrl";
    }
    return part === "Plus" ? "+" : part;
  });
  return labels.join(Platform.isMacOS ? " " : " + ");
}

function normalizeAcceleratorForPlatform(accelerator: string): string {
  if (KNOWN_DEFAULT_GLOBAL_SHORTCUTS.has(accelerator)) return DEFAULT_GLOBAL_SHORTCUTS[CURRENT_PLATFORM];

  return accelerator.split("+").map((part) => {
    if (CURRENT_PLATFORM === "macos") {
      if (["Command", "Cmd", "CommandOrControl", "CmdOrCtrl", "Super", "Meta"].includes(part)) return "Command";
      if (part === "Option") return "Alt";
    } else {
      if (["Command", "Cmd", "Super", "Meta"].includes(part)) return "Super";
      if (["CommandOrControl", "CmdOrCtrl"].includes(part)) return "Control";
      if (part === "Option") return "Alt";
    }
    return part;
  }).join("+");
}

interface StickyNoteSettings {
  defaultFolder: string;
  defaultNoteColor: string;
  enableCollapsibleNotes: boolean;
  restoreNotesOnStartup: boolean;
  globalToggleShortcuts: Record<DesktopPlatform, string>;
  topLevelNotePath: string | null;
  topLevelWindowPosition: WindowPosition | null;
  colorsByPath: Record<string, string>;
  savedWindowsByPath: Record<string, SavedNoteWindow[]>;
}

type StoredStickyNoteSettings = Partial<Omit<StickyNoteSettings, "globalToggleShortcuts">> & {
  globalToggleShortcut?: unknown;
  globalToggleShortcuts?: Partial<Record<DesktopPlatform, unknown>>;
  openNotePaths?: unknown;
};

interface WindowPosition {
  x: number;
  y: number;
}

interface WindowSize {
  width: number;
  height: number;
}

type WindowBounds = WindowPosition & WindowSize;

interface SavedNoteWindow {
  // The bounds the window expands to, which for a collapsed note is not the
  // size it currently has on screen.
  bounds: WindowBounds;
  // Size of the work area the window was on. Restoring compares it with the
  // work area of the display the window lands on today, so a note keeps its
  // relative place after a resolution or monitor change.
  workArea: WindowSize;
  isPinned: boolean;
  isCollapsed: boolean;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function wholePixels(value: unknown): number | null {
  const parsed = finiteNumber(value);
  // Window geometry is whole device-independent pixels. Rounding here keeps a
  // fractional stored value from reaching the window manager unchanged.
  return parsed === null ? null : Math.round(parsed);
}

function positivePixels(value: unknown): number | null {
  const parsed = wholePixels(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function parseWindowSize(value: unknown): WindowSize | null {
  if (typeof value !== "object" || value === null) return null;
  const { width, height } = value as Record<string, unknown>;
  const parsedWidth = positivePixels(width);
  const parsedHeight = positivePixels(height);
  if (parsedWidth === null || parsedHeight === null) return null;
  return { width: parsedWidth, height: parsedHeight };
}

function parseWindowBounds(value: unknown): WindowBounds | null {
  const size = parseWindowSize(value);
  if (!size) return null;
  const { x, y } = value as Record<string, unknown>;
  const parsedX = wholePixels(x);
  const parsedY = wholePixels(y);
  if (parsedX === null || parsedY === null) return null;
  return { x: parsedX, y: parsedY, ...size };
}

// Saved geometry is fed straight into the window manager, where a missing or
// non-numeric value would throw instead of being ignored. Stored data can be
// hand-edited or partially synced, so every entry is validated before use and
// an unusable one is dropped rather than repaired with guessed numbers.
function parseSavedNoteWindow(value: unknown): SavedNoteWindow | null {
  if (typeof value !== "object" || value === null) return null;
  const { bounds, workArea, isPinned, isCollapsed } = value as Record<string, unknown>;
  const parsedBounds = parseWindowBounds(bounds);
  const parsedWorkArea = parseWindowSize(workArea);
  if (!parsedBounds || !parsedWorkArea) return null;
  return {
    bounds: parsedBounds,
    workArea: parsedWorkArea,
    isPinned: isPinned === true,
    isCollapsed: isCollapsed === true
  };
}

function parseSavedNoteWindows(value: unknown): Record<string, SavedNoteWindow[]> {
  const saved: Record<string, SavedNoteWindow[]> = {};
  if (typeof value !== "object" || value === null) return saved;
  for (const [path, entry] of Object.entries(value as Record<string, unknown>)) {
    // Before a note could be restored into several windows, a path held one
    // window rather than a list of them.
    const entries = Array.isArray(entry) ? entry : [entry];
    const windows: SavedNoteWindow[] = [];
    for (const candidate of entries) {
      const parsed = parseSavedNoteWindow(candidate);
      if (parsed) windows.push(parsed);
    }
    if (windows.length) saved[path] = windows;
  }
  return saved;
}

function createDefaultSettings(): StickyNoteSettings {
  return {
    defaultFolder: "",
    defaultNoteColor: DEFAULT_COLOR,
    enableCollapsibleNotes: false,
    restoreNotesOnStartup: true,
    globalToggleShortcuts: { ...DEFAULT_GLOBAL_SHORTCUTS },
    topLevelNotePath: null,
    topLevelWindowPosition: null,
    colorsByPath: {},
    savedWindowsByPath: {}
  };
}

interface StickyActions {
  pin: HTMLElement;
  colorPicker: HTMLInputElement;
  mode: HTMLElement;
  hide: HTMLElement;
  collapse?: HTMLElement;
}

interface StickyNoteWindow {
  file: TFile;
  leaf: WorkspaceLeaf;
  document: Document;
  window: NativeBrowserWindow;
  observer?: MutationObserver;
  // Collapse state lives here rather than in the popout DOM: Obsidian rebuilds
  // that DOM on focus and layout changes, so only the plugin can be relied on
  // to know whether a window is collapsed and how tall it was before.
  isCollapsed: boolean;
  expandedSize?: WindowSize;
  // Kept so the listener can be detached again: it lives in the main process
  // and would otherwise outlive both the window and the plugin.
  geometryListener?: () => void;
}

interface NativeBrowserWindow {
  setResizable(resizable: boolean): void;
  setAlwaysOnTop(alwaysOnTop: boolean): void;
  isAlwaysOnTop(): boolean;
  setTitle(title: string): void;
  getTitle(): string;
  isDestroyed(): boolean;
  isFocused(): boolean;
  isVisible(): boolean;
  isMinimized(): boolean;
  show(): void;
  restore(): void;
  focus(): void;
  moveTop(): void;
  setParentWindow(parent: NativeBrowserWindow | null): void;
  setSkipTaskbar(skip: boolean): void;
  close(): void;
  destroy(): void;
  getPosition(): [number, number];
  getBounds(): WindowBounds;
  setBounds(bounds: WindowBounds): void;
  getContentSize(): [number, number];
  setContentSize(width: number, height: number): void;
  on(event: "move" | "resize", listener: () => void): void;
  removeListener(event: "move" | "resize", listener: () => void): void;
  webContents: { getZoomFactor(): number };
}

export default class DesktopStickyNotesPlugin extends Plugin {
  settings: StickyNoteSettings = createDefaultSettings();
  private notesByPath = new Map<string, Set<StickyNoteWindow>>();
  private initializedLeaves = new WeakSet<WorkspaceLeaf>();
  private registeredGlobalShortcut: string | null = null;
  private shortcutRegistrationTimer: number | null = null;
  private settingsSaveTimer: number | null = null;
  private pendingStateCaptures = new Set<StickyNoteWindow>();
  private restoringPath: string | null = null;
  private unloaded = false;
  private toggleInProgress = false;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.closeStaleStickyWindows();
    this.addSettingTab(new DesktopStickyNotesSettingTab(this.app, this));
    this.registerCommands();
    this.registerFileLifecycle();
    this.registerContextMenu();
    this.registerGlobalToggleShortcut();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleRefreshAllNotes()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleRefreshAllNotes()));
    // Waits for the layout because Obsidian deserializes its own popouts as
    // part of it, and a note it reopened by itself must not be opened twice.
    this.app.workspace.onLayoutReady(() => {
      this.adoptTopLevelNotePopouts();
      void this.restoreSavedNotes();
    });
  }

  onunload(): void {
    // Restoring runs across awaits and outlives this call. It stops at its next
    // step, and until then it must not suppress the capture below.
    this.unloaded = true;
    this.restoringPath = null;
    if (this.shortcutRegistrationTimer !== null) window.clearTimeout(this.shortcutRegistrationTimer);
    this.unregisterGlobalToggleShortcut();
    // Quitting Obsidian is what restoring exists for, so every path is captured
    // here even though the window events already record it: the debounced write
    // may still be pending. It runs before the loop below closes anything,
    // because a snapshot only holds the windows that are still open. Whether
    // Obsidian closes the popouts before it unloads plugins is its own choice;
    // when it does, this captures whatever is left of them and the rest is as
    // recent as the last debounced write.
    for (const path of [...this.notesByPath.keys()]) this.rememberNoteStates(path);
    for (const note of [...this.allNotes()]) {
      this.rememberTopLevelPosition(note);
      this.unwatchWindowGeometry(note);
      note.observer?.disconnect();
      note.leaf.detach();
      this.forceCloseWindow(note.window);
    }
    this.notesByPath.clear();
    this.flushSettingsSave();
    void this.app.workspace.requestSaveLayout();
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData() ?? {}) as StoredStickyNoteSettings;
    const defaults = createDefaultSettings();
    const globalToggleShortcuts = { ...defaults.globalToggleShortcuts };
    const storedShortcuts = stored.globalToggleShortcuts;

    for (const platform of Object.keys(globalToggleShortcuts) as DesktopPlatform[]) {
      const accelerator = storedShortcuts?.[platform];
      if (typeof accelerator === "string") globalToggleShortcuts[platform] = accelerator;
    }

    const hasCurrentPlatformShortcut = Object.prototype.hasOwnProperty.call(storedShortcuts ?? {}, CURRENT_PLATFORM);
    if (!hasCurrentPlatformShortcut && typeof stored.globalToggleShortcut === "string") {
      globalToggleShortcuts[CURRENT_PLATFORM] = normalizeAcceleratorForPlatform(stored.globalToggleShortcut);
    }

    this.settings = {
      defaultFolder: stored.defaultFolder ?? defaults.defaultFolder,
      defaultNoteColor: stored.defaultNoteColor ?? defaults.defaultNoteColor,
      enableCollapsibleNotes: stored.enableCollapsibleNotes ?? defaults.enableCollapsibleNotes,
      restoreNotesOnStartup: stored.restoreNotesOnStartup ?? defaults.restoreNotesOnStartup,
      globalToggleShortcuts,
      topLevelNotePath: stored.topLevelNotePath ?? defaults.topLevelNotePath,
      topLevelWindowPosition: stored.topLevelWindowPosition ?? defaults.topLevelWindowPosition,
      colorsByPath: stored.colorsByPath ?? defaults.colorsByPath,
      savedWindowsByPath: parseSavedNoteWindows(stored.savedWindowsByPath)
    };

    if (Object.prototype.hasOwnProperty.call(stored, "globalToggleShortcut")) {
      await this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  scheduleGlobalShortcutRegistration(): void {
    if (this.shortcutRegistrationTimer !== null) window.clearTimeout(this.shortcutRegistrationTimer);
    this.shortcutRegistrationTimer = window.setTimeout(() => {
      this.shortcutRegistrationTimer = null;
      this.registerGlobalToggleShortcut(true);
    }, 500);
  }

  beginGlobalShortcutRecording(): void {
    if (this.shortcutRegistrationTimer !== null) {
      window.clearTimeout(this.shortcutRegistrationTimer);
      this.shortcutRegistrationTimer = null;
    }
    this.unregisterGlobalToggleShortcut();
  }

  cancelGlobalShortcutRecording(): void {
    this.registerGlobalToggleShortcut();
  }

  async setGlobalToggleShortcut(accelerator: string): Promise<void> {
    this.settings.globalToggleShortcuts[CURRENT_PLATFORM] = accelerator;
    await this.saveSettings();
    this.registerGlobalToggleShortcut(true);
  }

  getGlobalToggleShortcut(): string {
    return this.settings.globalToggleShortcuts[CURRENT_PLATFORM];
  }

  private registerGlobalToggleShortcut(showResult = false): void {
    this.unregisterGlobalToggleShortcut();
    const accelerator = this.getGlobalToggleShortcut().trim();
    if (!accelerator) {
      if (showResult) new Notice("Global sticky-note shortcut disabled.");
      return;
    }

    try {
      // Reclaim this configured accelerator after an Obsidian renderer reload,
      // where an older remote callback can otherwise remain registered.
      if (globalShortcut.isRegistered(accelerator)) globalShortcut.unregister(accelerator);
      const registered = globalShortcut.register(accelerator, () => void this.toggleTopLevelNote());
      if (!registered) {
        new Notice(`Could not register global shortcut: ${displayAccelerator(accelerator)}`);
        return;
      }
      this.registeredGlobalShortcut = accelerator;
      if (showResult) new Notice(`Global sticky-note shortcut: ${displayAccelerator(accelerator)}`);
    } catch {
      new Notice(`Invalid global shortcut: ${displayAccelerator(accelerator)}`);
    }
  }

  private unregisterGlobalToggleShortcut(): void {
    const accelerator = this.registeredGlobalShortcut;
    if (!accelerator) return;
    if (globalShortcut.isRegistered(accelerator)) globalShortcut.unregister(accelerator);
    this.registeredGlobalShortcut = null;
  }

  private registerCommands(): void {
    this.addCommand({
      id: "create-sticky-note",
      name: "Create sticky note",
      callback: () => void this.createStickyNote()
    });
    this.addCommand({
      id: "open-sticky-note",
      name: "Open sticky note for current file",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.openStickyNote(file);
        return true;
      }
    });
    this.addCommand({
      id: "hide-sticky-note",
      name: "Hide sticky note for current file",
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !this.stickyLeavesForPath(activeFile.path).length) return false;
        if (!checking && activeFile) this.closeNotesForPath(activeFile.path);
        return true;
      }
    });
    this.addCommand({
      id: "set-top-level-sticky-note",
      name: "Set current file as top-level sticky note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.setTopLevelNote(file.path);
        return true;
      }
    });
    this.addCommand({
      id: "toggle-top-level-sticky-note",
      name: "Toggle top-level sticky note",
      callback: () => void this.toggleTopLevelNote()
    });
  }

  private registerContextMenu(): void {
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFile)) return;
      menu.addItem((item) => item
        .setTitle("Open as sticky note")
        .setIcon("sticky-note")
        .onClick(() => void this.openStickyNote(file)));
      menu.addItem((item) => item
        .setTitle("Set as top-level sticky note")
        .setIcon("star")
        .onClick(() => void this.setTopLevelNote(file.path)));
    }));
  }

  private registerFileLifecycle(): void {
    this.registerEvent(this.app.vault.on("delete", (file: TAbstractFile) => {
      if (!(file instanceof TFile)) return;
      this.closeNotesForPath(file.path);
      if (this.settings.topLevelNotePath === file.path) {
        this.settings.topLevelNotePath = null;
        void this.saveSettings();
      }
      delete this.settings.colorsByPath[file.path];
      void this.saveSettings();
    }));

    this.registerEvent(this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
      if (!(file instanceof TFile)) return;
      const notes = this.notesByPath.get(oldPath);
      if (notes) {
        this.notesByPath.delete(oldPath);
        this.notesByPath.set(file.path, notes);
        for (const note of notes) note.file = file;
      }
      if (this.settings.topLevelNotePath === oldPath) this.settings.topLevelNotePath = file.path;
      const color = this.settings.colorsByPath[oldPath];
      if (color) {
        delete this.settings.colorsByPath[oldPath];
        this.settings.colorsByPath[file.path] = color;
      }
      const savedWindows = this.settings.savedWindowsByPath[oldPath];
      if (savedWindows) {
        delete this.settings.savedWindowsByPath[oldPath];
        this.settings.savedWindowsByPath[file.path] = savedWindows;
      }
      void this.saveSettings();
    }));
  }

  async createStickyNote(): Promise<void> {
    const folder = this.normalizeFolder(this.settings.defaultFolder);
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const prefix = folder ? `${folder}/` : "";
    const file = await this.app.vault.create(`${prefix}${this.uniqueNoteName()}.md`, "");
    await this.openStickyNote(file);
  }

  async toggleTopLevelNote(): Promise<void> {
    if (this.toggleInProgress) return;
    this.toggleInProgress = true;
    try {
      await this.performTopLevelToggle();
    } finally {
      this.toggleInProgress = false;
    }
  }

  private async performTopLevelToggle(): Promise<void> {
    const path = this.settings.topLevelNotePath;
    if (!path) return;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      this.settings.topLevelNotePath = null;
      await this.saveSettings();
      return;
    }
    const nativeWindows = this.nativeNoteWindowsForPath(path);
    const trackedWindows = [...(this.notesByPath.get(path) ?? [])]
      .map((note) => note.window)
      .filter((window) => !window.isDestroyed());
    const knownWindows = [...new Set([...nativeWindows, ...trackedWindows])];

    if (knownWindows.some((window) => window.isFocused())) {
      // Do not detach the WorkspaceLeaf here. Obsidian responds to an explicit
      // detach by activating its main workspace window. Closing the independent
      // native popout lets its normal unload lifecycle remove the leaf without
      // asking Obsidian to focus a replacement first.
      for (const note of [...(this.notesByPath.get(path) ?? [])]) {
        this.rememberTopLevelPosition(note);
      }
      for (const nativeWindow of knownWindows) {
        try {
          if (!nativeWindow.isDestroyed()) nativeWindow.setParentWindow(null);
        } catch {
          // The popout can disappear while the command is collecting windows.
        }
        this.forceCloseWindow(nativeWindow);
      }
      window.setTimeout(() => void this.app.workspace.requestSaveLayout(), 100);
      return;
    }

    if (knownWindows.length) {
      this.bringWindowToFront(knownWindows[0]);
      return;
    }

    await this.openStickyNote(file);
  }

  private bringWindowToFront(nativeWindow: NativeBrowserWindow): void {
    if (nativeWindow.isDestroyed()) return;
    if (nativeWindow.isMinimized()) nativeWindow.restore();
    if (!nativeWindow.isVisible()) nativeWindow.show();
    nativeWindow.moveTop();
    nativeWindow.focus();
  }

  async setCollapsibleNotesEnabled(enabled: boolean): Promise<void> {
    this.settings.enableCollapsibleNotes = enabled;
    await this.saveSettings();
    // Turning the feature off removes the only control that can restore a
    // collapsed window, so no note may stay collapsed without it.
    if (!enabled) {
      for (const note of this.allNotes()) {
        try {
          // Resizing is restored first so that it does not depend on the expand
          // below: a window left at a fixed size has no control to unlock it.
          if (!note.window.isDestroyed()) note.window.setResizable(true);
          this.expandNote(note);
        } catch {
          // The remote proxy becomes invalid as soon as a window closes. One
          // unusable window must not leave the remaining notes collapsed.
        }
      }
    }
    this.scheduleRefreshAllNotes();
  }

  async setRestoreNotesEnabled(enabled: boolean): Promise<void> {
    this.settings.restoreNotesOnStartup = enabled;
    if (enabled) {
      // Notes that are already open would otherwise only enter the list once
      // they are moved, which makes the setting look like it did nothing.
      for (const path of this.notesByPath.keys()) this.captureNoteStates(path);
    } else {
      // Keeping the list while it is not used would restore a stale desktop
      // whenever the setting is switched back on.
      this.settings.savedWindowsByPath = {};
    }
    await this.saveSettings();
  }

  async setTopLevelNote(path: string | null): Promise<void> {
    this.forgetNoteStates(path);
    this.settings.topLevelNotePath = path;
    await this.saveSettings();
    // A note that just stopped being the top-level note becomes an ordinary
    // sticky note and joins the restore list from here on.
    for (const notePath of this.notesByPath.keys()) this.captureNoteStates(notePath);
    this.scheduleSettingsSave();
    this.scheduleRefreshAllNotes();
    new Notice(path ? `Top-level sticky note: ${path}` : "Top-level sticky note cleared.");
  }

  async openStickyNote(file: TFile, initialBounds?: WindowBounds): Promise<StickyNoteWindow | null> {
    const bounds = initialBounds ?? this.initialTopLevelBounds(file);
    const leaf = this.app.workspace.openPopoutLeaf({
      size: bounds ? { width: bounds.width, height: bounds.height } : { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      ...(bounds ? { x: bounds.x, y: bounds.y } : {})
    });
    await leaf.openFile(file, { active: true });
    // Unloading while the file was opening leaves nothing to detach this window
    // or the listener that tracking it would register in the main process.
    if (this.unloaded) {
      leaf.detach();
      return null;
    }

    return this.initializeStickyLeaf(file, leaf);
  }

  private async restoreSavedNotes(): Promise<void> {
    if (!this.settings.restoreNotesOnStartup) return;
    let failures = 0;
    let collapsingUnsupported = false;
    for (const [path, savedWindows] of Object.entries(this.settings.savedWindowsByPath)) {
      if (this.unloaded) return;
      // Restoring hands control back between windows, so an entry that was
      // hidden in the meantime must not be reopened from the list this started
      // with.
      if (!(path in this.settings.savedWindowsByPath)) continue;
      // The top-level note has its own toggle and its own saved position. It is
      // kept out of the list when it is written, so an entry here means the two
      // settings went out of step, not that it should be reopened.
      if (path === this.settings.topLevelNotePath) continue;
      const file = this.app.vault.getAbstractFileByPath(path);
      // An entry whose file is missing right now is kept rather than dropped:
      // the same vault can be opened where that file has not been synced yet.
      if (!(file instanceof TFile) || this.notesByPath.has(path)) continue;
      const reopened = this.adoptablePopoutLeaves(path, savedWindows.length);
      let restored = 0;
      // Recording a note snapshots every window it is open in, which while this
      // list is only half reopened would replace it with that half. Only this
      // note is held back: the user can still hide or move another one, and
      // those notes have to keep recording for that to take effect.
      this.restoringPath = path;
      try {
        for (const [index, saved] of savedWindows.entries()) {
          // Rechecked for every window, not once for the note: opening one
          // hands control back, and in that time the note can be hidden, its
          // file deleted or renamed, or it can become the top-level note.
          if (this.unloaded || !this.noteIsStillRestorable(path, file)) break;
          const collapse = saved.isCollapsed && this.settings.enableCollapsibleNotes && !collapsingUnsupported;
          try {
            const bounds = this.boundsOnCurrentDisplay(saved);
            // The windows open one at a time so that each exists, and has been
            // placed and collapsed, before the next takes the foreground.
            const note = await this.reopenStickyNote(file, bounds, reopened[index]);
            if (!note) {
              failures++;
              continue;
            }
            await this.applySavedWindow(note, saved, bounds, collapse);
            if (note.window.isDestroyed()) {
              failures++;
              continue;
            }
            // Collapsing is refused by whole window managers rather than by
            // single windows, and every refusal warns the user. One is enough.
            // The window is left open, but it did not reach its saved state, so
            // it does not count towards re-recording the note: a snapshot would
            // replace its saved collapsed flag with the state it is stuck in.
            if (collapse && !note.isCollapsed) {
              collapsingUnsupported = true;
              continue;
            }
            restored++;
          } catch {
            failures++;
          }
        }
      } finally {
        this.restoringPath = null;
      }
      // Only a note whose every window came back in its saved state is
      // re-recorded. Any other snapshot would replace the saved layout with
      // what happened to work, so a note that fell short keeps the list it was
      // restored from and tries again from it next time.
      if (restored === savedWindows.length) this.rememberNoteStates(path);
    }
    // A restore that fails for every note is otherwise indistinguishable from
    // the feature not running at all.
    if (failures) new Notice(`Could not restore ${failures} sticky note window${failures === 1 ? "" : "s"}.`);
  }

  private async applySavedWindow(note: StickyNoteWindow, saved: SavedNoteWindow, bounds: WindowBounds, collapse: boolean): Promise<void> {
    if (note.window.isDestroyed()) return;
    // openPopoutLeaf() was given the same rectangle, but it sizes the web
    // contents, so the window frame is only accounted for here.
    note.window.setBounds(bounds);
    if (saved.isPinned) this.setNotePinned(note, true);
    if (collapse) await this.collapseRestoredNote(note);
    // The controls were built before the window was pinned or collapsed, so
    // they are refreshed to show the state that has just been applied.
    this.scheduleRefreshNote(note);
  }

  private async collapseRestoredNote(note: StickyNoteWindow): Promise<void> {
    // collapseNote() needs the rendered height of the header and tells the user
    // that collapsing is unsupported when it cannot measure one. A window that
    // has only just opened may not have laid out its header yet, so the
    // collapse waits for a usable measurement instead of reporting a failure.
    for (let attempt = 0; attempt < HEADER_MEASURE_ATTEMPTS; attempt++) {
      if (note.window.isDestroyed() || !this.isTracked(note)) return;
      if (this.collapsedHeight(note) !== null) {
        this.collapseNote(note);
        return;
      }
      await sleep(HEADER_MEASURE_INTERVAL_MS);
    }
  }

  // A sticky note that was open when Obsidian quit is part of the layout
  // Obsidian saved, so Obsidian reopens it by itself as a plain popout, with
  // none of the markers this plugin writes. Obsidian reopens one such popout
  // per window the note was open in, and each is turned back into a sticky note
  // rather than left beside a second window for the same file. A popout beyond
  // the number of saved windows has no state to restore into it and is closed.
  private adoptablePopoutLeaves(path: string, wanted: number): WorkspaceLeaf[] {
    const leaves = this.plainPopoutLeavesForPath(path);
    for (const surplus of leaves.splice(wanted)) surplus.detach();
    return leaves;
  }

  private async reopenStickyNote(file: TFile, bounds: WindowBounds, reopened: WorkspaceLeaf | undefined): Promise<StickyNoteWindow | null> {
    // Adopting the window Obsidian already put on screen avoids opening a
    // second one for it; a window the saved list has no popout for is new.
    // Adoption can fail when the native window behind the leaf cannot be found,
    // which detaches that leaf; the saved window is then opened as a new one
    // rather than being lost along with it.
    const adopted = reopened ? this.initializeStickyLeaf(file, reopened) : null;
    return adopted ?? this.openStickyNote(file, bounds);
  }

  // The top-level note is never saved or restored, because its own toggle
  // decides when it is shown. Obsidian still reopens the popout it was in from
  // its own layout, and left alone that is a plain popout the toggle does not
  // recognise, so toggling opens a second window onto the same note. The window
  // is adopted rather than closed: it is on screen either way, adopting it lets
  // the toggle hide it as usual, and closing it would make a note the user left
  // open disappear at startup without being asked.
  private adoptTopLevelNotePopouts(): void {
    const path = this.settings.topLevelNotePath;
    if (!path) return;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    for (const leaf of this.plainPopoutLeavesForPath(path)) {
      // A leaf whose native window cannot be found is left in place: detaching
      // it would close a window the toggle can at least still replace.
      this.initializeStickyLeaf(file, leaf, false);
    }
  }

  private noteIsStillRestorable(path: string, file: TFile): boolean {
    return path in this.settings.savedWindowsByPath
      && path !== this.settings.topLevelNotePath
      && this.app.vault.getAbstractFileByPath(path) === file;
  }

  private plainPopoutLeavesForPath(path: string): WorkspaceLeaf[] {
    const mainDocument = this.app.workspace.containerEl.ownerDocument;
    const leaves: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const { view } = leaf;
      if (!(view instanceof MarkdownView) || view.file?.path !== path) return;
      if (view.containerEl.ownerDocument !== mainDocument && !this.initializedLeaves.has(leaf)) leaves.push(leaf);
    });
    return leaves;
  }

  private boundsOnCurrentDisplay(saved: SavedNoteWindow): WindowBounds {
    const { workArea } = screen.getDisplayMatching(saved.bounds);
    // The position is rescaled around the work area's origin so that a note
    // keeps its relative place when the display it lands on is not the size it
    // was saved on. The size is left alone: a sticky note is sized for the
    // note it shows, not for the screen it happens to be on.
    const x = workArea.x + Math.round((saved.bounds.x - workArea.x) * (workArea.width / saved.workArea.width));
    const y = workArea.y + Math.round((saved.bounds.y - workArea.y) * (workArea.height / saved.workArea.height));
    // Whatever the conversion produced, the window has to end up somewhere the
    // user can reach it, so it is pulled back inside the work area, and shrunk
    // first when it does not fit there at all.
    const width = Math.min(saved.bounds.width, workArea.width);
    const height = Math.min(saved.bounds.height, workArea.height);
    return {
      x: clamp(x, workArea.x, workArea.x + workArea.width - width),
      y: clamp(y, workArea.y, workArea.y + workArea.height - height),
      width,
      height
    };
  }

  private initialTopLevelBounds(file: TFile): WindowBounds | null {
    const position = file.path === this.settings.topLevelNotePath
      ? this.settings.topLevelWindowPosition
      : null;
    if (!position || !this.positionIsVisible(position)) return null;
    return { ...position, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }

  private initializeStickyLeaf(file: TFile, leaf: WorkspaceLeaf, detachOnFailure = true): StickyNoteWindow | null {
    if (this.initializedLeaves.has(leaf)) return null;

    // The view's ownerDocument is permanently tied to this popout. Obsidian's
    // activeDocument is global and can point at the main window after blur.
    const document = leaf.view.containerEl.ownerDocument;
    const domWindow = document.defaultView;
    if (!domWindow) {
      if (detachOnFailure) {
        leaf.detach();
        new Notice("Could not access the sticky-note document.");
      }
      return null;
    }
    // The DOM Window exposed by an Obsidian popout deliberately does not expose
    // Electron's webContents. A unique document title is visible to Electron,
    // however, and reliably gives us the corresponding native BrowserWindow.
    const windowMarker = `desktop-sticky-note-${crypto.randomUUID()}`;
    document.title = windowMarker;
    const browserWindow = BrowserWindow.getAllWindows().find(
      (candidate) => candidate.getTitle() === windowMarker
    ) as NativeBrowserWindow | undefined;
    if (!browserWindow) {
      if (detachOnFailure) {
        leaf.detach();
        new Notice("Could not create the sticky-note window.");
      }
      return null;
    }

    const note: StickyNoteWindow = { file, leaf, document, window: browserWindow, isCollapsed: false };
    this.initializedLeaves.add(leaf);
    this.trackNote(note);
    this.prepareWindow(note);
    this.watchWindow(note, domWindow);
    this.watchWindowGeometry(note);
    this.rememberNoteStates(file.path);
    this.registerDomEvent(domWindow, "beforeunload", () => {
      this.rememberTopLevelPosition(note);
      // The saved list is deliberately not rebuilt here. A snapshot holds the
      // windows that are open at the time it is taken, so rebuilding while
      // windows are closing would drop every sibling that closed first, and
      // quitting Obsidian would save one window in place of all of them. A
      // window that closed on its own therefore keeps its saved entry until the
      // note is next recorded for some other reason.
      this.untrackNote(note);
    });
    return note;
  }

  private prepareWindow(note: StickyNoteWindow): void {
    if (note.window.isDestroyed()) return;
    const { document, window } = note;
    const nativeTitle = this.nativeNoteWindowTitle(note.file);
    const domWindow = document.defaultView;
    if (domWindow) domWindow.name = this.windowNameForPath(note.file.path);
    document.documentElement.dataset.desktopStickyNoteWindow = "true";
    document.documentElement.dataset.desktopStickyNotePath = note.file.path;
    document.title = nativeTitle;
    window.setTitle(nativeTitle);
    document.body.classList.add("desktop-sticky-note");
    this.applyCollapseClasses(note);
    document.querySelector(".workspace-tab-header-container")?.remove();
    this.applyColor(note, this.noteColor(note.file.path), false);
    this.configureWindowOwnership(note);
    // The setting gates the collapsed branch as well: a note that is still
    // collapsed after the feature was switched off has no control left to
    // expand it, so its window must at least become resizable again.
    if (note.isCollapsed && this.settings.enableCollapsibleNotes) {
      this.syncCollapsedHeight(note);
    } else {
      window.setResizable(true);
    }
    this.addStickyActions(note);
    this.observePresentation(note);
  }

  private watchWindow(note: StickyNoteWindow, domWindow: Window): void {
    const restore = () => this.scheduleRefreshNote(note);
    this.registerDomEvent(domWindow, "focus", restore);
    this.registerDomEvent(domWindow, "blur", restore);
  }

  private watchWindowGeometry(note: StickyNoteWindow): void {
    const { window } = note;
    if (note.geometryListener || window.isDestroyed()) return;
    // These fire in the main process and reach the plugin over the remote
    // bridge. "move" and "resize" repeat throughout a drag, and every window
    // property has to be read back across that bridge, so the listener records
    // nothing itself and lets the debounced timer read the window once.
    // "moved" and "resized" are not used: Electron documents both for macOS and
    // Windows only, and the debounced read already covers a whole drag.
    const listener = () => this.scheduleNoteStateCapture(note);
    note.geometryListener = listener;
    window.on("move", listener);
    window.on("resize", listener);
  }

  private unwatchWindowGeometry(note: StickyNoteWindow): void {
    const listener = note.geometryListener;
    if (!listener) return;
    delete note.geometryListener;
    this.pendingStateCaptures.delete(note);
    try {
      if (note.window.isDestroyed()) return;
      note.window.removeListener("move", listener);
      note.window.removeListener("resize", listener);
    } catch {
      // The remote proxy becomes invalid as soon as the window closes, so a
      // window that is already gone cannot be asked to drop the listener.
    }
  }

  private scheduleRefreshNote(note: StickyNoteWindow): void {
    // Obsidian performs some focus/layout work after its events fire, so run
    // once immediately and once after that update has settled.
    window.setTimeout(() => this.prepareWindow(note), 0);
    window.setTimeout(() => this.prepareWindow(note), 75);
  }

  private scheduleRefreshAllNotes(): void {
    for (const note of this.allNotes()) this.scheduleRefreshNote(note);
  }

  private nativeMainWindow(): NativeBrowserWindow | null {
    const mainDocument = this.app.workspace.containerEl.ownerDocument;
    const previousTitle = mainDocument.title;
    const marker = `desktop-sticky-notes-main-${crypto.randomUUID()}`;
    mainDocument.title = marker;
    const mainWindow = (BrowserWindow.getAllWindows() as unknown as NativeBrowserWindow[])
      .find((candidate) => !candidate.isDestroyed() && candidate.getTitle() === marker) ?? null;
    mainDocument.title = previousTitle;
    return mainWindow;
  }

  private observePresentation(note: StickyNoteWindow): void {
    if (note.observer) return;
    let refreshScheduled = false;
    note.observer = new MutationObserver(() => {
      if (refreshScheduled || this.presentationIsIntact(note)) return;
      refreshScheduled = true;
      window.setTimeout(() => {
        refreshScheduled = false;
        this.prepareWindow(note);
      }, 0);
    });
    note.observer.observe(note.document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class", "style"]
    });
  }

  private presentationIsIntact(note: StickyNoteWindow): boolean {
    const { document } = note;
    const actions = note.leaf.view.containerEl.querySelector(".view-actions");
    const expectedColor = this.noteColor(note.file.path);
    return document.body.classList.contains("desktop-sticky-note")
      && document.defaultView?.name === this.windowNameForPath(note.file.path)
      && document.documentElement.dataset.desktopStickyNoteWindow === "true"
      && document.documentElement.dataset.desktopStickyNotePath === note.file.path
      && document.title === this.nativeNoteWindowTitle(note.file)
      && document.documentElement.style.getPropertyValue("--background-primary") === expectedColor
      && document.body.style.getPropertyValue("--sticky-note-background") === expectedColor
      && !document.querySelector(".workspace-tab-header-container")
      && !!this.findStickyActions(actions);
  }

  private addStickyActions(note: StickyNoteWindow): void {
    const view = note.leaf.view;
    if (!(view instanceof MarkdownView)) return;
    const actions = view.containerEl.querySelector(".view-actions");
    if (!actions) return;
    // prepareWindow() also runs when a click focuses an inactive note, that is
    // between the mousedown and the mouseup of that click. Rebuilding the
    // buttons then replaces the pressed button, so no click event fires and the
    // first click on an inactive note is lost. Buttons that are still present
    // are updated in place instead, and the bar is only rebuilt without them.
    const existing = this.findStickyActions(actions);
    if (existing) {
      this.updateStickyActions(note, view, actions, existing);
      return;
    }
    actions.empty();

    if (this.settings.enableCollapsibleNotes) {
      const collapse = view.addAction("chevron-down", "Collapse sticky note", () => {
        this.toggleCollapsed(note);
        this.updateCollapseButton(collapse, note.isCollapsed);
      });
      collapse.addClass("desktop-sticky-note-collapse");
      // A rebuilt bar starts from the tracked state, like the in-place update.
      this.updateCollapseButton(collapse, note.isCollapsed);
    }

    const pin = view.addAction("pin", "Keep on top", () => {
      this.setNotePinned(note, !note.window.isAlwaysOnTop());
      this.rememberNoteStates(note.file.path);
      this.updatePinButton(pin, note.window.isAlwaysOnTop());
    });
    pin.addClass("desktop-sticky-note-pin");
    this.updatePinButton(pin, note.window.isAlwaysOnTop());

    const colorPicker = actions.createEl("input", {
      cls: "desktop-sticky-note-color-picker",
      attr: {
        type: "color",
        value: this.noteColor(note.file.path),
        "aria-label": "Choose sticky-note background color",
        title: "Choose background color"
      }
    });
    if (colorPicker instanceof HTMLInputElement) {
      this.registerDomEvent(colorPicker, "input", () => this.applyColor(note, colorPicker.value));
      this.registerDomEvent(colorPicker, "click", (event) => event.stopPropagation());
    }
    const mode = view.addAction("pencil", "Switch to edit mode", () => {
      const nextMode = view.getMode() === "source" ? "preview" : "source";
      void view.setState({ mode: nextMode }, { history: false });
      this.updateModeButton(mode, nextMode);
    });
    mode.addClass("desktop-sticky-note-mode");
    this.updateModeButton(mode, view.getMode());
    view.addAction("x", "Hide sticky note", () => this.hideNote(note))
      .addClass("desktop-sticky-note-hide");
  }

  private toggleCollapsed(note: StickyNoteWindow): void {
    if (note.isCollapsed) {
      this.expandNote(note);
    } else {
      this.collapseNote(note);
    }
  }

  private collapseNote(note: StickyNoteWindow): void {
    const { window } = note;
    // The setting is re-checked here because saving it is asynchronous: a
    // button rendered before the change can still be clicked in the meantime.
    if (window.isDestroyed() || note.isCollapsed || !this.settings.enableCollapsibleNotes) return;
    const [width, height] = window.getContentSize();
    note.expandedSize = { width, height };
    note.isCollapsed = true;
    // The collapsed styling is applied before the header is measured so that
    // the measurement is the height the header will actually be drawn at: in an
    // expanded window the note body can squeeze the header below that height.
    this.applyCollapseClasses(note);
    // Without a measurement there is no height to collapse to. Guessing one
    // could hide part of the header, and the window would then be locked at a
    // size its controls do not fit into.
    const collapsedHeight = this.collapsedHeight(note);
    if (collapsedHeight === null) {
      this.abandonCollapse(note);
      return;
    }
    // Resize first: a non-resizable window ignores size changes on some
    // platforms, so the window must still be resizable while it shrinks.
    window.setContentSize(width, collapsedHeight);
    // Programmatic resizing is not honored everywhere, notably under native
    // Wayland, so the new size is read back before the note is committed to a
    // collapsed state its window never entered.
    if (!this.contentHeightReached(window, collapsedHeight)) {
      // A window manager may clamp the request and apply part of it, so the
      // window is put back before the recorded size is dropped. Restoring is
      // harmless where the resize was ignored outright.
      window.setContentSize(width, height);
      this.abandonCollapse(note);
      return;
    }
    // A collapsed window must not be dragged to a new height, which would
    // silently replace the height that expanding is supposed to restore.
    window.setResizable(false);
    this.rememberNoteStates(note.file.path);
  }

  private abandonCollapse(note: StickyNoteWindow): void {
    // Returns the note to the expanded state it never left. The window was not
    // made fixed-size yet, so only the tracked state has to be undone. Both
    // ways of failing to collapse report the same way: from the outside the
    // window simply did not collapse.
    note.isCollapsed = false;
    delete note.expandedSize;
    this.applyCollapseClasses(note);
    new Notice("Collapsing is not supported by this window manager.");
  }

  private expandNote(note: StickyNoteWindow): void {
    const { window } = note;
    // Collapsing always records the expanded size, so a collapsed note without
    // one is an inconsistent state rather than a case to guess a size for.
    if (window.isDestroyed() || !note.isCollapsed || !note.expandedSize) return;
    const { width, height } = note.expandedSize;
    // The note is moved to the expanded state before the window is touched. A
    // remote call that throws would otherwise leave a note reporting itself
    // collapsed while nothing on screen can expand it again.
    delete note.expandedSize;
    note.isCollapsed = false;
    this.applyCollapseClasses(note);
    window.setResizable(true);
    window.setContentSize(width, height);
    // Recorded from here rather than from the collapse button, so that
    // expanding every note when the feature is switched off is recorded too.
    this.rememberNoteStates(note.file.path);
  }

  private applyCollapseClasses(note: StickyNoteWindow): void {
    // A one-way projection of the setting and of note.isCollapsed for
    // stylesheets to hook into. The classes are never read back: Obsidian
    // rebuilds this DOM, so the plugin remains the only source of truth.
    const { classList } = note.document.body;
    classList.toggle("desktop-sticky-note-collapsible", this.settings.enableCollapsibleNotes);
    classList.toggle("desktop-sticky-note-collapsed", note.isCollapsed);
  }

  private syncCollapsedHeight(note: StickyNoteWindow): void {
    const { window } = note;
    const [width, height] = window.getContentSize();
    // The header can become taller or shorter while a note is already collapsed
    // (another theme, an Obsidian setting, a different zoom level), so every
    // refresh re-fits the window instead of trusting the height it collapsed to.
    // An unmeasurable header leaves the window alone: refreshes run on every
    // focus change, and resizing to a guessed height would make the window
    // flicker whenever a theme sizes the header only in some states.
    const collapsedHeight = this.collapsedHeight(note);
    if (collapsedHeight === null || height === collapsedHeight) return;
    // Same order as collapseNote(): a non-resizable window ignores size changes
    // on some platforms, so the window is resizable while it is resized.
    window.setResizable(true);
    window.setContentSize(width, collapsedHeight);
    // The window is collapsed either way, so it must not be left resizable when
    // the re-fit was ignored: dragging it would replace the height that
    // expanding restores.
    window.setResizable(false);
  }

  private contentHeightReached(window: NativeBrowserWindow, expectedHeight: number): boolean {
    // A window manager may round the requested size, so an exact match is not
    // required; a window that ignored the request stays at its old height.
    const [, height] = window.getContentSize();
    return Math.abs(height - expectedHeight) <= 1;
  }

  private collapsedHeight(note: StickyNoteWindow): number | null {
    // Collapsing leaves exactly the note header visible. The header is measured
    // instead of assumed so that a theme, a font size, or anything stacked
    // above the header changes the collapsed height with it.
    // The measurement is in CSS pixels within the web contents, so it can only
    // be applied to the content size: the full window size would additionally
    // contain an OS title bar whenever Obsidian runs with a native frame.
    // Scoped to this note's own view: a popout can be split, and the header of
    // another pane there says nothing about this note's height.
    const header = note.leaf.view.containerEl.querySelector(".view-header");
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    // No usable measurement. Both callers then leave the window as it is: a
    // guessed height could cut off the header the collapsed window consists of.
    // Non-finite values are rejected as well, since NaN passes every comparison
    // and would reach setContentSize() as an undefined height.
    if (!Number.isFinite(headerBottom) || headerBottom <= 0) return null;
    // Content sizes are device-independent pixels, and the zoom factor is
    // exactly the conversion from the CSS pixels the header was measured in.
    // The renderer's own viewport dimensions must not be used for this: right
    // after a resize they can still report the previous size, which would make
    // the window collapse to a few pixels.
    const zoomFactor = note.window.webContents.getZoomFactor();
    const dipsPerCssPixel = Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1;
    return Math.ceil(headerBottom * dipsPerCssPixel);
  }

  private updateCollapseButton(button: HTMLElement, collapsed: boolean): void {
    // Same no-op guard as the other buttons: see updatePinButton().
    if (button.dataset.desktopStickyNoteCollapsed === String(collapsed)) return;
    button.dataset.desktopStickyNoteCollapsed = String(collapsed);
    setIcon(button, collapsed ? "chevron-right" : "chevron-down");
    setTooltip(button, collapsed ? "Expand sticky note" : "Collapse sticky note");
    button.setAttribute("aria-expanded", String(!collapsed));
  }

  // One predicate for both the observer and the refresh: a bar is complete
  // exactly when every control is there, so neither can consider a bar the
  // other would rebuild as intact.
  private findStickyActions(actions: Element | null): StickyActions | null {
    if (!actions) return null;
    const pin = actions.querySelector<HTMLElement>(".desktop-sticky-note-pin");
    const colorPicker = actions.querySelector<HTMLInputElement>(".desktop-sticky-note-color-picker");
    const mode = actions.querySelector<HTMLElement>(".desktop-sticky-note-mode");
    const hide = actions.querySelector<HTMLElement>(".desktop-sticky-note-hide");
    if (!pin || !colorPicker || !mode || !hide) return null;
    // The collapse button follows its setting, so a bar built under the other
    // value is incomplete and gets rebuilt rather than patched.
    const collapse = actions.querySelector<HTMLElement>(".desktop-sticky-note-collapse") ?? undefined;
    if (this.settings.enableCollapsibleNotes !== !!collapse) return null;
    return { pin, colorPicker, mode, hide, collapse };
  }

  private updateStickyActions(note: StickyNoteWindow, view: MarkdownView, actions: Element, buttons: StickyActions): void {
    // The bar holds only the sticky-note controls, exactly as after a rebuild.
    const stickyActions: Element[] = [buttons.pin, buttons.colorPicker, buttons.mode, buttons.hide];
    if (buttons.collapse) stickyActions.push(buttons.collapse);
    for (const child of Array.from(actions.children)) {
      if (!stickyActions.includes(child)) child.remove();
    }
    if (buttons.collapse) this.updateCollapseButton(buttons.collapse, note.isCollapsed);
    this.updatePinButton(buttons.pin, note.window.isAlwaysOnTop());
    buttons.colorPicker.value = this.noteColor(note.file.path);
    this.updateModeButton(buttons.mode, view.getMode());
  }

  // The button updates skip work when nothing changed: setIcon() replaces the
  // icon element, and an in-place refresh during a click must leave the
  // element the mouse went down on in place, or the click is dropped again.
  private updatePinButton(button: HTMLElement, pinned: boolean): void {
    if (button.dataset.desktopStickyNotePinned === String(pinned)) return;
    button.dataset.desktopStickyNotePinned = String(pinned);
    setIcon(button, pinned ? "pin-off" : "pin");
    setTooltip(button, pinned ? "Stop keeping on top" : "Keep on top");
  }

  private setNotePinned(note: StickyNoteWindow, pinned: boolean): void {
    // A child window's stacking is constrained by its application parent on
    // some window managers. Promote it to a native top-level window before
    // enabling the OS-wide always-on-top state.
    if (pinned) note.window.setParentWindow(null);
    note.window.setAlwaysOnTop(pinned);
    this.configureWindowOwnership(note);
    if (pinned) note.window.moveTop();
  }

  private configureWindowOwnership(note: StickyNoteWindow): void {
    const { window } = note;
    // Top-level and pinned notes must be independent native windows. A regular
    // unpinned note returns to Obsidian ownership for normal window grouping.
    if (note.file.path === this.settings.topLevelNotePath || window.isAlwaysOnTop()) {
      window.setParentWindow(null);
    } else {
      const mainWindow = this.nativeMainWindow();
      if (mainWindow && mainWindow !== window) window.setParentWindow(mainWindow);
    }
    window.setSkipTaskbar(false);
  }

  private updateModeButton(button: HTMLElement, mode: string): void {
    // Same no-op guard as updatePinButton().
    if (button.dataset.desktopStickyNoteMode === mode) return;
    button.dataset.desktopStickyNoteMode = mode;
    const editing = mode === "source";
    setIcon(button, editing ? "book-open" : "pencil");
    setTooltip(button, editing ? "Switch to reading view" : "Switch to edit mode");
  }

  private applyColor(note: StickyNoteWindow, color: string, persist = true): void {
    const rootStyle = note.document.documentElement.style;
    rootStyle.setProperty("--background-primary", color);
    rootStyle.setProperty("--background-primary-alt", color);
    rootStyle.setProperty("--background-secondary", color);
    rootStyle.setProperty("--background-secondary-alt", color);
    note.document.body.style.setProperty("--sticky-note-background", color);
    if (persist) {
      this.settings.colorsByPath[note.file.path] = color;
      void this.saveSettings();
    }
  }

  private noteColor(path: string): string {
    return this.settings.colorsByPath[path] ?? this.settings.defaultNoteColor;
  }

  private trackNote(note: StickyNoteWindow): void {
    const notes = this.notesByPath.get(note.file.path) ?? new Set<StickyNoteWindow>();
    notes.add(note);
    this.notesByPath.set(note.file.path, notes);
  }

  private untrackNote(note: StickyNoteWindow): void {
    note.observer?.disconnect();
    this.unwatchWindowGeometry(note);
    this.initializedLeaves.delete(note.leaf);
    const notes = this.notesByPath.get(note.file.path);
    if (!notes) return;
    notes.delete(note);
    if (!notes.size) this.notesByPath.delete(note.file.path);
  }

  private closeNotesForPath(path: string): void {
    const notes = [...(this.notesByPath.get(path) ?? [])];
    for (const note of notes) {
      this.rememberTopLevelPosition(note);
      this.clearWindowMarker(note);
      this.untrackNote(note);
      note.leaf.detach();
      this.forceCloseWindow(note.window);
    }
    for (const leaf of this.stickyLeavesForPath(path)) {
      const domWindow = leaf.view.containerEl.ownerDocument.defaultView;
      if (domWindow) domWindow.name = "";
      leaf.detach();
    }
    // Every window for this note has been dismissed, so the list is rebuilt
    // from what is left, which is nothing.
    this.dismissNoteStates(path);
    void this.app.workspace.requestSaveLayout();
  }

  private hideNote(note: StickyNoteWindow): void {
    this.rememberTopLevelPosition(note);
    this.clearWindowMarker(note);
    this.untrackNote(note);
    // Hiding is the one dismissal that shrinks the list: it is rebuilt from the
    // windows that are still open, and the note leaves the list entirely once
    // the last of them is hidden.
    this.dismissNoteStates(note.file.path);
    note.leaf.detach();
    this.forceCloseWindow(note.window);
    void this.app.workspace.requestSaveLayout();
  }

  private clearWindowMarker(note: StickyNoteWindow): void {
    const domWindow = note.document.defaultView;
    if (domWindow) domWindow.name = "";
    delete note.document.documentElement.dataset.desktopStickyNoteWindow;
    delete note.document.documentElement.dataset.desktopStickyNotePath;
  }

  private forceCloseWindow(nativeWindow: NativeBrowserWindow): void {
    try {
      if (!nativeWindow.isDestroyed()) nativeWindow.close();
    } catch {
      // Fall through to the forced-destroy check below.
    }
    window.setTimeout(() => {
      try {
        if (!nativeWindow.isDestroyed()) nativeWindow.destroy();
      } catch {
        // The remote proxy becomes invalid as soon as the window closes.
      }
    }, 50);
  }

  private closeStaleStickyWindows(): void {
    const windows = BrowserWindow.getAllWindows() as unknown as NativeBrowserWindow[];
    for (const candidate of windows) {
      if (candidate.isDestroyed()) continue;
      if (candidate.getTitle().startsWith("Sticky note —") && !candidate.isDestroyed()) {
        candidate.destroy();
      }
    }
    void this.app.workspace.requestSaveLayout();
  }

  private stickyLeavesForPath(path: string): WorkspaceLeaf[] {
    const stickyLeaves: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== path) return;
      const document = leaf.view.containerEl.ownerDocument;
      if (document.documentElement.dataset.desktopStickyNoteWindow === "true"
        && document.body.classList.contains("desktop-sticky-note")) {
        stickyLeaves.push(leaf);
      }
    });
    return stickyLeaves;
  }

  private nativeNoteWindowsForPath(path: string): NativeBrowserWindow[] {
    const expectedTitle = this.nativeNoteWindowTitleForPath(path);
    return (BrowserWindow.getAllWindows() as unknown as NativeBrowserWindow[])
      .filter((candidate) => !candidate.isDestroyed() && candidate.getTitle() === expectedTitle);
  }

  private rememberTopLevelPosition(note: StickyNoteWindow): void {
    if (note.file.path !== this.settings.topLevelNotePath || note.window.isDestroyed()) return;
    const [x, y] = note.window.getPosition();
    this.settings.topLevelWindowPosition = { x, y };
    void this.saveSettings();
  }

  private isTracked(note: StickyNoteWindow): boolean {
    return this.notesByPath.get(note.file.path)?.has(note) ?? false;
  }

  private rememberNoteStates(path: string): void {
    this.captureNoteStates(path);
    this.scheduleSettingsSave();
  }

  // Used by the window events, which arrive continuously while a window is
  // dragged. Reading a window's geometry means a blocking call into the main
  // process for every property, so the events only mark the note and the
  // debounced timer reads the windows once per movement.
  private scheduleNoteStateCapture(note: StickyNoteWindow): void {
    this.pendingStateCaptures.add(note);
    this.scheduleSettingsSave();
  }

  private capturePendingNoteStates(): void {
    // Marked notes are resolved to paths first: a note is saved together with
    // every other window on the same file, and dragging one window must not
    // snapshot that file once per window.
    const paths = new Set<string>();
    for (const note of [...this.pendingStateCaptures]) {
      // A note whose windows are still being reopened stays marked rather than
      // producing a snapshot of the part of its list that exists so far. The
      // mark keeps until the next write, whether restoring records the note
      // itself or a later event does.
      if (note.file.path === this.restoringPath) continue;
      this.pendingStateCaptures.delete(note);
      if (this.isTracked(note)) paths.add(note.file.path);
    }
    for (const path of paths) this.captureNoteStates(path);
  }

  // Replaces the saved list for one note with a snapshot of every window it is
  // currently open in. Windows carry no identity of their own, so they cannot
  // be updated one by one.
  private captureNoteStates(path: string): void {
    if (!this.settings.restoreNotesOnStartup) return;
    // Held back while this note's own windows are being reopened: its list is
    // only partly on screen, and restoring records the note once it is whole.
    if (path === this.restoringPath) return;
    // The top-level note is shown and hidden by its own toggle and keeps its
    // own saved position, so it is never part of the restore list. An entry
    // that predates it becoming the top-level note is dropped here.
    if (path === this.settings.topLevelNotePath) {
      delete this.settings.savedWindowsByPath[path];
      return;
    }
    const windows = this.noteWindowStates(path);
    // A snapshot may grow the list but never shrink it. Windows disappear for
    // reasons the plugin never observes as such, and by the time it looks they
    // are simply not there: Obsidian quitting, the window manager, a restore
    // that stopped halfway. Those are exactly the windows this feature exists
    // to bring back, and a dropped one cannot be recovered, while a stale one
    // costs a single hide. Hiding a note is the one way a window leaves.
    if (!windows || windows.length < (this.settings.savedWindowsByPath[path]?.length ?? 0)) return;
    this.settings.savedWindowsByPath[path] = windows;
  }

  // Null when a window could not be read. Its state is then unknown rather than
  // absent, and treating it as absent would drop a window that is on screen.
  private noteWindowStates(path: string): SavedNoteWindow[] | null {
    const notes = this.notesByPath.get(path) ?? new Set<StickyNoteWindow>();
    const previous = this.settings.savedWindowsByPath[path];
    // Windows carry no identity, so a saved entry can only be matched to a live
    // window by position, and that only holds while their number is unchanged.
    // A note that has gained or lost a window has no such match.
    const matching = previous?.length === notes.size ? previous : undefined;
    const windows: SavedNoteWindow[] = [];
    for (const note of notes) {
      const state = this.noteWindowState(note, matching?.[windows.length]);
      if (!state) return null;
      windows.push(state);
    }
    return windows;
  }

  // Hiding a note is the one way its windows leave the saved list, so this is
  // the only path allowed to shrink it. It also applies while the note is being
  // restored: closing a window that restoring has just put on screen has to
  // take effect rather than be undone by the rest of the loop.
  private dismissNoteStates(path: string): void {
    if (!this.settings.restoreNotesOnStartup) return;
    if (!this.notesByPath.has(path)) {
      this.forgetNoteStates(path);
      return;
    }
    const windows = this.noteWindowStates(path);
    // An unreadable window leaves the count stale rather than dropping windows
    // that are still on screen; hiding one of those settles it.
    if (windows) this.settings.savedWindowsByPath[path] = windows;
    this.scheduleSettingsSave();
  }

  private noteWindowState(note: StickyNoteWindow, previous: SavedNoteWindow | undefined): SavedNoteWindow | null {
    try {
      const bounds = this.expandedBounds(note);
      if (!bounds) return null;
      const { width, height } = screen.getDisplayMatching(bounds).workArea;
      return {
        bounds,
        workArea: { width, height },
        isPinned: note.window.isAlwaysOnTop(),
        // While the collapse feature is off no window can report itself
        // collapsed, so recording the flag would erase it for every note that
        // was collapsed when the feature was switched off. The flag saved for
        // this window is carried over instead, until a window is able to change
        // it again.
        isCollapsed: this.settings.enableCollapsibleNotes ? note.isCollapsed : previous?.isCollapsed ?? false
      };
    } catch {
      // The remote proxy becomes invalid as soon as a window closes, and a
      // window that is already gone is not one to reopen.
      return null;
    }
  }

  private forgetNoteStates(path: string | null): void {
    if (!path || !(path in this.settings.savedWindowsByPath)) return;
    delete this.settings.savedWindowsByPath[path];
    this.scheduleSettingsSave();
  }

  private expandedBounds(note: StickyNoteWindow): WindowBounds | null {
    const { window } = note;
    if (window.isDestroyed()) return null;
    const bounds = window.getBounds();
    if (!note.isCollapsed || !note.expandedSize) return bounds;
    // A collapsed window is only as tall as its header, and restoring that
    // height would produce a window with nothing left to expand to. The
    // expanded content size is converted to window bounds through the frame
    // the window currently has, which is measured rather than assumed: its
    // size depends on the platform and on Obsidian's window frame setting.
    const [contentWidth, contentHeight] = window.getContentSize();
    return {
      x: bounds.x,
      y: bounds.y,
      width: note.expandedSize.width + (bounds.width - contentWidth),
      height: note.expandedSize.height + (bounds.height - contentHeight)
    };
  }

  // Window moves and resizes arrive continuously while a window is dragged, so
  // a whole drag comes down to one snapshot and one write, both taken here once
  // the movement has settled.
  private scheduleSettingsSave(): void {
    if (this.settingsSaveTimer !== null) window.clearTimeout(this.settingsSaveTimer);
    this.settingsSaveTimer = window.setTimeout(() => {
      this.settingsSaveTimer = null;
      this.capturePendingNoteStates();
      void this.saveSettings();
    }, SETTINGS_SAVE_DEBOUNCE_MS);
  }

  private flushSettingsSave(): void {
    if (this.settingsSaveTimer === null) return;
    window.clearTimeout(this.settingsSaveTimer);
    this.settingsSaveTimer = null;
    this.capturePendingNoteStates();
    // saveData() is asynchronous and onunload() cannot await it, so a change
    // made moments before Obsidian quits may not reach disk.
    void this.saveSettings();
  }

  private positionIsVisible(position: WindowPosition): boolean {
    return screen.getAllDisplays().some((display) => {
      const { x, y, width, height } = display.workArea;
      // Keep the upper-left drag area reachable on at least one display.
      return position.x >= x - 40
        && position.x < x + width - 40
        && position.y >= y
        && position.y < y + height - 30;
    });
  }

  private nativeNoteWindowTitle(file: TFile): string {
    return this.nativeNoteWindowTitleForPath(file.path, file.basename);
  }

  private nativeNoteWindowTitleForPath(path: string, basename?: string): string {
    const label = basename ?? path.split("/").pop()?.replace(/\.md$/, "") ?? "Sticky note";
    // The invisible suffix is a stable, path-specific key shared by every
    // Obsidian renderer without cluttering the visible native window title.
    return `Sticky note — ${label}\u2063${encodeURIComponent(path)}`;
  }

  private windowNameForPath(path: string): string {
    return `${WINDOW_NAME_PREFIX}${encodeURIComponent(path)}`;
  }

  private *allNotes(): Iterable<StickyNoteWindow> {
    for (const notes of this.notesByPath.values()) yield* notes;
  }

  private normalizeFolder(folder: string): string {
    const trimmed = folder.trim().replace(/^\/+|\/+$/g, "");
    return trimmed ? normalizePath(trimmed) : "";
  }

  private uniqueNoteName(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `Sticky note ${stamp}`;
  }
}

class DesktopStickyNotesSettingTab extends PluginSettingTab {
  private shortcutRecordingCleanup: (() => void) | null = null;

  constructor(app: PluginSettingTab["app"], private plugin: DesktopStickyNotesPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Default folder",
        desc: "Folder for newly created sticky notes. Leave blank for the vault root.",
        render: (setting) => this.addDefaultFolderControl(setting)
      },
      {
        name: "Default note color",
        desc: "Background color used for notes that do not have a saved custom color.",
        render: (setting) => this.addDefaultColorControl(setting)
      },
      {
        name: "Collapsible sticky notes",
        desc: "Adds a collapse button that shrinks a sticky note to its header.",
        render: (setting) => this.addCollapsibleNotesControl(setting)
      },
      {
        name: "Restore sticky notes on startup",
        desc: "Reopen the sticky notes that were open when Obsidian last closed, with their position, size, pinned state, and collapsed state.",
        render: (setting) => this.addRestoreNotesControl(setting)
      },
      {
        name: "Global toggle shortcut",
        desc: "System-wide shortcut for toggling the top-level sticky note. Click the shortcut, press a new combination, or press escape to cancel.",
        render: (setting) => this.addGlobalShortcutControl(setting)
      },
      {
        name: "Top-level sticky note",
        desc: this.plugin.settings.topLevelNotePath ?? "No top-level note selected.",
        render: (setting) => this.addTopLevelNoteControl(setting)
      }
    ];
  }

  display(): void {
    this.stopShortcutRecording(true);
    const { containerEl } = this;
    containerEl.empty();
    this.addDefaultFolderControl(new Setting(containerEl)
      .setName("Default folder")
      .setDesc("Folder for newly created sticky notes. Leave blank for the vault root."));
    this.addDefaultColorControl(new Setting(containerEl)
      .setName("Default note color")
      .setDesc("Background color used for notes that do not have a saved custom color."));
    this.addCollapsibleNotesControl(new Setting(containerEl)
      .setName("Collapsible sticky notes")
      .setDesc("Adds a collapse button that shrinks a sticky note to its header."));
    this.addRestoreNotesControl(new Setting(containerEl)
      .setName("Restore sticky notes on startup")
      .setDesc("Reopen the sticky notes that were open when Obsidian last closed, with their position, size, pinned state, and collapsed state."));
    this.addGlobalShortcutControl(new Setting(containerEl)
      .setName("Global toggle shortcut")
      .setDesc("System-wide shortcut for toggling the top-level sticky note. Click the shortcut, press a new combination, or press escape to cancel."));
    this.addTopLevelNoteControl(new Setting(containerEl)
      .setName("Top-level sticky note")
      .setDesc(this.plugin.settings.topLevelNotePath ?? "No top-level note selected."));
  }

  hide(): void {
    this.stopShortcutRecording(true);
    super.hide();
  }

  private addDefaultFolderControl(setting: Setting): void {
    setting.addText((text) => text
      .setPlaceholder("Vault root")
      .setValue(this.plugin.settings.defaultFolder)
      .onChange(async (value) => {
        this.plugin.settings.defaultFolder = value.trim();
        await this.plugin.saveSettings();
      }));
  }

  private addDefaultColorControl(setting: Setting): void {
    setting.addColorPicker((picker) => picker
      .setValue(this.plugin.settings.defaultNoteColor)
      .onChange(async (value) => {
        this.plugin.settings.defaultNoteColor = value;
        await this.plugin.saveSettings();
      }));
  }

  private addCollapsibleNotesControl(setting: Setting): void {
    setting.addToggle((toggle) => toggle
      .setValue(this.plugin.settings.enableCollapsibleNotes)
      .onChange((value) => void this.plugin.setCollapsibleNotesEnabled(value)));
  }

  private addRestoreNotesControl(setting: Setting): void {
    setting.addToggle((toggle) => toggle
      .setValue(this.plugin.settings.restoreNotesOnStartup)
      .onChange((value) => void this.plugin.setRestoreNotesEnabled(value)));
  }

  private addGlobalShortcutControl(setting: Setting): () => void {
    let recorderButton: HTMLButtonElement;
    let clearButton: HTMLButtonElement;
    setting
      .addButton((button) => {
        button
          .setButtonText(displayAccelerator(this.plugin.getGlobalToggleShortcut()))
          .setTooltip("Record global shortcut")
          .setClass("desktop-sticky-note-shortcut-recorder")
          .onClick(() => {
            if (this.shortcutRecordingCleanup) {
              this.stopShortcutRecording(true);
            } else {
              this.startShortcutRecording(recorderButton, clearButton);
            }
          });
        recorderButton = button.buttonEl;
      })
      .addButton((button) => {
        button
          .setButtonText("Clear")
          .setTooltip("Disable global shortcut")
          .setDisabled(!this.plugin.getGlobalToggleShortcut())
          .onClick(async () => {
            this.stopShortcutRecording(false);
            await this.plugin.setGlobalToggleShortcut("");
            recorderButton.setText("Disabled");
            clearButton.disabled = true;
        });
        clearButton = button.buttonEl;
      });
    return () => this.stopShortcutRecording(true);
  }

  private addTopLevelNoteControl(setting: Setting): void {
    setting.addButton((button) => button
      .setButtonText("Use active file")
      .onClick(() => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice("Open a Markdown file first.");
          return;
        }
        void this.plugin.setTopLevelNote(file.path).then(() => this.refresh());
      }))
      .addExtraButton((button) => button
        .setIcon("trash")
        .setTooltip("Clear top-level note")
        .onClick(() => void this.plugin.setTopLevelNote(null).then(() => this.refresh())));
  }

  private refresh(): void {
    const update = (this as { update?: () => void }).update;
    if (update) {
      update.call(this);
    } else {
      (this as unknown as { display: () => void }).display();
    }
  }

  private startShortcutRecording(recorderButton: HTMLButtonElement, clearButton: HTMLButtonElement): void {
    this.stopShortcutRecording(true);
    this.plugin.beginGlobalShortcutRecording();
    const previousLabel = displayAccelerator(this.plugin.getGlobalToggleShortcut());
    recorderButton.setText("Press shortcut…");
    recorderButton.addClass("is-recording");
    clearButton.disabled = true;
    recorderButton.focus();

    const finish = (restoreRegistration: boolean) => {
      const cleanup = this.shortcutRecordingCleanup;
      this.shortcutRecordingCleanup = null;
      cleanup?.();
      recorderButton.removeClass("is-recording");
      if (restoreRegistration) this.plugin.cancelGlobalShortcutRecording();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.key === "Escape") {
        finish(true);
        recorderButton.setText(previousLabel);
        clearButton.disabled = !this.plugin.getGlobalToggleShortcut();
        return;
      }
      const accelerator = acceleratorForEvent(event);
      if (!accelerator) return;

      finish(false);
      recorderButton.setText(displayAccelerator(accelerator));
      clearButton.disabled = false;
      void this.plugin.setGlobalToggleShortcut(accelerator);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === recorderButton || recorderButton.contains(event.target as Node)) return;
      finish(true);
      recorderButton.setText(previousLabel);
      clearButton.disabled = !this.plugin.getGlobalToggleShortcut();
    };
    const document = recorderButton.ownerDocument;
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    this.shortcutRecordingCleanup = () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }

  private stopShortcutRecording(restoreRegistration: boolean): void {
    if (!this.shortcutRecordingCleanup) return;
    const cleanup = this.shortcutRecordingCleanup;
    this.shortcutRecordingCleanup = null;
    cleanup();
    if (restoreRegistration) this.plugin.cancelGlobalShortcutRecording();
  }
}
