import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET /api/notifications — thông báo cho chuông 🔔, tổng hợp từ dữ liệu SẴN
// CÓ (không cần bảng mới): thích / bình luận bài của mình, đánh giá về mình,
// thợ lưu tin tuyển của mình, chủ tiệm mở khoá liên hệ với mình. Chỉ 30 ngày
// gần nhất, tối đa 40 mục.
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PER_KIND = 15;

export interface NotificationItem {
  id: string;
  kind: "like" | "comment" | "review" | "save" | "unlock" | "job";
  actor: { id: string | null; name: string; avatarUrl: string | null };
  text: string;
  href: string;
  createdAt: string;
}

const JOB_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const snippet = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = session.user.id;
    const since = new Date(Date.now() - WINDOW_MS);
    const actorSel = { select: { id: true, name: true, avatarUrl: true } } as const;

    // Thợ: tin GẤP mới ở cùng bang trong 7 ngày — "việc gần bạn".
    const meRow = await prisma.user.findUnique({ where: { id: me }, select: { role: true, market: true, state: true } });
    const wantsJobs = meRow?.role === "TECHNICIAN" && !!meRow.state;

    const [likes, comments, reviews, saves, unlocks, urgentJobs] = await Promise.all([
      prisma.postLike.findMany({
        where: { post: { authorId: me }, userId: { not: me }, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: PER_KIND,
        select: { id: true, createdAt: true, user: actorSel, post: { select: { content: true } } },
      }),
      prisma.postComment.findMany({
        where: { post: { authorId: me }, authorId: { not: me }, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: PER_KIND,
        select: { id: true, createdAt: true, content: true, author: actorSel },
      }),
      prisma.review.findMany({
        where: { targetUserId: me, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: PER_KIND,
        select: { id: true, createdAt: true, overall: true, author: actorSel },
      }),
      prisma.savedJob.findMany({
        where: { job: { ownerId: me }, userId: { not: me }, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: PER_KIND,
        select: { id: true, createdAt: true, job: { select: { id: true, title: true } } },
      }),
      prisma.unlockContact.findMany({
        where: { technicianUserId: me, unlockedAt: { gte: since } },
        orderBy: { unlockedAt: "desc" },
        take: PER_KIND,
        select: { id: true, unlockedAt: true, owner: actorSel },
      }),
      wantsJobs
        ? prisma.job.findMany({
            where: { isUrgent: true, market: meRow!.market, state: meRow!.state!, ownerId: { not: me }, createdAt: { gte: new Date(Date.now() - JOB_WINDOW_MS) } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, title: true, city: true, salaryAmount: true, createdAt: true, owner: actorSel },
          })
        : Promise.resolve([]),
    ]);

    const items: NotificationItem[] = [
      ...likes.map((l) => ({
        id: `like-${l.id}`,
        kind: "like" as const,
        actor: l.user,
        text: `đã thích bài viết của bạn: "${snippet(l.post.content)}"`,
        href: "/?tab=feed",
        createdAt: l.createdAt.toISOString(),
      })),
      ...comments.map((c) => ({
        id: `comment-${c.id}`,
        kind: "comment" as const,
        actor: c.author,
        text: `đã bình luận: "${snippet(c.content)}"`,
        href: "/?tab=feed",
        createdAt: c.createdAt.toISOString(),
      })),
      ...reviews.map((r) => ({
        id: `review-${r.id}`,
        kind: "review" as const,
        actor: r.author,
        text: `đã đánh giá bạn ${"★".repeat(r.overall)}`,
        href: `/profile/${me}`,
        createdAt: r.createdAt.toISOString(),
      })),
      // Không lộ danh tính người lưu tin (hành động riêng tư của thợ).
      ...saves.map((s) => ({
        id: `save-${s.id}`,
        kind: "save" as const,
        actor: { id: null, name: "Một thợ nail", avatarUrl: null },
        text: `vừa lưu tin tuyển "${snippet(s.job.title)}" của bạn`,
        href: `/jobs/${s.job.id}`,
        createdAt: s.createdAt.toISOString(),
      })),
      ...unlocks.map((u) => ({
        id: `unlock-${u.id}`,
        kind: "unlock" as const,
        actor: u.owner,
        text: "đã mở khoá liên hệ với bạn — có thể sắp nhắn tin mời làm việc",
        href: `/profile/${u.owner.id}`,
        createdAt: u.unlockedAt.toISOString(),
      })),
      ...urgentJobs.map((j) => ({
        id: `job-${j.id}`,
        kind: "job" as const,
        actor: j.owner,
        text: `cần thợ gấp tại ${j.city}: "${snippet(j.title)}" — ${j.salaryAmount}`,
        href: `/jobs/${j.id}`,
        createdAt: j.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 40);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Không tải được thông báo." }, { status: 500 });
  }
}
