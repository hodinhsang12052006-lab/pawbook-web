import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { stateName } from "@/lib/stateNames";

// GET /api/activity — hoạt động THẬT gần đây cho thông báo "đám đông"
// (FomoToast): tin tuyển mới, thợ vừa cập nhật portfolio, bài đăng mới.
// Chỉ dùng thông tin vốn đã công khai trên job board / lưới thợ / bảng tin
// (không SĐT, không email). Thay cho danh sách sự kiện bịa trước đây — social
// proof giả bị FTC (Mỹ) và ACCC (Úc) coi là quảng cáo gây hiểu lầm.
export const revalidate = 60;

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const since = new Date(Date.now() - WINDOW_MS);
    const [jobs, techs, posts] = await Promise.all([
      prisma.job.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, title: true, salonName: true, city: true, state: true, market: true, salaryAmount: true, createdAt: true },
      }),
      prisma.technicianProfile.findMany({
        where: { updatedAt: { gte: since }, NOT: [{ portfolioImages: "[]" }, { portfolioImages: "" }] },
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: { city: true, state: true, market: true, specialties: true, updatedAt: true, user: { select: { id: true, name: true } } },
      }),
      prisma.post.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, city: true, createdAt: true, _count: { select: { likes: true } }, author: { select: { name: true } } },
      }),
    ]);

    const events = [
      ...jobs.map((j) => ({
        icon: "🔥",
        text: `${j.salonName} tại ${j.city}, ${stateName(j.market, j.state)} vừa đăng tin "${j.title}" — ${j.salaryAmount}`,
        href: `/jobs/${j.id}`,
        at: j.createdAt.toISOString(),
      })),
      ...techs.map((t) => {
        const skill = t.specialties.split(",").filter(Boolean)[0];
        return {
          icon: "✨",
          text: `${t.user.name}${skill ? ` (thợ ${skill})` : ""} vừa cập nhật ảnh portfolio${t.city ? ` tại ${t.city}` : ""}`,
          href: `/profile/${t.user.id}`,
          at: t.updatedAt.toISOString(),
        };
      }),
      ...posts.map((p) => ({
        icon: "📸",
        text: `${p.author.name} vừa đăng bài mới${p.city ? ` tại ${p.city}` : ""}${p._count.likes > 0 ? ` · ${p._count.likes} lượt thích` : ""}`,
        href: "/?tab=feed",
        at: p.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    return NextResponse.json(events, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("GET /api/activity error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
