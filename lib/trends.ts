import prisma from "@/lib/prisma";
import { getViews } from "@/lib/postStats";
import { stateName } from "@/lib/stateNames";
import type { Market } from "@prisma/client";

// "Xu hướng tuần" — toàn bộ tính từ dữ liệu THẬT trên app: lượt thích /
// bình luận / lượt xem bài, đánh giá, tin tuyển. Mục nào chưa đủ dữ liệu thì
// trả rỗng để UI ẩn đi, không độn số.

const DAY = 86_400_000;
const POST_WINDOW = 14 * DAY;
const TECH_WINDOW = 30 * DAY;
const JOB_WINDOW = 7 * DAY;
const CACHE_MS = 5 * 60 * 1000;

export interface TrendsData {
  market: Market;
  generatedAt: string;
  pulse: { state: string; label: string; newJobs: number; urgentJobs: number; availableTechs: number }[];
  hotPosts: {
    id: string; image: string; likes: number; comments: number; views: number;
    author: { id: string; name: string; avatarUrl: string | null }; city: string | null;
  }[];
  hashtags: { tag: string; count: number }[];
  salaries: { state: string; label: string; jobs: number; median: number; low: number; high: number }[];
  risingTechs: {
    id: string; name: string; avatarUrl: string | null; city: string; state: string;
    likes: number; rating: number | null; reviews: number; specialty: string | null;
  }[];
}

const cache = new Map<string, { at: number; data: TrendsData }>();

const parseMedia = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
};
const isVideo = (u: string) => /\.(mp4|webm|mov)(\?|$)/i.test(u);

/** "$1,200-1,500/tuần" → 1350 (lương TUẦN). Không phải lương tuần → null. */
export function weeklyPay(amount: string, type: string): number | null {
  const text = `${amount} ${type}`;
  if (!/tuần|week|\/wk/i.test(text) || /giờ|hour|\/h\b|%/i.test(amount)) return null;
  const nums = (amount.match(/\d[\d,.]*/g) || [])
    .map((n) => Number(n.replace(/,/g, "")))
    .filter((n) => n >= 300 && n <= 10_000);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))];
const round50 = (n: number) => Math.round(n / 50) * 50;

export async function getTrends(market: Market): Promise<TrendsData> {
  const hit = cache.get(market);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const now = Date.now();
  const [posts, jobsWeek, allJobs, techs, techLikes, reviewAgg] = await Promise.all([
    prisma.post.findMany({
      where: { createdAt: { gte: new Date(now - POST_WINDOW) }, OR: [{ market }, { market: null }] },
      select: {
        id: true, content: true, mediaUrls: true, city: true,
        author: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
    prisma.job.groupBy({
      by: ["state", "isUrgent"],
      where: { market, createdAt: { gte: new Date(now - JOB_WINDOW) } },
      _count: { _all: true },
    }),
    prisma.job.findMany({ where: { market }, select: { state: true, salaryAmount: true, salaryType: true }, take: 2000 }),
    prisma.technicianProfile.findMany({
      where: { market },
      select: { userId: true, state: true, city: true, status: true, specialties: true, user: { select: { id: true, name: true, avatarUrl: true } } },
      take: 2000,
    }),
    prisma.postLike.findMany({
      where: { createdAt: { gte: new Date(now - TECH_WINDOW) }, post: { author: { role: "TECHNICIAN" } } },
      select: { post: { select: { authorId: true } } },
      take: 5000,
    }),
    prisma.review.groupBy({
      by: ["targetUserId"],
      where: { type: "TECHNICIAN_REVIEW" },
      _avg: { overall: true },
      _count: { _all: true },
    }),
  ]);

  // ---- Nhịp thị trường theo bang ----
  const pulseMap = new Map<string, { newJobs: number; urgentJobs: number; availableTechs: number }>();
  const pulseRow = (st: string) => {
    if (!pulseMap.has(st)) pulseMap.set(st, { newJobs: 0, urgentJobs: 0, availableTechs: 0 });
    return pulseMap.get(st)!;
  };
  for (const g of jobsWeek) {
    const r = pulseRow(g.state);
    r.newJobs += g._count._all;
    if (g.isUrgent) r.urgentJobs += g._count._all;
  }
  for (const t of techs) if (t.status === "AVAILABLE" || t.status === "URGENT") pulseRow(t.state).availableTechs += 1;
  const pulse = Array.from(pulseMap.entries())
    .filter(([, v]) => v.newJobs > 0)
    .map(([state, v]) => ({ state, label: stateName(market, state) || state, ...v }))
    .sort((a, b) => b.newJobs - a.newJobs || b.urgentJobs - a.urgentJobs)
    .slice(0, 6);

  // ---- Mẫu móng hot (ảnh thật, xếp theo tương tác thật) ----
  const views = await getViews(posts.map((p) => p.id));
  const hotPosts = posts
    .map((p) => {
      const image = parseMedia(p.mediaUrls).find((u) => !isVideo(u));
      const v = views.get(p.id) ?? 0;
      const score = p._count.likes * 3 + p._count.comments * 4 + v * 0.2;
      return { p, image, v, score };
    })
    .filter((x) => x.image && x.p._count.likes + x.p._count.comments >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ p, image, v }) => ({
      id: p.id, image: image!, likes: p._count.likes, comments: p._count.comments, views: v,
      author: p.author, city: p.city,
    }));

  // ---- Hashtag đang lên (≥2 bài mới tính) ----
  const tagCount = new Map<string, { tag: string; count: number }>();
  for (const p of posts) {
    const seen = new Set<string>();
    for (const m of p.content.matchAll(/#([\p{L}\p{N}_]{2,30})/gu)) {
      const key = m[1].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = tagCount.get(key) || { tag: m[1], count: 0 };
      cur.count += 1;
      tagCount.set(key, cur);
    }
  }
  const hashtags = Array.from(tagCount.values()).filter((t) => t.count >= 2).sort((a, b) => b.count - a.count).slice(0, 10);

  // ---- Lương tuần theo bang (cần ≥3 tin có số lương tuần) ----
  const payByState = new Map<string, number[]>();
  for (const j of allJobs) {
    const w = weeklyPay(j.salaryAmount, j.salaryType);
    if (w === null) continue;
    if (!payByState.has(j.state)) payByState.set(j.state, []);
    payByState.get(j.state)!.push(w);
  }
  const salaries = Array.from(payByState.entries())
    .filter(([, arr]) => arr.length >= 3)
    .map(([state, arr]) => {
      const s = arr.sort((a, b) => a - b);
      return { state, label: stateName(market, state) || state, jobs: s.length, median: round50(quantile(s, 0.5)), low: round50(quantile(s, 0.25)), high: round50(quantile(s, 0.75)) };
    })
    .sort((a, b) => b.median - a.median)
    .slice(0, 8);

  // ---- Thợ nổi bật (lượt thích 30 ngày + đánh giá thật) ----
  const likesBy = new Map<string, number>();
  for (const l of techLikes) likesBy.set(l.post.authorId, (likesBy.get(l.post.authorId) ?? 0) + 1);
  const reviewBy = new Map(reviewAgg.map((r) => [r.targetUserId, { avg: r._avg.overall, n: r._count._all }]));
  const risingTechs = techs
    .map((t) => {
      const likes = likesBy.get(t.userId) ?? 0;
      const rv = reviewBy.get(t.userId);
      const rating = rv?.avg ? Math.round(rv.avg * 10) / 10 : null;
      // Đánh giá chỉ cộng điểm khi TỐT (≥4★) — "nổi bật" phải là khen thật,
      // không phải cứ có đánh giá (kể cả 3★) là lên bảng.
      const goodReviews = rating !== null && rating >= 4 ? rv?.n ?? 0 : 0;
      const score = likes + goodReviews * 3 + (rating && rating >= 4.5 && (rv?.n ?? 0) >= 2 ? 5 : 0);
      return { t, likes, rating, reviews: rv?.n ?? 0, score };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ t, likes, rating, reviews }) => ({
      id: t.user.id, name: t.user.name, avatarUrl: t.user.avatarUrl, city: t.city, state: stateName(market, t.state) || t.state,
      likes, rating, reviews, specialty: t.specialties.split(",").map((s) => s.trim()).filter(Boolean)[0] ?? null,
    }));

  const data: TrendsData = { market, generatedAt: new Date().toISOString(), pulse, hotPosts, hashtags, salaries, risingTechs };
  cache.set(market, { at: Date.now(), data });
  return data;
}
