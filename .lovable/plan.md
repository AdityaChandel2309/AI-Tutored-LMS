# Why the assistant "doesn't know" your uploaded doc

Root cause (verified in code):

- `api/src/knowledge/knowledge.service.ts` creates every uploaded document with `status: dto.status ?? 'draft'`.
- `api/src/document-embedding/document-embedding.service.ts` — both `searchSimilar` (vector) and `keywordSearch` (fallback) hard-filter `WHERE d."status" = 'published'`.

Result: a freshly uploaded doc is embedded and stored, but the assistant's retrieval query skips it because it is still `draft`. That's why "tell me more about cs" returns "I couldn't find any specific information…" even though the file is in the knowledge base.

This is the same reason the upload screen warned you the doc wouldn't show up on the Knowledge Base list — the assistant is on the same `published`-only gate.

# Fix

Widen the retrieval filter so the assistant can read any tenant-scoped document that isn't archived, while still respecting tenant isolation and category scoping.

### 1. `api/src/document-embedding/document-embedding.service.ts`

- In both branches of `searchSimilar` (categoryId + no-categoryId), replace `AND d."status" = 'published'` with `AND d."status" <> 'archived'`.
- In `keywordSearch`, apply the same change so the fallback path behaves identically.

### 2. `api/src/knowledge-assistant/knowledge-assistant.service.ts`

- When `results.length === 0`, add a short `docContext` note that tells the model "no documents in the tenant knowledge base matched this query" — so answers say that explicitly instead of vaguely guessing from platform data.

### 3. `api/src/common/ai/prompt-templates.ts`

- In `buildKnowledgeAssistantSystemPrompt`, add one line: when the user asks about a topic/name and no document context is available, the assistant should say it can't find a matching document in the knowledge base and suggest the user check the document title / re-upload, instead of speculating from department/course lists.

### 4. Sanity check on existing uploads

- After the code change, previously uploaded drafts already have embeddings (indexing runs unconditionally on upload), so no backfill is needed — they become searchable immediately.
- If a specific old doc has no chunks (e.g. upload happened before embeddings were wired), the existing `api/src/scripts/backfill-document-embeddings.ts` script covers it; call that out to the user only if their doc still isn't found after the fix.

# Out of scope

- No changes to auth, RBAC, tenant scoping, upload flow, or the assistant UI.
- No schema changes.
- Admin platform snapshot and per-user self-scoped context stay exactly as they are.

# Verification

- `npx tsgo --noEmit` in `api/` stays clean.
- Manually: upload a new document (leaves it as `draft`), ask the assistant about a term that appears in that doc, confirm the answer cites the doc and the `sources` array in the response includes it.
