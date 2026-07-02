import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const take = url.searchParams.get("take") ?? "20";
  const skip = url.searchParams.get("skip") ?? "0";
  const response = await proxyBackendRequest(`/my/notifications?take=${take}&skip=${skip}`, {
    hostname: url.hostname,
  });
  return relayBackendDataResponse(response);
}
