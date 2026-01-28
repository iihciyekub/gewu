# GroupBy Fields Module (js/groupby-fields.js)

This module adds field-based aggregation helpers to the PaperStatsApp instance.
It is loaded after `js/app.js` and extends `PaperStatsApp.prototype` with `groupByFields()`.

## Load

`index.html` includes:

- `js/app.js`
- `js/groupby-fields.js`

## Main API

### groupByFields(options)

Aggregate counts for one or more fields across all JSON files in the current JSON view.

Options:

- `fields`: string or array of strings. Each string is a dot path, e.g. `wos_data.publication_year`.
- `view`: optional view name. Defaults to current `jsonViewSelect` value.
- `log`: boolean. When true, prints a table and summary to the console. Default: true.
- `table`: boolean. When true, uses `console.table` for the result list. Default: true.
- `concurrency`: max parallel file reads. Default: 12.
- `progress`: boolean. When true, shows status-bar progress. Default: true.
- `groupByGroupName`: boolean. When true, prepend the file group name as the first grouping column. Default: false.
- `groupNames`: string or array of strings. When provided, only files in these groups are scanned; if no match, all groups are used. Default: null.
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
- `groupedRows`: array for grouped mode (each row has field columns + `count`), otherwise null
- `groupLabel`: group selection label (e.g. `A + B` or `all`)

Example:

```js
await window.paperStats.groupByFields({
  fields: ['wos_data.publication_year', 'wos_data.issn']
});
```

Group mode example (fields are grouped by array order):

```js
await window.paperStats.groupByFields({
  fields: ['wos_data.publication_year', 'wos_data.issn'],
  mode: 'grouped'
});
```

Grouped mode output uses multiple columns (one per field plus `count`).

Disable console.table output:

```js
await window.paperStats.groupByFields({
  fields: 'wos_data.publication_year',
  table: false
});
```

Reduce concurrency if the browser hits resource limits:

```js
await window.paperStats.groupByFields({
  fields: ['wos_data.publication_year', 'wos_data.issn'],
  concurrency: 4
});
```

Use a specific view without changing the UI view:

```js
await window.paperStats.groupByFields({
  fields: 'wos_data.publication_year',
  view: 'view2'
});
```

Merged mode example (multiple fields share one count map):

```js
await window.paperStats.groupByFields({
  fields: ['wos_data.publication_year', 'wos_data.issn'],
  mode: 'merged'
});
```

Grouped mode with three fields (order matters):

```js
await window.paperStats.groupByFields({
  fields: ['wos_data.publication_year', 'wos_data.issn', 'wos_data.document_type'],
  mode: 'grouped'
});
```

Group by file group name + fields:

```js
await window.paperStats.groupByFields({
  fields: ['wos_data.publication_year', 'wos_data.issn'],
  groupByGroupName: true
});
```

Only scan specific groups (falls back to all when not found):

```js
await window.paperStats.groupByFields({
  fields: ['wos_data.publication_year', 'wos_data.issn'],
  groupNames: ['init', 'group-2']
});
```

## Field Path Rules

- Dot path access is supported: `a.b.c`.
- Array index access is supported with brackets: `authors[0].name`.
- Values are normalized to strings and counted.

## Notes

- Counts are aggregated per value string.
- If a field returns multiple values, grouped mode combines all values into Cartesian combinations; merged mode counts all values.
- Only JSON files in the current view are scanned.
