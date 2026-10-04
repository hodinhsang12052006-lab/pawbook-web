import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getIndustryNews } from "@/lib/industryFeed";
import { getSignals } from "@/lib/trendSignals";

// GET /api/radar?market=US|AU — phần CÔNG KHAI của radar ngành cho bảng tin &
// trang Xu hướng: bài PawNail Studio admin đã duyệt (14 ngày), kết quả "Nhịp
// đau tuần" đã đủ mẫu, và tin ngành nổi bật (chỉ tiêu đề + link nguồn).
export async function GET(req: Request) {
  try {
    const market = new URL(req.url).searchParams.get("market") === "AU" ? "AU" : "US";
    const [signals, news] = await Promise.all([getSignals(market), getIndustryNews()]);
    let posts: { id: string; kind: string; title: string; body: string; href: string | null; createdAt: Date }[] = [];
    try {
      posts = await prisma.studioPost.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) }, OR: [{ market }, { market: null }] },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, kind: true, title: true, body: true, href: true, createdAt: true },
      });
    } catch {}
    return NextResponse.json(
      {
        posts,
        pulse: signals.pulse.filter((p) => p.published),
        news: news.filter((n) => n.topic !== "other").slice(0, 8),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } }
    );
  } catch (error) {
    console.error("GET /api/radar error:", error);
    return NextResponse.json({ posts: [], pulse: [], news: [] }, { status: 200 });
  }
}
