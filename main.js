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
var LEGACY_DEFAULT_GLOBAL_SHORTCUT = "CommandOrControl+Alt+N";
var DEFAULT_GLOBAL_SHORTCUT = process.platform === "darwin" ? "Option+F10" : "Super+F10";
var ACCELERATOR_KEYS_BY_CODE = {
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
  Quote: '"',
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
function acceleratorKeyForEvent(event) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) return event.code;
  if (/^Numpad[0-9]$/.test(event.code)) return `num${event.code.slice(6)}`;
  return ACCELERATOR_KEYS_BY_CODE[event.code] ?? null;
}
function acceleratorForEvent(event) {
  const key = acceleratorKeyForEvent(event);
  if (!key) return null;
  const modifiers = [];
  if (event.getModifierState("AltGraph")) {
    modifiers.push("AltGr");
  } else {
    if (event.metaKey) modifiers.push(process.platform === "darwin" ? "Command" : "Super");
    if (event.ctrlKey) modifiers.push("Control");
    if (event.altKey) modifiers.push("Alt");
  }
  if (event.shiftKey) modifiers.push("Shift");
  return [...modifiers, key].join("+");
}
function displayAccelerator(accelerator) {
  if (!accelerator) return "Disabled";
  const labels = accelerator.split("+").map((part) => {
    if (process.platform === "darwin") {
      if (["Command", "Cmd", "CommandOrControl", "CmdOrCtrl", "Super", "Meta"].includes(part)) return "\u2318";
      if (["Control", "Ctrl"].includes(part)) return "\u2303";
      if (["Alt", "Option"].includes(part)) return "\u2325";
      if (part === "Shift") return "\u21E7";
    } else {
      if (["Super", "Meta"].includes(part)) return "Win";
      if (["Control", "Ctrl", "CommandOrControl", "CmdOrCtrl"].includes(part)) return "Ctrl";
    }
    return part === "Plus" ? "+" : part;
  });
  return labels.join(process.platform === "darwin" ? " " : " + ");
}
var DEFAULT_SETTINGS = {
  defaultFolder: "",
  defaultNoteColor: DEFAULT_COLOR,
  globalToggleShortcut: DEFAULT_GLOBAL_SHORTCUT,
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
    if (stored.globalToggleShortcut === LEGACY_DEFAULT_GLOBAL_SHORTCUT) {
      this.settings.globalToggleShortcut = DEFAULT_GLOBAL_SHORTCUT;
      await this.saveSettings();
    }
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
  beginGlobalShortcutRecording() {
    if (this.shortcutRegistrationTimer !== null) {
      window.clearTimeout(this.shortcutRegistrationTimer);
      this.shortcutRegistrationTimer = null;
    }
    this.unregisterGlobalToggleShortcut();
  }
  cancelGlobalShortcutRecording() {
    this.registerGlobalToggleShortcut();
  }
  async setGlobalToggleShortcut(accelerator) {
    this.settings.globalToggleShortcut = accelerator;
    await this.saveSettings();
    this.registerGlobalToggleShortcut(true);
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
        new import_obsidian.Notice(`Could not register global shortcut: ${displayAccelerator(accelerator)}`);
        return;
      }
      this.registeredGlobalShortcut = accelerator;
      if (showResult) new import_obsidian.Notice(`Global sticky-note shortcut: ${displayAccelerator(accelerator)}`);
    } catch {
      new import_obsidian.Notice(`Invalid global shortcut: ${displayAccelerator(accelerator)}`);
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
  shortcutRecordingCleanup = null;
  display() {
    this.stopShortcutRecording(true);
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
    const shortcutSetting = new import_obsidian.Setting(containerEl).setName("Global toggle shortcut").setDesc("System-wide shortcut for toggling the top-level sticky note. Click the shortcut, press a new combination, or press Escape to cancel.");
    let recorderButton;
    let clearButton;
    shortcutSetting.addButton((button) => {
      button.setButtonText(displayAccelerator(this.plugin.settings.globalToggleShortcut)).setTooltip("Record global shortcut").setClass("desktop-sticky-note-shortcut-recorder").onClick(() => {
        if (this.shortcutRecordingCleanup) {
          this.stopShortcutRecording(true);
        } else {
          this.startShortcutRecording(recorderButton, clearButton);
        }
      });
      recorderButton = button.buttonEl;
    }).addButton((button) => {
      button.setButtonText("Clear").setTooltip("Disable global shortcut").setDisabled(!this.plugin.settings.globalToggleShortcut).onClick(async () => {
        this.stopShortcutRecording(false);
        await this.plugin.setGlobalToggleShortcut("");
        recorderButton.setText("Disabled");
        clearButton.disabled = true;
      });
      clearButton = button.buttonEl;
    });
    new import_obsidian.Setting(containerEl).setName("Top-level sticky note").setDesc(this.plugin.settings.topLevelNotePath ?? "No top-level note selected.").addButton((button) => button.setButtonText("Use active file").onClick(() => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new import_obsidian.Notice("Open a Markdown file first.");
        return;
      }
      void this.plugin.setTopLevelNote(file.path).then(() => this.display());
    })).addExtraButton((button) => button.setIcon("trash").setTooltip("Clear top-level note").onClick(() => void this.plugin.setTopLevelNote(null).then(() => this.display())));
  }
  hide() {
    this.stopShortcutRecording(true);
    super.hide();
  }
  startShortcutRecording(recorderButton, clearButton) {
    this.stopShortcutRecording(true);
    this.plugin.beginGlobalShortcutRecording();
    const previousLabel = displayAccelerator(this.plugin.settings.globalToggleShortcut);
    recorderButton.setText("Press shortcut\u2026");
    recorderButton.addClass("is-recording");
    clearButton.disabled = true;
    recorderButton.focus();
    const finish = (restoreRegistration) => {
      const cleanup = this.shortcutRecordingCleanup;
      this.shortcutRecordingCleanup = null;
      cleanup?.();
      recorderButton.removeClass("is-recording");
      if (restoreRegistration) this.plugin.cancelGlobalShortcutRecording();
    };
    const onKeyDown = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.key === "Escape") {
        finish(true);
        recorderButton.setText(previousLabel);
        clearButton.disabled = !this.plugin.settings.globalToggleShortcut;
        return;
      }
      const accelerator = acceleratorForEvent(event);
      if (!accelerator) return;
      finish(false);
      recorderButton.setText(displayAccelerator(accelerator));
      clearButton.disabled = false;
      void this.plugin.setGlobalToggleShortcut(accelerator);
    };
    const onPointerDown = (event) => {
      if (event.target === recorderButton || recorderButton.contains(event.target)) return;
      finish(true);
      recorderButton.setText(previousLabel);
      clearButton.disabled = !this.plugin.settings.globalToggleShortcut;
    };
    const document = recorderButton.ownerDocument;
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    this.shortcutRecordingCleanup = () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }
  stopShortcutRecording(restoreRegistration) {
    if (!this.shortcutRecordingCleanup) return;
    const cleanup = this.shortcutRecordingCleanup;
    this.shortcutRecordingCleanup = null;
    cleanup();
    if (restoreRegistration) this.plugin.cancelGlobalShortcutRecording();
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibm9kZV9tb2R1bGVzL0BlbGVjdHJvbi9yZW1vdGUvZGlzdC9zcmMvcmVuZGVyZXIvY2FsbGJhY2tzLXJlZ2lzdHJ5LmpzIiwgIm5vZGVfbW9kdWxlcy9AZWxlY3Ryb24vcmVtb3RlL2Rpc3Qvc3JjL2NvbW1vbi90eXBlLXV0aWxzLmpzIiwgIm5vZGVfbW9kdWxlcy9AZWxlY3Ryb24vcmVtb3RlL2Rpc3Qvc3JjL2NvbW1vbi9nZXQtZWxlY3Ryb24tYmluZGluZy5qcyIsICJub2RlX21vZHVsZXMvQGVsZWN0cm9uL3JlbW90ZS9kaXN0L3NyYy9jb21tb24vbW9kdWxlLW5hbWVzLmpzIiwgIm5vZGVfbW9kdWxlcy9AZWxlY3Ryb24vcmVtb3RlL2Rpc3Qvc3JjL3JlbmRlcmVyL3JlbW90ZS5qcyIsICJub2RlX21vZHVsZXMvQGVsZWN0cm9uL3JlbW90ZS9kaXN0L3NyYy9yZW5kZXJlci9pbmRleC5qcyIsICJub2RlX21vZHVsZXMvQGVsZWN0cm9uL3JlbW90ZS9yZW5kZXJlci9pbmRleC5qcyIsICJtYWluLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmV4cG9ydHMuQ2FsbGJhY2tzUmVnaXN0cnkgPSB2b2lkIDA7XG5jbGFzcyBDYWxsYmFja3NSZWdpc3RyeSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubmV4dElkID0gMDtcbiAgICAgICAgdGhpcy5jYWxsYmFja3MgPSB7fTtcbiAgICAgICAgdGhpcy5jYWxsYmFja0lkcyA9IG5ldyBXZWFrTWFwKCk7XG4gICAgICAgIHRoaXMubG9jYXRpb25JbmZvID0gbmV3IFdlYWtNYXAoKTtcbiAgICB9XG4gICAgYWRkKGNhbGxiYWNrKSB7XG4gICAgICAgIC8vIFRoZSBjYWxsYmFjayBpcyBhbHJlYWR5IGFkZGVkLlxuICAgICAgICBsZXQgaWQgPSB0aGlzLmNhbGxiYWNrSWRzLmdldChjYWxsYmFjayk7XG4gICAgICAgIGlmIChpZCAhPSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgICBpZCA9IHRoaXMubmV4dElkICs9IDE7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tzW2lkXSA9IGNhbGxiYWNrO1xuICAgICAgICB0aGlzLmNhbGxiYWNrSWRzLnNldChjYWxsYmFjaywgaWQpO1xuICAgICAgICAvLyBDYXB0dXJlIHRoZSBsb2NhdGlvbiBvZiB0aGUgZnVuY3Rpb24gYW5kIHB1dCBpdCBpbiB0aGUgSUQgc3RyaW5nLFxuICAgICAgICAvLyBzbyB0aGF0IHJlbGVhc2UgZXJyb3JzIGNhbiBiZSB0cmFja2VkIGRvd24gZWFzaWx5LlxuICAgICAgICBjb25zdCByZWdleHAgPSAvYXQgKC4qKS9naTtcbiAgICAgICAgY29uc3Qgc3RhY2tTdHJpbmcgPSAobmV3IEVycm9yKCkpLnN0YWNrO1xuICAgICAgICBpZiAoIXN0YWNrU3RyaW5nKVxuICAgICAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgICBsZXQgZmlsZW5hbWVBbmRMaW5lO1xuICAgICAgICBsZXQgbWF0Y2g7XG4gICAgICAgIHdoaWxlICgobWF0Y2ggPSByZWdleHAuZXhlYyhzdGFja1N0cmluZykpICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBsb2NhdGlvbiA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgaWYgKGxvY2F0aW9uLmluY2x1ZGVzKCcobmF0aXZlKScpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGxvY2F0aW9uLmluY2x1ZGVzKCcoPGFub255bW91cz4pJykpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAobG9jYXRpb24uaW5jbHVkZXMoJ2NhbGxiYWNrcy1yZWdpc3RyeS5qcycpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGxvY2F0aW9uLmluY2x1ZGVzKCdyZW1vdGUuanMnKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChsb2NhdGlvbi5pbmNsdWRlcygnQGVsZWN0cm9uL3JlbW90ZS9kaXN0JykpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCByZWYgPSAvKFteL14pXSopXFwpPyQvZ2kuZXhlYyhsb2NhdGlvbik7XG4gICAgICAgICAgICBpZiAocmVmKVxuICAgICAgICAgICAgICAgIGZpbGVuYW1lQW5kTGluZSA9IHJlZlsxXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubG9jYXRpb25JbmZvLnNldChjYWxsYmFjaywgZmlsZW5hbWVBbmRMaW5lKTtcbiAgICAgICAgcmV0dXJuIGlkO1xuICAgIH1cbiAgICBnZXQoaWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FsbGJhY2tzW2lkXSB8fCBmdW5jdGlvbiAoKSB7IH07XG4gICAgfVxuICAgIGdldExvY2F0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2F0aW9uSW5mby5nZXQoY2FsbGJhY2spO1xuICAgIH1cbiAgICBhcHBseShpZCwgLi4uYXJncykge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoaWQpLmFwcGx5KGdsb2JhbCwgLi4uYXJncyk7XG4gICAgfVxuICAgIHJlbW92ZShpZCkge1xuICAgICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMuY2FsbGJhY2tzW2lkXTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrSWRzLmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5jYWxsYmFja3NbaWRdO1xuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0cy5DYWxsYmFja3NSZWdpc3RyeSA9IENhbGxiYWNrc1JlZ2lzdHJ5O1xuIiwgIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5kZXNlcmlhbGl6ZSA9IGV4cG9ydHMuc2VyaWFsaXplID0gZXhwb3J0cy5pc1NlcmlhbGl6YWJsZU9iamVjdCA9IGV4cG9ydHMuaXNQcm9taXNlID0gdm9pZCAwO1xuY29uc3QgZWxlY3Ryb25fMSA9IHJlcXVpcmUoXCJlbGVjdHJvblwiKTtcbmZ1bmN0aW9uIGlzUHJvbWlzZSh2YWwpIHtcbiAgICByZXR1cm4gKHZhbCAmJlxuICAgICAgICB2YWwudGhlbiAmJlxuICAgICAgICB2YWwudGhlbiBpbnN0YW5jZW9mIEZ1bmN0aW9uICYmXG4gICAgICAgIHZhbC5jb25zdHJ1Y3RvciAmJlxuICAgICAgICB2YWwuY29uc3RydWN0b3IucmVqZWN0ICYmXG4gICAgICAgIHZhbC5jb25zdHJ1Y3Rvci5yZWplY3QgaW5zdGFuY2VvZiBGdW5jdGlvbiAmJlxuICAgICAgICB2YWwuY29uc3RydWN0b3IucmVzb2x2ZSAmJlxuICAgICAgICB2YWwuY29uc3RydWN0b3IucmVzb2x2ZSBpbnN0YW5jZW9mIEZ1bmN0aW9uKTtcbn1cbmV4cG9ydHMuaXNQcm9taXNlID0gaXNQcm9taXNlO1xuY29uc3Qgc2VyaWFsaXphYmxlVHlwZXMgPSBbXG4gICAgQm9vbGVhbixcbiAgICBOdW1iZXIsXG4gICAgU3RyaW5nLFxuICAgIERhdGUsXG4gICAgRXJyb3IsXG4gICAgUmVnRXhwLFxuICAgIEFycmF5QnVmZmVyXG5dO1xuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYl9Xb3JrZXJzX0FQSS9TdHJ1Y3R1cmVkX2Nsb25lX2FsZ29yaXRobSNTdXBwb3J0ZWRfdHlwZXNcbmZ1bmN0aW9uIGlzU2VyaWFsaXphYmxlT2JqZWN0KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSBudWxsIHx8IEFycmF5QnVmZmVyLmlzVmlldyh2YWx1ZSkgfHwgc2VyaWFsaXphYmxlVHlwZXMuc29tZSh0eXBlID0+IHZhbHVlIGluc3RhbmNlb2YgdHlwZSk7XG59XG5leHBvcnRzLmlzU2VyaWFsaXphYmxlT2JqZWN0ID0gaXNTZXJpYWxpemFibGVPYmplY3Q7XG5jb25zdCBvYmplY3RNYXAgPSBmdW5jdGlvbiAoc291cmNlLCBtYXBwZXIpIHtcbiAgICBjb25zdCBzb3VyY2VFbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoc291cmNlKTtcbiAgICBjb25zdCB0YXJnZXRFbnRyaWVzID0gc291cmNlRW50cmllcy5tYXAoKFtrZXksIHZhbF0pID0+IFtrZXksIG1hcHBlcih2YWwpXSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyh0YXJnZXRFbnRyaWVzKTtcbn07XG5mdW5jdGlvbiBzZXJpYWxpemVOYXRpdmVJbWFnZShpbWFnZSkge1xuICAgIGNvbnN0IHJlcHJlc2VudGF0aW9ucyA9IFtdO1xuICAgIGNvbnN0IHNjYWxlRmFjdG9ycyA9IGltYWdlLmdldFNjYWxlRmFjdG9ycygpO1xuICAgIC8vIFVzZSBCdWZmZXIgd2hlbiB0aGVyZSdzIG9ubHkgb25lIHJlcHJlc2VudGF0aW9uIGZvciBiZXR0ZXIgcGVyZi5cbiAgICAvLyBUaGlzIGF2b2lkcyBjb21wcmVzc2luZyB0by9mcm9tIFBORyB3aGVyZSBpdCdzIG5vdCBuZWNlc3NhcnkgdG9cbiAgICAvLyBlbnN1cmUgdW5pcXVlbmVzcyBvZiBkYXRhVVJMcyAoc2luY2UgdGhlcmUncyBvbmx5IG9uZSkuXG4gICAgaWYgKHNjYWxlRmFjdG9ycy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgY29uc3Qgc2NhbGVGYWN0b3IgPSBzY2FsZUZhY3RvcnNbMF07XG4gICAgICAgIGNvbnN0IHNpemUgPSBpbWFnZS5nZXRTaXplKHNjYWxlRmFjdG9yKTtcbiAgICAgICAgY29uc3QgYnVmZmVyID0gaW1hZ2UudG9CaXRtYXAoeyBzY2FsZUZhY3RvciB9KTtcbiAgICAgICAgcmVwcmVzZW50YXRpb25zLnB1c2goeyBzY2FsZUZhY3Rvciwgc2l6ZSwgYnVmZmVyIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgLy8gQ29uc3RydWN0IGZyb20gZGF0YVVSTHMgdG8gZW5zdXJlIHRoYXQgdGhleSBhcmUgbm90IGxvc3QgaW4gY3JlYXRpb24uXG4gICAgICAgIGZvciAoY29uc3Qgc2NhbGVGYWN0b3Igb2Ygc2NhbGVGYWN0b3JzKSB7XG4gICAgICAgICAgICBjb25zdCBzaXplID0gaW1hZ2UuZ2V0U2l6ZShzY2FsZUZhY3Rvcik7XG4gICAgICAgICAgICBjb25zdCBkYXRhVVJMID0gaW1hZ2UudG9EYXRhVVJMKHsgc2NhbGVGYWN0b3IgfSk7XG4gICAgICAgICAgICByZXByZXNlbnRhdGlvbnMucHVzaCh7IHNjYWxlRmFjdG9yLCBzaXplLCBkYXRhVVJMIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IF9fRUxFQ1RST05fU0VSSUFMSVpFRF9OYXRpdmVJbWFnZV9fOiB0cnVlLCByZXByZXNlbnRhdGlvbnMgfTtcbn1cbmZ1bmN0aW9uIGRlc2VyaWFsaXplTmF0aXZlSW1hZ2UodmFsdWUpIHtcbiAgICBjb25zdCBpbWFnZSA9IGVsZWN0cm9uXzEubmF0aXZlSW1hZ2UuY3JlYXRlRW1wdHkoKTtcbiAgICAvLyBVc2UgQnVmZmVyIHdoZW4gdGhlcmUncyBvbmx5IG9uZSByZXByZXNlbnRhdGlvbiBmb3IgYmV0dGVyIHBlcmYuXG4gICAgLy8gVGhpcyBhdm9pZHMgY29tcHJlc3NpbmcgdG8vZnJvbSBQTkcgd2hlcmUgaXQncyBub3QgbmVjZXNzYXJ5IHRvXG4gICAgLy8gZW5zdXJlIHVuaXF1ZW5lc3Mgb2YgZGF0YVVSTHMgKHNpbmNlIHRoZXJlJ3Mgb25seSBvbmUpLlxuICAgIGlmICh2YWx1ZS5yZXByZXNlbnRhdGlvbnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGNvbnN0IHsgYnVmZmVyLCBzaXplLCBzY2FsZUZhY3RvciB9ID0gdmFsdWUucmVwcmVzZW50YXRpb25zWzBdO1xuICAgICAgICBjb25zdCB7IHdpZHRoLCBoZWlnaHQgfSA9IHNpemU7XG4gICAgICAgIGltYWdlLmFkZFJlcHJlc2VudGF0aW9uKHsgYnVmZmVyLCBzY2FsZUZhY3Rvciwgd2lkdGgsIGhlaWdodCB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIC8vIENvbnN0cnVjdCBmcm9tIGRhdGFVUkxzIHRvIGVuc3VyZSB0aGF0IHRoZXkgYXJlIG5vdCBsb3N0IGluIGNyZWF0aW9uLlxuICAgICAgICBmb3IgKGNvbnN0IHJlcCBvZiB2YWx1ZS5yZXByZXNlbnRhdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGF0YVVSTCwgc2l6ZSwgc2NhbGVGYWN0b3IgfSA9IHJlcDtcbiAgICAgICAgICAgIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gc2l6ZTtcbiAgICAgICAgICAgIGltYWdlLmFkZFJlcHJlc2VudGF0aW9uKHsgZGF0YVVSTCwgc2NhbGVGYWN0b3IsIHdpZHRoLCBoZWlnaHQgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGltYWdlO1xufVxuZnVuY3Rpb24gc2VyaWFsaXplKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlICYmIHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdOYXRpdmVJbWFnZScpIHtcbiAgICAgICAgcmV0dXJuIHNlcmlhbGl6ZU5hdGl2ZUltYWdlKHZhbHVlKTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZS5tYXAoc2VyaWFsaXplKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNTZXJpYWxpemFibGVPYmplY3QodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBPYmplY3QpIHtcbiAgICAgICAgcmV0dXJuIG9iamVjdE1hcCh2YWx1ZSwgc2VyaWFsaXplKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG59XG5leHBvcnRzLnNlcmlhbGl6ZSA9IHNlcmlhbGl6ZTtcbmZ1bmN0aW9uIGRlc2VyaWFsaXplKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlICYmIHZhbHVlLl9fRUxFQ1RST05fU0VSSUFMSVpFRF9OYXRpdmVJbWFnZV9fKSB7XG4gICAgICAgIHJldHVybiBkZXNlcmlhbGl6ZU5hdGl2ZUltYWdlKHZhbHVlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLm1hcChkZXNlcmlhbGl6ZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzU2VyaWFsaXphYmxlT2JqZWN0KHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICAgIHJldHVybiBvYmplY3RNYXAodmFsdWUsIGRlc2VyaWFsaXplKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG59XG5leHBvcnRzLmRlc2VyaWFsaXplID0gZGVzZXJpYWxpemU7XG4iLCAiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5leHBvcnRzLmdldEVsZWN0cm9uQmluZGluZyA9IHZvaWQgMDtcbmNvbnN0IGdldEVsZWN0cm9uQmluZGluZyA9IChuYW1lKSA9PiB7XG4gICAgaWYgKHByb2Nlc3MuX2xpbmtlZEJpbmRpbmcpIHtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuX2xpbmtlZEJpbmRpbmcoJ2VsZWN0cm9uX2NvbW1vbl8nICsgbmFtZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHByb2Nlc3MuZWxlY3Ryb25CaW5kaW5nKSB7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVsZWN0cm9uQmluZGluZyhuYW1lKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn07XG5leHBvcnRzLmdldEVsZWN0cm9uQmluZGluZyA9IGdldEVsZWN0cm9uQmluZGluZztcbiIsICJcInVzZSBzdHJpY3RcIjtcbnZhciBfYSwgX2I7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5leHBvcnRzLmJyb3dzZXJNb2R1bGVOYW1lcyA9IGV4cG9ydHMuY29tbW9uTW9kdWxlTmFtZXMgPSB2b2lkIDA7XG5jb25zdCBnZXRfZWxlY3Ryb25fYmluZGluZ18xID0gcmVxdWlyZShcIi4vZ2V0LWVsZWN0cm9uLWJpbmRpbmdcIik7XG5leHBvcnRzLmNvbW1vbk1vZHVsZU5hbWVzID0gW1xuICAgICdjbGlwYm9hcmQnLFxuICAgICduYXRpdmVJbWFnZScsXG4gICAgJ3NoZWxsJyxcbl07XG5leHBvcnRzLmJyb3dzZXJNb2R1bGVOYW1lcyA9IFtcbiAgICAnYXBwJyxcbiAgICAnYXV0b1VwZGF0ZXInLFxuICAgICdCYXNlV2luZG93JyxcbiAgICAnQnJvd3NlclZpZXcnLFxuICAgICdCcm93c2VyV2luZG93JyxcbiAgICAnY29udGVudFRyYWNpbmcnLFxuICAgICdjcmFzaFJlcG9ydGVyJyxcbiAgICAnZGlhbG9nJyxcbiAgICAnZ2xvYmFsU2hvcnRjdXQnLFxuICAgICdpcGNNYWluJyxcbiAgICAnaW5BcHBQdXJjaGFzZScsXG4gICAgJ01lbnUnLFxuICAgICdNZW51SXRlbScsXG4gICAgJ25hdGl2ZVRoZW1lJyxcbiAgICAnbmV0JyxcbiAgICAnbmV0TG9nJyxcbiAgICAnTWVzc2FnZUNoYW5uZWxNYWluJyxcbiAgICAnTm90aWZpY2F0aW9uJyxcbiAgICAncG93ZXJNb25pdG9yJyxcbiAgICAncG93ZXJTYXZlQmxvY2tlcicsXG4gICAgJ3Byb3RvY29sJyxcbiAgICAncHVzaE5vdGlmaWNhdGlvbnMnLFxuICAgICdzYWZlU3RvcmFnZScsXG4gICAgJ3NjcmVlbicsXG4gICAgJ3Nlc3Npb24nLFxuICAgICdTZXJ2aWNlV29ya2VyTWFpbicsXG4gICAgJ1NoYXJlTWVudScsXG4gICAgJ3N5c3RlbVByZWZlcmVuY2VzJyxcbiAgICAnVG9wTGV2ZWxXaW5kb3cnLFxuICAgICdUb3VjaEJhcicsXG4gICAgJ1RyYXknLFxuICAgICd1dGlsaXR5UHJvY2VzcycsXG4gICAgJ1ZpZXcnLFxuICAgICd3ZWJDb250ZW50cycsXG4gICAgJ1dlYkNvbnRlbnRzVmlldycsXG4gICAgJ3dlYkZyYW1lTWFpbicsXG5dLmNvbmNhdChleHBvcnRzLmNvbW1vbk1vZHVsZU5hbWVzKTtcbmNvbnN0IGZlYXR1cmVzID0gZ2V0X2VsZWN0cm9uX2JpbmRpbmdfMS5nZXRFbGVjdHJvbkJpbmRpbmcoJ2ZlYXR1cmVzJyk7XG5pZiAoKChfYSA9IGZlYXR1cmVzID09PSBudWxsIHx8IGZlYXR1cmVzID09PSB2b2lkIDAgPyB2b2lkIDAgOiBmZWF0dXJlcy5pc0Rlc2t0b3BDYXB0dXJlckVuYWJsZWQpID09PSBudWxsIHx8IF9hID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfYS5jYWxsKGZlYXR1cmVzKSkgIT09IGZhbHNlKSB7XG4gICAgZXhwb3J0cy5icm93c2VyTW9kdWxlTmFtZXMucHVzaCgnZGVza3RvcENhcHR1cmVyJyk7XG59XG5pZiAoKChfYiA9IGZlYXR1cmVzID09PSBudWxsIHx8IGZlYXR1cmVzID09PSB2b2lkIDAgPyB2b2lkIDAgOiBmZWF0dXJlcy5pc1ZpZXdBcGlFbmFibGVkKSA9PT0gbnVsbCB8fCBfYiA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2IuY2FsbChmZWF0dXJlcykpICE9PSBmYWxzZSkge1xuICAgIGV4cG9ydHMuYnJvd3Nlck1vZHVsZU5hbWVzLnB1c2goJ0ltYWdlVmlldycpO1xufVxuIiwgIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5jcmVhdGVGdW5jdGlvbldpdGhSZXR1cm5WYWx1ZSA9IGV4cG9ydHMuZ2V0R2xvYmFsID0gZXhwb3J0cy5nZXRDdXJyZW50V2ViQ29udGVudHMgPSBleHBvcnRzLmdldEN1cnJlbnRXaW5kb3cgPSBleHBvcnRzLmdldEJ1aWx0aW4gPSB2b2lkIDA7XG5jb25zdCBjYWxsYmFja3NfcmVnaXN0cnlfMSA9IHJlcXVpcmUoXCIuL2NhbGxiYWNrcy1yZWdpc3RyeVwiKTtcbmNvbnN0IHR5cGVfdXRpbHNfMSA9IHJlcXVpcmUoXCIuLi9jb21tb24vdHlwZS11dGlsc1wiKTtcbmNvbnN0IGVsZWN0cm9uXzEgPSByZXF1aXJlKFwiZWxlY3Ryb25cIik7XG5jb25zdCBtb2R1bGVfbmFtZXNfMSA9IHJlcXVpcmUoXCIuLi9jb21tb24vbW9kdWxlLW5hbWVzXCIpO1xuY29uc3QgZ2V0X2VsZWN0cm9uX2JpbmRpbmdfMSA9IHJlcXVpcmUoXCIuLi9jb21tb24vZ2V0LWVsZWN0cm9uLWJpbmRpbmdcIik7XG5jb25zdCB7IFByb21pc2UgfSA9IGdsb2JhbDtcbmNvbnN0IGNhbGxiYWNrc1JlZ2lzdHJ5ID0gbmV3IGNhbGxiYWNrc19yZWdpc3RyeV8xLkNhbGxiYWNrc1JlZ2lzdHJ5KCk7XG5jb25zdCByZW1vdGVPYmplY3RDYWNoZSA9IG5ldyBNYXAoKTtcbmNvbnN0IGZpbmFsaXphdGlvblJlZ2lzdHJ5ID0gbmV3IEZpbmFsaXphdGlvblJlZ2lzdHJ5KChpZCkgPT4ge1xuICAgIGNvbnN0IHJlZiA9IHJlbW90ZU9iamVjdENhY2hlLmdldChpZCk7XG4gICAgaWYgKHJlZiAhPT0gdW5kZWZpbmVkICYmIHJlZi5kZXJlZigpID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVtb3RlT2JqZWN0Q2FjaGUuZGVsZXRlKGlkKTtcbiAgICAgICAgZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5zZW5kKFwiUkVNT1RFX0JST1dTRVJfREVSRUZFUkVOQ0VcIiAvKiBCUk9XU0VSX0RFUkVGRVJFTkNFICovLCBjb250ZXh0SWQsIGlkLCAwKTtcbiAgICB9XG59KTtcbmNvbnN0IGVsZWN0cm9uSWRzID0gbmV3IFdlYWtNYXAoKTtcbmNvbnN0IGlzUmV0dXJuVmFsdWUgPSBuZXcgV2Vha1NldCgpO1xuZnVuY3Rpb24gZ2V0Q2FjaGVkUmVtb3RlT2JqZWN0KGlkKSB7XG4gICAgY29uc3QgcmVmID0gcmVtb3RlT2JqZWN0Q2FjaGUuZ2V0KGlkKTtcbiAgICBpZiAocmVmICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZGVyZWYgPSByZWYuZGVyZWYoKTtcbiAgICAgICAgaWYgKGRlcmVmICE9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gZGVyZWY7XG4gICAgfVxufVxuZnVuY3Rpb24gc2V0Q2FjaGVkUmVtb3RlT2JqZWN0KGlkLCB2YWx1ZSkge1xuICAgIGNvbnN0IHdyID0gbmV3IFdlYWtSZWYodmFsdWUpO1xuICAgIHJlbW90ZU9iamVjdENhY2hlLnNldChpZCwgd3IpO1xuICAgIGZpbmFsaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHZhbHVlLCBpZCk7XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gZ2V0Q29udGV4dElkKCkge1xuICAgIGNvbnN0IHY4VXRpbCA9IGdldF9lbGVjdHJvbl9iaW5kaW5nXzEuZ2V0RWxlY3Ryb25CaW5kaW5nKCd2OF91dGlsJyk7XG4gICAgaWYgKHY4VXRpbCkge1xuICAgICAgICByZXR1cm4gdjhVdGlsLmdldEhpZGRlblZhbHVlKGdsb2JhbCwgJ2NvbnRleHRJZCcpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFbGVjdHJvbiA+PXYxMy4wLjAtYmV0YS42IHJlcXVpcmVkIHRvIHN1cHBvcnQgc2FuZGJveGVkIHJlbmRlcmVycycpO1xuICAgIH1cbn1cbi8vIEFuIHVuaXF1ZSBJRCB0aGF0IGNhbiByZXByZXNlbnQgY3VycmVudCBjb250ZXh0LlxuY29uc3QgY29udGV4dElkID0gcHJvY2Vzcy5jb250ZXh0SWQgfHwgZ2V0Q29udGV4dElkKCk7XG4vLyBOb3RpZnkgdGhlIG1haW4gcHJvY2VzcyB3aGVuIGN1cnJlbnQgY29udGV4dCBpcyBnb2luZyB0byBiZSByZWxlYXNlZC5cbi8vIE5vdGUgdGhhdCB3aGVuIHRoZSByZW5kZXJlciBwcm9jZXNzIGlzIGRlc3Ryb3llZCwgdGhlIG1lc3NhZ2UgbWF5IG5vdCBiZVxuLy8gc2VudCwgd2UgYWxzbyBsaXN0ZW4gdG8gdGhlIFwicmVuZGVyLXZpZXctZGVsZXRlZFwiIGV2ZW50IGluIHRoZSBtYWluIHByb2Nlc3Ncbi8vIHRvIGd1YXJkIHRoYXQgc2l0dWF0aW9uLlxucHJvY2Vzcy5vbignZXhpdCcsICgpID0+IHtcbiAgICBjb25zdCBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9DT05URVhUX1JFTEVBU0VcIiAvKiBCUk9XU0VSX0NPTlRFWFRfUkVMRUFTRSAqLztcbiAgICBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmQoY29tbWFuZCwgY29udGV4dElkKTtcbn0pO1xuY29uc3QgSVNfUkVNT1RFX1BST1hZID0gU3ltYm9sKCdpcy1yZW1vdGUtcHJveHknKTtcbi8vIENvbnZlcnQgdGhlIGFyZ3VtZW50cyBvYmplY3QgaW50byBhbiBhcnJheSBvZiBtZXRhIGRhdGEuXG5mdW5jdGlvbiB3cmFwQXJncyhhcmdzLCB2aXNpdGVkID0gbmV3IFNldCgpKSB7XG4gICAgY29uc3QgdmFsdWVUb01ldGEgPSAodmFsdWUpID0+IHtcbiAgICAgICAgLy8gQ2hlY2sgZm9yIGNpcmN1bGFyIHJlZmVyZW5jZS5cbiAgICAgICAgaWYgKHZpc2l0ZWQuaGFzKHZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAndmFsdWUnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBudWxsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICh2YWx1ZSAmJiB2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lID09PSAnTmF0aXZlSW1hZ2UnKSB7XG4gICAgICAgICAgICByZXR1cm4geyB0eXBlOiAnbmF0aXZlaW1hZ2UnLCB2YWx1ZTogdHlwZV91dGlsc18xLnNlcmlhbGl6ZSh2YWx1ZSkgfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgdmlzaXRlZC5hZGQodmFsdWUpO1xuICAgICAgICAgICAgY29uc3QgbWV0YSA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgIHZhbHVlOiB3cmFwQXJncyh2YWx1ZSwgdmlzaXRlZClcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2aXNpdGVkLmRlbGV0ZSh2YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gbWV0YTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJ1ZmZlcikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYnVmZmVyJyxcbiAgICAgICAgICAgICAgICB2YWx1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlX3V0aWxzXzEuaXNTZXJpYWxpemFibGVPYmplY3QodmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd2YWx1ZScsXG4gICAgICAgICAgICAgICAgdmFsdWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgaWYgKHR5cGVfdXRpbHNfMS5pc1Byb21pc2UodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Byb21pc2UnLFxuICAgICAgICAgICAgICAgICAgICB0aGVuOiB2YWx1ZVRvTWV0YShmdW5jdGlvbiAob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChlbGVjdHJvbklkcy5oYXModmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JlbW90ZS1vYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICBpZDogZWxlY3Ryb25JZHMuZ2V0KHZhbHVlKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBtZXRhID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIG5hbWU6IHZhbHVlLmNvbnN0cnVjdG9yID8gdmFsdWUuY29uc3RydWN0b3IubmFtZSA6ICcnLFxuICAgICAgICAgICAgICAgIG1lbWJlcnM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmlzaXRlZC5hZGQodmFsdWUpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwcm9wIGluIHZhbHVlKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZ3VhcmQtZm9yLWluXG4gICAgICAgICAgICAgICAgbWV0YS5tZW1iZXJzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBwcm9wLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVUb01ldGEodmFsdWVbcHJvcF0pXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2aXNpdGVkLmRlbGV0ZSh2YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gbWV0YTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgaXNSZXR1cm5WYWx1ZS5oYXModmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdmdW5jdGlvbi13aXRoLXJldHVybi12YWx1ZScsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlVG9NZXRhKHZhbHVlKCkpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIGlkOiBjYWxsYmFja3NSZWdpc3RyeS5hZGQodmFsdWUpLFxuICAgICAgICAgICAgICAgIGxvY2F0aW9uOiBjYWxsYmFja3NSZWdpc3RyeS5nZXRMb2NhdGlvbih2YWx1ZSksXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiB2YWx1ZS5sZW5ndGhcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd2YWx1ZScsXG4gICAgICAgICAgICAgICAgdmFsdWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHJldHVybiBhcmdzLm1hcCh2YWx1ZVRvTWV0YSk7XG59XG4vLyBQb3B1bGF0ZSBvYmplY3QncyBtZW1iZXJzIGZyb20gZGVzY3JpcHRvcnMuXG4vLyBUaGUgfHJlZnwgd2lsbCBiZSBrZXB0IHJlZmVyZW5jZWQgYnkgfG1lbWJlcnN8LlxuLy8gVGhpcyBtYXRjaGVzIHxnZXRPYmplY3RNZW1lYmVyc3wgaW4gcnBjLXNlcnZlci5cbmZ1bmN0aW9uIHNldE9iamVjdE1lbWJlcnMocmVmLCBvYmplY3QsIG1ldGFJZCwgbWVtYmVycykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShtZW1iZXJzKSlcbiAgICAgICAgcmV0dXJuO1xuICAgIGZvciAoY29uc3QgbWVtYmVyIG9mIG1lbWJlcnMpIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIG1lbWJlci5uYW1lKSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBkZXNjcmlwdG9yID0geyBlbnVtZXJhYmxlOiBtZW1iZXIuZW51bWVyYWJsZSB9O1xuICAgICAgICBpZiAobWVtYmVyLnR5cGUgPT09ICdtZXRob2QnKSB7XG4gICAgICAgICAgICBjb25zdCByZW1vdGVNZW1iZXJGdW5jdGlvbiA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAgICAgbGV0IGNvbW1hbmQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMgJiYgdGhpcy5jb25zdHJ1Y3RvciA9PT0gcmVtb3RlTWVtYmVyRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfTUVNQkVSX0NPTlNUUlVDVE9SXCIgLyogQlJPV1NFUl9NRU1CRVJfQ09OU1RSVUNUT1IgKi87XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9NRU1CRVJfQ0FMTFwiIC8qIEJST1dTRVJfTUVNQkVSX0NBTEwgKi87XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHJldCA9IGVsZWN0cm9uXzEuaXBjUmVuZGVyZXIuc2VuZFN5bmMoY29tbWFuZCwgY29udGV4dElkLCBtZXRhSWQsIG1lbWJlci5uYW1lLCB3cmFwQXJncyhhcmdzKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1ldGFUb1ZhbHVlKHJldCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbGV0IGRlc2NyaXB0b3JGdW5jdGlvbiA9IHByb3h5RnVuY3Rpb25Qcm9wZXJ0aWVzKHJlbW90ZU1lbWJlckZ1bmN0aW9uLCBtZXRhSWQsIG1lbWJlci5uYW1lKTtcbiAgICAgICAgICAgIGRlc2NyaXB0b3IuZ2V0ID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JGdW5jdGlvbi5yZWYgPSByZWY7IC8vIFRoZSBtZW1iZXIgc2hvdWxkIHJlZmVyZW5jZSBpdHMgb2JqZWN0LlxuICAgICAgICAgICAgICAgIHJldHVybiBkZXNjcmlwdG9yRnVuY3Rpb247XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8gRW5hYmxlIG1vbmtleS1wYXRjaCB0aGUgbWV0aG9kXG4gICAgICAgICAgICBkZXNjcmlwdG9yLnNldCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JGdW5jdGlvbiA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWVtYmVyLnR5cGUgPT09ICdnZXQnKSB7XG4gICAgICAgICAgICBkZXNjcmlwdG9yLmdldCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9NRU1CRVJfR0VUXCIgLyogQlJPV1NFUl9NRU1CRVJfR0VUICovO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbWV0YUlkLCBtZW1iZXIubmFtZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1ldGFUb1ZhbHVlKG1ldGEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChtZW1iZXIud3JpdGFibGUpIHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9yLnNldCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhcmdzID0gd3JhcEFyZ3MoW3ZhbHVlXSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBcIlJFTU9URV9CUk9XU0VSX01FTUJFUl9TRVRcIiAvKiBCUk9XU0VSX01FTUJFUl9TRVQgKi87XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbWV0YUlkLCBtZW1iZXIubmFtZSwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtZXRhICE9IG51bGwpXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRhVG9WYWx1ZShtZXRhKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdCwgbWVtYmVyLm5hbWUsIGRlc2NyaXB0b3IpO1xuICAgIH1cbn1cbi8vIFBvcHVsYXRlIG9iamVjdCdzIHByb3RvdHlwZSBmcm9tIGRlc2NyaXB0b3IuXG4vLyBUaGlzIG1hdGNoZXMgfGdldE9iamVjdFByb3RvdHlwZXwgaW4gcnBjLXNlcnZlci5cbmZ1bmN0aW9uIHNldE9iamVjdFByb3RvdHlwZShyZWYsIG9iamVjdCwgbWV0YUlkLCBkZXNjcmlwdG9yKSB7XG4gICAgaWYgKGRlc2NyaXB0b3IgPT09IG51bGwpXG4gICAgICAgIHJldHVybjtcbiAgICBjb25zdCBwcm90byA9IHt9O1xuICAgIHNldE9iamVjdE1lbWJlcnMocmVmLCBwcm90bywgbWV0YUlkLCBkZXNjcmlwdG9yLm1lbWJlcnMpO1xuICAgIHNldE9iamVjdFByb3RvdHlwZShyZWYsIHByb3RvLCBtZXRhSWQsIGRlc2NyaXB0b3IucHJvdG8pO1xuICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZihvYmplY3QsIHByb3RvKTtcbn1cbi8vIFdyYXAgZnVuY3Rpb24gaW4gUHJveHkgZm9yIGFjY2Vzc2luZyByZW1vdGUgcHJvcGVydGllc1xuZnVuY3Rpb24gcHJveHlGdW5jdGlvblByb3BlcnRpZXMocmVtb3RlTWVtYmVyRnVuY3Rpb24sIG1ldGFJZCwgbmFtZSkge1xuICAgIGxldCBsb2FkZWQgPSBmYWxzZTtcbiAgICAvLyBMYXppbHkgbG9hZCBmdW5jdGlvbiBwcm9wZXJ0aWVzXG4gICAgY29uc3QgbG9hZFJlbW90ZVByb3BlcnRpZXMgPSAoKSA9PiB7XG4gICAgICAgIGlmIChsb2FkZWQpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGxvYWRlZCA9IHRydWU7XG4gICAgICAgIGNvbnN0IGNvbW1hbmQgPSBcIlJFTU9URV9CUk9XU0VSX01FTUJFUl9HRVRcIiAvKiBCUk9XU0VSX01FTUJFUl9HRVQgKi87XG4gICAgICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbWV0YUlkLCBuYW1lKTtcbiAgICAgICAgc2V0T2JqZWN0TWVtYmVycyhyZW1vdGVNZW1iZXJGdW5jdGlvbiwgcmVtb3RlTWVtYmVyRnVuY3Rpb24sIG1ldGEuaWQsIG1ldGEubWVtYmVycyk7XG4gICAgfTtcbiAgICByZXR1cm4gbmV3IFByb3h5KHJlbW90ZU1lbWJlckZ1bmN0aW9uLCB7XG4gICAgICAgIHNldDogKHRhcmdldCwgcHJvcGVydHksIHZhbHVlKSA9PiB7XG4gICAgICAgICAgICBpZiAocHJvcGVydHkgIT09ICdyZWYnKVxuICAgICAgICAgICAgICAgIGxvYWRSZW1vdGVQcm9wZXJ0aWVzKCk7XG4gICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSkgPT4ge1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSBJU19SRU1PVEVfUFJPWFkpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0YXJnZXQsIHByb3BlcnR5KSlcbiAgICAgICAgICAgICAgICBsb2FkUmVtb3RlUHJvcGVydGllcygpO1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB0YXJnZXRbcHJvcGVydHldO1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSAndG9TdHJpbmcnICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5iaW5kKHRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIG93bktleXM6ICh0YXJnZXQpID0+IHtcbiAgICAgICAgICAgIGxvYWRSZW1vdGVQcm9wZXJ0aWVzKCk7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGFyZ2V0KTtcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yOiAodGFyZ2V0LCBwcm9wZXJ0eSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBwcm9wZXJ0eSk7XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvcilcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgIGxvYWRSZW1vdGVQcm9wZXJ0aWVzKCk7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIHByb3BlcnR5KTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuLy8gQ29udmVydCBtZXRhIGRhdGEgZnJvbSBicm93c2VyIGludG8gcmVhbCB2YWx1ZS5cbmZ1bmN0aW9uIG1ldGFUb1ZhbHVlKG1ldGEpIHtcbiAgICBpZiAoIW1ldGEpXG4gICAgICAgIHJldHVybiB7fTtcbiAgICBpZiAobWV0YS50eXBlID09PSAndmFsdWUnKSB7XG4gICAgICAgIHJldHVybiBtZXRhLnZhbHVlO1xuICAgIH1cbiAgICBlbHNlIGlmIChtZXRhLnR5cGUgPT09ICdhcnJheScpIHtcbiAgICAgICAgcmV0dXJuIG1ldGEubWVtYmVycy5tYXAoKG1lbWJlcikgPT4gbWV0YVRvVmFsdWUobWVtYmVyKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKG1ldGEudHlwZSA9PT0gJ25hdGl2ZWltYWdlJykge1xuICAgICAgICByZXR1cm4gdHlwZV91dGlsc18xLmRlc2VyaWFsaXplKG1ldGEudmFsdWUpO1xuICAgIH1cbiAgICBlbHNlIGlmIChtZXRhLnR5cGUgPT09ICdidWZmZXInKSB7XG4gICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShtZXRhLnZhbHVlLmJ1ZmZlciwgbWV0YS52YWx1ZS5ieXRlT2Zmc2V0LCBtZXRhLnZhbHVlLmJ5dGVMZW5ndGgpO1xuICAgIH1cbiAgICBlbHNlIGlmIChtZXRhLnR5cGUgPT09ICdwcm9taXNlJykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHsgdGhlbjogbWV0YVRvVmFsdWUobWV0YS50aGVuKSB9KTtcbiAgICB9XG4gICAgZWxzZSBpZiAobWV0YS50eXBlID09PSAnZXJyb3InKSB7XG4gICAgICAgIHJldHVybiBtZXRhVG9FcnJvcihtZXRhKTtcbiAgICB9XG4gICAgZWxzZSBpZiAobWV0YS50eXBlID09PSAnZXhjZXB0aW9uJykge1xuICAgICAgICBpZiAobWV0YS52YWx1ZS50eXBlID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgICB0aHJvdyBtZXRhVG9FcnJvcihtZXRhLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCB2YWx1ZSB0eXBlIGluIGV4Y2VwdGlvbjogJHttZXRhLnZhbHVlLnR5cGV9YCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGxldCByZXQ7XG4gICAgICAgIGlmICgnaWQnIGluIG1ldGEpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlZCA9IGdldENhY2hlZFJlbW90ZU9iamVjdChtZXRhLmlkKTtcbiAgICAgICAgICAgIGlmIChjYWNoZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWNoZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gQSBzaGFkb3cgY2xhc3MgdG8gcmVwcmVzZW50IHRoZSByZW1vdGUgZnVuY3Rpb24gb2JqZWN0LlxuICAgICAgICBpZiAobWV0YS50eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjb25zdCByZW1vdGVGdW5jdGlvbiA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAgICAgbGV0IGNvbW1hbmQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMgJiYgdGhpcy5jb25zdHJ1Y3RvciA9PT0gcmVtb3RlRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfQ09OU1RSVUNUT1JcIiAvKiBCUk9XU0VSX0NPTlNUUlVDVE9SICovO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfRlVOQ1RJT05fQ0FMTFwiIC8qIEJST1dTRVJfRlVOQ1RJT05fQ0FMTCAqLztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqID0gZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5zZW5kU3luYyhjb21tYW5kLCBjb250ZXh0SWQsIG1ldGEuaWQsIHdyYXBBcmdzKGFyZ3MpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWV0YVRvVmFsdWUob2JqKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXQgPSByZW1vdGVGdW5jdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldCA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHNldE9iamVjdE1lbWJlcnMocmV0LCByZXQsIG1ldGEuaWQsIG1ldGEubWVtYmVycyk7XG4gICAgICAgIHNldE9iamVjdFByb3RvdHlwZShyZXQsIHJldCwgbWV0YS5pZCwgbWV0YS5wcm90byk7XG4gICAgICAgIGlmIChyZXQuY29uc3RydWN0b3IgJiYgcmV0LmNvbnN0cnVjdG9yW0lTX1JFTU9URV9QUk9YWV0pIHtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXQuY29uc3RydWN0b3IsICduYW1lJywgeyB2YWx1ZTogbWV0YS5uYW1lIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRyYWNrIGRlbGVnYXRlIG9iaidzIGxpZmV0aW1lICYgdGVsbCBicm93c2VyIHRvIGNsZWFuIHVwIHdoZW4gb2JqZWN0IGlzIEdDZWQuXG4gICAgICAgIGVsZWN0cm9uSWRzLnNldChyZXQsIG1ldGEuaWQpO1xuICAgICAgICBzZXRDYWNoZWRSZW1vdGVPYmplY3QobWV0YS5pZCwgcmV0KTtcbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG59XG5mdW5jdGlvbiBtZXRhVG9FcnJvcihtZXRhKSB7XG4gICAgY29uc3Qgb2JqID0gbWV0YS52YWx1ZTtcbiAgICBmb3IgKGNvbnN0IHsgbmFtZSwgdmFsdWUgfSBvZiBtZXRhLm1lbWJlcnMpIHtcbiAgICAgICAgb2JqW25hbWVdID0gbWV0YVRvVmFsdWUodmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xufVxuZnVuY3Rpb24gaGFzU2VuZGVySWQoaW5wdXQpIHtcbiAgICByZXR1cm4gdHlwZW9mIGlucHV0LnNlbmRlcklkID09PSBcIm51bWJlclwiO1xufVxuZnVuY3Rpb24gaGFuZGxlTWVzc2FnZShjaGFubmVsLCBoYW5kbGVyKSB7XG4gICAgZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5vbihjaGFubmVsLCAoZXZlbnQsIHBhc3NlZENvbnRleHRJZCwgaWQsIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgaWYgKGhhc1NlbmRlcklkKGV2ZW50KSkge1xuICAgICAgICAgICAgaWYgKGV2ZW50LnNlbmRlcklkICE9PSAwICYmIGV2ZW50LnNlbmRlcklkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBNZXNzYWdlICR7Y2hhbm5lbH0gc2VudCBieSB1bmV4cGVjdGVkIFdlYkNvbnRlbnRzICgke2V2ZW50LnNlbmRlcklkfSlgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhc3NlZENvbnRleHRJZCA9PT0gY29udGV4dElkKSB7XG4gICAgICAgICAgICBoYW5kbGVyKGlkLCAuLi5hcmdzKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIE1lc3NhZ2Ugc2VudCB0byBhbiB1bi1leGlzdCBjb250ZXh0LCBub3RpZnkgdGhlIGVycm9yIHRvIG1haW4gcHJvY2Vzcy5cbiAgICAgICAgICAgIGVsZWN0cm9uXzEuaXBjUmVuZGVyZXIuc2VuZChcIlJFTU9URV9CUk9XU0VSX1dST05HX0NPTlRFWFRfRVJST1JcIiAvKiBCUk9XU0VSX1dST05HX0NPTlRFWFRfRVJST1IgKi8sIGNvbnRleHRJZCwgcGFzc2VkQ29udGV4dElkLCBpZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cbmNvbnN0IGVuYWJsZVN0YWNrcyA9IHByb2Nlc3MuYXJndi5pbmNsdWRlcygnLS1lbmFibGUtYXBpLWZpbHRlcmluZy1sb2dnaW5nJyk7XG5mdW5jdGlvbiBnZXRDdXJyZW50U3RhY2soKSB7XG4gICAgY29uc3QgdGFyZ2V0ID0geyBzdGFjazogdW5kZWZpbmVkIH07XG4gICAgaWYgKGVuYWJsZVN0YWNrcykge1xuICAgICAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0YXJnZXQsIGdldEN1cnJlbnRTdGFjayk7XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQuc3RhY2s7XG59XG4vLyBCcm93c2VyIGNhbGxzIGEgY2FsbGJhY2sgaW4gcmVuZGVyZXIuXG5oYW5kbGVNZXNzYWdlKFwiUkVNT1RFX1JFTkRFUkVSX0NBTExCQUNLXCIgLyogUkVOREVSRVJfQ0FMTEJBQ0sgKi8sIChpZCwgYXJncykgPT4ge1xuICAgIGNhbGxiYWNrc1JlZ2lzdHJ5LmFwcGx5KGlkLCBtZXRhVG9WYWx1ZShhcmdzKSk7XG59KTtcbi8vIEEgY2FsbGJhY2sgaW4gYnJvd3NlciBpcyByZWxlYXNlZC5cbmhhbmRsZU1lc3NhZ2UoXCJSRU1PVEVfUkVOREVSRVJfUkVMRUFTRV9DQUxMQkFDS1wiIC8qIFJFTkRFUkVSX1JFTEVBU0VfQ0FMTEJBQ0sgKi8sIChpZCkgPT4ge1xuICAgIGNhbGxiYWNrc1JlZ2lzdHJ5LnJlbW92ZShpZCk7XG59KTtcbmV4cG9ydHMucmVxdWlyZSA9IChtb2R1bGUpID0+IHtcbiAgICBjb25zdCBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9SRVFVSVJFXCIgLyogQlJPV1NFUl9SRVFVSVJFICovO1xuICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbW9kdWxlLCBnZXRDdXJyZW50U3RhY2soKSk7XG4gICAgcmV0dXJuIG1ldGFUb1ZhbHVlKG1ldGEpO1xufTtcbi8vIEFsaWFzIHRvIHJlbW90ZS5yZXF1aXJlKCdlbGVjdHJvbicpLnh4eC5cbmZ1bmN0aW9uIGdldEJ1aWx0aW4obW9kdWxlKSB7XG4gICAgY29uc3QgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfR0VUX0JVSUxUSU5cIiAvKiBCUk9XU0VSX0dFVF9CVUlMVElOICovO1xuICAgIGNvbnN0IG1ldGEgPSBlbGVjdHJvbl8xLmlwY1JlbmRlcmVyLnNlbmRTeW5jKGNvbW1hbmQsIGNvbnRleHRJZCwgbW9kdWxlLCBnZXRDdXJyZW50U3RhY2soKSk7XG4gICAgcmV0dXJuIG1ldGFUb1ZhbHVlKG1ldGEpO1xufVxuZXhwb3J0cy5nZXRCdWlsdGluID0gZ2V0QnVpbHRpbjtcbmZ1bmN0aW9uIGdldEN1cnJlbnRXaW5kb3coKSB7XG4gICAgY29uc3QgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfR0VUX0NVUlJFTlRfV0lORE9XXCIgLyogQlJPV1NFUl9HRVRfQ1VSUkVOVF9XSU5ET1cgKi87XG4gICAgY29uc3QgbWV0YSA9IGVsZWN0cm9uXzEuaXBjUmVuZGVyZXIuc2VuZFN5bmMoY29tbWFuZCwgY29udGV4dElkLCBnZXRDdXJyZW50U3RhY2soKSk7XG4gICAgcmV0dXJuIG1ldGFUb1ZhbHVlKG1ldGEpO1xufVxuZXhwb3J0cy5nZXRDdXJyZW50V2luZG93ID0gZ2V0Q3VycmVudFdpbmRvdztcbi8vIEdldCBjdXJyZW50IFdlYkNvbnRlbnRzIG9iamVjdC5cbmZ1bmN0aW9uIGdldEN1cnJlbnRXZWJDb250ZW50cygpIHtcbiAgICBjb25zdCBjb21tYW5kID0gXCJSRU1PVEVfQlJPV1NFUl9HRVRfQ1VSUkVOVF9XRUJfQ09OVEVOVFNcIiAvKiBCUk9XU0VSX0dFVF9DVVJSRU5UX1dFQl9DT05URU5UUyAqLztcbiAgICBjb25zdCBtZXRhID0gZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5zZW5kU3luYyhjb21tYW5kLCBjb250ZXh0SWQsIGdldEN1cnJlbnRTdGFjaygpKTtcbiAgICByZXR1cm4gbWV0YVRvVmFsdWUobWV0YSk7XG59XG5leHBvcnRzLmdldEN1cnJlbnRXZWJDb250ZW50cyA9IGdldEN1cnJlbnRXZWJDb250ZW50cztcbi8vIEdldCBhIGdsb2JhbCBvYmplY3QgaW4gYnJvd3Nlci5cbmZ1bmN0aW9uIGdldEdsb2JhbChuYW1lKSB7XG4gICAgY29uc3QgY29tbWFuZCA9IFwiUkVNT1RFX0JST1dTRVJfR0VUX0dMT0JBTFwiIC8qIEJST1dTRVJfR0VUX0dMT0JBTCAqLztcbiAgICBjb25zdCBtZXRhID0gZWxlY3Ryb25fMS5pcGNSZW5kZXJlci5zZW5kU3luYyhjb21tYW5kLCBjb250ZXh0SWQsIG5hbWUsIGdldEN1cnJlbnRTdGFjaygpKTtcbiAgICByZXR1cm4gbWV0YVRvVmFsdWUobWV0YSk7XG59XG5leHBvcnRzLmdldEdsb2JhbCA9IGdldEdsb2JhbDtcbi8vIEdldCB0aGUgcHJvY2VzcyBvYmplY3QgaW4gYnJvd3Nlci5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAncHJvY2VzcycsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGdldDogKCkgPT4gZXhwb3J0cy5nZXRHbG9iYWwoJ3Byb2Nlc3MnKVxufSk7XG4vLyBDcmVhdGUgYSBmdW5jdGlvbiB0aGF0IHdpbGwgcmV0dXJuIHRoZSBzcGVjaWZpZWQgdmFsdWUgd2hlbiBjYWxsZWQgaW4gYnJvd3Nlci5cbmZ1bmN0aW9uIGNyZWF0ZUZ1bmN0aW9uV2l0aFJldHVyblZhbHVlKHJldHVyblZhbHVlKSB7XG4gICAgY29uc3QgZnVuYyA9ICgpID0+IHJldHVyblZhbHVlO1xuICAgIGlzUmV0dXJuVmFsdWUuYWRkKGZ1bmMpO1xuICAgIHJldHVybiBmdW5jO1xufVxuZXhwb3J0cy5jcmVhdGVGdW5jdGlvbldpdGhSZXR1cm5WYWx1ZSA9IGNyZWF0ZUZ1bmN0aW9uV2l0aFJldHVyblZhbHVlO1xuY29uc3QgYWRkQnVpbHRpblByb3BlcnR5ID0gKG5hbWUpID0+IHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgbmFtZSwge1xuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBnZXQ6ICgpID0+IGV4cG9ydHMuZ2V0QnVpbHRpbihuYW1lKVxuICAgIH0pO1xufTtcbm1vZHVsZV9uYW1lc18xLmJyb3dzZXJNb2R1bGVOYW1lc1xuICAgIC5mb3JFYWNoKGFkZEJ1aWx0aW5Qcm9wZXJ0eSk7XG4iLCAiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgX19jcmVhdGVCaW5kaW5nID0gKHRoaXMgJiYgdGhpcy5fX2NyZWF0ZUJpbmRpbmcpIHx8IChPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfSk7XG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XG4gICAgb1trMl0gPSBtW2tdO1xufSkpO1xudmFyIF9fZXhwb3J0U3RhciA9ICh0aGlzICYmIHRoaXMuX19leHBvcnRTdGFyKSB8fCBmdW5jdGlvbihtLCBleHBvcnRzKSB7XG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChleHBvcnRzLCBwKSkgX19jcmVhdGVCaW5kaW5nKGV4cG9ydHMsIG0sIHApO1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmlmIChwcm9jZXNzLnR5cGUgPT09ICdicm93c2VyJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFwiQGVsZWN0cm9uL3JlbW90ZVwiIGNhbm5vdCBiZSByZXF1aXJlZCBpbiB0aGUgYnJvd3NlciBwcm9jZXNzLiBJbnN0ZWFkIHJlcXVpcmUoXCJAZWxlY3Ryb24vcmVtb3RlL21haW5cIikuYCk7XG5fX2V4cG9ydFN0YXIocmVxdWlyZShcIi4vcmVtb3RlXCIpLCBleHBvcnRzKTtcbiIsICJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4uL2Rpc3Qvc3JjL3JlbmRlcmVyJylcbiIsICJpbXBvcnQgeyBNYXJrZG93blZpZXcsIE5vdGljZSwgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCBUQWJzdHJhY3RGaWxlLCBURmlsZSwgV29ya3NwYWNlTGVhZiwgc2V0SWNvbiwgc2V0VG9vbHRpcCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgQnJvd3NlcldpbmRvdywgZ2xvYmFsU2hvcnRjdXQsIHNjcmVlbiB9IGZyb20gXCJAZWxlY3Ryb24vcmVtb3RlXCI7XG5cbmNvbnN0IERFRkFVTFRfQ09MT1IgPSBcIiNmZmYzYTNcIjtcbmNvbnN0IERFRkFVTFRfV0lEVEggPSAzNjA7XG5jb25zdCBERUZBVUxUX0hFSUdIVCA9IDM2MDtcbmNvbnN0IFdJTkRPV19OQU1FX1BSRUZJWCA9IFwiZGVza3RvcC1zdGlja3ktbm90ZXM6XCI7XG5jb25zdCBMRUdBQ1lfREVGQVVMVF9HTE9CQUxfU0hPUlRDVVQgPSBcIkNvbW1hbmRPckNvbnRyb2wrQWx0K05cIjtcbmNvbnN0IERFRkFVTFRfR0xPQkFMX1NIT1JUQ1VUID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIiA/IFwiT3B0aW9uK0YxMFwiIDogXCJTdXBlcitGMTBcIjtcblxuY29uc3QgQUNDRUxFUkFUT1JfS0VZU19CWV9DT0RFOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBTcGFjZTogXCJTcGFjZVwiLFxuICBUYWI6IFwiVGFiXCIsXG4gIENhcHNMb2NrOiBcIkNhcHNsb2NrXCIsXG4gIE51bUxvY2s6IFwiTnVtbG9ja1wiLFxuICBTY3JvbGxMb2NrOiBcIlNjcm9sbGxvY2tcIixcbiAgQmFja3NwYWNlOiBcIkJhY2tzcGFjZVwiLFxuICBEZWxldGU6IFwiRGVsZXRlXCIsXG4gIEluc2VydDogXCJJbnNlcnRcIixcbiAgRW50ZXI6IFwiRW50ZXJcIixcbiAgQXJyb3dVcDogXCJVcFwiLFxuICBBcnJvd0Rvd246IFwiRG93blwiLFxuICBBcnJvd0xlZnQ6IFwiTGVmdFwiLFxuICBBcnJvd1JpZ2h0OiBcIlJpZ2h0XCIsXG4gIEhvbWU6IFwiSG9tZVwiLFxuICBFbmQ6IFwiRW5kXCIsXG4gIFBhZ2VVcDogXCJQYWdlVXBcIixcbiAgUGFnZURvd246IFwiUGFnZURvd25cIixcbiAgUHJpbnRTY3JlZW46IFwiUHJpbnRTY3JlZW5cIixcbiAgTWludXM6IFwiLVwiLFxuICBFcXVhbDogXCI9XCIsXG4gIEJyYWNrZXRMZWZ0OiBcIltcIixcbiAgQnJhY2tldFJpZ2h0OiBcIl1cIixcbiAgQmFja3NsYXNoOiBcIlxcXFxcIixcbiAgU2VtaWNvbG9uOiBcIjtcIixcbiAgUXVvdGU6IFwiXFxcIlwiLFxuICBCYWNrcXVvdGU6IFwiYFwiLFxuICBDb21tYTogXCIsXCIsXG4gIFBlcmlvZDogXCIuXCIsXG4gIFNsYXNoOiBcIi9cIixcbiAgTnVtcGFkRGVjaW1hbDogXCJudW1kZWNcIixcbiAgTnVtcGFkQWRkOiBcIm51bWFkZFwiLFxuICBOdW1wYWRTdWJ0cmFjdDogXCJudW1zdWJcIixcbiAgTnVtcGFkTXVsdGlwbHk6IFwibnVtbXVsdFwiLFxuICBOdW1wYWREaXZpZGU6IFwibnVtZGl2XCJcbn07XG5cbmZ1bmN0aW9uIGFjY2VsZXJhdG9yS2V5Rm9yRXZlbnQoZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKC9eS2V5W0EtWl0kLy50ZXN0KGV2ZW50LmNvZGUpKSByZXR1cm4gZXZlbnQuY29kZS5zbGljZSgzKTtcbiAgaWYgKC9eRGlnaXRbMC05XSQvLnRlc3QoZXZlbnQuY29kZSkpIHJldHVybiBldmVudC5jb2RlLnNsaWNlKDUpO1xuICBpZiAoL15GKD86WzEtOV18MVswLTldfDJbMC00XSkkLy50ZXN0KGV2ZW50LmNvZGUpKSByZXR1cm4gZXZlbnQuY29kZTtcbiAgaWYgKC9eTnVtcGFkWzAtOV0kLy50ZXN0KGV2ZW50LmNvZGUpKSByZXR1cm4gYG51bSR7ZXZlbnQuY29kZS5zbGljZSg2KX1gO1xuICByZXR1cm4gQUNDRUxFUkFUT1JfS0VZU19CWV9DT0RFW2V2ZW50LmNvZGVdID8/IG51bGw7XG59XG5cbmZ1bmN0aW9uIGFjY2VsZXJhdG9yRm9yRXZlbnQoZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3Qga2V5ID0gYWNjZWxlcmF0b3JLZXlGb3JFdmVudChldmVudCk7XG4gIGlmICgha2V5KSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBtb2RpZmllcnM6IHN0cmluZ1tdID0gW107XG4gIGlmIChldmVudC5nZXRNb2RpZmllclN0YXRlKFwiQWx0R3JhcGhcIikpIHtcbiAgICBtb2RpZmllcnMucHVzaChcIkFsdEdyXCIpO1xuICB9IGVsc2Uge1xuICAgIGlmIChldmVudC5tZXRhS2V5KSBtb2RpZmllcnMucHVzaChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiID8gXCJDb21tYW5kXCIgOiBcIlN1cGVyXCIpO1xuICAgIGlmIChldmVudC5jdHJsS2V5KSBtb2RpZmllcnMucHVzaChcIkNvbnRyb2xcIik7XG4gICAgaWYgKGV2ZW50LmFsdEtleSkgbW9kaWZpZXJzLnB1c2goXCJBbHRcIik7XG4gIH1cbiAgaWYgKGV2ZW50LnNoaWZ0S2V5KSBtb2RpZmllcnMucHVzaChcIlNoaWZ0XCIpO1xuICByZXR1cm4gWy4uLm1vZGlmaWVycywga2V5XS5qb2luKFwiK1wiKTtcbn1cblxuZnVuY3Rpb24gZGlzcGxheUFjY2VsZXJhdG9yKGFjY2VsZXJhdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIWFjY2VsZXJhdG9yKSByZXR1cm4gXCJEaXNhYmxlZFwiO1xuICBjb25zdCBsYWJlbHMgPSBhY2NlbGVyYXRvci5zcGxpdChcIitcIikubWFwKChwYXJ0KSA9PiB7XG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIpIHtcbiAgICAgIGlmIChbXCJDb21tYW5kXCIsIFwiQ21kXCIsIFwiQ29tbWFuZE9yQ29udHJvbFwiLCBcIkNtZE9yQ3RybFwiLCBcIlN1cGVyXCIsIFwiTWV0YVwiXS5pbmNsdWRlcyhwYXJ0KSkgcmV0dXJuIFwiXHUyMzE4XCI7XG4gICAgICBpZiAoW1wiQ29udHJvbFwiLCBcIkN0cmxcIl0uaW5jbHVkZXMocGFydCkpIHJldHVybiBcIlx1MjMwM1wiO1xuICAgICAgaWYgKFtcIkFsdFwiLCBcIk9wdGlvblwiXS5pbmNsdWRlcyhwYXJ0KSkgcmV0dXJuIFwiXHUyMzI1XCI7XG4gICAgICBpZiAocGFydCA9PT0gXCJTaGlmdFwiKSByZXR1cm4gXCJcdTIxRTdcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKFtcIlN1cGVyXCIsIFwiTWV0YVwiXS5pbmNsdWRlcyhwYXJ0KSkgcmV0dXJuIFwiV2luXCI7XG4gICAgICBpZiAoW1wiQ29udHJvbFwiLCBcIkN0cmxcIiwgXCJDb21tYW5kT3JDb250cm9sXCIsIFwiQ21kT3JDdHJsXCJdLmluY2x1ZGVzKHBhcnQpKSByZXR1cm4gXCJDdHJsXCI7XG4gICAgfVxuICAgIHJldHVybiBwYXJ0ID09PSBcIlBsdXNcIiA/IFwiK1wiIDogcGFydDtcbiAgfSk7XG4gIHJldHVybiBsYWJlbHMuam9pbihwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiID8gXCIgXCIgOiBcIiArIFwiKTtcbn1cblxuaW50ZXJmYWNlIFN0aWNreU5vdGVTZXR0aW5ncyB7XG4gIGRlZmF1bHRGb2xkZXI6IHN0cmluZztcbiAgZGVmYXVsdE5vdGVDb2xvcjogc3RyaW5nO1xuICBnbG9iYWxUb2dnbGVTaG9ydGN1dDogc3RyaW5nO1xuICB0b3BMZXZlbE5vdGVQYXRoOiBzdHJpbmcgfCBudWxsO1xuICB0b3BMZXZlbFdpbmRvd1Bvc2l0aW9uOiBXaW5kb3dQb3NpdGlvbiB8IG51bGw7XG4gIGNvbG9yc0J5UGF0aDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbn1cblxuaW50ZXJmYWNlIFdpbmRvd1Bvc2l0aW9uIHtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFN0aWNreU5vdGVTZXR0aW5ncyA9IHtcbiAgZGVmYXVsdEZvbGRlcjogXCJcIixcbiAgZGVmYXVsdE5vdGVDb2xvcjogREVGQVVMVF9DT0xPUixcbiAgZ2xvYmFsVG9nZ2xlU2hvcnRjdXQ6IERFRkFVTFRfR0xPQkFMX1NIT1JUQ1VULFxuICB0b3BMZXZlbE5vdGVQYXRoOiBudWxsLFxuICB0b3BMZXZlbFdpbmRvd1Bvc2l0aW9uOiBudWxsLFxuICBjb2xvcnNCeVBhdGg6IHt9XG59O1xuXG5pbnRlcmZhY2UgU3RpY2t5Tm90ZVdpbmRvdyB7XG4gIGZpbGU6IFRGaWxlO1xuICBsZWFmOiBXb3Jrc3BhY2VMZWFmO1xuICBkb2N1bWVudDogRG9jdW1lbnQ7XG4gIHdpbmRvdzogTmF0aXZlQnJvd3NlcldpbmRvdztcbiAgb2JzZXJ2ZXI/OiBNdXRhdGlvbk9ic2VydmVyO1xufVxuXG5pbnRlcmZhY2UgTmF0aXZlQnJvd3NlcldpbmRvdyB7XG4gIHNldFJlc2l6YWJsZShyZXNpemFibGU6IGJvb2xlYW4pOiB2b2lkO1xuICBzZXRBbHdheXNPblRvcChhbHdheXNPblRvcDogYm9vbGVhbik6IHZvaWQ7XG4gIGlzQWx3YXlzT25Ub3AoKTogYm9vbGVhbjtcbiAgc2V0VGl0bGUodGl0bGU6IHN0cmluZyk6IHZvaWQ7XG4gIGdldFRpdGxlKCk6IHN0cmluZztcbiAgaXNEZXN0cm95ZWQoKTogYm9vbGVhbjtcbiAgaXNGb2N1c2VkKCk6IGJvb2xlYW47XG4gIGlzVmlzaWJsZSgpOiBib29sZWFuO1xuICBpc01pbmltaXplZCgpOiBib29sZWFuO1xuICBzaG93KCk6IHZvaWQ7XG4gIHJlc3RvcmUoKTogdm9pZDtcbiAgZm9jdXMoKTogdm9pZDtcbiAgbW92ZVRvcCgpOiB2b2lkO1xuICBzZXRQYXJlbnRXaW5kb3cocGFyZW50OiBOYXRpdmVCcm93c2VyV2luZG93IHwgbnVsbCk6IHZvaWQ7XG4gIHNldFNraXBUYXNrYmFyKHNraXA6IGJvb2xlYW4pOiB2b2lkO1xuICBjbG9zZSgpOiB2b2lkO1xuICBkZXN0cm95KCk6IHZvaWQ7XG4gIGdldFBvc2l0aW9uKCk6IFtudW1iZXIsIG51bWJlcl07XG4gIHdlYkNvbnRlbnRzOiB7XG4gICAgZXhlY3V0ZUphdmFTY3JpcHQoc291cmNlOiBzdHJpbmcpOiBQcm9taXNlPHVua25vd24+O1xuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEZXNrdG9wU3RpY2t5Tm90ZXNQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogU3RpY2t5Tm90ZVNldHRpbmdzID0gREVGQVVMVF9TRVRUSU5HUztcbiAgcHJpdmF0ZSBub3Rlc0J5UGF0aCA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8U3RpY2t5Tm90ZVdpbmRvdz4+KCk7XG4gIHByaXZhdGUgaW5pdGlhbGl6ZWRMZWF2ZXMgPSBuZXcgV2Vha1NldDxXb3Jrc3BhY2VMZWFmPigpO1xuICBwcml2YXRlIHJlZ2lzdGVyZWRHbG9iYWxTaG9ydGN1dDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgc2hvcnRjdXRSZWdpc3RyYXRpb25UaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgdG9nZ2xlSW5Qcm9ncmVzcyA9IGZhbHNlO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIGF3YWl0IHRoaXMuY2xvc2VTdGFsZVN0aWNreVdpbmRvd3MoKTtcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IERlc2t0b3BTdGlja3lOb3Rlc1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICB0aGlzLnJlZ2lzdGVyQ29tbWFuZHMoKTtcbiAgICB0aGlzLnJlZ2lzdGVyRmlsZUxpZmVjeWNsZSgpO1xuICAgIHRoaXMucmVnaXN0ZXJDb250ZXh0TWVudSgpO1xuICAgIHRoaXMucmVnaXN0ZXJHbG9iYWxUb2dnbGVTaG9ydGN1dCgpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJhY3RpdmUtbGVhZi1jaGFuZ2VcIiwgKCkgPT4gdGhpcy5zY2hlZHVsZVJlZnJlc2hBbGxOb3RlcygpKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImxheW91dC1jaGFuZ2VcIiwgKCkgPT4gdGhpcy5zY2hlZHVsZVJlZnJlc2hBbGxOb3RlcygpKSk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zaG9ydGN1dFJlZ2lzdHJhdGlvblRpbWVyICE9PSBudWxsKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2hvcnRjdXRSZWdpc3RyYXRpb25UaW1lcik7XG4gICAgdGhpcy51bnJlZ2lzdGVyR2xvYmFsVG9nZ2xlU2hvcnRjdXQoKTtcbiAgICBmb3IgKGNvbnN0IG5vdGUgb2YgWy4uLnRoaXMuYWxsTm90ZXMoKV0pIHtcbiAgICAgIHRoaXMucmVtZW1iZXJUb3BMZXZlbFBvc2l0aW9uKG5vdGUpO1xuICAgICAgbm90ZS5vYnNlcnZlcj8uZGlzY29ubmVjdCgpO1xuICAgICAgbm90ZS5sZWFmLmRldGFjaCgpO1xuICAgICAgdGhpcy5mb3JjZUNsb3NlV2luZG93KG5vdGUud2luZG93KTtcbiAgICB9XG4gICAgdGhpcy5ub3Rlc0J5UGF0aC5jbGVhcigpO1xuICAgIHZvaWQgdGhpcy5hcHAud29ya3NwYWNlLnJlcXVlc3RTYXZlTGF5b3V0KCk7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc3RvcmVkID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpIGFzIFBhcnRpYWw8U3RpY2t5Tm90ZVNldHRpbmdzPiAmIHsgb3Blbk5vdGVQYXRocz86IHVua25vd24gfTtcbiAgICBkZWxldGUgc3RvcmVkLm9wZW5Ob3RlUGF0aHM7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIHN0b3JlZCk7XG4gICAgaWYgKHN0b3JlZC5nbG9iYWxUb2dnbGVTaG9ydGN1dCA9PT0gTEVHQUNZX0RFRkFVTFRfR0xPQkFMX1NIT1JUQ1VUKSB7XG4gICAgICB0aGlzLnNldHRpbmdzLmdsb2JhbFRvZ2dsZVNob3J0Y3V0ID0gREVGQVVMVF9HTE9CQUxfU0hPUlRDVVQ7XG4gICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgc2NoZWR1bGVHbG9iYWxTaG9ydGN1dFJlZ2lzdHJhdGlvbigpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zaG9ydGN1dFJlZ2lzdHJhdGlvblRpbWVyICE9PSBudWxsKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2hvcnRjdXRSZWdpc3RyYXRpb25UaW1lcik7XG4gICAgdGhpcy5zaG9ydGN1dFJlZ2lzdHJhdGlvblRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5zaG9ydGN1dFJlZ2lzdHJhdGlvblRpbWVyID0gbnVsbDtcbiAgICAgIHRoaXMucmVnaXN0ZXJHbG9iYWxUb2dnbGVTaG9ydGN1dCh0cnVlKTtcbiAgICB9LCA1MDApO1xuICB9XG5cbiAgYmVnaW5HbG9iYWxTaG9ydGN1dFJlY29yZGluZygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zaG9ydGN1dFJlZ2lzdHJhdGlvblRpbWVyICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2hvcnRjdXRSZWdpc3RyYXRpb25UaW1lcik7XG4gICAgICB0aGlzLnNob3J0Y3V0UmVnaXN0cmF0aW9uVGltZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnVucmVnaXN0ZXJHbG9iYWxUb2dnbGVTaG9ydGN1dCgpO1xuICB9XG5cbiAgY2FuY2VsR2xvYmFsU2hvcnRjdXRSZWNvcmRpbmcoKTogdm9pZCB7XG4gICAgdGhpcy5yZWdpc3Rlckdsb2JhbFRvZ2dsZVNob3J0Y3V0KCk7XG4gIH1cblxuICBhc3luYyBzZXRHbG9iYWxUb2dnbGVTaG9ydGN1dChhY2NlbGVyYXRvcjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zZXR0aW5ncy5nbG9iYWxUb2dnbGVTaG9ydGN1dCA9IGFjY2VsZXJhdG9yO1xuICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgdGhpcy5yZWdpc3Rlckdsb2JhbFRvZ2dsZVNob3J0Y3V0KHRydWUpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3Rlckdsb2JhbFRvZ2dsZVNob3J0Y3V0KHNob3dSZXN1bHQgPSBmYWxzZSk6IHZvaWQge1xuICAgIHRoaXMudW5yZWdpc3Rlckdsb2JhbFRvZ2dsZVNob3J0Y3V0KCk7XG4gICAgY29uc3QgYWNjZWxlcmF0b3IgPSB0aGlzLnNldHRpbmdzLmdsb2JhbFRvZ2dsZVNob3J0Y3V0LnRyaW0oKTtcbiAgICBpZiAoIWFjY2VsZXJhdG9yKSB7XG4gICAgICBpZiAoc2hvd1Jlc3VsdCkgbmV3IE5vdGljZShcIkdsb2JhbCBzdGlja3ktbm90ZSBzaG9ydGN1dCBkaXNhYmxlZC5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlY2xhaW0gdGhpcyBjb25maWd1cmVkIGFjY2VsZXJhdG9yIGFmdGVyIGFuIE9ic2lkaWFuIHJlbmRlcmVyIHJlbG9hZCxcbiAgICAgIC8vIHdoZXJlIGFuIG9sZGVyIHJlbW90ZSBjYWxsYmFjayBjYW4gb3RoZXJ3aXNlIHJlbWFpbiByZWdpc3RlcmVkLlxuICAgICAgaWYgKGdsb2JhbFNob3J0Y3V0LmlzUmVnaXN0ZXJlZChhY2NlbGVyYXRvcikpIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoYWNjZWxlcmF0b3IpO1xuICAgICAgY29uc3QgcmVnaXN0ZXJlZCA9IGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKGFjY2VsZXJhdG9yLCAoKSA9PiB2b2lkIHRoaXMudG9nZ2xlVG9wTGV2ZWxOb3RlKCkpO1xuICAgICAgaWYgKCFyZWdpc3RlcmVkKSB7XG4gICAgICAgIG5ldyBOb3RpY2UoYENvdWxkIG5vdCByZWdpc3RlciBnbG9iYWwgc2hvcnRjdXQ6ICR7ZGlzcGxheUFjY2VsZXJhdG9yKGFjY2VsZXJhdG9yKX1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5yZWdpc3RlcmVkR2xvYmFsU2hvcnRjdXQgPSBhY2NlbGVyYXRvcjtcbiAgICAgIGlmIChzaG93UmVzdWx0KSBuZXcgTm90aWNlKGBHbG9iYWwgc3RpY2t5LW5vdGUgc2hvcnRjdXQ6ICR7ZGlzcGxheUFjY2VsZXJhdG9yKGFjY2VsZXJhdG9yKX1gKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIG5ldyBOb3RpY2UoYEludmFsaWQgZ2xvYmFsIHNob3J0Y3V0OiAke2Rpc3BsYXlBY2NlbGVyYXRvcihhY2NlbGVyYXRvcil9YCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB1bnJlZ2lzdGVyR2xvYmFsVG9nZ2xlU2hvcnRjdXQoKTogdm9pZCB7XG4gICAgY29uc3QgYWNjZWxlcmF0b3IgPSB0aGlzLnJlZ2lzdGVyZWRHbG9iYWxTaG9ydGN1dDtcbiAgICBpZiAoIWFjY2VsZXJhdG9yKSByZXR1cm47XG4gICAgaWYgKGdsb2JhbFNob3J0Y3V0LmlzUmVnaXN0ZXJlZChhY2NlbGVyYXRvcikpIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoYWNjZWxlcmF0b3IpO1xuICAgIHRoaXMucmVnaXN0ZXJlZEdsb2JhbFNob3J0Y3V0ID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJDb21tYW5kcygpOiB2b2lkIHtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiY3JlYXRlLXN0aWNreS1ub3RlXCIsXG4gICAgICBuYW1lOiBcIkNyZWF0ZSBzdGlja3kgbm90ZVwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHZvaWQgdGhpcy5jcmVhdGVTdGlja3lOb3RlKClcbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3Blbi1zdGlja3ktbm90ZVwiLFxuICAgICAgbmFtZTogXCJPcGVuIHN0aWNreSBub3RlIGZvciBjdXJyZW50IGZpbGVcIixcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZykgPT4ge1xuICAgICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgICAgaWYgKCFmaWxlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICghY2hlY2tpbmcpIHZvaWQgdGhpcy5vcGVuU3RpY2t5Tm90ZShmaWxlKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImhpZGUtc3RpY2t5LW5vdGVcIixcbiAgICAgIG5hbWU6IFwiSGlkZSBzdGlja3kgbm90ZSBmb3IgY3VycmVudCBmaWxlXCIsXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmcpID0+IHtcbiAgICAgICAgY29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgIGlmICghYWN0aXZlRmlsZSB8fCAhdGhpcy5zdGlja3lMZWF2ZXNGb3JQYXRoKGFjdGl2ZUZpbGUucGF0aCkubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICghY2hlY2tpbmcgJiYgYWN0aXZlRmlsZSkgdGhpcy5jbG9zZU5vdGVzRm9yUGF0aChhY3RpdmVGaWxlLnBhdGgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic2V0LXRvcC1sZXZlbC1zdGlja3ktbm90ZVwiLFxuICAgICAgbmFtZTogXCJTZXQgY3VycmVudCBmaWxlIGFzIHRvcC1sZXZlbCBzdGlja3kgbm90ZVwiLFxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgICAgICBpZiAoIWZpbGUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKCFjaGVja2luZykgdm9pZCB0aGlzLnNldFRvcExldmVsTm90ZShmaWxlLnBhdGgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwidG9nZ2xlLXRvcC1sZXZlbC1zdGlja3ktbm90ZVwiLFxuICAgICAgbmFtZTogXCJUb2dnbGUgdG9wLWxldmVsIHN0aWNreSBub3RlXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4gdm9pZCB0aGlzLnRvZ2dsZVRvcExldmVsTm90ZSgpXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyQ29udGV4dE1lbnUoKTogdm9pZCB7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImZpbGUtbWVudVwiLCAobWVudSwgZmlsZSkgPT4ge1xuICAgICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgICAgbWVudS5hZGRJdGVtKChpdGVtKSA9PiBpdGVtXG4gICAgICAgIC5zZXRUaXRsZShcIk9wZW4gYXMgc3RpY2t5IG5vdGVcIilcbiAgICAgICAgLnNldEljb24oXCJzdGlja3ktbm90ZVwiKVxuICAgICAgICAub25DbGljaygoKSA9PiB2b2lkIHRoaXMub3BlblN0aWNreU5vdGUoZmlsZSkpKTtcbiAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4gaXRlbVxuICAgICAgICAuc2V0VGl0bGUoXCJTZXQgYXMgdG9wLWxldmVsIHN0aWNreSBub3RlXCIpXG4gICAgICAgIC5zZXRJY29uKFwic3RhclwiKVxuICAgICAgICAub25DbGljaygoKSA9PiB2b2lkIHRoaXMuc2V0VG9wTGV2ZWxOb3RlKGZpbGUucGF0aCkpKTtcbiAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyRmlsZUxpZmVjeWNsZSgpOiB2b2lkIHtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oXCJkZWxldGVcIiwgKGZpbGU6IFRBYnN0cmFjdEZpbGUpID0+IHtcbiAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICAgIHRoaXMuY2xvc2VOb3Rlc0ZvclBhdGgoZmlsZS5wYXRoKTtcbiAgICAgIGlmICh0aGlzLnNldHRpbmdzLnRvcExldmVsTm90ZVBhdGggPT09IGZpbGUucGF0aCkge1xuICAgICAgICB0aGlzLnNldHRpbmdzLnRvcExldmVsTm90ZVBhdGggPSBudWxsO1xuICAgICAgICB2b2lkIHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5zZXR0aW5ncy5jb2xvcnNCeVBhdGhbZmlsZS5wYXRoXTtcbiAgICAgIHZvaWQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICB9KSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oXCJyZW5hbWVcIiwgKGZpbGU6IFRBYnN0cmFjdEZpbGUsIG9sZFBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgICAgY29uc3Qgbm90ZXMgPSB0aGlzLm5vdGVzQnlQYXRoLmdldChvbGRQYXRoKTtcbiAgICAgIGlmIChub3Rlcykge1xuICAgICAgICB0aGlzLm5vdGVzQnlQYXRoLmRlbGV0ZShvbGRQYXRoKTtcbiAgICAgICAgdGhpcy5ub3Rlc0J5UGF0aC5zZXQoZmlsZS5wYXRoLCBub3Rlcyk7XG4gICAgICAgIGZvciAoY29uc3Qgbm90ZSBvZiBub3Rlcykgbm90ZS5maWxlID0gZmlsZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnNldHRpbmdzLnRvcExldmVsTm90ZVBhdGggPT09IG9sZFBhdGgpIHRoaXMuc2V0dGluZ3MudG9wTGV2ZWxOb3RlUGF0aCA9IGZpbGUucGF0aDtcbiAgICAgIGNvbnN0IGNvbG9yID0gdGhpcy5zZXR0aW5ncy5jb2xvcnNCeVBhdGhbb2xkUGF0aF07XG4gICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuc2V0dGluZ3MuY29sb3JzQnlQYXRoW29sZFBhdGhdO1xuICAgICAgICB0aGlzLnNldHRpbmdzLmNvbG9yc0J5UGF0aFtmaWxlLnBhdGhdID0gY29sb3I7XG4gICAgICB9XG4gICAgICB2b2lkIHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgfSkpO1xuICB9XG5cbiAgYXN5bmMgY3JlYXRlU3RpY2t5Tm90ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmb2xkZXIgPSB0aGlzLm5vcm1hbGl6ZUZvbGRlcih0aGlzLnNldHRpbmdzLmRlZmF1bHRGb2xkZXIpO1xuICAgIGlmIChmb2xkZXIgJiYgIXRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmb2xkZXIpKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGVGb2xkZXIoZm9sZGVyKTtcbiAgICB9XG4gICAgY29uc3QgcHJlZml4ID0gZm9sZGVyID8gYCR7Zm9sZGVyfS9gIDogXCJcIjtcbiAgICBjb25zdCBmaWxlID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKGAke3ByZWZpeH0ke3RoaXMudW5pcXVlTm90ZU5hbWUoKX0ubWRgLCBcIlwiKTtcbiAgICBhd2FpdCB0aGlzLm9wZW5TdGlja3lOb3RlKGZpbGUpO1xuICB9XG5cbiAgYXN5bmMgdG9nZ2xlVG9wTGV2ZWxOb3RlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLnRvZ2dsZUluUHJvZ3Jlc3MpIHJldHVybjtcbiAgICB0aGlzLnRvZ2dsZUluUHJvZ3Jlc3MgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnBlcmZvcm1Ub3BMZXZlbFRvZ2dsZSgpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLnRvZ2dsZUluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBlcmZvcm1Ub3BMZXZlbFRvZ2dsZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5zZXR0aW5ncy50b3BMZXZlbE5vdGVQYXRoO1xuICAgIGlmICghcGF0aCkgcmV0dXJuO1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgdGhpcy5zZXR0aW5ncy50b3BMZXZlbE5vdGVQYXRoID0gbnVsbDtcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG5hdGl2ZVdpbmRvd3MgPSBhd2FpdCB0aGlzLm5hdGl2ZU5vdGVXaW5kb3dzRm9yUGF0aChwYXRoKTtcbiAgICBjb25zdCB0cmFja2VkV2luZG93cyA9IFsuLi4odGhpcy5ub3Rlc0J5UGF0aC5nZXQocGF0aCkgPz8gW10pXVxuICAgICAgLm1hcCgobm90ZSkgPT4gbm90ZS53aW5kb3cpXG4gICAgICAuZmlsdGVyKCh3aW5kb3cpID0+ICF3aW5kb3cuaXNEZXN0cm95ZWQoKSk7XG4gICAgY29uc3Qga25vd25XaW5kb3dzID0gWy4uLm5ldyBTZXQoWy4uLm5hdGl2ZVdpbmRvd3MsIC4uLnRyYWNrZWRXaW5kb3dzXSldO1xuXG4gICAgaWYgKGtub3duV2luZG93cy5zb21lKCh3aW5kb3cpID0+IHdpbmRvdy5pc0ZvY3VzZWQoKSkpIHtcbiAgICAgIC8vIERvIG5vdCBkZXRhY2ggdGhlIFdvcmtzcGFjZUxlYWYgaGVyZS4gT2JzaWRpYW4gcmVzcG9uZHMgdG8gYW4gZXhwbGljaXRcbiAgICAgIC8vIGRldGFjaCBieSBhY3RpdmF0aW5nIGl0cyBtYWluIHdvcmtzcGFjZSB3aW5kb3cuIENsb3NpbmcgdGhlIGluZGVwZW5kZW50XG4gICAgICAvLyBuYXRpdmUgcG9wb3V0IGxldHMgaXRzIG5vcm1hbCB1bmxvYWQgbGlmZWN5Y2xlIHJlbW92ZSB0aGUgbGVhZiB3aXRob3V0XG4gICAgICAvLyBhc2tpbmcgT2JzaWRpYW4gdG8gZm9jdXMgYSByZXBsYWNlbWVudCBmaXJzdC5cbiAgICAgIGZvciAoY29uc3Qgbm90ZSBvZiBbLi4uKHRoaXMubm90ZXNCeVBhdGguZ2V0KHBhdGgpID8/IFtdKV0pIHtcbiAgICAgICAgdGhpcy5yZW1lbWJlclRvcExldmVsUG9zaXRpb24obm90ZSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IG5hdGl2ZVdpbmRvdyBvZiBrbm93bldpbmRvd3MpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAoIW5hdGl2ZVdpbmRvdy5pc0Rlc3Ryb3llZCgpKSBuYXRpdmVXaW5kb3cuc2V0UGFyZW50V2luZG93KG51bGwpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyBUaGUgcG9wb3V0IGNhbiBkaXNhcHBlYXIgd2hpbGUgdGhlIGNvbW1hbmQgaXMgY29sbGVjdGluZyB3aW5kb3dzLlxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZm9yY2VDbG9zZVdpbmRvdyhuYXRpdmVXaW5kb3cpO1xuICAgICAgfVxuICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gdm9pZCB0aGlzLmFwcC53b3Jrc3BhY2UucmVxdWVzdFNhdmVMYXlvdXQoKSwgMTAwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoa25vd25XaW5kb3dzLmxlbmd0aCkge1xuICAgICAgdGhpcy5icmluZ1dpbmRvd1RvRnJvbnQoa25vd25XaW5kb3dzWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLm9wZW5TdGlja3lOb3RlKGZpbGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBicmluZ1dpbmRvd1RvRnJvbnQobmF0aXZlV2luZG93OiBOYXRpdmVCcm93c2VyV2luZG93KTogdm9pZCB7XG4gICAgaWYgKG5hdGl2ZVdpbmRvdy5pc0Rlc3Ryb3llZCgpKSByZXR1cm47XG4gICAgaWYgKG5hdGl2ZVdpbmRvdy5pc01pbmltaXplZCgpKSBuYXRpdmVXaW5kb3cucmVzdG9yZSgpO1xuICAgIGlmICghbmF0aXZlV2luZG93LmlzVmlzaWJsZSgpKSBuYXRpdmVXaW5kb3cuc2hvdygpO1xuICAgIG5hdGl2ZVdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgbmF0aXZlV2luZG93LmZvY3VzKCk7XG4gIH1cblxuICBhc3luYyBzZXRUb3BMZXZlbE5vdGUocGF0aDogc3RyaW5nIHwgbnVsbCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2V0dGluZ3MudG9wTGV2ZWxOb3RlUGF0aCA9IHBhdGg7XG4gICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICB0aGlzLnNjaGVkdWxlUmVmcmVzaEFsbE5vdGVzKCk7XG4gICAgbmV3IE5vdGljZShwYXRoID8gYFRvcC1sZXZlbCBzdGlja3kgbm90ZTogJHtwYXRofWAgOiBcIlRvcC1sZXZlbCBzdGlja3kgbm90ZSBjbGVhcmVkLlwiKTtcbiAgfVxuXG4gIGFzeW5jIG9wZW5TdGlja3lOb3RlKGZpbGU6IFRGaWxlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc2F2ZWRQb3NpdGlvbiA9IGZpbGUucGF0aCA9PT0gdGhpcy5zZXR0aW5ncy50b3BMZXZlbE5vdGVQYXRoXG4gICAgICA/IHRoaXMuc2V0dGluZ3MudG9wTGV2ZWxXaW5kb3dQb3NpdGlvblxuICAgICAgOiBudWxsO1xuICAgIGNvbnN0IGluaXRpYWxQb3NpdGlvbiA9IHNhdmVkUG9zaXRpb24gJiYgdGhpcy5wb3NpdGlvbklzVmlzaWJsZShzYXZlZFBvc2l0aW9uKVxuICAgICAgPyBzYXZlZFBvc2l0aW9uXG4gICAgICA6IG51bGw7XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuUG9wb3V0TGVhZih7XG4gICAgICBzaXplOiB7IHdpZHRoOiBERUZBVUxUX1dJRFRILCBoZWlnaHQ6IERFRkFVTFRfSEVJR0hUIH0sXG4gICAgICAuLi4oaW5pdGlhbFBvc2l0aW9uID8geyB4OiBpbml0aWFsUG9zaXRpb24ueCwgeTogaW5pdGlhbFBvc2l0aW9uLnkgfSA6IHt9KVxuICAgIH0pO1xuICAgIGF3YWl0IGxlYWYub3BlbkZpbGUoZmlsZSwgeyBhY3RpdmU6IHRydWUgfSk7XG5cbiAgICB0aGlzLmluaXRpYWxpemVTdGlja3lMZWFmKGZpbGUsIGxlYWYpO1xuICB9XG5cbiAgcHJpdmF0ZSBpbml0aWFsaXplU3RpY2t5TGVhZihmaWxlOiBURmlsZSwgbGVhZjogV29ya3NwYWNlTGVhZiwgZGV0YWNoT25GYWlsdXJlID0gdHJ1ZSk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLmluaXRpYWxpemVkTGVhdmVzLmhhcyhsZWFmKSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gVGhlIHZpZXcncyBvd25lckRvY3VtZW50IGlzIHBlcm1hbmVudGx5IHRpZWQgdG8gdGhpcyBwb3BvdXQuIE9ic2lkaWFuJ3NcbiAgICAvLyBhY3RpdmVEb2N1bWVudCBpcyBnbG9iYWwgYW5kIGNhbiBwb2ludCBhdCB0aGUgbWFpbiB3aW5kb3cgYWZ0ZXIgYmx1ci5cbiAgICBjb25zdCBkb2N1bWVudCA9IGxlYWYudmlldy5jb250YWluZXJFbC5vd25lckRvY3VtZW50O1xuICAgIGNvbnN0IGRvbVdpbmRvdyA9IGRvY3VtZW50LmRlZmF1bHRWaWV3O1xuICAgIGlmICghZG9tV2luZG93KSB7XG4gICAgICBpZiAoZGV0YWNoT25GYWlsdXJlKSB7XG4gICAgICAgIGxlYWYuZGV0YWNoKCk7XG4gICAgICAgIG5ldyBOb3RpY2UoXCJDb3VsZCBub3QgYWNjZXNzIHRoZSBzdGlja3ktbm90ZSBkb2N1bWVudC5cIik7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIFRoZSBET00gV2luZG93IGV4cG9zZWQgYnkgYW4gT2JzaWRpYW4gcG9wb3V0IGRlbGliZXJhdGVseSBkb2VzIG5vdCBleHBvc2VcbiAgICAvLyBFbGVjdHJvbidzIHdlYkNvbnRlbnRzLiBBIHVuaXF1ZSBkb2N1bWVudCB0aXRsZSBpcyB2aXNpYmxlIHRvIEVsZWN0cm9uLFxuICAgIC8vIGhvd2V2ZXIsIGFuZCByZWxpYWJseSBnaXZlcyB1cyB0aGUgY29ycmVzcG9uZGluZyBuYXRpdmUgQnJvd3NlcldpbmRvdy5cbiAgICBjb25zdCB3aW5kb3dNYXJrZXIgPSBgZGVza3RvcC1zdGlja3ktbm90ZS0ke2NyeXB0by5yYW5kb21VVUlEKCl9YDtcbiAgICBkb2N1bWVudC50aXRsZSA9IHdpbmRvd01hcmtlcjtcbiAgICBjb25zdCBicm93c2VyV2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCkuZmluZChcbiAgICAgIChjYW5kaWRhdGUpID0+IGNhbmRpZGF0ZS5nZXRUaXRsZSgpID09PSB3aW5kb3dNYXJrZXJcbiAgICApIGFzIE5hdGl2ZUJyb3dzZXJXaW5kb3cgfCB1bmRlZmluZWQ7XG4gICAgaWYgKCFicm93c2VyV2luZG93KSB7XG4gICAgICBpZiAoZGV0YWNoT25GYWlsdXJlKSB7XG4gICAgICAgIGxlYWYuZGV0YWNoKCk7XG4gICAgICAgIG5ldyBOb3RpY2UoXCJDb3VsZCBub3QgY3JlYXRlIHRoZSBzdGlja3ktbm90ZSB3aW5kb3cuXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vdGU6IFN0aWNreU5vdGVXaW5kb3cgPSB7IGZpbGUsIGxlYWYsIGRvY3VtZW50LCB3aW5kb3c6IGJyb3dzZXJXaW5kb3cgfTtcbiAgICB0aGlzLmluaXRpYWxpemVkTGVhdmVzLmFkZChsZWFmKTtcbiAgICB0aGlzLnRyYWNrTm90ZShub3RlKTtcbiAgICB0aGlzLnByZXBhcmVXaW5kb3cobm90ZSk7XG4gICAgdGhpcy53YXRjaFdpbmRvdyhub3RlLCBkb21XaW5kb3cpO1xuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudChkb21XaW5kb3csIFwiYmVmb3JldW5sb2FkXCIsICgpID0+IHtcbiAgICAgIHRoaXMucmVtZW1iZXJUb3BMZXZlbFBvc2l0aW9uKG5vdGUpO1xuICAgICAgdGhpcy51bnRyYWNrTm90ZShub3RlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZVdpbmRvdyhub3RlOiBTdGlja3lOb3RlV2luZG93KTogdm9pZCB7XG4gICAgaWYgKG5vdGUud2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcbiAgICBjb25zdCB7IGRvY3VtZW50LCB3aW5kb3cgfSA9IG5vdGU7XG4gICAgY29uc3QgbmF0aXZlVGl0bGUgPSB0aGlzLm5hdGl2ZU5vdGVXaW5kb3dUaXRsZShub3RlLmZpbGUpO1xuICAgIGNvbnN0IGRvbVdpbmRvdyA9IGRvY3VtZW50LmRlZmF1bHRWaWV3O1xuICAgIGlmIChkb21XaW5kb3cpIGRvbVdpbmRvdy5uYW1lID0gdGhpcy53aW5kb3dOYW1lRm9yUGF0aChub3RlLmZpbGUucGF0aCk7XG4gICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRhdGFzZXQuZGVza3RvcFN0aWNreU5vdGVXaW5kb3cgPSBcInRydWVcIjtcbiAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZGF0YXNldC5kZXNrdG9wU3RpY2t5Tm90ZVBhdGggPSBub3RlLmZpbGUucGF0aDtcbiAgICBkb2N1bWVudC50aXRsZSA9IG5hdGl2ZVRpdGxlO1xuICAgIHdpbmRvdy5zZXRUaXRsZShuYXRpdmVUaXRsZSk7XG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKFwiZGVza3RvcC1zdGlja3ktbm90ZVwiKTtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLndvcmtzcGFjZS10YWItaGVhZGVyLWNvbnRhaW5lclwiKT8ucmVtb3ZlKCk7XG4gICAgdGhpcy5hcHBseUNvbG9yKG5vdGUsIHRoaXMubm90ZUNvbG9yKG5vdGUuZmlsZS5wYXRoKSwgZmFsc2UpO1xuICAgIGlmIChub3RlLmZpbGUucGF0aCA9PT0gdGhpcy5zZXR0aW5ncy50b3BMZXZlbE5vdGVQYXRoKSB7XG4gICAgICAvLyBPbmx5IHRoZSBnbG9iYWxseSB0b2dnbGVkIHRvcC1sZXZlbCBub3RlIG11c3QgYmUgaW5kZXBlbmRlbnQuIFRoaXNcbiAgICAgIC8vIHByZXZlbnRzIGl0cyBuYXRpdmUtb25seSBkaXNtaXNzYWwgZnJvbSBhY3RpdmF0aW5nIE9ic2lkaWFuJ3MgbWFpblxuICAgICAgLy8gd2luZG93IHdoZW4gdGhlIHNob3J0Y3V0IHdhcyBpbnZva2VkIG92ZXIgYW5vdGhlciBhcHBsaWNhdGlvbi5cbiAgICAgIHdpbmRvdy5zZXRQYXJlbnRXaW5kb3cobnVsbCk7XG4gICAgICB3aW5kb3cuc2V0U2tpcFRhc2tiYXIodHJ1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJlZ3VsYXIgc3RpY2t5IG5vdGVzIHJldGFpbiBPYnNpZGlhbidzIG5vcm1hbCB3aW5kb3cgb3duZXJzaGlwIGFuZFxuICAgICAgLy8gdGFza2JhciBncm91cGluZy4gVGhpcyBhbHNvIHJlcGFpcnMgbm90ZXMgZGV0YWNoZWQgYnkgZWFybGllciBidWlsZHMuXG4gICAgICB3aW5kb3cuc2V0U2tpcFRhc2tiYXIoZmFsc2UpO1xuICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMubmF0aXZlTWFpbldpbmRvdygpO1xuICAgICAgaWYgKG1haW5XaW5kb3cgJiYgbWFpbldpbmRvdyAhPT0gd2luZG93KSB3aW5kb3cuc2V0UGFyZW50V2luZG93KG1haW5XaW5kb3cpO1xuICAgIH1cbiAgICB3aW5kb3cuc2V0UmVzaXphYmxlKHRydWUpO1xuICAgIHRoaXMuYWRkU3RpY2t5QWN0aW9ucyhub3RlKTtcbiAgICB0aGlzLm9ic2VydmVQcmVzZW50YXRpb24obm90ZSk7XG4gIH1cblxuICBwcml2YXRlIHdhdGNoV2luZG93KG5vdGU6IFN0aWNreU5vdGVXaW5kb3csIGRvbVdpbmRvdzogV2luZG93KTogdm9pZCB7XG4gICAgY29uc3QgcmVzdG9yZSA9ICgpID0+IHRoaXMuc2NoZWR1bGVSZWZyZXNoTm90ZShub3RlKTtcbiAgICB0aGlzLnJlZ2lzdGVyRG9tRXZlbnQoZG9tV2luZG93LCBcImZvY3VzXCIsIHJlc3RvcmUpO1xuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudChkb21XaW5kb3csIFwiYmx1clwiLCByZXN0b3JlKTtcbiAgfVxuXG4gIHByaXZhdGUgc2NoZWR1bGVSZWZyZXNoTm90ZShub3RlOiBTdGlja3lOb3RlV2luZG93KTogdm9pZCB7XG4gICAgLy8gT2JzaWRpYW4gcGVyZm9ybXMgc29tZSBmb2N1cy9sYXlvdXQgd29yayBhZnRlciBpdHMgZXZlbnRzIGZpcmUsIHNvIHJ1blxuICAgIC8vIG9uY2UgaW1tZWRpYXRlbHkgYW5kIG9uY2UgYWZ0ZXIgdGhhdCB1cGRhdGUgaGFzIHNldHRsZWQuXG4gICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gdGhpcy5wcmVwYXJlV2luZG93KG5vdGUpLCAwKTtcbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0aGlzLnByZXBhcmVXaW5kb3cobm90ZSksIDc1KTtcbiAgfVxuXG4gIHByaXZhdGUgc2NoZWR1bGVSZWZyZXNoQWxsTm90ZXMoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBub3RlIG9mIHRoaXMuYWxsTm90ZXMoKSkgdGhpcy5zY2hlZHVsZVJlZnJlc2hOb3RlKG5vdGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBuYXRpdmVNYWluV2luZG93KCk6IE5hdGl2ZUJyb3dzZXJXaW5kb3cgfCBudWxsIHtcbiAgICBjb25zdCBtYWluRG9jdW1lbnQgPSB0aGlzLmFwcC53b3Jrc3BhY2UuY29udGFpbmVyRWwub3duZXJEb2N1bWVudDtcbiAgICBjb25zdCBwcmV2aW91c1RpdGxlID0gbWFpbkRvY3VtZW50LnRpdGxlO1xuICAgIGNvbnN0IG1hcmtlciA9IGBkZXNrdG9wLXN0aWNreS1ub3Rlcy1tYWluLSR7Y3J5cHRvLnJhbmRvbVVVSUQoKX1gO1xuICAgIG1haW5Eb2N1bWVudC50aXRsZSA9IG1hcmtlcjtcbiAgICBjb25zdCBtYWluV2luZG93ID0gKEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpIGFzIHVua25vd24gYXMgTmF0aXZlQnJvd3NlcldpbmRvd1tdKVxuICAgICAgLmZpbmQoKGNhbmRpZGF0ZSkgPT4gIWNhbmRpZGF0ZS5pc0Rlc3Ryb3llZCgpICYmIGNhbmRpZGF0ZS5nZXRUaXRsZSgpID09PSBtYXJrZXIpID8/IG51bGw7XG4gICAgbWFpbkRvY3VtZW50LnRpdGxlID0gcHJldmlvdXNUaXRsZTtcbiAgICByZXR1cm4gbWFpbldpbmRvdztcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2ZVByZXNlbnRhdGlvbihub3RlOiBTdGlja3lOb3RlV2luZG93KTogdm9pZCB7XG4gICAgaWYgKG5vdGUub2JzZXJ2ZXIpIHJldHVybjtcbiAgICBsZXQgcmVmcmVzaFNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIG5vdGUub2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICBpZiAocmVmcmVzaFNjaGVkdWxlZCB8fCB0aGlzLnByZXNlbnRhdGlvbklzSW50YWN0KG5vdGUpKSByZXR1cm47XG4gICAgICByZWZyZXNoU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgcmVmcmVzaFNjaGVkdWxlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLnByZXBhcmVXaW5kb3cobm90ZSk7XG4gICAgICB9LCAwKTtcbiAgICB9KTtcbiAgICBub3RlLm9ic2VydmVyLm9ic2VydmUobm90ZS5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHtcbiAgICAgIHN1YnRyZWU6IHRydWUsXG4gICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgICAgY2hhcmFjdGVyRGF0YTogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcjogW1wiY2xhc3NcIiwgXCJzdHlsZVwiXVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVzZW50YXRpb25Jc0ludGFjdChub3RlOiBTdGlja3lOb3RlV2luZG93KTogYm9vbGVhbiB7XG4gICAgY29uc3QgeyBkb2N1bWVudCB9ID0gbm90ZTtcbiAgICBjb25zdCBhY3Rpb25zID0gbm90ZS5sZWFmLnZpZXcuY29udGFpbmVyRWwucXVlcnlTZWxlY3RvcihcIi52aWV3LWFjdGlvbnNcIik7XG4gICAgY29uc3QgZXhwZWN0ZWRDb2xvciA9IHRoaXMubm90ZUNvbG9yKG5vdGUuZmlsZS5wYXRoKTtcbiAgICByZXR1cm4gZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuY29udGFpbnMoXCJkZXNrdG9wLXN0aWNreS1ub3RlXCIpXG4gICAgICAmJiBkb2N1bWVudC5kZWZhdWx0Vmlldz8ubmFtZSA9PT0gdGhpcy53aW5kb3dOYW1lRm9yUGF0aChub3RlLmZpbGUucGF0aClcbiAgICAgICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kYXRhc2V0LmRlc2t0b3BTdGlja3lOb3RlV2luZG93ID09PSBcInRydWVcIlxuICAgICAgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRhdGFzZXQuZGVza3RvcFN0aWNreU5vdGVQYXRoID09PSBub3RlLmZpbGUucGF0aFxuICAgICAgJiYgZG9jdW1lbnQudGl0bGUgPT09IHRoaXMubmF0aXZlTm90ZVdpbmRvd1RpdGxlKG5vdGUuZmlsZSlcbiAgICAgICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKFwiLS1iYWNrZ3JvdW5kLXByaW1hcnlcIikgPT09IGV4cGVjdGVkQ29sb3JcbiAgICAgICYmIGRvY3VtZW50LmJvZHkuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZShcIi0tc3RpY2t5LW5vdGUtYmFja2dyb3VuZFwiKSA9PT0gZXhwZWN0ZWRDb2xvclxuICAgICAgJiYgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIud29ya3NwYWNlLXRhYi1oZWFkZXItY29udGFpbmVyXCIpXG4gICAgICAmJiAhIWFjdGlvbnM/LnF1ZXJ5U2VsZWN0b3IoXCIuZGVza3RvcC1zdGlja3ktbm90ZS1jb2xvci1waWNrZXJcIik7XG4gIH1cblxuICBwcml2YXRlIGFkZFN0aWNreUFjdGlvbnMobm90ZTogU3RpY2t5Tm90ZVdpbmRvdyk6IHZvaWQge1xuICAgIGNvbnN0IHZpZXcgPSBub3RlLmxlYWYudmlldztcbiAgICBpZiAoISh2aWV3IGluc3RhbmNlb2YgTWFya2Rvd25WaWV3KSkgcmV0dXJuO1xuICAgIGNvbnN0IGFjdGlvbnMgPSB2aWV3LmNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoXCIudmlldy1hY3Rpb25zXCIpO1xuICAgIGFjdGlvbnM/LmVtcHR5KCk7XG5cbiAgICBjb25zdCBwaW4gPSB2aWV3LmFkZEFjdGlvbihcInBpblwiLCBcIktlZXAgb24gdG9wXCIsICgpID0+IHtcbiAgICAgIG5vdGUud2luZG93LnNldEFsd2F5c09uVG9wKCFub3RlLndpbmRvdy5pc0Fsd2F5c09uVG9wKCkpO1xuICAgICAgdGhpcy51cGRhdGVQaW5CdXR0b24ocGluLCBub3RlLndpbmRvdy5pc0Fsd2F5c09uVG9wKCkpO1xuICAgIH0pO1xuICAgIHRoaXMudXBkYXRlUGluQnV0dG9uKHBpbiwgbm90ZS53aW5kb3cuaXNBbHdheXNPblRvcCgpKTtcblxuICAgIGNvbnN0IGNvbG9yUGlja2VyID0gYWN0aW9ucz8uY3JlYXRlRWwoXCJpbnB1dFwiLCB7XG4gICAgICBjbHM6IFwiZGVza3RvcC1zdGlja3ktbm90ZS1jb2xvci1waWNrZXJcIixcbiAgICAgIGF0dHI6IHtcbiAgICAgICAgdHlwZTogXCJjb2xvclwiLFxuICAgICAgICB2YWx1ZTogdGhpcy5ub3RlQ29sb3Iobm90ZS5maWxlLnBhdGgpLFxuICAgICAgICBcImFyaWEtbGFiZWxcIjogXCJDaG9vc2Ugc3RpY2t5LW5vdGUgYmFja2dyb3VuZCBjb2xvclwiLFxuICAgICAgICB0aXRsZTogXCJDaG9vc2UgYmFja2dyb3VuZCBjb2xvclwiXG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGNvbG9yUGlja2VyIGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCkge1xuICAgICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KGNvbG9yUGlja2VyLCBcImlucHV0XCIsICgpID0+IHRoaXMuYXBwbHlDb2xvcihub3RlLCBjb2xvclBpY2tlci52YWx1ZSkpO1xuICAgICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KGNvbG9yUGlja2VyLCBcImNsaWNrXCIsIChldmVudCkgPT4gZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCkpO1xuICAgIH1cbiAgICBjb25zdCBtb2RlID0gdmlldy5hZGRBY3Rpb24oXCJwZW5jaWxcIiwgXCJTd2l0Y2ggdG8gZWRpdCBtb2RlXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IG5leHRNb2RlID0gdmlldy5nZXRNb2RlKCkgPT09IFwic291cmNlXCIgPyBcInByZXZpZXdcIiA6IFwic291cmNlXCI7XG4gICAgICB2b2lkIHZpZXcuc2V0U3RhdGUoeyBtb2RlOiBuZXh0TW9kZSB9LCB7IGhpc3Rvcnk6IGZhbHNlIH0pO1xuICAgICAgdGhpcy51cGRhdGVNb2RlQnV0dG9uKG1vZGUsIG5leHRNb2RlKTtcbiAgICB9KTtcbiAgICB0aGlzLnVwZGF0ZU1vZGVCdXR0b24obW9kZSwgdmlldy5nZXRNb2RlKCkpO1xuICAgIHZpZXcuYWRkQWN0aW9uKFwieFwiLCBcIkhpZGUgc3RpY2t5IG5vdGVcIiwgKCkgPT4gdGhpcy5oaWRlTm90ZShub3RlKSlcbiAgICAgIC5hZGRDbGFzcyhcImRlc2t0b3Atc3RpY2t5LW5vdGUtaGlkZVwiKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlUGluQnV0dG9uKGJ1dHRvbjogSFRNTEVsZW1lbnQsIHBpbm5lZDogYm9vbGVhbik6IHZvaWQge1xuICAgIHNldEljb24oYnV0dG9uLCBwaW5uZWQgPyBcInBpbi1vZmZcIiA6IFwicGluXCIpO1xuICAgIHNldFRvb2x0aXAoYnV0dG9uLCBwaW5uZWQgPyBcIlN0b3Aga2VlcGluZyBvbiB0b3BcIiA6IFwiS2VlcCBvbiB0b3BcIik7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZU1vZGVCdXR0b24oYnV0dG9uOiBIVE1MRWxlbWVudCwgbW9kZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZWRpdGluZyA9IG1vZGUgPT09IFwic291cmNlXCI7XG4gICAgc2V0SWNvbihidXR0b24sIGVkaXRpbmcgPyBcImJvb2stb3BlblwiIDogXCJwZW5jaWxcIik7XG4gICAgc2V0VG9vbHRpcChidXR0b24sIGVkaXRpbmcgPyBcIlN3aXRjaCB0byByZWFkaW5nIHZpZXdcIiA6IFwiU3dpdGNoIHRvIGVkaXQgbW9kZVwiKTtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlDb2xvcihub3RlOiBTdGlja3lOb3RlV2luZG93LCBjb2xvcjogc3RyaW5nLCBwZXJzaXN0ID0gdHJ1ZSk6IHZvaWQge1xuICAgIGNvbnN0IHJvb3RTdHlsZSA9IG5vdGUuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlO1xuICAgIHJvb3RTdHlsZS5zZXRQcm9wZXJ0eShcIi0tYmFja2dyb3VuZC1wcmltYXJ5XCIsIGNvbG9yKTtcbiAgICByb290U3R5bGUuc2V0UHJvcGVydHkoXCItLWJhY2tncm91bmQtcHJpbWFyeS1hbHRcIiwgY29sb3IpO1xuICAgIHJvb3RTdHlsZS5zZXRQcm9wZXJ0eShcIi0tYmFja2dyb3VuZC1zZWNvbmRhcnlcIiwgY29sb3IpO1xuICAgIHJvb3RTdHlsZS5zZXRQcm9wZXJ0eShcIi0tYmFja2dyb3VuZC1zZWNvbmRhcnktYWx0XCIsIGNvbG9yKTtcbiAgICBub3RlLmRvY3VtZW50LmJvZHkuc3R5bGUuc2V0UHJvcGVydHkoXCItLXN0aWNreS1ub3RlLWJhY2tncm91bmRcIiwgY29sb3IpO1xuICAgIGlmIChwZXJzaXN0KSB7XG4gICAgICB0aGlzLnNldHRpbmdzLmNvbG9yc0J5UGF0aFtub3RlLmZpbGUucGF0aF0gPSBjb2xvcjtcbiAgICAgIHZvaWQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG5vdGVDb2xvcihwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnNldHRpbmdzLmNvbG9yc0J5UGF0aFtwYXRoXSA/PyB0aGlzLnNldHRpbmdzLmRlZmF1bHROb3RlQ29sb3I7XG4gIH1cblxuICBwcml2YXRlIHRyYWNrTm90ZShub3RlOiBTdGlja3lOb3RlV2luZG93KTogdm9pZCB7XG4gICAgY29uc3Qgbm90ZXMgPSB0aGlzLm5vdGVzQnlQYXRoLmdldChub3RlLmZpbGUucGF0aCkgPz8gbmV3IFNldDxTdGlja3lOb3RlV2luZG93PigpO1xuICAgIG5vdGVzLmFkZChub3RlKTtcbiAgICB0aGlzLm5vdGVzQnlQYXRoLnNldChub3RlLmZpbGUucGF0aCwgbm90ZXMpO1xuICB9XG5cbiAgcHJpdmF0ZSB1bnRyYWNrTm90ZShub3RlOiBTdGlja3lOb3RlV2luZG93KTogdm9pZCB7XG4gICAgbm90ZS5vYnNlcnZlcj8uZGlzY29ubmVjdCgpO1xuICAgIHRoaXMuaW5pdGlhbGl6ZWRMZWF2ZXMuZGVsZXRlKG5vdGUubGVhZik7XG4gICAgY29uc3Qgbm90ZXMgPSB0aGlzLm5vdGVzQnlQYXRoLmdldChub3RlLmZpbGUucGF0aCk7XG4gICAgaWYgKCFub3RlcykgcmV0dXJuO1xuICAgIG5vdGVzLmRlbGV0ZShub3RlKTtcbiAgICBpZiAoIW5vdGVzLnNpemUpIHRoaXMubm90ZXNCeVBhdGguZGVsZXRlKG5vdGUuZmlsZS5wYXRoKTtcbiAgfVxuXG4gIHByaXZhdGUgY2xvc2VOb3Rlc0ZvclBhdGgocGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3Qgbm90ZXMgPSBbLi4uKHRoaXMubm90ZXNCeVBhdGguZ2V0KHBhdGgpID8/IFtdKV07XG4gICAgZm9yIChjb25zdCBub3RlIG9mIG5vdGVzKSB7XG4gICAgICB0aGlzLnJlbWVtYmVyVG9wTGV2ZWxQb3NpdGlvbihub3RlKTtcbiAgICAgIHRoaXMuY2xlYXJXaW5kb3dNYXJrZXIobm90ZSk7XG4gICAgICB0aGlzLnVudHJhY2tOb3RlKG5vdGUpO1xuICAgICAgbm90ZS5sZWFmLmRldGFjaCgpO1xuICAgICAgdGhpcy5mb3JjZUNsb3NlV2luZG93KG5vdGUud2luZG93KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBsZWFmIG9mIHRoaXMuc3RpY2t5TGVhdmVzRm9yUGF0aChwYXRoKSkge1xuICAgICAgY29uc3QgZG9tV2luZG93ID0gbGVhZi52aWV3LmNvbnRhaW5lckVsLm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXc7XG4gICAgICBpZiAoZG9tV2luZG93KSBkb21XaW5kb3cubmFtZSA9IFwiXCI7XG4gICAgICBsZWFmLmRldGFjaCgpO1xuICAgIH1cbiAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5yZXF1ZXN0U2F2ZUxheW91dCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBoaWRlTm90ZShub3RlOiBTdGlja3lOb3RlV2luZG93KTogdm9pZCB7XG4gICAgdGhpcy5yZW1lbWJlclRvcExldmVsUG9zaXRpb24obm90ZSk7XG4gICAgdGhpcy5jbGVhcldpbmRvd01hcmtlcihub3RlKTtcbiAgICB0aGlzLnVudHJhY2tOb3RlKG5vdGUpO1xuICAgIG5vdGUubGVhZi5kZXRhY2goKTtcbiAgICB0aGlzLmZvcmNlQ2xvc2VXaW5kb3cobm90ZS53aW5kb3cpO1xuICAgIHZvaWQgdGhpcy5hcHAud29ya3NwYWNlLnJlcXVlc3RTYXZlTGF5b3V0KCk7XG4gIH1cblxuICBwcml2YXRlIGNsZWFyV2luZG93TWFya2VyKG5vdGU6IFN0aWNreU5vdGVXaW5kb3cpOiB2b2lkIHtcbiAgICBjb25zdCBkb21XaW5kb3cgPSBub3RlLmRvY3VtZW50LmRlZmF1bHRWaWV3O1xuICAgIGlmIChkb21XaW5kb3cpIGRvbVdpbmRvdy5uYW1lID0gXCJcIjtcbiAgICBkZWxldGUgbm90ZS5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZGF0YXNldC5kZXNrdG9wU3RpY2t5Tm90ZVdpbmRvdztcbiAgICBkZWxldGUgbm90ZS5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZGF0YXNldC5kZXNrdG9wU3RpY2t5Tm90ZVBhdGg7XG4gIH1cblxuICBwcml2YXRlIGZvcmNlQ2xvc2VXaW5kb3cobmF0aXZlV2luZG93OiBOYXRpdmVCcm93c2VyV2luZG93KTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghbmF0aXZlV2luZG93LmlzRGVzdHJveWVkKCkpIG5hdGl2ZVdpbmRvdy5jbG9zZSgpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gRmFsbCB0aHJvdWdoIHRvIHRoZSBmb3JjZWQtZGVzdHJveSBjaGVjayBiZWxvdy5cbiAgICB9XG4gICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKCFuYXRpdmVXaW5kb3cuaXNEZXN0cm95ZWQoKSkgbmF0aXZlV2luZG93LmRlc3Ryb3koKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBUaGUgcmVtb3RlIHByb3h5IGJlY29tZXMgaW52YWxpZCBhcyBzb29uIGFzIHRoZSB3aW5kb3cgY2xvc2VzLlxuICAgICAgfVxuICAgIH0sIDUwKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgY2xvc2VTdGFsZVN0aWNreVdpbmRvd3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgd2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpIGFzIHVua25vd24gYXMgTmF0aXZlQnJvd3NlcldpbmRvd1tdO1xuICAgIGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIHdpbmRvd3MpIHtcbiAgICAgIGlmIChjYW5kaWRhdGUuaXNEZXN0cm95ZWQoKSkgY29udGludWU7XG4gICAgICBsZXQgaXNTdGlja3lXaW5kb3cgPSBjYW5kaWRhdGUuZ2V0VGl0bGUoKS5zdGFydHNXaXRoKFwiU3RpY2t5IG5vdGUgXHUyMDE0XCIpO1xuICAgICAgaWYgKCFpc1N0aWNreVdpbmRvdykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGlzU3RpY2t5V2luZG93ID0gYXdhaXQgY2FuZGlkYXRlLndlYkNvbnRlbnRzLmV4ZWN1dGVKYXZhU2NyaXB0KFxuICAgICAgICAgICAgYHdpbmRvdy5uYW1lLnN0YXJ0c1dpdGgoJyR7V0lORE9XX05BTUVfUFJFRklYfScpYFxuICAgICAgICAgICkgPT09IHRydWU7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8vIEEgcmVuZGVyZXIgY2FuIGRpc2FwcGVhciB3aGlsZSBzdGFydHVwIGNsZWFudXAgaXMgcnVubmluZy5cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGlzU3RpY2t5V2luZG93ICYmICFjYW5kaWRhdGUuaXNEZXN0cm95ZWQoKSkgY2FuZGlkYXRlLmRlc3Ryb3koKTtcbiAgICB9XG4gICAgdm9pZCB0aGlzLmFwcC53b3Jrc3BhY2UucmVxdWVzdFNhdmVMYXlvdXQoKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RpY2t5TGVhdmVzRm9yUGF0aChwYXRoOiBzdHJpbmcpOiBXb3Jrc3BhY2VMZWFmW10ge1xuICAgIGNvbnN0IHN0aWNreUxlYXZlczogV29ya3NwYWNlTGVhZltdID0gW107XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLml0ZXJhdGVBbGxMZWF2ZXMoKGxlYWYpID0+IHtcbiAgICAgIGlmICghKGxlYWYudmlldyBpbnN0YW5jZW9mIE1hcmtkb3duVmlldykgfHwgbGVhZi52aWV3LmZpbGU/LnBhdGggIT09IHBhdGgpIHJldHVybjtcbiAgICAgIGNvbnN0IGRvY3VtZW50ID0gbGVhZi52aWV3LmNvbnRhaW5lckVsLm93bmVyRG9jdW1lbnQ7XG4gICAgICBpZiAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRhdGFzZXQuZGVza3RvcFN0aWNreU5vdGVXaW5kb3cgPT09IFwidHJ1ZVwiXG4gICAgICAgICYmIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKFwiZGVza3RvcC1zdGlja3ktbm90ZVwiKSkge1xuICAgICAgICBzdGlja3lMZWF2ZXMucHVzaChsZWFmKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gc3RpY2t5TGVhdmVzO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBuYXRpdmVOb3RlV2luZG93c0ZvclBhdGgocGF0aDogc3RyaW5nKTogUHJvbWlzZTxOYXRpdmVCcm93c2VyV2luZG93W10+IHtcbiAgICBjb25zdCBtYXRjaGVzOiBOYXRpdmVCcm93c2VyV2luZG93W10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKSBhcyB1bmtub3duIGFzIE5hdGl2ZUJyb3dzZXJXaW5kb3dbXSkge1xuICAgICAgaWYgKGNhbmRpZGF0ZS5pc0Rlc3Ryb3llZCgpKSBjb250aW51ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG1hcmtlZFBhdGggPSBhd2FpdCBjYW5kaWRhdGUud2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoXG4gICAgICAgICAgYHdpbmRvdy5uYW1lLnN0YXJ0c1dpdGgoJyR7V0lORE9XX05BTUVfUFJFRklYfScpIGBcbiAgICAgICAgICAgICsgYD8gZGVjb2RlVVJJQ29tcG9uZW50KHdpbmRvdy5uYW1lLnNsaWNlKCR7V0lORE9XX05BTUVfUFJFRklYLmxlbmd0aH0pKSA6IG51bGxgXG4gICAgICAgICk7XG4gICAgICAgIGlmIChtYXJrZWRQYXRoID09PSBwYXRoKSBtYXRjaGVzLnB1c2goY2FuZGlkYXRlKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBBIHdpbmRvdyBjYW4gY2xvc2Ugd2hpbGUgdGhlIGNvbW1hbmQgaXMgaW5zcGVjdGluZyBpdC5cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1hdGNoZXM7XG4gIH1cblxuICBwcml2YXRlIHJlbWVtYmVyVG9wTGV2ZWxQb3NpdGlvbihub3RlOiBTdGlja3lOb3RlV2luZG93KTogdm9pZCB7XG4gICAgaWYgKG5vdGUuZmlsZS5wYXRoICE9PSB0aGlzLnNldHRpbmdzLnRvcExldmVsTm90ZVBhdGggfHwgbm90ZS53aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuICAgIGNvbnN0IFt4LCB5XSA9IG5vdGUud2luZG93LmdldFBvc2l0aW9uKCk7XG4gICAgdGhpcy5zZXR0aW5ncy50b3BMZXZlbFdpbmRvd1Bvc2l0aW9uID0geyB4LCB5IH07XG4gICAgdm9pZCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICB9XG5cbiAgcHJpdmF0ZSBwb3NpdGlvbklzVmlzaWJsZShwb3NpdGlvbjogV2luZG93UG9zaXRpb24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gc2NyZWVuLmdldEFsbERpc3BsYXlzKCkuc29tZSgoZGlzcGxheSkgPT4ge1xuICAgICAgY29uc3QgeyB4LCB5LCB3aWR0aCwgaGVpZ2h0IH0gPSBkaXNwbGF5LndvcmtBcmVhO1xuICAgICAgLy8gS2VlcCB0aGUgdXBwZXItbGVmdCBkcmFnIGFyZWEgcmVhY2hhYmxlIG9uIGF0IGxlYXN0IG9uZSBkaXNwbGF5LlxuICAgICAgcmV0dXJuIHBvc2l0aW9uLnggPj0geCAtIDQwXG4gICAgICAgICYmIHBvc2l0aW9uLnggPCB4ICsgd2lkdGggLSA0MFxuICAgICAgICAmJiBwb3NpdGlvbi55ID49IHlcbiAgICAgICAgJiYgcG9zaXRpb24ueSA8IHkgKyBoZWlnaHQgLSAzMDtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgbmF0aXZlTm90ZVdpbmRvd1RpdGxlKGZpbGU6IFRGaWxlKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5uYXRpdmVOb3RlV2luZG93VGl0bGVGb3JQYXRoKGZpbGUucGF0aCwgZmlsZS5iYXNlbmFtZSk7XG4gIH1cblxuICBwcml2YXRlIG5hdGl2ZU5vdGVXaW5kb3dUaXRsZUZvclBhdGgocGF0aDogc3RyaW5nLCBiYXNlbmFtZT86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgbGFiZWwgPSBiYXNlbmFtZSA/PyBwYXRoLnNwbGl0KFwiL1wiKS5wb3AoKT8ucmVwbGFjZSgvXFwubWQkLywgXCJcIikgPz8gXCJTdGlja3kgbm90ZVwiO1xuICAgIC8vIFRoZSBpbnZpc2libGUgc3VmZml4IGlzIGEgc3RhYmxlLCBwYXRoLXNwZWNpZmljIGtleSBzaGFyZWQgYnkgZXZlcnlcbiAgICAvLyBPYnNpZGlhbiByZW5kZXJlciB3aXRob3V0IGNsdXR0ZXJpbmcgdGhlIHZpc2libGUgbmF0aXZlIHdpbmRvdyB0aXRsZS5cbiAgICByZXR1cm4gYFN0aWNreSBub3RlIFx1MjAxNCAke2xhYmVsfVxcdTIwNjMke2VuY29kZVVSSUNvbXBvbmVudChwYXRoKX1gO1xuICB9XG5cbiAgcHJpdmF0ZSB3aW5kb3dOYW1lRm9yUGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHtXSU5ET1dfTkFNRV9QUkVGSVh9JHtlbmNvZGVVUklDb21wb25lbnQocGF0aCl9YDtcbiAgfVxuXG4gIHByaXZhdGUgKmFsbE5vdGVzKCk6IEl0ZXJhYmxlPFN0aWNreU5vdGVXaW5kb3c+IHtcbiAgICBmb3IgKGNvbnN0IG5vdGVzIG9mIHRoaXMubm90ZXNCeVBhdGgudmFsdWVzKCkpIHlpZWxkKiBub3RlcztcbiAgfVxuXG4gIHByaXZhdGUgbm9ybWFsaXplRm9sZGVyKGZvbGRlcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gZm9sZGVyLnRyaW0oKS5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCBcIlwiKTtcbiAgfVxuXG4gIHByaXZhdGUgdW5pcXVlTm90ZU5hbWUoKTogc3RyaW5nIHtcbiAgICBjb25zdCBzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC9bOi5dL2csIFwiLVwiKTtcbiAgICByZXR1cm4gYFN0aWNreSBub3RlICR7c3RhbXB9YDtcbiAgfVxufVxuXG5jbGFzcyBEZXNrdG9wU3RpY2t5Tm90ZXNTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHByaXZhdGUgc2hvcnRjdXRSZWNvcmRpbmdDbGVhbnVwOiAoKCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihhcHA6IFBsdWdpblNldHRpbmdUYWJbXCJhcHBcIl0sIHByaXZhdGUgcGx1Z2luOiBEZXNrdG9wU3RpY2t5Tm90ZXNQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcFNob3J0Y3V0UmVjb3JkaW5nKHRydWUpO1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJEZXNrdG9wIFN0aWNreSBOb3Rlc1wiIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkRlZmF1bHQgZm9sZGVyXCIpXG4gICAgICAuc2V0RGVzYyhcIkZvbGRlciBmb3IgbmV3bHkgY3JlYXRlZCBzdGlja3kgbm90ZXMuIExlYXZlIGJsYW5rIGZvciB0aGUgdmF1bHQgcm9vdC5cIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0XG4gICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIlZhdWx0IHJvb3RcIilcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZmF1bHRGb2xkZXIpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0Rm9sZGVyID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiRGVmYXVsdCBub3RlIGNvbG9yXCIpXG4gICAgICAuc2V0RGVzYyhcIkJhY2tncm91bmQgY29sb3IgdXNlZCBmb3Igbm90ZXMgdGhhdCBkbyBub3QgaGF2ZSBhIHNhdmVkIGN1c3RvbSBjb2xvci5cIilcbiAgICAgIC5hZGRDb2xvclBpY2tlcigocGlja2VyKSA9PiBwaWNrZXJcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZmF1bHROb3RlQ29sb3IpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0Tm90ZUNvbG9yID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pKTtcblxuICAgIGNvbnN0IHNob3J0Y3V0U2V0dGluZyA9IG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJHbG9iYWwgdG9nZ2xlIHNob3J0Y3V0XCIpXG4gICAgICAuc2V0RGVzYyhcIlN5c3RlbS13aWRlIHNob3J0Y3V0IGZvciB0b2dnbGluZyB0aGUgdG9wLWxldmVsIHN0aWNreSBub3RlLiBDbGljayB0aGUgc2hvcnRjdXQsIHByZXNzIGEgbmV3IGNvbWJpbmF0aW9uLCBvciBwcmVzcyBFc2NhcGUgdG8gY2FuY2VsLlwiKTtcbiAgICBsZXQgcmVjb3JkZXJCdXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xuICAgIGxldCBjbGVhckJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gICAgc2hvcnRjdXRTZXR0aW5nXG4gICAgICAuYWRkQnV0dG9uKChidXR0b24pID0+IHtcbiAgICAgICAgYnV0dG9uXG4gICAgICAgICAgLnNldEJ1dHRvblRleHQoZGlzcGxheUFjY2VsZXJhdG9yKHRoaXMucGx1Z2luLnNldHRpbmdzLmdsb2JhbFRvZ2dsZVNob3J0Y3V0KSlcbiAgICAgICAgICAuc2V0VG9vbHRpcChcIlJlY29yZCBnbG9iYWwgc2hvcnRjdXRcIilcbiAgICAgICAgICAuc2V0Q2xhc3MoXCJkZXNrdG9wLXN0aWNreS1ub3RlLXNob3J0Y3V0LXJlY29yZGVyXCIpXG4gICAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuc2hvcnRjdXRSZWNvcmRpbmdDbGVhbnVwKSB7XG4gICAgICAgICAgICAgIHRoaXMuc3RvcFNob3J0Y3V0UmVjb3JkaW5nKHRydWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5zdGFydFNob3J0Y3V0UmVjb3JkaW5nKHJlY29yZGVyQnV0dG9uLCBjbGVhckJ1dHRvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIHJlY29yZGVyQnV0dG9uID0gYnV0dG9uLmJ1dHRvbkVsO1xuICAgICAgfSlcbiAgICAgIC5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuICAgICAgICBidXR0b25cbiAgICAgICAgICAuc2V0QnV0dG9uVGV4dChcIkNsZWFyXCIpXG4gICAgICAgICAgLnNldFRvb2x0aXAoXCJEaXNhYmxlIGdsb2JhbCBzaG9ydGN1dFwiKVxuICAgICAgICAgIC5zZXREaXNhYmxlZCghdGhpcy5wbHVnaW4uc2V0dGluZ3MuZ2xvYmFsVG9nZ2xlU2hvcnRjdXQpXG4gICAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zdG9wU2hvcnRjdXRSZWNvcmRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2V0R2xvYmFsVG9nZ2xlU2hvcnRjdXQoXCJcIik7XG4gICAgICAgICAgICByZWNvcmRlckJ1dHRvbi5zZXRUZXh0KFwiRGlzYWJsZWRcIik7XG4gICAgICAgICAgICBjbGVhckJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICAgICAgfSk7XG4gICAgICAgIGNsZWFyQnV0dG9uID0gYnV0dG9uLmJ1dHRvbkVsO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiVG9wLWxldmVsIHN0aWNreSBub3RlXCIpXG4gICAgICAuc2V0RGVzYyh0aGlzLnBsdWdpbi5zZXR0aW5ncy50b3BMZXZlbE5vdGVQYXRoID8/IFwiTm8gdG9wLWxldmVsIG5vdGUgc2VsZWN0ZWQuXCIpXG4gICAgICAuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvblxuICAgICAgICAuc2V0QnV0dG9uVGV4dChcIlVzZSBhY3RpdmUgZmlsZVwiKVxuICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgICAgaWYgKCFmaWxlKSB7XG4gICAgICAgICAgICBuZXcgTm90aWNlKFwiT3BlbiBhIE1hcmtkb3duIGZpbGUgZmlyc3QuXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2b2lkIHRoaXMucGx1Z2luLnNldFRvcExldmVsTm90ZShmaWxlLnBhdGgpLnRoZW4oKCkgPT4gdGhpcy5kaXNwbGF5KCkpO1xuICAgICAgICB9KSlcbiAgICAgIC5hZGRFeHRyYUJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b25cbiAgICAgICAgLnNldEljb24oXCJ0cmFzaFwiKVxuICAgICAgICAuc2V0VG9vbHRpcChcIkNsZWFyIHRvcC1sZXZlbCBub3RlXCIpXG4gICAgICAgIC5vbkNsaWNrKCgpID0+IHZvaWQgdGhpcy5wbHVnaW4uc2V0VG9wTGV2ZWxOb3RlKG51bGwpLnRoZW4oKCkgPT4gdGhpcy5kaXNwbGF5KCkpKSk7XG4gIH1cblxuICBoaWRlKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcFNob3J0Y3V0UmVjb3JkaW5nKHRydWUpO1xuICAgIHN1cGVyLmhpZGUoKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhcnRTaG9ydGN1dFJlY29yZGluZyhyZWNvcmRlckJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsIGNsZWFyQnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcFNob3J0Y3V0UmVjb3JkaW5nKHRydWUpO1xuICAgIHRoaXMucGx1Z2luLmJlZ2luR2xvYmFsU2hvcnRjdXRSZWNvcmRpbmcoKTtcbiAgICBjb25zdCBwcmV2aW91c0xhYmVsID0gZGlzcGxheUFjY2VsZXJhdG9yKHRoaXMucGx1Z2luLnNldHRpbmdzLmdsb2JhbFRvZ2dsZVNob3J0Y3V0KTtcbiAgICByZWNvcmRlckJ1dHRvbi5zZXRUZXh0KFwiUHJlc3Mgc2hvcnRjdXRcdTIwMjZcIik7XG4gICAgcmVjb3JkZXJCdXR0b24uYWRkQ2xhc3MoXCJpcy1yZWNvcmRpbmdcIik7XG4gICAgY2xlYXJCdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICAgIHJlY29yZGVyQnV0dG9uLmZvY3VzKCk7XG5cbiAgICBjb25zdCBmaW5pc2ggPSAocmVzdG9yZVJlZ2lzdHJhdGlvbjogYm9vbGVhbikgPT4ge1xuICAgICAgY29uc3QgY2xlYW51cCA9IHRoaXMuc2hvcnRjdXRSZWNvcmRpbmdDbGVhbnVwO1xuICAgICAgdGhpcy5zaG9ydGN1dFJlY29yZGluZ0NsZWFudXAgPSBudWxsO1xuICAgICAgY2xlYW51cD8uKCk7XG4gICAgICByZWNvcmRlckJ1dHRvbi5yZW1vdmVDbGFzcyhcImlzLXJlY29yZGluZ1wiKTtcbiAgICAgIGlmIChyZXN0b3JlUmVnaXN0cmF0aW9uKSB0aGlzLnBsdWdpbi5jYW5jZWxHbG9iYWxTaG9ydGN1dFJlY29yZGluZygpO1xuICAgIH07XG4gICAgY29uc3Qgb25LZXlEb3duID0gKGV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICBpZiAoZXZlbnQucmVwZWF0KSByZXR1cm47XG4gICAgICBpZiAoZXZlbnQua2V5ID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICAgIGZpbmlzaCh0cnVlKTtcbiAgICAgICAgcmVjb3JkZXJCdXR0b24uc2V0VGV4dChwcmV2aW91c0xhYmVsKTtcbiAgICAgICAgY2xlYXJCdXR0b24uZGlzYWJsZWQgPSAhdGhpcy5wbHVnaW4uc2V0dGluZ3MuZ2xvYmFsVG9nZ2xlU2hvcnRjdXQ7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGFjY2VsZXJhdG9yID0gYWNjZWxlcmF0b3JGb3JFdmVudChldmVudCk7XG4gICAgICBpZiAoIWFjY2VsZXJhdG9yKSByZXR1cm47XG5cbiAgICAgIGZpbmlzaChmYWxzZSk7XG4gICAgICByZWNvcmRlckJ1dHRvbi5zZXRUZXh0KGRpc3BsYXlBY2NlbGVyYXRvcihhY2NlbGVyYXRvcikpO1xuICAgICAgY2xlYXJCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uc2V0R2xvYmFsVG9nZ2xlU2hvcnRjdXQoYWNjZWxlcmF0b3IpO1xuICAgIH07XG4gICAgY29uc3Qgb25Qb2ludGVyRG93biA9IChldmVudDogUG9pbnRlckV2ZW50KSA9PiB7XG4gICAgICBpZiAoZXZlbnQudGFyZ2V0ID09PSByZWNvcmRlckJ1dHRvbiB8fCByZWNvcmRlckJ1dHRvbi5jb250YWlucyhldmVudC50YXJnZXQgYXMgTm9kZSkpIHJldHVybjtcbiAgICAgIGZpbmlzaCh0cnVlKTtcbiAgICAgIHJlY29yZGVyQnV0dG9uLnNldFRleHQocHJldmlvdXNMYWJlbCk7XG4gICAgICBjbGVhckJ1dHRvbi5kaXNhYmxlZCA9ICF0aGlzLnBsdWdpbi5zZXR0aW5ncy5nbG9iYWxUb2dnbGVTaG9ydGN1dDtcbiAgICB9O1xuICAgIGNvbnN0IGRvY3VtZW50ID0gcmVjb3JkZXJCdXR0b24ub3duZXJEb2N1bWVudDtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBvbktleURvd24sIHRydWUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVyZG93blwiLCBvblBvaW50ZXJEb3duLCB0cnVlKTtcbiAgICB0aGlzLnNob3J0Y3V0UmVjb3JkaW5nQ2xlYW51cCA9ICgpID0+IHtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIG9uS2V5RG93biwgdHJ1ZSk7XG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9pbnRlcmRvd25cIiwgb25Qb2ludGVyRG93biwgdHJ1ZSk7XG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgc3RvcFNob3J0Y3V0UmVjb3JkaW5nKHJlc3RvcmVSZWdpc3RyYXRpb246IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuc2hvcnRjdXRSZWNvcmRpbmdDbGVhbnVwKSByZXR1cm47XG4gICAgY29uc3QgY2xlYW51cCA9IHRoaXMuc2hvcnRjdXRSZWNvcmRpbmdDbGVhbnVwO1xuICAgIHRoaXMuc2hvcnRjdXRSZWNvcmRpbmdDbGVhbnVwID0gbnVsbDtcbiAgICBjbGVhbnVwKCk7XG4gICAgaWYgKHJlc3RvcmVSZWdpc3RyYXRpb24pIHRoaXMucGx1Z2luLmNhbmNlbEdsb2JhbFNob3J0Y3V0UmVjb3JkaW5nKCk7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUEsMEVBQUFBLFVBQUE7QUFBQTtBQUNBLFdBQU8sZUFBZUEsVUFBUyxjQUFjLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDNUQsSUFBQUEsU0FBUSxvQkFBb0I7QUFDNUIsUUFBTSxvQkFBTixNQUF3QjtBQUFBLE1BQ3BCLGNBQWM7QUFDVixhQUFLLFNBQVM7QUFDZCxhQUFLLFlBQVksQ0FBQztBQUNsQixhQUFLLGNBQWMsb0JBQUksUUFBUTtBQUMvQixhQUFLLGVBQWUsb0JBQUksUUFBUTtBQUFBLE1BQ3BDO0FBQUEsTUFDQSxJQUFJLFVBQVU7QUFFVixZQUFJLEtBQUssS0FBSyxZQUFZLElBQUksUUFBUTtBQUN0QyxZQUFJLE1BQU07QUFDTixpQkFBTztBQUNYLGFBQUssS0FBSyxVQUFVO0FBQ3BCLGFBQUssVUFBVSxFQUFFLElB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Tyw2QkFBNkI7QUFDekMsVUFBTSxnQkFBZ0IsbUJBQW1CLEtBQUssT0FBTyxTQUFTLG9CQUFvQjtBQUNsRixtQkFBZSxRQUFRLHNCQUFpQjtBQUN4QyxtQkFBZSxTQUFTLGNBQWM7QUFDdEMsZ0JBQVksV0FBVztBQUN2QixtQkFBZSxNQUFNO0FBRXJCLFVBQU0sU0FBUyxDQUFDLHdCQUFpQztBQUMvQyxZQUFNLFVBQVUsS0FBSztBQUNyQixXQUFLLDJCQUEyQjtBQUNoQyxnQkFBVTtBQUNWLHFCQUFlLFlBQVksY0FBYztBQUN6QyxVQUFJLG9CQUFxQixNQUFLLE9BQU8sOEJBQThCO0FBQUEsSUFDckU7QUFDQSxVQUFNLFlBQVksQ0FBQyxVQUF5QjtBQUMxQyxZQUFNLGVBQWU7QUFDckIsWUFBTSx5QkFBeUI7QUFDL0IsVUFBSSxNQUFNLE9BQVE7QUFDbEIsVUFBSSxNQUFNLFFBQVEsVUFBVTtBQUMxQixlQUFPLElBQUk7QUFDWCx1QkFBZSxRQUFRLGFBQWE7QUFDcEMsb0JBQVksV0FBVyxDQUFDLEtBQUssT0FBTyxTQUFTO0FBQzdDO0FBQUEsTUFDRjtBQUNBLFlBQU0sY0FBYyxvQkFBb0IsS0FBSztBQUM3QyxVQUFJLENBQUMsWUFBYTtBQUVsQixhQUFPLEtBQUs7QUFDWixxQkFBZSxRQUFRLG1CQUFtQixXQUFXLENBQUM7QUFDdEQsa0JBQVksV0FBVztBQUN2QixXQUFLLEtBQUssT0FBTyx3QkFBd0IsV0FBVztBQUFBLElBQ3REO0FBQ0EsVUFBTSxnQkFBZ0IsQ0FBQyxVQUF3QjtBQUM3QyxVQUFJLE1BQU0sV0FBVyxrQkFBa0IsZUFBZSxTQUFTLE1BQU0sTUFBYyxFQUFHO0FBQ3RGLGFBQU8sSUFBSTtBQUNYLHFCQUFlLFFBQVEsYUFBYTtBQUNwQyxrQkFBWSxXQUFXLENBQUMsS0FBSyxPQUFPLFNBQVM7QUFBQSxJQUMvQztBQUNBLFVBQU0sV0FBVyxlQUFlO0FBQ2hDLGFBQVMsaUJBQWlCLFdBQVcsV0FBVyxJQUFJO0FBQ3BELGFBQVMsaUJBQWlCLGVBQWUsZUFBZSxJQUFJO0FBQzVELFNBQUssMkJBQTJCLE1BQU07QUFDcEMsZUFBUyxvQkFBb0IsV0FBVyxXQUFXLElBQUk7QUFDdkQsZUFBUyxvQkFBb0IsZUFBZSxlQUFlLElBQUk7QUFBQSxJQUNqRTtBQUFBLEVBQ0Y7QUFBQSxFQUVRLHNCQUFzQixxQkFBb0M7QUFDaEUsUUFBSSxDQUFDLEtBQUsseUJBQTBCO0FBQ3BDLFVBQU0sVUFBVSxLQUFLO0FBQ3JCLFNBQUssMkJBQTJCO0FBQ2hDLFlBQVE7QUFDUixRQUFJLG9CQUFxQixNQUFLLE9BQU8sOEJBQThCO0FBQUEsRUFDckU7QUFDRjsiLAogICJuYW1lcyI6IFsiZXhwb3J0cyIsICJleHBvcnRzIiwgImV4cG9ydHMiLCAiZXhwb3J0cyIsICJleHBvcnRzIiwgIlByb21pc2UiLCAibW9kdWxlIiwgImV4cG9ydHMiLCAicmVxdWlyZV9yZW5kZXJlciIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJ3aW5kb3ciXQp9Cg==
