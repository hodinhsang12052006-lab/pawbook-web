import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { realOnly } from "@/lib/demo";
import { activeJobWhere, INGEST_SOURCE } from "@/lib/jobIngest/ingest";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { adzunaPublic, careerjetEnabled } from "@/lib/jobFeeds/config";
import { searchCareerjet } from "@/lib/jobFeeds/careerjet";
import { companyMatch, sameCity } from "@/lib/jobFeeds/normalize";
import { toPublic } from "@/lib/jobFeeds/sync";
import { fromOwnSite, isHumanUa, visitorIp } from "@/lib/jobFeeds/visitor";

// GET /api/jobs/web-search?market=US|AU&state=&city=&page=  — nút "Tìm thêm việc nail trên web" (Careerjet).
//   Tìm TRỰC TIẾP cho đúng người bấm: Careerjet yêu cầu IP + trình duyệt của người xem (đã ghi trong Chính
//   sách quyền riêng tư). KHÔNG lưu DB, không cache chung, không cron. Giới hạn 10 lượt / phút / IP.
//   Chỉ gọi Careerjet cho người xem THẬT trên chính trang PawNail (lib/jobFeeds/visitor): IP công cộng từ header
//   Vercel, trình duyệt không phải bot / script, Sec-Fetch-Site same-origin — còn lại 403, không tốn lượt Careerjet.
//   Bỏ kết quả trùng tin đang hiện trên PawNail (tin tiệm / đăng hộ / tin Adzuna cùng tiệm, cùng nơi).
export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!careerjetEnabled()) return NextResponse.json({ enabled: false, items: [], total: 0 }, { headers });
  const ip = visitorIp(req);
  const ua = req.headers.get("user-agent") || "";
  if (!ip || !isHumanUa(ua) || !fromOwnSite(req)) return NextResponse.json({ enabled: true, error: "not_allowed", items: [], total: 0 }, { status: 403, headers });
  const rk = `jobs-web-search:${ip}`;
  if (isRateLimited(rk, 10, 60_000)) return NextResponse.json({ enabled: true, error: "rate_limited", items: [], total: 0 }, { status: 429, headers });
  recordAttempt(rk, 60_000);

  const sp = req.nextUrl.searchParams;
  const market = sp.get("market") === "AU" ? "AU" : "US";
  const state = (sp.get("state") || "").trim().toUpperCase().slice(0, 3) || null;
  const city = (sp.get("city") || "").trim().slice(0, 60) || null;
  const r = await searchCareerjet({ market, state, city, page: Number(sp.get("page")) || 1, userIp: ip, userAgent: ua });
  if (r.status !== "ok") return NextResponse.json({ enabled: true, error: r.status, items: [], total: 0 }, { status: r.status === "rate_limited" ? 429 : 502, headers });
  if (!r.jobs.length) return NextResponse.json({ enabled: true, items: [], total: 0, ambiguous: !!r.ambiguous }, { headers });

  // Chống trùng (4c): cùng dedupeKey với tin Adzuna đang hiện (chỉ khi Adzuna đang hiện công khai), hoặc cùng tiệm +
  // cùng nơi với tin tiệm tự đăng / đăng hộ trên PawNail (tin tổng hợp từ nhóm không được che tin có ghi nguồn).
  const keys = r.jobs.map((j) => j.dedupeKey);
  const states = [...new Set(r.jobs.map((j) => j.state).filter((s): s is string => !!s))];
  const [adz, jobs] = await Promise.all([
    adzunaPublic()
      ? prisma.externalJob.findMany({ where: { provider: "adzuna", dedupeKey: { in: keys }, expiresAt: { gt: new Date() }, hiddenReason: null }, select: { dedupeKey: true } }).catch(() => [] as { dedupeKey: string }[])
      : Promise.resolve([] as { dedupeKey: string }[]),
    states.length
      ? prisma.job.findMany({ where: { AND: [activeJobWhere(), { owner: realOnly() }, { market }, { state: { in: states } }, { OR: [{ source: null }, { source: { not: INGEST_SOURCE } }] }] }, select: { salonName: true, city: true, state: true }, take: 500 }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const shown = new Set(adz.map((a) => a.dedupeKey));
  const items = r.jobs
    .filter((j) => !shown.has(j.dedupeKey))
    .filter((j) => !jobs.some((p) => !!j.state && p.state === j.state && sameCity(p.city, j.city) && companyMatch(p.salonName, j.company)))
    .map((j) => toPublic({ ...j, id: `cj_${j.providerJobId}` }, market));
  // total = số tin TRẢ VỀ sau khi bỏ trùng (không phải tổng của Careerjet, vốn tính cả tin trùng)
  return NextResponse.json({ enabled: true, items, total: items.length }, { headers });
}
