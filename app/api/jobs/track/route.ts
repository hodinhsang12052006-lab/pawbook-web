import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { addJobContact, addJobViews } from "@/lib/jobStats";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rateLimit";

// POST /api/jobs/track
//   { ids: string[] }   — lượt xem THẬT (client chỉ gửi tin đã hiện ≥1 giây,
//                          mỗi tin 1 lần/ngày/thiết bị)
//   { contact: string } — người xem bấm "Gọi ngay" / "Nhắn tin"
// Server giới hạn thêm theo IP để script không bơm được số "nóng" ảo.
const ID_RE = /^[a-z0-9]{20,32}$/;
const MAX_IDS = 20;
const VIEW_LIMIT_PER_10_MIN = 120;
const DAY_MS = 86_400_000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = getClientIp(req);
    // Chủ tiệm xem / bấm trên tin của CHÍNH MÌNH không được tính.
    const me = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;

    if (typeof body.contact === "string" && ID_RE.test(body.contact)) {
      // 1 IP chỉ tính 1 lần liên hệ / tin / ngày.
      const key = `jobcontact:${ip}:${body.contact}`;
      if (!isRateLimited(key, 1, DAY_MS)) {
        recordAttempt(key, DAY_MS);
        const exists = await prisma.job.findUnique({ where: { id: body.contact }, select: { id: true, ownerId: true } });
        if (exists && exists.ownerId !== me) await addJobContact(exists.id);
      }
      return NextResponse.json({ ok: true });
    }

    if (!Array.isArray(body.ids) || body.ids.length === 0) return NextResponse.json({ ok: true });
    const clean = Array.from(new Set(body.ids.filter((id: unknown) => typeof id === "string" && ID_RE.test(id)))).slice(0, MAX_IDS) as string[];
    if (clean.length === 0) return NextResponse.json({ ok: true });

    const key = `jobviews:${ip}`;
    if (isRateLimited(key, VIEW_LIMIT_PER_10_MIN, 10 * 60 * 1000)) return NextResponse.json({ ok: true });
    for (let i = 0; i < clean.length; i++) recordAttempt(key, 10 * 60 * 1000);

    const existing = await prisma.job.findMany({ where: { id: { in: clean }, ...(me ? { ownerId: { not: me } } : {}) }, select: { id: true } });
    await addJobViews(existing.map((j) => j.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/jobs/track error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
