import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(request: Request) {
  const response = await proxyBackendRequest("/analytics/dashboard-summary", {
    hostname: new URL(request.url).hostname,
  });
  return relayBackendDataResponse(response);
}
