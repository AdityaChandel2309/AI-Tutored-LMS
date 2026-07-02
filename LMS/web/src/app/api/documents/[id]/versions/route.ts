import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contentType = request.headers.get("content-type") || "";
  const body = await request.arrayBuffer();
  const response = await proxyBackendRequest(`/documents/${id}/versions`, { hostname: new URL(request.url).hostname }, {
    method: "POST",
    body: body as unknown as BodyInit,
    headers: { "Content-Type": contentType },
  });
  return relayBackendDataResponse(response);
}
