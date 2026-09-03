import { MarkdownView, Notice, Platform, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, WorkspaceLeaf, normalizePath, setIcon, setTooltip } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { BrowserWindow, globalShortcut, screen } from "@electron/remote";

const DEFAULT_COLOR = "#fff3a3";
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 360;
const WINDOW_NAME_PREFIX = "desktop-sticky-notes:";
const MIN_WINDOW_OPACITY = 0.2;
const FULL_WINDOW_OPACITY = 1;
const WINDOW_OPACITY_STEP = 0.05;
const LEGACY_DEFAULT_GLOBAL_SHORTCUT = "CommandOrControl+Alt+N";

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

function isWindowOpacity(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
    && value >= MIN_WINDOW_OPACITY && value <= FULL_WINDOW_OPACITY;
}

function normalizeWindowOpacity(value: number): number {
  // Keeps the stored value on the slider's own grid, so that the persisted
  // value, the slider position and the applied opacity always agree, whether
  // the value came from the slider or from a hand-edited data.json.
  return Math.round(Math.round(value / WINDOW_OPACITY_STEP) * WINDOW_OPACITY_STEP * 100) / 100;
}

interface StickyNoteSettings {
  defaultFolder: string;
  defaultNoteColor: string;
  windowOpacity: number;
  opaqueWhileFocused: boolean;
  globalToggleShortcuts: Record<DesktopPlatform, string>;
  topLevelNotePath: string | null;
  topLevelWindowPosition: WindowPosition | null;
  colorsByPath: Record<string, string>;
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

function createDefaultSettings(): StickyNoteSettings {
  return {
    defaultFolder: "",
    defaultNoteColor: DEFAULT_COLOR,
    windowOpacity: FULL_WINDOW_OPACITY,
    opaqueWhileFocused: true,
    globalToggleShortcuts: { ...DEFAULT_GLOBAL_SHORTCUTS },
    topLevelNotePath: null,
    topLevelWindowPosition: null,
    colorsByPath: {}
  };
}

interface StickyNoteWindow {
  file: TFile;
  leaf: WorkspaceLeaf;
  document: Document;
  window: NativeBrowserWindow;
  observer?: MutationObserver;
  // Opacity last applied to the native window, whether the setting or full
  // opacity for the focused window, so that the refresh passes can skip the
  // remote call while the target is unchanged.
  appliedOpacity?: number;
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
  setOpacity(opacity: number): void;
  close(): void;
  destroy(): void;
  getPosition(): [number, number];
}

export default class DesktopStickyNotesPlugin extends Plugin {
  settings: StickyNoteSettings = createDefaultSettings();
  private notesByPath = new Map<string, Set<StickyNoteWindow>>();
  private initializedLeaves = new WeakSet<WorkspaceLeaf>();
  private registeredGlobalShortcut: string | null = null;
  private shortcutRegistrationTimer: number | null = null;
  private unloaded = false;
  private opacitySaveTimer: number | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
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
  }

  onunload(): void {
    this.unloaded = true;
    if (this.shortcutRegistrationTimer !== null) window.clearTimeout(this.shortcutRegistrationTimer);
    this.flushWindowOpacitySave();
    this.unregisterGlobalToggleShortcut();
    for (const note of [...this.allNotes()]) {
      this.rememberTopLevelPosition(note);
      this.restoreWindowOpacity(note);
      note.observer?.disconnect();
      note.leaf.detach();
      this.forceCloseWindow(note.window);
    }
    this.notesByPath.clear();
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
      windowOpacity: isWindowOpacity(stored.windowOpacity)
        ? normalizeWindowOpacity(stored.windowOpacity)
        : defaults.windowOpacity,
      opaqueWhileFocused: typeof stored.opaqueWhileFocused === "boolean"
        ? stored.opaqueWhileFocused
        : defaults.opaqueWhileFocused,
      globalToggleShortcuts,
      topLevelNotePath: stored.topLevelNotePath ?? defaults.topLevelNotePath,
      topLevelWindowPosition: stored.topLevelWindowPosition ?? defaults.topLevelWindowPosition,
      colorsByPath: stored.colorsByPath ?? defaults.colorsByPath
    };

    // A stored opacity that was rejected or snapped to the slider's grid is
    // written back, so that data.json and the value in use do not disagree
    // until some unrelated setting happens to trigger the next save. A vault
    // that never stored the key keeps its data.json untouched.
    const opacityWasCorrected = Object.prototype.hasOwnProperty.call(stored, "windowOpacity")
      && stored.windowOpacity !== this.settings.windowOpacity;
    if (opacityWasCorrected || Object.prototype.hasOwnProperty.call(stored, "globalToggleShortcut")) {
      await this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    // Most callers start a save without awaiting it, and saveData() serializes
    // the settings when it runs. Two overlapping writes can therefore finish in
    // either order and leave data.json holding the older of the two states, so
    // every write goes through one chain and reads the settings when its turn
    // comes. A failed write does not stall the chain for the writes behind it.
    const write = this.saveQueue.then(() => this.saveData(this.settings));
    this.saveQueue = write.catch(() => undefined);
    await write;
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

  async setTopLevelNote(path: string | null): Promise<void> {
    this.settings.topLevelNotePath = path;
    await this.saveSettings();
    this.scheduleRefreshAllNotes();
    new Notice(path ? `Top-level sticky note: ${path}` : "Top-level sticky note cleared.");
  }

  async openStickyNote(file: TFile): Promise<void> {
    const savedPosition = file.path === this.settings.topLevelNotePath
      ? this.settings.topLevelWindowPosition
      : null;
    const initialPosition = savedPosition && this.positionIsVisible(savedPosition)
      ? savedPosition
      : null;
    const leaf = this.app.workspace.openPopoutLeaf({
      size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      ...(initialPosition ? { x: initialPosition.x, y: initialPosition.y } : {})
    });
    await leaf.openFile(file, { active: true });

    this.initializeStickyLeaf(file, leaf);
  }

  private initializeStickyLeaf(file: TFile, leaf: WorkspaceLeaf, detachOnFailure = true): boolean {
    if (this.initializedLeaves.has(leaf)) return false;

    // The view's ownerDocument is permanently tied to this popout. Obsidian's
    // activeDocument is global and can point at the main window after blur.
    const document = leaf.view.containerEl.ownerDocument;
    const domWindow = document.defaultView;
    if (!domWindow) {
      if (detachOnFailure) {
        leaf.detach();
        new Notice("Could not access the sticky-note document.");
      }
      return false;
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
      return false;
    }

    const note: StickyNoteWindow = { file, leaf, document, window: browserWindow };
    this.initializedLeaves.add(leaf);
    this.trackNote(note);
    this.prepareWindow(note);
    this.watchWindow(note, domWindow);
    this.registerDomEvent(domWindow, "beforeunload", () => {
      this.rememberTopLevelPosition(note);
      this.untrackNote(note);
    });
    return true;
  }

  private prepareWindow(note: StickyNoteWindow): void {
    // scheduleRefreshNote() uses plain timeouts, which outlive the plugin. A
    // pass that runs after unload would decorate a window the plugin no longer
    // owns and undo the opacity that unload has just restored.
    if (this.unloaded || note.window.isDestroyed()) return;
    const { document, window } = note;
    const nativeTitle = this.nativeNoteWindowTitle(note.file);
    const domWindow = document.defaultView;
    if (domWindow) domWindow.name = this.windowNameForPath(note.file.path);
    document.documentElement.dataset.desktopStickyNoteWindow = "true";
    document.documentElement.dataset.desktopStickyNotePath = note.file.path;
    document.title = nativeTitle;
    window.setTitle(nativeTitle);
    document.body.classList.add("desktop-sticky-note");
    document.querySelector(".workspace-tab-header-container")?.remove();
    this.applyColor(note, this.noteColor(note.file.path), false);
    this.configureWindowOwnership(note);
    this.applyWindowOpacity(note);
    window.setResizable(true);
    this.addStickyActions(note);
    this.observePresentation(note);
  }

  private watchWindow(note: StickyNoteWindow, domWindow: Window): void {
    const restore = () => this.scheduleRefreshNote(note);
    this.registerDomEvent(domWindow, "focus", restore);
    this.registerDomEvent(domWindow, "blur", restore);
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
      && !!actions?.querySelector(".desktop-sticky-note-color-picker");
  }

  private addStickyActions(note: StickyNoteWindow): void {
    const view = note.leaf.view;
    if (!(view instanceof MarkdownView)) return;
    const actions = view.containerEl.querySelector(".view-actions");
    actions?.empty();

    const pin = view.addAction("pin", "Keep on top", () => {
      const pinned = !note.window.isAlwaysOnTop();
      // A child window's stacking is constrained by its application parent on
      // some window managers. Promote it to a native top-level window before
      // enabling the OS-wide always-on-top state.
      if (pinned) note.window.setParentWindow(null);
      note.window.setAlwaysOnTop(pinned);
      this.configureWindowOwnership(note);
      if (pinned) note.window.moveTop();
      this.updatePinButton(pin, note.window.isAlwaysOnTop());
    });
    this.updatePinButton(pin, note.window.isAlwaysOnTop());

    const colorPicker = actions?.createEl("input", {
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
    this.updateModeButton(mode, view.getMode());
    view.addAction("x", "Hide sticky note", () => this.hideNote(note))
      .addClass("desktop-sticky-note-hide");
  }

  private updatePinButton(button: HTMLElement, pinned: boolean): void {
    setIcon(button, pinned ? "pin-off" : "pin");
    setTooltip(button, pinned ? "Stop keeping on top" : "Keep on top");
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

  setWindowOpacity(opacity: number): void {
    // Checked before normalizing: normalization coerces its argument, so a
    // caller outside the type system could otherwise slip a string through.
    if (!isWindowOpacity(opacity)) return;
    const normalized = normalizeWindowOpacity(opacity);
    if (normalized === this.settings.windowOpacity) return;
    this.settings.windowOpacity = normalized;
    for (const note of this.allNotes()) this.applyWindowOpacity(note);
    this.scheduleWindowOpacitySave();
  }

  async setOpaqueWhileFocused(enabled: boolean): Promise<void> {
    if (enabled === this.settings.opaqueWhileFocused) return;
    this.settings.opaqueWhileFocused = enabled;
    for (const note of this.allNotes()) this.applyWindowOpacity(note);
    await this.saveSettings();
  }

  private scheduleWindowOpacitySave(): void {
    // Obsidian releases before 1.5.9 report a slider value per drag step, and
    // key repeat does so in every release. Overlapping saveData() calls have no
    // guaranteed write order, so only the settled value is persisted.
    if (this.opacitySaveTimer !== null) window.clearTimeout(this.opacitySaveTimer);
    this.opacitySaveTimer = window.setTimeout(() => {
      this.opacitySaveTimer = null;
      void this.saveSettings();
    }, 400);
  }

  private flushWindowOpacitySave(): void {
    if (this.opacitySaveTimer === null) return;
    window.clearTimeout(this.opacitySaveTimer);
    this.opacitySaveTimer = null;
    void this.saveSettings();
  }

  // The focus and blur passes call this, so a window that has the focus is
  // brought to full opacity and back as the focus moves.
  private applyWindowOpacity(note: StickyNoteWindow): void {
    const opacity = this.targetWindowOpacity(note);
    if (note.appliedOpacity === opacity) return;
    // A window opens fully opaque, so the default setting needs no native call
    // here. Returning to full opacity from a lower value still does, which is
    // why the applied value is tracked rather than compared against the default.
    if (note.appliedOpacity === undefined && opacity === FULL_WINDOW_OPACITY) {
      note.appliedOpacity = opacity;
      return;
    }
    this.setNativeOpacity(note.window, opacity);
    // Recorded even when the call did not get through, so that a window with a
    // dead remote proxy is not retried on every focus and layout pass.
    note.appliedOpacity = opacity;
  }

  // Called before a window is closed. The close normally makes this moot, but a
  // window that survives it must not be left translucent with nothing tracking
  // it any more.
  private restoreWindowOpacity(note: StickyNoteWindow): void {
    if (note.appliedOpacity === undefined || note.appliedOpacity === FULL_WINDOW_OPACITY) return;
    this.setNativeOpacity(note.window, FULL_WINDOW_OPACITY);
    note.appliedOpacity = FULL_WINDOW_OPACITY;
  }

  private targetWindowOpacity(note: StickyNoteWindow): number {
    const { windowOpacity, opaqueWhileFocused } = this.settings;
    if (!opaqueWhileFocused || windowOpacity === FULL_WINDOW_OPACITY) return windowOpacity;
    // The document's own focus state is what the focus and blur events that
    // trigger this describe, so it agrees with them. The native window's state
    // is a synchronous call into the main process and can lag those events.
    return note.document.hasFocus() ? FULL_WINDOW_OPACITY : windowOpacity;
  }

  private setNativeOpacity(nativeWindow: NativeBrowserWindow, opacity: number): void {
    try {
      if (nativeWindow.isDestroyed()) return;
      nativeWindow.setOpacity(opacity);
    } catch {
      // The remote proxy becomes invalid as soon as the window closes.
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
      this.restoreWindowOpacity(note);
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
    void this.app.workspace.requestSaveLayout();
  }

  private hideNote(note: StickyNoteWindow): void {
    this.rememberTopLevelPosition(note);
    this.restoreWindowOpacity(note);
    this.clearWindowMarker(note);
    this.untrackNote(note);
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
        name: "Window opacity",
        desc: "Opacity of every sticky-note window. Fully opaque by default.",
        render: (setting) => this.addWindowOpacityControl(setting)
      },
      {
        name: "Opaque while focused",
        desc: "Keep a sticky note fully opaque while its window has the focus, so that it stays easy to read while you work in it. Applies only when window opacity is below 100%.",
        render: (setting) => this.addOpaqueWhileFocusedControl(setting)
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
    this.addWindowOpacityControl(new Setting(containerEl)
      .setName("Window opacity")
      .setDesc("Opacity of every sticky-note window. Fully opaque by default."));
    this.addOpaqueWhileFocusedControl(new Setting(containerEl)
      .setName("Opaque while focused")
      .setDesc("Keep a sticky note fully opaque while its window has the focus, so that it stays easy to read while you work in it. Applies only when window opacity is below 100%."));
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

  private addWindowOpacityControl(setting: Setting): void {
    setting.addSlider((slider) => slider
      .setLimits(MIN_WINDOW_OPACITY, FULL_WINDOW_OPACITY, WINDOW_OPACITY_STEP)
      .setValue(this.plugin.settings.windowOpacity)
      .onChange((value) => this.plugin.setWindowOpacity(value)));
  }

  private addOpaqueWhileFocusedControl(setting: Setting): void {
    setting.addToggle((toggle) => toggle
      .setValue(this.plugin.settings.opaqueWhileFocused)
      .onChange((value) => void this.plugin.setOpaqueWhileFocused(value)));
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
