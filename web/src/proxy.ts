import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken =
    request.cookies.get("access_token")?.value;
  const refreshToken =
    request.cookies.get("refresh_token")?.value;
  const hasSession = Boolean(
    accessToken || refreshToken,
  );

  const isProtectedRoute = protectedRoutes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`),
  );

  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (
    (pathname === "/" || pathname === "/callback") &&
    hasSession
  ) {
    const dashboardUrl = new URL(
      "/dashboard",
      request.url,
    );
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/callback", "/dashboard/:path*"],
};
