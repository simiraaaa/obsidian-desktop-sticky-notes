const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHarness } = require("./obsidian-harness.cjs");

const settled = () => new Promise((resolve) => setImmediate(resolve));
const isSticky = (leaf) => leaf.document.body.classList.contains("desktop-sticky-note");
const action = (leaf, title) => leaf.view.actions.children.find((element) => element.title === title);

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
  h.flushTimers();
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
  assert.equal(leaf.document.title, originalTitle);
  assert.equal(leaf.detaches, 0);
  assert.equal(h.notices.length, 0);
  h.windows.push(leaf.nativeWindow);
  h.workspace.trigger("layout-change");
  assert.equal(isSticky(leaf), true);
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
