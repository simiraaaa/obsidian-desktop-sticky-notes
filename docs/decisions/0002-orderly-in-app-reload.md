# Orderly in-app reload

Status: accepted. Supplements the workspace identity decision in record 0001.

## Context

In Obsidian 1.13.7, `app:reload` calls `window.location.reload()`. Its main
beforeunload handler saves the workspace and runs quit handlers only when the
native window is closing. Renderer reload skips that shutdown: old popouts
remain alive and new ones are restored from the last saved workspace. Closing
an old popout does not remove its replacement from the current workspace.
Reload can also discard the pending debounce timer for a layout save.

The previous close listener watched beforeunload and required the leaf's window
ownership to remain intact. Obsidian can replace the view and remove the leaf
before that listener runs, leaving a closed window in the plugin's records.

## Decision

Wrap the built-in reload command while the plugin is loaded. During a session
that has used sticky notes, save pending text views, flush the public
`requestSaveLayout` debouncer, then run Obsidian's quit handlers and await their
save tasks and normal popout closes before invoking the original reload.
Serialize plugin settings writes and await a final save both before shutdown
and after all old windows close, retaining recent colors and the position saved
by a delayed beforeunload. Drain newer settings writes queued during that wait,
then recheck windows and unload status.
Track window-open events throughout the operation and refresh the set of
workspace windows before shutdown and during the close wait; a popout opened
while saves are pending must also finish closing before reload.
Keep the old workspace's `layoutReady` false during shutdown so late callbacks
cannot overwrite the saved layout with closed windows removed. The newly
loaded workspace has its normal readiness lifecycle.

Retain this reload behavior after the last sticky closes in a session: a reload
must still persist its removal. Sessions without sticky notes retain the original
reload behavior. The command callback restores on plugin unload, preserving any
later plugin wrapper through an inactive pass-through wrapper.

Use the confirmed `window-close` event to forget explicit closes. Keep a weak
window-to-leaf map with saved IDs so cleanup still works after a view is replaced
or a deferred initialization finishes early. Ignore events for leaves moved into
another window. Quit/reload closes retain identity for restoration; explicit
closes remove it and flush the updated workspace.
Observe recognized windows before layout readiness without loading deferred
views. Retain a pending close save until the workspace is ready, so a close
during startup also reaches disk.

## Compatibility and limits

The reload command registry is an internal compatibility boundary. Access only
`app:reload`, feature-check its callback, and preserve its receiver and method
chain. Hotkeys mapped to that command use the same path; a direct renderer reload
that bypasses Obsidian commands is outside this hook.

Obsidian's API declares the `Tasks` collector, but 1.13.7 does not export its
constructor at runtime. Supply its public collector contract: start callbacks
when added, collect their promises, and await `Promise.all`. Do not invoke
constructors that exist only in the typings.

Normal quit handlers close only popouts owned by this workspace. Do not sweep
Electron windows by title or force-destroy editors to make reload succeed. Abort
reload on save failure or canceled shutdown, restore readiness, and allow
surviving sticky views to initialize again.

Older orphaned windows already belong to obsolete workspace instances. Fully
quit Obsidian once during upgrade to remove them. Unmarked regular windows must
be reopened through the sticky-note command to establish their identity.

## Validation

Test the built-in reload command with multiple sticky notes and an ordinary
popout of the same file. Verify one native window per saved popout, retained
color and reading mode, working controls, and a pending editor change surviving
reload. Then close notes with the standard window close button and reload
immediately; closed notes must stay closed. Cover save failure, cancellation,
deferred initialization, closes before layout readiness, windows opened while
saving or quitting, pending settings writes, callback chaining, and disabling
during reload.
