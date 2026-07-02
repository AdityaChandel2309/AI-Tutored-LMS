import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const response = await proxyBackendRequest(
    `/scorm/${id}/runtime-data`,
    { hostname: new URL(request.url).hostname },
  );
  return relayBackendDataResponse(response);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const response = await proxyBackendRequest(
    `/scorm/${id}/runtime-data`,
    { hostname: new URL(request.url).hostname },
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
  return relayBackendDataResponse(response);
}
