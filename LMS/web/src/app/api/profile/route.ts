import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function PATCH(request: Request) {
  const body = await request.text();

  const response =
    await proxyBackendRequest(
      "/me/profile",
      {
        hostname: new URL(request.url).hostname,
      },
      {
        method: "PATCH",
        body,
        contentType: "application/json",
      },
    );

  return relayBackendDataResponse(response);
}
