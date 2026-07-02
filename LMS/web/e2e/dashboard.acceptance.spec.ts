import { expect, test } from "@playwright/test";
import { ensureUserSession } from "./support/keycloak";

test.describe.configure({ mode: "serial" });

const appUrl = "http://127.0.0.1:3001";

async function seedSession(
  page: Parameters<typeof test>[0]["page"],
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
}

test("dashboard supports profile, avatar, and admin user flows", async ({
  page,
}) => {
  const runId = Date.now().toString();
  const adminEmail = `web-admin-${runId}@example.com`;
  const managedEmail = `web-managed-${runId}@example.com`;
  const password = "WebPass123!";

  await seedSession(page, {
    email: adminEmail,
    password,
    roles: ["admin"],
    firstName: "Web",
    lastName: "Admin",
  });

  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Dashboard" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Email: ${adminEmail}`),
  ).toBeVisible();

  const profileForm = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Save profile" }) });
  await profileForm.getByPlaceholder("First name").fill("Acceptance");
  await profileForm.getByPlaceholder("Last name").fill("Admin");
  await profileForm
    .getByRole("button", { name: "Save profile" })
    .click();
  await expect(page.getByText("Profile updated")).toBeVisible();

  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from("avatar-image"),
    });
  await expect(page.getByText("Avatar uploaded")).toBeVisible();

  const adminForm = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Create" }) });
  await adminForm.getByPlaceholder("Email").fill(managedEmail);
  await adminForm.getByPlaceholder("First name").fill("Managed");
  await adminForm.getByPlaceholder("Last name").fill("User");
  await adminForm
    .getByPlaceholder("Temporary password")
    .fill(password);
  await adminForm
    .getByRole("button", { name: "Create" })
    .click();

  await expect(page.getByText("User created")).toBeVisible();
  await expect(page.getByText(managedEmail)).toBeVisible();

  const managedRow = page.locator("tr", {
    hasText: managedEmail,
  });
  await managedRow.locator("select").selectOption("instructor");
  await expect(page.getByText("Role updated")).toBeVisible();
  await expect(managedRow.locator("select")).toHaveValue(
    "instructor",
  );

  await managedRow
    .getByRole("button", { name: "Deactivate" })
    .click();
  await expect(page.getByText("User deactivated")).toBeVisible();
  await expect(managedRow.getByText("inactive")).toBeVisible();
});

test("expired sessions return the user to login with a reason", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "access_token",
      value: "expired-access-token",
      url: appUrl,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
    {
      name: "refresh_token",
      value: "expired-refresh-token",
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

  await page.goto("/dashboard");

  await expect(page).toHaveURL(/reason=session-expired/);
  await expect(
    page.getByText(
      "Your session expired. Sign in again to continue.",
    ),
  ).toBeVisible();
});
