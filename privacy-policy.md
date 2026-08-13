# Privacy Policy — Atomic Clipper

**Last updated**: 2026-08-12 · **Applies to**: source build 2.6.0 and Chrome Web Store build 2.2.1

Atomic Clipper is a Chrome extension that clips web content from any webpage for personal research use.

## Data collection

Atomic Clipper does **not** collect, transmit, or share any personal data. There is no server, no account, and no operator of this extension who receives anything about you or what you clip.

## Data storage

All clipped content is stored exclusively in `chrome.storage.local` on your own device and is never uploaded anywhere. Each clip holds:

- the clipped content, converted to Markdown
- the page title and page URL at the time of clipping
- the **web addresses (URLs) of any images or videos** contained in the clipped element — the URLs only; the image and video files themselves are never downloaded or stored
- a list of which of those image URLs did not load when you captured the clip, so the export can mark them
- the tags you assign
- a reference block for citation details: author, title, publication, publication date, source URL, and access date. The extension fills in only the source URL and the access date today. The other fields stay empty until you edit them
- the save timestamp

### A note on the 2.6.0 upgrade

Version 2.6.0 changed how clips are arranged inside `chrome.storage.local`. The first time you run it, the extension rewrites your existing clips into the new arrangement on your own device.

This is a local operation. Nothing is uploaded, and no clip content is read by anyone. If the rewrite fails, the extension keeps your original data and shows a message in the library instead of deleting anything.

## Image display and network requests

The extension makes **no network requests of its own** — no analytics, no crash reports, no usage tracking, no calls to any service operated by this extension.

Your browser does make ordinary image requests to third-party hosts in three situations. All three point at an image's **original** web address — the same address the page you clipped it from was already using. There are three, so each one is listed:

**1 — The clip library.** When a clip contains images, the library shows them by pointing your browser at their original addresses.

**2 — The save-panel preview.** An image clip shows a preview thumbnail the same way, before you save it.

**3 — The availability check, when you capture.** When you pick an element that contains images, the extension checks whether each image still loads. It needs this to mark unavailable images in your export. This check runs **as the save panel opens** — that is, **before you save**, and the requests are already sent if you then cancel instead of saving.

What this means in practice:

- That host can see that an image was requested, along with the information any web request carries (such as your IP address).
- Atomic Clipper sends **no referrer** with these requests (`referrerPolicy = "no-referrer"`), so the host is not told which page or extension the request came from.
- No clip content, tag, or other stored data is ever included in these requests.
- Nothing is sent to Atomic Clipper or to any party associated with it.

Deleting an image clip removes its stored image URLs. That stops situations 1 and 2 for that clip. It cannot undo situation 3, because the availability check already ran at capture time.

## Permissions

The extension requests four permissions, each used only for the stated purpose:

| Permission | Purpose |
|---|---|
| `activeTab` | Read the element you select, on the tab you are actively using, only after you start clipping |
| `storage` | Save your clips locally on your device |
| `scripting` | Inject the picker and save panel into the page when you start clipping |
| `clipboardWrite` | Copy a clip to your clipboard when you click "Copy as Markdown" |

## Deleting your data

You can delete individual clips or all clips at any time via the library interface. Removing the extension from Chrome also removes all stored data.

## Contact

This is an open-source project. Questions and issues can be filed at the project repository.
