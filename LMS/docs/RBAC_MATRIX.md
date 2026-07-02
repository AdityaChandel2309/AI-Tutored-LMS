# RBAC Matrix & Module Ownership

## Roles

| Role | Description |
|------|-------------|
| `admin` | Full tenant administration — user management, analytics, audit, organization |
| `instructor` | Course creation, content management, assessments, certificates |
| `learner` | Course enrollment, progress tracking, AI tutor, certificates (own) |

## Endpoint Access Matrix

| Module | Endpoint | admin | instructor | learner |
|--------|----------|:-----:|:----------:|:-------:|
| **Auth** | POST /auth/exchange | ✅ | ✅ | ✅ |
| | POST /auth/refresh | ✅ | ✅ | ✅ |
| **Users** | GET /users | ✅ | ❌ | ❌ |
| | POST /users | ✅ | ❌ | ❌ |
| | PATCH /users/:id/roles | ✅ | ❌ | ❌ |
| **Profile** | GET /me | ✅ | ✅ | ✅ |
| | PATCH /profile | ✅ | ✅ | ✅ |
| **Courses** | GET /courses | ✅ | ✅ | ✅ |
| | POST /courses | ✅ | ✅ | ❌ |
| | PATCH /courses/:id | ✅ | ✅ | ❌ |
| | DELETE /courses/:id | ✅ | ✅ | ❌ |
| | POST /courses/:id/enroll | ✅ | ✅ | ✅ |
| **Modules** | POST /courses/:id/modules | ✅ | ✅ | ❌ |
| **Lessons** | POST /modules/:id/lessons | ✅ | ✅ | ❌ |
| **Progress** | PATCH /progress | ✅ | ✅ | ✅ |
| **Videos** | POST /courses/:id/videos/upload-url | ✅ | ✅ | ❌ |
| **SCORM** | POST /courses/:id/scorm/upload-url | ✅ | ✅ | ❌ |
| **Assessments** | POST /lessons/:id/assessment | ✅ | ✅ | ❌ |
| | POST /assessments/:id/attempt | ✅ | ✅ | ✅ |
| **Certificates** | POST /certificate-templates | ✅ | ✅ | ❌ |
| | GET /my/certificates | ✅ | ✅ | ✅ |
| **Notifications** | GET /my/notifications | ✅ | ✅ | ✅ |
| **Organization** | GET /departments | ✅ | ✅ | ❌ |
| | POST /departments | ✅ | ❌ | ❌ |
| **Employees** | GET /employees | ✅ | ✅ | ❌ |
| | POST /employees/import | ✅ | ❌ | ❌ |
| **Projects** | GET /projects | ✅ | ✅ | ✅ |
| | POST /projects | ✅ | ✅ | ❌ |
| **Knowledge** | GET /documents | ✅ | ✅ | ✅ |
| | POST /documents | ✅ | ✅ | ❌ |
| **AI Tutor** | POST /ai-tutor/chat | ✅ | ✅ | ✅ |
| **Knowledge Assistant** | POST /knowledge-assistant/ask | ✅ | ✅ | ✅ |
| **Analytics** | GET /analytics/dashboard-summary | ✅ | ✅ | ❌ |
| | GET /analytics/reports/* | ✅ | ✅ | ❌ |
| **Audit** | GET /audit/logs | ✅ | ❌ | ❌ |

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
| AI Tutor | `src/ai-tutor/` | Platform | AI-powered course tutoring |
| Knowledge Assistant | `src/knowledge-assistant/` | Platform | Enterprise knowledge Q&A |
| Audit | `src/audit/` | Admin | Audit log governance |
| Health | `src/health/` | Platform | Liveness & readiness probes |
