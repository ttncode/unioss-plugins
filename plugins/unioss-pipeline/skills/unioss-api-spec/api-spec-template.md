# [System] API Specification: [Feature]

## Overview
[One-paragraph purpose.]

## API Endpoint
- **URL**: `/path/to/endpoint`
- **HTTP Method**: `POST|GET|PUT|DELETE`
- **Content-Type**: `application/json`

## Authentication
| Header | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `X-Api-Key` | string | Yes | Secret key. |

A missing, empty, or non-matching key returns HTTP `401`.

## Request Parameters (JSON)
| Field | Type | Required | Rules / Description |
| :--- | :--- | :--- | :--- |
| `field` | string | Yes | Rule. |

### Request Example
```bash
curl --request POST --url http://localhost:2380/... --header 'content-type: application/json' --data '{ }'
```

## Response Structure (JSON)
**Success (HTTP 200):**
```json
{ "status": "success", "message": "...", "data": [] }
```
**Error:** `data` is `null`; `message` may hold newline-separated per-index errors.
```json
{ "status": "error", "message": "...", "data": null }
```
**Unauthorized (HTTP 401):**
```json
{ "status": "error", "message": "...", "data": null }
```

### Error Codes
| HTTP | Cause |
| :--- | :--- |
| 401 | Missing / invalid key. |
| 400 | Validation failure / malformed request. |
| 404 | Referenced resource not found. |
| 500 | Server/DB failure. |
