# Desktop Sticky Notes

An Obsidian desktop-only plugin that opens real Markdown files in resizable sticky-note popout windows.

## Commands

- **Create sticky note** — creates a Markdown file in the configured folder and opens it.
- **Open sticky note for current file** — opens the active Markdown file as a sticky note.
- **Hide sticky note for current file** — closes all sticky-note windows for the active file.
- **Set current file as top-level sticky note** — designates the active Markdown file as the top-level note.
- **Toggle top-level sticky note** — opens the designated note, brings it forward when it is behind another window, or hides it when it is already focused. It safely does nothing when no valid top-level file exists.

Each sticky-note window has controls for keeping it above other applications, selecting a color, switching between edit and reading views, and hiding it. Window contents are the underlying Obsidian Markdown file, so edits and previews stay in sync with the vault.

> [!NOTE]
> On Linux, **Keep on top** works when Obsidian runs under X11 or XWayland. Electron does not support the required always-on-top window state under native Wayland, so the pin control cannot change window stacking in a native Wayland session.

## Settings

- **Default notes folder** — where newly created sticky-note files are stored; defaults to the vault root.
- **Default note color** — the initial background color for notes without a saved custom color.
- **Collapsible sticky notes** — adds a collapse control to every sticky-note window. Collapsing shrinks the window to its header, and expanding restores the height the window had before it was collapsed. A collapsed window cannot be resized; expanding makes it resizable again. Windows open expanded again after they are hidden, and after Obsidian restarts unless **Restore sticky notes on startup** brings them back collapsed. Off by default. A collapsed window keeps showing the note name in its header. CSS snippets can hook into the `desktop-sticky-note-collapsible` body class, present while the setting is on, and `desktop-sticky-note-collapsed`, present while a window is collapsed. Under native Wayland, Electron may be unable to resize a window programmatically; the plugin reads the size back and cancels the collapse when the window did not shrink.
- **Restore sticky notes on startup** — reopens the sticky notes that were open when Obsidian last closed, in the position and size they had, and pinned or collapsed again if they were. Off by default; the notes also reopen immediately when the plugin itself is enabled. A note closed with its hide button is not reopened, while a note whose window closed because Obsidian quit is. One note is reopened per file, even when the same file was open in several sticky windows. The top-level note is never restored this way, because its own toggle command and global shortcut decide when it is shown. When the display a note lands on has a work area of a different size than the one it was saved on, the position is rescaled in proportion and the window is moved back inside the work area if it would fall outside it. The remembered windows are stored in the plugin's own settings file, so a vault synced between computers reopens the notes that were left open on whichever computer wrote to it last.
- **Global toggle shortcut** — toggles the top-level sticky note even when Obsidian is in the background. Click the recorder and press the desired combination, or clear it to disable the shortcut. The default is `Win+F10` on Windows, `Super+F10` on Linux, and `Option+F10` on macOS. The plugin stores this setting separately for each operating system, so syncing a vault between computers does not translate one platform's shortcut into another platform's keys.
- **Top-level note** — the Markdown file controlled by the toggle command and global shortcut.

## Installation

Copy `manifest.json`, `main.js`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/desktop-sticky-notes/
```

Then enable **Desktop Sticky Notes** under Obsidian's community-plugin settings. This plugin requires the desktop version of Obsidian.

## Permissions and privacy

Desktop Sticky Notes uses Obsidian's Electron APIs to manage popout windows and register the optional system-wide shortcut. It only creates or edits Markdown files inside your vault through the Obsidian API. It does not access files outside the vault, make network requests, collect telemetry, or send data anywhere.

## License

Desktop Sticky Notes is available under the [MIT License](LICENSE).
