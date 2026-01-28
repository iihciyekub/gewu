# JSON Query Module (js/json-query.js)

This module adds JSON query helpers to the PaperStatsApp instance.
It is loaded after `js/app.js` and extends `PaperStatsApp.prototype` with JSON query rendering and execution.

## Load

`index.html` includes:

- `js/app.js`
- `js/json-query.js`

## Main APIs

### renderJsonQueryPlaceholder(groups, fields)

Builds the inline placeholder button for `\json{groups}{fields}`.

### applyJsonQueryRendering(renderRoot)

Binds click handlers for `.json-inline` placeholders so they render results.

### queryJsonItems(options)

Queries JSON files and returns items with `doi` plus selected field values.

Options:

- `groupsRaw`: raw group token string
- `fieldsRaw`: raw fields list

### renderJsonQueryBlock(block)

Executes the query and renders the result as a collapsible JSON block.

## Example

```js
await window.paperStats.applyJsonQueryRendering(renderRoot);
```

## Notes

- Uses `readProjectFile()` with retry and yields to avoid UI lockups.
- Results are filtered by current view and group tokens.
