# WOS Import Module

This module contains the Web of Science (WOS) import logic extracted from `js/app.js`.
It attaches WOS-related methods to `window.PaperStatsApp.prototype` via
`js/wos-import.js`, keeping import behavior centralized and easier to maintain.

## Included methods
- `handleWosTxtImport`
- `mergeWosData`
- `applyWosLinkFields`
- `syncWosLinks`
- `normalizeWosIdPrefix`
- `parseWosTxt`
- `isValidWosTxt`
- `extractWosDoi`
- `extractWosId`
- `wosidToFilenameBase`
- `buildWosJsonPayload`
- `normalizeWosRecord`
- `splitWosFieldValue`
