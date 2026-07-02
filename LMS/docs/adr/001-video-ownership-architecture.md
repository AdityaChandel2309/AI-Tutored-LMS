# ADR-001: Video Ownership Architecture

| Field       | Value                                      |
| ----------- | ------------------------------------------ |
| Status      | **Proposed** — awaiting review             |
| Date        | 2025-05-25                                 |
| Scope       | Video upload, storage, delivery, tenanting |
| Affects     | `api/src/storage/`, `api/prisma/schema.prisma`, `web/src/components/course-player/` |

## Context

The LMS needs a video pipeline to support video lesson types. This is the next major capability
after player stabilization. Video infrastructure is a **foundational subsystem** — decisions
made here affect storage costs, delivery latency, tenant isolation, and future scaling.

### Current State

- **Object storage**: MinIO (S3-compatible) already running in Docker Compose, used for avatar uploads
- **Storage service**: `api/src/storage/storage.service.ts` provides S3 client with `@aws-sdk/client-s3`
- **Lesson model**: `type: String` (supports "video"), `content: Json?` (flexible metadata store)
- **Runtime config**: `api/src/config/runtime.ts` centralizes MinIO endpoint/credentials/bucket config
- **Production path**: MinIO → AWS S3 (same SDK, just change endpoint + credentials)

---

## Decision: MinIO-First with Signed URLs

### Storage: MinIO (S3-compatible) — Single Provider

**Decision**: Use MinIO for all video storage. No Mux or external transcoding service initially.

**Rationale**:
- MinIO is already deployed and configured
- S3 SDK is already integrated
- Same code works with AWS S3 in production (just change env vars)
- Avoids vendor lock-in and external API complexity
- Sufficient for MVP — transcoding can be added later as a processing layer

**Rejected alternatives**:
- **Mux**: Excellent product but adds vendor dependency, cost per minute, and external API complexity. Consider post-MVP when adaptive bitrate becomes a requirement.
- **Cloudflare Stream**: Similar vendor concerns. Evaluate when CDN-level delivery is needed.

### Upload Authorization: Presigned URLs

**Decision**: Use S3 presigned PUT URLs for direct browser-to-MinIO uploads.

**Rationale**:
- Avoids streaming large files through the Node.js API server
- Reduces API server memory pressure and timeout risk
- Standard S3 pattern — works identically with AWS S3
- Upload authorization is enforced at URL generation time (backend validates role + tenant)

**Flow**:
```
1. Instructor calls POST /api/courses/:id/videos/upload-url
   - Backend validates: user role, course ownership, tenant scope
   - Backend generates presigned PUT URL (expires 15 min)
   - Backend creates Video record in DB with status: 'pending'
   - Returns: { uploadUrl, videoId, expiresAt }

2. Frontend uploads directly to MinIO via presigned URL
   - Shows upload progress
   - On completion, calls PATCH /api/videos/:id/confirm

3. Backend confirms upload
   - Verifies object exists in storage (HeadObject)
   - Updates Video record: status → 'ready', size, duration (if extractable)
   - Returns confirmed Video metadata
```

### Tenant Isolation: Bucket-per-Tenant with Key Prefixes

**Decision**: Use a single bucket with tenant-prefixed object keys.

**Pattern**: `videos/{tenantId}/{courseId}/{videoId}-{timestamp}.{ext}`

**Rationale**:
- Simpler than bucket-per-tenant (avoid bucket proliferation)
- Tenant isolation enforced at the application layer (all queries are tenant-scoped)
- Consistent with existing avatar pattern (`avatars/{userId}-{timestamp}.{ext}`)
- Key prefix enables future bucket policies per tenant if needed

**Rejected**: Bucket-per-tenant — operational overhead of managing hundreds of buckets outweighs isolation benefits at current scale.

### Signed URLs for Delivery

**Decision**: Serve videos via presigned GET URLs with short TTL.

**Rationale**:
- Prevents direct public access to video objects
- URL expiry enforces access control (enrolled users only)
- TTL of 2 hours — long enough for video playback, short enough for security
- Backend generates signed URL only after verifying enrollment + tenant

**Flow**:
```
GET /api/videos/:id/stream
  - Verify: user enrolled in course, tenant match
  - Generate presigned GET URL (2h TTL)
  - Return: { url, expiresAt }
  - Frontend uses URL in <video src="...">
```

### Transcoding: Deferred

**Decision**: No server-side transcoding in MVP. Accept uploaded format as-is.

**Rationale**:
- Modern browsers handle MP4/H.264 natively
- Transcoding adds massive infrastructure complexity (FFmpeg workers, queue processing)
- Upload validation enforces acceptable formats (MP4, WebM)
- Adaptive bitrate (HLS/DASH) is a post-MVP concern

**File validation at upload**:
- Max size: 2 GB (configurable via env)
- Allowed MIME types: `video/mp4`, `video/webm`, `video/quicktime`
- Duration extraction: best-effort from metadata (not blocking)

### Thumbnails: Deferred

**Decision**: No auto-generated thumbnails in MVP.

**Rationale**:
- Requires FFmpeg or similar — same complexity as transcoding
- Instructors can upload a poster image separately if needed
- Future: extract thumbnail at upload confirmation time

### Adaptive Bitrate: Deferred

**Decision**: No HLS/DASH segmentation in MVP.

**Rationale**:
- Requires transcoding infrastructure
- Single-file MP4 with progressive download is sufficient for MVP
- Evaluate when user count or video library size warrants CDN-level delivery

### Storage Quotas: Per-Tenant Soft Limits

**Decision**: Implement soft quota checks at upload time, tracked in DB.

**Implementation**:
- `Tenant` model gets `videoStorageQuotaBytes` (default: 10 GB)
- `Video` model tracks `sizeBytes`
- Upload URL generation sums existing video sizes and rejects if quota exceeded
- No hard S3 policy enforcement (application-layer only)

---

## Data Model

### New: `Video` model

```prisma
model Video {
  id          String   @id @default(uuid())
  tenantId    String
  courseId     String
  lessonId    String?  // nullable until linked to a lesson
  title       String
  status      String   @default("pending") // pending | ready | failed | deleted
  objectKey   String   // S3 object key: videos/{tenantId}/{courseId}/{id}-{ts}.mp4
  sizeBytes   Int?
  durationSec Int?
  mimeType    String   @default("video/mp4")
  uploadedBy  String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  course      Course   @relation(fields: [courseId], references: [id])
  lesson      Lesson?  @relation(fields: [lessonId], references: [id])
  uploader    User     @relation(fields: [uploadedBy], references: [id])
}
```

### Modified: `Lesson.content` usage for video type

When `lesson.type === 'video'`, `lesson.content` stores:
```json
{
  "videoId": "uuid",
  "posterUrl": null
}
```

This keeps the `content` field generic and avoids schema coupling.

---

## API Surface

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/courses/:courseId/videos/upload-url` | Generate presigned PUT URL |
| `PATCH` | `/videos/:id/confirm` | Confirm upload completed |
| `GET` | `/videos/:id` | Get video metadata |
| `GET` | `/videos/:id/stream` | Get presigned GET URL for playback |
| `DELETE` | `/videos/:id` | Soft-delete (mark as deleted) |

---

## Environment Variables (New)

| Variable | Default | Description |
|----------|---------|-------------|
| `VIDEO_BUCKET` | `lms-videos` | S3 bucket for video storage |
| `VIDEO_UPLOAD_MAX_BYTES` | `2147483648` (2GB) | Max upload size |
| `VIDEO_PRESIGN_UPLOAD_TTL_SEC` | `900` (15min) | Upload URL expiry |
| `VIDEO_PRESIGN_STREAM_TTL_SEC` | `7200` (2hr) | Playback URL expiry |
| `VIDEO_STORAGE_QUOTA_BYTES` | `10737418240` (10GB) | Default per-tenant quota |

---

## Implementation Order

1. **Schema**: Add `Video` model + migration
2. **Storage extension**: Add `uploadVideo` / `getVideoStreamUrl` to `StorageService`
3. **Video service**: Business logic (presign, confirm, quota, tenant scope)
4. **Video controller**: REST endpoints
5. **Frontend proxy routes**: Next.js API routes
6. **Player integration**: `<video>` element with signed URL in `LessonContent`
7. **Upload UI**: Video upload in instructor course editor

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large uploads fail mid-stream | Presigned URLs support multipart; add retry UI |
| MinIO downtime | Health check in Docker Compose; separate volume |
| Tenant data leak | All queries tenant-scoped; signed URLs per-user |
| Storage costs grow | Soft quotas + monitoring; future: lifecycle rules |
| Browser compatibility | Restrict to MP4/WebM; progressive download |

---

## Future Evolution Path

1. **Transcoding** → BullMQ job → FFmpeg worker → HLS output
2. **Adaptive bitrate** → HLS segmented output to S3
3. **CDN** → CloudFront/Cloudflare in front of S3
4. **Mux migration** → Replace storage layer, keep same API surface
5. **Thumbnails** → FFmpeg frame extraction at upload confirmation
6. **Captions** → SRT/VTT upload alongside video, stored in same bucket
