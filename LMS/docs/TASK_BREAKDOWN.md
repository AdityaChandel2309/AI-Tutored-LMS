# Task Breakdown — Enterprise Platform Expansion

## Phase 1: Employee & Organization Domain (Day 1)

### Task 1: Prisma Schema — Organization & Employee Models ✅

**Objective:** Add Department, Designation, and EmployeeProfile models to the Prisma schema.

**Implementation:**
- `Department`: id, tenantId, name, code, parentId (self-referential), managerId (FK to User), createdAt, updatedAt
- `Designation`: id, tenantId, name, level (seniority ordering), createdAt
- `EmployeeProfile`: id, userId (1:1 with User), tenantId, employeeCode, departmentId, designationId, reportingManagerId, dateOfJoining, location, phone, metadata (Json), createdAt, updatedAt
- Relations added to Tenant and User models
- Migration: `20260527154945_add_organization_employee_models`

---

### Task 2: Backend — Organization Module (Departments & Designations CRUD) ✅

**Objective:** Create `api/src/organization/` NestJS module with full CRUD.

**Endpoints:**
- `GET /departments` — list with hierarchy (include children count)
- `GET /departments/:id` — single with parent/children
- `POST /departments` — create (admin only)
- `PATCH /departments/:id` — update
- `DELETE /departments/:id` — guard if employees exist
- `GET /designations` — list ordered by level
- `POST /designations` — create (admin only)
- `PATCH /designations/:id` — update
- `DELETE /designations/:id`

**Events:** `department.created`, `department.updated`

---

### Task 3: Backend — Employee Module (Profiles, Directory, CSV Import) ✅

**Objective:** Create `api/src/employee/` NestJS module for employee profiles, directory, and CSV import.

**Endpoints:**
- `GET /employees` — paginated directory with filters (department, designation, search)
- `GET /employees/:id` — full profile with relations
- `POST /employees` — create profile (links to existing User)
- `PATCH /employees/:id` — update profile
- `GET /employees/:id/reportees` — direct reports
- `POST /employees/import` — CSV upload (multipart)

**CSV columns:** employee_code (required), user_email (required), department_code, designation, location, phone, date_of_joining

**Events:** `employee.created`, `employee.updated`

---

### Task 4: Frontend — Organization & Employee Pages ✅

**Objective:** Dashboard pages for department management, employee directory, and CSV import.

**Files created:**
- `lib/types/organization.ts` — TypeScript interfaces
- `lib/api/organization.ts` — department/designation API client
- `lib/api/employees.ts` — employee API client
- BFF routes: `api/departments/`, `api/departments/[id]/`, `api/designations/`, `api/employees/`, `api/employees/[id]/`
- Pages: `/dashboard/organization`, `/dashboard/employees`, `/dashboard/employees/[id]`, `/dashboard/employees/import`
- Components: `department-tree.tsx`, `employee-card.tsx`, `csv-import-form.tsx`

---

## Phase 2: Project Tracking Domain (Day 2)

### Task 5: Prisma Schema — Project Tracking Models ✅

**Objective:** Add Project, Milestone, and ProjectMember models.

**Implementation:**
- `Project`: id, tenantId, title, description, status, departmentId, ownerId, startDate, targetEndDate, actualEndDate
- `Milestone`: id, projectId, title, description, status, dueDate, completedAt, order
- `ProjectMember`: id, projectId, userId, role (owner/member/viewer), joinedAt
- Migration: `20260527160235_add_project_tracking_models`

---

### Task 6: Backend — Project Module (CRUD + Status Workflow) ✅

**Objective:** Create `api/src/project/` NestJS module with project CRUD, milestones, and members.

**Endpoints:**
- `GET /projects` — list with filters (status, department)
- `GET /projects/:id` — detail with milestones and members
- `POST /projects` — create (admin, instructor)
- `PATCH /projects/:id` — update
- `DELETE /projects/:id`
- `PATCH /projects/:id/status` — status transition with validation
- `POST /projects/:id/milestones` — add milestone
- `PATCH /projects/:id/milestones/:milestoneId` — update
- `DELETE /projects/:id/milestones/:milestoneId`
- `POST /projects/:id/members` — add member
- `DELETE /projects/:id/members/:userId` — remove member

**Status transitions:**
- planning → active, cancelled
- active → on_hold, completed, cancelled
- on_hold → active, cancelled
- completed → (terminal)
- cancelled → (terminal)

**Events:** `project.created`, `project.status_changed`, `milestone.completed`

---

### Task 7: Frontend — Project Tracking Pages ✅

**Objective:** Project dashboard, detail, and milestone tracking UI.

**Files created:**
- `lib/types/project.ts`, `lib/api/projects.ts`
- BFF routes: `api/projects/`, `api/projects/[id]/`
- Pages: `/dashboard/projects`, `/dashboard/projects/new`, `/dashboard/projects/[id]`
- Components: `project/status-badge.tsx`

---

## Phase 3: Enterprise Knowledge Domain (Day 3)

### Task 8: Prisma Schema — Knowledge/Document Models ✅

**Objective:** Add Document, DocumentCategory, and DocumentVersion models.

**Implementation:**
- `DocumentCategory`: id, tenantId, name, slug, parentId, description
- `Document`: id, tenantId, categoryId, title, description, type, fileObjectKey, fileName, fileSize, mimeType, version, uploadedById, status, tags[]
- `DocumentVersion`: id, documentId, versionNumber, fileObjectKey, fileName, fileSize, uploadedById, changeNote
- Migration: `20260527160758_add_knowledge_document_models`

---

### Task 9: Backend — Knowledge Module (Document CRUD + File Upload + Search) ✅

**Objective:** Create `api/src/knowledge/` NestJS module for document management.

**Endpoints:**
- `GET /documents` — paginated list with filters (category, type, status, search)
- `GET /documents/:id` — detail with version history
- `POST /documents` — upload document (multipart: file + metadata)
- `PATCH /documents/:id` — update metadata
- `POST /documents/:id/versions` — upload new version
- `DELETE /documents/:id` — archive
- `GET /documents/:id/download` — presigned S3 URL
- `GET /document-categories` — list categories
- `POST /document-categories` — create category
- `PATCH /document-categories/:id` — update
- `DELETE /document-categories/:id`

**Supported MIME types:** PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint (.ppt/.pptx)

**Search:** PostgreSQL ILIKE on title + description + array contains on tags

**Events:** `document.uploaded`, `document.published`

---

### Task 10: Frontend — Knowledge Library Pages ⬜

**Objective:** Enterprise knowledge library UI with document browsing, upload, search, and download.

**Planned files:**
- `lib/types/knowledge.ts`, `lib/api/knowledge.ts`
- BFF routes for documents and document-categories
- Pages: `/dashboard/knowledge`, `/dashboard/knowledge/upload`, `/dashboard/knowledge/[id]`, `/dashboard/knowledge/categories`
- Components: `knowledge/document-card.tsx`, `knowledge/category-sidebar.tsx`, `knowledge/upload-form.tsx`, `knowledge/version-history.tsx`

---

## Phase 4: Enterprise Portal Shell + AI Foundation (Day 4)

### Task 11: Enterprise Portal Shell — Unified Navigation & Dashboard ⬜

**Objective:** Refactor dashboard into enterprise portal with unified sidebar navigation and role-based menu visibility.

**Planned:**
- `components/portal/sidebar-nav.tsx` — sections: Home, Learning, People, Projects, Knowledge, Admin
- `components/portal/portal-layout.tsx` — wraps all `/dashboard/*` pages
- Updated `/dashboard/page.tsx` with cross-module summary cards
- Role-based visibility: learners see Learning + Knowledge; admins see all
- Responsive collapsible sidebar

---

### Task 12: Backend — LMS AI Tutor Foundation ⬜

**Objective:** Create `api/src/ai-tutor/` module for course-contextual Q&A.

**Planned endpoints:**
- `POST /ai-tutor/chat` — send message, get AI response
- `GET /ai-tutor/history?courseId=X` — chat history

**Logic:**
- Fetch course/lesson content as context
- Call LLM API (OpenAI-compatible, configurable via env)
- System prompt: "You are a learning tutor for [course title]..."
- Store in `AiTutorMessage` model
- Guard: user must be enrolled in the course

---

### Task 13: Backend — Enterprise Knowledge Assistant Foundation ⬜

**Objective:** Create `api/src/knowledge-assistant/` module for enterprise Q&A over documents.

**Planned endpoints:**
- `POST /knowledge-assistant/ask` — ask question, get answer with source references
- `GET /knowledge-assistant/history` — user's question history

**Logic:**
- Search documents by keyword (reuse knowledge service)
- Build context from top-N matching documents
- Call LLM API with enterprise system prompt
- Return answer + source document references
- Store in `KnowledgeAssistantMessage` model
- Simple keyword retrieval now, RAG/embeddings later

---

### Task 14: Frontend — AI Chat Interfaces ⬜

**Objective:** Chat UIs for LMS AI Tutor and Enterprise Knowledge Assistant.

**Planned:**
- `lib/api/ai.ts` — API client for both AI endpoints
- `components/ai/chat-panel.tsx` — reusable chat UI
- `components/ai/tutor-chat.tsx` — embedded in course player
- `components/ai/knowledge-chat.tsx` — enterprise assistant with source links
- Page: `/dashboard/assistant` — full-page enterprise chat
- BFF proxy routes for AI endpoints
