import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addViews } from "@/lib/postStats";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rateLimit";

// POST /api/posts/views { ids: string[] } — ghi nhận lượt xem THẬT. Client
// chỉ gửi bài đã hiện trên màn hình ≥1 giây và mỗi bài 1 lần/ngày/thiết bị;
// server giới hạn thêm theo IP để không thể bơm số ảo bằng script.
const MAX_IDS = 20;
const LIMIT_PER_10_MIN = 120;

export async function POST(req: Request) {
  try {
    const { ids } = await req.json().catch(() => ({ ids: [] }));
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ ok: true });
    const clean = Array.from(new Set(ids.filter((id: unknown) => typeof id === "string" && /^[a-z0-9]{20,32}$/.test(id)))).slice(0, MAX_IDS) as string[];
    if (clean.length === 0) return NextResponse.json({ ok: true });

    const key = `views:${getClientIp(req)}`;
    if (isRateLimited(key, LIMIT_PER_10_MIN, 10 * 60 * 1000)) return NextResponse.json({ ok: true });
    for (let i = 0; i < clean.length; i++) recordAttempt(key, 10 * 60 * 1000);

    // Chỉ tính bài còn tồn tại.
    const existing = await prisma.post.findMany({ where: { id: { in: clean } }, select: { id: true } });
    await addViews(existing.map((p) => p.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/posts/views error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
