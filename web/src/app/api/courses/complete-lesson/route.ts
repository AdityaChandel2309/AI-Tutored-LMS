import { relayBackendDataResponse } from "@/lib/backend-response";
import { proxyBackendRequest } from "@/lib/server-session";

// xAPI-style lesson completion endpoint used by the course player's automatic
// trackers (video 90%, text scroll-to-end, quiz pass). Forwards to the backend
// `POST /courses/complete-lesson`, which writes progress for the authenticated
// user (the session — never a client-sent userId — is authoritative).
export async function POST(request: Request) {
  const body = await request.text();
  const response = await proxyBackendRequest(
    "/courses/complete-lesson",
    { hostname: new URL(request.url).hostname },
    {
      method: "POST",
      body,
      contentType: "application/json",
    },
  );
  return relayBackendDataResponse(response);
}
