# Bib Download Module (js/bib-download.js)

This module adds BibTeX download helpers to the PaperStatsApp instance.
It is loaded after `js/app.js` and extends `PaperStatsApp.prototype` with BibTeX rendering and download helpers.

## Load

`index.html` includes:

- `js/app.js`
- `js/bib-download.js`

## Main APIs

### applyBibliographyRendering(renderRoot)

Scans for `.bibliography-inline` placeholders and renders a BibTeX fetch button.
It also wires up click handlers via `bindBibFetchButtons()`.

### bindBibFetchButtons(renderRoot)

Attaches click handlers to `.bib-fetch-btn` buttons. On click it:

- Resolves BibTeX using `formatBibliography()`.
- Triggers a `.bib` file download using `triggerBlobDownload()`.
- Updates the button UI for success/failure states.

### formatBibliography(dois, opts)

Fetches BibTeX for a DOI list using citation-js with retry and backoff.

Options:

- `opts.onProgress(done, total)`: optional progress callback.

### formatBibliographyFallback(dois)

Fallback BibTeX generator when remote fetch fails.

## Example

Render BibTeX buttons after markdown is rendered:

```js
await window.paperStats.applyBibliographyRendering(renderRoot);
```

## Notes

- Requires citation-js (loaded via `ensureCiteLib()` in `js/app.js`).
- The downloaded filename is derived from the first DOI or `references_<timestamp>.bib`.
- Cache is stored in project storage under `citation-meta` when available.
