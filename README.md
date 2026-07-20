# Atomic Clipper

A Chrome extension that lets you clip any web content into a local research library — then export it as Markdown for NotebookLM, Perplexity, or any LLM.

![Last Commit](https://img.shields.io/github/last-commit/gauthierae/AtomicClipper)

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) 

**Source build: 2.4.0** (development, this repo) · **[Chrome Web Store](https://chromewebstore.google.com/detail/atomic-clipper/dolcnaamlhbbdigmggnlikcdpdjjiadp): 2.2.1** (stable)

![Demo](assets/Atomic-Clipper-MiniDemo.gif)

## What it does

- Point at any element on any webpage and clip it in one click
- **Drag-select** across elements to capture a passage, hierarchy preserved
- **Hold Cmd/Ctrl to pick several regions**, release to save them as one clip
- Clip **image-only** elements — figures and images without text
- Tag each clip with a category at save time
- Browse your saved library, grouped by category
- **Copy any clip as Markdown** to the clipboard, or export a whole category as `.md`
- All data stays on your device — no cloud sync, no backend

## Installation

### From the Chrome Web Store — recommended

**[Install Atomic Clipper](https://chromewebstore.google.com/detail/atomic-clipper/dolcnaamlhbbdigmggnlikcdpdjjiadp)** → **Add to Chrome**. One click, automatic updates.

### From source — the development build

The source in this repository **runs ahead of the Web Store version.** That is deliberate: this repo is where new capture features land for early feedback before they are submitted to the store. Install from source if you want the newest work and don't mind rough edges; install from the store if you want the stable build.

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `extension/` folder
5. The Atomic Clipper icon appears in your Chrome toolbar

> **About the Chrome warning:** with a source install, Chrome shows a "Disable developer mode extensions" popup each time it starts. This is Chrome's standard notice for any extension loaded unpacked — it is not specific to Atomic Clipper. Click Cancel (or dismiss it) and the extension keeps running. The Web Store install does not show it.

## Usage

### Clipping content

1. Navigate to any webpage
2. Click the Atomic Clipper toolbar icon — or press **Alt+Shift+S** (on ChromeOS this combination may be reserved; remap at `chrome://extensions/shortcuts` if needed)
3. Click **Start Clipping** — the popup closes and a crosshair cursor activates on the page
4. Hover over any element to highlight it, then click to select it
5. An inline save panel appears in the top-right corner. Enter a category (e.g. "AI Research") and click **Save**
6. A "Clip saved!" confirmation appears, then the picker cleans up automatically

Press **Esc** at any time to cancel clipping without saving.

### Capturing more than one element

**Drag-select** — press and drag across a passage instead of clicking. The selection is captured with its structure intact rather than as flat text.

**Multi-block** — hold **Cmd** (macOS) or **Ctrl** (Linux/Windows) and click each region you want. A tray in the corner counts what you've picked and lets you remove the last one or cancel. **Release the modifier** to finalize — the save panel opens and the regions are saved as a single clip, separated by horizontal rules.

**Image-only elements** — figures and images with no text are clippable directly; the image appears in the saved clip and in the Markdown export.

> **Note**: Clipping is not available on browser system pages (`chrome://`, `about:`, extension pages, etc.). The popup will show "Cannot clip this page." for these URLs.

### Browsing your library

Click **Open Library** in the popup footer (visible on any page) to open the full library view.

Clips are grouped by category (alphabetical) and sorted newest-first within each category.

### Exporting

In the library, click **Export .md** next to any category header. A Markdown file named after the category downloads to your default downloads folder.

For a single clip, click **Copy MD** on its card to put its Markdown on the clipboard.

Images in a clip are exported as standard Markdown image links (`![](url)`), so they render in any Markdown viewer.

The export format is compatible with NotebookLM, Perplexity, and LLM context windows.

## Known limitations

- Cannot activate on browser system pages (`chrome://`, `about:`, extension pages)
- SPA navigation (React/Next.js/Vue) cancels the picker if the URL changes mid-session — a notice appears explaining why
- Image **files** are never downloaded or stored — only their web addresses, which are used to display and export the image (see Privacy)
- May not clip correctly behind login walls or paywalls
- **"Show full text" may appear truncated** — clicking the button in the library sometimes shows only a preview even after expanding. The full text is stored correctly and will appear in your exported `.md` file.
- **Source links include a referrer** — when you click a "source" link in the library, the destination site may see that you came from the Atomic Clipper library page.
- **Popup occasionally loads blank** — if the popup appears empty, close it and click the toolbar icon again. This is a rare Chrome extension timing issue.

## Privacy

All clipped content is stored exclusively in `chrome.storage.local` on your own device. There is no account, no cloud sync, and no server — nothing about you or what you clip is ever sent to the developer. No analytics, no crash reports, no telemetry.

One exception exists, and only to show you your own clips: when a clip contains images, the extension displays them by pointing your browser at each image's original web address. The site hosting that image therefore sees an ordinary image request, exactly as it would if you revisited the page it came from. These requests are sent with `no-referrer`, and no clip content, category, or other stored data is ever included. Image files are never downloaded or stored — only their URLs are saved.

You can delete individual clips or all clips at any time via the library interface, or remove the extension to erase all stored data.

All source code is in this repository — the picker, extractor, storage, and export logic are all visible in extension/.

## Permissions

Atomic Clipper requests four permissions and nothing else:

| Permission | Why it is needed |
|---|---|
| `activeTab` | Activates only on the current tab when you click the toolbar icon — no background access to any other tab |
| `scripting` | Required to inject the element picker and extractor into the page |
| `storage` | Saves your clips to Chrome's local storage on your device |
| `clipboardWrite` | Copies a clip to your clipboard when you click "Copy as Markdown" |

No host permissions. No `webRequest`. No access to your browsing history or cookies.

## License

MIT — see [LICENSE](LICENSE)
