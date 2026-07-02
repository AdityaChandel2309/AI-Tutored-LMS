import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function POST(request: Request) {
  const formData = await request.formData();

  const response =
    await proxyBackendRequest(
      "/me/avatar",
      {
        hostname: new URL(request.url).hostname,
      },
      {
        method: "POST",
        body: formData,
      },
    );

  return relayBackendDataResponse(response);
}
