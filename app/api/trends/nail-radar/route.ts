import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { activeTrends } from "@/lib/trendRadar";

// GET /api/trends/nail-radar — XU HƯỚNG MẪU NAIL ĐANG LÊN (radar có nguồn: Pinterest Predicts 2026, xu hướng mùa / lễ)
// + vài mẫu PawNail đã làm theo từng trend (dẫn sang trang riêng từng mẫu). Công khai, CDN giữ 1 giờ (không đóng
// băng lúc build — mẫu mới mỗi ngày phải lên).
export const dynamic = "force-dynamic";
const CACHE = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

export async function GET() {
  const trends = activeTrends(new Date()).sort((a, b) => b.weight - a.weight).slice(0, 16);
  try {
    const rows = await Promise.all(trends.map(async (t) => {
      const designs = await prisma.nailDesign.findMany({
        where: { status: "published", imageUrl: { not: null }, OR: [{ description: { contains: `${t.name.vi} (` } }, { descriptionEn: { contains: `${t.name.en} (` } }] },
        select: { id: true, title: true, titleEn: true, imageUrl: true },
        orderBy: { publishedAt: "desc" },
        take: 4,
      });
      return { id: t.id, name: t.name, source: t.source, occasion: t.occasion ?? null, designs };
    }));
    // trend đã có mẫu PawNail làm theo lên trước (bấm xem được ngay)
    const out = [...rows.filter((r) => r.designs.length), ...rows.filter((r) => !r.designs.length)].slice(0, 10);
    return NextResponse.json({ trends: out }, { headers: CACHE });
  } catch {
    return NextResponse.json({ trends: trends.slice(0, 10).map((t) => ({ id: t.id, name: t.name, source: t.source, occasion: t.occasion ?? null, designs: [] })) });
  }
}
