# Bib Download API

This document describes the server-side API that generates and downloads BibTeX files from DOI lists.

## Endpoint

- Method: `POST`
- Path: `/bib-download`
- Content-Type: `application/json`

## Request Body

```json
{
  "dois": ["10.1002/joom.1110", "10.1287/mnsc.2021.00380"],
  "filename": "refs.bib",
  "concurrency": 3
}
```

Fields:

- `dois` (array<string>, required): DOI list to fetch.
- `doi` (string, optional): Single DOI (alternative to `dois`).
- `filename` (string, optional): Output filename. Defaults to `references_YYYYMMDD.bib`.
- `concurrency` (number, optional): Max concurrent DOI fetches. Default: 3.

If both `dois` and `doi` are provided, `dois` takes precedence.

## Response

- Success: HTTP 200 with BibTeX content as `text/plain`.
- Content-Disposition: `attachment; filename="<safeName>.bib"`.

## Error Responses

- 400: Missing DOI(s).
- 500: Server error (JSON body with `error`).

## Examples

Download BibTeX to a file:

```bash
curl -X POST http://127.0.0.1:8000/bib-download \
  -H "Content-Type: application/json" \
  -d '{"dois":["10.1002/joom.1110","10.1287/mnsc.2021.00380"],"filename":"refs.bib"}' \
  -o refs.bib
```

Single DOI:

```bash
curl -X POST http://127.0.0.1:8000/bib-download \
  -H "Content-Type: application/json" \
  -d '{"doi":"10.1002/joom.1110"}' \
  -o single.bib
```

## Notes

- The server fetches BibTeX from `doi.org` using the `application/x-bibtex` accept header.
- If remote fetch fails, a minimal fallback entry is generated for each DOI.
- The response is plain text; use `-o` in curl to save the file.
