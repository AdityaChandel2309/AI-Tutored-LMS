import { NextResponse } from "next/server";
import { readBackendData, relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const qs = url.search; // includes leading "?" or ""
  const response = await proxyBackendRequest(`/courses${qs}`, {
    hostname: url.hostname,
  });

  // The backend returns paginated data: { items, total, page, limit }.
  // The frontend expects a flat array of courses, so unwrap `items`.
  if (!response.ok) {
    const contentType =
      response.headers.get("content-type") ?? "application/json";
    const errorPayload = await response.text();
    return new NextResponse(errorPayload, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  }

  const paginated = await readBackendData<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
  }>(response);

  return NextResponse.json(paginated.items, { status: 200 });
}

export async function POST(request: Request) {
  const body = await request.text();
  const response = await proxyBackendRequest("/courses", {
    hostname: new URL(request.url).hostname,
  }, {
    method: "POST",
    body,
    contentType: "application/json",
  });
  return relayBackendDataResponse(response);
}
