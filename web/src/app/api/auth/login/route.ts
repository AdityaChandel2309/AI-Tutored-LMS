import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readBackendData } from "@/lib/backend-response";
import { getBackendUrl, tenantSubdomainCookieName } from "@/lib/session";
import { setSessionCookies } from "@/lib/server-session";

const defaultTenantSubdomain =
  process.env.NEXT_PUBLIC_DEFAULT_TENANT_SUBDOMAIN ?? "default";

export async function POST(request: Request) {
  const { username, password } = (await request.json()) as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  const response = await fetch(getBackendUrl("/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const status = response.status === 401 ? 401 : 502;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Invalid username or password"
            : "Sign in failed. Please try again.",
      },
      { status },
    );
  }

  const data = await readBackendData<{
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in?: number;
    refresh_expires_in?: number;
  }>(response);

  await setSessionCookies(data);

  // Single-tenant deployment: pin the tenant cookie so downstream
  // proxy requests resolve the correct tenant without a UI field.
  const cookieStore = await cookies();
  cookieStore.set(tenantSubdomainCookieName, defaultTenantSubdomain, {
    httpOnly: false,
    sameSite: "lax",
    secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
