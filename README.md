# Desktop Sticky Notes

An Obsidian desktop-only plugin that opens real Markdown files in resizable sticky-note popout windows.

## Commands

- **Create sticky note** — creates a Markdown file in the configured folder and opens it.
- **Open sticky note for current file** — opens the active Markdown file as a sticky note.
- **Hide sticky note for current file** — closes all sticky-note windows for the active file.
- **Set current file as top-level sticky note** — designates the active Markdown file as the top-level note.
- **Toggle top-level sticky note** — opens the designated note, brings it forward when it is behind another window, or hides it when it is already focused. It safely does nothing when no valid top-level file exists.

Each sticky-note window has controls for keeping it above other applications, selecting a color, switching between edit and reading views, and hiding it. Window contents are the underlying Obsidian Markdown file, so edits and previews stay in sync with the vault.

A sticky-note window is not where Obsidian opens the next file. While a sticky note has the focus, a file opened from the quick switcher, the file explorer, a link, a command, or an `obsidian://` URI opens in Obsidian's own windows, and a new tab or split is created there as well, so the sticky note keeps showing its note. Only the choice of window is affected: the note's own history and the editing commands still act on the sticky note.

> [!NOTE]
> On Linux, **Keep on top** works when Obsidian runs under X11 or XWayland. Electron does not support the required always-on-top window state under native Wayland, so the pin control cannot change window stacking in a native Wayland session. Electron implements **Window opacity** on Windows and macOS only, so that setting has no visible effect on Linux.

> [!NOTE]
> On macOS, a pinned note becomes a top-level window and the system draws its frame with a fixed 10px corner radius. With **Header size** set to **Extra small** the 14px header is rounded more tightly than that frame, which leaves a hairline gap visible at the right edge of the header. **Small** (20px) matches the system radius and has no gap.

## Settings

- **Default notes folder** — where newly created sticky-note files are stored; defaults to the vault root.
- **Default note color** — the initial background color for notes without a saved custom color.
- **Window opacity** — how opaque every sticky-note window is, from 20% to fully opaque. The default keeps every window fully opaque, and the value applies to all sticky notes at once.
- **Opaque while focused** — brings a sticky note to full opacity while its window has the focus, so that the note stays easy to read while you work in it, and returns it to the configured opacity when the focus moves elsewhere. On by default, and only noticeable when window opacity is below 100%.

- **Header size** — how tall the toolbar above each note is. **Default** keeps Obsidian's regular 40px header. **Small** (20px) and **Extra small** (14px) shrink it to a macOS Stickies-like strip, paint it in the note color, and hide the macOS traffic lights so the note's own controls own the top of the window. The traffic lights are only touched when Obsidian's **Window frame style** is *Hidden*, which is the one style that draws them on top of the note itself. With *Obsidian frame* or *Native frame* the window gets its own title bar that this plugin does not draw, so its buttons are left alone and only the styling applies.

- **Collapsible sticky notes** — adds a collapse control to every sticky-note window. Collapsing shrinks the window to its header, and expanding restores the height the window had before it was collapsed. A collapsed window cannot be resized; expanding makes it resizable again. Windows open expanded again after they are hidden, and after Obsidian restarts unless **Restore sticky notes on startup** brings them back collapsed. Off by default. A collapsed window keeps showing the note name in its header. On macOS, double-clicking an empty part of the header, including the note name, also collapses or expands the window. To make that possible, a focused window is moved by the plugin while its header is dragged, so macOS features of native window dragging, such as tiling at the screen edge, do not apply to that drag; an inactive window is still dragged natively. CSS snippets can hook into the `desktop-sticky-note-collapsible` body class, present while the setting is on, and `desktop-sticky-note-collapsed`, present while a window is collapsed. Under native Wayland, Electron may be unable to resize a window programmatically; the plugin reads the size back and cancels the collapse when the window did not shrink.
- **Restore sticky notes on startup** — reopens the sticky notes that were open when Obsidian last closed, in the position and size they had, and pinned or collapsed again if they were. On by default, because Obsidian otherwise reopens those notes as plain popout windows; the notes also reopen immediately when the plugin itself is enabled. A window closed by the user, with the hide button or with the window frame's own close button, is not reopened, while a window that was still open when Obsidian quit is. A file that was open in several sticky windows is reopened in that many windows, each with its own position, size, pinned state, and collapsed state. Closing one of a note's windows takes only that window off the list and leaves the others to come back. Each remembered window is stored under an identifier of its own, which is what keeps one window's position out of another's entry. It identifies nothing outside that list, neither the note nor the computer, so a settings file stays valid wherever it is synced to. The top-level note is never restored this way, because its own toggle command and global shortcut decide when it is shown. Once the notes are back, the focus is returned to the main window if one of them took it while opening, so Obsidian starts in its main window rather than in the last note to reopen. On macOS the same happens when Obsidian is opened again from the Dock or a launcher while a pinned note has the focus, since that alone would bring only the note forward. When the display a note lands on has a work area of a different size than the one it was saved on, the position is rescaled in proportion and the window is moved back inside the work area if it would fall outside it. Only the size of that work area is remembered, so rescaling assumes the displays are still arranged as they were. The remembered windows are stored in the plugin's own settings file, so a vault synced between computers reopens the notes that were left open on whichever computer wrote to it last.
- **Global toggle shortcut** — toggles the top-level sticky note even when Obsidian is in the background. Click the recorder and press the desired combination, or clear it to disable the shortcut. The default is `Win+F10` on Windows, `Super+F10` on Linux, and `Option+F10` on macOS. The plugin stores this setting separately for each operating system, so syncing a vault between computers does not translate one platform's shortcut into another platform's keys.
- **Top-level note** — the Markdown file controlled by the toggle command and global shortcut.

## Installation

Copy `manifest.json`, `main.js`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/desktop-sticky-notes/
```

Then enable **Desktop Sticky Notes** under Obsidian's community-plugin settings. This plugin requires the desktop version of Obsidian.

## Permissions and privacy

Desktop Sticky Notes uses Obsidian's Electron APIs to manage popout windows and register the optional system-wide shortcut. It reaches them through the `@electron/remote` instance Obsidian itself provides rather than a copy of its own, because a second instance would share its callback numbering with Obsidian's and set off Obsidian's own callbacks, such as menu items. It only creates or edits Markdown files inside your vault through the Obsidian API. It does not access files outside the vault, make network requests, collect telemetry, or send data anywhere.

## License

Desktop Sticky Notes is available under the [MIT License](LICENSE).
