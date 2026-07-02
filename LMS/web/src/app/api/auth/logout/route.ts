import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/session";
import {
  clearSessionCookies,
  getRefreshToken,
} from "@/lib/server-session";

export async function POST() {
  const refreshToken = await getRefreshToken();

  // Best-effort back-channel logout: revoke the Keycloak session server-side.
  // Never let a Keycloak/network failure block clearing the local session.
  if (refreshToken) {
    try {
      await fetch(getBackendUrl("/auth/logout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
    } catch {
      // ignore — we still clear cookies below
    }
  }

  await clearSessionCookies();

  // Return to the in-app login page; no Keycloak-hosted page involved.
  return NextResponse.json({ redirectUrl: "/login" });
}
