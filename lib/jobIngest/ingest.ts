// NHẬN TIN TỔNG HỢP từ tool lọc nhóm → tin tuyển trên PawNail.
//   - Tách SĐT / tên tiệm / địa chỉ / bang / lương… (parse.ts); trường tool đã tách sẵn được ưu tiên.
//   - Chống trùng: cùng SĐT + nội dung (sourceKey) hoặc cùng SĐT còn hạn → CẬP NHẬT tin cũ.
//   - Tự hết hạn sau INGEST_TTL_DAYS (mặc định 14) kể từ ngày bài gốc đăng.
//   - Số đã yêu cầu "Gỡ tin" (admin duyệt) → không bao giờ đăng lại.
// Tất cả tin đứng tên 1 tài khoản hệ thống "PawNail · Tin tổng hợp" (KHÔNG tạo tài khoản mạo danh từng tiệm).
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { OAUTH_PASSWORD_PREFIX } from "@/lib/oauthUsers";
import { getSetting, setSetting } from "@/lib/settings";
import { findPhone, parseJobPost, type ParsedJob } from "@/lib/jobIngest/parse";

export const INGEST_SOURCE = "ingest";
export const INGEST_OWNER_EMAIL = "tonghop@feed.pawnail.invalid";
const DAY = 86_400_000;
export const ingestTtlDays = () => Math.min(60, Math.max(3, Number(process.env.INGEST_TTL_DAYS) || 14));

/** Điều kiện Prisma: tin còn hạn (tin chủ tiệm tự đăng không có hạn). */
export const activeJobWhere = () => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

export interface IngestInput {
  text?: string; // nguyên văn bài
  sourceUrl?: string;
  postedAt?: string | number; // ISO / ms — ngày bài gốc đăng
  // Trường tool đã tách sẵn (nếu có) — ưu tiên hơn kết quả tự tách
  phone?: string; salonName?: string; address?: string; city?: string; state?: string; zip?: string; market?: "US" | "AU"; salary?: string;
}
export type IngestResult = { status: "created" | "updated" | "skipped"; reason?: string; jobId?: string };

let ownerCache: string | null = null;
async function ingestOwnerId() {
  if (ownerCache) return ownerCache;
  const u = await prisma.user.upsert({
    where: { email: INGEST_OWNER_EMAIL },
    update: {},
    create: { email: INGEST_OWNER_EMAIL, name: "PawNail · Tin tổng hợp", role: "OWNER", password: OAUTH_PASSWORD_PREFIX + crypto.randomBytes(24).toString("hex"), market: "US", state: "CA", city: "—", emailDigest: false },
    select: { id: true },
  });
  ownerCache = u.id;
  return u.id;
}

const blockedKey = "ingest_blocked_phones";
export async function blockedPhones(): Promise<Set<string>> {
  try { return new Set(JSON.parse((await getSetting(blockedKey)) || "[]")); } catch { return new Set(); }
}
export async function blockPhone(e164: string) {
  const s = await blockedPhones();
  s.add(e164);
  await setSetting(blockedKey, JSON.stringify([...s].slice(-20000)));
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 300);
const clean = (s?: string, n = 80) => (typeof s === "string" ? s.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n) : "");

export async function ingestOne(input: IngestInput, blocked: Set<string>): Promise<IngestResult> {
  const text = clean(input.text, 4000) ? String(input.text).replace(/[<>]/g, "").slice(0, 4000) : "";
  const p: ParsedJob = parseJobPost(text);
  // Ưu tiên trường tool đã tách
  const ph = input.phone ? findPhone(String(input.phone)) ?? findPhone(String(input.phone).replace(/^\+?1?/, "")) : null;
  const phone = ph?.e164 ?? p.phone;
  const phoneDisplay = ph?.display ?? p.phoneDisplay;
  const market = (input.market === "AU" || input.market === "US" ? input.market : null) ?? ph?.market ?? p.market;
  const state = clean(input.state, 3).toUpperCase() || p.state;
  const city = clean(input.city, 60) || p.city || "";
  const salonName = clean(input.salonName, 60) || p.salonName;

  if (text && !p.isHiring && !input.salonName) return { status: "skipped", reason: "không phải bài tuyển thợ" };
  if (!phone || !phoneDisplay) return { status: "skipped", reason: "không có SĐT Mỹ/Úc" };
  if (!market || !state) return { status: "skipped", reason: "không xác định được bang" };
  if (blocked.has(phone)) return { status: "skipped", reason: "tiệm đã yêu cầu gỡ tin" };

  const postedMs = input.postedAt ? new Date(typeof input.postedAt === "number" ? input.postedAt : String(input.postedAt)).getTime() : Date.now();
  const posted = Number.isFinite(postedMs) ? new Date(Math.min(postedMs, Date.now())) : new Date();
  const expiresAt = new Date(posted.getTime() + ingestTtlDays() * DAY);
  if (expiresAt.getTime() <= Date.now()) return { status: "skipped", reason: `bài cũ hơn ${ingestTtlDays()} ngày` };

  const sourceKey = crypto.createHash("sha1").update(`${phone}|${norm(text || `${salonName}|${city}`)}`).digest("hex");
  const salary = clean(input.salary, 40);
  const data = {
    title: p.title,
    salonName: salonName || `Tiệm nail ${city || state}`,
    description: text || [salonName, input.address, salary].filter(Boolean).join(" · "),
    market, state, city,
    salaryType: p.salaryType,
    salaryAmount: salary || p.salaryAmount,
    skills: p.skills.join(","),
    benefits: p.benefits.join(","),
    phone: phoneDisplay,
    isUrgent: p.isUrgent,
    source: INGEST_SOURCE,
    sourceUrl: clean(input.sourceUrl, 300) || null,
    sourceKey,
    sourcePostedAt: posted,
    expiresAt,
    address: clean(input.address, 160) || p.address,
    zip: clean(input.zip, 10) || p.zip,
  };

  // Trùng: cùng khoá, hoặc cùng SĐT (đã chuẩn hoá) còn hạn → làm mới tin cũ
  const same = await prisma.job.findFirst({
    where: { source: INGEST_SOURCE, OR: [{ sourceKey }, { phone: phoneDisplay, expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, sourcePostedAt: true },
  });
  if (same) {
    const newer = !same.sourcePostedAt || posted >= same.sourcePostedAt;
    await prisma.job.update({ where: { id: same.id }, data: newer ? { ...data, createdAt: posted } : { expiresAt: data.expiresAt } });
    return { status: "updated", jobId: same.id };
  }
  const job = await prisma.job.create({ data: { ...data, ownerId: await ingestOwnerId(), createdAt: posted }, select: { id: true } });
  return { status: "created", jobId: job.id };
}

export async function ingestBatch(items: IngestInput[]) {
  const blocked = await blockedPhones();
  const results: (IngestResult & { i: number })[] = [];
  for (const [i, it] of items.entries()) {
    try { results.push({ i, ...(await ingestOne(it, blocked)) }); }
    catch (e) { results.push({ i, status: "skipped", reason: `lỗi: ${String((e as Error).message).slice(0, 80)}` }); }
  }
  const count = (s: string) => results.filter((r) => r.status === s).length;
  return { created: count("created"), updated: count("updated"), skipped: count("skipped"), results };
}
