# Atomic Clipper

Atomic Clipper is a Chrome extension. It captures web content into a library inside your browser. Export that library as Markdown for NotebookLM, Perplexity, or any LLM.

![Last Commit](https://img.shields.io/github/last-commit/gauthierae/AtomicClipper)

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) 

**Source build: 2.6.4** (this repo) · the [Chrome Web Store](https://chromewebstore.google.com/detail/atomic-clipper/dolcnaamlhbbdigmggnlikcdpdjjiadp) build can be older

![Demo](assets/Atomic-Clipper-MiniDemo.gif)

## What it does

- Point at an element on any webpage, then clip it with one click
- **Drag across a passage** to capture more than one element. The clip keeps the heading and list structure
- **Hold Cmd or Ctrl to gather several regions.** Release the key and they save as a single clip
- **Choose Clip Article** to take the main content block of a long piece, with no pointing
- Clip **image-only** elements: figures and pictures that carry no text
- Tag each clip as you save it
- Open your library, grouped by tag
- **Copy any clip as Markdown.** You get a standalone note with YAML frontmatter for your vault
- Export a whole tag as one `.md` file, with frontmatter at the top
- The export flags a picture that no longer loads, so you can see what was there
- Everything stays on your device: no cloud sync, no backend

## Install

### From the Chrome Web Store

**[Install Atomic Clipper](https://chromewebstore.google.com/detail/atomic-clipper/dolcnaamlhbbdigmggnlikcdpdjjiadp)**, then choose **Add to Chrome**. Chrome keeps this build updated for you.

### From source

This repository runs ahead of the Chrome Web Store version. New capture features land here first, for early feedback, before they reach the store. Install from source for the newest work. Install from the store for the steadier build.

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** with the toggle at the top right
4. Choose **Load unpacked**, then select the `extension/` folder
5. The Atomic Clipper icon appears in your toolbar

> **About the Chrome warning.** After a source install, Chrome raises a "Disable developer mode extensions" popup at each start. Every unpacked extension triggers that notice. It is not specific to Atomic Clipper. Click Cancel, or dismiss it, and the tool keeps working. A Chrome Web Store install never shows it.

## Use

### Clip content

1. Open any webpage
2. Click the Atomic Clipper toolbar icon, or press **Alt+Shift+S**. ChromeOS can reserve that combination. Remap it at `chrome://extensions/shortcuts`
3. Choose **Start Clipping**. The popup closes and the cursor becomes a crosshair
4. Move over an element to highlight it, then click
5. A save panel opens at the top right. Type a tag in the **Category** field, `AI Research` for example, then press **Save**
6. A "Clip saved!" message appears, and the picker closes itself

Press **Esc** at any moment to cancel. The extension keeps nothing.

> **Large embedded pictures.** Some pages embed an image directly in the HTML instead of linking to it. If one of those is larger than about 100 KB, the save panel asks you to **Keep** or **Skip** it. Chrome grants the extension a 10 MB budget, and a single embedded picture can consume much of it. **Skip** preserves the rest of the clip.

### Clip a whole article

Choose **Clip Article** in the popup instead of **Start Clipping**. Atomic Clipper finds the main content block and opens the save panel straight away. No crosshair, no pointing.

Use it on a long piece. Use **Start Clipping** when you want one part of the page.

### Clip more than one element

**Drag** — hold the mouse button and sweep across a passage instead of a single click. The clip preserves the heading and list structure. It is not flat text.

**Multi-block** — hold **Cmd** (macOS) or **Ctrl** (Linux and Windows), then click each region you want. A tray in the corner counts your picks; its buttons remove the last one, cancel, or save. **Release the key** to finish. The save panel opens, and the regions become a single clip. A horizontal rule divides them.

**Image-only elements** — you can take a figure or a picture that carries no text. It appears in the saved clip and in the Markdown export.

### Open your library

Click **Open Library** in the popup footer. That footer stays available on every page.

The library groups your clips by tag, in alphabetical order. Within each tag, the newest comes first.

### Export your clips

In the library, press **Export .md** beside any tag heading. Chrome downloads a Markdown file, named after the tag, to your download folder. It opens with YAML frontmatter holding the tag, the export date, and the clip count.

For a single clip, click **Copy MD** on its card. You get a standalone vault note: YAML frontmatter with `title`, `source`, `tags` and `saved`, then the clip as the body.

Every picture becomes a standard Markdown image link, `![](url)`, so any viewer renders it. If a picture failed to load at capture time, the export still writes the line and flags it, so you can see what was there. The export omits an SVG that the page embeds directly, because Markdown viewers handle it inconsistently. A link to an `.svg` file exports normally.

The result suits NotebookLM, Perplexity, LLM context windows, and Markdown vaults such as Obsidian.

## Limits

- Browser system pages are off limits (`chrome://`, `about:`, or an extension page). There the popup reads "Cannot clip this page."
- The picker refuses an element that fills the screen, such as a full-width wrapper or `<main>`. This stops a single click from taking the whole document by accident. Use **Clip Article** when you want the entire piece
- A single-page app (React, Next.js, or Vue) cancels the picker when the address changes mid-session. A notice explains why
- Login walls and paywalls can defeat the extractor
- Atomic Clipper keeps `http`, `https`, and embedded image addresses. It drops every other address at capture time. If a dropped image was the only thing under the cursor, the picker says the element cannot be clipped
- A clip carries no author, publication, or publication date. The saved data reserves those fields and leaves them empty. A later release will fill them
- **A source link sends a referrer.** Follow a "source" link from the library and the destination site learns you arrived from the Atomic Clipper page
- **The popup occasionally opens blank.** Close it and click the toolbar icon again. This is a rare Chrome timing fault

## Privacy

Atomic Clipper keeps all clipped content in `chrome.storage.local`, on your own device. No account, no cloud sync, no server. Nothing about you, and nothing you clip, ever reaches the developer. The extension sends no analytics, no crash reports, and no telemetry.

Your browser does make ordinary image requests to third-party hosts, in three situations. All three point at the original address of an image.

1. **The library** displays the images in a clip.
2. **The save panel** previews a thumbnail of an image clip.
3. **The availability check** runs as the save panel opens, before you save, to find images that no longer load, so the export can flag them. Cancel the save and those requests have already gone out.

The host sees an ordinary image request, exactly as it does when you visit the page the image came from. All three send `no-referrer`. They carry no clip content, no tag, and no other stored data.

Atomic Clipper stores the address of a linked image and never downloads the file. For an image the page embeds directly, the address holds the image data itself, so the extension stores that data with the clip. Such an image needs no network request.

Read [privacy-policy.md](privacy-policy.md) for the full detail. It lists everything a clip holds, and explains what the 2.6.0 upgrade does to your data.

Delete one clip, or all of them, at any time from the library. Remove the extension to erase everything stored.

All source code lives in this repository. Read the picker, the extractor, the storage layer, and the export logic in `extension/`.

## Permissions

Atomic Clipper requests three permissions and nothing else.

| Permission | Why the extension needs it |
|---|---|
| `activeTab` | Works on the current tab only, after you click the toolbar icon. It grants no background access to any other tab |
| `scripting` | Injects the element picker and the extractor into the page |
| `storage` | Saves your clips to Chrome local storage, on your device |

No host permissions. No `webRequest`. Atomic Clipper cannot read your browsing history or your cookies.

## License

MIT — see [LICENSE](LICENSE)
