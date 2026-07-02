const appUrl = process.env.NEXT_PUBLIC_APP_URL;

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Authenticate directly against the app's backend using a username and
 * password (Keycloak Direct Access Grant, proxied server-side). On success
 * the session cookies are set by the route handler and the caller can
 * navigate to the dashboard. Users never see a Keycloak-hosted page.
 */
export async function loginWithPassword(
  username: string,
  password: string,
): Promise<LoginResult> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      return { ok: true };
    }

    const data = (await response
      .json()
      .catch(() => null)) as { error?: string } | null;

    return {
      ok: false,
      error:
        data?.error ??
        (response.status === 401
          ? "Invalid username or password"
          : "Sign in failed. Please try again."),
    };
  } catch {
    return {
      ok: false,
      error: "Network error. Please check your connection and try again.",
    };
  }
}

export function logout() {
  window.location.href = appUrl ?? "/";
}
