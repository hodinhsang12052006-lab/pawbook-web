import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { buildBotDrafts, firstLine } from "@/lib/contentBot";
import { upcomingThemes } from "@/lib/aiDesigns";

// Bot nội dung (chỉ ADMIN, xác minh trong DB):
//   GET ?market=US|AU — bài nháp hôm nay cho tài khoản chính thức (chưa đăng gì cả).
// Đăng: admin bấm "Đăng lên hồ sơ chính thức" → dùng POST /api/posts như bài thường
// (tác giả = chính tài khoản admin/chính thức), nên bài hiện trên bảng tin + hồ sơ.
export async function GET(req: Request) {
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!id) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });

  const market = new URL(req.url).searchParams.get("market") === "AU" ? "AU" : "US";
  const now = new Date();
  const mine = await prisma.post.findMany({ where: { authorId: id, createdAt: { gte: new Date(now.getTime() - 365 * 86_400_000) } }, select: { content: true }, take: 500 });

  // Chỉ quảng bá bộ mẫu dịp lễ khi đã có ≥ 10 mẫu ĐÃ DUYỆT cho dịp đó (nói đúng sự thật).
  let theme: { title: string; emoji: string } | null = null;
  const t = upcomingThemes(market, now)[0];
  if (t) {
    const n = await prisma.nailDesign.count({ where: { status: "published", occasion: t.id } }).catch(() => 0);
    if (n >= 10) theme = { title: t.title, emoji: t.emoji };
  }
  const drafts = buildBotDrafts({ market, now, theme, publishedTitles: new Set(mine.map((p) => firstLine(p.content))) });
  return NextResponse.json({ drafts, market });
}
