# Sticky identity in workspace state

Status: accepted.

## Context

Sticky notes use Obsidian's normal Markdown views in popout windows. The plugin
previously identified restored windows only through `stickyNoteLeafIds` in its
settings. Obsidian could restore the Markdown window without its sticky controls
when that separate record was absent or did not match the restored leaf ID.
Matching by file path would also convert ordinary popouts of the same file.

## Decision

Store `desktopStickyNote: true` in each sticky leaf's Markdown view state, which
Obsidian serializes with the workspace. Retain saved leaf IDs as a compatibility
fallback for windows opened by previous plugin versions. Only marked Markdown
popouts or known legacy IDs are eligible for restoration.

Keep the core Markdown view type and preserve all other view and ephemeral state.
Obsidian's Markdown view ignores unknown state keys, so wrap the public leaf
`setViewState` and `getViewState` methods while the plugin is loaded. Capture the
marker before view construction and add it back during workspace serialization.
Install these wrappers before asynchronous settings loading. Scope them to this
plugin's app, use a weak set of leaves, and accept only the boolean `true`.

Remove the marker when a note is explicitly hidden. On plugin disable, close
marked windows even if the legacy ID record is unavailable. Restore the original
methods on unload when this plugin still owns them; if another plugin has wrapped
them, deactivate our wrappers and preserve that plugin's method chain.

## Consequences

Sticky identity travels with the window's saved state and survives a missing
settings record or a changed leaf ID. The marker adds only a boolean and does not
change the underlying Markdown file. Ordinary popouts remain ordinary.

This depends on Obsidian continuing to serialize leaves through `getViewState`
and restore them through `setViewState`. Tests must cover method chaining,
cleanup, deferred views, restart without saved IDs, and ordinary popouts of the
same file. Confirm the lifecycle in the running app when updating Obsidian.

A regular window whose identity was already lost has neither marker nor known
ID. The user must reopen it through the sticky-note command once; inferring its
role from its file would change unrelated windows.
