import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// In-memory sliding-window counters, keyed by `${bucketName}:${ip}`.
// CAVEAT: this only protects a single long-running Node process. On
// serverless/multi-instance deployments (Vercel, multiple pods) each
// instance has its own Map, so the real effective limit is
// (per-instance limit) x (instance count) — for genuine DDoS/brute-force
// protection in production, back this with a shared store (Upstash Redis
// `@upstash/ratelimit`, or similar) instead of this Map.
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

interface RateLimitRule {
  bucket: string;
  limit: number;
  windowMs: number;
}

// Checked most-specific-prefix-first. Auth and message-send are the two
// endpoints most worth throttling harder than generic API traffic:
// credential stuffing / brute-force login attempts, and message-flood spam.
const RATE_LIMIT_RULES: Array<{ prefix: string; rule: RateLimitRule }> = [
  { prefix: "/api/auth/callback/credentials", rule: { bucket: "login", limit: 8, windowMs: 60 * 1000 } },
  { prefix: "/api/register", rule: { bucket: "register", limit: 5, windowMs: 5 * 60 * 1000 } },
  { prefix: "/api/messages", rule: { bucket: "messages", limit: 30, windowMs: 60 * 1000 } },
  { prefix: "/api", rule: { bucket: "default", limit: 60, windowMs: 60 * 1000 } },
];

function resolveRule(pathname: string): RateLimitRule {
  const match = RATE_LIMIT_RULES.find((r) => pathname.startsWith(r.prefix));
  return match ? match.rule : { bucket: "default", limit: 60, windowMs: 60 * 1000 };
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api")) {
    // x-forwarded-for is attacker-controllable unless the platform in front
    // of this app (Vercel, a trusted reverse proxy) strips/overwrites it —
    // confirm that's the case in your deployment, otherwise this can be
    // spoofed to bypass per-IP limiting entirely.
    const ip = (request as any).ip || request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { bucket, limit, windowMs } = resolveRule(pathname);
    const bucketKey = `${bucket}:${ip}`;

    const currentTime = Date.now();
    const rateLimitData = rateLimitCache.get(bucketKey);

    if (!rateLimitData || currentTime > rateLimitData.resetTime) {
      rateLimitCache.set(bucketKey, { count: 1, resetTime: currentTime + windowMs });
    } else {
      if (rateLimitData.count >= limit) {
        return new NextResponse(
          JSON.stringify({
            error: "Too Many Requests",
            message: `Bạn đã vượt quá giới hạn ${limit} yêu cầu / ${Math.round(windowMs / 1000)}s. Vui lòng thử lại sau.`,
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
