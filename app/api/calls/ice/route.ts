import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { buildIceServers } from "@/lib/calls/iceServers";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

// GET /api/calls/ice — STUN/TURN list for one call (see lib/calls/iceServers.ts). Signed-in users only; TURN
// credentials are short-lived and never cached by browsers or CDNs.
const HOUR = 60 * 60 * 1000;
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập.", errorEn: "Please sign in." }, { status: 401, headers: NO_STORE });
  }
  const key = `call-ice:${userId}`;
  if (isRateLimited(key, 30, HOUR)) {
    return NextResponse.json({ error: "Thao tác quá nhanh, thử lại sau.", errorEn: "Too many requests. Try again later." }, { status: 429, headers: NO_STORE });
  }
  recordAttempt(key, HOUR);
  const ice = await buildIceServers(userId);
  return NextResponse.json(ice, { headers: NO_STORE });
}
