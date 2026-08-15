# Privacy Policy — Atomic Clipper

**Last updated**: 2026-08-14 · **Applies to**: source build 2.6.2 and Chrome Web Store build 2.2.1

Atomic Clipper is a Chrome extension. It clips web content from any webpage for your personal research.

## Data collection

Atomic Clipper does **not** collect, transmit, or share any personal data. There is no server and no account. No operator of this extension receives anything about you or about what you clip.

## Data storage

Atomic Clipper stores all clipped content in `chrome.storage.local` on your own device. It never uploads that content. Each clip holds:

- the clipped content, in Markdown
- the page title and the page URL, as they were at capture time
- the image and video addresses from the clipped element — see **What the extension stores for an image** below
- a list of the image addresses that did not load at capture time, so the export can mark them
- the tags you assign
- a reference block for citation details: author, title, publication, publication date, source URL, and access date. The extension fills in only the source URL and the access date. You edit the other fields yourself. They stay empty until you do
- a provenance field. A future merge feature will use it. The extension writes it empty, and nothing reads it today
- the save timestamp

### What the extension stores for an image

There are two kinds of image address, and the extension treats them differently.

**A linked image** uses an `http` or `https` address. The extension saves the address only. It never downloads the file.

**An embedded image** uses a `data:` address. That kind of address holds the image data itself, so the extension saves that data with the clip. Above about 100 KB, the save panel asks you to **Keep** or **Skip** the image. Chrome gives the extension a 10 MB budget, and one embedded image can take a large share of it.

The extension keeps `http`, `https`, and embedded `data:` images. It drops every other address at capture time.

### A note on the 2.6.0 upgrade

Version 2.6.0 changed how clips sit inside `chrome.storage.local`. At the first run, the extension rewrites the clips you already have into the new arrangement, on your own device.

This is a local operation. The extension uploads nothing, and nobody reads your clip content. If the rewrite fails, the extension keeps your original data and shows a message in the library. It deletes nothing.

## Image display and network requests

The extension makes **no network requests of its own**. It sends no analytics, no crash reports, and no usage data. It calls no service that this extension operates.

Your browser does make ordinary image requests to third-party hosts, in three situations. All three point at the **original** address of an image — the same address that the page you clipped already used.

**1 — The clip library.** When a clip holds images, the library shows them from their original addresses.

**2 — The save-panel preview.** An image clip shows a preview thumbnail the same way, before you save it.

**3 — The availability check, at capture time.** When you pick an element that holds images, the extension tests whether each image still loads. It needs this result to mark unavailable images in your export. The check runs **as the save panel opens** — that is, **before you save**. If you then cancel instead of save, the requests already went out.

What this means in practice:

- The host sees an image request. It also sees the information that any web request carries, such as your IP address.
- Atomic Clipper sends **no referrer** with these requests (`referrerPolicy = "no-referrer"`). The host therefore learns nothing about the page or the extension that made the request.
- These requests carry no clip content, no tag, and no other stored data.
- Nothing goes to Atomic Clipper or to any party connected with it.

An embedded (`data:`) image needs no network request. Its data is already in the clip.

Delete an image clip to remove its stored image addresses. This stops situations 1 and 2 for that clip. It cannot undo situation 3, because the availability check already ran at capture time.

## Permissions

The extension requests four permissions. It uses each one only for the stated purpose.

| Permission | Purpose |
|---|---|
| `activeTab` | Read the element you select, on the tab you actively use, only after you start a clip |
| `storage` | Save your clips locally, on your device |
| `scripting` | Inject the picker and the save panel into the page when you start a clip |
| `clipboardWrite` | Copy a clip to your clipboard when you click "Copy as Markdown" |

## Delete your data

Delete one clip, or delete all clips, at any time from the library. Remove the extension from Chrome to erase all stored data.

## Contact

This is an open-source project. File your questions and issues at the project repository.
