import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "atomquest-secret-key-change-me-for-production-hackathon-2026";
const key = new TextEncoder().encode(JWT_SECRET);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth-token")?.value;

  // Verify JWT
  let payload = null;
  if (token) {
    try {
      const { payload: verified } = await jwtVerify(token, key, {
        algorithms: ["HS256"],
      });
      payload = verified;
    } catch (error) {
      // Invalid or expired token
    }
  }

  // Paths that require authentication (Dashboard paths)
  const isDashboardPath = 
    pathname.startsWith("/dashboard") || 
    pathname.startsWith("/sessions") || 
    pathname.startsWith("/history");

  // Auth pages (login, register)
  const isAuthPath = pathname.startsWith("/login") || pathname.startsWith("/register");

  // API routes (except auth and public sessions)
  const isApiPath = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/");

  if (isDashboardPath) {
    if (!payload) {
      // Redirect to login
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (isAuthPath) {
    if (payload) {
      // Redirect to dashboard if already authenticated
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (isApiPath) {
    if (!payload) {
      // Block recording endpoints entirely for unauthenticated users
      if (pathname.includes("/recording")) {
        return NextResponse.json({ error: "Unauthorized: Authentication required for recordings" }, { status: 401 });
      }

      // Block MiroTalk API endpoints for unauthenticated users
      if (pathname.startsWith("/api/mirotalk")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Allow public GET and PATCH requests to /api/sessions/[id] for customer join flow
      if (pathname.startsWith("/api/sessions")) {
        const isPublicSessionRoute = (request.method === "GET" || request.method === "PATCH") && 
                                     pathname.startsWith("/api/sessions/") && 
                                     !pathname.endsWith("/new") &&
                                     !pathname.endsWith("/history") &&
                                     !isDashboardPath;
        if (!isPublicSessionRoute) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sessions/:path*",
    "/history/:path*",
    "/login",
    "/register",
    "/api/sessions/:path*",
    "/api/mirotalk/:path*",
    "/api/metrics",
  ],
};
