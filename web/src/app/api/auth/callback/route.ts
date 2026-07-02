import { NextResponse } from "next/server";
import { readBackendData } from "@/lib/backend-response";
import {
  getBackendUrl,
} from "@/lib/session";
import { setSessionCookies } from "@/lib/server-session";

export async function POST(request: Request) {
  const { code, redirect_uri } =
    (await request.json()) as {
      code?: string;
      redirect_uri?: string;
    };

  if (!code) {
    return NextResponse.json(
      { error: "Missing code" },
      { status: 400 },
    );
  }

  const response = await fetch(
    getBackendUrl("/auth/exchange"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        ...(redirect_uri && { redirect_uri }),
      }),
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Code exchange failed" },
      { status: response.status },
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

  return NextResponse.json({ ok: true });
}
