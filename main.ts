import { MarkdownView, Notice, Platform, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, WorkspaceLeaf, normalizePath, setIcon, setTooltip } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { BrowserWindow, app as electronApp, globalShortcut, screen, systemPreferences } from "@electron/remote";

const DEFAULT_COLOR = "#fff3a3";
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 360;
const WINDOW_NAME_PREFIX = "desktop-sticky-notes:";
// macOS's double-click interval when the user has never changed it; the
// setting is only stored once it differs from this default.
const DEFAULT_DOUBLE_CLICK_MS = 500;
// How far, in screen points, the second click may land from the first.
const ACTIVATION_DOUBLE_CLICK_SLOP = 4;
const LEGACY_DEFAULT_GLOBAL_SHORTCUT = "CommandOrControl+Alt+N";
const SETTINGS_SAVE_DEBOUNCE_MS = 500;
// How far ahead of a shutdown signal a window has to have closed for that
// closing to be the user's own. The two arrive within a few milliseconds of
// each other when Obsidian is quitting, so anything queued this long before the
// signal was not part of it; the measured gap is three milliseconds.
const SHUTDOWN_RACE_SLACK_MS = 250;
const HEADER_MEASURE_ATTEMPTS = 20;
const HEADER_MEASURE_INTERVAL_MS = 50;
const FOCUS_SETTLE_MS = 100;

// The double-click interval chosen in the macOS settings, in milliseconds.
function doubleClickIntervalMs(): number {
  const seconds = systemPreferences.getUserDefault("com.apple.mouse.doubleClickThreshold", "double");
  return typeof seconds === "number" && seconds > 0 ? seconds * 1000 : DEFAULT_DOUBLE_CLICK_MS;
}

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
  // Says which live window this entry belongs to, so that one window's state is
  // never written into another's. It names nothing outside this list: not a
  // note, not a display, not a machine, so a settings file stays valid wherever
  // it is synced to.
  id: string;
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
  const { id, bounds, workArea, isPinned, isCollapsed } = value as Record<string, unknown>;
  const parsedBounds = parseWindowBounds(bounds);
  const parsedWorkArea = parseWindowSize(workArea);
  if (!parsedBounds || !parsedWorkArea) return null;
  return {
    // Entries written before windows were told apart carry no id. They describe
    // a window worth reopening all the same, so they are named here rather than
    // dropped; the name only has to be unique, not recognisable.
    id: typeof id === "string" && id ? id : crypto.randomUUID(),
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
    // Two entries claiming one window would both be updated by it and would
    // reopen it twice, so a repeated id keeps only its last entry.
    const windows = new Map<string, SavedNoteWindow>();
    for (const candidate of entries) {
      const parsed = parseSavedNoteWindow(candidate);
      if (parsed) windows.set(parsed.id, parsed);
    }
    if (windows.size) saved[path] = [...windows.values()];
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
  // Matches this window to its entry in the saved list. Assigned when the
  // window opens, or taken from the entry when restoring reopens one.
  id: string;
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

// A drag of a note window by its header, carried out by the plugin.
interface HeaderDrag {
  pointerId: number;
  header: HTMLElement;
  startScreenX: number;
  startScreenY: number;
  startX: number;
  startY: number;
  moved: boolean;
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
  setPosition(x: number, y: number): void;
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
  private restoringId: string | null = null;
  private unloaded = false;
  private shutdownLatched = false;
  // Monotonic, so that a clock the system adjusts underneath cannot turn an
  // elapsed time negative or enormous. Null until Obsidian says anything.
  private shutdownSignalledAt: number | null = null;
  private unloadedAt: number | null = null;
  private pendingDismissals = new Map<StickyNoteWindow, number>();
  // Latched rather than timed out: a quit can be held open for as long as
  // another plugin's shutdown tasks take, and a window closing at the end of
  // that is still part of the quit. What lowers it again is evidence that the
  // quit did not happen, below.
  private readonly markShuttingDown = () => {
    this.shutdownLatched = true;
    this.shutdownSignalledAt = performance.now();
  };
  // Obsidian only stays interactive if it is not going anywhere, so a click or
  // a keypress after the signal says the quit was called off. Closing a window
  // through its frame without touching anything else first is then read as part
  // of the quit and keeps its entry, which one hide undoes; the reverse, losing
  // every window because a quit was misread, cannot be undone.
  private readonly releaseShutdownLatch = () => { this.shutdownLatched = false; };
  private toggleInProgress = false;

  // Whether Obsidian is on its way out, so that a sticky window closing now is
  // not the user being rid of it. Unloading is the end of that road rather than
  // a state beside it, so it counts as well.
  private get shuttingDown(): boolean {
    return this.unloaded || this.shutdownLatched;
  }

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
      // The focus goes back whether or not every note made it: a restore that
      // stopped part-way has still left the windows it did open in front.
      void this.restoreSavedNotes().finally(() => this.returnFocusToMainWindow());
    });
    // Quitting reaches the plugin through the main process a few milliseconds
    // before the sticky windows start closing, and reloading through the main
    // window's own unload. Either one means the closing windows are not being
    // dismissed by the user.
    electronApp.on("before-quit", this.markShuttingDown);
    this.registerDomEvent(window, "beforeunload", this.markShuttingDown);
    // macOS only: opening Obsidian while it is already running, from the Dock
    // or from a launcher, only brings its focused window forward; when that is
    // a pinned note the main window stays behind the other applications.
    // Clicking one of Obsidian's windows does not raise this event, so a note
    // the user clicked into keeps its focus. Electron raises it nowhere else,
    // and there the main window comes forward by itself.
    electronApp.on("activate", this.onAppActivate);
    // Obsidian's own quit event crosses no process boundary, so it does not
    // depend on the main process's before-quit winning its race with the
    // windows it is announcing the closure of. Its API says it is not
    // guaranteed to run, so it stands beside the other two rather than
    // replacing them.
    this.registerEvent(this.app.workspace.on("quit", this.markShuttingDown));
    this.watchForCancelledShutdown(window);
  }

  onunload(): void {
    // Restoring runs across awaits and outlives this call. It stops at its next
    // step, and until then it must not suppress the capture below.
    this.unloaded = true;
    this.unloadedAt = performance.now();
    // Each on its own: the remote proxy can be gone already while Obsidian is
    // shutting down, and one failing must not leave the other registered.
    try {
      electronApp.removeListener("before-quit", this.markShuttingDown);
    } catch {
      // See above.
    }
    try {
      electronApp.removeListener("activate", this.onAppActivate);
    } catch {
      // See above.
    }
    this.restoringId = null;
    if (this.shortcutRegistrationTimer !== null) window.clearTimeout(this.shortcutRegistrationTimer);
    this.unregisterGlobalToggleShortcut();
    // Quitting Obsidian is what restoring exists for, so every window is
    // captured here even though the window events already record it: the
    // debounced write may still be pending. A window Obsidian closed before
    // unloading the plugin is simply not among these, and keeps its entry.
    for (const note of [...this.allNotes()]) this.rememberNoteState(note);
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
      restoreNotesOnStartup: typeof stored.restoreNotesOnStartup === "boolean"
        ? stored.restoreNotesOnStartup
        : defaults.restoreNotesOnStartup,
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
      for (const note of this.allNotes()) this.captureNoteState(note);
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
    for (const note of this.allNotes()) this.captureNoteState(note);
    this.scheduleSettingsSave();
    this.scheduleRefreshAllNotes();
    new Notice(path ? `Top-level sticky note: ${path}` : "Top-level sticky note cleared.");
  }

  async openStickyNote(file: TFile, initialBounds?: WindowBounds, id?: string): Promise<StickyNoteWindow | null> {
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

    return this.initializeStickyLeaf(file, leaf, { id });
  }

  private async restoreSavedNotes(): Promise<void> {
    if (!this.settings.restoreNotesOnStartup) return;
    let failures = 0;
    let collapsingUnsupported = false;
    // The list is read again for every note rather than iterated from one
    // snapshot: reopening a note hands control back, and in that time entries
    // can be added, removed, or moved to another path by a rename. Paths are
    // remembered so that a list which keeps changing still terminates.
    const attempted = new Set<string>();
    for (;;) {
      if (this.unloaded) return;
      const path = Object.keys(this.settings.savedWindowsByPath).find((candidate) => !attempted.has(candidate));
      if (path === undefined) break;
      attempted.add(path);
      // The top-level note has its own toggle and its own saved position. It is
      // kept out of the list when it is written, so an entry here means the two
      // settings went out of step, not that it should be reopened.
      if (path === this.settings.topLevelNotePath) continue;
      const file = this.app.vault.getAbstractFileByPath(path);
      // An entry whose file is missing right now is kept rather than dropped:
      // the same vault can be opened where that file has not been synced yet.
      if (!(file instanceof TFile)) continue;
      // One window per entry. A window that is already open claims the entry
      // whose name it carries, which is how a note the user opened by hand, or
      // one this loop has already been through, is not opened a second time.
      this.releaseDestroyedWindows(path);
      const openIds = new Set([...(this.notesByPath.get(path) ?? [])].map((note) => note.id));
      const missing = [...this.settings.savedWindowsByPath[path]].filter((saved) => !openIds.has(saved.id));
      if (!missing.length) continue;
      // Obsidian's own reopened popouts carry no name of ours, so they are
      // handed out in order; that is the one place order still decides
      // anything, and any beyond the entries left over are closed.
      const reopened = this.adoptablePopoutLeaves(path, missing.length);
      for (const saved of missing) {
        // Rechecked for every window, not once for the note: opening one hands
        // control back, and in that time the note can have its file deleted or
        // renamed, or become the top-level note.
        if (this.unloaded) return;
        if (!this.noteIsStillRestorable(path, file)) break;
        // Hiding a window removes only its own entry, so the others still stand.
        if (!this.savedWindowExists(path, saved.id)) continue;
        // The set this loop started from is stale between windows: a note
        // opened by hand in the meantime takes over an entry nothing stood in
        // for, which can be one this loop has not reached. Opening it again
        // would leave two windows sharing a name and writing over each other.
        if (this.windowExistsForId(path, saved.id)) continue;
        // Whether this window was saved collapsed does not depend on another
        // note's window manager having refused. Only the attempt does: a window
        // left expanded either way must not have its saved flag replaced with
        // the state it is stuck in.
        const wantsCollapse = saved.isCollapsed && this.settings.enableCollapsibleNotes;
        const collapse = wantsCollapse && !collapsingUnsupported;
        // Held back until the window has been placed, pinned and collapsed:
        // recording it before that would write the state it opened with over
        // the state it is being restored to.
        this.restoringId = saved.id;
        try {
          const bounds = this.boundsOnCurrentDisplay(saved);
          // The windows open one at a time so that each exists, and has been
          // placed and collapsed, before the next takes the foreground.
          const note = await this.reopenStickyNote(file, bounds, saved.id, reopened.shift());
          // Unloading refuses to open a window, which is not the note failing.
          if (this.unloaded) return;
          if (!note) {
            failures++;
            continue;
          }
          await this.applySavedWindow(note, saved, bounds, collapse);
          if (note.window.isDestroyed()) {
            failures++;
            continue;
          }
          if (wantsCollapse && !note.isCollapsed) {
            // Collapsing is refused by whole window managers rather than by
            // single windows, and every refusal warns the user, so no further
            // window is asked once one has been turned down. Restoring leaves
            // this window's entry as it found it rather than recording the
            // expanded state it is stuck in; moving the window still records
            // it, because from then on expanded is simply what it is.
            if (collapse) collapsingUnsupported = true;
            this.pendingStateCaptures.delete(note);
            continue;
          }
          // The hold is released and the window recorded, now that it is what
          // its entry describes. Placement is not read back: wherever a window
          // manager put the window is where the window is, and recording that
          // is the point.
          this.restoringId = null;
          this.rememberNoteState(note);
        } catch {
          failures++;
        } finally {
          this.restoringId = null;
        }
      }
      // Popouts left over because the loop stopped early, or skipped the
      // entries they were meant for, have nothing to be turned into.
      for (const surplus of reopened) surplus.detach();
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

  private async reopenStickyNote(file: TFile, bounds: WindowBounds, id: string, reopened: WorkspaceLeaf | undefined): Promise<StickyNoteWindow | null> {
    // Adopting the window Obsidian already put on screen avoids opening a
    // second one for it; a window the saved list has no popout for is new.
    // Either way it takes over the entry's name, so what it records from now on
    // lands in that entry rather than in one of its own.
    const adopted = reopened ? this.initializeStickyLeaf(file, reopened, { detachOnFailure: false, id }) : null;
    if (adopted) return adopted;
    // Adoption fails when the native window behind the leaf cannot be found.
    // The leaf is closed here rather than left beside the window opened for the
    // saved state, and reporting is left to that open: from the outside the
    // window came back, so the failure to reuse this one is not an error.
    reopened?.detach();
    return this.openStickyNote(file, bounds, id);
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
      // A leaf whose native window cannot be found is left in place. The toggle
      // still cannot see it, so it opens a second window onto the note, which
      // is the very thing this avoids elsewhere; closing a window the user left
      // open is the worse of the two, so it stays.
      this.initializeStickyLeaf(file, leaf, { detachOnFailure: false });
    }
  }

  // Every window that comes back at startup takes the focus as it opens,
  // whether Obsidian reopened it from its layout or the plugin opened it for a
  // saved entry, so the last of them has the focus once restoring is done. The
  // user opened Obsidian to work in Obsidian, though, not in whichever note
  // happened to come back last; and a pinned note is not a child of the main
  // window, so with the focus on it the main window is not even in front. The
  // focus is handed back to the main window. Only when a sticky note holds it:
  // a window is only reported focused while Obsidian is the active
  // application, so the user who has switched away during startup is not
  // pulled back.
  // The event arrives while the application is still becoming active, and
  // which window holds the focus settles after that; Obsidian's own window
  // container waits 100ms for the same reason when its window gains the focus
  // before it reads which document has it.
  private readonly onAppActivate = () => {
    window.setTimeout(() => this.returnFocusToMainWindow(), FOCUS_SETTLE_MS);
  };

  private returnFocusToMainWindow(): void {
    if (this.unloaded) return;
    const stickyNoteHasFocus = [...this.allNotes()].some((note) => {
      try {
        return !note.window.isDestroyed() && note.window.isFocused();
      } catch {
        // A window that has died since cannot be the one holding the focus.
        return false;
      }
    });
    if (!stickyNoteHasFocus) return;
    const mainWindow = this.nativeMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Focusing does not bring a minimized window back, as Obsidian's own
    // container focus does before it.
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }

  // Reading a window is a call into the main process, which throws once that
  // window is gone rather than answering. Everything that walks the open
  // windows has to survive one of them having died, so the question is asked
  // here and nowhere else.
  private windowIsGone(note: StickyNoteWindow): boolean {
    try {
      return note.window.isDestroyed();
    } catch {
      // An unusable proxy is as good as a destroyed window.
      return true;
    }
  }

  // A window can be destroyed without its document unloading, which leaves the
  // note tracked. Nothing notices on its own, because a window that is gone
  // sends no events, and while it is tracked it goes on standing in for the
  // saved entry it claimed, so the note gains an entry every time it is opened
  // again. Asked before anything counts which entries are claimed.
  private releaseDestroyedWindows(path: string): void {
    for (const note of [...(this.notesByPath.get(path) ?? [])]) {
      if (this.windowIsGone(note)) this.untrackNote(note);
    }
  }

  private unclaimedWindowId(path: string): string | undefined {
    this.releaseDestroyedWindows(path);
    const openIds = new Set([...(this.notesByPath.get(path) ?? [])].map((note) => note.id));
    return this.settings.savedWindowsByPath[path]?.find((saved) => !openIds.has(saved.id))?.id;
  }

  private savedWindowExists(path: string, id: string): boolean {
    return this.settings.savedWindowsByPath[path]?.some((saved) => saved.id === id) ?? false;
  }

  private windowExistsForId(path: string, id: string): boolean {
    for (const note of this.notesByPath.get(path) ?? []) {
      if (note.id === id) return true;
    }
    return false;
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
    // Only the size of the saved work area is stored, never its origin, so the
    // origin in front of us now stands in for it. That holds while the displays
    // are arranged as they were; rearranging them shifts the reference.
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

  private initializeStickyLeaf(file: TFile, leaf: WorkspaceLeaf, options: { detachOnFailure?: boolean; id?: string } = {}): StickyNoteWindow | null {
    // A window opened without a name of its own takes over an entry that no
    // window is standing in for. Entries outlive their windows whenever the
    // closing was not the user's doing: a window destroyed without its document
    // unloading, one closed while Obsidian was going down, and one whose
    // dismissal is still waiting to be applied. Opening the note again would
    // otherwise leave a new entry beside each of those, and every one of them
    // would be reopened at the next start.
    const { detachOnFailure = true, id = this.unclaimedWindowId(file.path) ?? crypto.randomUUID() } = options;
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

    const note: StickyNoteWindow = { id, file, leaf, document, window: browserWindow, isCollapsed: false };
    this.initializedLeaves.add(leaf);
    this.trackNote(note);
    this.prepareWindow(note);
    this.watchWindow(note, domWindow);
    this.watchHeaderGestures(note, domWindow);
    this.watchWindowGeometry(note);
    this.rememberNoteState(note);
    this.registerDomEvent(domWindow, "beforeunload", () => {
      this.rememberTopLevelPosition(note);
      // Hiding untracks the note before its window closes, so a window still
      // tracked here was not closed through the plugin's own hide. Unless
      // Obsidian is on its way out, that was the user closing the window
      // through its frame, which is as much a dismissal as the hide button.
      // The top-level note's toggle also closes its windows without untracking
      // them and lands here. Dropping its entry is the same tidying recording
      // it does, since it is never meant to be in the list at all.
      if (this.isTracked(note) && !this.shuttingDown) this.scheduleNoteDismissal(note);
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
    // Marks the note's own pane, as a popout can hold other panes whose headers
    // the plugin leaves alone.
    note.leaf.view.containerEl.classList.add("desktop-sticky-note-view");
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
    this.watchForCancelledShutdown(domWindow);
  }

  private watchForCancelledShutdown(domWindow: Window): void {
    this.registerDomEvent(domWindow, "pointerdown", this.releaseShutdownLatch);
    // A chord with the command key is a command, not the user working on, and
    // the quit shortcut itself is one of them: its keydown may reach the
    // renderer after the signal it caused.
    this.registerDomEvent(domWindow, "keydown", (event) => {
      if (!event.metaKey && !event.ctrlKey) this.releaseShutdownLatch();
    });
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

  // Double-clicking the empty part of a note header toggles the collapse, the
  // way a double-click on a title bar acts on a window. That part of the header
  // is a native drag region, which swallows every mouse event before the page
  // sees it, and a native double-click there zooms the window instead. So while
  // a window is focused, styles.css turns the header into ordinary page content
  // and the drag is carried out here. An inactive window keeps the native drag
  // region: macOS does not pass the click that activates a window on to the
  // page, so a drag run by the page could not start with that click.
  // Only macOS is covered: the behavior above was measured there, and under
  // Wayland a window cannot be moved by setting its position at all.
  private watchHeaderGestures(note: StickyNoteWindow, domWindow: Window): void {
    if (!Platform.isMacOS) return;
    const { document } = note;
    let drag: HeaderDrag | null = null;
    // Whether the latest press dragged the window. A click that follows another
    // one quickly and then drags is a move, not the second half of a double-click.
    let lastPressMoved = false;
    let pendingPosition: [number, number] | null = null;
    let frameRequested = false;
    // The first click of a double-click on an inactive window lands on the native
    // drag region and only activates the window; the page never sees it. The
    // cursor position at that moment is kept so that a second click on the same
    // spot shortly afterwards can still be recognized as a double-click. Times
    // are event timestamps rather than handler times: activating a window keeps
    // its main thread busy, which delays the handlers but not the timestamps.
    let activation: { at: number; x: number; y: number } | null = null;

    const gestureHeader = (event: Event): HTMLElement | null => {
      if (!this.settings.enableCollapsibleNotes) return null;
      return this.emptyHeaderAt(note, event.target);
    };

    const endDrag = () => {
      if (!drag) return;
      if (drag.header.hasPointerCapture(drag.pointerId)) drag.header.releasePointerCapture(drag.pointerId);
      lastPressMoved = drag.moved;
      drag = null;
    };

    this.registerDomEvent(domWindow, "focus", (event: FocusEvent) => {
      if (!this.settings.enableCollapsibleNotes) return;
      const cursor = screen.getCursorScreenPoint();
      activation = { at: event.timeStamp, x: cursor.x, y: cursor.y };
    });

    this.registerDomEvent(document, "pointerdown", (event: PointerEvent) => {
      const header = gestureHeader(event);
      if (!header) return;
      // The header keeps the behavior it has as a drag region: nothing inside
      // it, such as the editable title, reacts to a press that lands there.
      event.stopPropagation();
      if (event.button !== 0 || note.window.isDestroyed()) return;
      const previous = activation;
      activation = null;
      // The second click comes strictly after the activation. A click stamped
      // before it is the activating click itself, which reaches the page when
      // the header was not a drag region yet; on its own it is a single click.
      if (previous
        && event.timeStamp > previous.at
        && event.timeStamp - previous.at <= doubleClickIntervalMs()
        && Math.abs(event.screenX - previous.x) <= ACTIVATION_DOUBLE_CLICK_SLOP
        && Math.abs(event.screenY - previous.y) <= ACTIVATION_DOUBLE_CLICK_SLOP) {
        this.toggleCollapsedFromHeader(note);
        return;
      }
      // Mouse event screen coordinates are screen points, the unit window
      // positions use, independent of the page zoom (measured on macOS).
      const [startX, startY] = note.window.getPosition();
      drag = { pointerId: event.pointerId, header, startScreenX: event.screenX, startScreenY: event.screenY, startX, startY, moved: false };
      // Captured so that the drag keeps receiving moves when a fast pointer
      // leaves the window before the window catches up with it.
      header.setPointerCapture(event.pointerId);
    }, { capture: true });

    this.registerDomEvent(document, "pointermove", (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const x = Math.round(drag.startX + event.screenX - drag.startScreenX);
      const y = Math.round(drag.startY + event.screenY - drag.startScreenY);
      if (x === drag.startX && y === drag.startY) return;
      drag.moved = true;
      pendingPosition = [x, y];
      // Moves arrive faster than the screen refreshes, and each position is a
      // synchronous call into the main process, so only the latest one per
      // frame is applied.
      if (frameRequested) return;
      frameRequested = true;
      domWindow.requestAnimationFrame(() => {
        frameRequested = false;
        if (!pendingPosition || note.window.isDestroyed()) return;
        note.window.setPosition(...pendingPosition);
        pendingPosition = null;
      });
    }, { capture: true });

    for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
      this.registerDomEvent(document, type, (event: PointerEvent) => {
        if (drag?.pointerId === event.pointerId) endDrag();
      }, { capture: true });
    }

    for (const type of ["mousedown", "mouseup", "click", "auxclick", "dblclick", "contextmenu"] as const) {
      this.registerDomEvent(document, type, (event: MouseEvent) => {
        if (!gestureHeader(event)) return;
        event.stopPropagation();
        // Also keeps a press from placing a caret in the editable title.
        event.preventDefault();
        // Toggled on every second click instead of on dblclick, which fires only
        // for a click count of exactly two: a double-click that follows another
        // one quickly continues its count at three and four.
        if (type !== "click" || event.button !== 0 || event.detail < 2 || event.detail % 2 !== 0 || lastPressMoved) return;
        this.toggleCollapsedFromHeader(note);
      }, { capture: true });
    }
  }

  // The part of this note's header that acts as a title bar: everything except
  // its controls. Returns that header, or null for any other target.
  private emptyHeaderAt(note: StickyNoteWindow, target: EventTarget | null): HTMLElement | null {
    // Obsidian builds popout elements from the main window, so neither window's
    // Element class matches reliably; Obsidian's instanceOf() checks across both.
    const node = target as Node | null;
    if (!node?.instanceOf(Element)) return null;
    const header = node.closest<HTMLElement>(".view-header");
    // Scoped to this note's own view, as a popout can hold other panes.
    if (!header || !note.leaf.view.containerEl.contains(header)) return null;
    if (node.closest("button, input, select, textarea, a, .clickable-icon, .view-actions")) return null;
    return header;
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
    try {
      return (BrowserWindow.getAllWindows() as unknown as NativeBrowserWindow[])
        .find((candidate) => !candidate.isDestroyed() && candidate.getTitle() === marker) ?? null;
    } finally {
      // Reading a window that closes between the two calls throws, and the
      // marker must not be left as the main window's visible title.
      mainDocument.title = previousTitle;
    }
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
      const collapse = view.addAction("chevron-down", "Collapse sticky note", () => this.toggleCollapsedFromHeader(note));
      collapse.addClass("desktop-sticky-note-collapse");
      // A rebuilt bar starts from the tracked state, like the in-place update.
      this.updateCollapseButton(collapse, note.isCollapsed);
    }

    const pin = view.addAction("pin", "Keep on top", () => {
      this.setNotePinned(note, !note.window.isAlwaysOnTop());
      this.rememberNoteState(note);
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

  // Toggles from the header, by its button or a double-click, and keeps the
  // button showing the resulting state.
  private toggleCollapsedFromHeader(note: StickyNoteWindow): void {
    this.toggleCollapsed(note);
    const collapse = note.leaf.view.containerEl.querySelector<HTMLElement>(".view-actions .desktop-sticky-note-collapse");
    if (collapse) this.updateCollapseButton(collapse, note.isCollapsed);
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
    this.rememberNoteState(note);
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
    this.rememberNoteState(note);
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
    // Every window for this note has been dismissed, so nothing is left to
    // reopen.
    this.forgetNoteStates(path);
    void this.app.workspace.requestSaveLayout();
  }

  private hideNote(note: StickyNoteWindow): void {
    this.rememberTopLevelPosition(note);
    this.clearWindowMarker(note);
    this.untrackNote(note);
    this.dismissNoteState(note);
    this.scheduleSettingsSave();
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

  private rememberNoteState(note: StickyNoteWindow): void {
    this.captureNoteState(note);
    this.scheduleSettingsSave();
  }

  // Used by the window events, which arrive continuously while a window is
  // dragged. Reading a window's geometry means a blocking call into the main
  // process for every property, so the events only mark the window and the
  // debounced timer reads it once per movement.
  private scheduleNoteStateCapture(note: StickyNoteWindow): void {
    this.pendingStateCaptures.add(note);
    this.scheduleSettingsSave();
  }

  private capturePendingNoteStates(): void {
    for (const note of [...this.pendingStateCaptures]) {
      this.pendingStateCaptures.delete(note);
      if (this.isTracked(note)) this.captureNoteState(note);
    }
  }

  // Writes one window's state into its own entry, leaving every other entry for
  // the same note alone. Nothing else has to be true for that to be safe: a
  // window that vanished unobserved simply stops updating its entry and is
  // reopened next time, and a note being restored fills its entries in as its
  // windows come up.
  private captureNoteState(note: StickyNoteWindow): void {
    if (!this.settings.restoreNotesOnStartup) return;
    // Held back while this window is being placed and pinned and collapsed:
    // until that is done it is not yet the window the entry describes.
    if (note.id === this.restoringId) return;
    const path = note.file.path;
    // The top-level note is shown and hidden by its own toggle and keeps its
    // own saved position, so it is never part of the restore list. An entry
    // that predates it becoming the top-level note is dropped here.
    if (path === this.settings.topLevelNotePath) {
      delete this.settings.savedWindowsByPath[path];
      return;
    }
    if (this.windowIsGone(note)) {
      // Dropping the stale reference stops the note being carried along by
      // everything that walks the open windows. Its entry stays, so the window
      // is reopened next time.
      this.untrackNote(note);
      return;
    }
    const windows = this.settings.savedWindowsByPath[path] ?? [];
    const index = windows.findIndex((saved) => saved.id === note.id);
    const state = this.noteWindowState(note, windows[index]);
    if (!state) return;
    if (index === -1) {
      windows.push(state);
    } else {
      windows[index] = state;
    }
    this.settings.savedWindowsByPath[path] = windows;
  }

  // A window closing through its frame and Obsidian quitting are milliseconds
  // apart, and only their order tells them apart. Rather than settle that on
  // the spot, the dismissal waits for the write that is debounced anyway: by
  // then a quit has had far longer than those milliseconds to announce itself,
  // and a dismissal caught by one is dropped.
  private scheduleNoteDismissal(note: StickyNoteWindow): void {
    this.pendingDismissals.set(note, performance.now());
    this.scheduleSettingsSave();
  }

  private applyPendingDismissals(): void {
    const dismissed = [...this.pendingDismissals];
    this.pendingDismissals.clear();
    // Only the closings that could be part of the shutdown are dropped. A
    // window closed well before Obsidian said anything was closed by the user,
    // however little of the debounce was left when the shutdown arrived.
    const signalledAt = this.shuttingDown ? this.shutdownSignalledAt ?? this.unloadedAt : null;
    for (const [note, queuedAt] of dismissed) {
      if (signalledAt !== null && queuedAt >= signalledAt - SHUTDOWN_RACE_SLACK_MS) continue;
      this.dismissNoteState(note);
    }
  }

  // Takes one window out of the saved list, which is what the user closing it
  // means, whether through the hide button or the window frame. A window that
  // goes away for any other reason keeps its entry and comes back.
  private dismissNoteState(note: StickyNoteWindow): void {
    if (!this.settings.restoreNotesOnStartup) return;
    const path = note.file.path;
    // A dismissal can be queued for a window that is already gone while its
    // entry is handed to a window opened since. Taking the entry then would
    // take the new window's record with it, so an entry a live window stands
    // in for is left alone; that window's own closing will come back here.
    if (this.windowExistsForId(path, note.id)) return;
    // Same exclusion as captureNoteState(): the top-level note is never in the
    // list, so dismissing one of its windows takes the whole entry rather than
    // leaving the rest of a list that should not be there.
    if (path === this.settings.topLevelNotePath) {
      this.forgetNoteStates(path);
      return;
    }
    const windows = this.settings.savedWindowsByPath[path];
    if (!windows) return;
    const remaining = windows.filter((saved) => saved.id !== note.id);
    if (remaining.length) {
      this.settings.savedWindowsByPath[path] = remaining;
    } else {
      delete this.settings.savedWindowsByPath[path];
    }
  }

  private noteWindowState(note: StickyNoteWindow, previous: SavedNoteWindow | undefined): SavedNoteWindow | null {
    try {
      const bounds = this.expandedBounds(note);
      if (!bounds) return null;
      const { width, height } = screen.getDisplayMatching(bounds).workArea;
      return {
        id: note.id,
        bounds,
        workArea: { width, height },
        isPinned: note.window.isAlwaysOnTop(),
        // While the collapse feature is off no window can report itself
        // collapsed, so recording the flag would erase it for every note that
        // was collapsed when the feature was switched off. This window's own
        // saved flag is carried over instead, until it can change it again.
        isCollapsed: this.settings.enableCollapsibleNotes ? note.isCollapsed : previous?.isCollapsed ?? false
      };
    } catch {
      // The remote proxy becomes invalid as soon as a window closes. The entry
      // keeps what it last held, so the window is reopened next time.
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
    // Unloading has already flushed the pending write, and a timer armed after
    // that has nothing left to clear it or to save on behalf of.
    if (this.unloaded) return;
    if (this.settingsSaveTimer !== null) window.clearTimeout(this.settingsSaveTimer);
    this.settingsSaveTimer = window.setTimeout(() => {
      this.settingsSaveTimer = null;
      this.capturePendingNoteStates();
      this.applyPendingDismissals();
      void this.saveSettings();
    }, SETTINGS_SAVE_DEBOUNCE_MS);
  }

  // Unloading is the last chance to write, so this does not depend on a write
  // already being due: scheduling one is refused from here on.
  private flushSettingsSave(): void {
    if (this.settingsSaveTimer !== null) {
      window.clearTimeout(this.settingsSaveTimer);
      this.settingsSaveTimer = null;
    }
    this.capturePendingNoteStates();
    // Unloading answers the deferred dismissals, but not all of them the same
    // way: a window closed long enough before it was closed by the user.
    this.applyPendingDismissals();
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
