import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const response = await proxyBackendRequest(`/projects${query ? `?${query}` : ""}`, { hostname: new URL(request.url).hostname });
  return relayBackendDataResponse(response);
}

export async function POST(request: Request) {
  const body = await request.text();
  const response = await proxyBackendRequest("/projects", { hostname: new URL(request.url).hostname }, { method: "POST", body, contentType: "application/json" });
  return relayBackendDataResponse(response);
}
