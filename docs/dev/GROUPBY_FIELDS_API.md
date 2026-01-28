# GroupBy Fields API

This document describes the server-side API that aggregates JSON field values for a given view.

## Endpoint

- Method: `POST`
- Path: `/groupby-fields`
- Content-Type: `application/json`

## Request Body

```json
{
  "projectPath": "/path/to/project",
  "fields": ["wos_data.publication_year", "wos_data.issn"],
  "view": "view1",
  "mode": "grouped",
  "groupByGroupName": true,
  "groupNames": ["group-a"],
  "concurrency": 8
}
```

Fields:

- `projectPath` (string, required): Project root path.
- `fields` (string | array<string>, optional): Field path(s). Defaults to `wos_data.publication_year`.
- `view` (string, optional): View name, default `view1`.
- `mode` (string, optional): `merged` or `grouped`. Defaults to `grouped` when multiple fields are provided, otherwise `merged`.
- `groupByGroupName` (boolean, optional): Prepend group name as the first column. Forces grouped mode.
- `groupNames` (string | string[], optional): Filter to specific groups (by `id` or `name`).
- `fallbackAllGroups` (boolean, optional): When `groupNames` has no match, include all groups instead of empty result. Default: false.
- `concurrency` (number, optional): Max concurrent file reads (default 8).

## Response

- Success: HTTP 200, JSON payload:

```json
{
  "success": true,
  "data": {
    "view": "view1",
    "fields": ["wos_data.publication_year"],
    "totalFiles": 120,
    "missingAll": 2,
    "missingByField": {"wos_data.publication_year": 4},
    "readErrors": 0,
    "aggregated": {"2020": 12, "2021": 20},
    "byField": {"wos_data.publication_year": {"2020": 12, "2021": 20}},
    "groupedRows": null,
    "mode": "merged"
  }
}
```

## Error Responses

- 400: Missing `projectPath`.
- 500: Server error (JSON body with `error`).

## Examples

Merged mode (single field):

```bash
curl -X POST http://127.0.0.1:8000/groupby-fields \
  -H "Content-Type: application/json" \
  -d '{"projectPath":"/path/to/project","fields":"wos_data.publication_year"}'
```

Grouped mode (multiple fields):

```bash
curl -X POST http://127.0.0.1:8000/groupby-fields \
  -H "Content-Type: application/json" \
  -d '{"projectPath":"/path/to/project","fields":["wos_data.publication_year","wos_data.issn"],"mode":"grouped"}'
```

Grouped mode with group names (uses `.file_order.json`):

```bash
curl -X POST http://127.0.0.1:8000/groupby-fields \\
  -H "Content-Type: application/json" \\
  -d '{\"projectPath\":\"/path/to/project\",\"fields\":[\"wos_data.publication_year\"],\"groupByGroupName\":true,\"groupNames\":[\"init\"]}'\n```

## Notes

- The API reads JSON files from `json/<view>/`. If that directory does not exist, it falls back to `json/`.
- Grouped mode produces `groupedRows` with one column per field plus `count`.
- Values are normalized to strings; non-primitive values are ignored.
- Group definitions are read from `.file_order.json` in the project root.
- Files are filtered by `groupNames` (if any). When no match, result is empty unless `fallbackAllGroups: true`.
