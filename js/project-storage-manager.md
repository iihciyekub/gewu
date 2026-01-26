# Project Storage Manager

This module manages per-project persistence for files and UI state. It wraps
localStorage and server endpoints so the app can read/write project-scoped data
(such as JSON/MD content, metadata, and view preferences) in a consistent way.

Usage notes:
- Loaded by `index.html` via `js/project-storage-manager.js`.
- Designed to be used by `js/app.js` for project-level read/write operations.
