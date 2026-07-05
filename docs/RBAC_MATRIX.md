# RBAC Matrix & Module Ownership

## Roles

| Role | Description |
|------|-------------|
| `super_admin` | Cross-tenant / platform owner; the only role that can publish courses out of review |
| `admin` | Full tenant administration — user management, analytics, audit, organization |
| `instructor` | Course creation, content management, assessments, certificates |
| `learner` | Course enrollment, progress tracking, AI tutor, certificates (own) |

## Endpoint Access Matrix

| Module | Endpoint | super_admin | admin | instructor | learner |
|--------|----------|:-----------:|:-----:|:----------:|:-------:|
| **Auth** | POST /auth/exchange | ✅ | ✅ | ✅ | ✅ |
| | POST /auth/refresh | ✅ | ✅ | ✅ | ✅ |
| **Users** | GET /users | ✅ | ✅ | ❌ | ❌ |
| | POST /users | ✅ | ✅ | ❌ | ❌ |
| | PATCH /users/:id/roles | ✅ | ✅ | ❌ | ❌ |
| **Profile** | GET /me | ✅ | ✅ | ✅ | ✅ |
| | PATCH /profile | ✅ | ✅ | ✅ | ✅ |
| **Courses** | GET /courses | ✅ | ✅ | ✅ | ✅ |
| | POST /courses | ✅ | ✅ | ✅ | ❌ |
| | PATCH /courses/:id | ✅ | ✅ | ⚠️ draft/archived only | ❌ |
| | DELETE /courses/:id | ✅ | ✅ | ✅ (own drafts) | ❌ |
| | POST /courses/:id/submit-review | ✅ | ✅ | ✅ | ❌ |
| | POST /courses/:id/publish | ✅ | ❌ | ❌ | ❌ |
| | POST /courses/:id/archive | ✅ | ✅ | ❌ | ❌ |
| | POST /courses/:id/unpublish | ✅ | ✅ | ❌ | ❌ |
| | POST /courses/:id/enroll | ✅ | ✅ | ✅ | ✅ |
| **Categories** | GET /categories | ✅ | ✅ | ✅ | ✅ |
| | POST/PATCH/DELETE /categories | ✅ | ✅ | ❌ | ❌ |
| **Modules** | POST /courses/:id/modules | ✅ | ✅ | ✅ | ❌ |
| **Lessons** | POST /modules/:id/lessons | ✅ | ✅ | ✅ | ❌ |
| **Lesson Resources** | POST /lessons/:id/resources | ✅ | ✅ | ✅ | ❌ |
| | GET /lessons/:id/resources | ✅ | ✅ | ✅ | ✅ (enrolled) |
| **Progress** | PATCH /progress | ✅ | ✅ | ✅ | ✅ |
| **Videos** | POST /courses/:id/videos/upload-url | ✅ | ✅ | ✅ | ❌ |
| **SCORM** | POST /courses/:id/scorm/upload-url | ✅ | ✅ | ✅ | ❌ |
| **Assessments** | POST /lessons/:id/assessment | ✅ | ✅ | ✅ | ❌ |
| | POST /assessments/:id/attempt | ✅ | ✅ | ✅ | ✅ |
| **Certificates** | POST /certificate-templates | ✅ | ✅ | ✅ | ❌ |
| | GET /my/certificates | ✅ | ✅ | ✅ | ✅ |
| | GET /verify/:code (public) | ✅ | ✅ | ✅ | ✅ |
| **Notifications** | GET /my/notifications | ✅ | ✅ | ✅ | ✅ |
| **Organization** | GET /departments | ✅ | ✅ | ✅ | ❌ |
| | POST /departments | ✅ | ✅ | ❌ | ❌ |
| **Employees** | GET /employees | ✅ | ✅ | ✅ | ❌ |
| | POST /employees/import | ✅ | ✅ | ❌ | ❌ |
| **Projects** | GET /projects | ✅ | ✅ | ✅ | ✅ |
| | POST /projects | ✅ | ✅ | ✅ | ❌ |
| **Knowledge** | GET /documents | ✅ | ✅ | ✅ | ✅ |
| | POST /documents | ✅ | ✅ | ✅ | ❌ |
| **AI Tutor** | POST /ai-tutor/chat | ✅ | ✅ | ✅ | ✅ |
| **Knowledge Assistant** | POST /knowledge-assistant/ask | ✅ | ✅ | ✅ | ✅ |
| **Analytics** | GET /analytics/dashboard-summary | ✅ | ✅ | ✅ | ❌ |
| | GET /analytics/reports/* | ✅ | ✅ | ✅ | ❌ |
| **Audit** | GET /audit/logs | ✅ | ✅ | ❌ | ❌ |

### Course edit gate (backend-enforced)

`PATCH /courses/:id` applies an additional status guard for instructor-only callers:

- ✅ allowed when `course.status ∈ { draft, archived }`
- ❌ rejected with `403 Forbidden` when `course.status ∈ { review, published }`

`admin` and `super_admin` bypass this status gate. The UI mirrors the rule by hiding the Edit action and showing a read-only notice, but the server is the source of truth.

### Publish workflow

```
draft ──submit-review──▶ review ──publish (super_admin)──▶ published
                                                              │
                                                       archive / unpublish
                                                              ▼
                                                          archived
```

## Module Ownership

| Module | Directory | Owner Role | Description |
|--------|-----------|-----------|-------------|
| Auth | `src/auth/` | Platform | Authentication & token management |
| User | `src/user/` | Admin | User CRUD & role assignment |
| Tenant | `src/tenant/` | Platform | Multi-tenant resolution |
| Course | `src/course/` | Instructor | Course lifecycle management |
| Module | `src/module/` | Instructor | Course module ordering |
| Lesson | `src/lesson/` | Instructor | Lesson content management |
| Progress | `src/progress/` | Learner | Learning progress tracking |
| Video | `src/video/` | Instructor | Video upload & streaming |
| SCORM | `src/scorm/` | Instructor | SCORM package management |
| Assessment | `src/assessment/` | Instructor | Quizzes & grading |
| Certificate | `src/certificate/` | Instructor | Certificate templates & issuance |
| Notification | `src/notification/` | Platform | In-app notifications |
| Analytics | `src/analytics/` | Admin | Reporting & dashboards |
| Organization | `src/organization/` | Admin | Departments & designations |
| Employee | `src/employee/` | Admin | Employee profiles & import |
| Project | `src/project/` | Admin | Project tracking |
| Knowledge | `src/knowledge/` | Instructor | Document management |
| Document Embedding | `src/document-embedding/` | Platform | Vector embeddings for RAG |
| Category | `src/category/` | Admin | Course categorisation |
| Lesson Resource | `src/lesson-resource/` | Instructor | Downloadable per-lesson attachments |
| AI Tutor | `src/ai-tutor/` | Platform | AI-powered course tutoring |
| Knowledge Assistant | `src/knowledge-assistant/` | Platform | Enterprise knowledge Q&A |
| Audit | `src/audit/` | Admin | Audit log governance |
| Health | `src/health/` | Platform | Liveness & readiness probes |
