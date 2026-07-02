import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function POST(request: Request) {
  const response = await proxyBackendRequest("/my/notifications/read-all", {
    hostname: new URL(request.url).hostname,
  }, {
    method: "POST",
  });
  return relayBackendDataResponse(response);
}
