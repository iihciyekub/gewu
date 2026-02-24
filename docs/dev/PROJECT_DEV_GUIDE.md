# Project Dev Guide

This document consolidates project structure, key flows, and core functions.
Keep it updated as features change.

## Purpose
- Single source of truth for development notes
- Quick map of key modules and data flow
- Record of non-obvious functions and behaviors

## Project Layout (High Level)
- `index.html`: main UI shell
- `js/app.js`: main application logic and UI handlers
- `server.js`: backend API and filesystem access
- `js/core/`: shared utilities (markdown, autocomplete, storage, etc.)
- `src/schema/`: JSON schema and field mapping assets
- `docs/dev/`: development documentation (this folder)

## Core Flows

### Project Selection
- Project is required before any file operations
- `/validate-project` checks structure; missing projectPath is rejected

### File Read/Write
- JSON and MD operations go through `server.js`
- Project path is required and validated for every API call

### PDF View (Embedded)
- Embedded PDF loads in iframe

## Key Functions (App)
- `loadFileList()`: loads file list for current project
- `getRequiredProjectPath()`: enforces selected project before file operations
- `saveToFile()`: save current JSON file

## Key Functions (Server)
- `normalizeProjectPath(projectPath)`: validates project path
- `/save-json`, `/save-md`, `/read-file`: file I/O
- `/list-json-files`: view discovery for JSON/MD

## Data Assets
- `src/schema/autocomplete-commands.json`: autocomplete commands
- `src/schema/WosFieldTags.json`: WOS field mapping

## Update Checklist
- When adding or removing APIs, update `server.js` section
- When UI flows change, update the Core Flows section
- When assets move, update Data Assets section
