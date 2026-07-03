# Level‑up: Lesson resources + video uploads

## What exists today

- **Video upload** — `VideoUpload` component + `/courses/:id/videos/upload-url`, `PATCH /videos/:id/confirm`, presigned MinIO PUT, thumbnail/duration extraction. It is already wired into `lecture-editor.tsx` for video lessons. Nothing new needed on the backend; just make sure the video lesson editor path is easy to reach from the curriculum builder.
- **Downloadable resources** — `LectureResourcesMenu` → "Downloadable File" tab exists in the UI but the "Select File" button is a stub (`setSelectedFileName("sample-document.pdf")`). No backend, no real upload, no listing, no learner-side download.

## Goals

1. Real upload of any file (PDF, ZIP, DOCX, images, etc.) from the instructor's local device, attached to a lesson as a downloadable resource — works for **all** lesson types (video, article, quiz, scorm), not just video.
2. Verify the existing video-upload flow is discoverable and works end‑to‑end when a curriculum item is switched to type `video`.

## Scope

### Backend (`api/`)

1. **Schema** — new `LessonResource` model + migration:
   ```
   id, tenantId, lessonId, label, fileName, mimeType,
   sizeBytes, objectKey, uploadedBy, createdAt
   ```
   Index `(tenantId, lessonId)`. Cascade delete on lesson.
2. **`LessonResourceModule`** (new):
   - `POST /lessons/:id/resources/upload-url` → presigned PUT (bucket `lms-resources`, TTL 15 min, max 100 MB). Validates tenant + role (`admin`/`instructor`) + course ownership. Returns `{ resourceId, uploadUrl, objectKey, maxSizeBytes, expiresAt }`.
   - `POST /lessons/:id/resources/confirm` → verifies object exists (`HeadObject`), persists `LessonResource` row.
   - `GET  /lessons/:id/resources` → list (any authenticated user with course access; learners must be enrolled OR course must be published).
   - `GET  /resources/:id/download` → presigned GET (TTL 1h). Enforces the same access rule as list.
   - `DELETE /resources/:id` → soft‑delete (admin/instructor), also `deleteObject` from storage.
3. **Runtime config** — add `RESOURCE_BUCKET`, `RESOURCE_UPLOAD_MAX_BYTES` env with sensible defaults in `runtime.ts`.
4. **Reuse** existing `StorageService`, presign helpers, tenant middleware, and the enrolment check used by `VideoService.getStreamUrl`.

### Frontend (`web/`)

1. **`web/src/lib/api/lesson-resources.ts`** — hooks: `useListResources(lessonId)`, `useRequestResourceUpload(lessonId)`, `useConfirmResourceUpload(lessonId)`, `useDeleteResource()`, `getResourceDownloadUrl(id)`.
2. **Next.js API proxies** under `web/src/app/api/lessons/[id]/resources/...` and `web/src/app/api/resources/[id]/...` mirroring the existing video proxy pattern.
3. **`ResourceUploader` component** (`web/src/components/course-editor/resource-upload.tsx`) — mirrors `VideoUpload`: dropzone, XHR presigned PUT with progress, label field, size/type validation, error `Notice`.
4. **Replace the stub** in `lecture-sub-menus.tsx` "Downloadable File" tab with `<ResourceUploader lessonId={...} />` plus a live list of already-attached resources (name, size, delete button).
5. **Learner view** — in `web/src/components/course-player/lesson-content.tsx`, render a "Resources" section under every lesson type showing each resource as a link that hits `/api/resources/:id/download` (opens the presigned URL in a new tab).
6. **Video lesson quick check** — from the curriculum builder, when an item's content type is set to `video` via `LectureContentSelector`, ensure the existing `VideoUpload` surface in `lecture-editor.tsx` is reachable; add a small "Upload video" affordance in `sortable-module-item.tsx` for video-type lessons that opens the lecture editor. No new backend.

### Out of scope (this pass)

- Library picker tab, external URL tab (already wired), source-code tab (already wired).
- Per-resource ordering / preview thumbnails.
- Anti-virus scanning, watermarking, DRM.
- Bulk multi-file drag & drop (single-file per pick for v1).

## Verification

- `curl` presigned PUT with a small PDF, then `POST /confirm` → row exists, `GET /resources` lists it, `GET /download` streams the file.
- In the browser, upload a PDF from the curriculum builder → appears in the list; open the learner course player → download link works.
- Regression: existing video upload still works from a video lesson.
- `api` build + Prisma migration + `web` typecheck all clean.
