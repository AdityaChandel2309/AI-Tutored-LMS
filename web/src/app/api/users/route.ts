import { NextResponse } from "next/server";
import { readBackendData, relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

async function proxyUsersWrite(
  request: Request,
) {
  const body = await request.text();

  const response =
    await proxyBackendRequest(
      "/users",
      {
        hostname: new URL(request.url).hostname,
      },
      {
        method: request.method,
        body,
        contentType: "application/json",
      },
    );

  return relayBackendDataResponse(response);
}

export async function GET(request: Request) {
  const response = await proxyBackendRequest("/users", {
    hostname: new URL(request.url).hostname,
  });

  if (!response.ok) {
    const contentType =
      response.headers.get("content-type") ?? "application/json";
    const errorPayload = await response.text();
    return new NextResponse(errorPayload, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  }

  // Backend returns paginated { items, total, page, limit }.
  // AdminPanel expects a flat array.
  const paginated = await readBackendData<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
  }>(response);

  return NextResponse.json(paginated.items, { status: 200 });
}

export async function POST(request: Request) {
  return proxyUsersWrite(request);
}
