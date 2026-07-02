import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const path = `/my/activity${qs ? `?${qs}` : ""}`;
  const response = await proxyBackendRequest(path, {
    hostname: new URL(request.url).hostname,
  });
  return relayBackendDataResponse(response);
}
