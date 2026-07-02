import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await context.params;
  const body = await request.text();

  const response = await proxyBackendRequest(
    `/users/${id}`,
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
