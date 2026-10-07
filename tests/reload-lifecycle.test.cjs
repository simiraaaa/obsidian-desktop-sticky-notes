const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHarness } = require("./obsidian-harness.cjs");

const settled = () => new Promise((resolve) => setImmediate(resolve));
const floatingLeaves = (layout) => (layout.floating?.children ?? []).map((window) => window.children[0].children[0]);
const isSticky = (leaf) => leaf.document.body.classList.contains("desktop-sticky-note");

async function advanceTimers(h, turns) {
  for (let turn = 0; turn < turns; turn++) {
    h.flushTimers(true);
    await settled();
  }
}

test("the built-in reload saves window state, closes old popouts, and restores one window per leaf", async () => {
  const h = createHarness({ colorsByPath: { "Notes/Example.md": "#b0e0ff" } }, true);
  h.addLeaf("main", { popout: false });
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const ordinary = h.addLeaf("ordinary");
  const first = h.leaves.get("new-1");
  first.view.mode = "preview";
  h.reload();
  h.reload();
  await settled();

  assert.equal(h.reloadCalls(), 1, "repeated reload input must share one shutdown");
  assert.equal(h.workspace.layoutReady, false, "old callbacks cannot overwrite the saved layout");
  assert.equal(h.plugin.quitting, true);
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["new-1", "new-2"]);
  for (const leaf of [first, ordinary]) {
    assert.equal(leaf.nativeWindow.isDestroyed(), true);
    assert.equal(leaf.nativeWindow.destroys, 0, "use Obsidian's normal close, not forced destruction");
  }
  const serialized = floatingLeaves(h.workspace.savedLayout);
  assert.deepEqual(serialized.map((leaf) => leaf.state.state.desktopStickyNote ?? false), [true, true, false]);
  assert.equal(serialized[0].state.state.mode, "preview");
  h.workspace.requestSaveLayout();
  await h.workspace.requestSaveLayout.run();
  assert.equal(floatingLeaves(h.workspace.savedLayout).length, 3, "late old-context writes must not save an empty layout");

  const restarted = createHarness(h.saved());
  await restarted.plugin.onload();
  const leaves = [];
  for (const state of serialized) {
    const leaf = restarted.addLeaf(state.id);
    await leaf.setViewState(state.state);
    leaves.push(leaf);
  }
  restarted.ready();
  await settled();
  assert.deepEqual(leaves.map(isSticky), [true, true, false]);
  assert.equal(leaves[0].view.mode, "preview");
  assert.equal(leaves[0].document.body.style.getPropertyValue("--sticky-note-background"), "#b0e0ff");
  assert.equal(leaves[0].view.actions.children.length, 4);
  assert.equal(restarted.workspace.popoutsOpened, 0);
});

test("a standard close followed immediately by reload keeps the last note closed", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const note = [...h.plugin.allNotes()][0];
  const leaf = note.leaf;
  const close = leaf.nativeWindow.close.bind(leaf.nativeWindow);
  leaf.nativeWindow.close = () => {
    leaf.container = {};
    leaf.view = { app: h.plugin.app, containerEl: { ownerDocument: h.mainDocument } };
    close();
  };
  leaf.nativeWindow.close();
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
  assert.equal([...h.plugin.allNotes()].length, 0);
  assert.equal(h.plugin.stickyStateLeaves.has(leaf), false);
  h.reload(); // Do not run the window-close save timer first.
  await settled();
  assert.equal(h.reloadCalls(), 1);
  assert.equal(floatingLeaves(h.workspace.savedLayout).length, 0);
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
  assert.equal(leaf.getViewState().state.desktopStickyNote, undefined);
});

test("a restored window can be closed before native initialization succeeds", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const leaf = h.addLeaf("sticky", { native: false });
  await h.plugin.onload();
  assert.equal(isSticky(leaf), false);
  leaf.nativeWindow.close();
  await settled();
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
  assert.equal(h.plugin.initializingLeaves.size, 0);
  h.reload();
  await settled();
  assert.equal(h.reloadCalls(), 1);
  assert.equal(floatingLeaves(h.workspace.savedLayout).length, 0);
});

for (const markerOnly of [false, true]) {
  test(`closing a ${markerOnly ? "workspace-marked" : "legacy"} note before layout readiness persists its removal`, async () => {
    const h = createHarness(markerOnly ? {} : { stickyNoteLeafIds: ["sticky"] });
    const leaf = h.addLeaf("sticky", {
      deferred: true,
      state: markerOnly ? { desktopStickyNote: true } : {}
    });
    await h.plugin.onload();
    assert.equal(leaf.loadCalls, 0, "closure observation must not activate a deferred editor during startup");
    leaf.nativeWindow.close();
    h.flushTimers(); // A close save attempted before readiness must remain pending.
    h.ready();
    await settled();
    assert.deepEqual(h.saved().stickyNoteLeafIds, []);
    assert.equal(floatingLeaves(h.workspace.savedLayout).length, 0);
    h.reload();
    await settled();
    assert.equal(h.reloadCalls(), 1);
    assert.equal(floatingLeaves(h.workspace.savedLayout).length, 0);
    assert.equal(h.workspace.popoutsOpened, 0);
  });
}

test("reload waits for editor saves before closing windows and blocks the global toggle while waiting", async () => {
  const h = createHarness({ topLevelNotePath: "Notes/Example.md" }, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const leaf = h.leaves.get("new-1");
  let finishSave;
  let saved = false;
  const saving = new Promise((resolve) => { finishSave = () => { saved = true; resolve(); }; });
  leaf.view.save = () => saved ? Promise.resolve() : saving;
  h.reload();
  await settled();
  h.pressShortcut();
  await settled();
  assert.equal(h.plugin.reloading, true);
  assert.equal(leaf.nativeWindow.closes, 0);
  assert.equal(h.reloadCalls(), 0);
  assert.equal(h.workspace.popoutsOpened, 1);
  finishSave();
  await settled();
  assert.equal(leaf.nativeWindow.closes, 1);
  assert.equal(h.reloadCalls(), 1);
});

test("a popout opened while saving must close before reload can proceed", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const first = h.leaves.get("new-1");
  let finishSave;
  let saved = false;
  const saving = new Promise((resolve) => { finishSave = () => { saved = true; resolve(); }; });
  first.view.save = () => saved ? Promise.resolve() : saving;
  h.reload();
  await settled();
  const late = h.addLeaf("late");
  late.nativeWindow.close = () => { late.nativeWindow.closes++; };
  finishSave();
  await settled();
  await advanceTimers(h, 60);
  assert.equal(late.nativeWindow.closes, 1);
  assert.equal(late.document.defaultView.closed, undefined);
  assert.equal(late.nativeWindow.destroys, 0);
  assert.equal(floatingLeaves(h.workspace.savedLayout).length, 2);
  assert.equal(h.reloadCalls(), 0, "a surviving late popout must not gain a replacement on reload");
  assert.equal(h.plugin.reloading, false);
});

test("a window opened after quit starts is still included in the reload close wait", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  let finishTask;
  const task = new Promise((resolve) => { finishTask = resolve; });
  h.workspace.on("quit", (tasks) => tasks.addPromise(task));
  h.reload();
  await settled();
  const late = h.addLeaf("late");
  h.workspace.trigger("window-open", late.container, late.document.defaultView);
  // Even an empty window without a current leaf belongs to this reload wait.
  h.leaves.delete("late");
  finishTask();
  await settled();
  await advanceTimers(h, 60);
  assert.equal(h.reloadCalls(), 0);
  assert.equal(late.nativeWindow.destroys, 0);
  assert.equal(h.plugin.reloading, false);
});

test("reload waits for outstanding color settings and saves the latest color", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const note = [...h.plugin.allNotes()][0];
  const saveData = h.plugin.saveData.bind(h.plugin);
  let finishSave;
  let first = true;
  const saving = new Promise((resolve) => { finishSave = resolve; });
  h.plugin.saveData = async (settings) => {
    const snapshot = structuredClone(settings);
    if (first) { first = false; await saving; }
    await saveData(snapshot);
  };
  h.plugin.applyColor(note, "#b0e0ff");
  h.plugin.applyColor(note, "#ffe0b0");
  h.reload();
  await settled();
  assert.equal(h.reloadCalls(), 0);
  assert.equal(note.window.closes, 0);
  finishSave();
  await settled();
  assert.equal(h.reloadCalls(), 1);
  assert.equal(h.saved().colorsByPath["Notes/Example.md"], "#ffe0b0");
});

test("reload awaits position saves triggered by a delayed native close", async () => {
  const h = createHarness({ topLevelNotePath: "Notes/Example.md" }, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const note = [...h.plugin.allNotes()][0];
  const close = note.window.close.bind(note.window);
  note.window.getPosition = () => [700, 800];
  note.window.close = () => { note.window.closes++; };
  h.reload();
  await settled();
  const saveData = h.plugin.saveData.bind(h.plugin);
  let finishSave;
  const saving = new Promise((resolve) => { finishSave = resolve; });
  h.plugin.saveData = async (settings) => { await saving; await saveData(settings); };
  close();
  h.flushTimers(true);
  await settled();
  assert.equal(note.window.isDestroyed(), true);
  assert.equal(h.reloadCalls(), 0);
  assert.equal(h.saved().topLevelWindowPosition, null);
  finishSave();
  await settled();
  assert.equal(h.reloadCalls(), 1);
  assert.deepEqual(h.saved().topLevelWindowPosition, { x: 700, y: 800 });
});

test("settings changed during the final save must also finish before reload", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const saveData = h.plugin.saveData.bind(h.plugin);
  let calls = 0;
  let finishFinalSave;
  let finishNewerSave;
  const finalSave = new Promise((resolve) => { finishFinalSave = resolve; });
  const newerSave = new Promise((resolve) => { finishNewerSave = resolve; });
  h.plugin.saveData = async (settings) => {
    const snapshot = structuredClone(settings);
    if (++calls === 2) await finalSave;
    else if (calls === 3) await newerSave;
    await saveData(snapshot);
  };
  h.reload();
  await settled();
  assert.equal(calls, 2);
  h.plugin.settings.defaultNoteColor = "#ffffff";
  const saving = h.plugin.saveSettings();
  finishFinalSave();
  await settled();
  assert.equal(calls, 3);
  assert.equal(h.saved().defaultNoteColor, "#fff3a3");
  assert.equal(h.reloadCalls(), 0);
  finishNewerSave();
  await saving;
  await settled();
  assert.equal(h.saved().defaultNoteColor, "#ffffff");
  assert.equal(h.reloadCalls(), 1);
});

for (const disable of [false, true]) {
  test(`${disable ? "disabling" : "opening a window"} during the final settings save prevents reload`, async () => {
    const h = createHarness({}, true);
    await h.plugin.onload();
    await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
    const saveData = h.plugin.saveData.bind(h.plugin);
    let calls = 0;
    let finishSave;
    const saving = new Promise((resolve) => { finishSave = resolve; });
    h.plugin.saveData = async (settings) => {
      if (++calls === 2) await saving;
      await saveData(settings);
    };
    h.reload();
    await settled();
    assert.equal(calls, 2);
    assert.equal(h.leaves.size, 0, "the old window has already closed before the final save");
    if (disable) {
      h.plugin.unload();
    } else {
      const late = h.addLeaf("late");
      h.workspace.trigger("window-open", late.container, late.document.defaultView);
    }
    finishSave();
    await settled();
    await advanceTimers(h, 60);
    assert.equal(h.reloadCalls(), 0);
    assert.equal(h.plugin.reloading, false);
  });
}

test("a failed settings save stops reload before closing editors", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const note = [...h.plugin.allNotes()][0];
  h.plugin.saveData = async () => { throw new Error("Synthetic settings save failure"); };
  h.reload();
  await settled();
  assert.equal(h.reloadCalls(), 0);
  assert.equal(note.window.closes, 0);
  assert.equal(h.workspace.layoutReady, true);
  assert.equal(h.plugin.reloading, false);
  assert.match(h.notices.at(-1), /Reload stopped/);
});

test("a failed editor save cancels reload before any windows close", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const leaf = h.leaves.get("new-1");
  leaf.view.save = async () => { throw new Error("Synthetic save failure"); };
  h.reload();
  await settled();
  assert.equal(h.reloadCalls(), 0);
  assert.equal(leaf.nativeWindow.closes, 0);
  assert.equal(h.workspace.layoutReady, true);
  assert.equal(h.plugin.quitting, false);
  assert.equal(h.plugin.reloading, false);
  assert.equal([...h.plugin.allNotes()].length, 1);
  assert.match(h.notices.at(-1), /Reload stopped/);
});

test("reload awaits tasks contributed by Obsidian and other plugins", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  let finishTask;
  const pending = new Promise((resolve) => { finishTask = resolve; });
  let taskStarted = false;
  h.workspace.on("quit", (tasks) => {
    tasks.add(() => { taskStarted = true; return pending; });
    assert.equal(tasks.isEmpty(), false);
  });
  h.reload();
  await settled();
  assert.equal(taskStarted, true);
  assert.equal(h.reloadCalls(), 0);
  assert.equal(h.workspace.layoutReady, false);
  finishTask();
  await settled();
  assert.equal(h.reloadCalls(), 1);
});

test("a canceled popout close aborts reload without destroying its editor", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const leaf = h.leaves.get("new-1");
  leaf.nativeWindow.close = () => {
    leaf.nativeWindow.closes++;
    leaf.document.defaultView.dispatchEvent(new Event("beforeunload"));
  };
  h.reload();
  await settled();
  await advanceTimers(h, 60);
  assert.equal(h.reloadCalls(), 0);
  assert.equal(leaf.nativeWindow.destroys, 0);
  assert.equal(h.workspace.layoutReady, true);
  assert.equal(h.plugin.quitting, false);
  assert.equal(h.plugin.reloading, false);
  assert.equal(h.plugin.closingLeaves.has(leaf), false);
  assert.equal([...h.plugin.allNotes()].length, 1);
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["new-1"]);
});

test("disabling during an editor save cancels the pending reload", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/Example.md"));
  const leaf = h.leaves.get("new-1");
  let finishSave;
  leaf.view.save = () => new Promise((resolve) => { finishSave = resolve; });
  h.reload();
  await settled();
  h.plugin.unload();
  finishSave();
  await settled();
  assert.equal(h.reloadCalls(), 0);
  assert.equal(h.workspace.layoutReady, true);
  assert.equal(h.plugin.reloading, false);
});

test("reload callbacks chain safely and pass through after this plugin unloads", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  const command = h.plugin.app.commands.commands["app:reload"];
  const wrapped = command.callback;
  let laterCalls = 0;
  const later = () => { laterCalls++; return wrapped(); };
  command.callback = later;
  h.plugin.unload();
  assert.equal(command.callback, later);
  h.reload();
  assert.equal(laterCalls, 1);
  assert.equal(h.reloadCalls(), 1);
});

test("closing a former window does not forget a leaf moved into the main workspace", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const leaf = h.addLeaf("sticky");
  await h.plugin.onload();
  const originalContainer = leaf.container;
  const originalWindow = leaf.document.defaultView;
  leaf.container = {};
  leaf.view.containerEl.ownerDocument = h.mainDocument;
  h.workspace.trigger("window-close", originalContainer, originalWindow);
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["sticky"]);
  assert.equal(h.plugin.closingLeaves.has(leaf), false);
  assert.equal(isSticky({ document: h.mainDocument }), false);
});
