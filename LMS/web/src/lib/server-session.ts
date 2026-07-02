import { cookies } from "next/headers";
import { readBackendData } from "@/lib/backend-response";
import {
  accessTokenCookieName,
  getBackendUrl,
  getTenantHeaders,
  idTokenCookieName,
  refreshTokenCookieName,
  resolveTenantSubdomain,
  tenantSubdomainCookieName,
} from "@/lib/session";

type TokenPayload = {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
};

function isHttps() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
}

export async function getAccessToken() {
  const cookieStore = await cookies();
  return (
    cookieStore.get(accessTokenCookieName)
      ?.value ?? null
  );
}

export async function getRefreshToken() {
  const cookieStore = await cookies();
  return (
    cookieStore.get(refreshTokenCookieName)
      ?.value ?? null
  );
}

export async function getIdToken() {
  const cookieStore = await cookies();
  return (
    cookieStore.get(idTokenCookieName)?.value ??
    null
  );
}

export async function setSessionCookies(
  tokenPayload: TokenPayload,
) {
  const cookieStore = await cookies();

  const cookieSecure = isHttps();

  cookieStore.set(
    accessTokenCookieName,
    tokenPayload.access_token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/",
      maxAge: tokenPayload.expires_in,
    },
  );
  cookieStore.set(
    refreshTokenCookieName,
    tokenPayload.refresh_token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/",
      maxAge: tokenPayload.refresh_expires_in,
    },
  );

  if (tokenPayload.id_token) {
    cookieStore.set(
      idTokenCookieName,
      tokenPayload.id_token,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure,
        path: "/",
        maxAge: tokenPayload.expires_in,
      },
    );
  }
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(accessTokenCookieName);
  cookieStore.delete(refreshTokenCookieName);
  cookieStore.delete(idTokenCookieName);
}

export async function refreshSession() {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await fetch(
    getBackendUrl("/auth/refresh"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    await clearSessionCookies();
    return null;
  }

  const tokenPayload =
    await readBackendData<TokenPayload>(
      response,
    );
  await setSessionCookies(tokenPayload);

  return tokenPayload.access_token;
}

export async function proxyBackendRequest(
  path: string,
  requestContext: {
    hostname?: string | null;
  } = {},
  init: {
    method?: string;
    body?: BodyInit;
    contentType?: string;
    headers?: Record<string, string>;
  } = {},
) {
  let accessToken = await getAccessToken();
  const cookieStore = await cookies();
  const tenantSubdomain =
    resolveTenantSubdomain({
      hostname: requestContext.hostname,
      cookieTenantSubdomain:
        cookieStore.get(
          tenantSubdomainCookieName,
        )?.value ?? null,
    });

  if (!accessToken) {
    accessToken = await refreshSession();
  }

  if (!accessToken) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        code: "session_missing",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const runRequest = (token: string) =>
    fetch(getBackendUrl(path), {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...getTenantHeaders(tenantSubdomain),
        ...(init.headers ?? {}),
        ...(init.contentType
          ? {
              "Content-Type":
                init.contentType,
            }
          : {}),
      },
      body: init.body,
      cache: "no-store",
    });

  let response = await runRequest(accessToken);

  if (response.status === 401) {
    const refreshedToken =
      await refreshSession();

    if (!refreshedToken) {
      await clearSessionCookies();

      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          code: "session_expired",
        }),
        {
          status: 401,
          headers: {
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    response = await runRequest(refreshedToken);
  }

  return response;
}
