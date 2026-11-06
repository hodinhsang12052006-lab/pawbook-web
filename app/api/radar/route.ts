import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getIndustryNews } from "@/lib/industryFeed";
import { getSignals } from "@/lib/trendSignals";

// Cùng 1 sự kiện nhiều báo đưa (VD 3/8 tin cùng 1 vụ tai nạn) → giữ 1: so trùng theo từ của tiêu đề (≥ 60%).
const titleWords = (t: string) => new Set(t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 3));
function dedupeStories<T extends { title: string }>(items: T[]): T[] {
  const kept: { item: T; words: Set<string> }[] = [];
  for (const item of items) {
    const words = titleWords(item.title);
    const dup = kept.some((k) => {
      const small = Math.min(words.size, k.words.size);
      if (small < 3) return false; // tiêu đề quá ít từ (tin tiếng Việt toàn từ ngắn) → không đoán trùng
      const inter = [...words].filter((w) => k.words.has(w)).length;
      return inter / small >= 0.6;
    });
    if (!dup) kept.push({ item, words });
  }
  return kept.map((k) => k.item);
}

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
        // Tin của ĐÚNG thị trường trước (trước đây Úc nhận y hệt 8 tin Mỹ); < 3 tin thì thêm tin nơi khác (mỗi tin có market)
        news: (() => {
          const relevant = dedupeStories(news.filter((n) => n.topic !== "other"));
          const mine = relevant.filter((n) => n.market === market);
          return (mine.length >= 3 ? mine : [...mine, ...relevant.filter((n) => n.market !== market)]).slice(0, 8);
        })(),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } }
    );
  } catch (error) {
    console.error("GET /api/radar error:", error);
    return NextResponse.json({ posts: [], pulse: [], news: [] }, { status: 200 });
  }
}
