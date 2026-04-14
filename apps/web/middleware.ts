import { NextResponse, type NextRequest } from "next/server";

// Origins allowed to call the API.
// In production, add your deployed mobile web URL to ALLOWED_ORIGINS (comma-separated).
const ALLOWED_ORIGINS = [
  "http://localhost:8081",   // Expo web dev server
  "http://localhost:19006",  // Expo web (older default port)
  ...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
];

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-csrf-token",
};

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin);

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
        ...CORS_HEADERS,
      },
    });
  }

  const response = NextResponse.next();

  if (allowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    Object.entries(CORS_HEADERS).forEach(([k, v]) =>
      response.headers.set(k, v)
    );
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
