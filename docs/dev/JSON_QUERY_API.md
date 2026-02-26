# JSON Query API

This document describes the server-side API that returns JSON items filtered by fields and groups.

## Endpoint

- Method: `POST`
- Path: `/json-query`
- Content-Type: `application/json`

## Request Body

```json
{
  "fields": ["wos_data.publication_year", "wos_data.issn"],
  "view": "view1",
  "groupNames": ["Group A"],
  "concurrency": 4
}
```

Fields:

- `projectPath` (string, optional): Project root path. If omitted, the server uses the last selected project (currentProjectName).
- `fields` (string | array<string>, required): Field path(s). Can be comma-separated string or array.
- `view` (string, optional): View name, default `view1`.
- `groupNames` (string | string[], optional): Filter to specific groups by id/name.
- `fallbackAllGroups` (boolean, optional): When `groupNames` has no match, include all groups. Default: false.
- `concurrency` (number, optional): Max concurrent file reads (default 4).

## Response

```json
{
  "success": true,
  "data": {
    "items": [
      {"doi": "10.1234/abc", "wos_data.publication_year": "2021"}
    ],
    "total": 120,
    "view": "view1",
    "fields": ["wos_data.publication_year"],
    "groupNames": ["Group A"],
    "matchedGroupNames": ["Group A"]
  }
}
```

## Examples

```bash
curl -X POST http://127.0.0.1:8000/json-query \
  -H "Content-Type: application/json" \
  -d '{"view":"view1","fields":["wos_data.publication_year"],"groupNames":["init"]}'
```

## Notes

- Group definitions are read from `.file_order.json` in the project root.
- Only JSON files in `json/<view>/` are scanned (fallback to `json/`).
- Each item contains `doi` plus any requested fields found in the file.
