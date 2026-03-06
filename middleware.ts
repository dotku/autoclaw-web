import { auth0 } from "@/lib/auth0";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const authResponse = await auth0.middleware(request);

  // If Auth0 handled the request (auth routes), return its response
  if (request.nextUrl.pathname.startsWith("/auth/")) {
    return authResponse;
  }

  // For all other routes, continue normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
