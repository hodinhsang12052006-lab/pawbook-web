import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/rateLimit";

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

// Checked most-specific-prefix-first — ORDER MATTERS, more specific prefixes
// must come before their parent prefix or they'll never match.
//
// Chat (/api/messages and everything under it) is deliberately NOT rate
// limited here: it's core product functionality, not an abuse surface worth
// risking false-positive throttling on. Only auth endpoints (credential
// stuffing / mass signup) get a limit.
const RATE_LIMIT_RULES: Array<{ prefix: string; rule: RateLimitRule }> = [
  { prefix: "/api/auth/callback/credentials", rule: { bucket: "login", limit: 8, windowMs: 60 * 1000 } },
  { prefix: "/api/register", rule: { bucket: "register", limit: 5, windowMs: 5 * 60 * 1000 } },
  // Quên / đặt lại mật khẩu: chặn spam gửi thư và đoán mã.
  { prefix: "/api/auth/forgot", rule: { bucket: "forgot", limit: 5, windowMs: 15 * 60 * 1000 } },
  { prefix: "/api/auth/reset", rule: { bucket: "reset", limit: 10, windowMs: 15 * 60 * 1000 } },
];

function resolveRule(pathname: string): RateLimitRule | null {
  const match = RATE_LIMIT_RULES.find((r) => pathname.startsWith(r.prefix));
  return match ? match.rule : null;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // (10/2026) Trước đây khách chưa đăng nhập vào "/" bị đẩy thẳng sang /auth/register.
  // Đã bỏ: khách xem được bảng tin, việc làm, thợ (như người dùng thật vẫn "xem thử
  // rồi mới đăng ký") và Google lập chỉ mục được trang chủ. Hành động cần tài khoản
  // (nhắn tin, đăng tin, lưu…) vẫn dẫn về trang đăng ký.

  const rule = resolveRule(pathname);

  if (rule) {
    const { bucket, limit, windowMs } = rule;
    // getClientIp ưu tiên cf-connecting-ip (IP thật sau Cloudflare) — trước
    // đây đọc nguyên chuỗi x-forwarded-for, tức IP edge Cloudflare, khiến
    // mọi người dùng cùng 1 PoP chung 1 bộ đếm đăng nhập/đăng ký.
    const ip = getClientIp(request);
    const bucketKey = `${bucket}:${ip}`;

    const currentTime = Date.now();
    // Mỗi IP mới thêm 1 entry không bao giờ tự xóa — dọn entry hết hạn khi
    // Map phình to để bộ nhớ instance không tăng mãi dưới tải lớn/tấn công.
    if (rateLimitCache.size > 10_000) {
      for (const [key, value] of rateLimitCache) {
        if (currentTime > value.resetTime) rateLimitCache.delete(key);
      }
    }
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
  // Giới hạn tần suất cho API đăng nhập / đăng ký.
  matcher: ["/api/:path*"],
};
