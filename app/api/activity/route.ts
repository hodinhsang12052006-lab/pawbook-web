import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { stateName } from "@/lib/stateNames";

// GET /api/activity — hoạt động THẬT gần đây cho thông báo "đám đông"
// (FomoToast): tin tuyển mới, thợ vừa cập nhật portfolio, bài đăng được
// thích. Chỉ dùng thông tin vốn đã công khai trên job board / lưới thợ /
// bảng tin (không SĐT, không email). Social proof giả bị FTC (Mỹ) và ACCC
// (Úc) coi là quảng cáo gây hiểu lầm — nên ở đây không có sự kiện bịa nào.
export const revalidate = 60;

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const FRESH_MS = 24 * 60 * 60 * 1000;

export interface ActivityEvent {
  kind: "job" | "tech" | "post";
  title: string; // nhãn nhỏ phía trên, VD "Tin tuyển gấp"
  text: string;
  chip?: string; // VD mức lương
  href: string;
  at: string;
  actor?: { id: string; name: string; avatarUrl: string | null };
}

export async function GET() {
  try {
    const now = Date.now();
    const since = new Date(now - WINDOW_MS);
    const [jobs, techs, posts] = await Promise.all([
      prisma.job.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true, title: true, salonName: true, city: true, state: true, market: true, salaryAmount: true, isUrgent: true, createdAt: true,
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.technicianProfile.findMany({
        where: { updatedAt: { gte: since }, NOT: [{ portfolioImages: "[]" }, { portfolioImages: "" }] },
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: { city: true, specialties: true, updatedAt: true, user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.post.findMany({
        where: { createdAt: { gte: since }, likes: { some: {} } },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, city: true, createdAt: true, _count: { select: { likes: true, comments: true } }, author: { select: { id: true, name: true, avatarUrl: true } } },
      }),
    ]);

    // "vừa" chỉ dùng cho sự kiện trong 24 giờ — cũ hơn thì nói đúng là "đã".
    const verb = (d: Date, fresh: string, old: string) => (now - d.getTime() < FRESH_MS ? fresh : old);

    const events: ActivityEvent[] = [
      ...jobs.map((j) => ({
        kind: "job" as const,
        title: j.isUrgent ? "Tin tuyển gấp" : "Tin tuyển mới",
        text: `${j.salonName} tại ${j.city}, ${stateName(j.market, j.state)} ${verb(j.createdAt, "vừa đăng", "đang tuyển")}: “${j.title}”`,
        chip: j.salaryAmount,
        href: `/jobs/${j.id}`,
        at: j.createdAt.toISOString(),
        actor: j.owner,
      })),
      ...techs.map((t) => {
        const skill = t.specialties.split(",").map((s) => s.trim()).filter(Boolean)[0];
        return {
          kind: "tech" as const,
          title: "Thợ cập nhật portfolio",
          text: `${t.user.name}${skill ? ` (thợ ${skill})` : ""} ${verb(t.updatedAt, "vừa thêm", "đã thêm")} mẫu móng mới${t.city ? ` tại ${t.city}` : ""}`,
          href: `/profile/${t.user.id}`,
          at: t.updatedAt.toISOString(),
          actor: t.user,
        };
      }),
      ...posts.map((p) => ({
        kind: "post" as const,
        title: "Bài đăng được yêu thích",
        text: `Bài của ${p.author.name}${p.city ? ` tại ${p.city}` : ""} có ${p._count.likes} lượt thích${p._count.comments ? ` · ${p._count.comments} bình luận` : ""}`,
        href: `/profile/${p.author.id}`,
        at: p.createdAt.toISOString(),
        actor: p.author,
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
