import { NextResponse } from "next/server";
import { getBackendUrl, getTenantHeaders, resolveTenantSubdomain, tenantSubdomainCookieName } from "@/lib/session";
import { cookies } from "next/headers";

// Public relay for `GET /certificates/verify/:code` on the backend. No session
// or tenant scoping is required (verification codes are globally unique), but
// we still forward the tenant subdomain header so multi-tenant deployments
// keep their branding/observability signals intact.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const encoded = encodeURIComponent(code);
  const cookieStore = await cookies();
  const tenantSubdomain = resolveTenantSubdomain({
    hostname: new URL(request.url).hostname,
    cookieTenantSubdomain: cookieStore.get(tenantSubdomainCookieName)?.value ?? null,
  });

  const response = await fetch(getBackendUrl(`/certificates/verify/${encoded}`), {
    headers: { ...getTenantHeaders(tenantSubdomain) },
    cache: "no-store",
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}