# Stats Module (js/stats.js)

This module adds field-based aggregation helpers to the PaperReviewerApp instance.
It is loaded after `js/app.js` and extends `PaperReviewerApp.prototype`.

## Load

`index.html` includes:

- `js/app.js`
- `js/stats.js`

## Main APIs

### getFieldStatsForCurrentView(options)

Aggregate counts for one or more fields across all JSON files in the current JSON view.

Options:

- `fields`: string or array of strings. Each string is a dot path, e.g. `wos_data.publication_year`.
- `view`: optional view name. Defaults to current `jsonViewSelect` value.
- `log`: boolean. When true, prints a table and summary to the console. Default: true.
- `table`: boolean. When true, uses `console.table` for the result list. Default: true.
- `mode`: `merged` or `grouped`. If omitted, uses `grouped` when multiple fields are provided, otherwise `merged`.

Returns a result object:

- `view`: resolved view name
- `fields`: array of fields used
- `totalFiles`: total JSON files in the view
- `missingAll`: files where none of the fields has a value
- `missingByField`: per-field missing counts
- `readErrors`: file read errors
- `aggregated`: merged or grouped counts (see `mode`)
- `byField`: counts per field

Example:

```js
await window.paperReviewerApp.getFieldStatsForCurrentView({
  fields: ['wos_data.publication_year', 'wos_data.issn']
});
```

Group mode example (fields are grouped by array order):

```js
await window.paperReviewerApp.getFieldStatsForCurrentView({
  fields: ['wos_data.publication_year', 'wos_data.issn'],
  mode: 'grouped'
});
```

Disable console.table output:

```js
await window.paperReviewerApp.getFieldStatsForCurrentView({
  fields: 'wos_data.publication_year',
  table: false
});
```

Use a specific view without changing the UI view:

```js
await window.paperReviewerApp.getFieldStatsForCurrentView({
  fields: 'wos_data.publication_year',
  view: 'view2'
});
```

Merged mode example (multiple fields share one count map):

```js
await window.paperReviewerApp.getFieldStatsForCurrentView({
  fields: ['wos_data.publication_year', 'wos_data.issn'],
  mode: 'merged'
});
```

Grouped mode with three fields (order matters):

```js
await window.paperReviewerApp.getFieldStatsForCurrentView({
  fields: ['wos_data.publication_year', 'wos_data.issn', 'wos_data.document_type'],
  mode: 'grouped'
});
```

## Field Path Rules

- Dot path access is supported: `a.b.c`.
- Array index access is supported with brackets: `authors[0].name`.
- Values are normalized to strings and counted.

## Notes

- Counts are aggregated per value string.
- If a field returns an array of values, the first value is used for grouped aggregation; all values are counted in merged mode.
- Only JSON files in the current view are scanned.
