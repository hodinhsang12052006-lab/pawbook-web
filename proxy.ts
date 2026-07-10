import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in-memory storage for rate limiting
const ipCache = new Map<string, { count: number; resetTime: number }>();

export function proxy(request: NextRequest) {
  const ip = (request as any).ip || request.headers.get("x-forwarded-for") || "127.0.0.1";

  // Rate limit only /api/ endpoints
  if (request.nextUrl.pathname.startsWith("/api")) {
    const currentTime = Date.now();
    const limit = 60; // max 60 requests
    const duration = 60 * 1000; // 1 minute in milliseconds

    const rateLimitData = ipCache.get(ip);

    if (!rateLimitData || currentTime > rateLimitData.resetTime) {
      // First request or window expired
      ipCache.set(ip, {
        count: 1,
        resetTime: currentTime + duration,
      });
    } else {
      // Within window
      if (rateLimitData.count >= limit) {
        return new NextResponse(
          JSON.stringify({
            error: "Too Many Requests",
            message: "Bạn đã vượt quá giới hạn 60 yêu cầu mỗi phút. Vui lòng thử lại sau.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": Math.ceil((rateLimitData.resetTime - currentTime) / 1000).toString(),
            },
          }
        );
      }
      rateLimitData.count += 1;
    }
  }

  return NextResponse.next();
}

export const config = {
  // Protect all API routes
  matcher: "/api/:path*",
};