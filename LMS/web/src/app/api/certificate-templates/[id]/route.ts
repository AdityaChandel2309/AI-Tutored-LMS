import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.text();
  const response = await proxyBackendRequest(`/certificate-templates/${id}`, {
    hostname: new URL(request.url).hostname,
  }, {
    method: "PATCH",
    body,
    contentType: "application/json",
  });
  return relayBackendDataResponse(response);
}
