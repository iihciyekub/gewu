# SpecialSyntaxManager

Location: `js/special-syntax-manager.js`

## Purpose
Manages special inline syntax used in Markdown or text fields, including LaTeX-style commands such as:
- `\\cite{}`
- `\\citep{}`
- `\\bib{}`
- `\\goto{}`
- `\\doi{}`

It provides helpers to detect, extract, render, and update these syntaxes, and exposes the class on `window.SpecialSyntaxManager`.

## Key API
- `getSyntaxTypes()`
- `registerSyntax(name, config)`
- `unregisterSyntax(name)`
- `hasAnySyntax(text)`
- `detectSyntaxTypes(text)`
- `extractMatches(text, syntaxType)`
- `renderAllSyntax(text, options)`
- `renderSyntaxType(text, syntaxType, options)`
- `updateSyntaxContent(text, syntaxType, oldContent, newContent, targetIndex)`

## Notes
- Rendering relies on methods provided by the app instance (e.g. `normalizeDoiString`, `renderCitationPlaceholder`).
- Caches are kept per syntax type in `renderCache` and can be cleared with `clearCache()`.
