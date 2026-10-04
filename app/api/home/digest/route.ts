import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET /api/home/digest?since=<ISO> — "Từ lần trước bạn ghé…": đếm THẬT những
// gì người dùng đã bỏ lỡ (tin tuyển mới ở bang mình, lượt thích / bình luận
// bài của mình, thợ lưu tin của tiệm, thợ mới sẵn sàng). Chỉ trả SỐ ĐẾM.
const MAX_LOOKBACK_MS = 30 * 86_400_000;

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const me = (session?.user as { id?: string } | undefined)?.id;
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const raw = new URL(req.url).searchParams.get("since");
    const parsed = raw ? new Date(raw) : null;
    if (!parsed || isNaN(parsed.getTime())) return NextResponse.json({ error: "since không hợp lệ" }, { status: 400 });
    const since = new Date(Math.max(parsed.getTime(), Date.now() - MAX_LOOKBACK_MS));

    const user = await prisma.user.findUnique({ where: { id: me }, select: { role: true, market: true, state: true } });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const area = { market: user.market ?? undefined, ...(user.state ? { state: user.state } : {}) };

    const [newJobs, likes, comments, saves, newTechs] = await Promise.all([
      prisma.job.count({ where: { ...area, ownerId: { not: me }, createdAt: { gt: since } } }),
      prisma.postLike.count({ where: { post: { authorId: me }, userId: { not: me }, createdAt: { gt: since } } }),
      prisma.postComment.count({ where: { post: { authorId: me }, authorId: { not: me }, createdAt: { gt: since } } }),
      user.role === "OWNER" ? prisma.savedJob.count({ where: { job: { ownerId: me }, createdAt: { gt: since } } }) : Promise.resolve(0),
      user.role === "OWNER"
        ? prisma.technicianProfile.count({ where: { ...area, status: { in: ["AVAILABLE", "URGENT"] }, updatedAt: { gt: since } } })
        : Promise.resolve(0),
    ]);

    return NextResponse.json({ since: since.toISOString(), state: user.state, market: user.market, newJobs, likes, comments, saves, newTechs });
  } catch (error) {
    console.error("GET /api/home/digest error:", error);
    return NextResponse.json({ error: "Không tải được." }, { status: 500 });
  }
}
