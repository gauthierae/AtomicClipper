# Atomic Clipper

A Chrome extension that lets you clip any web content into a local research library — then export it as Markdown for NotebookLM, Perplexity, or any LLM.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) 

## What it does

- Point at any element on any webpage and clip it in one click
- Tag each clip with a category at save time
- Browse your saved library, grouped by category
- Export any category as a `.md` file — formatted for AI research workflows
- All data stays on your device — no cloud sync, no backend

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `extension/` folder
5. The Atomic Clipper icon appears in your Chrome toolbar

> **Why not the Chrome Web Store?** Atomic Clipper is a working prototype distributed directly for early testers and feedback. Web Store submission is planned once the feature set stabilizes.

> **About the Chrome warning:** It is possible that each time Chrome starts, it will show a "Disable developer mode extensions" popup. This is Chrome's standard notice for any extension installed outside the Web Store — it is not specific to Atomic Clipper. Click Cancel (or just dismiss it) and the extension continues running normally. This is expected behavior for any prototype/open-source install.

## Usage

### Clipping content

1. Navigate to any webpage
2. Click the Atomic Clipper toolbar icon — or press **Alt+Shift+S** (on ChromeOS this combination may be reserved; remap at `chrome://extensions/shortcuts` if needed)
3. Click **Start Clipping** — the popup closes and a crosshair cursor activates on the page
4. Hover over any element to highlight it, then click to select it
5. An inline save panel appears in the top-right corner. Enter a category (e.g. "AI Research") and click **Save**
6. A "Clip saved!" confirmation appears, then the picker cleans up automatically

Press **Esc** at any time to cancel clipping without saving.

> **Note**: Clipping is not available on browser system pages (`chrome://`, `about:`, extension pages, etc.). The popup will show "Cannot clip this page." for these URLs.

### Browsing your library

Click **Open Library** in the popup footer (visible on any page) to open the full library view.

Clips are grouped by category (alphabetical) and sorted newest-first within each category.

### Exporting

In the library, click **Export .md** next to any category header. A Markdown file named after the category downloads to your default downloads folder.

The export format is compatible with NotebookLM, Perplexity, and LLM context windows.

## Known limitations

- Cannot activate on browser system pages (`chrome://`, `about:`, extension pages)
- SPA navigation (React/Next.js/Vue) cancels the picker if the URL changes mid-session — a notice appears explaining why
- Does not capture images inline; image URLs are stored in metadata only
- May not clip correctly behind login walls or paywalls
- **"Show full text" may appear truncated** — clicking the button in the library sometimes shows only a preview even after expanding. The full text is stored correctly and will appear in your exported `.md` file.
- **Source links include a referrer** — when you click a "source" link in the library, the destination site may see that you came from the Atomic Clipper library page.
- **Popup occasionally loads blank** — if the popup appears empty, close it and click the toolbar icon again. This is a rare Chrome extension timing issue.

## Privacy

All clipped content is stored exclusively in `chrome.storage.local` on your own device. The extension makes no network requests and collects no analytics or telemetry. You can delete individual clips or all clips at any time via the library interface, or remove the extension to erase all stored data.

All source code is in this repository — the picker, extractor, storage, and export logic are all visible in extension/.

## Permissions

Atomic Clipper requests three permissions and nothing else:

| Permission | Why it is needed |
|---|---|
| `activeTab` | Activates only on the current tab when you click the toolbar icon — no background access to any other tab |
| `scripting` | Required to inject the element picker and extractor into the page |
| `storage` | Saves your clips to Chrome's local storage on your device |

No host permissions. No `webRequest`. No access to your browsing history or cookies.

## License

MIT — see [LICENSE](LICENSE)
