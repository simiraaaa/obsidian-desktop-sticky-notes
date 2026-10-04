const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { runInNewContext } = require("node:vm");
const { transformSync } = require("esbuild");

// Compile the actual plugin without loading Electron or adding a DOM dependency.
const { code } = transformSync(readFileSync(join(__dirname, "../main.ts"), "utf8"), {
  loader: "ts", format: "cjs", target: "es2022"
});

class Events {
  handlers = new Map();
  on(name, callback) {
    const handlers = this.handlers.get(name) ?? [];
    handlers.push(callback);
    this.handlers.set(name, handlers);
    return { off: () => this.handlers.set(name, handlers.filter((handler) => handler !== callback)) };
  }
  trigger(name, ...args) {
    for (const callback of this.handlers.get(name) ?? []) callback(...args);
  }
}

class Element extends EventTarget {
  children = [];
  dataset = {};
  classes = new Set();
  properties = new Map();
  classList = {
    add: (name) => this.classes.add(name),
    remove: (name) => this.classes.delete(name),
    contains: (name) => this.classes.has(name)
  };
  style = {
    setProperty: (name, value) => this.properties.set(name, value),
    getPropertyValue: (name) => this.properties.get(name) ?? ""
  };
  addClass(name) { this.classList.add(name); return this; }
  empty() { this.children = []; }
  querySelector(selector) { return this.children.find((child) => child.classList.contains(selector.slice(1))) ?? null; }
  createEl(tag, options) {
    const element = tag === "input" ? new InputElement() : new Element();
    element.addClass(options.cls);
    Object.assign(element, options.attr);
    this.children.push(element);
    return element;
  }
}
class InputElement extends Element {}
class WorkspaceWindow {}
class TFile {
  constructor(path) { this.path = path; this.basename = path.split("/").pop().replace(/\.md$/, ""); }
}
class MarkdownView {
  mode = "source";
  constructor(file, document) {
    this.file = file;
    this.actions = new Element();
    this.actions.addClass("view-actions");
    this.containerEl = new Element();
    this.containerEl.ownerDocument = document;
    this.containerEl.children.push(this.actions);
  }
  addAction(icon, title, callback) {
    const action = new Element();
    Object.assign(action, { icon, title, callback });
    this.actions.children.push(action);
    return action;
  }
  getMode() { return this.mode; }
  async setState(state) { this.mode = state.mode; }
}

function createDocument() {
  const document = {
    title: "Example — Obsidian",
    defaultView: new EventTarget(),
    documentElement: new Element(),
    body: new Element(),
    tabHeadersPresent: true,
    querySelector(selector) {
      return selector === ".workspace-tab-header-container" && this.tabHeadersPresent
        ? { remove: () => { this.tabHeadersPresent = false; } }
        : null;
    }
  };
  document.defaultView.name = "";
  return document;
}

function createHarness(settings = {}, layoutReady = false, supportsDeferredViews = true) {
  const mainDocument = createDocument();
  const leaves = new Map();
  const files = new Map();
  const windows = [];
  const timers = new Map();
  const notices = [];
  const readyCallbacks = [];
  let nextTimer = 0;
  let nextLeaf = 0;
  let stored = structuredClone(settings);

  const workspace = Object.assign(new Events(), {
    layoutReady,
    containerEl: { ownerDocument: mainDocument },
    layoutSaves: 0,
    popoutsOpened: 0,
    onLayoutReady(callback) { if (this.layoutReady) callback(); else readyCallbacks.push(callback); },
    getLeafById(id) { return leaves.get(id) ?? null; },
    iterateAllLeaves(callback) { for (const leaf of leaves.values()) callback(leaf); },
    getLayout() {
      const state = (leaf) => ({ type: "leaf", id: leaf.id, state: { type: "markdown", state: { file: leaf.view.file?.path } } });
      return {
        main: { type: "split", children: [...leaves.values()].filter((leaf) => !leaf.popout).map(state) },
        floating: { type: "floating", children: [...leaves.values()].filter((leaf) => leaf.popout).map((leaf) => ({
          type: "window", children: [{ type: "tabs", children: [state(leaf)] }]
        })) }
      };
    },
    async requestSaveLayout() { this.layoutSaves++; },
    openPopoutLeaf() { this.popoutsOpened++; return addLeaf(`new-${++nextLeaf}`); }
  });

  function addLeaf(id, { file = new TFile("Notes/Example.md"), popout = true, deferred = false, native = true } = {}) {
    const document = popout ? createDocument() : mainDocument;
    const view = new MarkdownView(file, document);
    const container = popout ? new WorkspaceWindow() : {};
    let resolveLoad;
    const leaf = {
      id, popout, document, container,
      view: deferred ? { containerEl: view.containerEl } : view,
      isDeferred: deferred,
      loadCalls: 0,
      detaches: 0,
      getContainer() { return this.container; },
      getViewState() { return { type: this.isDeferred || this.view instanceof MarkdownView ? "markdown" : "other" }; },
      async openFile(opened) { this.view.file = opened; files.set(opened.path, opened); },
      loadIfDeferred() {
        this.loadCalls++;
        return new Promise((resolve) => { resolveLoad = () => { this.view = view; this.isDeferred = false; resolve(); }; });
      },
      finishLoading() { resolveLoad(); },
      detach() {
        this.detaches++;
        leaves.delete(id);
        // Each fixture popout contains one leaf, so removing it closes the
        // native window just as Obsidian does for an empty popout.
        if (popout && !this.nativeWindow.isDestroyed()) this.nativeWindow.close();
      }
    };
    const nativeWindow = {
      destroyed: false, closes: 0, destroys: 0, focused: false, alwaysOnTop: false,
      setResizable() {}, setParentWindow(parent) { this.parent = parent; }, setSkipTaskbar() {},
      setAlwaysOnTop(value) { this.alwaysOnTop = value; }, isAlwaysOnTop() { return this.alwaysOnTop; },
      setTitle(title) { document.title = title; }, getTitle() { return document.title; },
      isDestroyed() { return this.destroyed; }, isFocused() { return this.focused; },
      isVisible() { return true; }, isMinimized() { return false; },
      show() {}, restore() {}, focus() { this.focused = true; }, moveTop() {},
      close() {
        this.closes++;
        document.defaultView.dispatchEvent(new Event("beforeunload"));
        this.destroyed = true;
        leaves.delete(id);
      },
      destroy() { this.destroys++; this.destroyed = true; leaves.delete(id); },
      getPosition() { return [120, 160]; }
    };
    leaf.nativeWindow = nativeWindow;
    if (native) windows.push(nativeWindow);
    leaves.set(id, leaf);
    files.set(file.path, file);
    return leaf;
  }

  class Plugin {
    cleanups = [];
    constructor(app) { this.app = app; }
    async loadData() { return structuredClone(stored); }
    async saveData(data) { stored = structuredClone(data); }
    addSettingTab() {} addCommand() {}
    registerEvent(ref) { this.cleanups.push(() => ref.off()); }
    registerDomEvent(target, name, callback) {
      target.addEventListener(name, callback);
      this.cleanups.push(() => target.removeEventListener(name, callback));
    }
    unload() { this.onunload(); for (const cleanup of this.cleanups) cleanup(); }
  }
  const obsidian = {
    Plugin, MarkdownView, WorkspaceWindow, TFile,
    Notice: class { constructor(message) { notices.push(message); } },
    Platform: { isMacOS: false, isWin: false },
    requireApiVersion: () => supportsDeferredViews,
    PluginSettingTab: class {},
    setIcon: (element, icon) => { element.icon = icon; },
    setTooltip: (element, title) => { element.title = title; }
  };
  const electron = {
    BrowserWindow: { getAllWindows: () => windows },
    globalShortcut: { isRegistered: () => false, register: () => true, unregister() {} },
    screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }] }
  };
  const module = { exports: {} };
  runInNewContext(code, {
    module, exports: module.exports,
    require: (name) => {
      if (name === "obsidian") return obsidian;
      if (name === "@electron/remote") return electron;
      throw new Error(`Unexpected dependency: ${name}`);
    },
    window: {
      setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); }
    },
    crypto: { randomUUID }, HTMLInputElement: InputElement,
    MutationObserver: class { observe() {} disconnect() {} }
  });
  const app = { workspace, vault: Object.assign(new Events(), { getAbstractFileByPath: (path) => files.get(path) ?? null }) };
  const plugin = new module.exports.default(app);
  return {
    plugin, workspace, mainDocument, leaves, windows, notices, addLeaf, TFile,
    saved: () => structuredClone(stored),
    ready() { workspace.layoutReady = true; for (const callback of readyCallbacks.splice(0)) callback(); },
    flushTimers() { const callbacks = [...timers.values()]; timers.clear(); for (const callback of callbacks) callback(); }
  };
}

module.exports = { createHarness };
