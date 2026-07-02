# ADR-002: SCORM Metadata Pipeline (Upload + Manifest Parsing)

| Field  | Value |
|--------|-------|
| Status | **Proposed** — awaiting review |
| Date   | 2026-05-25 |
| Scope  | SCORM package upload, manifest parsing, metadata persistence |
| Affects | `api/src/scorm/`, `api/prisma/schema.prisma`, `web/src/components/course-player/`, `web/src/app/api/scorm/` |

## Context

The LMS needs SCORM package support for course authoring. This phase is limited to **metadata extraction** and **launch URL generation**; it explicitly excludes SCORM runtime behaviors (suspend data, sequencing, scoring).

## Decision

1. **Upload via presigned URLs**  
   SCORM packages are uploaded directly to MinIO using presigned PUT URLs. The backend validates and confirms uploads afterward.

2. **Manifest parsing at confirm time**  
   The backend retrieves the uploaded ZIP from storage, extracts `imsmanifest.xml`, parses core metadata (identifier, version, title, launch path), and persists it in a `ScormPackage` record.

3. **On-demand file streaming**  
   SCORM assets are served through authenticated backend routes (`/scorm/:id/files/*`) that extract files from the ZIP on demand. This preserves tenant isolation without exposing public buckets.

4. **No runtime engine**  
   No SCORM runtime APIs, suspend data, sequencing, or scoring in this phase. The course player simply embeds the launch file in an iframe.

## Data Model

`ScormPackage` stores:
- Tenant + course ownership
- Storage object key for the ZIP
- Manifest metadata (identifier, version, title)
- Launch path inside the ZIP
- Size and status

Lesson content references the package via:
```json
{ "scormPackageId": "uuid" }
```

## APIs

- `POST /courses/:courseId/scorm/upload-url` → presigned PUT URL
- `PATCH /scorm/:id/confirm` → parse manifest and persist metadata
- `GET /scorm/:id` → metadata
- `GET /scorm/:id/launch` → launch metadata
- `GET /scorm/:id/files/*` → authenticated file streaming

## Validation

- Upload must be a ZIP
- `imsmanifest.xml` is required
- Launch path must be present and not contain `..` or absolute paths
- Tenant isolation enforced on all reads

## Consequences

- Launch URLs are tenant-safe and do not expose storage buckets.
- Serving assets from a ZIP on demand is acceptable for metadata phase; future runtime can replace this with unzipped storage or CDN.
