const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHarness } = require("./obsidian-harness.cjs");

const settled = () => new Promise((resolve) => setImmediate(resolve));
const isSticky = (leaf) => leaf.document.body.classList.contains("desktop-sticky-note");
const action = (leaf, title) => leaf.view.actions.children.find((element) => element.title === title);

async function advanceTimers(h, turns = 1) {
  for (let turn = 0; turn < turns; turn++) {
    h.flushTimers(true);
    await settled();
  }
}

test("the registered global shortcut opens, hides, and reopens a note absent from the layout snapshot", async () => {
  const h = createHarness({ topLevelNotePath: "Notes/Example.md" }, true);
  const main = h.addLeaf("main", { popout: false });
  h.workspace.getLayout = () => ({ main: { type: "leaf", id: "main" } });
  await h.plugin.onload();

  h.pressShortcut();
  await settled();
  const first = h.leaves.get("new-1");
  assert.ok(first, "a new popout must stay open even before it is serialized");
  assert.equal(isSticky(first), true);
  assert.equal(first.view.actions.children.length, 4);
  assert.equal(first.detaches, 0);
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["new-1"]);

  h.pressShortcut();
  await settled();
  assert.equal(first.nativeWindow.closes, 1);
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
  h.flushTimers();

  h.pressShortcut();
  await settled();
  const reopened = h.leaves.get("new-2");
  assert.ok(reopened);
  assert.equal(isSticky(reopened), true);
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["new-2"]);
  assert.equal(h.workspace.popoutsOpened, 2);
  assert.equal(isSticky(main), false);
  assert.equal(h.notices.length, 0);
});

test("a note remains usable while its workspace identity is pending and saves it on a later layout event", async () => {
  const h = createHarness({}, true);
  const originalOpen = h.workspace.openPopoutLeaf.bind(h.workspace);
  const originalLayout = h.workspace.getLayout.bind(h.workspace);
  h.workspace.openPopoutLeaf = () => {
    const leaf = originalOpen();
    delete leaf.id;
    return leaf;
  };
  h.workspace.getLayout = () => ({});
  await h.plugin.onload();
  await h.plugin.openStickyNote(new h.TFile("Notes/New.md"));
  const leaf = h.leaves.get("new-1");
  assert.ok(leaf);
  assert.equal(isSticky(leaf), true);
  assert.equal(leaf.view.actions.children.length, 4);
  assert.deepEqual(h.saved().stickyNoteLeafIds ?? [], []);
  assert.equal(h.notices.length, 0);

  leaf.id = "new-1";
  h.workspace.getLayout = originalLayout;
  h.workspace.trigger("layout-change");
  h.flushTimers();
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["new-1"]);
});

test("the global shortcut cannot clear the designated note while the vault is still loading", async () => {
  const h = createHarness({ topLevelNotePath: "Notes/Example.md" });
  await h.plugin.onload();
  h.pressShortcut();
  await settled();
  assert.equal(h.plugin.settings.topLevelNotePath, "Notes/Example.md");
  assert.equal(h.workspace.popoutsOpened, 0);

  h.addLeaf("main", { popout: false });
  h.ready();
  h.pressShortcut();
  await settled();
  assert.equal(isSticky(h.leaves.get("new-1")), true);
});

test("hiding a restored note removes its known identity even if the layout snapshot is incomplete", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["saved"] }, true);
  const leaf = h.addLeaf("saved");
  delete leaf.id;
  h.workspace.getLayout = () => ({});
  await h.plugin.onload();
  assert.equal(isSticky(leaf), true);
  action(leaf, "Hide sticky note").callback();
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
});

test("opening notes persists distinct workspace IDs and survives a full restart", async () => {
  const first = createHarness({ colorsByPath: { "Notes/Example.md": "#b0e0ff" } }, true);
  await first.plugin.onload();
  const file = new first.TFile("Notes/Example.md");
  await first.plugin.openStickyNote(file);
  await first.plugin.openStickyNote(file);
  const ids = first.saved().stickyNoteLeafIds;
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  first.workspace.trigger("quit");
  first.plugin.unload();

  const restarted = createHarness(first.saved());
  const sticky = restarted.addLeaf(ids[0]);
  const secondSticky = restarted.addLeaf(ids[1]);
  const ordinary = restarted.addLeaf("ordinary");
  const main = restarted.addLeaf("main", { popout: false });
  sticky.view.mode = "preview";
  await restarted.plugin.onload();
  assert.equal(isSticky(sticky), false, "wait for the layout, not plugin load");
  restarted.ready();
  await settled();

  for (const note of [sticky, secondSticky]) {
    assert.equal(isSticky(note), true);
    assert.equal(note.document.body.style.getPropertyValue("--sticky-note-background"), "#b0e0ff");
    assert.equal(note.view.actions.children.length, 4);
    assert.equal(note.detaches, 0);
  }
  assert.equal(isSticky(ordinary), false);
  assert.equal(isSticky(main), false);
  assert.equal(restarted.workspace.popoutsOpened, 0, "reuse restored windows without duplicates");
  assert.equal(sticky.view.mode, "preview");
  action(sticky, "Keep on top").callback();
  assert.equal(sticky.nativeWindow.isAlwaysOnTop(), true);
  action(sticky, "Switch to edit mode").callback();
  assert.equal(sticky.view.mode, "source");
  action(sticky, "Hide sticky note").callback();
  assert.deepEqual(restarted.saved().stickyNoteLeafIds, [ids[1]]);
  assert.equal(sticky.nativeWindow.closes, 1);
  assert.equal(isSticky(ordinary), false);
});

test("workspace markers restore notes when saved IDs are missing or change across restart", async () => {
  const first = createHarness({ colorsByPath: { "Notes/Example.md": "#b0e0ff" } }, true);
  await first.plugin.onload();
  await first.plugin.openStickyNote(new first.TFile("Notes/Example.md"));
  await first.plugin.openStickyNote(new first.TFile("Notes/Example.md"));
  const ordinary = first.addLeaf("ordinary");
  const firstNote = first.leaves.get("new-1");
  await firstNote.view.setState({ mode: "preview" });
  const serialized = first.workspace.getLayout().floating.children.map((window) => window.children[0].children[0].state);
  assert.deepEqual(serialized.map((state) => state.state.desktopStickyNote ?? false), [true, true, false]);
  assert.equal(ordinary.getViewState().state.desktopStickyNote, undefined);
  first.mainDocument.defaultView.dispatchEvent(new Event("beforeunload"));
  first.plugin.unload();

  // Rebuild the workspace with different IDs and no ID record in plugin data.
  // Deserialization must recover each window from its own state, not its path.
  const restarted = createHarness({ ...first.saved(), stickyNoteLeafIds: [] });
  await restarted.plugin.onload();
  const leaves = [];
  for (const [index, state] of serialized.entries()) {
    const leaf = restarted.addLeaf(`restored-${index}`);
    await leaf.setViewState(state);
    leaves.push(leaf);
  }
  restarted.ready();
  await settled();
  assert.deepEqual(leaves.map(isSticky), [true, true, false]);
  assert.equal(leaves[0].view.getMode(), "preview");
  assert.equal(leaves[0].document.body.style.getPropertyValue("--sticky-note-background"), "#b0e0ff");
  assert.equal(leaves[0].view.actions.children.length, 4);
  assert.deepEqual(restarted.saved().stickyNoteLeafIds, ["restored-0", "restored-1"]);
  assert.equal(restarted.workspace.popoutsOpened, 0);
  action(leaves[0], "Hide sticky note").callback();
  assert.equal(leaves[0].getViewState().state.desktopStickyNote, undefined);
  assert.equal(leaves[0].nativeWindow.closes, 1);
});

test("marked deferred windows restore without saved IDs and leave ordinary views deferred", async () => {
  const h = createHarness({}, true);
  const leaf = h.addLeaf("sticky", { deferred: true, state: { desktopStickyNote: true, mode: "preview" } });
  const ordinary = h.addLeaf("ordinary", { deferred: true });
  await h.plugin.onload();
  assert.equal(leaf.loadCalls, 1);
  assert.equal(ordinary.loadCalls, 0);
  leaf.finishLoading();
  await settled();
  assert.equal(isSticky(leaf), true);
  assert.equal(leaf.getViewState().state.desktopStickyNote, true);
  assert.equal(leaf.view.getMode(), "preview");
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["sticky"]);
});

test("discovers late marked popouts without saved IDs or another layout event and stops scanning", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  const leaf = h.addLeaf("late-marked", { deferred: true, state: { desktopStickyNote: true } });
  await advanceTimers(h);
  assert.equal(leaf.loadCalls, 1);
  leaf.finishLoading();
  await settled();
  assert.equal(isSticky(leaf), true);
  await advanceTimers(h, 30);
  assert.equal(h.pendingTimers(), 0);
});

test("disabling before restoration closes all marked windows without a saved ID record", async () => {
  const h = createHarness();
  const marked = ["one", "two"].map((id) => h.addLeaf(id, { deferred: true, state: { desktopStickyNote: true } }));
  const ordinary = h.addLeaf("ordinary", { deferred: true });
  await h.plugin.onload();
  h.plugin.unload();
  for (const leaf of marked) assert.equal(leaf.detaches, 1);
  assert.equal(ordinary.detaches, 0);
  assert.equal(ordinary.nativeWindow.closes, 0);
});

test("workspace markers require a boolean and never style the main document or another app", async () => {
  const h = createHarness({}, true);
  await h.plugin.onload();
  const ordinary = [];
  for (const [index, marker] of ["true", 1, false].entries()) {
    const leaf = h.addLeaf(`ordinary-${index}`);
    await leaf.setViewState({ type: "markdown", state: { desktopStickyNote: marker } });
    ordinary.push(leaf);
  }
  const main = h.addLeaf("main", { popout: false });
  await main.setViewState({ type: "markdown", state: { desktopStickyNote: true } });
  const foreign = h.addLeaf("foreign");
  foreign.view.app = {};
  await foreign.setViewState({ type: "markdown", state: { desktopStickyNote: true } });
  h.workspace.trigger("layout-change");
  await settled();
  for (const leaf of [...ordinary, main, foreign]) {
    assert.equal(isSticky(leaf), false);
    assert.equal(leaf.getViewState().state.desktopStickyNote, undefined);
  }
  assert.equal(h.saved().stickyNoteLeafIds, undefined);
});

test("marker serialization preserves Markdown state and releases wrappers without replacing another plugin", async () => {
  const h = createHarness({}, true);
  const leaf = h.addLeaf("sticky");
  const prototype = Object.getPrototypeOf(leaf);
  const originalGet = prototype.getViewState;
  const originalSet = prototype.setViewState;
  const markdownState = { file: leaf.view.file.path, mode: "preview", source: true, backlinks: true };
  leaf.view.getState = () => markdownState;
  await h.plugin.onload();
  await leaf.setViewState({ type: "markdown", state: { desktopStickyNote: true } });
  assert.deepEqual({ ...leaf.getViewState().state }, { ...markdownState, desktopStickyNote: true });
  assert.equal(markdownState.desktopStickyNote, undefined, "do not mutate the core view's state object");
  const stickyGet = prototype.getViewState;
  const laterGet = function () { return stickyGet.call(this); };
  prototype.getViewState = laterGet;
  h.plugin.unload();
  assert.equal(prototype.getViewState, laterGet);
  assert.equal(prototype.setViewState, originalSet);
  assert.equal(leaf.getViewState().state.desktopStickyNote, undefined);
  assert.deepEqual(leaf.getViewState(), originalGet.call(leaf));
});

test("restores deferred and late-arriving popouts once without activating them", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["deferred", "late"] });
  const deferred = h.addLeaf("deferred", { deferred: true });
  const ordinary = h.addLeaf("ordinary", { deferred: true });
  await h.plugin.onload();
  h.workspace.trigger("layout-change");
  assert.equal(deferred.loadCalls, 0);
  h.ready();
  h.workspace.trigger("layout-change");
  h.workspace.trigger("layout-change");
  assert.equal(deferred.loadCalls, 1);
  assert.equal(ordinary.loadCalls, 0);
  deferred.finishLoading();
  await settled();
  assert.equal(isSticky(deferred), true);
  assert.equal(deferred.nativeWindow.focused, false);
  await h.plugin.openStickyNote(new h.TFile("Notes/New.md"));
  const late = h.addLeaf("late");
  h.workspace.trigger("layout-change");
  await advanceTimers(h);
  assert.equal(isSticky(late), true);
  assert.equal(deferred.view.actions.children.length, 4);
});

test("ignores missing leaves, main-window leaves, and non-Markdown views", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["gone", "main", "other"] }, true);
  const main = h.addLeaf("main", { popout: false });
  const other = h.addLeaf("other");
  other.view = { containerEl: other.view.containerEl };
  await h.plugin.onload();
  assert.equal(isSticky(main), false);
  assert.equal(isSticky(other), false);
  assert.equal(h.workspace.popoutsOpened, 0);
  assert.equal(main.detaches + other.detaches, 0);
});

test("restores on Obsidian versions predating deferred views", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true, false);
  const leaf = h.addLeaf("sticky");
  delete leaf.isDeferred;
  delete leaf.loadIfDeferred;
  await h.plugin.onload();
  assert.equal(isSticky(leaf), true);
});

for (const shutdown of ["quit", "reload"]) {
  test(`${shutdown} preserves the saved layout and identity, including when popouts unload first`, async () => {
    const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
    const leaf = h.addLeaf("sticky");
    await h.plugin.onload();
    const saves = h.workspace.layoutSaves;
    h.workspace.trigger("layout-change");
    leaf.document.defaultView.dispatchEvent(new Event("beforeunload"));
    if (shutdown === "quit") h.workspace.trigger("quit");
    else h.mainDocument.defaultView.dispatchEvent(new Event("beforeunload"));
    h.plugin.unload();
    h.flushTimers();
    assert.deepEqual(h.saved().stickyNoteLeafIds, ["sticky"]);
    assert.equal(leaf.detaches, 0);
    assert.equal(leaf.nativeWindow.closes, 0);
    assert.equal(h.workspace.layoutSaves, saves);
  });
}

test("disabling closes sticky windows, clears their IDs, and cancels pending restoration", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky", "deferred"] }, true);
  const leaf = h.addLeaf("sticky");
  const deferred = h.addLeaf("deferred", { deferred: true });
  await h.plugin.onload();
  h.plugin.unload();
  deferred.finishLoading();
  await settled();
  h.flushTimers();
  assert.equal(leaf.detaches, 1);
  assert.equal(leaf.nativeWindow.closes, 1);
  assert.equal(deferred.detaches, 1);
  assert.equal(deferred.nativeWindow.closes, 1);
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
  assert.equal(isSticky(deferred), false);
});

test("layout events during popout shutdown do not reinitialize the closing window", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const leaf = h.addLeaf("sticky");
  await h.plugin.onload();
  const saves = h.workspace.layoutSaves;
  leaf.document.defaultView.dispatchEvent(new Event("beforeunload"));
  h.workspace.trigger("layout-change");
  h.flushTimers();
  assert.equal(h.workspace.layoutSaves, saves);
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["sticky"]);
});

test("a queued layout-ready callback cannot restore notes after plugin unload", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky", "late"] });
  const leaf = h.addLeaf("sticky");
  await h.plugin.onload();
  h.plugin.unload();
  h.ready();
  assert.equal(isSticky(leaf), false);
  assert.equal(leaf.nativeWindow.closes, 1);
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["late"]);
  const enabled = createHarness(h.saved(), true);
  const late = enabled.addLeaf("late");
  await enabled.plugin.onload();
  assert.equal(isSticky(late), true);
});

test("does not initialize a deferred leaf closed or moved to the main window during restoration", async () => {
  for (const change of ["close", "move"]) {
    const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
    const leaf = h.addLeaf("sticky", { deferred: true });
    await h.plugin.onload();
    if (change === "close") h.leaves.delete("sticky");
    else leaf.container = {};
    leaf.finishLoading();
    await settled();
    assert.equal(isSticky(leaf), false);
  }
});

test("failed native-window lookup leaves the restored view intact and retries on layout change", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const leaf = h.addLeaf("sticky", { native: false });
  const originalTitle = leaf.document.title;
  await h.plugin.onload();
  await advanceTimers(h, 150);
  assert.equal(leaf.document.title, originalTitle);
  assert.equal(leaf.detaches, 0);
  assert.equal(h.notices.length, 0);
  assert.equal(h.pendingTimers(), 0, "failed restoration must stop polling");
  h.windows.push(leaf.nativeWindow);
  h.workspace.trigger("layout-change");
  await settled();
  assert.equal(isSticky(leaf), true);
});

test("restoration waits for DOM titles to reach Electron without another layout event", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const leaf = h.addLeaf("sticky", { asyncTitle: true });
  const ordinary = h.addLeaf("ordinary", { asyncTitle: true });
  await h.plugin.onload();
  assert.equal(isSticky(leaf), false, "the native title has not propagated yet");
  await advanceTimers(h, 3);
  assert.equal(isSticky(leaf), true);
  assert.equal(leaf.view.actions.children.length, 4);
  assert.equal(leaf.detaches, 0);
  assert.equal(isSticky(ordinary), false);
  assert.equal(h.notices.length, 0);
});

test("restoration waits for a view to reach its popout document and never styles the main window", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const main = h.addLeaf("main", { popout: false });
  const leaf = h.addLeaf("sticky");
  leaf.view.containerEl.ownerDocument = h.mainDocument;
  await h.plugin.onload();
  assert.equal(isSticky(main), false);
  assert.equal(isSticky(leaf), false);
  leaf.view.containerEl.ownerDocument = leaf.document;
  await advanceTimers(h, 3);
  assert.equal(isSticky(leaf), true);
  assert.equal(leaf.view.actions.children.length, 4);
  assert.equal(isSticky(main), false);
});

test("restores a native window that becomes available after layout readiness without another event", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const leaf = h.addLeaf("sticky", { native: false });
  await h.plugin.onload();
  h.windows.push(leaf.nativeWindow);
  await advanceTimers(h, 3);
  assert.equal(isSticky(leaf), true);
  assert.equal(leaf.view.actions.children.length, 4);
  assert.equal(h.workspace.popoutsOpened, 0);
});

test("restores a leaf arriving after the layout-ready callback without another event", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["late"] }, true);
  await h.plugin.onload();
  const leaf = h.addLeaf("late");
  await advanceTimers(h, 3);
  assert.equal(isSticky(leaf), true);
  assert.equal(h.workspace.popoutsOpened, 0);
});

test("a newly opened note saves its identity while native discovery is still pending", async () => {
  const h = createHarness({}, true);
  const originalOpen = h.workspace.openPopoutLeaf.bind(h.workspace);
  h.workspace.openPopoutLeaf = () => {
    const leaf = originalOpen();
    h.windows.splice(h.windows.indexOf(leaf.nativeWindow), 1);
    return leaf;
  };
  await h.plugin.onload();
  const opening = h.plugin.openStickyNote(new h.TFile("Notes/New.md"));
  await settled();
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["new-1"]);
  const leaf = h.leaves.get("new-1");
  const pendingTitle = leaf.document.title;
  h.workspace.trigger("layout-change");
  assert.equal(leaf.document.title, pendingTitle, "layout events must not start a competing title lookup");
  h.workspace.trigger("quit");
  h.plugin.unload();
  await advanceTimers(h);
  await opening;
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["new-1"]);
  assert.equal(leaf.detaches, 0);
});

test("failed discovery of a new note restores its title and removes the closed identity", async () => {
  const h = createHarness({}, true);
  const originalOpen = h.workspace.openPopoutLeaf.bind(h.workspace);
  h.workspace.openPopoutLeaf = () => {
    const leaf = originalOpen();
    h.windows.splice(h.windows.indexOf(leaf.nativeWindow), 1);
    return leaf;
  };
  await h.plugin.onload();
  const opening = h.plugin.openStickyNote(new h.TFile("Notes/New.md"));
  await settled();
  const leaf = h.leaves.get("new-1");
  await advanceTimers(h, 25);
  await opening;
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
  assert.equal(leaf.document.title, "Example — Obsidian");
  assert.equal(leaf.detaches, 1);
  assert.equal(h.leaves.size, 0);
  assert.equal(h.notices.length, 1);
  // Native lookup finishes before the bounded startup discovery period.
  await advanceTimers(h, 25);
  assert.equal(h.pendingTimers(), 0);
});

test("restoration cannot complete after shutdown, closing the popout, or moving it to the main window", async () => {
  for (const change of ["quit", "disable", "close", "beforeunload", "move"]) {
    const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
    const leaf = h.addLeaf("sticky", { native: false });
    const originalTitle = leaf.document.title;
    await h.plugin.onload();
    if (change === "quit") h.workspace.trigger("quit");
    else if (change === "disable") h.plugin.unload();
    else if (change === "close") leaf.nativeWindow.close();
    else if (change === "beforeunload") leaf.document.defaultView.dispatchEvent(new Event("beforeunload"));
    else leaf.container = {};
    h.windows.push(leaf.nativeWindow);
    await advanceTimers(h, 25);
    assert.equal(isSticky(leaf), false, change);
    assert.equal(leaf.view.actions.children.length, 0, change);
    assert.equal(leaf.document.title, originalTitle, change);
    assert.equal(h.pendingTimers(), 0, change);
    assert.equal(h.notices.length, 0, change);
  }
});

test("a disappearing native proxy does not prevent a surviving note from restoring", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const unrelated = h.addLeaf("ordinary");
  unrelated.nativeWindow.getTitle = () => { throw new Error("Window closed"); };
  const leaf = h.addLeaf("sticky");
  await h.plugin.onload();
  assert.equal(isSticky(leaf), true);
  assert.equal(leaf.view.actions.children.length, 4);
  assert.equal(isSticky(unrelated), false);
  assert.equal(h.notices.length, 0);
});

test("the global shortcut waits for pending native discovery without opening a duplicate", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"], topLevelNotePath: "Notes/Example.md" }, true);
  const leaf = h.addLeaf("sticky", { asyncTitle: true });
  await h.plugin.onload();
  h.pressShortcut();
  await advanceTimers(h, 3);
  assert.equal(h.workspace.popoutsOpened, 0);
  assert.equal(isSticky(leaf), true);
  assert.equal(leaf.view.actions.children.length, 4);
  assert.equal(leaf.nativeWindow.focused, true);
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["sticky"]);
});

test("the global shortcut untracks a closing window even when Obsidian clears its view before unload", async () => {
  const h = createHarness({ topLevelNotePath: "Notes/Example.md" }, true);
  h.addLeaf("main", { popout: false });
  await h.plugin.onload();
  h.pressShortcut();
  await settled();
  const note = [...h.plugin.allNotes()][0];
  const leaf = note.leaf;
  const originalClose = leaf.nativeWindow.close.bind(leaf.nativeWindow);
  leaf.nativeWindow.close = () => {
    leaf.container = {};
    leaf.view = { app: h.plugin.app, containerEl: { ownerDocument: h.mainDocument } };
    originalClose();
  };
  h.pressShortcut();
  await settled();
  assert.equal([...h.plugin.allNotes()].length, 0);
  assert.equal(h.plugin.initializedLeaves.has(leaf), false);
  assert.equal(leaf.getViewState().state.desktopStickyNote, undefined);
  assert.equal(leaf.detaches, 0);
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
  h.pressShortcut();
  await settled();
  assert.equal([...h.plugin.allNotes()].length, 1);
  assert.equal(isSticky(h.leaves.get("new-2")), true);
});

test("closing an unresolved deferred note releases the shortcut so it can open another note", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"], topLevelNotePath: "Notes/Example.md" }, true);
  const leaf = h.addLeaf("sticky", { deferred: true });
  await h.plugin.onload();
  h.pressShortcut();
  assert.equal(h.plugin.toggleInProgress, true);
  leaf.nativeWindow.close();
  await advanceTimers(h, 3);
  assert.equal(h.plugin.toggleInProgress, false);
  assert.equal(h.plugin.initializingLeaves.size, 0);
  assert.equal(h.workspace.popoutsOpened, 0, "closing cancels the pending shortcut press");

  h.pressShortcut();
  await settled();
  assert.equal(h.workspace.popoutsOpened, 1);
  assert.equal(isSticky(h.leaves.get("new-1")), true);
  assert.equal(h.plugin.toggleInProgress, false);
});

test("an unresolved deferred view cannot lock the global shortcut indefinitely", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"], topLevelNotePath: "Notes/Example.md" }, true);
  const leaf = h.addLeaf("sticky", { deferred: true });
  await h.plugin.onload();
  for (let press = 0; press < 2; press++) {
    h.pressShortcut();
    assert.equal(h.plugin.toggleInProgress, true);
    await advanceTimers(h, 12);
    assert.equal(h.plugin.toggleInProgress, false);
    assert.equal(h.workspace.popoutsOpened, 0);
  }
  leaf.nativeWindow.close();
  await advanceTimers(h, 3);
  assert.equal(h.plugin.initializingLeaves.size, 0);
  assert.equal(h.pendingTimers(), 0);
});

test("a stalled second restoration does not block toggling an already working note", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["ready", "pending"], topLevelNotePath: "Notes/Example.md" }, true);
  const ready = h.addLeaf("ready");
  const pending = h.addLeaf("pending", { deferred: true });
  await h.plugin.onload();
  h.pressShortcut();
  await settled();
  assert.equal(ready.nativeWindow.focused, true);
  assert.equal(h.plugin.toggleInProgress, false);
  assert.equal(pending.loadCalls, 1);
  assert.equal(h.workspace.popoutsOpened, 0);
  h.pressShortcut();
  await settled();
  assert.equal(ready.nativeWindow.closes, 1);
  assert.equal(h.plugin.toggleInProgress, false);
  assert.equal(h.workspace.popoutsOpened, 0);
});

test("disabling or quitting cancels shortcut waits without completing a deferred load", async () => {
  for (const ending of ["disable", "quit"]) {
    const h = createHarness({ stickyNoteLeafIds: ["sticky"], topLevelNotePath: "Notes/Example.md" }, true);
    h.addLeaf("sticky", { deferred: true });
    await h.plugin.onload();
    h.pressShortcut();
    if (ending === "disable") h.plugin.unload();
    else h.workspace.trigger("quit");
    await advanceTimers(h, 3);
    assert.equal(h.plugin.toggleInProgress, false, ending);
    assert.equal(h.plugin.initializingLeaves.size, 0, ending);
    assert.equal(h.workspace.popoutsOpened, 0, ending);
    assert.equal(h.pendingTimers(), 0, ending);
  }
});

test("partial native setup can retry and finish installing working controls", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const leaf = h.addLeaf("sticky");
  let setupCalls = 0;
  leaf.nativeWindow.setResizable = () => {
    if (++setupCalls === 1) throw new Error("Native window not ready");
  };
  await h.plugin.onload();
  assert.equal(leaf.view.actions.children.length, 0);
  await advanceTimers(h, 3);
  assert.equal(isSticky(leaf), true);
  assert.equal(leaf.view.actions.children.length, 4);
  action(leaf, "Keep on top").callback();
  assert.equal(leaf.nativeWindow.alwaysOnTop, true);
  assert.equal(leaf.detaches, 0);
  assert.equal(h.notices.length, 0);
});

test("does not destroy unrelated windows with sticky-looking titles on startup", async () => {
  const h = createHarness({}, true);
  const otherVault = h.addLeaf("other-vault");
  otherVault.document.title = "Sticky note — Example";
  h.leaves.delete("other-vault");
  await h.plugin.onload();
  assert.equal(otherVault.nativeWindow.destroys, 0);
  assert.equal(isSticky(otherVault), false);
});

test("top-level toggle forgets the closed window without detaching or refocusing the main window", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"], topLevelNotePath: "Notes/Example.md" }, true);
  const leaf = h.addLeaf("sticky");
  await h.plugin.onload();
  leaf.nativeWindow.focused = true;
  await h.plugin.toggleTopLevelNote();
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
  assert.deepEqual(h.saved().topLevelWindowPosition, { x: 120, y: 160 });
  assert.equal(leaf.detaches, 0);
  assert.equal(leaf.nativeWindow.closes, 1);
});

test("renaming a note preserves its identity; deleting it removes the identity", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["sticky"] }, true);
  const leaf = h.addLeaf("sticky");
  await h.plugin.onload();
  const oldPath = leaf.view.file.path;
  leaf.view.file.path = "Notes/Renamed.md";
  h.plugin.app.vault.trigger("rename", leaf.view.file, oldPath);
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["sticky"]);
  h.plugin.app.vault.trigger("delete", leaf.view.file);
  assert.deepEqual(h.saved().stickyNoteLeafIds, []);
  assert.equal(leaf.detaches, 1);
});

test("validates saved IDs without discarding identities for absent popouts", async () => {
  const h = createHarness({ stickyNoteLeafIds: ["gone", "gone", 42, null, ""] }, true);
  await h.plugin.onload();
  assert.deepEqual(Array.from(h.plugin.settings.stickyNoteLeafIds), ["gone"]);
  await h.plugin.openStickyNote(new h.TFile("Notes/New.md"));
  assert.deepEqual(h.saved().stickyNoteLeafIds, ["gone", "new-1"]);
  const invalid = createHarness({ stickyNoteLeafIds: "not an array" }, true);
  await invalid.plugin.onload();
  assert.deepEqual(Array.from(invalid.plugin.settings.stickyNoteLeafIds), []);
});
