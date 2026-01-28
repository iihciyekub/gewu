# Layout Restore Logic

This document lists where layout/position state is saved and restored on app reload.

## Panel widths & collapse state

- **Location (code):** `js/app.js`
  - `setupResizers()`
  - `restorePanelWidths(leftPanel, rightPanel)`
  - `savePanelWidths(leftPanel, rightPanel, extras)`
  - `toggleLeftPanelVisibility()` / `toggleRightPanelVisibility()`

- **Storage key:** `localStorage.panelWidths`

- **Saved fields:**
  - `left`, `right` (current widths)
  - `collapsedLeft`, `collapsedRight`
  - `lastLeftWidth`, `lastRightWidth`
  - `timestamp`

- **Restore flow:**
  1) `setupResizers()` calls `restorePanelWidths()` on app init.
  2) `restorePanelWidths()` applies widths and collapsed flags to left/right panels.
  3) Resizer drag end calls `savePanelWidths()` to persist new widths.

## MD chat panel height & visibility

- **Location (code):** `js/app.js`
  - `initMarkdownChatPanel()`

- **Storage keys:**\n+  - `localStorage.mdChatHeight`\n+  - `localStorage.mdChatHidden`\n+  - `localStorage.mdChatDocked`

- **Restore flow:**
  1) On init, `initMarkdownChatPanel()` reads `mdChatHeight`, `mdChatHidden`, `mdChatDocked`.\n+  2) Dragging the chat resizer updates the height and persists to `mdChatHeight`.\n+  3) Close/Toggle updates `mdChatHidden`; Expand updates `mdChatDocked`.

## Related UI toggles

- **MD chat dock/hidden**
  - `initMarkdownChatPanel()` toggles `.is-docked` and `.is-hidden` on `#mdChatPanel`.
  - These states are persisted via `mdChatHidden` and `mdChatDocked`.

## Files & refs

- `js/app.js`: layout logic, persistence, and restore
- `index.html`: panel DOM structure
- `css/styles.css`: panel layout classes (e.g., `.panel-collapsed`, `.chat-docked`)
