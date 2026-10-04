import prisma from "@/lib/prisma";
import { stateName } from "@/lib/stateNames";
import { weeklyPay } from "@/lib/trends";
import { PAIN_TAG_META } from "@/lib/ownerSurvey";
import { previousWeekKey, weekKey, PULSE_QUESTIONS } from "@/lib/painPulse";
import { pulseResult, type PulseResult } from "@/lib/pulseResults";
import type { Market } from "@prisma/client";

// "Radar xu hướng & nỗi đau" — tín hiệu tự động, tính từ dữ liệu THẬT của app:
//   • hashtag tăng tốc (7 ngày này so với 7 ngày trước)
//   • kỹ năng đang thiếu thợ theo bang (số tin cần kỹ năng ↔ số thợ rảnh có kỹ năng đó)
//   • lương tuần tăng/giảm theo bang (30 ngày gần nhất ↔ 30 ngày trước đó)
//   • tiêu chí bị chấm thấp trong đánh giá 2 chiều (nỗi đau thợ ↔ tiệm)
//   • nỗi đau chủ tiệm tự khai lúc đăng ký (khảo sát 5 câu)
//   • kết quả "Nhịp đau tuần"
// Mỗi tín hiệu có ngưỡng tối thiểu — mẫu quá nhỏ thì bỏ, không thổi phồng.

const DAY = 86_400_000;
const CACHE_MS = 10 * 60 * 1000;

export interface Signals {
  market: Market;
  generatedAt: string;
  risingTags: { tag: string; now: number; before: number }[];
  skillGaps: { state: string; label: string; skill: string; jobs: number; techs: number }[];
  salaryMoves: { state: string; label: string; before: number; now: number; changePct: number; samples: number }[];
  reviewPains: { criterion: string; avg: number; count: number; side: "salon" | "tech" }[];
  ownerPains: { tag: string; label: string; count: number; pct: number }[];
  pulse: PulseResult[]; // tuần trước (đã chốt) + tuần này (đang chạy)
}

const SKILLS: { key: string; label: string; re: RegExp }[] = [
  { key: "gelx", label: "Gel-X", re: /gel-?x/i },
  { key: "dip", label: "Dip/SNS", re: /dip|sns/i },
  { key: "acrylic", label: "Bột/Acrylic", re: /bột|acrylic/i },
  { key: "art", label: "Design", re: /design|vẽ/i },
  { key: "pedi", label: "Chân tay nước", re: /chân tay nước|pedi/i },
  { key: "wax", label: "Wax", re: /wax/i },
];

const REVIEW_CRITERIA: { key: "punctualityOrPay" | "environment" | "turnFairness" | "skillAccuracy" | "workEthic" | "customerAttitude"; label: string; side: "salon" | "tech" }[] = [
  { key: "punctualityOrPay", label: "Sòng phẳng lương / giờ giấc", side: "salon" },
  { key: "environment", label: "Môi trường làm việc", side: "salon" },
  { key: "turnFairness", label: "Công bằng chia turn", side: "salon" },
  { key: "skillAccuracy", label: "Tay nghề đúng quảng cáo", side: "tech" },
  { key: "workEthic", label: "Chăm chỉ, đúng giờ", side: "tech" },
  { key: "customerAttitude", label: "Thái độ với khách", side: "tech" },
];

const cache = new Map<string, { at: number; data: Signals }>();
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// fresh=true: Phòng nội dung của admin luôn xem số liệu mới nhất (bảng tin công khai dùng cache).
export async function getSignals(market: Market, { fresh = false }: { fresh?: boolean } = {}): Promise<Signals> {
  const hit = cache.get(market);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const now = Date.now();

  const [posts, jobs14, techs, jobs60, reviews, owners] = await Promise.all([
    prisma.post.findMany({ where: { createdAt: { gte: new Date(now - 14 * DAY) } }, select: { content: true, createdAt: true }, take: 3000 }),
    prisma.job.findMany({ where: { market, createdAt: { gte: new Date(now - 14 * DAY) } }, select: { state: true, skills: true }, take: 3000 }),
    prisma.technicianProfile.findMany({ where: { market, status: { in: ["AVAILABLE", "URGENT"] } }, select: { state: true, specialties: true }, take: 5000 }),
    prisma.job.findMany({ where: { market, createdAt: { gte: new Date(now - 60 * DAY) } }, select: { state: true, salaryAmount: true, salaryType: true, createdAt: true }, take: 5000 }),
    prisma.review.findMany({ where: { createdAt: { gte: new Date(now - 90 * DAY) } }, select: { punctualityOrPay: true, environment: true, turnFairness: true, skillAccuracy: true, workEthic: true, customerAttitude: true }, take: 5000 }),
    prisma.user.findMany({ where: { role: "OWNER", market, diagnosedPains: { not: null } }, select: { diagnosedPains: true }, take: 5000 }),
  ]);

  // ---- Hashtag tăng tốc ----
  const tagNow = new Map<string, { tag: string; n: number }>();
  const tagBefore = new Map<string, number>();
  for (const p of posts) {
    const recent = p.createdAt.getTime() >= now - 7 * DAY;
    const seen = new Set<string>();
    for (const m of p.content.matchAll(/#([\p{L}\p{N}_]{2,30})/gu)) {
      const k = m[1].toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      if (recent) tagNow.set(k, { tag: m[1], n: (tagNow.get(k)?.n ?? 0) + 1 });
      else tagBefore.set(k, (tagBefore.get(k) ?? 0) + 1);
    }
  }
  const risingTags = [...tagNow.entries()]
    .map(([k, v]) => ({ tag: v.tag, now: v.n, before: tagBefore.get(k) ?? 0 }))
    .filter((t) => t.now >= 2 && t.now > t.before)
    .sort((a, b) => b.now - b.before - (a.now - a.before))
    .slice(0, 8);

  // ---- Kỹ năng thiếu thợ theo bang ----
  const demand = new Map<string, number>();
  const supply = new Map<string, number>();
  for (const j of jobs14) for (const s of SKILLS) if (s.re.test(j.skills)) demand.set(`${j.state}|${s.key}`, (demand.get(`${j.state}|${s.key}`) ?? 0) + 1);
  for (const t of techs) for (const s of SKILLS) if (s.re.test(t.specialties)) supply.set(`${t.state}|${s.key}`, (supply.get(`${t.state}|${s.key}`) ?? 0) + 1);
  const skillGaps = [...demand.entries()]
    .map(([k, jobs]) => {
      const [state, key] = k.split("|");
      return { state, label: stateName(market, state) || state, skill: SKILLS.find((s) => s.key === key)!.label, jobs, techs: supply.get(k) ?? 0 };
    })
    .filter((g) => g.jobs >= 2 && g.jobs > g.techs)
    .sort((a, b) => b.jobs - b.techs - (a.jobs - a.techs))
    .slice(0, 8);

  // ---- Lương tuần tăng/giảm ----
  const pay = new Map<string, { now: number[]; before: number[] }>();
  for (const j of jobs60) {
    const w = weeklyPay(j.salaryAmount, j.salaryType);
    if (w === null) continue;
    const b = pay.get(j.state) || { now: [], before: [] };
    (j.createdAt.getTime() >= now - 30 * DAY ? b.now : b.before).push(w);
    pay.set(j.state, b);
  }
  const salaryMoves = [...pay.entries()]
    .filter(([, v]) => v.now.length >= 3 && v.before.length >= 3)
    .map(([state, v]) => {
      const a = median(v.before), b = median(v.now);
      return { state, label: stateName(market, state) || state, before: Math.round(a / 50) * 50, now: Math.round(b / 50) * 50, changePct: Math.round(((b - a) / a) * 100), samples: v.now.length + v.before.length };
    })
    .filter((m) => Math.abs(m.changePct) >= 3)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  // ---- Tiêu chí bị chấm thấp ----
  const reviewPains = REVIEW_CRITERIA.map((c) => {
    const vals = reviews.map((r) => r[c.key]).filter((v): v is number => typeof v === "number");
    return { criterion: c.label, side: c.side, count: vals.length, avg: vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : 0 };
  })
    .filter((r) => r.count >= 3 && r.avg <= 3.8)
    .sort((a, b) => a.avg - b.avg);

  // ---- Nỗi đau chủ tiệm (khảo sát lúc đăng ký) ----
  const painCount = new Map<string, number>();
  for (const o of owners) for (const t of (o.diagnosedPains || "").split(",").filter(Boolean)) painCount.set(t, (painCount.get(t) ?? 0) + 1);
  const ownerPains = [...painCount.entries()]
    .filter(([tag]) => PAIN_TAG_META[tag])
    .map(([tag, count]) => ({ tag, label: PAIN_TAG_META[tag].label, count, pct: owners.length ? Math.round((count / owners.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // ---- Nhịp đau tuần ----
  const wNow = weekKey(), wPrev = previousWeekKey();
  const pulse: PulseResult[] = [];
  for (const role of ["TECHNICIAN", "OWNER"] as const) {
    for (const w of [wPrev, wNow]) {
      const n = Number(w.split("-W")[1]) || 0;
      const q = PULSE_QUESTIONS[role][n % PULSE_QUESTIONS[role].length];
      const r = await pulseResult(q.id, w, { market });
      if (r && r.total > 0) pulse.push(r);
    }
  }

  const data: Signals = { market, generatedAt: new Date().toISOString(), risingTags, skillGaps, salaryMoves, reviewPains, ownerPains, pulse };
  cache.set(market, { at: Date.now(), data });
  return data;
}
