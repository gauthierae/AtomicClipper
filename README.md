# Atomic Clipper

Atomic Clipper is a Chrome extension. It clips web content into a local research library. It exports that library as Markdown for NotebookLM, Perplexity, or any LLM.

![Last Commit](https://img.shields.io/github/last-commit/gauthierae/AtomicClipper)

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) 

**Source build: 2.6.2** (this repo) · **[Chrome Web Store](https://chromewebstore.google.com/detail/atomic-clipper/dolcnaamlhbbdigmggnlikcdpdjjiadp): 2.2.1**

![Demo](assets/Atomic-Clipper-MiniDemo.gif)

## What it does

- Point at any element on any webpage, then clip it with one click
- **Drag across elements** to capture a passage. The clip keeps the heading and list structure
- **Hold Cmd or Ctrl to pick several regions.** Release the key to save them as one clip
- Clip **image-only** elements — figures and images that hold no text
- Tag each clip at save time
- Open your library, grouped by tag
- **Copy any clip as Markdown.** You get a standalone note with YAML frontmatter for your vault
- Export a whole tag as one `.md` file, with frontmatter at the top
- The export marks an image that no longer loads. It does not leave a broken link
- All data stays on your device. There is no cloud sync and no backend

## Install

### From the Chrome Web Store

**[Install Atomic Clipper](https://chromewebstore.google.com/detail/atomic-clipper/dolcnaamlhbbdigmggnlikcdpdjjiadp)**, then click **Add to Chrome**. Chrome updates this build for you.

### From source

The source in this repository runs ahead of the Chrome Web Store version. New capture features land here first, for early feedback, before they go to the store.

Install from source to get the newest work. Install from the store to get the build that changes least.

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** with the toggle at the top right
4. Click **Load unpacked** and select the `extension/` folder
5. The Atomic Clipper icon appears in your Chrome toolbar

> **About the Chrome warning.** After a source install, Chrome shows a "Disable developer mode extensions" popup at each start. Chrome shows this notice for every unpacked extension. It is not specific to Atomic Clipper. Click Cancel, or dismiss the popup, and the extension continues to work. The Chrome Web Store install does not show it.

## Use

### Clip content

1. Go to any webpage
2. Click the Atomic Clipper toolbar icon, or press **Alt+Shift+S**. On ChromeOS this key combination can be reserved. Remap it at `chrome://extensions/shortcuts`
3. Click **Start Clipping**. The popup closes and the cursor becomes a crosshair
4. Move the cursor over any element to highlight it, then click the element
5. A save panel opens at the top right. Type a category, for example `AI Research`, then click **Save**
6. A "Clip saved!" message appears, and the picker closes itself

Press **Esc** at any time to cancel. The extension saves nothing.

> **Large embedded images.** Some pages embed an image directly in the HTML instead of a link to it. If one of those images is larger than about 100 KB, the save panel asks you to **Keep** or **Skip** it. Chrome gives the extension a 10 MB budget, and one embedded image can take a large share of it. **Skip** keeps the rest of the clip.

### Clip more than one element

**Drag** — press the mouse button and drag across a passage instead of a single click. The clip keeps the heading and list structure. It is not flat text.

**Multi-block** — hold **Cmd** (macOS) or **Ctrl** (Linux and Windows), then click each region you want. A tray at the corner counts your picks. Use it to remove the last pick or to cancel. **Release the key** to finish. The save panel opens, and the extension saves the regions as one clip. A horizontal rule separates each region.

**Image-only elements** — you can clip a figure or an image that holds no text. The image appears in the saved clip and in the Markdown export.

> **Note.** You cannot clip a browser system page (`chrome://`, `about:`, or an extension page). On those pages the popup shows "Cannot clip this page."

### Open your library

Click **Open Library** in the popup footer. The footer is available on any page.

The library groups your clips by tag, in alphabetical order. Inside each tag, the newest clip comes first.

### Export your clips

In the library, click **Export .md** next to any tag heading. Chrome downloads a Markdown file, named after the tag, to your download folder. The file opens with YAML frontmatter that holds the tag, the export date, and the clip count.

To export one clip, click **Copy MD** on its card. You get a standalone vault note: YAML frontmatter (`title`, `source`, `tags`, `saved`, and any citation field you filled in), then the clip as the body.

The export writes each image as a standard Markdown image link, `![](url)`, so any Markdown viewer renders it. If an image did not load at capture time, the export marks it. It does not write a broken link. The export omits an SVG image that the page embeds directly, because Markdown viewers render it inconsistently. A link to an `.svg` file exports normally.

The export format suits NotebookLM, Perplexity, LLM context windows, and Markdown vaults such as Obsidian.

## Limits

- You cannot use the extension on a browser system page (`chrome://`, `about:`, or an extension page)
- A single-page app (React, Next.js, or Vue) cancels the picker when the URL changes mid-session. A notice tells you why
- The extension stores the address of a linked image, and it never downloads the file. For an image that the page embeds directly, the address holds the image data, so the extension stores that data. See [Privacy](#privacy)
- The extension can fail to clip correctly behind a login wall or a paywall
- The export omits an SVG image that the page embeds directly. A link to an `.svg` file exports normally
- The extension keeps `http`, `https`, and embedded image addresses. It drops every other address at capture time, and the save panel reports how many it dropped
- **"Show full text" can show a short preview.** Sometimes the button shows only a preview, even after it expands. Your `.md` export still holds the full text
- **A source link sends a referrer.** When you click a "source" link in the library, the destination site can see that you came from the Atomic Clipper library page
- **The popup sometimes opens blank.** Close it and click the toolbar icon again. This is a rare Chrome timing fault

## Privacy

Atomic Clipper stores all clipped content in `chrome.storage.local`, on your own device. There is no account, no cloud sync, and no server. Nothing about you, and nothing that you clip, ever goes to the developer. The extension sends no analytics, no crash reports, and no telemetry.

Your browser does make ordinary image requests to third-party hosts, in three situations. All three point at the original address of an image.

1. **The library** shows the images in a clip.
2. **The save panel** shows a preview thumbnail of an image clip.
3. **The availability check** runs as the save panel opens — before you save — to find images that no longer load, so the export can mark them. If you cancel the save, the requests already went out.

The host sees an ordinary image request, exactly as it does when you visit the page the image came from. All three requests send `no-referrer`. They carry no clip content, no tag, and no other stored data.

An image that the page embeds directly needs no network request. Its data is already in the clip.

Read [privacy-policy.md](privacy-policy.md) for the full detail. It lists everything a clip stores, and it explains what the 2.6.0 upgrade does to your data.

Delete one clip, or delete all clips, at any time from the library. Remove the extension to erase all stored data.

All source code is in this repository. You can read the picker, the extractor, the storage layer, and the export logic in `extension/`.

## Permissions

Atomic Clipper requests four permissions and nothing else.

| Permission | Why the extension needs it |
|---|---|
| `activeTab` | Works on the current tab only, after you click the toolbar icon. It gives no background access to any other tab |
| `scripting` | Injects the element picker and the extractor into the page |
| `storage` | Saves your clips to Chrome local storage, on your device |
| `clipboardWrite` | Copies a clip to your clipboard when you click "Copy as Markdown" |

There are no host permissions. There is no `webRequest`. The extension cannot read your browser history or your cookies.

## License

MIT — see [LICENSE](LICENSE)
