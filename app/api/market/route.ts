import { NextResponse } from "next/server";
import { MARKET_COOKIE, MARKET_COOKIE_MAX_AGE, isMarket, marketFromHeaders } from "@/lib/market";

// GET  /api/market — thị trường mặc định cho khách chưa chọn: cookie → quốc gia theo IP (Vercel / Cloudflare)
//      → vùng Accept-Language. Dò được thì đặt luôn cookie 1 năm (máy chủ đặt → Safari ITP không cắt).
// POST /api/market { market: "US" | "AU" } — nhớ lựa chọn của người xem.
const cookieOpts = (req: Request) => ({
  path: "/",
  maxAge: MARKET_COOKIE_MAX_AGE,
  sameSite: "lax" as const,
  secure: new URL(req.url).protocol === "https:",
});

export async function GET(req: Request) {
  const { market, source } = marketFromHeaders((n) => req.headers.get(n));
  const res = NextResponse.json({ market: market ?? "US", source: source ?? "default" }, { headers: { "Cache-Control": "private, no-store" } });
  if (market && source !== "cookie") res.cookies.set(MARKET_COOKIE, market, cookieOpts(req));
  return res;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { market?: unknown } | null;
  if (!isMarket(body?.market)) return NextResponse.json({ ok: false, error: "Thị trường không hợp lệ.", errorEn: "Invalid market." }, { status: 400 });
  const res = NextResponse.json({ ok: true, market: body.market }, { headers: { "Cache-Control": "private, no-store" } });
  res.cookies.set(MARKET_COOKIE, body.market, cookieOpts(req));
  return res;
}
