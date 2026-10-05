import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { getViewStats, recordProfileView } from "@/lib/profileViews";

async function me() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

// GET /api/profile/views — "Ai đã xem hồ sơ bạn" (CHỈ của chính mình).
export async function GET() {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  return NextResponse.json(await getViewStats(userId), { headers: { "Cache-Control": "private, no-store" } });
}

// POST /api/profile/views { profileId } — ghi 1 lượt xem khi mở hồ sơ người khác.
export async function POST(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const profileId = typeof body?.profileId === "string" && /^[a-z0-9]{10,40}$/i.test(body.profileId) ? body.profileId : null;
  if (!profileId) return NextResponse.json({ error: "Hồ sơ không hợp lệ." }, { status: 400 });
  // Chống bơm lượt xem bằng script: tối đa 120 hồ sơ/giờ mỗi người.
  const key = `pview:${userId}`;
  if (isRateLimited(key, 120, 3_600_000)) return NextResponse.json({ ok: true, counted: false });
  recordAttempt(key, 3_600_000);
  // Ghi sau khi đã trả lời — người xem không phải chờ (kể cả gửi push).
  after(() => recordProfileView(userId, profileId));
  return NextResponse.json({ ok: true });
}
