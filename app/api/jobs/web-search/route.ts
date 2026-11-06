import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { realOnly } from "@/lib/demo";
import { activeJobWhere } from "@/lib/jobIngest/ingest";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { careerjetEnabled } from "@/lib/jobFeeds/config";
import { searchCareerjet } from "@/lib/jobFeeds/careerjet";
import { companyMatch, sameCity } from "@/lib/jobFeeds/normalize";
import { toPublic } from "@/lib/jobFeeds/sync";

// GET /api/jobs/web-search?market=US|AU&state=&city=&page=  — nút "Tìm thêm việc nail trên web" (Careerjet).
//   Tìm TRỰC TIẾP cho đúng người bấm: Careerjet yêu cầu IP + trình duyệt của người xem (đã ghi trong Chính
//   sách quyền riêng tư). KHÔNG lưu DB, không cache chung, không cron. Giới hạn 10 lượt / phút / IP.
//   Bỏ kết quả trùng tin đang hiện trên PawNail (tin tiệm / tin Adzuna cùng tiệm, cùng nơi).
export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!careerjetEnabled()) return NextResponse.json({ enabled: false, items: [], total: 0 }, { headers });
  const ip = getClientIp(req);
  const rk = `jobs-web-search:${ip}`;
  if (isRateLimited(rk, 10, 60_000)) return NextResponse.json({ enabled: true, error: "rate_limited", items: [], total: 0 }, { status: 429, headers });
  recordAttempt(rk, 60_000);

  const sp = req.nextUrl.searchParams;
  const market = sp.get("market") === "AU" ? "AU" : "US";
  const state = (sp.get("state") || "").trim().toUpperCase().slice(0, 3) || null;
  const city = (sp.get("city") || "").trim().slice(0, 60) || null;
  const r = await searchCareerjet({ market, state, city, page: Number(sp.get("page")) || 1, userIp: ip, userAgent: req.headers.get("user-agent") || "" });
  if (r.status !== "ok") return NextResponse.json({ enabled: true, error: r.status, items: [], total: 0 }, { status: r.status === "rate_limited" ? 429 : 502, headers });

  // Chống trùng (4c): cùng dedupeKey với tin Adzuna đang hiện, hoặc cùng tiệm + cùng nơi với tin trên PawNail
  const keys = r.jobs.map((j) => j.dedupeKey);
  const [adz, jobs] = await Promise.all([
    prisma.externalJob.findMany({ where: { provider: "adzuna", dedupeKey: { in: keys }, expiresAt: { gt: new Date() }, hiddenReason: null }, select: { dedupeKey: true } }).catch(() => [] as { dedupeKey: string }[]),
    prisma.job.findMany({ where: { AND: [activeJobWhere(), { owner: realOnly() }, { market }, ...(state ? [{ state }] : [])] }, select: { salonName: true, city: true, state: true }, take: 2000 }).catch(() => []),
  ]);
  const shown = new Set(adz.map((a) => a.dedupeKey));
  const items = r.jobs
    .filter((j) => !shown.has(j.dedupeKey))
    .filter((j) => !jobs.some((p) => !!j.state && p.state === j.state && sameCity(p.city, j.city) && companyMatch(p.salonName, j.company)))
    .map((j) => toPublic({ ...j, id: `cj_${j.providerJobId}` }, market));
  return NextResponse.json({ enabled: true, items, total: r.total ?? items.length }, { headers });
}
