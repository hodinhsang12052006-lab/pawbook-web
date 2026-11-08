import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as Sentry from "@sentry/nextjs";
import { authOptions } from "@/lib/authOptions";
import { buildIceServers } from "@/lib/calls/iceServers";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

// GET /api/calls/ice — STUN/TURN list for one call (see lib/calls/iceServers.ts). Signed-in users only; TURN
// credentials are short-lived and never cached by browsers' HTTP caches or CDNs (the call client keeps them in memory /
// sessionStorage until shortly before they expire — lib/calls/iceClient.ts — so a normal user asks ~once an hour).
//
// Limits (per user): 120 / hour and 20 / minute. The old 30 / hour was hit by real use (every page load + every call
// fetched a list) and a 429 meant a silent STUN-only call. Abuse protection stays: the server mints Cloudflare
// credentials at most once per 10 min per instance whatever the request rate, and one user cannot hammer the route.
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const ICE_LIMIT_PER_HOUR = 120;
const ICE_LIMIT_PER_MINUTE = 20;
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
// Same LOCAL QA switch as /api/calls (scripts/qa/call_test.mjs reloads pages dozens of times an hour). Ignored on Vercel.
const RATE_SCALE = process.env.CALL_RATE_ALLOW_TEST === "1" && !process.env.VERCEL && !process.env.VERCEL_ENV ? 20 : 1;

const reportTurnOutage = (msg: string, extra: Record<string, unknown>) => {
  try {
    Sentry.captureMessage(msg, { level: "warning", extra });
  } catch {}
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập.", errorEn: "Please sign in." }, { status: 401, headers: NO_STORE });
  }
  const hourKey = `call-ice:${userId}`;
  const minuteKey = `call-ice-m:${userId}`;
  if (isRateLimited(hourKey, ICE_LIMIT_PER_HOUR * RATE_SCALE, HOUR) || isRateLimited(minuteKey, ICE_LIMIT_PER_MINUTE * RATE_SCALE, MINUTE)) {
    return NextResponse.json(
      { error: "Thao tác quá nhanh, thử lại sau.", errorEn: "Too many requests. Try again later." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } }
    );
  }
  recordAttempt(hourKey, HOUR);
  recordAttempt(minuteKey, MINUTE);
  const ice = await buildIceServers(userId, { report: reportTurnOutage });
  return NextResponse.json(ice, { headers: NO_STORE });
}
