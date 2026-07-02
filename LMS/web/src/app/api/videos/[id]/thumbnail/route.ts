import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const response = await proxyBackendRequest(`/videos/${id}/thumbnail`, {
    hostname: new URL(request.url).hostname,
  });
  return relayBackendDataResponse(response);
}
