import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const response = await proxyBackendRequest(`/employees${query ? `?${query}` : ""}`, { hostname: new URL(request.url).hostname });
  return relayBackendDataResponse(response);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    // CSV import — forward as-is
    const formData = await request.arrayBuffer();
    const response = await proxyBackendRequest("/employees/import", { hostname: new URL(request.url).hostname }, {
      method: "POST",
      body: formData as unknown as BodyInit,
      headers: { "Content-Type": contentType },
    });
    return relayBackendDataResponse(response);
  }
  const body = await request.text();
  const response = await proxyBackendRequest("/employees", { hostname: new URL(request.url).hostname }, { method: "POST", body, contentType: "application/json" });
  return relayBackendDataResponse(response);
}
