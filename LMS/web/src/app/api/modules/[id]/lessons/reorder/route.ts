import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.text();
  const response = await proxyBackendRequest(`/modules/${id}/lessons/reorder`, {
    hostname: new URL(request.url).hostname,
  }, {
    method: "POST",
    body,
    contentType: "application/json",
  });
  return relayBackendDataResponse(response);
}
