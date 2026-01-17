# Markdown Front Matter Implementation Summary (Current)

## Overview
This project supports YAML front matter in Markdown files. Metadata is parsed on render and displayed above the Markdown content.

## Current Implementation

### Core Parser
- `js/core/frontmatter-parser.js`
  - Parses front matter and returns `{ metadata, content }`.
  - Handles strings, numbers, booleans, null, arrays, and multiline blocks.

### App Integration
- `js/app.js`
  - Initializes `this.frontMatterParser` on first use.
  - Extracts metadata in `renderMarkdownView()` and stores it in `this.currentMarkdownMetadata`.
  - Renders metadata with `renderMetadataSection()` when metadata exists.

### Styles
- `css/styles.css`
  - `.markdown-metadata`, `.metadata-header`, `.metadata-table` for layout and collapse behavior.

## Supported Front Matter Example
```yaml
---
title: Example
version: 1
published: true
tags: [AI, ML]
description: |
  Line one
  Line two
---
```

## Behavior Notes
- Front matter is optional; Markdown renders normally if absent.
- Parsed metadata is displayed as a table above the Markdown body.
- Collapsed state is stored per Markdown file.

## Removed/Not Present
The following were referenced in older summaries but are not part of the current repo:
- `test_frontmatter.html`
- `METADATA_FEATURE.md`
- `FRONTMATTER_GUIDE.md`
- `EXAMPLE_WITH_METADATA.md`

## Maintenance Checklist
- Update `js/app.js` parsing logic if front matter rules change.
- Keep `css/styles.css` metadata styles in sync with UI changes.
- Update this file when adding new metadata features.
