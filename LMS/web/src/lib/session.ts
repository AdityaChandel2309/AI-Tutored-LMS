const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";
const internalApiBaseUrl =
  process.env.API_INTERNAL_URL ??
  apiBaseUrl;

const keycloakUrl =
  process.env.NEXT_PUBLIC_KEYCLOAK_URL;
const realm =
  process.env.NEXT_PUBLIC_KEYCLOAK_REALM;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const localDefaultTenantSubdomain =
  process.env
    .NEXT_PUBLIC_DEFAULT_TENANT_SUBDOMAIN ??
  "default";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const accessTokenCookieName =
  "access_token";
export const refreshTokenCookieName =
  "refresh_token";
export const idTokenCookieName =
  "id_token";
export const tenantSubdomainCookieName =
  "tenant_subdomain";

export function getBackendUrl(path: string) {
  return `${trimTrailingSlash(internalApiBaseUrl)}${path}`;
}

export function getTenantSubdomain() {
  return localDefaultTenantSubdomain;
}

export function normalizeTenantSubdomain(
  value?: string | null,
) {
  const normalized = value
    ?.trim()
    .toLowerCase();

  return normalized || null;
}

export function extractTenantSubdomainFromHost(
  hostname?: string | null,
) {
  const normalizedHost = hostname
    ?.trim()
    .toLowerCase();

  if (!normalizedHost) {
    return null;
  }

  const hostWithoutPort =
    normalizedHost.split(":")[0] ?? "";

  if (
    hostWithoutPort === "localhost" ||
    hostWithoutPort === "127.0.0.1"
  ) {
    return null;
  }

  if (hostWithoutPort.endsWith(".localhost")) {
    const localhostSegments =
      hostWithoutPort.split(".");
    return localhostSegments[0] || null;
  }

  const segments = hostWithoutPort.split(".");
  if (segments.length < 3) {
    return null;
  }

  return segments[0] || null;
}

function isLocalHostname(hostname?: string | null) {
  const hostWithoutPort =
    hostname?.trim().toLowerCase().split(":")[0] ??
    "";

  return (
    !hostWithoutPort ||
    hostWithoutPort === "localhost" ||
    hostWithoutPort === "127.0.0.1" ||
    hostWithoutPort.endsWith(".localhost")
  );
}

export function resolveTenantSubdomain(input: {
  hostname?: string | null;
  cookieTenantSubdomain?: string | null;
}) {
  const cookieTenantSubdomain =
    normalizeTenantSubdomain(
      input.cookieTenantSubdomain,
    );

  if (cookieTenantSubdomain) {
    return cookieTenantSubdomain;
  }

  const hostTenantSubdomain =
    normalizeTenantSubdomain(
      extractTenantSubdomainFromHost(
        input.hostname,
      ),
    );

  if (hostTenantSubdomain) {
    return hostTenantSubdomain;
  }

  if (isLocalHostname(input.hostname)) {
    return getTenantSubdomain();
  }

  return null;
}

export function getTenantHeaders(
  tenantSubdomain?: string | null,
): Record<string, string> {
  const normalizedTenantSubdomain =
    normalizeTenantSubdomain(tenantSubdomain);

  if (!normalizedTenantSubdomain) {
    return {};
  }

  return {
    "x-tenant-subdomain":
      normalizedTenantSubdomain,
  };
}

export function getLogoutUrl(
  idTokenHint?: string | null,
) {
  const baseLogoutUrl =
    `${trimTrailingSlash(keycloakUrl ?? "")}/realms/${realm}` +
    `/protocol/openid-connect/logout` +
    `?post_logout_redirect_uri=` +
    encodeURIComponent(
      trimTrailingSlash(appUrl ?? ""),
    );

  if (!idTokenHint) {
    return baseLogoutUrl;
  }

  return (
    `${baseLogoutUrl}&id_token_hint=` +
    encodeURIComponent(idTokenHint)
  );
}
