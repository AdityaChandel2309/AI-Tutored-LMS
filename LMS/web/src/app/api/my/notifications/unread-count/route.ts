import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(request: Request) {
  const response = await proxyBackendRequest("/my/notifications/unread-count", {
    hostname: new URL(request.url).hostname,
  });
  return relayBackendDataResponse(response);
}
