"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/@electron/remote/dist/src/renderer/callbacks-registry.js
var require_callbacks_registry = __commonJS({
  "node_modules/@electron/remote/dist/src/renderer/callbacks-registry.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.CallbacksRegistry = void 0;
    var CallbacksRegistry = class {
      constructor() {
        this.nextId = 0;
        this.callbacks = {};
        this.callbackIds = /* @__PURE__ */ new WeakMap();
        this.locationInfo = /* @__PURE__ */ new WeakMap();
      }
      add(callback) {
        let id = this.callbackIds.get(callback);
        if (id != null)
          return id;
        id = this.nextId += 1;
        this.callbacks[id] = callback;
        this.callbackIds.set(callback, id);
        const regexp = /at (.*)/gi;
        const stackString = new Error().stack;
        if (!stackString)
          return id;
        let filenameAndLine;
        let match;
        while ((match = regexp.exec(stackString)) !== null) {
          const location = match[1];
          if (location.includes("(native)"))
            continue;
          if (location.includes("(<anonymous>)"))
            continue;
          if (location.includes("callbacks-registry.js"))
            continue;
          if (location.includes("remote.js"))
            continue;
          if (location.includes("@electron/remote/dist"))
            continue;
          const ref = /([^/^)]*)\)?$/gi.exec(location);
          if (ref)
            filenameAndLine = ref[1];
          break;
        }
        this.locationInfo.set(callback, filenameAndLine);
        return id;
      }
      get(id) {
        return this.callbacks[id] || function() {
        };
      }
      getLocation(callback) {
        return this.locationInfo.get(callback);
      }
      apply(id, ...args) {
        return this.get(id).apply(global, ...args);
      }
      remove(id) {
        const callback = this.callbacks[id];
        if (callback) {
          this.callbackIds.delete(callback);
          delete this.callbacks[id];
        }
      }
    };
    exports2.CallbacksRegistry = CallbacksRegistry;
  }
});

// node_modules/@electron/remote/dist/src/common/type-utils.js
var require_type_utils = __commonJS({
  "node_modules/@electron/remote/dist/src/common/type-utils.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.deserialize = exports2.serialize = exports2.isSerializableObject = exports2.isPromise = void 0;
    var electron_1 = require("electron");
    function isPromise(val) {
      return val && val.then && val.then instanceof Function && val.constructor && val.constructor.reject && val.constructor.reject instanceof Function && val.constructor.resolve && val.constructor.resolve instanceof Function;
    }
    exports2.isPromise = isPromise;
    var serializableTypes = [
      Boolean,
      Number,
      String,
      Date,
      Error,
      RegExp,
      ArrayBuffer
    ];
    function isSerializableObject(value) {
      return value === null || ArrayBuffer.isView(value) || serializableTypes.some((type) => value instanceof type);
    }
    exports2.isSerializableObject = isSerializableObject;
    var objectMap = function(source, mapper) {
      const sourceEntries = Object.entries(source);
      const targetEntries = sourceEntries.map(([key, val]) => [key, mapper(val)]);
      return Object.fromEntries(targetEntries);
    };
    function serializeNativeImage(image) {
      const representations = [];
      const scaleFactors = image.getScaleFactors();
      if (scaleFactors.length === 1) {
        const scaleFactor = scaleFactors[0];
        const size = image.getSize(scaleFactor);
        const buffer = image.toBitmap({ scaleFactor });
        representations.push({ scaleFactor, size, buffer });
      } else {
        for (const scaleFactor of scaleFactors) {
          const size = image.getSize(scaleFactor);
          const dataURL = image.toDataURL({ scaleFactor });
          representations.push({ scaleFactor, size, dataURL });
        }
      }
      return { __ELECTRON_SERIALIZED_NativeImage__: true, representations };
    }
    function deserializeNativeImage(value) {
      const image = electron_1.nativeImage.createEmpty();
      if (value.representations.length === 1) {
        const { buffer, size, scaleFactor } = value.representations[0];
        const { width, height } = size;
        image.addRepresentation({ buffer, scaleFactor, width, height });
      } else {
        for (const rep of value.representations) {
          const { dataURL, size, scaleFactor } = rep;
          const { width, height } = size;
          image.addRepresentation({ dataURL, scaleFactor, width, height });
        }
      }
      return image;
    }
    function serialize(value) {
      if (value && value.constructor && value.constructor.name === "NativeImage") {
        return serializeNativeImage(value);
      }
      if (Array.isArray(value)) {
        return value.map(serialize);
      } else if (isSerializableObject(value)) {
        return value;
      } else if (value instanceof Object) {
        return objectMap(value, serialize);
      } else {
        return value;
      }
    }
    exports2.serialize = serialize;
    function deserialize(value) {
      if (value && value.__ELECTRON_SERIALIZED_NativeImage__) {
        return deserializeNativeImage(value);
      } else if (Array.isArray(value)) {
        return value.map(deserialize);
      } else if (isSerializableObject(value)) {
        return value;
      } else if (value instanceof Object) {
        return objectMap(value, deserialize);
      } else {
        return value;
      }
    }
    exports2.deserialize = deserialize;
  }
});

// node_modules/@electron/remote/dist/src/common/get-electron-binding.js
var require_get_electron_binding = __commonJS({
  "node_modules/@electron/remote/dist/src/common/get-electron-binding.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getElectronBinding = void 0;
    var getElectronBinding = (name) => {
      if (process._linkedBinding) {
        return process._linkedBinding("electron_common_" + name);
      } else if (process.electronBinding) {
        return process.electronBinding(name);
      } else {
        return null;
      }
    };
    exports2.getElectronBinding = getElectronBinding;
  }
});

// node_modules/@electron/remote/dist/src/common/module-names.js
var require_module_names = __commonJS({
  "node_modules/@electron/remote/dist/src/common/module-names.js"(exports2) {
    "use strict";
    var _a;
    var _b;
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.browserModuleNames = exports2.commonModuleNames = void 0;
    var get_electron_binding_1 = require_get_electron_binding();
    exports2.commonModuleNames = [
      "clipboard",
      "nativeImage",
      "shell"
    ];
    exports2.browserModuleNames = [
      "app",
      "autoUpdater",
      "BaseWindow",
      "BrowserView",
      "BrowserWindow",
      "contentTracing",
      "crashReporter",
      "dialog",
      "globalShortcut",
      "ipcMain",
      "inAppPurchase",
      "Menu",
      "MenuItem",
      "nativeTheme",
      "net",
      "netLog",
      "MessageChannelMain",
      "Notification",
      "powerMonitor",
      "powerSaveBlocker",
      "protocol",
      "pushNotifications",
      "safeStorage",
      "screen",
      "session",
      "ServiceWorkerMain",
      "ShareMenu",
      "systemPreferences",
      "TopLevelWindow",
      "TouchBar",
      "Tray",
      "utilityProcess",
      "View",
      "webContents",
      "WebContentsView",
      "webFrameMain"
    ].concat(exports2.commonModuleNames);
    var features = get_electron_binding_1.getElectronBinding("features");
    if (((_a = features === null || features === void 0 ? void 0 : features.isDesktopCapturerEnabled) === null || _a === void 0 ? void 0 : _a.call(features)) !== false) {
      exports2.browserModuleNames.push("desktopCapturer");
    }
    if (((_b = features === null || features === void 0 ? void 0 : features.isViewApiEnabled) === null || _b === void 0 ? void 0 : _b.call(features)) !== false) {
      exports2.browserModuleNames.push("ImageView");
    }
  }
});

// node_modules/@electron/remote/dist/src/renderer/remote.js
var require_remote = __commonJS({
  "node_modules/@electron/remote/dist/src/renderer/remote.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createFunctionWithReturnValue = exports2.getGlobal = exports2.getCurrentWebContents = exports2.getCurrentWindow = exports2.getBuiltin = void 0;
    var callbacks_registry_1 = require_callbacks_registry();
    var type_utils_1 = require_type_utils();
    var electron_1 = require("electron");
    var module_names_1 = require_module_names();
    var get_electron_binding_1 = require_get_electron_binding();
    var { Promise: Promise2 } = global;
    var callbacksRegistry = new callbacks_registry_1.CallbacksRegistry();
    var remoteObjectCache = /* @__PURE__ */ new Map();
    var finalizationRegistry = new FinalizationRegistry((id) => {
      const ref = remoteObjectCache.get(id);
      if (ref !== void 0 && ref.deref() === void 0) {
        remoteObjectCache.delete(id);
        electron_1.ipcRenderer.send("REMOTE_BROWSER_DEREFERENCE", contextId, id, 0);
      }
    });
    var electronIds = /* @__PURE__ */ new WeakMap();
    var isReturnValue = /* @__PURE__ */ new WeakSet();
    function getCachedRemoteObject(id) {
      const ref = remoteObjectCache.get(id);
      if (ref !== void 0) {
        const deref = ref.deref();
        if (deref !== void 0)
          return deref;
      }
    }
    function setCachedRemoteObject(id, value) {
      const wr = new WeakRef(value);
      remoteObjectCache.set(id, wr);
      finalizationRegistry.register(value, id);
      return value;
    }
    function getContextId() {
      const v8Util = get_electron_binding_1.getElectronBinding("v8_util");
      if (v8Util) {
        return v8Util.getHiddenValue(global, "contextId");
      } else {
        throw new Error("Electron >=v13.0.0-beta.6 required to support sandboxed renderers");
      }
    }
    var contextId = process.contextId || getContextId();
    process.on("exit", () => {
      const command = "REMOTE_BROWSER_CONTEXT_RELEASE";
      electron_1.ipcRenderer.send(command, contextId);
    });
    var IS_REMOTE_PROXY = Symbol("is-remote-proxy");
    function wrapArgs(args, visited = /* @__PURE__ */ new Set()) {
      const valueToMeta = (value) => {
        if (visited.has(value)) {
          return {
            type: "value",
            value: null
          };
        }
        if (value && value.constructor && value.constructor.name === "NativeImage") {
          return { type: "nativeimage", value: type_utils_1.serialize(value) };
        } else if (Array.isArray(value)) {
          visited.add(value);
          const meta = {
            type: "array",
            value: wrapArgs(value, visited)
          };
          visited.delete(value);
          return meta;
        } else if (value instanceof Buffer) {
          return {
            type: "buffer",
            value
          };
        } else if (type_utils_1.isSerializableObject(value)) {
          return {
            type: "value",
            value
          };
        } else if (typeof value === "object") {
          if (type_utils_1.isPromise(value)) {
            return {
              type: "promise",
              then: valueToMeta(function(onFulfilled, onRejected) {
                value.then(onFulfilled, onRejected);
              })
            };
          } else if (electronIds.has(value)) {
            return {
              type: "remote-object",
              id: electronIds.get(value)
            };
          }
          const meta = {
            type: "object",
            name: value.constructor ? value.constructor.name : "",
            members: []
          };
          visited.add(value);
          for (const prop in value) {
            meta.members.push({
              name: prop,
              value: valueToMeta(value[prop])
            });
          }
          visited.delete(value);
          return meta;
        } else if (typeof value === "function" && isReturnValue.has(value)) {
          return {
            type: "function-with-return-value",
            value: valueToMeta(value())
          };
        } else if (typeof value === "function") {
          return {
            type: "function",
            id: callbacksRegistry.add(value),
            location: callbacksRegistry.getLocation(value),
            length: value.length
          };
        } else {
          return {
            type: "value",
            value
          };
        }
      };
      return args.map(valueToMeta);
    }
    function setObjectMembers(ref, object, metaId, members) {
      if (!Array.isArray(members))
        return;
      for (const member of members) {
        if (Object.prototype.hasOwnProperty.call(object, member.name))
          continue;
        const descriptor = { enumerable: member.enumerable };
        if (member.type === "method") {
          const remoteMemberFunction = function(...args) {
            let command;
            if (this && this.constructor === remoteMemberFunction) {
              command = "REMOTE_BROWSER_MEMBER_CONSTRUCTOR";
            } else {
              command = "REMOTE_BROWSER_MEMBER_CALL";
            }
            const ret = electron_1.ipcRenderer.sendSync(command, contextId, metaId, member.name, wrapArgs(args));
            return metaToValue(ret);
          };
          let descriptorFunction = proxyFunctionProperties(remoteMemberFunction, metaId, member.name);
          descriptor.get = () => {
            descriptorFunction.ref = ref;
            return descriptorFunction;
          };
          descriptor.set = (value) => {
            descriptorFunction = value;
            return value;
          };
          descriptor.configurable = true;
        } else if (member.type === "get") {
          descriptor.get = () => {
            const command = "REMOTE_BROWSER_MEMBER_GET";
            const meta = electron_1.ipcRenderer.sendSync(command, contextId, metaId, member.name);
            return metaToValue(meta);
          };
          if (member.writable) {
            descriptor.set = (value) => {
              const args = wrapArgs([value]);
              const command = "REMOTE_BROWSER_MEMBER_SET";
              const meta = electron_1.ipcRenderer.sendSync(command, contextId, metaId, member.name, args);
              if (meta != null)
                metaToValue(meta);
              return value;
            };
          }
        }
        Object.defineProperty(object, member.name, descriptor);
      }
    }
    function setObjectPrototype(ref, object, metaId, descriptor) {
      if (descriptor === null)
        return;
      const proto = {};
      setObjectMembers(ref, proto, metaId, descriptor.members);
      setObjectPrototype(ref, proto, metaId, descriptor.proto);
      Object.setPrototypeOf(object, proto);
    }
    function proxyFunctionProperties(remoteMemberFunction, metaId, name) {
      let loaded = false;
      const loadRemoteProperties = () => {
        if (loaded)
          return;
        loaded = true;
        const command = "REMOTE_BROWSER_MEMBER_GET";
        const meta = electron_1.ipcRenderer.sendSync(command, contextId, metaId, name);
        setObjectMembers(remoteMemberFunction, remoteMemberFunction, meta.id, meta.members);
      };
      return new Proxy(remoteMemberFunction, {
        set: (target, property, value) => {
          if (property !== "ref")
            loadRemoteProperties();
          target[property] = value;
          return true;
        },
        get: (target, property) => {
          if (property === IS_REMOTE_PROXY)
            return true;
          if (!Object.prototype.hasOwnProperty.call(target, property))
            loadRemoteProperties();
          const value = target[property];
          if (property === "toString" && typeof value === "function") {
            return value.bind(target);
          }
          return value;
        },
        ownKeys: (target) => {
          loadRemoteProperties();
          return Object.getOwnPropertyNames(target);
        },
        getOwnPropertyDescriptor: (target, property) => {
          const descriptor = Object.getOwnPropertyDescriptor(target, property);
          if (descriptor)
            return descriptor;
          loadRemoteProperties();
          return Object.getOwnPropertyDescriptor(target, property);
        }
      });
    }
    function metaToValue(meta) {
      if (!meta)
        return {};
      if (meta.type === "value") {
        return meta.value;
      } else if (meta.type === "array") {
        return meta.members.map((member) => metaToValue(member));
      } else if (meta.type === "nativeimage") {
        return type_utils_1.deserialize(meta.value);
      } else if (meta.type === "buffer") {
        return Buffer.from(meta.value.buffer, meta.value.byteOffset, meta.value.byteLength);
      } else if (meta.type === "promise") {
        return Promise2.resolve({ then: metaToValue(meta.then) });
      } else if (meta.type === "error") {
        return metaToError(meta);
      } else if (meta.type === "exception") {
        if (meta.value.type === "error") {
          throw metaToError(meta.value);
        } else {
          throw new Error(`Unexpected value type in exception: ${meta.value.type}`);
        }
      } else {
        let ret;
        if ("id" in meta) {
          const cached = getCachedRemoteObject(meta.id);
          if (cached !== void 0) {
            return cached;
          }
        }
        if (meta.type === "function") {
          const remoteFunction = function(...args) {
            let command;
            if (this && this.constructor === remoteFunction) {
              command = "REMOTE_BROWSER_CONSTRUCTOR";
            } else {
              command = "REMOTE_BROWSER_FUNCTION_CALL";
            }
            const obj = electron_1.ipcRenderer.sendSync(command, contextId, meta.id, wrapArgs(args));
            return metaToValue(obj);
          };
          ret = remoteFunction;
        } else {
          ret = {};
        }
        setObjectMembers(ret, ret, meta.id, meta.members);
        setObjectPrototype(ret, ret, meta.id, meta.proto);
        if (ret.constructor && ret.constructor[IS_REMOTE_PROXY]) {
          Object.defineProperty(ret.constructor, "name", { value: meta.name });
        }
        electronIds.set(ret, meta.id);
        setCachedRemoteObject(meta.id, ret);
        return ret;
      }
    }
    function metaToError(meta) {
      const obj = meta.value;
      for (const { name, value } of meta.members) {
        obj[name] = metaToValue(value);
      }
      return obj;
    }
    function hasSenderId(input) {
      return typeof input.senderId === "number";
    }
    function handleMessage(channel, handler) {
      electron_1.ipcRenderer.on(channel, (event, passedContextId, id, ...args) => {
        if (hasSenderId(event)) {
          if (event.senderId !== 0 && event.senderId !== void 0) {
            console.error(`Message ${channel} sent by unexpected WebContents (${event.senderId})`);
            return;
          }
        }
        if (passedContextId === contextId) {
          handler(id, ...args);
        } else {
          electron_1.ipcRenderer.send("REMOTE_BROWSER_WRONG_CONTEXT_ERROR", contextId, passedContextId, id);
        }
      });
    }
    var enableStacks = process.argv.includes("--enable-api-filtering-logging");
    function getCurrentStack() {
      const target = { stack: void 0 };
      if (enableStacks) {
        Error.captureStackTrace(target, getCurrentStack);
      }
      return target.stack;
    }
    handleMessage("REMOTE_RENDERER_CALLBACK", (id, args) => {
      callbacksRegistry.apply(id, metaToValue(args));
    });
    handleMessage("REMOTE_RENDERER_RELEASE_CALLBACK", (id) => {
      callbacksRegistry.remove(id);
    });
    exports2.require = (module3) => {
      const command = "REMOTE_BROWSER_REQUIRE";
      const meta = electron_1.ipcRenderer.sendSync(command, contextId, module3, getCurrentStack());
      return metaToValue(meta);
    };
    function getBuiltin(module3) {
      const command = "REMOTE_BROWSER_GET_BUILTIN";
      const meta = electron_1.ipcRenderer.sendSync(command, contextId, module3, getCurrentStack());
      return metaToValue(meta);
    }
    exports2.getBuiltin = getBuiltin;
    function getCurrentWindow() {
      const command = "REMOTE_BROWSER_GET_CURRENT_WINDOW";
      const meta = electron_1.ipcRenderer.sendSync(command, contextId, getCurrentStack());
      return metaToValue(meta);
    }
    exports2.getCurrentWindow = getCurrentWindow;
    function getCurrentWebContents() {
      const command = "REMOTE_BROWSER_GET_CURRENT_WEB_CONTENTS";
      const meta = electron_1.ipcRenderer.sendSync(command, contextId, getCurrentStack());
      return metaToValue(meta);
    }
    exports2.getCurrentWebContents = getCurrentWebContents;
    function getGlobal(name) {
      const command = "REMOTE_BROWSER_GET_GLOBAL";
      const meta = electron_1.ipcRenderer.sendSync(command, contextId, name, getCurrentStack());
      return metaToValue(meta);
    }
    exports2.getGlobal = getGlobal;
    Object.defineProperty(exports2, "process", {
      enumerable: true,
      get: () => exports2.getGlobal("process")
    });
    function createFunctionWithReturnValue(returnValue) {
      const func = () => returnValue;
      isReturnValue.add(func);
      return func;
    }
    exports2.createFunctionWithReturnValue = createFunctionWithReturnValue;
    var addBuiltinProperty = (name) => {
      Object.defineProperty(exports2, name, {
        enumerable: true,
        get: () => exports2.getBuiltin(name)
      });
    };
    module_names_1.browserModuleNames.forEach(addBuiltinProperty);
  }
});

// node_modules/@electron/remote/dist/src/renderer/index.js
var require_renderer = __commonJS({
  "node_modules/@electron/remote/dist/src/renderer/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    if (process.type === "browser")
      throw new Error(`"@electron/remote" cannot be required in the browser process. Instead require("@electron/remote/main").`);
    __exportStar(require_remote(), exports2);
  }
});

// node_modules/@electron/remote/renderer/index.js
var require_renderer2 = __commonJS({
  "node_modules/@electron/remote/renderer/index.js"(exports2, module2) {
    module2.exports = require_renderer();
  }
});

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DesktopStickyNotesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_remote = __toESM(require_renderer2());
var DEFAULT_COLOR = "#fff3a3";
var DEFAULT_WIDTH = 360;
var DEFAULT_HEIGHT = 360;
var WINDOW_NAME_PREFIX = "desktop-sticky-notes:";
var DEFAULT_SETTINGS = {
  defaultFolder: "",
  defaultNoteColor: DEFAULT_COLOR,
  globalToggleShortcut: "CommandOrControl+Alt+N",
  topLevelNotePath: null,
  topLevelWindowPosition: null,
  colorsByPath: {}
};
var DesktopStickyNotesPlugin = class extends import_obsidian.Plugin {
  settings = DEFAULT_SETTINGS;
  notesByPath = /* @__PURE__ */ new Map();
  initializedLeaves = /* @__PURE__ */ new WeakSet();
  registeredGlobalShortcut = null;
  shortcutRegistrationTimer = null;
  toggleInProgress = false;
  async onload() {
    await this.loadSettings();
    await this.closeStaleStickyWindows();
    this.addSettingTab(new DesktopStickyNotesSettingTab(this.app, this));
    this.registerCommands();
    this.registerFileLifecycle();
    this.registerContextMenu();
    this.registerGlobalToggleShortcut();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleRefreshAllNotes()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleRefreshAllNotes()));
  }
  onunload() {
    if (this.shortcutRegistrationTimer !== null) window.clearTimeout(this.shortcutRegistrationTimer);
    this.unregisterGlobalToggleShortcut();
    for (const note of [...this.allNotes()]) {
      this.rememberTopLevelPosition(note);
      note.observer?.disconnect();
      note.leaf.detach();
      this.forceCloseWindow(note.window);
    }
    this.notesByPath.clear();
    void this.app.workspace.requestSaveLayout();
  }
  async loadSettings() {
    const stored = await this.loadData();
    delete stored.openNotePaths;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  scheduleGlobalShortcutRegistration() {
    if (this.shortcutRegistrationTimer !== null) window.clearTimeout(this.shortcutRegistrationTimer);
    this.shortcutRegistrationTimer = window.setTimeout(() => {
      this.shortcutRegistrationTimer = null;
      this.registerGlobalToggleShortcut(true);
    }, 500);
  }
  registerGlobalToggleShortcut(showResult = false) {
    this.unregisterGlobalToggleShortcut();
    const accelerator = this.settings.globalToggleShortcut.trim();
    if (!accelerator) {
      if (showResult) new import_obsidian.Notice("Global sticky-note shortcut disabled.");
      return;
    }
    try {
      if (import_remote.globalShortcut.isRegistered(accelerator)) import_remote.globalShortcut.unregister(accelerator);
      const registered = import_remote.globalShortcut.register(accelerator, () => void this.toggleTopLevelNote());
      if (!registered) {
        new import_obsidian.Notice(`Could not register global shortcut: ${accelerator}`);
        return;
      }
      this.registeredGlobalShortcut = accelerator;
      if (showResult) new import_obsidian.Notice(`Global sticky-note shortcut: ${accelerator}`);
    } catch {
      new import_obsidian.Notice(`Invalid global shortcut: ${accelerator}`);
    }
  }
  unregisterGlobalToggleShortcut() {
    const accelerator = this.registeredGlobalShortcut;
    if (!accelerator) return;
    if (import_remote.globalShortcut.isRegistered(accelerator)) import_remote.globalShortcut.unregister(accelerator);
    this.registeredGlobalShortcut = null;
  }
  registerCommands() {
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
  registerContextMenu() {
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof import_obsidian.TFile)) return;
      menu.addItem((item) => item.setTitle("Open as sticky note").setIcon("sticky-note").onClick(() => void this.openStickyNote(file)));
      menu.addItem((item) => item.setTitle("Set as top-level sticky note").setIcon("star").onClick(() => void this.setTopLevelNote(file.path)));
    }));
  }
  registerFileLifecycle() {
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (!(file instanceof import_obsidian.TFile)) return;
      this.closeNotesForPath(file.path);
      if (this.settings.topLevelNotePath === file.path) {
        this.settings.topLevelNotePath = null;
        void this.saveSettings();
      }
      delete this.settings.colorsByPath[file.path];
      void this.saveSettings();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (!(file instanceof import_obsidian.TFile)) return;
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
  async createStickyNote() {
    const folder = this.normalizeFolder(this.settings.defaultFolder);
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const prefix = folder ? `${folder}/` : "";
    const file = await this.app.vault.create(`${prefix}${this.uniqueNoteName()}.md`, "");
    await this.openStickyNote(file);
  }
  async toggleTopLevelNote() {
    if (this.toggleInProgress) return;
    this.toggleInProgress = true;
    try {
      await this.performTopLevelToggle();
    } finally {
      this.toggleInProgress = false;
    }
  }
  async performTopLevelToggle() {
    const path = this.settings.topLevelNotePath;
    if (!path) return;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian.TFile)) {
      this.settings.topLevelNotePath = null;
      await this.saveSettings();
      return;
    }
    const nativeWindows = await this.nativeNoteWindowsForPath(path);
    const trackedWindows = [...this.notesByPath.get(path) ?? []].map((note) => note.window).filter((window2) => !window2.isDestroyed());
    const knownWindows = [.../* @__PURE__ */ new Set([...nativeWindows, ...trackedWindows])];
    if (knownWindows.some((window2) => window2.isFocused())) {
      for (const note of [...this.notesByPath.get(path) ?? []]) {
        this.rememberTopLevelPosition(note);
      }
      for (const nativeWindow of knownWindows) {
        try {
          if (!nativeWindow.isDestroyed()) nativeWindow.setParentWindow(null);
        } catch {
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
  bringWindowToFront(nativeWindow) {
    if (nativeWindow.isDestroyed()) return;
    if (nativeWindow.isMinimized()) nativeWindow.restore();
    if (!nativeWindow.isVisible()) nativeWindow.show();
    nativeWindow.moveTop();
    nativeWindow.focus();
  }
  async setTopLevelNote(path) {
    this.settings.topLevelNotePath = path;
    await this.saveSettings();
    this.scheduleRefreshAllNotes();
    new import_obsidian.Notice(path ? `Top-level sticky note: ${path}` : "Top-level sticky note cleared.");
  }
  async openStickyNote(file) {
    const savedPosition = file.path === this.settings.topLevelNotePath ? this.settings.topLevelWindowPosition : null;
    const initialPosition = savedPosition && this.positionIsVisible(savedPosition) ? savedPosition : null;
    const leaf = this.app.workspace.openPopoutLeaf({
      size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      ...initialPosition ? { x: initialPosition.x, y: initialPosition.y } : {}
    });
    await leaf.openFile(file, { active: true });
    this.initializeStickyLeaf(file, leaf);
  }
  initializeStickyLeaf(file, leaf, detachOnFailure = true) {
    if (this.initializedLeaves.has(leaf)) return false;
    const document = leaf.view.containerEl.ownerDocument;
    const domWindow = document.defaultView;
    if (!domWindow) {
      if (detachOnFailure) {
        leaf.detach();
        new import_obsidian.Notice("Could not access the sticky-note document.");
      }
      return false;
    }
    const windowMarker = `desktop-sticky-note-${crypto.randomUUID()}`;
    document.title = windowMarker;
    const browserWindow = import_remote.BrowserWindow.getAllWindows().find(
      (candidate) => candidate.getTitle() === windowMarker
    );
    if (!browserWindow) {
      if (detachOnFailure) {
        leaf.detach();
        new import_obsidian.Notice("Could not create the sticky-note window.");
      }
      return false;
    }
    const note = { file, leaf, document, window: browserWindow };
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
  prepareWindow(note) {
    if (note.window.isDestroyed()) return;
    const { document, window: window2 } = note;
    const nativeTitle = this.nativeNoteWindowTitle(note.file);
    const domWindow = document.defaultView;
    if (domWindow) domWindow.name = this.windowNameForPath(note.file.path);
    document.documentElement.dataset.desktopStickyNoteWindow = "true";
    document.documentElement.dataset.desktopStickyNotePath = note.file.path;
    document.title = nativeTitle;
    window2.setTitle(nativeTitle);
    document.body.classList.add("desktop-sticky-note");
    document.querySelector(".workspace-tab-header-container")?.remove();
    this.applyColor(note, this.noteColor(note.file.path), false);
    if (note.file.path === this.settings.topLevelNotePath) {
      window2.setParentWindow(null);
      window2.setSkipTaskbar(true);
    } else {
      window2.setSkipTaskbar(false);
      const mainWindow = this.nativeMainWindow();
      if (mainWindow && mainWindow !== window2) window2.setParentWindow(mainWindow);
    }
    window2.setResizable(true);
    this.addStickyActions(note);
    this.observePresentation(note);
  }
  watchWindow(note, domWindow) {
    const restore = () => this.scheduleRefreshNote(note);
    this.registerDomEvent(domWindow, "focus", restore);
    this.registerDomEvent(domWindow, "blur", restore);
  }
  scheduleRefreshNote(note) {
    window.setTimeout(() => this.prepareWindow(note), 0);
    window.setTimeout(() => this.prepareWindow(note), 75);
  }
  scheduleRefreshAllNotes() {
    for (const note of this.allNotes()) this.scheduleRefreshNote(note);
  }
  nativeMainWindow() {
    const mainDocument = this.app.workspace.containerEl.ownerDocument;
    const previousTitle = mainDocument.title;
    const marker = `desktop-sticky-notes-main-${crypto.randomUUID()}`;
    mainDocument.title = marker;
    const mainWindow = import_remote.BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed() && candidate.getTitle() === marker) ?? null;
    mainDocument.title = previousTitle;
    return mainWindow;
  }
  observePresentation(note) {
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
  presentationIsIntact(note) {
    const { document } = note;
    const actions = note.leaf.view.containerEl.querySelector(".view-actions");
    const expectedColor = this.noteColor(note.file.path);
    return document.body.classList.contains("desktop-sticky-note") && document.defaultView?.name === this.windowNameForPath(note.file.path) && document.documentElement.dataset.desktopStickyNoteWindow === "true" && document.documentElement.dataset.desktopStickyNotePath === note.file.path && document.title === this.nativeNoteWindowTitle(note.file) && document.documentElement.style.getPropertyValue("--background-primary") === expectedColor && document.body.style.getPropertyValue("--sticky-note-background") === expectedColor && !document.querySelector(".workspace-tab-header-container") && !!actions?.querySelector(".desktop-sticky-note-color-picker");
  }
  addStickyActions(note) {
    const view = note.leaf.view;
    if (!(view instanceof import_obsidian.MarkdownView)) return;
    const actions = view.containerEl.querySelector(".view-actions");
    actions?.empty();
    const pin = view.addAction("pin", "Keep on top", () => {
      note.window.setAlwaysOnTop(!note.window.isAlwaysOnTop());
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
    view.addAction("x", "Hide sticky note", () => this.hideNote(note)).addClass("desktop-sticky-note-hide");
  }
  updatePinButton(button, pinned) {
    (0, import_obsidian.setIcon)(button, pinned ? "pin-off" : "pin");
    (0, import_obsidian.setTooltip)(button, pinned ? "Stop keeping on top" : "Keep on top");
  }
  updateModeButton(button, mode) {
    const editing = mode === "source";
    (0, import_obsidian.setIcon)(button, editing ? "book-open" : "pencil");
    (0, import_obsidian.setTooltip)(button, editing ? "Switch to reading view" : "Switch to edit mode");
  }
  applyColor(note, color, persist = true) {
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
  noteColor(path) {
    return this.settings.colorsByPath[path] ?? this.settings.defaultNoteColor;
  }
  trackNote(note) {
    const notes = this.notesByPath.get(note.file.path) ?? /* @__PURE__ */ new Set();
    notes.add(note);
    this.notesByPath.set(note.file.path, notes);
  }
  untrackNote(note) {
    note.observer?.disconnect();
    this.initializedLeaves.delete(note.leaf);
    const notes = this.notesByPath.get(note.file.path);
    if (!notes) return;
    notes.delete(note);
    if (!notes.size) this.notesByPath.delete(note.file.path);
  }
  closeNotesForPath(path) {
    const notes = [...this.notesByPath.get(path) ?? []];
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
    void this.app.workspace.requestSaveLayout();
  }
  hideNote(note) {
    this.rememberTopLevelPosition(note);
    this.clearWindowMarker(note);
    this.untrackNote(note);
    note.leaf.detach();
    this.forceCloseWindow(note.window);
    void this.app.workspace.requestSaveLayout();
  }
  clearWindowMarker(note) {
    const domWindow = note.document.defaultView;
    if (domWindow) domWindow.name = "";
    delete note.document.documentElement.dataset.desktopStickyNoteWindow;
    delete note.document.documentElement.dataset.desktopStickyNotePath;
  }
  forceCloseWindow(nativeWindow) {
    try {
      if (!nativeWindow.isDestroyed()) nativeWindow.close();
    } catch {
    }
    window.setTimeout(() => {
      try {
        if (!nativeWindow.isDestroyed()) nativeWindow.destroy();
      } catch {
      }
    }, 50);
  }
  async closeStaleStickyWindows() {
    const windows = import_remote.BrowserWindow.getAllWindows();
    for (const candidate of windows) {
      if (candidate.isDestroyed()) continue;
      let isStickyWindow = candidate.getTitle().startsWith("Sticky note \u2014");
      if (!isStickyWindow) {
        try {
          isStickyWindow = await candidate.webContents.executeJavaScript(
            `window.name.startsWith('${WINDOW_NAME_PREFIX}')`
          ) === true;
        } catch {
        }
      }
      if (isStickyWindow && !candidate.isDestroyed()) candidate.destroy();
    }
    void this.app.workspace.requestSaveLayout();
  }
  stickyLeavesForPath(path) {
    const stickyLeaves = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof import_obsidian.MarkdownView) || leaf.view.file?.path !== path) return;
      const document = leaf.view.containerEl.ownerDocument;
      if (document.documentElement.dataset.desktopStickyNoteWindow === "true" && document.body.classList.contains("desktop-sticky-note")) {
        stickyLeaves.push(leaf);
      }
    });
    return stickyLeaves;
  }
  async nativeNoteWindowsForPath(path) {
    const matches = [];
    for (const candidate of import_remote.BrowserWindow.getAllWindows()) {
      if (candidate.isDestroyed()) continue;
      try {
        const markedPath = await candidate.webContents.executeJavaScript(
          `window.name.startsWith('${WINDOW_NAME_PREFIX}') ? decodeURIComponent(window.name.slice(${WINDOW_NAME_PREFIX.length})) : null`
        );
        if (markedPath === path) matches.push(candidate);
      } catch {
      }
    }
    return matches;
  }
  rememberTopLevelPosition(note) {
    if (note.file.path !== this.settings.topLevelNotePath || note.window.isDestroyed()) return;
    const [x, y] = note.window.getPosition();
    this.settings.topLevelWindowPosition = { x, y };
    void this.saveSettings();
  }
  positionIsVisible(position) {
    return import_remote.screen.getAllDisplays().some((display) => {
      const { x, y, width, height } = display.workArea;
      return position.x >= x - 40 && position.x < x + width - 40 && position.y >= y && position.y < y + height - 30;
    });
  }
  nativeNoteWindowTitle(file) {
    return this.nativeNoteWindowTitleForPath(file.path, file.basename);
  }
  nativeNoteWindowTitleForPath(path, basename) {
    const label = basename ?? path.split("/").pop()?.replace(/\.md$/, "") ?? "Sticky note";
    return `Sticky note \u2014 ${label}\u2063${encodeURIComponent(path)}`;
  }
  windowNameForPath(path) {
    return `${WINDOW_NAME_PREFIX}${encodeURIComponent(path)}`;
  }
  *allNotes() {
    for (const notes of this.notesByPath.values()) yield* notes;
  }
  normalizeFolder(folder) {
    return folder.trim().replace(/^\/+|\/+$/g, "");
  }
  uniqueNoteName() {
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    return `Sticky note ${stamp}`;
  }
};
var DesktopStickyNotesSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Desktop Sticky Notes" });
    new import_obsidian.Setting(containerEl).setName("Default folder").setDesc("Folder for newly created sticky notes. Leave blank for the vault root.").addText((text) => text.setPlaceholder("Vault root").setValue(this.plugin.settings.defaultFolder).onChange(async (value) => {
      this.plugin.settings.defaultFolder = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Default note color").setDesc("Background color used for notes that do not have a saved custom color.").addColorPicker((picker) => picker.setValue(this.plugin.settings.defaultNoteColor).onChange(async (value) => {
      this.plugin.settings.defaultNoteColor = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Global toggle shortcut").setDesc("System-wide shortcut for toggling the top-level sticky note. Leave blank to disable.").addText((text) => text.setPlaceholder("CommandOrControl+Alt+N").setValue(this.plugin.settings.globalToggleShortcut).onChange(async (value) => {
      this.plugin.settings.globalToggleShortcut = value.trim();
      await this.plugin.saveSettings();
      this.plugin.scheduleGlobalShortcutRegistration();
    }));
    new import_obsidian.Setting(containerEl).setName("Top-level sticky note").setDesc(this.plugin.settings.topLevelNotePath ?? "No top-level note selected.").addButton((button) => button.setButtonText("Use active file").onClick(() => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new import_obsidian.Notice("Open a Markdown file first.");
        return;
      }
      void this.plugin.setTopLevelNote(file.path).then(() => this.display());
    })).addExtraButton((button) => button.setIcon("trash").setTooltip("Clear top-level note").onClick(() => void this.plugin.setTopLevelNote(null).then(() => this.display())));
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibm9kZV9tb2R1bGVzL0BlbGVjdHJvbi9yZW1vdGUvZGlzdC9zcmMvcmVuZGVyZXIvY2FsbGJhY2tzLXJlZ2lzdHJ5LmpzIiwgIm5vZGVfbW9kdWxlcy9AZWxlY3Ryb24vcmVtb3RlL2Rpc3Qvc3JjL2NvbW1vbi90eXBlLXV0aWxzLmpzIiwgIm5vZGVfbW9kdWxlcy9AZWxlY3Ryb24vcmVtb3RlL2Rpc3Qvc3JjL2NvbW1vbi9nZXQtZWxlY3Ryb24tYmluZGluZy5qcyIsICJub2RlX21vZHVsZXMvQGVsZWN0cm9uL3JlbW90ZS9kaXN0L3NyYy9jb21tb24vbW9kdWxlLW5hbWVzLmpzIiwgIm5vZGVfbW9kdWxlcy9AZWxlY3Ryb24vcmVtb3RlL2Rpc3Qvc3JjL3JlbmRlcmVyL3JlbW90ZS5qcyIsICJub2RlX21vZHVsZXMvQGVsZWN0cm9uL3JlbW90ZS9kaXN0L3NyYy9yZW5kZXJlci9pbmRleC5qcyIsICJub2RlX21vZHVsZXMvQGVsZWN0cm9uL3JlbW90ZS9yZW5kZXJlci9pbmRleC5qcyIsICJtYWluLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmV4cG9ydHMuQ2FsbGJhY2tzUmVnaXN0cnkgPSB2b2lkIDA7XG5jbGFzcyBDYWxsYmFja3NSZWdpc3RyeSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubmV4dElkID0gMDtcbiAgICAgICAgdGhpcy5jYWxsYmFja3MgPSB7fTtcbiAgICAgICAgdGhpcy5jYWxsYmFja0lkcyA9IG5ldyBXZWFrTWFwKCk7XG4gICAgICAgIHRoaXMubG9jYXRpb25JbmZvID0gbmV3IFdlYWtNYXAoKTtcbiAgICB9XG4gICAgYWRkKGNhbGxiYWNrKSB7XG4gICAgICAgIC8vIFRoZSBjYWxsYmFjayBpcyBhbHJlYWR5IGFkZGVkLlxuICAgICAgICBsZXQgaWQgPSB0aGlzLmNhbGxiYWNrSWRzLmdldChjYWxsYmFjayk7XG4gICAgICAgIGlmIChpZCAhPSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgICBpZCA9IHRoaXMubmV4dElkICs9IDE7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tzW2lkXSA9IGNhbGxiYWNrO1xuICAgICAgICB0aGlzLmNhbGxiYWNrSWRzLnNldChjYWxsYmFjaywgaWQpO1xuICAgICAgICAvLyBDYXB0dXJlIHRoZSBsb2NhdGlvbiBvZiB0aGUgZnVuY3Rpb24gYW5kIHB1dCBpdCBpbiB0aGUgSUQgc3RyaW5nLFxuICAgICAgICAvLyBzbyB0aGF0IHJlbGVhc2UgZXJyb3JzIGNhbiBiZSB0cmFja2VkIGRvd24gZWFzaWx5LlxuICAgICAgICBjb25zdCByZWdleHAgPSAvYXQgKC4qKS9naTtcbiAgICAgICAgY29uc3Qgc3RhY2tTdHJpbmcgPSAobmV3IEVycm9yKCkpLnN0YWNrO1xuICAgICAgICBpZiAoIXN0YWNrU3RyaW5nKVxuICAgICAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgICBsZXQgZmlsZW5hbWVBbmRMaW5lO1xuICAgICAgICBsZXQgbWF0Y2g7XG4gICAgICAgIHdoaWxlICgobWF0Y2ggPSByZWdleHAuZXhlYyhzdGFja1N0cmluZykpICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBsb2NhdGlvbiA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgaWYgKGxvY2F0aW9uLmluY2x1ZGVzKCcobmF0aXZlKScpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGxvY2F0aW9uLmluY2x1ZGVzKCcoPGFub255bW91cz4pJykpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAobG9jYXRpb24uaW5jbHVkZXMoJ2NhbGxiYWNrcy1yZWdpc3RyeS5qcycpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGxvY2F0aW9uLmluY2x1ZGVzKCdyZW1vdGUuanMnKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChsb2NhdGlvbi5pbmNsdWRlcygnQGVsZWN0cm9uL3JlbW90ZS9kaXN0JykpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCByZWYgPSAvKFteL14pXSopXFwpPyQvZ2kuZXhlYyhsb2NhdGlvbik7XG4gICAgICAgICAgICBpZiAocmVmKVxuICAgICAgICAgICAgICAgIGZpbGVuYW1lQW5kTGluZSA9IHJlZlsxXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubG9jYXRpb25JbmZvLnNldChjYWxsYmFjaywgZmlsZW5hbWVBbmRMaW5lKTtcbiAgICAgICAgcmV0dXJuIGlkO1xuICAgIH1cbiAgICBnZXQoaWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FsbGJhY2tzW2lkXSB8fCBmdW5jdGlvbiAoKSB7IH07XG4gICAgfVxuICAgIGdldExvY2F0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2F0aW9uSW5mby5nZXQoY2FsbGJhY2spO1xuICAgIH1cbiAgICBhcHBseShpZCwgLi4uYXJncykge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoaWQpLmFwcGx5KGdsb2JhbCwgLi4uYXJncyk7XG4gICAgfVxuICAgIHJlbW92ZShpZCkge1xuICAgICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMuY2FsbGJhY2tzW2lkXTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrSWRzLmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5jYWxsYmFja3NbaWRdO1xuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0cy5DYWxsYmFja3NSZWdpc3RyeSA9IENhbGxiYWNrc1JlZ2lzdHJ5O1xuIiwgIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5kZXNlcmlhbGl6ZSA9IGV4cG9ydHMuc2VyaWFsaXplID0gZXhwb3J0cy5pc1NlcmlhbGl6YWJsZU9iamVjdCA9IGV4cG9ydHMuaXNQcm9taXNlID0gdm9pZCAwO1xuY29uc3QgZWxlY3Ryb25fMSA9IHJlcXVpcmUoXCJlbGVjdHJvblwiKTtcbmZ1bmN0aW9uIGlzUHJvbWlzZSh2YWwpIHtcbiAgICByZXR1cm4gKHZhbCAmJlxuICAgICAgICB2YWwudGhlbiAmJlxuICAgICAgICB2YWwudGhlbiBpbnN0YW5jZW9mIEZ1bmN0aW9uICYmXG4gICAgICAgIHZhbC5jb25zdHJ1Y3RvciAmJlxuICAgICAgICB2YWwuY29uc3RydWN0b3IucmVqZWN0ICYmXG4gICAgICAgIHZhbC5jb25zdHJ1Y3Rvci5yZWplY3QgaW5zdGFuY2VvZiBGdW5jdGlvbiAmJlxuICAgICAgICB2YWwuY29uc3RydWN0b3IucmVzb2x2ZSAmJlxuICAgICAgICB2YWwuY29uc3RydWN0b3IucmVzb2x2ZSBpbnN0YW5jZW9mIEZ1bmN0aW9uKTtcbn1cbmV4cG9ydHMuaXNQcm9taXNlID0gaXNQcm9taXNlO1xuY29uc3Qgc2VyaWFsaXphYmxlVHlwZXMgPSBbXG4gICAgQm9vbGVhbixcbiAgICBOdW1iZXIsXG4gICAgU3RyaW5nLFxuICAgIERhdGUsXG4gICAgRXJyb3IsXG4gICAgUmVnRXhwLFxuICAgIEFycmF5QnVmZmVyXG5dO1xuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYl9Xb3JrZXJzX0FQSS9TdHJ1Y3R1cmVkX2Nsb25lX2FsZ29yaXRobSNTdXBwb3J0ZWRfdHlwZXNcbmZ1bmN0aW9uIGlzU2VyaWFsaXphYmxlT2JqZWN0KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSBudWxsIHx8IEFycmF5QnVmZmVyLmlzVmlldyh2YWx1ZSkgfHwgc2VyaWFsaXphYmxlVHlwZXMuc29tZSh0eXBlID0+IHZhbHVlIGluc3RhbmNlb2YgdHlwZSk7XG59XG5leHBvcnRzLmlzU2VyaWFsaXphYmxlT2JqZWN0ID0gaXNTZXJpYWxpemFibGVPYmplY3Q7XG5jb25zdCBvYmplY3RNYXAgPSBmdW5jdGlvbiAoc291cmNlLCBtYXBwZXIpIHtcbiAgICBjb25zdCBzb3VyY2VFbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoc291cmNlKTtcbiAgICBjb25zdCB0YXJnZXRFbnRyaWVzID0gc291cmNlRW50cmllcy5tYXAoKFtrZXksIHZhbF0pID0+IFtrZXksIG1hcHBlcih2YWwpXSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyh0YXJnZXRFbnRyaWVzKTtcbn07XG5mdW5jdGlvbiBzZXJpYWxpemVOYXRpdmVJbWFnZShpbWFnZSkge1xuICAgIGNvbnN0IHJlcHJlc2VudGF0aW9ucyA9IFtdO1xuICAgIGNvbnN0IHNjYWxlRmFjdG9ycyA9IGltYWdlLmdldFNjYWxlRmFjdG9ycygpO1xuICAgIC8vIFVzZSBCdWZmZXIgd2hlbiB0aGVyZSdzIG9ubHkgb25lIHJlcHJlc2VudGF0aW9uIGZvciBiZXR0ZXIgcGVyZi5cbiAgICAvLyBUaGlzIGF2b2lkcyBjb21wcmVzc2luZyB0by9mcm9tIFBORyB3aGVyZSBpdCdzIG5vdCBuZWNlc3NhcnkgdG9cbiAgICAvLyBlbnN1cmUgdW5pcXVlbmVzcyBvZiBkYXRhVVJMcyAoc2luY2UgdGhlcmUncyBvbmx5IG9uZSkuXG4gICAgaWYgKHNjYWxlRmFjdG9ycy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgY29uc3Qgc2NhbGVGYWN0b3IgPSBzY2FsZUZhY3RvcnNbMF07XG4gICAgICAgIGNvbnN0IHNpemUgPSBpbWFnZS5nZXRTaXplKHNjYWxlRmFjdG9yKTtcbiAgICAgICAgY29uc3QgYnVmZmVyID0gaW1hZ2UudG9CaXRtYXAoeyBzY2FsZUZhY3RvciB9KTtcbiAgICAgICAgcmVwcmVzZW50YXRpb25zLnB1c2goeyBzY2FsZUZhY3Rvciwgc2l6ZSwgYnVmZmVyIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgLy8gQ29uc3RydWN0IGZyb20gZGF0YVVSTHMgdG8gZW5zdXJlIHRoYXQgdGhleSBhcmUgbm90IGxvc3QgaW4gY3JlYXRpb24uXG4gICAgICAgIGZvciAoY29uc3Qgc2NhbGVGYWN0b3Igb2Ygc2NhbGVGYWN0b3JzKSB7XG4gICAgICAgICAgICBjb25zdCBzaXplID0gaW1hZ2UuZ2V0U2l6ZShzY2FsZUZhY3Rvcik7XG4gICAgICAgICAgICBjb25zdCBkYXRhVVJMID0gaW1hZ2UudG9EYXRhVVJMKHsgc2NhbGVGYWN0b3IgfSk7XG4gICAgICAgICAgICByZXByZXNlbnRhdGlvbnMucHVzaCh7IHNjYWxlRmFjdG9yLCBzaXplLCBkYXRhVVJMIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IF9fRUxFQ1RST05fU0VSSUFMSVpFRF9OYXRpdmVJbWFnZV9fOiB0cnVlLCByZXByZXNlbnRhdGlvbnMgfTtcbn1cbmZ1bmN0aW9uIGRlc2VyaWFsaXplTmF0aXZlSW1hZ2UodmFsdWUpIHtcbiAgICBjb25zdCBpbWFnZSA9IGVsZWN0cm9uXzEubmF0aXZlSW1hZ2UuY3JlYXRlRW1wdHkoKTtcbiAgICAvLyBVc2UgQnVmZmVyIHdoZW4gdGhlcmUncyBvbmx5IG9uZSByZXByZXNlbnRhdGlvbiBmb3IgYmV0dGVyIHBlcmYuXG4gICAgLy8gVGhpcyBhdm9pZHMgY29tcHJlc3NpbmcgdG8vZnJvbSBQTkcgd2hlcmUgaXQncyBub3QgbmVjZXNzYXJ5IHRvXG4gICAgLy8gZW5zdXJlIHVuaXF1ZW5lc3Mgb2YgZGF0YVVSTHMgKHNpbmNlIHRoZXJlJ3Mgb25seSBvbmUpLlxuICAgIGlmICh2YWx1ZS5yZXByZXNlbnRhdGlvbnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGNvbnN0IHsgYnVmZmVyLCBzaXplLCBzY2FsZUZhY3RvciB9ID0gdmFsdWUucmVwcmVzZW50YXRpb25zWzBdO1xuICAgICAgICBjb25zdCB7IHdpZHRoLCBoZWlnaHQgfSA9IHNpemU7XG4gICAgICAgIGltYWdlLmFkZFJlcHJlc2VudGF0aW9uKHsgYnVmZmVyLCBzY2FsZUZhY3Rvciwgd2lkdGgsIGhlaWdodCB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIC8vIENvbnN0cnVjdCBmcm9tIGRhdGFVUkxzIHRvIGVuc3VyZSB0aGF0IHRoZXkgYXJlIG5vdCBsb3N0IGluIGNyZWF0aW9uLlxuICAgICAgICBmb3IgKGNvbnN0IHJlcCBvZiB2YWx1ZS5yZXByZXNlbnRhdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGF0YVVSTCwgc2l6ZSwgc2NhbGVGYWN0b3IgfSA9IHJlcDtcbiAgICAgICAgICAgIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gc2l6ZTtcbiAgICAgICAgICAgIGltYWdlLmFkZFJlcHJlc2VudGF0aW9uKHsgZGF0YVVSTCwgc2NhbGVGYWN0b3IsIHdpZHRoLCBoZWlnaHQgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGltYWdlO1xufVxuZnVuY3Rpb24gc2VyaWFsaXplKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlICYmIHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdOYXRpdmVJbWFnZScpIHtcbiAgICAgICAgcmV0dXJuIHNlcmlhbGl6ZU5hdGl2ZUltYWdlKHZhbHVlKTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZS5tYXAoc2VyaWFsaXplKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNTZXJpYWxpemFibGVPYmplY3QodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBPYmplY3QpIHtcbiAgICAgICAgcmV0dXJuIG9iamVjdE1hcCh2YWx1ZSwgc2VyaWFsaXplKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG59XG5leHBvcnRzLnNlcmlhbGl6ZSA9IHNlcmlhbGl6ZTtcbmZ1bmN0aW9uIGRlc2VyaWFsaXplKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlICYmIHZhbHVlLl9fRUxFQ1RST05fU0VSSUFMSVpFRF9OYXRpdmVJbWFnZV9fKSB7XG4gICAgICAgIHJldHVybiBkZXNlcmlhbGl6ZU5hdGl2ZUltYWdlKHZhbHVlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLm1hcChkZXNlcmlhbGl6ZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzU2VyaWFsaXphYmxlT2JqZWN0KHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICAgIHJldHVybiBvYmplY3RNYXAodmFsdWUsIGRlc2VyaWFsaXplKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG59XG5leHBvcnRzLmRlc2VyaWFsaXplID0gZGVzZXJpYWxpemU7XG4iLCAiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5leHBvcnRzLmdldEVsZWN0cm9uQmluZGluZyA9IHZvaWQgMDtcbmNvbnN0IGdldEVsZWN0cm9uQmluZGluZyA9IChuYW1lKSA9PiB7XG4gICAgaWYgKHByb2Nlc3MuX2xpbmtlZEJpbmRpbmcpIHtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuX2xpbmtlZEJpbmRpbmcoJ2VsZWN0cm9uX2NvbW1vbl8nICsgbmFtZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHByb2Nlc3MuZWxlY3Ryb25CaW5kaW5nKSB7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVsZWN0cm9uQmluZGluZyhuYW1lKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn07XG5leHBvcnRzLmdldEVsZWN0cm9uQmluZGluZyA9IGdldEVsZWN0cm9uQmluZGluZztcbiIsICJcInVzZSBzdHJpY3RcIjtcbnZhciBfYSwgX2I7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5leHBvcnRzLmJyb3dzZXJNb2R1bGVOYW1lcyA9IGV4cG9ydHMuY29tbW9uTW9kdWxlTmFtZXMgPSB2b2lkIDA7XG5jb25zdCBnZXRfZWxlY3Ryb25fYmluZGluZ18xID0gcmVxdWlyZShcIi4vZ2V0LWVsZWN0cm9uLWJpbmRpbmdcIik7XG5leHBvcnRzLmNvbW1vbk1vZHVsZU5hbWVzID0gW1xuICAgICdjbGlwYm9hcmQnLFxuICAgICduYXRpdmVJbWFnZScsXG4gICAgJ3NoZWxsJyxcbl07XG5leHBvcnRzLmJyb3dzZXJNb2R1bGVOYW1lcyA9IFtcbiAgICAnYXBwJyxcbiAgICAnYXV0b1VwZGF0ZXInLFxuICAgICdCYXNlV2luZG93JyxcbiAgICAnQnJvd3NlclZpZXcnLFxuICAgICdCcm93c2VyV2luZG93JyxcbiAgICAnY29udGVudFRyYWNpbmcnLFxuICAgICdjcmFzaFJlcG9ydGVyJyxcbiAgICAnZGlhbG9nJyxcbiAgICAnZ2xvYmFsU2hvcnRjdXQnLFxuICAgICdpcGNNYWluJyxcbiAgICAnaW5BcHBQdXJjaGFzZScsXG4gICAgJ01lbnUnLFxuICAgICdNZW51SXRlbScsXG4gICAgJ25hdGl2ZVRoZW1lJyxcbiAgICAnbmV0JyxcbiAgICAnbmV0TG9nJyxcbiAgICAnTWVzc2FnZUNoYW5uZWxNYWluJyxcbiAgICAnTm90aWZpY2F0aW9uJyxcbiAgICAncG93ZXJNb25pdG9yJyxcbiAgICAncG93ZXJTYXZlQmxvY2tlcicsXG4gICAgJ3Byb3RvY29sJyxcbiAgICAncHVzaE5vdGlmaWNhdGlvbnMnLFxuICAgICdzYWZlU3RvcmFnZScsXG4gICAgJ3NjcmVlbicsXG4gICAgJ3Nlc3Npb24nLFxuICAgICdTZXJ2aWNlV29ya2VyTWFpbicsXG4gICAgJ1NoYXJlTWVudScsXG4gICAgJ3N5c3RlbVByZWZlcmVuY2VzJyxcbiAgICAnVG9wTGV2ZWxXaW5kb3cnLFxuICAgICdUb3VjaEJhcicsXG4gICAgJ1RyYXknLFxuICAgICd1dGlsaXR5UHJvY2VzcycsXG4gICAgJ1ZpZXcnLFxuICAgICd3ZWJDb250ZW50cycsXG4gICAgJ1dlYkNvbnRlbnRzVmlldycsXG4gICAgJ3dlYkZyYW1lTWFpbicsXG5dLmNvbmNhdChleHBvcnRzLmNvbW1vbk1vZHVsZU5hbWVzKTtcbmNvbnN0IGZlYXR1cmVzID0gZ2V0X2VsZWN0cm9uX2JpbmRpbmdfMS5nZXRFbGVjdHJvbkJpbmRpbmcoJ2ZlYXR1cmVzJyk7XG5pZiAoKChfYSA9IGZlYXR1cmVzID09PSBudWxsIHx8IGZlYXR1cmVzID09PSB2b2lkIDAgPyB2b2lkIDAgOiBmZWF0dXJlcy5pc0Rlc2t0b3BDYXB0dXJlckVuYWJsZWQpID09PSBudWxsIHx8IF9hID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfYS5jYWxsKGZlYXR1cmVzKSkgIT09IGZhbHNlKSB7XG4gICAgZXhwb3J0cy5icm93c2VyTW9kdWxlTmFtZXMucHVzaCgnZGVza3RvcENhcHR1cmVyJyk7XG59XG5pZiAoKChfYiA9IGZlYXR1cmVzID09PSBudWxsIHx8IGZlYXR1cmVzID09PSB2b2lkIDAgPyB2b2lkIDAgOiBmZWF0dXJlcy5pc1ZpZXdBcGlFbmFibGVkKSA9PT0gbnVsbCB8fCBfYiA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2IuY2FsbChmZWF0dXJlcykpICE9PSBmYWxzZSkge1xuICAgIGV4cG9ydHMuYnJvd3Nlck1vZHVsZU5hbWVzLnB1c2goJ0ltYWdlVmlldycpO1xufVxuIiwgIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5jcmVhdGVGdW5jdGlvbldpdGhSZXR1cm5WYWx1ZSA9IGV4cG9ydHMuZ2V0R2xvYmFsID0gZXhwb3J0cy5nZXRDdXJyZW50V2ViQ29udGVudHMgPSBleHBvcnRzLmdldEN1cnJlbnRXaW5kb3cgPSBleHBvcnRzLmdldEJ1aWx0aW4gPSB2b2lkIDA7XG5jb25zdCBjYWxsYmFja3NfcmVnaXN0cnlfMSA9IHJlcXVpcmUoXCIuL2NhbGxiYWNrcy1yZWdpc3RyeVwiKTtcbmNvbnN0IHR5cGVfdXRpbHNfMSA9IHJlcXVpcmUoXCIuLi9jb21tb24vdHlwZS11dGlsc1wiKTtcbmNvbnN0IGVsZWN0cm9uXzEgPSByZXF1aXJlKFwiZWxlY3Ryb25cIik7XG5jb25zdCBtb2R1bGVfbmFtZXNfMSA9IHJlcXVpcmUoXCIuLi9jb21tb24vbW9kdWxlLW5hbWVzXCIpO1xuY29uc3QgZ2V0X2VsZWN0cm9uX2JpbmRpbmdfMSA9IHJlcXVpcmUoXCIuLi9jb21tb24vZ2V0LWVsZWN0cm9uLWJpbmRpbmdcIik7XG5jb25zdCB7IFByb21pc2UgfSA9IGdsb2JhbDtcbmNvbnN0IGNhbGxiYWNrc1JlZ2lzdHJ5ID0gbmV3IGNhbGxiYWNrc19yZWdpc3RyeV8xLkNhbGxiYWNrc1JlZ2lzdHJ5KCk7XG5jb25zdCByZW1vdGVPYmplY3RDYWNoZSA9IG5ldyBNYXAoKTtcbmNvbnN0IGZpbmFsaXphdGlvblJlZ2lzdHJ5ID0gbmV3IEZpbmFsaXphdGlvblJlZ2lzdHJ5KChpZCkgPT4ge1xuICAgIGNvbnN0IHJlZiA9IHJlbW90ZU9iamVjdENhY2hlLmdldChpZCk7XG4gICAgaWYgKHJlZiAhPT0gdW5kZWZpbmVkICYmIHJlZi5kZXJlZigpID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVtb3RlT2JqZWN0Q2FjaGUuZGVsZXRlKGlkKTtcbiAgICAgICAgZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5zZW5kKFwiUkVNT1RFX0JST1dTRVJfREVSRUZFUkVOQ0VcIiAvKiBCUk9XU0VSX0RFUkVGRVJFTkNFICovLCBjb250ZXh0SWQsIGlkLCAwKTtcbiAgICB9XG59KTtcbmNvbnN0IGVsZWN0cm9uSWRzID0gbmV3IFdlYWtNYXAoKTtcbmNvbnN0IGlzUmV0dXJuVmFsdWUgPSBuZXcgV2Vha1NldCgpO1xuZnVuY3Rpb24gZ2V0Q2FjaGVkUmVtb3RlT2JqZWN0KGlkKSB7XG4gICAgY29uc3QgcmVmID0gcmVtb3RlT2JqZWN0Q2FjaGUuZ2V0KGlkKTtcbiAgICBpZiAocmVmICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZGVyZWYgPSByZWYuZGVyZWYoKTtcbiAgICAgICAgaWYgKGRlcmVmICE9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gZGVyZWY7XG4gICAgfVxufVxuZnVuY3Rpb24gc2V0Q2FjaGVkUmVtb3RlT2JqZWN0KGlkLCB2YWx1ZSkge1xuICAgIGNvbnN0IHdyID0gbmV3IFdlYWtSZWYodmFsdWUpO1xuICAgIHJlbW90ZU9iamVjdENhY2hlLnNldChpZCwgd3IpO1xuICAgIGZpbmFsaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHZhbHVlLCBpZCk7XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gZ2V0Q29udGV4dElkKCkge1xuICAgIGNvbnN0IHY4VXRpbCA9IGdldF9lbGVjdHJvbl9iaW5kaW5nXzEuZ2V0RWxlY3Ryb25CaW5kaW5nKCd2OF91dGlsJyk7XG4gICAgaWYgKHY4VXRpbCkge1xuICAgICAgICByZXR1cm4gdjhVdGlsLmdldEhpZGRlblZhbHVlKGdsb2JhbCwgJ2NvbnRleHRJZCcpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFbGVjdHJvbiA+PXYxMy4wLjAtYmV0YS42IHJlcXVpcmVkIHRvIHN1cHBvcnQgc2FuZGJveGVkIHJlbmRlcmVycycpO1xuICAgIH1cbn1cbi8vIEFuIHVuaXF1ZSBJRCB0aGF0IGNhbiByZXByZXNlbnQgY3VycmVudCBjb250ZXh0LlxuY29uc3QgY29udGV4dElkID0gcHJvY2Vzcy5jb250ZXh0SWQgfHwgZ2V0Q29udGV4dElkKCk7XG4vLyBOb3RpZnkgdGhlIG1haW4gcHJvY2VzcyB3aGVuIGN1cnJlbnQgY29udGV4dCBpcyBnb2luZyB0byBiZSByZWxlYXNlZC5cbi8vIE5vdGUgdGhhdCB3aGVuIHRoZSByZW5kZXJlciBwcm9jZXNzIGlzIGRlc3Ryb3llZCwgdGhlIG1lc3NhZ2UgbWF5IG5vdCBiZVxuLy8gc2VudCwgd2UgYWxzbyBsaXN0ZW4gdG8gdGhlIFwicmVuZGVyLXZpZXctZGVsZXRlZFwiIGV2ZW50IGluIHRoZSBtYWluIHByb2Nlc3Ncbi8vIHRvIGd1YXJkIHRoYXQgc2l0dWF0aW9uLlxucHJvY2Vzcy5vbignZXhpdCcsICgpID0+IHtcbiAgICBjb25zdCBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9DT05URVhUX1JFTEVBU0VcIiAvKiBCUk9XU0VSX0NPTlRFWFRfUkVMRUFTRSAqLztcbiAgICBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmQoY29tbWFuZCwgY29udGV4dElkKTtcbn0pO1xuY29uc3QgSVNfUkVNT1RFX1BST1hZID0gU3ltYm9sKCdpcy1yZW1vdGUtcHJveHknKTtcbi8vIENvbnZlcnQgdGhlIGFyZ3VtZW50cyBvYmplY3QgaW50byBhbiBhcnJheSBvZiBtZXRhIGRhdGEuXG5mdW5jdGlvbiB3cmFwQXJncyhhcmdzLCB2aXNpdGVkID0gbmV3IFNldCgpKSB7XG4gICAgY29uc3QgdmFsdWVUb01ldGEgPSAodmFsdWUpID0+IHtcbiAgICAgICAgLy8gQ2hlY2sgZm9yIGNpcmN1bGFyIHJlZmVyZW5jZS5cbiAgICAgICAgaWYgKHZpc2l0ZWQuaGFzKHZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAndmFsdWUnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBudWxsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICh2YWx1ZSAmJiB2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lID09PSAnTmF0aXZlSW1hZ2UnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB0eXBlOiAnbmF0aXZlaW1hZ2UnLCB2YWx1ZTogdHlwZV91dGlsc18xLnNlcmlhbGl6ZSh2YWx1ZSkgfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgdmlzaXRlZC5hZGQodmFsdWUpO1xuICAgICAgICAgICAgY29uc3QgbWV0YSA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgIHZhbHVlOiB3cmFwQXJncyh2YWx1ZSwgdmlzaXRlZClcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2aXNpdGVkLmRlbGV0ZSh2YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gbWV0YTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJ1ZmZlcikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYnVmZmVyJyxcbiAgICAgICAgICAgICAgICB2YWx1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlX3V0aWxzXzEuaXNTZXJpYWxpemFibGVPYmplY3QodmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd2YWx1ZScsXG4gICAgICAgICAgICAgICAgdmFsdWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgaWYgKHR5cGVfdXRpbHNfMS5pc1Byb21pc2UodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Byb21pc2UnLFxuICAgICAgICAgICAgICAgICAgICB0aGVuOiB2YWx1ZVRvTWV0YShmdW5jdGlvbiAob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChlbGVjdHJvbklkcy5oYXModmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JlbW90ZS1vYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICBpZDogZWxlY3Ryb25JZHMuZ2V0KHZhbHVlKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBtZXRhID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIG5hbWU6IHZhbHVlLmNvbnN0cnVjdG9yID8gdmFsdWUuY29uc3RydWN0b3IubmFtZSA6ICcnLFxuICAgICAgICAgICAgICAgIG1lbWJlcnM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmlzaXRlZC5hZGQodmFsdWUpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwcm9wIGluIHZhbHVlKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZ3VhcmQtZm9yLWluXG4gICAgICAgICAgICAgICAgbWV0YS5tZW1iZXJzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBwcm9wLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVUb01ldGEodmFsdWVbcHJvcF0pXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2aXNpdGVkLmRlbGV0ZSh2YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gbWV0YTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgaXNSZXR1cm5WYWx1ZS5oYXModmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdmdW5jdGlvbi13aXRoLXJldHVybi12YWx1ZScsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlVG9NZXRhKHZhbHVlKCkpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIGlkOiBjYWxsYmFja3NSZWdpc3RyeS5hZGQodmFsdWUpLFxuICAgICAgICAgICAgICAgIGxvY2F0aW9uOiBjYWxsYmFja3NSZWdpc3RyeS5nZXRMb2NhdGlvbih2YWx1ZSksXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiB2YWx1ZS5sZW5ndGhcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd2YWx1ZScsXG4gICAgICAgICAgICAgICAgdmFsdWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHJldHVybiBhcmdzLm1hcCh2YWx1ZVRvTWV0YSk7XG59XG4vLyBQb3B1bGF0ZSBvYmplY3QncyBtZW1iZXJzIGZyb20gZGVzY3JpcHRvcnMuXG4vLyBUaGUgfHJlZnwgd2lsbCBiZSBrZXB0IHJlZmVyZW5jZWQgYnkgfG1lbWJlcnN8LlxuLy8gVGhpcyBtYXRjaGVzIHxnZXRPYmplY3RNZW1lYmVyc3wgaW4gcnBjLXNlcnZlci5cbmZ1bmN0aW9uIHNldE9iamVjdE1lbWJlcnMocmVmLCBvYmplY3QsIG1ldGFJZCwgbWVtYmVycykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShtZW1iZXJzKSlcbiAgICAgICAgcmV0dXJuO1xuICAgIGZvciAoY29uc3QgbWVtYmVyIG9mIG1lbWJlcnMpIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIG1lbWJlci5uYW1lKSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBkZXNjcmlwdG9yID0geyBlbnVtZXJhYmxlOiBtZW1iZXIuZW51bWVyYWJsZSB9O1xuICAgICAgICBpZiAobWVtYmVyLnR5cGUgPT09ICdtZXRob2QnKSB7XG4gICAgICAgICAgICBjb25zdCByZW1vdGVNZW1iZXJGdW5jdGlvbiA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAgICAgbGV0IGNvbW1hbmQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMgJiYgdGhpcy5jb25zdHJ1Y3RvciA9PT0gcmVtb3RlTWVtYmVyRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfTUVNQkVSX0NPTlNUUlVDVE9SXCIgLyogQlJPV1NFUl9NRU1CRVJfQ09OU1RSVUNUT1IgKi87XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9NRU1CRVJfQ0FMTFwiIC8qIEJST1dTRVJfTUVNQkVSX0NBTEwgKi87XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHJldCA9IGVsZWN0cm9uXzEuaXBjUmVuZGVyZXIuc2VuZFN5bmMoY29tbWFuZCwgY29udGV4dElkLCBtZXRhSWQsIG1lbWJlci5uYW1lLCB3cmFwQXJncyhhcmdzKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1ldGFUb1ZhbHVlKHJldCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbGV0IGRlc2NyaXB0b3JGdW5jdGlvbiA9IHByb3h5RnVuY3Rpb25Qcm9wZXJ0aWVzKHJlbW90ZU1lbWJlckZ1bmN0aW9uLCBtZXRhSWQsIG1lbWJlci5uYW1lKTtcbiAgICAgICAgICAgIGRlc2NyaXB0b3IuZ2V0ID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JGdW5jdGlvbi5yZWYgPSByZWY7IC8vIFRoZSBtZW1iZXIgc2hvdWxkIHJlZmVyZW5jZSBpdHMgb2JqZWN0LlxuICAgICAgICAgICAgICAgIHJldHVybiBkZXNjcmlwdG9yRnVuY3Rpb247XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8gRW5hYmxlIG1vbmtleS1wYXRjaCB0aGUgbWV0aG9kXG4gICAgICAgICAgICBkZXNjcmlwdG9yLnNldCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JGdW5jdGlvbiA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWVtYmVyLnR5cGUgPT09ICdnZXQnKSB7XG4gICAgICAgICAgICBkZXNjcmlwdG9yLmdldCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9NRU1CRVJfR0VUXCIgLyogQlJPV1NFUl9NRU1CRVJfR0VUICovO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbWV0YUlkLCBtZW1iZXIubmFtZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1ldGFUb1ZhbHVlKG1ldGEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChtZW1iZXIud3JpdGFibGUpIHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9yLnNldCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhcmdzID0gd3JhcEFyZ3MoW3ZhbHVlXSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBcIlJFTU9URV9CUk9XU0VSX01FTUJFUl9TRVRcIiAvKiBCUk9XU0VSX01FTUJFUl9TRVQgKi87XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbWV0YUlkLCBtZW1iZXIubmFtZSwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtZXRhICE9IG51bGwpXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRhVG9WYWx1ZShtZXRhKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdCwgbWVtYmVyLm5hbWUsIGRlc2NyaXB0b3IpO1xuICAgIH1cbn1cbi8vIFBvcHVsYXRlIG9iamVjdCdzIHByb3RvdHlwZSBmcm9tIGRlc2NyaXB0b3IuXG4vLyBUaGlzIG1hdGNoZXMgfGdldE9iamVjdFByb3RvdHlwZXwgaW4gcnBjLXNlcnZlci5cbmZ1bmN0aW9uIHNldE9iamVjdFByb3RvdHlwZShyZWYsIG9iamVjdCwgbWV0YUlkLCBkZXNjcmlwdG9yKSB7XG4gICAgaWYgKGRlc2NyaXB0b3IgPT09IG51bGwpXG4gICAgICAgIHJldHVybjtcbiAgICBjb25zdCBwcm90byA9IHt9O1xuICAgIHNldE9iamVjdE1lbWJlcnMocmVmLCBwcm90bywgbWV0YUlkLCBkZXNjcmlwdG9yLm1lbWJlcnMpO1xuICAgIHNldE9iamVjdFByb3RvdHlwZShyZWYsIHByb3RvLCBtZXRhSWQsIGRlc2NyaXB0b3IucHJvdG8pO1xuICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZihvYmplY3QsIHByb3RvKTtcbn1cbi8vIFdyYXAgZnVuY3Rpb24gaW4gUHJveHkgZm9yIGFjY2Vzc2luZyByZW1vdGUgcHJvcGVydGllc1xuZnVuY3Rpb24gcHJveHlGdW5jdGlvblByb3BlcnRpZXMocmVtb3RlTWVtYmVyRnVuY3Rpb24sIG1ldGFJZCwgbmFtZSkge1xuICAgIGxldCBsb2FkZWQgPSBmYWxzZTtcbiAgICAvLyBMYXppbHkgbG9hZCBmdW5jdGlvbiBwcm9wZXJ0aWVzXG4gICAgY29uc3QgbG9hZFJlbW90ZVByb3BlcnRpZXMgPSAoKSA9PiB7XG4gICAgICAgIGlmIChsb2FkZWQpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGxvYWRlZCA9IHRydWU7XG4gICAgICAgIGNvbnN0IGNvbW1hbmQgPSBcIlJFTU9URV9CUk9XU0VSX01FTUJFUl9HRVRcIiAvKiBCUk9XU0VSX01FTUJFUl9HRVQgKi87XG4gICAgICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbWV0YUlkLCBuYW1lKTtcbiAgICAgICAgc2V0T2JqZWN0TWVtYmVycyhyZW1vdGVNZW1iZXJGdW5jdGlvbiwgcmVtb3RlTWVtYmVyRnVuY3Rpb24sIG1ldGEuaWQsIG1ldGEubWVtYmVycyk7XG4gICAgfTtcbiAgICByZXR1cm4gbmV3IFByb3h5KHJlbW90ZU1lbWJlckZ1bmN0aW9uLCB7XG4gICAgICAgIHNldDogKHRhcmdldCwgcHJvcGVydHksIHZhbHVlKSA9PiB7XG4gICAgICAgICAgICBpZiAocHJvcGVydHkgIT09ICdyZWYnKVxuICAgICAgICAgICAgICAgIGxvYWRSZW1vdGVQcm9wZXJ0aWVzKCk7XG4gICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSkgPT4ge1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSBJU19SRU1PVEVfUFJPWFkpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0YXJnZXQsIHByb3BlcnR5KSlcbiAgICAgICAgICAgICAgICBsb2FkUmVtb3RlUHJvcGVydGllcygpO1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB0YXJnZXRbcHJvcGVydHldO1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSAndG9TdHJpbmcnICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5iaW5kKHRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIG93bktleXM6ICh0YXJnZXQpID0+IHtcbiAgICAgICAgICAgIGxvYWRSZW1vdGVQcm9wZXJ0aWVzKCk7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGFyZ2V0KTtcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yOiAodGFyZ2V0LCBwcm9wZXJ0eSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBwcm9wZXJ0eSk7XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvcilcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgIGxvYWRSZW1vdGVQcm9wZXJ0aWVzKCk7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIHByb3BlcnR5KTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuLy8gQ29udmVydCBtZXRhIGRhdGEgZnJvbSBicm93c2VyIGludG8gcmVhbCB2YWx1ZS5cbmZ1bmN0aW9uIG1ldGFUb1ZhbHVlKG1ldGEpIHtcbiAgICBpZiAoIW1ldGEpXG4gICAgICAgIHJldHVybiB7fTtcbiAgICBpZiAobWV0YS50eXBlID09PSAndmFsdWUnKSB7XG4gICAgICAgIHJldHVybiBtZXRhLnZhbHVlO1xuICAgIH1cbiAgICBlbHNlIGlmIChtZXRhLnR5cGUgPT09ICdhcnJheScpIHtcbiAgICAgICAgcmV0dXJuIG1ldGEubWVtYmVycy5tYXAoKG1lbWJlcikgPT4gbWV0YVRvVmFsdWUobWVtYmVyKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKG1ldGEudHlwZSA9PT0gJ25hdGl2ZWltYWdlJykge1xuICAgICAgICByZXR1cm4gdHlwZV91dGlsc18xLmRlc2VyaWFsaXplKG1ldGEudmFsdWUpO1xuICAgIH1cbiAgICBlbHNlIGlmIChtZXRhLnR5cGUgPT09ICdidWZmZXInKSB7XG4gICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShtZXRhLnZhbHVlLmJ1ZmZlciwgbWV0YS52YWx1ZS5ieXRlT2Zmc2V0LCBtZXRhLnZhbHVlLmJ5dGVMZW5ndGgpO1xuICAgIH1cbiAgICBlbHNlIGlmIChtZXRhLnR5cGUgPT09ICdwcm9taXNlJykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHsgdGhlbjogbWV0YVRvVmFsdWUobWV0YS50aGVuKSB9KTtcbiAgICB9XG4gICAgZWxzZSBpZiAobWV0YS50eXBlID09PSAnZXJyb3InKSB7XG4gICAgICAgIHJldHVybiBtZXRhVG9FcnJvcihtZXRhKTtcbiAgICB9XG4gICAgZWxzZSBpZiAobWV0YS50eXBlID09PSAnZXhjZXB0aW9uJykge1xuICAgICAgICBpZiAobWV0YS52YWx1ZS50eXBlID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgICB0aHJvdyBtZXRhVG9FcnJvcihtZXRhLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCB2YWx1ZSB0eXBlIGluIGV4Y2VwdGlvbjogJHttZXRhLnZhbHVlLnR5cGV9YCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGxldCByZXQ7XG4gICAgICAgIGlmICgnaWQnIGluIG1ldGEpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlZCA9IGdldENhY2hlZFJlbW90ZU9iamVjdChtZXRhLmlkKTtcbiAgICAgICAgICAgIGlmIChjYWNoZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWNoZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gQSBzaGFkb3cgY2xhc3MgdG8gcmVwcmVzZW50IHRoZSByZW1vdGUgZnVuY3Rpb24gb2JqZWN0LlxuICAgICAgICBpZiAobWV0YS50eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjb25zdCByZW1vdGVGdW5jdGlvbiA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAgICAgbGV0IGNvbW1hbmQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMgJiYgdGhpcy5jb25zdHJ1Y3RvciA9PT0gcmVtb3RlRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfQ09OU1RSVUNUT1JcIiAvKiBCUk9XU0VSX0NPTlNUUlVDVE9SICovO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfRlVOQ1RJT05fQ0FMTFwiIC8qIEJST1dTRVJfRlVOQ1RJT05fQ0FMTCAqLztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqID0gZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5zZW5kU3luYyhjb21tYW5kLCBjb250ZXh0SWQsIG1ldGEuaWQsIHdyYXBBcmdzKGFyZ3MpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWV0YVRvVmFsdWUob2JqKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXQgPSByZW1vdGVGdW5jdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldCA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHNldE9iamVjdE1lbWJlcnMocmV0LCByZXQsIG1ldGEuaWQsIG1ldGEubWVtYmVycyk7XG4gICAgICAgIHNldE9iamVjdFByb3RvdHlwZShyZXQsIHJldCwgbWV0YS5pZCwgbWV0YS5wcm90byk7XG4gICAgICAgIGlmIChyZXQuY29uc3RydWN0b3IgJiYgcmV0LmNvbnN0cnVjdG9yW0lTX1JFTU9URV9QUk9YWV0pIHtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXQuY29uc3RydWN0b3IsICduYW1lJywgeyB2YWx1ZTogbWV0YS5uYW1lIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRyYWNrIGRlbGVnYXRlIG9iaidzIGxpZmV0aW1lICYgdGVsbCBicm93c2VyIHRvIGNsZWFuIHVwIHdoZW4gb2JqZWN0IGlzIEdDZWQuXG4gICAgICAgIGVsZWN0cm9uSWRzLnNldChyZXQsIG1ldGEuaWQpO1xuICAgICAgICBzZXRDYWNoZWRSZW1vdGVPYmplY3QobWV0YS5pZCwgcmV0KTtcbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG59XG5mdW5jdGlvbiBtZXRhVG9FcnJvcihtZXRhKSB7XG4gICAgY29uc3Qgb2JqID0gbWV0YS52YWx1ZTtcbiAgICBmb3IgKGNvbnN0IHsgbmFtZSwgdmFsdWUgfSBvZiBtZXRhLm1lbWJlcnMpIHtcbiAgICAgICAgb2JqW25hbWVdID0gbWV0YVRvVmFsdWUodmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xufVxuZnVuY3Rpb24gaGFzU2VuZGVySWQoaW5wdXQpIHtcbiAgICByZXR1cm4gdHlwZW9mIGlucHV0LnNlbmRlcklkID09PSBcIm51bWJlclwiO1xufVxuZnVuY3Rpb24gaGFuZGxlTWVzc2FnZShjaGFubmVsLCBoYW5kbGVyKSB7XG4gICAgZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5vbihjaGFubmVsLCAoZXZlbnQsIHBhc3NlZENvbnRleHRJZCwgaWQsIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgaWYgKGhhc1NlbmRlcklkKGV2ZW50KSkge1xuICAgICAgICAgICAgaWYgKGV2ZW50LnNlbmRlcklkICE9PSAwICYmIGV2ZW50LnNlbmRlcklkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBNZXNzYWdlICR7Y2hhbm5lbH0gc2VudCBieSB1bmV4cGVjdGVkIFdlYkNvbnRlbnRzICgke2V2ZW50LnNlbmRlcklkfSlgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhc3NlZENvbnRleHRJZCA9PT0gY29udGV4dElkKSB7XG4gICAgICAgICAgICBoYW5kbGVyKGlkLCAuLi5hcmdzKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIE1lc3NhZ2Ugc2VudCB0byBhbiB1bi1leGlzdCBjb250ZXh0LCBub3RpZnkgdGhlIGVycm9yIHRvIG1haW4gcHJvY2Vzcy5cbiAgICAgICAgICAgIGVsZWN0cm9uXzEuaXBjUmVuZGVyZXIuc2VuZChcIlJFTU9URV9CUk9XU0VSX1dST05HX0NPTlRFWFRfRVJST1JcIiAvKiBCUk9XU0VSX1dST05HX0NPTlRFWFRfRVJST1IgKi8sIGNvbnRleHRJZCwgcGFzc2VkQ29udGV4dElkLCBpZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cbmNvbnN0IGVuYWJsZVN0YWNrcyA9IHByb2Nlc3MuYXJndi5pbmNsdWRlcygnLS1lbmFibGUtYXBpLWZpbHRlcmluZy1sb2dnaW5nJyk7XG5mdW5jdGlvbiBnZXRDdXJyZW50U3RhY2soKSB7XG4gICAgY29uc3QgdGFyZ2V0ID0geyBzdGFjazogdW5kZWZpbmVkIH07XG4gICAgaWYgKGVuYWJsZVN0YWNrcykge1xuICAgICAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0YXJnZXQsIGdldEN1cnJlbnRTdGFjayk7XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQuc3RhY2s7XG59XG4vLyBCcm93c2VyIGNhbGxzIGEgY2FsbGJhY2sgaW4gcmVuZGVyZXIuXG5oYW5kbGVNZXNzYWdlKFwiUkVNT1RFX1JFTkRFUkVSX0NBTExCQUNLXCIgLyogUkVOREVSRVJfQ0FMTEJBQ0sgKi8sIChpZCwgYXJncykgPT4ge1xuICAgIGNhbGxiYWNrc1JlZ2lzdHJ5LmFwcGx5KGlkLCBtZXRhVG9WYWx1ZShhcmdzKSk7XG59KTtcbi8vIEEgY2FsbGJhY2sgaW4gYnJvd3NlciBpcyByZWxlYXNlZC5cbmhhbmRsZU1lc3NhZ2UoXCJSRU1PVEVfUkVOREVSRVJfUkVMRUFTRV9DQUxMQkFDS1wiIC8qIFJFTkRFUkVSX1JFTEVBU0VfQ0FMTEJBQ0sgKi8sIChpZCkgPT4ge1xuICAgIGNhbGxiYWNrc1JlZ2lzdHJ5LnJlbW92ZShpZCk7XG59KTtcbmV4cG9ydHMucmVxdWlyZSA9IChtb2R1bGUpID0+IHtcbiAgICBjb25zdCBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9SRVFVSVJFXCIgLyogQlJPV1NFUl9SRVFVSVJFICovO1xuICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbW9kdWxlLCBnZXRDdXJyZW50U3RhY2soKSk7XG4gICAgcmV0dXJuIG1ldGFUb1ZhbHVlKG1ldGEpO1xufTtcbi8vIEFsaWFzIHRvIHJlbW90ZS5yZXF1aXJlKCdlbGVjdHJvbicpLnh4eC5cbmZ1bmN0aW9uIGdldEJ1aWx0aW4obW9kdWxlKSB7XG4gICAgY29uc3QgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfR0VUX0JVSUxUSU5cIiAvKiBCUk9XU0VSX0dFVF9CVUlMVElOICovO1xuICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbW9kdWxlLCBnZXRDdXJyZW50U3RhY2soKSk7XG4gICAgcmV0dXJuIG1ldGFUb1ZhbHVlKG1ldGEpO1xufVxuZXhwb3J0cy5nZXRCdWlsdGluID0gZ2V0QnVpbHRpbjtcbmZ1bmN0aW9uIGdldEN1cnJlbnRXaW5kb3coKSB7XG4gICAgY29uc3QgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfR0VUX0NVUlJFTlRfV0lORE9XXCIgLyogQlJPV1NFUl9HRVRfQ1VSUkVOVF9XSU5ET1cgKi87XG4gICAgY29uc3QgbWV0YSA9IGVsZWN0cm9uXzEuaXBjUmVuZGVyZXIuc2VuZFN5bmMoY29tbWFuZCwgY29udGV4dElkLCBnZXRDdXJyZW50U3RhY2soKSk7XG4gICAgcmV0dXJuIG1ldGFUb1ZhbHVlKG1ldGEpO1xufVxuZXhwb3J0cy5nZXRDdXJyZW50V2luZG93ID0gZ2V0Q3VycmVudFdpbmRvdztcbi8vIEdldCBjdXJyZW50IFdlYkNvbnRlbnRzIG9iamVjdC5cbmZ1bmN0aW9uIGdldEN1cnJlbnRXZWJDb250ZW50cygpIHtcbiAgICBjb25zdCBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9HRVRfQ1VSUkVOVF9XRUJfQ09OVEVOVFNcIiAvKiBCUk9XU0VSX0dFVF9DVVJSRU5UX1dFQl9DT05URU5UUyAqLztcbiAgICBjb25zdCBtZXRhID0gZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5zZW5kU3luYyhjb21tYW5kLCBjb250ZXh0SWQsIGdldEN1cnJlbnRTdGFjaygpKTtcbiAgICByZXR1cm4gbWV0YVRvVmFsdWUobWV0YSk7XG59XG5leHBvcnRzLmdldEN1cnJlbnRXZWJDb250ZW50cyA9IGdldEN1cnJlbnRXZWJDb250ZW50cztcbi8vIEdldCBhIGdsb2JhbCBvYmplY3QgaW4gYnJvd3Nlci5cbmZ1bmN0aW9uIGdldEdsb2JhbChuYW1lKSB7XG4gICAgY29uc3QgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfR0VUX0dMT0JBTFwiIC8qIEJST1dTRVJfR0VUX0dMT0JBTCAqLztcbiAgICBjb25zdCBtZXRhID0gZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5zZW5kU3luYyhjb21tYW5kLCBjb250ZXh0SWQsIG5hbWUsIGdldEN1cnJlbnRTdGFjaygpKTtcbiAgICByZXR1cm4gbWV0YVRvVmFsdWUobWV0YSk7XG59XG5leHBvcnRzLmdldEdsb2JhbCA9IGdldEdsb2JhbDtcbi8vIEdldCB0aGUgcHJvY2VzcyBvYmplY3QgaW4gYnJvd3Nlci5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAncHJvY2VzcycsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGdldDogKCkgPT4gZXhwb3J0cy5nZXRHbG9iYWwoJ3Byb2Nlc3MnKVxufSk7XG4vLyBDcmVhdGUgYSBmdW5jdGlvbiB0aGF0IHdpbGwgcmV0dXJuIHRoZSBzcGVjaWZpZWQgdmFsdWUgd2hlbiBjYWxsZWQgaW4gYnJvd3Nlci5cbmZ1bmN0aW9uIGNyZWF0ZUZ1bmN0aW9uV2l0aFJldHVyblZhbHVlKHJldHVyblZhbHVlKSB7XG4gICAgY29uc3QgZnVuYyA9ICgpID0+IHJldHVyblZhbHVlO1xuICAgIGlzUmV0dXJuVmFsdWUuYWRkKGZ1bmMpO1xuICAgIHJldHVybiBmdW5jO1xufVxuZXhwb3J0cy5jcmVhdGVGdW5jdGlvbldpdGhSZXR1cm5WYWx1ZSA9IGNyZWF0ZUZ1bmN0aW9uV2l0aFJldHVyblZhbHVlO1xuY29uc3QgYWRkQnVpbHRpblByb3BlcnR5ID0gKG5hbWUpID0+IHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgbmFtZSwge1xuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBnZXQ6ICgpID0+IGV4cG9ydHMuZ2V0QnVpbHRpbihuYW1lKVxuICAgIH0pO1xufTtcbm1vZHVsZV9uYW1lc18xLmJyb3dzZXJNb2R1bGVOYW1lc1xuICAgIC5mb3JFYWNoKGFkZEJ1aWx0aW5Qcm9wZXJ0eSk7XG4iLCAiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgX19jcmVhdGVCaW5kaW5nID0gKHRoaXMgJiYgdGhpcy5fX2NyZWF0ZUJpbmRpbmcpIHx8IChPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfSk7XG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XG4gICAgb1trMl0gPSBtW2tdO1xufSkpO1xudmFyIF9fZXhwb3J0U3RhciA9ICh0aGlzICYmIHRoaXMuX19leHBvcnRTdGFyKSB8fCBmdW5jdGlvbihtLCBleHBvcnRzKSB7XG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChleHBvcnRzLCBwKSkgX19jcmVhdGVCaW5kaW5nKGV4cG9ydHMsIG0sIHApO1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmlmIChwcm9jZXNzLnR5cGUgPT09ICdicm93c2VyJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFwiQGVsZWN0cm9uL3JlbW90ZVwiIGNhbm5vdCBiZSByZXF1aXJlZCBpbiB0aGUgYnJvd3NlciBwcm9jZXNzLiBJbnN0ZWFkIHJlcXVpcmUoXCJAZWxlY3Ryb24vcmVtb3RlL21haW5cIikuYCk7XG5fX2V4cG9ydFN0YXIocmVxdWlyZShcIi4vcmVtb3RlXCIpLCBleHBvcnRzKTtcbiIsICJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4uL2Rpc3Qvc3JjL3JlbmRlcmVyJylcbiIsICJpbXBvcnQgeyBNYXJrZG93blZpZXcsIE5vdGljZSwgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCBUQWJzdHJhY3RGaWxlLCBURmlsZSwgV29ya3NwYWNlTGVhZiwgc2V0SWNvbiwgc2V0VG9vbHRpcCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgQnJvd3NlcldpbmRvdywgZ2xvYmFsU2hvcnRjdXQsIHNjcmVlbiB9IGZyb20gXCJAZWxlY3Ryb24vcmVtb3RlXCI7XG5cbmNvbnN0IERFRkFVTFRfQ09MT1IgPSBcIiNmZmYzYTNcIjtcbmNvbnN0IERFRkFVTFRfV0lEVEggPSAzNjA7XG5jb25zdCBERUZBVUxUX0hFSUdIVCA9IDM2MDtcbmNvbnN0IFdJTkRPV19OQU1FX1BSRUZJWCA9IFwiZGVza3RvcC1zdGlja3ktbm90ZXM6XCI7XG5cbmludGVyZmFjZSBTdGlja3lOb3RlU2V0dGluZ3Mge1xuICBkZWZhdWx0Rm9sZGVyOiBzdHJpbmc7XG4gIGRlZmF1bHROb3RlQ29sb3I6IHN0cmluZztcbiAgZ2xvYmFsVG9nZ2xlU2hvcnRjdXQ6IHN0cmluZztcbiAgdG9wTGV2ZWxOb3RlUGF0aDogc3RyaW5nIHwgbnVsbDtcbiAgdG9wTGV2ZWxXaW5kb3dQb3NpdGlvbjogV2luZG93UG9zaXRpb24gfCBudWxsO1xuICBjb2xvcnNCeVBhdGg6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmludGVyZmFjZSBXaW5kb3dQb3NpdGlvbiB7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xufVxuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBTdGlja3lOb3RlU2V0dGluZ3MgPSB7XG4gIGRlZmF1bHRGb2xkZXI6IFwiXCIsXG4gIGRlZmF1bHROb3RlQ29sb3I6IERFRkFVTFRfQ09MT1IsXG4gIGdsb2JhbFRvZ2dsZVNob3J0Y3V0OiBcIkNvbW1hbmRPckNvbnRyb2wrQWx0K05cIixcbiAgdG9wTGV2ZWxOb3RlUGF0aDogbnVsbCxcbiAgdG9wTGV2ZWxXaW5kb3dQb3NpdGlvbjogbnVsbCxcbiAgY29sb3JzQnlQYXRoOiB7fVxufTtcblxuaW50ZXJmYWNlIFN0aWNreU5vdGVXaW5kb3cge1xuICBmaWxlOiBURmlsZTtcbiAgbGVhZjogV29ya3NwYWNlTGVhZjtcbiAgZG9jdW1lbnQ6IERvY3VtZW50O1xuICB3aW5kb3c6IE5hdGl2ZUJyb3dzZXJXaW5kb3c7XG4gIG9ic2VydmVyPzogTXV0YXRpb25PYnNlcnZlcjtcbn1cblxuaW50ZXJmYWNlIE5hdGl2ZUJyb3dzZXJXaW5kb3cge1xuICBzZXRSZXNpemFibGUocmVzaXphYmxlOiBib29sZWFuKTogdm9pZDtcbiAgc2V0QWx3YXlzT25Ub3AoYWx3YXlzT25Ub3A6IGJvb2xlYW4pOiB2b2lkO1xuICBpc0Fsd2F5c09uVG9wKCk6IGJvb2xlYW47XG4gIHNldFRpdGxlKHRpdGxlOiBzdHJpbmcpOiB2b2lkO1xuICBnZXRUaXRsZSgpOiBzdHJpbmc7XG4gIGlzRGVzdHJveWVkKCk6IGJvb2xlYW47XG4gIGlzRm9jdXNlZCgpOiBib29sZWFuO1xuICBpc1Zpc2libGUoKTogYm9vbGVhbjtcbiAgaXNNaW5pbWl6ZWQoKTogYm9vbGVhbjtcbiAgc2hvdygpOiB2b2lkO1xuICByZXN0b3JlKCk6IHZvaWQ7XG4gIGZvY3VzKCk6IHZvaWQ7XG4gIG1vdmVUb3AoKTogdm9pZDtcbiAgc2V0UGFyZW50V2luZG93KHBhcmVudDogTmF0aXZlQnJvd3NlcldpbmRvdyB8IG51bGwpOiB2b2lkO1xuICBzZXRTa2lwVGFza2Jhcihza2lwOiBib29sZWFuKTogdm9pZDtcbiAgY2xvc2UoKTogdm9pZDtcbiAgZGVzdHJveSgpOiB2b2lkO1xuICBnZXRQb3NpdGlvbigpOiBbbnVtYmVyLCBudW1iZXJdO1xuICB3ZWJDb250ZW50czoge1xuICAgIGV4ZWN1dGVKYXZhU2NyaXB0KHNvdXJjZTogc3RyaW5nKTogUHJvbWlzZTx1bmtub3duPjtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRGVza3RvcFN0aWNreU5vdGVzUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IFN0aWNreU5vdGVTZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XG4gIHByaXZhdGUgbm90ZXNCeVBhdGggPSBuZXcgTWFwPHN0cmluZywgU2V0PFN0aWNreU5vdGVXaW5kb3c+PigpO1xuICBwcml2YXRlIGluaXRpYWxpemVkTGVhdmVzID0gbmV3IFdlYWtTZXQ8V29ya3NwYWNlTGVhZj4oKTtcbiAgcHJpdmF0ZSByZWdpc3RlcmVkR2xvYmFsU2hvcnRjdXQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHNob3J0Y3V0UmVnaXN0cmF0aW9uVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHRvZ2dsZUluUHJvZ3Jlc3MgPSBmYWxzZTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICBhd2FpdCB0aGlzLmNsb3NlU3RhbGVTdGlja3lXaW5kb3dzKCk7XG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBEZXNrdG9wU3RpY2t5Tm90ZXNTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gICAgdGhpcy5yZWdpc3RlckNvbW1hbmRzKCk7XG4gICAgdGhpcy5yZWdpc3RlckZpbGVMaWZlY3ljbGUoKTtcbiAgICB0aGlzLnJlZ2lzdGVyQ29udGV4dE1lbnUoKTtcbiAgICB0aGlzLnJlZ2lzdGVyR2xvYmFsVG9nZ2xlU2hvcnRjdXQoKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsICgpID0+IHRoaXMuc2NoZWR1bGVSZWZyZXNoQWxsTm90ZXMoKSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJsYXlvdXQtY2hhbmdlXCIsICgpID0+IHRoaXMuc2NoZWR1bGVSZWZyZXNoQWxsTm90ZXMoKSkpO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2hvcnRjdXRSZWdpc3RyYXRpb25UaW1lciAhPT0gbnVsbCkgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNob3J0Y3V0UmVnaXN0cmF0aW9uVGltZXIpO1xuICAgIHRoaXMudW5yZWdpc3Rlckdsb2JhbFRvZ2dsZVNob3J0Y3V0KCk7XG4gICAgZm9yIChjb25zdCBub3RlIG9mIFsuLi50aGlzLmFsbE5vdGVzKCldKSB7XG4gICAgICB0aGlzLnJlbWVtYmVyVG9wTGV2ZWxQb3NpdGlvbihub3RlKTtcbiAgICAgIG5vdGUub2JzZXJ2ZXI/LmRpc2Nvbm5lY3QoKTtcbiAgICAgIG5vdGUubGVhZi5kZXRhY2goKTtcbiAgICAgIHRoaXMuZm9yY2VDbG9zZVdpbmRvdyhub3RlLndpbmRvdyk7XG4gICAgfVxuICAgIHRoaXMubm90ZXNCeVBhdGguY2xlYXIoKTtcbiAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5yZXF1ZXN0U2F2ZUxheW91dCgpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHN0b3JlZCA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyBQYXJ0aWFsPFN0aWNreU5vdGVTZXR0aW5ncz4gJiB7IG9wZW5Ob3RlUGF0aHM/OiB1bmtub3duIH07XG4gICAgZGVsZXRlIHN0b3JlZC5vcGVuTm90ZVBhdGhzO1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBzdG9yZWQpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cblxuICBzY2hlZHVsZUdsb2JhbFNob3J0Y3V0UmVnaXN0cmF0aW9uKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnNob3J0Y3V0UmVnaXN0cmF0aW9uVGltZXIgIT09IG51bGwpIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5zaG9ydGN1dFJlZ2lzdHJhdGlvblRpbWVyKTtcbiAgICB0aGlzLnNob3J0Y3V0UmVnaXN0cmF0aW9uVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnNob3J0Y3V0UmVnaXN0cmF0aW9uVGltZXIgPSBudWxsO1xuICAgICAgdGhpcy5yZWdpc3Rlckdsb2JhbFRvZ2dsZVNob3J0Y3V0KHRydWUpO1xuICAgIH0sIDUwMCk7XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyR2xvYmFsVG9nZ2xlU2hvcnRjdXQoc2hvd1Jlc3VsdCA9IGZhbHNlKTogdm9pZCB7XG4gICAgdGhpcy51bnJlZ2lzdGVyR2xvYmFsVG9nZ2xlU2hvcnRjdXQoKTtcbiAgICBjb25zdCBhY2NlbGVyYXRvciA9IHRoaXMuc2V0dGluZ3MuZ2xvYmFsVG9nZ2xlU2hvcnRjdXQudHJpbSgpO1xuICAgIGlmICghYWNjZWxlcmF0b3IpIHtcbiAgICAgIGlmIChzaG93UmVzdWx0KSBuZXcgTm90aWNlKFwiR2xvYmFsIHN0aWNreS1ub3RlIHNob3J0Y3V0IGRpc2FibGVkLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVjbGFpbSB0aGlzIGNvbmZpZ3VyZWQgYWNjZWxlcmF0b3IgYWZ0ZXIgYW4gT2JzaWRpYW4gcmVuZGVyZXIgcmVsb2FkLFxuICAgICAgLy8gd2hlcmUgYW4gb2xkZXIgcmVtb3RlIGNhbGxiYWNrIGNhbiBvdGhlcndpc2UgcmVtYWluIHJlZ2lzdGVyZWQuXG4gICAgICBpZiAoZ2xvYmFsU2hvcnRjdXQuaXNSZWdpc3RlcmVkKGFjY2VsZXJhdG9yKSkgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcihhY2NlbGVyYXRvcik7XG4gICAgICBjb25zdCByZWdpc3RlcmVkID0gZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoYWNjZWxlcmF0b3IsICgpID0+IHZvaWQgdGhpcy50b2dnbGVUb3BMZXZlbE5vdGUoKSk7XG4gICAgICBpZiAoIXJlZ2lzdGVyZWQpIHtcbiAgICAgICAgbmV3IE5vdGljZShgQ291bGQgbm90IHJlZ2lzdGVyIGdsb2JhbCBzaG9ydGN1dDogJHthY2NlbGVyYXRvcn1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5yZWdpc3RlcmVkR2xvYmFsU2hvcnRjdXQgPSBhY2NlbGVyYXRvcjtcbiAgICAgIGlmIChzaG93UmVzdWx0KSBuZXcgTm90aWNlKGBHbG9iYWwgc3RpY2t5LW5vdGUgc2hvcnRjdXQ6ICR7YWNjZWxlcmF0b3J9YCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBuZXcgTm90aWNlKGBJbnZhbGlkIGdsb2JhbCBzaG9ydGN1dDogJHthY2NlbGVyYXRvcn1gKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVucmVnaXN0ZXJHbG9iYWxUb2dnbGVTaG9ydGN1dCgpOiB2b2lkIHtcbiAgICBjb25zdCBhY2NlbGVyYXRvciA9IHRoaXMucmVnaXN0ZXJlZEdsb2JhbFNob3J0Y3V0O1xuICAgIGlmICghYWNjZWxlcmF0b3IpIHJldHVybjtcbiAgICBpZiAoZ2xvYmFsU2hvcnRjdXQuaXNSZWdpc3RlcmVkKGFjY2VsZXJhdG9yKSkgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcihhY2NlbGVyYXRvcik7XG4gICAgdGhpcy5yZWdpc3RlcmVkR2xvYmFsU2hvcnRjdXQgPSBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckNvbW1hbmRzKCk6IHZvaWQge1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJjcmVhdGUtc3RpY2t5LW5vdGVcIixcbiAgICAgIG5hbWU6IFwiQ3JlYXRlIHN0aWNreSBub3RlXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4gdm9pZCB0aGlzLmNyZWF0ZVN0aWNreU5vdGUoKVxuICAgIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJvcGVuLXN0aWNreS1ub3RlXCIsXG4gICAgICBuYW1lOiBcIk9wZW4gc3RpY2t5IG5vdGUgZm9yIGN1cnJlbnQgZmlsZVwiLFxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgICAgICBpZiAoIWZpbGUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKCFjaGVja2luZykgdm9pZCB0aGlzLm9wZW5TdGlja3lOb3RlKGZpbGUpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiaGlkZS1zdGlja3ktbm90ZVwiLFxuICAgICAgbmFtZTogXCJIaWRlIHN0aWNreSBub3RlIGZvciBjdXJyZW50IGZpbGVcIixcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZykgPT4ge1xuICAgICAgICBjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgICAgaWYgKCFhY3RpdmVGaWxlIHx8ICF0aGlzLnN0aWNreUxlYXZlc0ZvclBhdGgoYWN0aXZlRmlsZS5wYXRoKS5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKCFjaGVja2luZyAmJiBhY3RpdmVGaWxlKSB0aGlzLmNsb3NlTm90ZXNGb3JQYXRoKGFjdGl2ZUZpbGUucGF0aCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJzZXQtdG9wLWxldmVsLXN0aWNreS1ub3RlXCIsXG4gICAgICBuYW1lOiBcIlNldCBjdXJyZW50IGZpbGUgYXMgdG9wLWxldmVsIHN0aWNreSBub3RlXCIsXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmcpID0+IHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgIGlmICghZmlsZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoIWNoZWNraW5nKSB2b2lkIHRoaXMuc2V0VG9wTGV2ZWxOb3RlKGZpbGUucGF0aCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJ0b2dnbGUtdG9wLWxldmVsLXN0aWNreS1ub3RlXCIsXG4gICAgICBuYW1lOiBcIlRvZ2dsZSB0b3AtbGV2ZWwgc3RpY2t5IG5vdGVcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB2b2lkIHRoaXMudG9nZ2xlVG9wTGV2ZWxOb3RlKClcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJDb250ZXh0TWVudSgpOiB2b2lkIHtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1tZW51XCIsIChtZW51LCBmaWxlKSA9PiB7XG4gICAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSByZXR1cm47XG4gICAgICBtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IGl0ZW1cbiAgICAgICAgLnNldFRpdGxlKFwiT3BlbiBhcyBzdGlja3kgbm90ZVwiKVxuICAgICAgICAuc2V0SWNvbihcInN0aWNreS1ub3RlXCIpXG4gICAgICAgIC5vbkNsaWNrKCgpID0+IHZvaWQgdGhpcy5vcGVuU3RpY2t5Tm90ZShmaWxlKSkpO1xuICAgICAgbWVudS5hZGRJdGVtKChpdGVtKSA9PiBpdGVtXG4gICAgICAgIC5zZXRUaXRsZShcIlNldCBhcyB0b3AtbGV2ZWwgc3RpY2t5IG5vdGVcIilcbiAgICAgICAgLnNldEljb24oXCJzdGFyXCIpXG4gICAgICAgIC5vbkNsaWNrKCgpID0+IHZvaWQgdGhpcy5zZXRUb3BMZXZlbE5vdGUoZmlsZS5wYXRoKSkpO1xuICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJGaWxlTGlmZWN5Y2xlKCk6IHZvaWQge1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbihcImRlbGV0ZVwiLCAoZmlsZTogVEFic3RyYWN0RmlsZSkgPT4ge1xuICAgICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgICAgdGhpcy5jbG9zZU5vdGVzRm9yUGF0aChmaWxlLnBhdGgpO1xuICAgICAgaWYgKHRoaXMuc2V0dGluZ3MudG9wTGV2ZWxOb3RlUGF0aCA9PT0gZmlsZS5wYXRoKSB7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MudG9wTGV2ZWxOb3RlUGF0aCA9IG51bGw7XG4gICAgICAgIHZvaWQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLnNldHRpbmdzLmNvbG9yc0J5UGF0aFtmaWxlLnBhdGhdO1xuICAgICAgdm9pZCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIH0pKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbihcInJlbmFtZVwiLCAoZmlsZTogVEFic3RyYWN0RmlsZSwgb2xkUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSByZXR1cm47XG4gICAgICBjb25zdCBub3RlcyA9IHRoaXMubm90ZXNCeVBhdGguZ2V0KG9sZFBhdGgpO1xuICAgICAgaWYgKG5vdGVzKSB7XG4gICAgICAgIHRoaXMubm90ZXNCeVBhdGguZGVsZXRlKG9sZFBhdGgpO1xuICAgICAgICB0aGlzLm5vdGVzQnlQYXRoLnNldChmaWxlLnBhdGgsIG5vdGVzKTtcbiAgICAgICAgZm9yIChjb25zdCBub3RlIG9mIG5vdGVzKSBub3RlLmZpbGUgPSBmaWxlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuc2V0dGluZ3MudG9wTGV2ZWxOb3RlUGF0aCA9PT0gb2xkUGF0aCkgdGhpcy5zZXR0aW5ncy50b3BMZXZlbE5vdGVQYXRoID0gZmlsZS5wYXRoO1xuICAgICAgY29uc3QgY29sb3IgPSB0aGlzLnNldHRpbmdzLmNvbG9yc0J5UGF0aFtvbGRQYXRoXTtcbiAgICAgIGlmIChjb2xvcikge1xuICAgICAgICBkZWxldGUgdGhpcy5zZXR0aW5ncy5jb2xvcnNCeVBhdGhbb2xkUGF0aF07XG4gICAgICAgIHRoaXMuc2V0dGluZ3MuY29sb3JzQnlQYXRoW2ZpbGUucGF0aF0gPSBjb2xvcjtcbiAgICAgIH1cbiAgICAgIHZvaWQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICB9KSk7XG4gIH1cblxuICBhc3luYyBjcmVhdGVTdGlja3lOb3RlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGZvbGRlciA9IHRoaXMubm9ybWFsaXplRm9sZGVyKHRoaXMuc2V0dGluZ3MuZGVmYXVsdEZvbGRlcik7XG4gICAgaWYgKGZvbGRlciAmJiAhdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcikpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZUZvbGRlcihmb2xkZXIpO1xuICAgIH1cbiAgICBjb25zdCBwcmVmaXggPSBmb2xkZXIgPyBgJHtmb2xkZXJ9L2AgOiBcIlwiO1xuICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUoYCR7cHJlZml4fSR7dGhpcy51bmlxdWVOb3RlTmFtZSgpfS5tZGAsIFwiXCIpO1xuICAgIGF3YWl0IHRoaXMub3BlblN0aWNreU5vdGUoZmlsZSk7XG4gIH1cblxuICBhc3luYyB0b2dnbGVUb3BMZXZlbE5vdGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMudG9nZ2xlSW5Qcm9ncmVzcykgcmV0dXJuO1xuICAgIHRoaXMudG9nZ2xlSW5Qcm9ncmVzcyA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucGVyZm9ybVRvcExldmVsVG9nZ2xlKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMudG9nZ2xlSW5Qcm9ncmVzcyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcGVyZm9ybVRvcExldmVsVG9nZ2xlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHBhdGggPSB0aGlzLnNldHRpbmdzLnRvcExldmVsTm90ZVBhdGg7XG4gICAgaWYgKCFwYXRoKSByZXR1cm47XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICB0aGlzLnNldHRpbmdzLnRvcExldmVsTm90ZVBhdGggPSBudWxsO1xuICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbmF0aXZlV2luZG93cyA9IGF3YWl0IHRoaXMubmF0aXZlTm90ZVdpbmRvd3NGb3JQYXRoKHBhdGgpO1xuICAgIGNvbnN0IHRyYWNrZWRXaW5kb3dzID0gWy4uLih0aGlzLm5vdGVzQnlQYXRoLmdldChwYXRoKSA/PyBbXSldXG4gICAgICAubWFwKChub3RlKSA9PiBub3RlLndpbmRvdylcbiAgICAgIC5maWx0ZXIoKHdpbmRvdykgPT4gIXdpbmRvdy5pc0Rlc3Ryb3llZCgpKTtcbiAgICBjb25zdCBrbm93bldpbmRvd3MgPSBbLi4ubmV3IFNldChbLi4ubmF0aXZlV2luZG93cywgLi4udHJhY2tlZFdpbmRvd3NdKV07XG5cbiAgICBpZiAoa25vd25XaW5kb3dzLnNvbWUoKHdpbmRvdykgPT4gd2luZG93LmlzRm9jdXNlZCgpKSkge1xuICAgICAgLy8gRG8gbm90IGRldGFjaCB0aGUgV29ya3NwYWNlTGVhZiBoZXJlLiBPYnNpZGlhbiByZXNwb25kcyB0byBhbiBleHBsaWNpdFxuICAgICAgLy8gZGV0YWNoIGJ5IGFjdGl2YXRpbmcgaXRzIG1haW4gd29ya3NwYWNlIHdpbmRvdy4gQ2xvc2luZyB0aGUgaW5kZXBlbmRlbnRcbiAgICAgIC8vIG5hdGl2ZSBwb3BvdXQgbGV0cyBpdHMgbm9ybWFsIHVubG9hZCBsaWZlY3ljbGUgcmVtb3ZlIHRoZSBsZWFmIHdpdGhvdXRcbiAgICAgIC8vIGFza2luZyBPYnNpZGlhbiB0byBmb2N1cyBhIHJlcGxhY2VtZW50IGZpcnN0LlxuICAgICAgZm9yIChjb25zdCBub3RlIG9mIFsuLi4odGhpcy5ub3Rlc0J5UGF0aC5nZXQocGF0aCkgPz8gW10pXSkge1xuICAgICAgICB0aGlzLnJlbWVtYmVyVG9wTGV2ZWxQb3NpdGlvbihub3RlKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgbmF0aXZlV2luZG93IG9mIGtub3duV2luZG93cykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGlmICghbmF0aXZlV2luZG93LmlzRGVzdHJveWVkKCkpIG5hdGl2ZVdpbmRvdy5zZXRQYXJlbnRXaW5kb3cobnVsbCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8vIFRoZSBwb3BvdXQgY2FuIGRpc2FwcGVhciB3aGlsZSB0aGUgY29tbWFuZCBpcyBjb2xsZWN0aW5nIHdpbmRvd3MuXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mb3JjZUNsb3NlV2luZG93KG5hdGl2ZVdpbmRvdyk7XG4gICAgICB9XG4gICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5yZXF1ZXN0U2F2ZUxheW91dCgpLCAxMDApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChrbm93bldpbmRvd3MubGVuZ3RoKSB7XG4gICAgICB0aGlzLmJyaW5nV2luZG93VG9Gcm9udChrbm93bldpbmRvd3NbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMub3BlblN0aWNreU5vdGUoZmlsZSk7XG4gIH1cblxuICBwcml2YXRlIGJyaW5nV2luZG93VG9Gcm9udChuYXRpdmVXaW5kb3c6IE5hdGl2ZUJyb3dzZXJXaW5kb3cpOiB2b2lkIHtcbiAgICBpZiAobmF0aXZlV2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcbiAgICBpZiAobmF0aXZlV2luZG93LmlzTWluaW1pemVkKCkpIG5hdGl2ZVdpbmRvdy5yZXN0b3JlKCk7XG4gICAgaWYgKCFuYXRpdmVXaW5kb3cuaXNWaXNpYmxlKCkpIG5hdGl2ZVdpbmRvdy5zaG93KCk7XG4gICAgbmF0aXZlV2luZG93Lm1vdmVUb3AoKTtcbiAgICBuYXRpdmVXaW5kb3cuZm9jdXMoKTtcbiAgfVxuXG4gIGFzeW5jIHNldFRvcExldmVsTm90ZShwYXRoOiBzdHJpbmcgfCBudWxsKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zZXR0aW5ncy50b3BMZXZlbE5vdGVQYXRoID0gcGF0aDtcbiAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIHRoaXMuc2NoZWR1bGVSZWZyZXNoQWxsTm90ZXMoKTtcbiAgICBuZXcgTm90aWNlKHBhdGggPyBgVG9wLWxldmVsIHN0aWNreSBub3RlOiAke3BhdGh9YCA6IFwiVG9wLWxldmVsIHN0aWNreSBub3RlIGNsZWFyZWQuXCIpO1xuICB9XG5cbiAgYXN5bmMgb3BlblN0aWNreU5vdGUoZmlsZTogVEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBzYXZlZFBvc2l0aW9uID0gZmlsZS5wYXRoID09PSB0aGlzLnNldHRpbmdzLnRvcExldmVsTm90ZVBhdGhcbiAgICAgID8gdGhpcy5zZXR0aW5ncy50b3BMZXZlbFdpbmRvd1Bvc2l0aW9uXG4gICAgICA6IG51bGw7XG4gICAgY29uc3QgaW5pdGlhbFBvc2l0aW9uID0gc2F2ZWRQb3NpdGlvbiAmJiB0aGlzLnBvc2l0aW9uSXNWaXNpYmxlKHNhdmVkUG9zaXRpb24pXG4gICAgICA/IHNhdmVkUG9zaXRpb25cbiAgICAgIDogbnVsbDtcbiAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLm9wZW5Qb3BvdXRMZWFmKHtcbiAgICAgIHNpemU6IHsgd2lkdGg6IERFRkFVTFRfV0lEVEgsIGhlaWdodDogREVGQVVMVF9IRUlHSFQgfSxcbiAgICAgIC4uLihpbml0aWFsUG9zaXRpb24gPyB7IHg6IGluaXRpYWxQb3NpdGlvbi54LCB5OiBpbml0aWFsUG9zaXRpb24ueSB9IDoge30pXG4gICAgfSk7XG4gICAgYXdhaXQgbGVhZi5vcGVuRmlsZShmaWxlLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcblxuICAgIHRoaXMuaW5pdGlhbGl6ZVN0aWNreUxlYWYoZmlsZSwgbGVhZik7XG4gIH1cblxuICBwcml2YXRlIGluaXRpYWxpemVTdGlja3lMZWFmKGZpbGU6IFRGaWxlLCBsZWFmOiBXb3Jrc3BhY2VMZWFmLCBkZXRhY2hPbkZhaWx1cmUgPSB0cnVlKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuaW5pdGlhbGl6ZWRMZWF2ZXMuaGFzKGxlYWYpKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBUaGUgdmlldydzIG93bmVyRG9jdW1lbnQgaXMgcGVybWFuZW50bHkgdGllZCB0byB0aGlzIHBvcG91dC4gT2JzaWRpYW4nc1xuICAgIC8vIGFjdGl2ZURvY3VtZW50IGlzIGdsb2JhbCBhbmQgY2FuIHBvaW50IGF0IHRoZSBtYWluIHdpbmRvdyBhZnRlciBibHVyLlxuICAgIGNvbnN0IGRvY3VtZW50ID0gbGVhZi52aWV3LmNvbnRhaW5lckVsLm93bmVyRG9jdW1lbnQ7XG4gICAgY29uc3QgZG9tV2luZG93ID0gZG9jdW1lbnQuZGVmYXVsdFZpZXc7XG4gICAgaWYgKCFkb21XaW5kb3cpIHtcbiAgICAgIGlmIChkZXRhY2hPbkZhaWx1cmUpIHtcbiAgICAgICAgbGVhZi5kZXRhY2goKTtcbiAgICAgICAgbmV3IE5vdGljZShcIkNvdWxkIG5vdCBhY2Nlc3MgdGhlIHN0aWNreS1ub3RlIGRvY3VtZW50LlwiKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gVGhlIERPTSBXaW5kb3cgZXhwb3NlZCBieSBhbiBPYnNpZGlhbiBwb3BvdXQgZGVsaWJlcmF0ZWx5IGRvZXMgbm90IGV4cG9zZVxuICAgIC8vIEVsZWN0cm9uJ3Mgd2ViQ29udGVudHMuIEEgdW5pcXVlIGRvY3VtZW50IHRpdGxlIGlzIHZpc2libGUgdG8gRWxlY3Ryb24sXG4gICAgLy8gaG93ZXZlciwgYW5kIHJlbGlhYmx5IGdpdmVzIHVzIHRoZSBjb3JyZXNwb25kaW5nIG5hdGl2ZSBCcm93c2VyV2luZG93LlxuICAgIGNvbnN0IHdpbmRvd01hcmtlciA9IGBkZXNrdG9wLXN0aWNreS1ub3RlLSR7Y3J5cHRvLnJhbmRvbVVVSUQoKX1gO1xuICAgIGRvY3VtZW50LnRpdGxlID0gd2luZG93TWFya2VyO1xuICAgIGNvbnN0IGJyb3dzZXJXaW5kb3cgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKS5maW5kKFxuICAgICAgKGNhbmRpZGF0ZSkgPT4gY2FuZGlkYXRlLmdldFRpdGxlKCkgPT09IHdpbmRvd01hcmtlclxuICAgICkgYXMgTmF0aXZlQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZDtcbiAgICBpZiAoIWJyb3dzZXJXaW5kb3cpIHtcbiAgICAgIGlmIChkZXRhY2hPbkZhaWx1cmUpIHtcbiAgICAgICAgbGVhZi5kZXRhY2goKTtcbiAgICAgICAgbmV3IE5vdGljZShcIkNvdWxkIG5vdCBjcmVhdGUgdGhlIHN0aWNreS1ub3RlIHdpbmRvdy5cIik7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3Qgbm90ZTogU3RpY2t5Tm90ZVdpbmRvdyA9IHsgZmlsZSwgbGVhZiwgZG9jdW1lbnQsIHdpbmRvdzogYnJvd3NlcldpbmRvdyB9O1xuICAgIHRoaXMuaW5pdGlhbGl6ZWRMZWF2ZXMuYWRkKGxlYWYpO1xuICAgIHRoaXMudHJhY2tOb3RlKG5vdGUpO1xuICAgIHRoaXMucHJlcGFyZVdpbmRvdyhub3RlKTtcbiAgICB0aGlzLndhdGNoV2luZG93KG5vdGUsIGRvbVdpbmRvdyk7XG4gICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KGRvbVdpbmRvdywgXCJiZWZvcmV1bmxvYWRcIiwgKCkgPT4ge1xuICAgICAgdGhpcy5yZW1lbWJlclRvcExldmVsUG9zaXRpb24obm90ZSk7XG4gICAgICB0aGlzLnVudHJhY2tOb3RlKG5vdGUpO1xuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlV2luZG93KG5vdGU6IFN0aWNreU5vdGVXaW5kb3cpOiB2b2lkIHtcbiAgICBpZiAobm90ZS53aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuICAgIGNvbnN0IHsgZG9jdW1lbnQsIHdpbmRvdyB9ID0gbm90ZTtcbiAgICBjb25zdCBuYXRpdmVUaXRsZSA9IHRoaXMubmF0aXZlTm90ZVdpbmRvd1RpdGxlKG5vdGUuZmlsZSk7XG4gICAgY29uc3QgZG9tV2luZG93ID0gZG9jdW1lbnQuZGVmYXVsdFZpZXc7XG4gICAgaWYgKGRvbVdpbmRvdykgZG9tV2luZG93Lm5hbWUgPSB0aGlzLndpbmRvd05hbWVGb3JQYXRoKG5vdGUuZmlsZS5wYXRoKTtcbiAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZGF0YXNldC5kZXNrdG9wU3RpY2t5Tm90ZVdpbmRvdyA9IFwidHJ1ZVwiO1xuICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kYXRhc2V0LmRlc2t0b3BTdGlja3lOb3RlUGF0aCA9IG5vdGUuZmlsZS5wYXRoO1xuICAgIGRvY3VtZW50LnRpdGxlID0gbmF0aXZlVGl0bGU7XG4gICAgd2luZG93LnNldFRpdGxlKG5hdGl2ZVRpdGxlKTtcbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoXCJkZXNrdG9wLXN0aWNreS1ub3RlXCIpO1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIud29ya3NwYWNlLXRhYi1oZWFkZXItY29udGFpbmVyXCIpPy5yZW1vdmUoKTtcbiAgICB0aGlzLmFwcGx5Q29sb3Iobm90ZSwgdGhpcy5ub3RlQ29sb3Iobm90ZS5maWxlLnBhdGgpLCBmYWxzZSk7XG4gICAgaWYgKG5vdGUuZmlsZS5wYXRoID09PSB0aGlzLnNldHRpbmdzLnRvcExldmVsTm90ZVBhdGgpIHtcbiAgICAgIC8vIE9ubHkgdGhlIGdsb2JhbGx5IHRvZ2dsZWQgdG9wLWxldmVsIG5vdGUgbXVzdCBiZSBpbmRlcGVuZGVudC4gVGhpc1xuICAgICAgLy8gcHJldmVudHMgaXRzIG5hdGl2ZS1vbmx5IGRpc21pc3NhbCBmcm9tIGFjdGl2YXRpbmcgT2JzaWRpYW4ncyBtYWluXG4gICAgICAvLyB3aW5kb3cgd2hlbiB0aGUgc2hvcnRjdXQgd2FzIGludm9rZWQgb3ZlciBhbm90aGVyIGFwcGxpY2F0aW9uLlxuICAgICAgd2luZG93LnNldFBhcmVudFdpbmRvdyhudWxsKTtcbiAgICAgIHdpbmRvdy5zZXRTa2lwVGFza2Jhcih0cnVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUmVndWxhciBzdGlja3kgbm90ZXMgcmV0YWluIE9ic2lkaWFuJ3Mgbm9ybWFsIHdpbmRvdyBvd25lcnNoaXAgYW5kXG4gICAgICAvLyB0YXNrYmFyIGdyb3VwaW5nLiBUaGlzIGFsc28gcmVwYWlycyBub3RlcyBkZXRhY2hlZCBieSBlYXJsaWVyIGJ1aWxkcy5cbiAgICAgIHdpbmRvdy5zZXRTa2lwVGFza2JhcihmYWxzZSk7XG4gICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5uYXRpdmVNYWluV2luZG93KCk7XG4gICAgICBpZiAobWFpbldpbmRvdyAmJiBtYWluV2luZG93ICE9PSB3aW5kb3cpIHdpbmRvdy5zZXRQYXJlbnRXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgfVxuICAgIHdpbmRvdy5zZXRSZXNpemFibGUodHJ1ZSk7XG4gICAgdGhpcy5hZGRTdGlja3lBY3Rpb25zKG5vdGUpO1xuICAgIHRoaXMub2JzZXJ2ZVByZXNlbnRhdGlvbihub3RlKTtcbiAgfVxuXG4gIHByaXZhdGUgd2F0Y2hXaW5kb3cobm90ZTogU3RpY2t5Tm90ZVdpbmRvdywgZG9tV2luZG93OiBXaW5kb3cpOiB2b2lkIHtcbiAgICBjb25zdCByZXN0b3JlID0gKCkgPT4gdGhpcy5zY2hlZHVsZVJlZnJlc2hOb3RlKG5vdGUpO1xuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudChkb21XaW5kb3csIFwiZm9jdXNcIiwgcmVzdG9yZSk7XG4gICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KGRvbVdpbmRvdywgXCJibHVyXCIsIHJlc3RvcmUpO1xuICB9XG5cbiAgcHJpdmF0ZSBzY2hlZHVsZVJlZnJlc2hOb3RlKG5vdGU6IFN0aWNreU5vdGVXaW5kb3cpOiB2b2lkIHtcbiAgICAvLyBPYnNpZGlhbiBwZXJmb3JtcyBzb21lIGZvY3VzL2xheW91dCB3b3JrIGFmdGVyIGl0cyBldmVudHMgZmlyZSwgc28gcnVuXG4gICAgLy8gb25jZSBpbW1lZGlhdGVseSBhbmQgb25jZSBhZnRlciB0aGF0IHVwZGF0ZSBoYXMgc2V0dGxlZC5cbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0aGlzLnByZXBhcmVXaW5kb3cobm90ZSksIDApO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMucHJlcGFyZVdpbmRvdyhub3RlKSwgNzUpO1xuICB9XG5cbiAgcHJpdmF0ZSBzY2hlZHVsZVJlZnJlc2hBbGxOb3RlcygpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IG5vdGUgb2YgdGhpcy5hbGxOb3RlcygpKSB0aGlzLnNjaGVkdWxlUmVmcmVzaE5vdGUobm90ZSk7XG4gIH1cblxuICBwcml2YXRlIG5hdGl2ZU1haW5XaW5kb3coKTogTmF0aXZlQnJvd3NlcldpbmRvdyB8IG51bGwge1xuICAgIGNvbnN0IG1haW5Eb2N1bWVudCA9IHRoaXMuYXBwLndvcmtzcGFjZS5jb250YWluZXJFbC5vd25lckRvY3VtZW50O1xuICAgIGNvbnN0IHByZXZpb3VzVGl0bGUgPSBtYWluRG9jdW1lbnQudGl0bGU7XG4gICAgY29uc3QgbWFya2VyID0gYGRlc2t0b3Atc3RpY2t5LW5vdGVzLW1haW4tJHtjcnlwdG8ucmFuZG9tVVVJRCgpfWA7XG4gICAgbWFpbkRvY3VtZW50LnRpdGxlID0gbWFya2VyO1xuICAgIGNvbnN0IG1haW5XaW5kb3cgPSAoQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCkgYXMgdW5rbm93biBhcyBOYXRpdmVCcm93c2VyV2luZG93W10pXG4gICAgICAuZmluZCgoY2FuZGlkYXRlKSA9PiAhY2FuZGlkYXRlLmlzRGVzdHJveWVkKCkgJiYgY2FuZGlkYXRlLmdldFRpdGxlKCkgPT09IG1hcmtlcikgPz8gbnVsbDtcbiAgICBtYWluRG9jdW1lbnQudGl0bGUgPSBwcmV2aW91c1RpdGxlO1xuICAgIHJldHVybiBtYWluV2luZG93O1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZlUHJlc2VudGF0aW9uKG5vdGU6IFN0aWNreU5vdGVXaW5kb3cpOiB2b2lkIHtcbiAgICBpZiAobm90ZS5vYnNlcnZlcikgcmV0dXJuO1xuICAgIGxldCByZWZyZXNoU2NoZWR1bGVkID0gZmFsc2U7XG4gICAgbm90ZS5vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgIGlmIChyZWZyZXNoU2NoZWR1bGVkIHx8IHRoaXMucHJlc2VudGF0aW9uSXNJbnRhY3Qobm90ZSkpIHJldHVybjtcbiAgICAgIHJlZnJlc2hTY2hlZHVsZWQgPSB0cnVlO1xuICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICByZWZyZXNoU2NoZWR1bGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMucHJlcGFyZVdpbmRvdyhub3RlKTtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICAgIG5vdGUub2JzZXJ2ZXIub2JzZXJ2ZShub3RlLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwge1xuICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgICBjaGFyYWN0ZXJEYXRhOiB0cnVlLFxuICAgICAgYXR0cmlidXRlRmlsdGVyOiBbXCJjbGFzc1wiLCBcInN0eWxlXCJdXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHByZXNlbnRhdGlvbklzSW50YWN0KG5vdGU6IFN0aWNreU5vdGVXaW5kb3cpOiBib29sZWFuIHtcbiAgICBjb25zdCB7IGRvY3VtZW50IH0gPSBub3RlO1xuICAgIGNvbnN0IGFjdGlvbnMgPSBub3RlLmxlYWYudmlldy5jb250YWluZXJFbC5xdWVyeVNlbGVjdG9yKFwiLnZpZXctYWN0aW9uc1wiKTtcbiAgICBjb25zdCBleHBlY3RlZENvbG9yID0gdGhpcy5ub3RlQ29sb3Iobm90ZS5maWxlLnBhdGgpO1xuICAgIHJldHVybiBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhcImRlc2t0b3Atc3RpY2t5LW5vdGVcIilcbiAgICAgICYmIGRvY3VtZW50LmRlZmF1bHRWaWV3Py5uYW1lID09PSB0aGlzLndpbmRvd05hbWVGb3JQYXRoKG5vdGUuZmlsZS5wYXRoKVxuICAgICAgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRhdGFzZXQuZGVza3RvcFN0aWNreU5vdGVXaW5kb3cgPT09IFwidHJ1ZVwiXG4gICAgICAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZGF0YXNldC5kZXNrdG9wU3RpY2t5Tm90ZVBhdGggPT09IG5vdGUuZmlsZS5wYXRoXG4gICAgICAmJiBkb2N1bWVudC50aXRsZSA9PT0gdGhpcy5uYXRpdmVOb3RlV2luZG93VGl0bGUobm90ZS5maWxlKVxuICAgICAgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLmdldFByb3BlcnR5VmFsdWUoXCItLWJhY2tncm91bmQtcHJpbWFyeVwiKSA9PT0gZXhwZWN0ZWRDb2xvclxuICAgICAgJiYgZG9jdW1lbnQuYm9keS5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKFwiLS1zdGlja3ktbm90ZS1iYWNrZ3JvdW5kXCIpID09PSBleHBlY3RlZENvbG9yXG4gICAgICAmJiAhZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi53b3Jrc3BhY2UtdGFiLWhlYWRlci1jb250YWluZXJcIilcbiAgICAgICYmICEhYWN0aW9ucz8ucXVlcnlTZWxlY3RvcihcIi5kZXNrdG9wLXN0aWNreS1ub3RlLWNvbG9yLXBpY2tlclwiKTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkU3RpY2t5QWN0aW9ucyhub3RlOiBTdGlja3lOb3RlV2luZG93KTogdm9pZCB7XG4gICAgY29uc3QgdmlldyA9IG5vdGUubGVhZi52aWV3O1xuICAgIGlmICghKHZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcpKSByZXR1cm47XG4gICAgY29uc3QgYWN0aW9ucyA9IHZpZXcuY29udGFpbmVyRWwucXVlcnlTZWxlY3RvcihcIi52aWV3LWFjdGlvbnNcIik7XG4gICAgYWN0aW9ucz8uZW1wdHkoKTtcblxuICAgIGNvbnN0IHBpbiA9IHZpZXcuYWRkQWN0aW9uKFwicGluXCIsIFwiS2VlcCBvbiB0b3BcIiwgKCkgPT4ge1xuICAgICAgbm90ZS53aW5kb3cuc2V0QWx3YXlzT25Ub3AoIW5vdGUud2luZG93LmlzQWx3YXlzT25Ub3AoKSk7XG4gICAgICB0aGlzLnVwZGF0ZVBpbkJ1dHRvbihwaW4sIG5vdGUud2luZG93LmlzQWx3YXlzT25Ub3AoKSk7XG4gICAgfSk7XG4gICAgdGhpcy51cGRhdGVQaW5CdXR0b24ocGluLCBub3RlLndpbmRvdy5pc0Fsd2F5c09uVG9wKCkpO1xuXG4gICAgY29uc3QgY29sb3JQaWNrZXIgPSBhY3Rpb25zPy5jcmVhdGVFbChcImlucHV0XCIsIHtcbiAgICAgIGNsczogXCJkZXNrdG9wLXN0aWNreS1ub3RlLWNvbG9yLXBpY2tlclwiLFxuICAgICAgYXR0cjoge1xuICAgICAgICB0eXBlOiBcImNvbG9yXCIsXG4gICAgICAgIHZhbHVlOiB0aGlzLm5vdGVDb2xvcihub3RlLmZpbGUucGF0aCksXG4gICAgICAgIFwiYXJpYS1sYWJlbFwiOiBcIkNob29zZSBzdGlja3ktbm90ZSBiYWNrZ3JvdW5kIGNvbG9yXCIsXG4gICAgICAgIHRpdGxlOiBcIkNob29zZSBiYWNrZ3JvdW5kIGNvbG9yXCJcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoY29sb3JQaWNrZXIgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50KSB7XG4gICAgICB0aGlzLnJlZ2lzdGVyRG9tRXZlbnQoY29sb3JQaWNrZXIsIFwiaW5wdXRcIiwgKCkgPT4gdGhpcy5hcHBseUNvbG9yKG5vdGUsIGNvbG9yUGlja2VyLnZhbHVlKSk7XG4gICAgICB0aGlzLnJlZ2lzdGVyRG9tRXZlbnQoY29sb3JQaWNrZXIsIFwiY2xpY2tcIiwgKGV2ZW50KSA9PiBldmVudC5zdG9wUHJvcGFnYXRpb24oKSk7XG4gICAgfVxuICAgIGNvbnN0IG1vZGUgPSB2aWV3LmFkZEFjdGlvbihcInBlbmNpbFwiLCBcIlN3aXRjaCB0byBlZGl0IG1vZGVcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgbmV4dE1vZGUgPSB2aWV3LmdldE1vZGUoKSA9PT0gXCJzb3VyY2VcIiA/IFwicHJldmlld1wiIDogXCJzb3VyY2VcIjtcbiAgICAgIHZvaWQgdmlldy5zZXRTdGF0ZSh7IG1vZGU6IG5leHRNb2RlIH0sIHsgaGlzdG9yeTogZmFsc2UgfSk7XG4gICAgICB0aGlzLnVwZGF0ZU1vZGVCdXR0b24obW9kZSwgbmV4dE1vZGUpO1xuICAgIH0pO1xuICAgIHRoaXMudXBkYXRlTW9kZUJ1dHRvbihtb2RlLCB2aWV3LmdldE1vZGUoKSk7XG4gICAgdmlldy5hZGRBY3Rpb24oXCJ4XCIsIFwiSGlkZSBzdGlja3kgbm90ZVwiLCAoKSA9PiB0aGlzLmhpZGVOb3RlKG5vdGUpKVxuICAgICAgLmFkZENsYXNzKFwiZGVza3RvcC1zdGlja3ktbm90ZS1oaWRlXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVQaW5CdXR0b24oYnV0dG9uOiBIVE1MRWxlbWVudCwgcGlubmVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgc2V0SWNvbihidXR0b24sIHBpbm5lZCA/IFwicGluLW9mZlwiIDogXCJwaW5cIik7XG4gICAgc2V0VG9vbHRpcChidXR0b24sIHBpbm5lZCA/IFwiU3RvcCBrZWVwaW5nIG9uIHRvcFwiIDogXCJLZWVwIG9uIHRvcFwiKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlTW9kZUJ1dHRvbihidXR0b246IEhUTUxFbGVtZW50LCBtb2RlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlZGl0aW5nID0gbW9kZSA9PT0gXCJzb3VyY2VcIjtcbiAgICBzZXRJY29uKGJ1dHRvbiwgZWRpdGluZyA/IFwiYm9vay1vcGVuXCIgOiBcInBlbmNpbFwiKTtcbiAgICBzZXRUb29sdGlwKGJ1dHRvbiwgZWRpdGluZyA/IFwiU3dpdGNoIHRvIHJlYWRpbmcgdmlld1wiIDogXCJTd2l0Y2ggdG8gZWRpdCBtb2RlXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBhcHBseUNvbG9yKG5vdGU6IFN0aWNreU5vdGVXaW5kb3csIGNvbG9yOiBzdHJpbmcsIHBlcnNpc3QgPSB0cnVlKTogdm9pZCB7XG4gICAgY29uc3Qgcm9vdFN0eWxlID0gbm90ZS5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGU7XG4gICAgcm9vdFN0eWxlLnNldFByb3BlcnR5KFwiLS1iYWNrZ3JvdW5kLXByaW1hcnlcIiwgY29sb3IpO1xuICAgIHJvb3RTdHlsZS5zZXRQcm9wZXJ0eShcIi0tYmFja2dyb3VuZC1wcmltYXJ5LWFsdFwiLCBjb2xvcik7XG4gICAgcm9vdFN0eWxlLnNldFByb3BlcnR5KFwiLS1iYWNrZ3JvdW5kLXNlY29uZGFyeVwiLCBjb2xvcik7XG4gICAgcm9vdFN0eWxlLnNldFByb3BlcnR5KFwiLS1iYWNrZ3JvdW5kLXNlY29uZGFyeS1hbHRcIiwgY29sb3IpO1xuICAgIG5vdGUuZG9jdW1lbnQuYm9keS5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tc3RpY2t5LW5vdGUtYmFja2dyb3VuZFwiLCBjb2xvcik7XG4gICAgaWYgKHBlcnNpc3QpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MuY29sb3JzQnlQYXRoW25vdGUuZmlsZS5wYXRoXSA9IGNvbG9yO1xuICAgICAgdm9pZCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgbm90ZUNvbG9yKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3MuY29sb3JzQnlQYXRoW3BhdGhdID8/IHRoaXMuc2V0dGluZ3MuZGVmYXVsdE5vdGVDb2xvcjtcbiAgfVxuXG4gIHByaXZhdGUgdHJhY2tOb3RlKG5vdGU6IFN0aWNreU5vdGVXaW5kb3cpOiB2b2lkIHtcbiAgICBjb25zdCBub3RlcyA9IHRoaXMubm90ZXNCeVBhdGguZ2V0KG5vdGUuZmlsZS5wYXRoKSA/PyBuZXcgU2V0PFN0aWNreU5vdGVXaW5kb3c+KCk7XG4gICAgbm90ZXMuYWRkKG5vdGUpO1xuICAgIHRoaXMubm90ZXNCeVBhdGguc2V0KG5vdGUuZmlsZS5wYXRoLCBub3Rlcyk7XG4gIH1cblxuICBwcml2YXRlIHVudHJhY2tOb3RlKG5vdGU6IFN0aWNreU5vdGVXaW5kb3cpOiB2b2lkIHtcbiAgICBub3RlLm9ic2VydmVyPy5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5pbml0aWFsaXplZExlYXZlcy5kZWxldGUobm90ZS5sZWFmKTtcbiAgICBjb25zdCBub3RlcyA9IHRoaXMubm90ZXNCeVBhdGguZ2V0KG5vdGUuZmlsZS5wYXRoKTtcbiAgICBpZiAoIW5vdGVzKSByZXR1cm47XG4gICAgbm90ZXMuZGVsZXRlKG5vdGUpO1xuICAgIGlmICghbm90ZXMuc2l6ZSkgdGhpcy5ub3Rlc0J5UGF0aC5kZWxldGUobm90ZS5maWxlLnBhdGgpO1xuICB9XG5cbiAgcHJpdmF0ZSBjbG9zZU5vdGVzRm9yUGF0aChwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBub3RlcyA9IFsuLi4odGhpcy5ub3Rlc0J5UGF0aC5nZXQocGF0aCkgPz8gW10pXTtcbiAgICBmb3IgKGNvbnN0IG5vdGUgb2Ygbm90ZXMpIHtcbiAgICAgIHRoaXMucmVtZW1iZXJUb3BMZXZlbFBvc2l0aW9uKG5vdGUpO1xuICAgICAgdGhpcy5jbGVhcldpbmRvd01hcmtlcihub3RlKTtcbiAgICAgIHRoaXMudW50cmFja05vdGUobm90ZSk7XG4gICAgICBub3RlLmxlYWYuZGV0YWNoKCk7XG4gICAgICB0aGlzLmZvcmNlQ2xvc2VXaW5kb3cobm90ZS53aW5kb3cpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGxlYWYgb2YgdGhpcy5zdGlja3lMZWF2ZXNGb3JQYXRoKHBhdGgpKSB7XG4gICAgICBjb25zdCBkb21XaW5kb3cgPSBsZWFmLnZpZXcuY29udGFpbmVyRWwub3duZXJEb2N1bWVudC5kZWZhdWx0VmlldztcbiAgICAgIGlmIChkb21XaW5kb3cpIGRvbVdpbmRvdy5uYW1lID0gXCJcIjtcbiAgICAgIGxlYWYuZGV0YWNoKCk7XG4gICAgfVxuICAgIHZvaWQgdGhpcy5hcHAud29ya3NwYWNlLnJlcXVlc3RTYXZlTGF5b3V0KCk7XG4gIH1cblxuICBwcml2YXRlIGhpZGVOb3RlKG5vdGU6IFN0aWNreU5vdGVXaW5kb3cpOiB2b2lkIHtcbiAgICB0aGlzLnJlbWVtYmVyVG9wTGV2ZWxQb3NpdGlvbihub3RlKTtcbiAgICB0aGlzLmNsZWFyV2luZG93TWFya2VyKG5vdGUpO1xuICAgIHRoaXMudW50cmFja05vdGUobm90ZSk7XG4gICAgbm90ZS5sZWFmLmRldGFjaCgpO1xuICAgIHRoaXMuZm9yY2VDbG9zZVdpbmRvdyhub3RlLndpbmRvdyk7XG4gICAgdm9pZCB0aGlzLmFwcC53b3Jrc3BhY2UucmVxdWVzdFNhdmVMYXlvdXQoKTtcbiAgfVxuXG4gIHByaXZhdGUgY2xlYXJXaW5kb3dNYXJrZXIobm90ZTogU3RpY2t5Tm90ZVdpbmRvdyk6IHZvaWQge1xuICAgIGNvbnN0IGRvbVdpbmRvdyA9IG5vdGUuZG9jdW1lbnQuZGVmYXVsdFZpZXc7XG4gICAgaWYgKGRvbVdpbmRvdykgZG9tV2luZG93Lm5hbWUgPSBcIlwiO1xuICAgIGRlbGV0ZSBub3RlLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kYXRhc2V0LmRlc2t0b3BTdGlja3lOb3RlV2luZG93O1xuICAgIGRlbGV0ZSBub3RlLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kYXRhc2V0LmRlc2t0b3BTdGlja3lOb3RlUGF0aDtcbiAgfVxuXG4gIHByaXZhdGUgZm9yY2VDbG9zZVdpbmRvdyhuYXRpdmVXaW5kb3c6IE5hdGl2ZUJyb3dzZXJXaW5kb3cpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgaWYgKCFuYXRpdmVXaW5kb3cuaXNEZXN0cm95ZWQoKSkgbmF0aXZlV2luZG93LmNsb3NlKCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBGYWxsIHRocm91Z2ggdG8gdGhlIGZvcmNlZC1kZXN0cm95IGNoZWNrIGJlbG93LlxuICAgIH1cbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoIW5hdGl2ZVdpbmRvdy5pc0Rlc3Ryb3llZCgpKSBuYXRpdmVXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIFRoZSByZW1vdGUgcHJveHkgYmVjb21lcyBpbnZhbGlkIGFzIHNvb24gYXMgdGhlIHdpbmRvdyBjbG9zZXMuXG4gICAgICB9XG4gICAgfSwgNTApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjbG9zZVN0YWxlU3RpY2t5V2luZG93cygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB3aW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCkgYXMgdW5rbm93biBhcyBOYXRpdmVCcm93c2VyV2luZG93W107XG4gICAgZm9yIChjb25zdCBjYW5kaWRhdGUgb2Ygd2luZG93cykge1xuICAgICAgaWYgKGNhbmRpZGF0ZS5pc0Rlc3Ryb3llZCgpKSBjb250aW51ZTtcbiAgICAgIGxldCBpc1N0aWNreVdpbmRvdyA9IGNhbmRpZGF0ZS5nZXRUaXRsZSgpLnN0YXJ0c1dpdGgoXCJTdGlja3kgbm90ZSBcdTIwMTRcIik7XG4gICAgICBpZiAoIWlzU3RpY2t5V2luZG93KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaXNTdGlja3lXaW5kb3cgPSBhd2FpdCBjYW5kaWRhdGUud2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoXG4gICAgICAgICAgICBgd2luZG93Lm5hbWUuc3RhcnRzV2l0aCgnJHtXSU5ET1dfTkFNRV9QUkVGSVh9JylgXG4gICAgICAgICAgKSA9PT0gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gQSByZW5kZXJlciBjYW4gZGlzYXBwZWFyIHdoaWxlIHN0YXJ0dXAgY2xlYW51cCBpcyBydW5uaW5nLlxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaXNTdGlja3lXaW5kb3cgJiYgIWNhbmRpZGF0ZS5pc0Rlc3Ryb3llZCgpKSBjYW5kaWRhdGUuZGVzdHJveSgpO1xuICAgIH1cbiAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5yZXF1ZXN0U2F2ZUxheW91dCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGlja3lMZWF2ZXNGb3JQYXRoKHBhdGg6IHN0cmluZyk6IFdvcmtzcGFjZUxlYWZbXSB7XG4gICAgY29uc3Qgc3RpY2t5TGVhdmVzOiBXb3Jrc3BhY2VMZWFmW10gPSBbXTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuaXRlcmF0ZUFsbExlYXZlcygobGVhZikgPT4ge1xuICAgICAgaWYgKCEobGVhZi52aWV3IGluc3RhbmNlb2YgTWFya2Rvd25WaWV3KSB8fCBsZWFmLnZpZXcuZmlsZT8ucGF0aCAhPT0gcGF0aCkgcmV0dXJuO1xuICAgICAgY29uc3QgZG9jdW1lbnQgPSBsZWFmLnZpZXcuY29udGFpbmVyRWwub3duZXJEb2N1bWVudDtcbiAgICAgIGlmIChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZGF0YXNldC5kZXNrdG9wU3RpY2t5Tm90ZVdpbmRvdyA9PT0gXCJ0cnVlXCJcbiAgICAgICAgJiYgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuY29udGFpbnMoXCJkZXNrdG9wLXN0aWNreS1ub3RlXCIpKSB7XG4gICAgICAgIHN0aWNreUxlYXZlcy5wdXNoKGxlYWYpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBzdGlja3lMZWF2ZXM7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIG5hdGl2ZU5vdGVXaW5kb3dzRm9yUGF0aChwYXRoOiBzdHJpbmcpOiBQcm9taXNlPE5hdGl2ZUJyb3dzZXJXaW5kb3dbXT4ge1xuICAgIGNvbnN0IG1hdGNoZXM6IE5hdGl2ZUJyb3dzZXJXaW5kb3dbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpIGFzIHVua25vd24gYXMgTmF0aXZlQnJvd3NlcldpbmRvd1tdKSB7XG4gICAgICBpZiAoY2FuZGlkYXRlLmlzRGVzdHJveWVkKCkpIGNvbnRpbnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgbWFya2VkUGF0aCA9IGF3YWl0IGNhbmRpZGF0ZS53ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChcbiAgICAgICAgICBgd2luZG93Lm5hbWUuc3RhcnRzV2l0aCgnJHtXSU5ET1dfTkFNRV9QUkVGSVh9JykgYFxuICAgICAgICAgICAgKyBgPyBkZWNvZGVVUklDb21wb25lbnQod2luZG93Lm5hbWUuc2xpY2UoJHtXSU5ET1dfTkFNRV9QUkVGSVgubGVuZ3RofSkpIDogbnVsbGBcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKG1hcmtlZFBhdGggPT09IHBhdGgpIG1hdGNoZXMucHVzaChjYW5kaWRhdGUpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIEEgd2luZG93IGNhbiBjbG9zZSB3aGlsZSB0aGUgY29tbWFuZCBpcyBpbnNwZWN0aW5nIGl0LlxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWF0Y2hlcztcbiAgfVxuXG4gIHByaXZhdGUgcmVtZW1iZXJUb3BMZXZlbFBvc2l0aW9uKG5vdGU6IFN0aWNreU5vdGVXaW5kb3cpOiB2b2lkIHtcbiAgICBpZiAobm90ZS5maWxlLnBhdGggIT09IHRoaXMuc2V0dGluZ3MudG9wTGV2ZWxOb3RlUGF0aCB8fCBub3RlLndpbmRvdy5pc0Rlc3Ryb3llZCgpKSByZXR1cm47XG4gICAgY29uc3QgW3gsIHldID0gbm90ZS53aW5kb3cuZ2V0UG9zaXRpb24oKTtcbiAgICB0aGlzLnNldHRpbmdzLnRvcExldmVsV2luZG93UG9zaXRpb24gPSB7IHgsIHkgfTtcbiAgICB2b2lkIHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gIH1cblxuICBwcml2YXRlIHBvc2l0aW9uSXNWaXNpYmxlKHBvc2l0aW9uOiBXaW5kb3dQb3NpdGlvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKS5zb21lKChkaXNwbGF5KSA9PiB7XG4gICAgICBjb25zdCB7IHgsIHksIHdpZHRoLCBoZWlnaHQgfSA9IGRpc3BsYXkud29ya0FyZWE7XG4gICAgICAvLyBLZWVwIHRoZSB1cHBlci1sZWZ0IGRyYWcgYXJlYSByZWFjaGFibGUgb24gYXQgbGVhc3Qgb25lIGRpc3BsYXkuXG4gICAgICByZXR1cm4gcG9zaXRpb24ueCA+PSB4IC0gNDBcbiAgICAgICAgJiYgcG9zaXRpb24ueCA8IHggKyB3aWR0aCAtIDQwXG4gICAgICAgICYmIHBvc2l0aW9uLnkgPj0geVxuICAgICAgICAmJiBwb3NpdGlvbi55IDwgeSArIGhlaWdodCAtIDMwO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBuYXRpdmVOb3RlV2luZG93VGl0bGUoZmlsZTogVEZpbGUpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLm5hdGl2ZU5vdGVXaW5kb3dUaXRsZUZvclBhdGgoZmlsZS5wYXRoLCBmaWxlLmJhc2VuYW1lKTtcbiAgfVxuXG4gIHByaXZhdGUgbmF0aXZlTm90ZVdpbmRvd1RpdGxlRm9yUGF0aChwYXRoOiBzdHJpbmcsIGJhc2VuYW1lPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBsYWJlbCA9IGJhc2VuYW1lID8/IHBhdGguc3BsaXQoXCIvXCIpLnBvcCgpPy5yZXBsYWNlKC9cXC5tZCQvLCBcIlwiKSA/PyBcIlN0aWNreSBub3RlXCI7XG4gICAgLy8gVGhlIGludmlzaWJsZSBzdWZmaXggaXMgYSBzdGFibGUsIHBhdGgtc3BlY2lmaWMga2V5IHNoYXJlZCBieSBldmVyeVxuICAgIC8vIE9ic2lkaWFuIHJlbmRlcmVyIHdpdGhvdXQgY2x1dHRlcmluZyB0aGUgdmlzaWJsZSBuYXRpdmUgd2luZG93IHRpdGxlLlxuICAgIHJldHVybiBgU3RpY2t5IG5vdGUgXHUyMDE0ICR7bGFiZWx9XFx1MjA2MyR7ZW5jb2RlVVJJQ29tcG9uZW50KHBhdGgpfWA7XG4gIH1cblxuICBwcml2YXRlIHdpbmRvd05hbWVGb3JQYXRoKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke1dJTkRPV19OQU1FX1BSRUZJWH0ke2VuY29kZVVSSUNvbXBvbmVudChwYXRoKX1gO1xuICB9XG5cbiAgcHJpdmF0ZSAqYWxsTm90ZXMoKTogSXRlcmFibGU8U3RpY2t5Tm90ZVdpbmRvdz4ge1xuICAgIGZvciAoY29uc3Qgbm90ZXMgb2YgdGhpcy5ub3Rlc0J5UGF0aC52YWx1ZXMoKSkgeWllbGQqIG5vdGVzO1xuICB9XG5cbiAgcHJpdmF0ZSBub3JtYWxpemVGb2xkZXIoZm9sZGVyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBmb2xkZXIudHJpbSgpLnJlcGxhY2UoL15cXC8rfFxcLyskL2csIFwiXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSB1bmlxdWVOb3RlTmFtZSgpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0YW1wID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnJlcGxhY2UoL1s6Ll0vZywgXCItXCIpO1xuICAgIHJldHVybiBgU3RpY2t5IG5vdGUgJHtzdGFtcH1gO1xuICB9XG59XG5cbmNsYXNzIERlc2t0b3BTdGlja3lOb3Rlc1NldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBQbHVnaW5TZXR0aW5nVGFiW1wiYXBwXCJdLCBwcml2YXRlIHBsdWdpbjogRGVza3RvcFN0aWNreU5vdGVzUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiRGVza3RvcCBTdGlja3kgTm90ZXNcIiB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJEZWZhdWx0IGZvbGRlclwiKVxuICAgICAgLnNldERlc2MoXCJGb2xkZXIgZm9yIG5ld2x5IGNyZWF0ZWQgc3RpY2t5IG5vdGVzLiBMZWF2ZSBibGFuayBmb3IgdGhlIHZhdWx0IHJvb3QuXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT4gdGV4dFxuICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJWYXVsdCByb290XCIpXG4gICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0Rm9sZGVyKVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVmYXVsdEZvbGRlciA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkRlZmF1bHQgbm90ZSBjb2xvclwiKVxuICAgICAgLnNldERlc2MoXCJCYWNrZ3JvdW5kIGNvbG9yIHVzZWQgZm9yIG5vdGVzIHRoYXQgZG8gbm90IGhhdmUgYSBzYXZlZCBjdXN0b20gY29sb3IuXCIpXG4gICAgICAuYWRkQ29sb3JQaWNrZXIoKHBpY2tlcikgPT4gcGlja2VyXG4gICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0Tm90ZUNvbG9yKVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVmYXVsdE5vdGVDb2xvciA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiR2xvYmFsIHRvZ2dsZSBzaG9ydGN1dFwiKVxuICAgICAgLnNldERlc2MoXCJTeXN0ZW0td2lkZSBzaG9ydGN1dCBmb3IgdG9nZ2xpbmcgdGhlIHRvcC1sZXZlbCBzdGlja3kgbm90ZS4gTGVhdmUgYmxhbmsgdG8gZGlzYWJsZS5cIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0XG4gICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIkNvbW1hbmRPckNvbnRyb2wrQWx0K05cIilcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmdsb2JhbFRvZ2dsZVNob3J0Y3V0KVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZ2xvYmFsVG9nZ2xlU2hvcnRjdXQgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2NoZWR1bGVHbG9iYWxTaG9ydGN1dFJlZ2lzdHJhdGlvbigpO1xuICAgICAgICB9KSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiVG9wLWxldmVsIHN0aWNreSBub3RlXCIpXG4gICAgICAuc2V0RGVzYyh0aGlzLnBsdWdpbi5zZXR0aW5ncy50b3BMZXZlbE5vdGVQYXRoID8/IFwiTm8gdG9wLWxldmVsIG5vdGUgc2VsZWN0ZWQuXCIpXG4gICAgICAuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvblxuICAgICAgICAuc2V0QnV0dG9uVGV4dChcIlVzZSBhY3RpdmUgZmlsZVwiKVxuICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgICAgaWYgKCFmaWxlKSB7XG4gICAgICAgICAgICBuZXcgTm90aWNlKFwiT3BlbiBhIE1hcmtkb3duIGZpbGUgZmlyc3QuXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2b2lkIHRoaXMucGx1Z2luLnNldFRvcExldmVsTm90ZShmaWxlLnBhdGgpLnRoZW4oKCkgPT4gdGhpcy5kaXNwbGF5KCkpO1xuICAgICAgICB9KSlcbiAgICAgIC5hZGRFeHRyYUJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b25cbiAgICAgICAgLnNldEljb24oXCJ0cmFzaFwiKVxuICAgICAgICAuc2V0VG9vbHRpcChcIkNsZWFyIHRvcC1sZXZlbCBub3RlXCIpXG4gICAgICAgIC5vbkNsaWNrKCgpID0+IHZvaWQgdGhpcy5wbHVnaW4uc2V0VG9wTGV2ZWxOb3RlKG51bGwpLnRoZW4oKCkgPT4gdGhpcy5kaXNwbGF5KCkpKSk7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUEsMEVBQUFBLFVBQUE7QUFBQTtBQUNBLFdBQU8sZUFBZUEsVUFBUyxjQUFjLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDNUQsSUFBQUEsU0FBUSxvQkFBb0I7QUFDNUIsUUFBTSxvQkFBTixNQUF3QjtBQUFBLE1BQ3BCLGNBQWM7QUFDVixhQUFLLFNBQVM7QUFDZCxhQUFLLFlBQVksQ0FBQztBQUNsQixhQUFLLGNBQWMsb0JBQUksUUFBUTtBQUMvQixhQUFLLGVBQWUsb0JBQUksUUFBUTtBQUFBLE1BQ3BDO0FBQUEsTUFDQSxJQUFJLFVBQVU7QUFFVixZQUFJLEtBQUssS0FBSyxZQUFZLElBQUksUUFBUTtBQUN0QyxZQUFJLE1BQU07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
