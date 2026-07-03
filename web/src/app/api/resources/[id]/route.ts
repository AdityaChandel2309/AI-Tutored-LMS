import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const response = await proxyBackendRequest(
    `/resources/${id}`,
    { hostname: new URL(request.url).hostname },
    { method: "DELETE" },
  );
  return relayBackendDataResponse(response);
}