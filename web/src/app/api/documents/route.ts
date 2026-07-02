import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const response = await proxyBackendRequest(`/documents${query ? `?${query}` : ""}`, { hostname: new URL(request.url).hostname });
  return relayBackendDataResponse(response);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const body = await request.arrayBuffer();
  const response = await proxyBackendRequest("/documents", { hostname: new URL(request.url).hostname }, {
    method: "POST",
    body: body as unknown as BodyInit,
    headers: { "Content-Type": contentType },
  });
  return relayBackendDataResponse(response);
}
