# Desktop Sticky Notes

An Obsidian desktop-only plugin that opens real Markdown files in resizable sticky-note popout windows.

## Commands

- **Create sticky note** — creates a Markdown file in the configured folder and opens it.
- **Open sticky note for current file** — opens the active Markdown file as a sticky note.
- **Hide sticky note for current file** — closes all sticky-note windows for the active file.
- **Set current file as top-level sticky note** — designates the active Markdown file as the top-level note.
- **Toggle top-level sticky note** — opens the designated note, brings it forward when it is behind another window, or hides it when it is already focused. It safely does nothing when no valid top-level file exists.

Each sticky-note window has controls for keeping it on top, selecting a color, switching between edit and reading views, and hiding it. Window contents are the underlying Obsidian Markdown file, so edits and previews stay in sync with the vault.

## Settings

- **Default notes folder** — where newly created sticky-note files are stored; defaults to the vault root.
- **Default note color** — the initial background color for notes without a saved custom color.
- **Global toggle shortcut** — toggles the top-level sticky note even when Obsidian is in the background. Click the recorder and press the desired combination, or clear it to disable the shortcut. The default is `Win+F10` on Windows and `Option+F10` on macOS.
- **Top-level note** — the Markdown file controlled by the toggle command and global shortcut.

## Installation

Copy `manifest.json`, `main.js`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/desktop-sticky-notes/
```

Then enable **Desktop Sticky Notes** under Obsidian's community-plugin settings. This plugin requires the desktop version of Obsidian.

## License

Desktop Sticky Notes is available under the [MIT License](LICENSE).
