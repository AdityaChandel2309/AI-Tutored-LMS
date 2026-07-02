import { expect, request as playwrightRequest, test } from "@playwright/test";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { ensureUserSession } from "./support/keycloak";

test.describe.configure({ mode: "serial" });

const appUrl = "http://127.0.0.1:3001";
const apiUrl = "http://127.0.0.1:3000";
const SCORM_ZIP_BASE64 =
  "UEsDBBQAAAAIAHFhuVyNkHlPqgAAAEEBAAAPAAAAaW1zbWFuaWZlc3QueG1sXZBBDoMwDATvvMLyHVJ6DqD+oF+IggMWkKDEVKivrwSlgh693p21rJt1GuFFMXHwFZbFDZs605Px7CgJcEte2DHFCuehy421NIvxlvCcumOdAegQO+P5bYSDT9CSM8soFYbY5eXm+PNc8GcXgBaWkerHrw+exg6mI632zU5TZ9x2w0VJmxQphSVaSt/QMV/qI6W8ROgjuQrZt7QWvUwjgtqxJ4hWx3/q7ANQSwMEFAAAAAgAcWG5XAdzWvYuAAAAMwAAAAoAAABpbmRleC5odG1ss8koyc2xs0nKT6m0s8kwtAt29g/yVXBMTk4tKEnMS0610c8wtLPRh8jrgxUDAFBLAQIUAxQAAAAIAHFhuVyNkHlPqgAAAEEBAAAPAAAAAAAAAAAAAACAAQAAAABpbXNtYW5pZmVzdC54bWxQSwECFAMUAAAACABxYblcB3Na9i4AAAAzAAAACgAAAAAAAAAAAAAAgAHXAAAAaW5kZXguaHRtbFBLBQYAAAAAAgACAHUAAAAtAQAAAAA=";

async function apiRequest(
  apiContext: APIRequestContext,
  method: "GET" | "POST" | "PATCH",
  path: string,
  init?: Parameters<APIRequestContext["fetch"]>[1],
) {
  const response = await apiContext.fetch(path, {
    ...init,
    method,
  });

  if (response.status() !== 404) {
    return response;
  }

  return apiContext.fetch(`/api${path}`, {
    ...init,
    method,
  });
}

async function assertOk(response: APIResponse, label: string) {
  if (response.ok()) {
    return;
  }

  const body = await response.text();
  throw new Error(
    `${label} failed: ${response.status()} ${response.statusText()} ${body}`,
  );
}

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

  return session.accessToken;
}

test("SCORM upload and launch works for instructor", async ({ page }) => {
  const runId = Date.now().toString();
  const instructorEmail = `web-scorm-${runId}@example.com`;
  const password = "WebPass123!";

  const accessToken = await seedSession(page, {
    email: instructorEmail,
    password,
    roles: ["instructor"],
    firstName: "Scorm",
    lastName: "Instructor",
  });

  const apiContext = await playwrightRequest.newContext({
    baseURL: apiUrl,
    extraHTTPHeaders: {
      Authorization: `Bearer ${accessToken}`,
      "x-tenant-subdomain": "default",
    },
  });

  const meResponse = await apiRequest(apiContext, "GET", "/me");
  await assertOk(meResponse, "Load /me");

  const slug = `scorm-${runId}`;
  const courseResponse = await apiRequest(apiContext, "POST", "/courses", {
    data: {
      title: "SCORM Course",
      slug,
    },
  });
  await assertOk(courseResponse, "Create course");
  const courseBody = (await courseResponse.json()) as {
    data: { id: string };
  };
  const courseId = courseBody.data.id;

  const moduleResponse = await apiRequest(
    apiContext,
    "POST",
    `/courses/${courseId}/modules`,
    {
      data: { title: "Module 1" },
    },
  );
  await assertOk(moduleResponse, "Create module");
  const moduleBody = (await moduleResponse.json()) as {
    data: { id: string };
  };

  const lessonResponse = await apiRequest(
    apiContext,
    "POST",
    `/modules/${moduleBody.data.id}/lessons`,
    {
      data: { title: "SCORM Lesson", type: "scorm" },
    },
  );
  await assertOk(lessonResponse, "Create lesson");
  const lessonBody = (await lessonResponse.json()) as {
    data: { id: string };
  };

  const uploadResponse = await apiRequest(
    apiContext,
    "POST",
    `/courses/${courseId}/scorm/upload-url`,
    {
      data: {
        title: "Acceptance Package",
        fileName: "package.zip",
        mimeType: "application/zip",
      },
    },
  );
  await assertOk(uploadResponse, "Request upload URL");
  const uploadBody = (await uploadResponse.json()) as {
    data: { packageId: string; uploadUrl: string };
  };

  const zipBuffer = Buffer.from(SCORM_ZIP_BASE64, "base64");
  const uploadResult = await fetch(uploadBody.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/zip" },
    body: zipBuffer,
  });
  expect(uploadResult.ok).toBeTruthy();

  const confirmResponse = await apiRequest(
    apiContext,
    "PATCH",
    `/scorm/${uploadBody.data.packageId}/confirm`,
    {
      data: { lessonId: lessonBody.data.id },
    },
  );
  await assertOk(confirmResponse, "Confirm upload");

  const lessonUpdateResponse = await apiRequest(
    apiContext,
    "PATCH",
    `/lessons/${lessonBody.data.id}`,
    {
      data: {
        content: { scormPackageId: uploadBody.data.packageId },
      },
    },
  );
  await assertOk(lessonUpdateResponse, "Link SCORM package");

  const launchResponse = await apiRequest(
    apiContext,
    "GET",
    `/scorm/${uploadBody.data.packageId}/launch`,
  );
  await assertOk(launchResponse, "Fetch launch metadata");
  const launchBody = (await launchResponse.json()) as {
    data: { launchPath: string };
  };

  const fileResponse = await apiRequest(
    apiContext,
    "GET",
    `/scorm/${uploadBody.data.packageId}/files/${encodeURI(
      launchBody.data.launchPath,
    )}`,
  );
  await assertOk(fileResponse, "Fetch launch file");

  await apiContext.dispose();
});
