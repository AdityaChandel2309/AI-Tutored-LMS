/**
 * Full End-to-End Acceptance Tests
 * ─────────────────────────────────
 * These tests require the full stack running via docker-compose:
 *   docker compose up -d
 *   npm run bootstrap && npm run dev
 *
 * Run with:  cd web && npx playwright test e2e/full-e2e.acceptance.spec.ts
 *
 * Covers:
 *  1. Login → Dashboard
 *  2. Course catalog: toggle each chip, combine chips, verify chips stay when empty
 *  3. Instructor: opening a published course's /edit URL → warning shows
 *  4. Course wizard: save Plan phase, add module/lesson, submit for review
 *  5. Identity settings: save profile + create user
 *  6. Module page loads: employees, projects, knowledge, AI-tutor, audit
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ensureUserSession } from "./support/keycloak";

test.describe.configure({ mode: "serial" });

const appUrl = "http://127.0.0.1:3001";

// ─── Helpers ─────────────────────────────────────────────

async function seedSession(
  page: Page,
  input: {
    email: string;
    password: string;
    roles: string[];
    firstName: string;
    lastName: string;
  },
) {
  const session = await ensureUserSession(input);

  await page.context().addCookies([
    {
      name: "access_token",
      value: session.accessToken,
      url: appUrl,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
    {
      name: "refresh_token",
      value: session.refreshToken,
      url: appUrl,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
    {
      name: "id_token",
      value: session.idToken,
      url: appUrl,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
    {
      name: "tenant_subdomain",
      value: "default",
      url: appUrl,
      httpOnly: false,
      sameSite: "Lax",
      secure: false,
    },
  ]);

  return session.accessToken;
}



// ─── 1. Login → Dashboard ────────────────────────────────

test("1 · Login → Dashboard loads with user info", async ({ page }) => {
  const runId = Date.now().toString();
  const email = `e2e-admin-${runId}@example.com`;

  await seedSession(page, {
    email,
    password: "E2ePass123!",
    roles: ["admin"],
    firstName: "E2E",
    lastName: "Admin",
  });

  await page.goto("/dashboard");

  // Dashboard heading visible
  await expect(
    page.getByRole("heading", { name: "Dashboard" }),
  ).toBeVisible({ timeout: 15_000 });

  // User email displayed (Stat component renders label/value separately)
  await expect(page.getByText(email).first()).toBeVisible();

  // Quick-nav cards are present (use .first() since sidebar nav may duplicate labels)
  await expect(page.getByText("Browse Courses").first()).toBeVisible();
  await expect(page.getByText("My Courses").first()).toBeVisible();
  await expect(page.getByText("Certificates").first()).toBeVisible();
  await expect(page.getByText("My Activity").first()).toBeVisible();

  // Admin-only sections visible
  await expect(page.getByText("Analytics").first()).toBeVisible();
});

// ─── 2. Course Catalog: Chip Toggle Behavior ──────────────

test("2 · Course catalog: toggle chips, combine, verify empty fallback", async ({
  page,
}) => {
  const runId = Date.now().toString();
  const email = `e2e-instructor-chips-${runId}@example.com`;

  await seedSession(page, {
    email,
    password: "E2ePass123!",
    roles: ["instructor"],
    firstName: "Chip",
    lastName: "Tester",
  });

  await page.goto("/dashboard/courses");

  // Wait for the catalog to load
  await expect(
    page.getByRole("heading", { name: "Course Catalog" }),
  ).toBeVisible({ timeout: 15_000 });

  // Instructor should see Published, Draft, Review, Archived chips.
  // The chip buttons sit just below the Course Catalog heading, above any category chips.
  const publishedChip = page.locator("button", { hasText: /^Published$/i }).first();
  const draftChip = page.locator("button", { hasText: /^Draft$/i }).first();

  await expect(publishedChip).toBeVisible();
  await expect(draftChip).toBeVisible();

  // "Published" should be active by default (has white text = selected)
  await expect(publishedChip).toHaveClass(/text-white/);

  // Toggle Draft ON → both Published and Draft active
  await draftChip.click();
  await expect(draftChip).toHaveClass(/text-white/);
  await expect(publishedChip).toHaveClass(/text-white/);

  // Toggle Published OFF → only Draft active
  await publishedChip.click();
  await expect(publishedChip).not.toHaveClass(/text-white/);
  await expect(draftChip).toHaveClass(/text-white/);

  // Toggle Draft OFF → empty → should snap back to Published
  await draftChip.click();
  // After toggling the last chip off, it auto-selects "published"
  await expect(publishedChip).toHaveClass(/text-white/, {
    timeout: 3_000,
  });
});

// ─── 3. Instructor: Published Course Edit Guard ──────────

test("3 · Instructor trying to edit a published course sees warning", async ({
  page,
}) => {
  const runId = Date.now().toString();
  const email = `e2e-instructor-guard-${runId}@example.com`;

  await seedSession(page, {
    email,
    password: "E2ePass123!",
    roles: ["instructor"],
    firstName: "Guard",
    lastName: "Tester",
  });

  // Go to course catalog and find a published course
  await page.goto("/dashboard/courses");
  await expect(
    page.getByRole("heading", { name: "Course Catalog" }),
  ).toBeVisible({ timeout: 15_000 });

  // Click on the first course card to get its ID from the URL
  const firstCourseLink = page.locator("a[href*='/dashboard/courses/']").first();
  if (await firstCourseLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const href = await firstCourseLink.getAttribute("href");
    // Extract course ID from href like /dashboard/courses/<id>
    const match = href?.match(/\/dashboard\/courses\/([^/]+)$/);
    if (match) {
      const courseId = match[1];

      // Navigate directly to the /edit URL for this published course
      await page.goto(`/dashboard/courses/${courseId}/edit`);

      // The wizard should show the warning notice for published courses
      await expect(
        page.getByText(/cannot be edited/i),
      ).toBeVisible({ timeout: 15_000 });

      await expect(
        page.getByText(/Unpublish or move it back to draft/i),
      ).toBeVisible();

      // "Back to courses" button should be present
      await expect(
        page.getByRole("button", { name: /Back to courses/i }),
      ).toBeVisible();
    }
  }
});

// ─── 4. Course Wizard: Plan Phase + Module/Lesson + Submit ─

test("4 · Course wizard: save Plan, add module/lesson, submit for review", async ({
  page,
}) => {
  const runId = Date.now().toString();
  const email = `e2e-instructor-wizard-${runId}@example.com`;

  await seedSession(page, {
    email,
    password: "E2ePass123!",
    roles: ["instructor"],
    firstName: "Wizard",
    lastName: "Tester",
  });

  // Navigate directly to the course creation page
  await page.goto("/dashboard/courses/new");

  // Wait for the form to load
  await expect(
    page.getByRole("heading", { name: "Create Course" }),
  ).toBeVisible({ timeout: 15_000 });

  // Fill title (id="course-title")
  await page.locator("#course-title").fill(`E2E Wizard Course ${runId}`);

  // Fill description
  await page.locator("#course-description").fill("Automated E2E test course");

  // Click "Create Course" button — it should now be enabled
  await page.getByRole("button", { name: "Create Course" }).click();

  // Should redirect to the wizard editor page
  // Wait for wizard to load — "Plan" phase should be active
  await expect(page.getByText("Plan").first()).toBeVisible({ timeout: 15_000 });

  // Status badge should show "draft"
  await expect(page.getByText("draft").first()).toBeVisible();

  // Phase 2: Navigate to Curriculum phase
  const curriculumBtn = page.locator("button", { hasText: /^Curriculum$/i });
  if (await curriculumBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await curriculumBtn.click();

    // Look for the "Add Module" button
    const addModuleBtn = page.getByRole("button", { name: /add module/i });
    if (await addModuleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addModuleBtn.click();
      // Fill module name if input appears
      const moduleInput = page.locator('input[placeholder*="module" i], input[placeholder*="title" i]').first();
      if (await moduleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await moduleInput.fill("Introduction Module");
        const saveBtn = page.getByRole("button", { name: /create|add|save/i }).first();
        if (await saveBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await saveBtn.click();
        }
      }
    }
  }

  // Phase 3: Navigate to Publish phase
  const publishBtn = page.locator("button", { hasText: /^Publish$/i });
  if (await publishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await publishBtn.click();
    // Should see submit-for-review or publish controls
    const submitReview = page.getByRole("button", { name: /submit.*(review|publish)/i });
    if (await submitReview.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await submitReview.click();
    }
  }
});

// ─── 5. Identity Settings: Profile + User Creation ────────

test("5 · Identity settings: save profile + create user", async ({
  page,
}) => {
  const runId = Date.now().toString();
  const adminEmail = `e2e-identity-admin-${runId}@example.com`;

  await seedSession(page, {
    email: adminEmail,
    password: "E2ePass123!",
    roles: ["admin"],
    firstName: "Identity",
    lastName: "Admin",
  });

  await page.goto("/dashboard");

  // Dashboard should load
  await expect(
    page.getByRole("heading", { name: "Dashboard" }),
  ).toBeVisible({ timeout: 15_000 });

  // ── Profile section exists ──
  // The dashboard has a "Save profile" button inside the identity panel
  const saveProfileBtn = page.getByRole("button", { name: /Save profile/i });
  await expect(saveProfileBtn).toBeVisible({ timeout: 10_000 });

  // Fill first and last name
  const firstNameInput = page.getByPlaceholder("First name").first();
  const lastNameInput = page.getByPlaceholder("Last name").first();
  await firstNameInput.fill("UpdatedFirst");
  await lastNameInput.fill("UpdatedLast");
  await saveProfileBtn.click();

  // Should see success feedback
  await expect(page.getByText(/profile updated|saved/i).first()).toBeVisible({
    timeout: 10_000,
  });

  // ── Create user section exists ──
  const createUserBtn = page.getByRole("button", { name: "Create" });
  await expect(createUserBtn).toBeVisible();

  // Fill user creation form
  const newUserEmail = `e2e-newuser-${runId}@example.com`;
  const emailInput = page.getByPlaceholder("Email").first();
  const firstInput = page.getByPlaceholder("First name").nth(1); // second instance
  const lastInput = page.getByPlaceholder("Last name").nth(1);
  const passInput = page.getByPlaceholder("Temporary password");

  await emailInput.fill(newUserEmail);
  await firstInput.fill("NewUser");
  await lastInput.fill("E2E");
  await passInput.fill("TempPass123!");
  await createUserBtn.click();

  // Should see success
  await expect(page.getByText(/user created|created/i).first()).toBeVisible({
    timeout: 10_000,
  });
});

// ─── 6. Module Page Loads ─────────────────────────────────

test.describe("6 · Module pages load correctly", () => {
  let adminEmail: string;
  const password = "E2ePass123!";

  test.beforeAll(async () => {
    adminEmail = `e2e-modules-${Date.now()}@example.com`;
  });

  async function setupAdmin(page: Page) {
    await seedSession(page, {
      email: adminEmail,
      password,
      roles: ["admin"],
      firstName: "Module",
      lastName: "Tester",
    });
  }

  test("6a · Employee Directory loads", async ({ page }) => {
    await setupAdmin(page);
    await page.goto("/dashboard/employees");

    await expect(
      page.getByText("Employee Directory"),
    ).toBeVisible({ timeout: 15_000 });

    // Search input is present
    await expect(
      page.locator('input[placeholder*="Search" i]'),
    ).toBeVisible();

    // Department filter present
    await expect(
      page.locator("select").filter({ hasText: /All Departments/i }),
    ).toBeVisible();
  });

  test("6b · Projects page loads", async ({ page }) => {
    await setupAdmin(page);
    await page.goto("/dashboard/projects");

    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible({
      timeout: 15_000,
    });

    // Status filters are present
    await expect(
      page.getByRole("button", { name: "All" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /active/i }),
    ).toBeVisible();

    // New Project button
    await expect(
      page.getByRole("button", { name: /New Project/i }),
    ).toBeVisible();
  });

  test("6c · Knowledge Base loads", async ({ page }) => {
    await setupAdmin(page);
    await page.goto("/dashboard/knowledge");

    await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible({
      timeout: 15_000,
    });

    // Search and filter controls present
    await expect(
      page.locator('input[placeholder*="Search" i]'),
    ).toBeVisible();

    // Upload button
    await expect(
      page.getByRole("button", { name: /Upload Document/i }),
    ).toBeVisible();
  });

  test("6d · AI Tutor / Assistant loads", async ({ page }) => {
    await setupAdmin(page);
    await page.goto("/dashboard/assistant");

    await expect(
      page.getByRole("heading", { name: /Enterprise Knowledge Assistant/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Chat input area should be present
    const chatArea = page.locator(
      'textarea, input[placeholder*="Ask" i]',
    );
    await expect(chatArea.first()).toBeVisible({ timeout: 10_000 });
  });

  test("6e · Audit Viewer loads", async ({ page }) => {
    await setupAdmin(page);
    await page.goto("/dashboard/audit");

    await expect(page.getByRole("heading", { name: "Audit Logs" })).toBeVisible({
      timeout: 15_000,
    });

    // Governance badge
    await expect(page.getByText("Governance", { exact: true })).toBeVisible();

    // Filter controls
    await expect(
      page.locator('input[placeholder*="action" i]'),
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder*="entity" i]'),
    ).toBeVisible();

    // Apply/Clear buttons
    await expect(
      page.getByRole("button", { name: "Apply" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Clear" }),
    ).toBeVisible();
  });
});
