import { relayBackendResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> },
) {
  const { id, path } = await params;
  const filePath = Array.isArray(path) ? path.join("/") : path;
  const response = await proxyBackendRequest(
    `/scorm/${id}/files/${filePath}`,
    { hostname: new URL(request.url).hostname },
  );
  return relayBackendResponse(response);
}
