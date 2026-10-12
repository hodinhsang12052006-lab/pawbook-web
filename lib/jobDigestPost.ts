// "📍 Texas: 5 tiệm đang cần thợ tuần này" — mỗi ngày 1 bài từ tài khoản chính thức, lấy từ tin
// tuyển THẬT đang mở (kể cả tin tool đăng hộ tiệm). Xoay vòng các bang có ≥ 2 tin mới trong 7 ngày,
// bang đã điểm tin trong 5 ngày gần nhất để sau. Chỉ dùng thông tin vốn công khai trên bảng việc
// (tên tiệm, thành phố, kỹ năng, lương) — không đưa số điện thoại vào bài.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { activeJobWhere } from "@/lib/jobIngest/ingest";
import { stateName } from "@/lib/stateNames";
import { SITE_URL } from "@/lib/siteUrl";

export const DIGEST_PREFIX = "📍 ";
const KEY = "job_digest_last";
const DAY = 86_400_000;

export async function publishJobDigest(now = new Date()): Promise<{ posted: boolean; state?: string; reason?: string }> {
  const officialId = process.env.OFFICIAL_ACCOUNT_ID;
  if (!officialId || process.env.OFFICIAL_DAILY_POST === "0") return { posted: false, reason: "tắt" };
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (await prisma.post.count({ where: { authorId: officialId, createdAt: { gte: dayStart }, content: { startsWith: DIGEST_PREFIX } } })) return { posted: false, reason: "hôm nay đã có" };

  const jobs = await prisma.job.findMany({
    where: { AND: [activeJobWhere(), { createdAt: { gte: new Date(now.getTime() - 7 * DAY) } }] },
    orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
    select: { market: true, state: true, city: true, salonName: true, skills: true, salaryAmount: true, isUrgent: true },
    take: 500,
  });
  const groups = new Map<string, typeof jobs>();
  for (const j of jobs) {
    if (!j.state) continue;
    const k = `${j.market}:${j.state}`;
    groups.set(k, [...(groups.get(k) ?? []), j]);
  }
  let last: Record<string, number> = {};
  try { last = JSON.parse((await getSetting(KEY)) || "{}"); } catch {}
  const cands = [...groups.entries()].filter(([, g]) => g.length >= 2);
  if (!cands.length) return { posted: false, reason: "chưa bang nào đủ 2 tin mới" };
  // Bang chưa điểm tin lâu nhất trước, cùng mức thì bang nhiều tin hơn trước.
  cands.sort(([a, ga], [b, gb]) => {
    const ra = now.getTime() - (last[a] ?? 0) > 5 * DAY ? 1 : 0;
    const rb = now.getTime() - (last[b] ?? 0) > 5 * DAY ? 1 : 0;
    return rb - ra || gb.length - ga.length || (last[a] ?? 0) - (last[b] ?? 0);
  });
  const [key, list] = cands[0];
  const [market, state] = key.split(":") as ["US" | "AU", string];
  const name = stateName(market, state);
  const urgent = list.filter((j) => j.isUrgent).length;

  const lines = list.slice(0, 5).map((j) => {
    const skills = (j.skills || "").split(",").filter(Boolean).slice(0, 2).join(", ");
    return `• ${j.salonName}${j.city ? ` — ${j.city}` : ""}${skills ? `: cần ${skills}` : ""} · ${j.salaryAmount}${j.isUrgent ? " · 🔥 gấp" : ""}`;
  });
  const content = [
    `${DIGEST_PREFIX}${name}: ${list.length} tiệm đang cần thợ tuần này${urgent ? ` (${urgent} tin gấp)` : ""}`,
    "",
    ...lines,
    ...(list.length > 5 ? [`• …và ${list.length - 5} tiệm khác`] : []),
    "",
    `👉 Gọi thẳng cho tiệm, không qua trung gian: ${SITE_URL}/?tab=jobs`,
    "🔔 Bật thông báo việc gấp để không lỡ tiệm gần bạn.",
    "",
    `#ViecLamNail #ThoNail #${name.replace(/\s+/g, "")}`,
  ].join("\n");
  await prisma.post.create({
    data: { id: "c" + crypto.randomBytes(12).toString("hex"), authorId: officialId, content, postType: "GENERAL", mediaUrls: "[]", market, state, createdAt: now },
  });
  last[key] = now.getTime();
  await setSetting(KEY, JSON.stringify(last));
  return { posted: true, state: key };
}
