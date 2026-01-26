# AutocompleteManager

Location: `js/autocomplete.js`

## Purpose
Provides Markdown editor autocomplete for:
- LaTeX-style commands (triggered by `\\`)
- JSON path field suggestions based on the current JSON data (e.g. `meta_info.`)

The manager renders a dropdown at the caret position and inserts the selected suggestion into the textarea.

## Features
- Command completion with `triggerChar` (default: `\\`).
- Path completion from a dynamic provider (`pathProvider`).
- Keyboard navigation: `ArrowUp`, `ArrowDown`, `Enter`, `Tab`, `Escape`.
- Mouse click selection in the dropdown.

## Construction
```js
new AutocompleteManager(textarea, {
  triggerChar: '\\',
  minChars: 1,
  maxSuggestions: 10,
  pathProvider: {
    getSuggestions: (context) => []
  }
});
```

## Path Provider Contract
The `pathProvider` is optional. When provided, it should implement:
```js
getSuggestions(context) => Array<string | { label, insertText, detail }>
```
Where `context` includes:
- `basePath`: the part before the last dot (`meta_info` in `meta_info.ti`)
- `prefix`: the current token after the last dot (`ti` in `meta_info.ti`)
- `completionStart` / `completionEnd`: insertion range

## Notes
- Suggestions are computed on each input, so they stay in sync with dynamic JSON updates.
- Placeholder markers like `$1` in `insertText` are supported and removed on insert.
