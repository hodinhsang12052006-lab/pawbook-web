// EMAIL TÓM TẮT HẰNG TUẦN — lý do để người dùng quay lại, chỉ gửi khi CÓ điều mới.
//   Thợ:     việc mới trong bang 7 ngày · lương tuần trung bình bang · tiệm đã xem hồ sơ · mẫu nail mới
//   Chủ tiệm: thợ đang rảnh trong bang · lượt xem / liên hệ tin tuyển của mình trong tuần
// Mọi số đều là số đếm thật. Có link hủy nhận (ký HMAC) + header List-Unsubscribe.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { weeklyPay } from "@/lib/trends";
import { stateName } from "@/lib/stateNames";
import { SITE_URL } from "@/lib/siteUrl";

const DAY = 86_400_000;
const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (n: number, market: string) => `${market === "AU" ? "A$" : "$"}${Math.round(n).toLocaleString("en-US")}`;

// Production luôn có NEXTAUTH_SECRET; thiếu thì dùng khoá ngẫu nhiên (link hủy cũ hết hiệu lực, không đoán được).
const SECRET = process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === "production" ? crypto.randomBytes(32).toString("hex") : "dev-secret");
const secret = () => SECRET;
export const unsubSig = (userId: string) => crypto.createHmac("sha256", secret()).update(`unsub:${userId}`).digest("base64url").slice(0, 32);
export const unsubUrl = (userId: string) => `${SITE_URL}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&s=${unsubSig(userId)}`;
export function verifyUnsub(userId: string, sig: string) {
  const a = Buffer.from(unsubSig(userId));
  const b = Buffer.from(String(sig || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface DigestUser { id: string; name: string; email: string; role: string; market: "US" | "AU"; state: string | null; city: string | null }
export interface Digest { subject: string; html: string; text: string }

function shell(title: string, intro: string, blocks: string, cta: { label: string; href: string }, userId: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b0b14;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121f;border-radius:16px;border:1px solid #2a2a40;padding:26px">
<tr><td style="font-size:13px;font-weight:800;letter-spacing:.08em;color:#f472b6">PAWNAIL JOBS · TUẦN NÀY</td></tr>
<tr><td style="padding-top:8px;font-size:22px;font-weight:800;color:#fff">${esc(title)}</td></tr>
<tr><td style="padding-top:8px;font-size:14px;line-height:1.6;color:#cbd5e1">${intro}</td></tr>
${blocks}
<tr><td style="padding:22px 0 6px" align="center"><a href="${esc(cta.href)}" style="display:inline-block;background:#db2777;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:12px">${esc(cta.label)}</a></td></tr>
<tr><td style="padding-top:18px;font-size:11px;line-height:1.6;color:#64748b">Bạn nhận email này vì có tài khoản PawNail Jobs. <a href="${esc(unsubUrl(userId))}" style="color:#94a3b8">Hủy nhận email tóm tắt</a> · <a href="${SITE_URL}/privacy" style="color:#94a3b8">Bảo mật</a></td></tr>
</table></td></tr></table></body></html>`;
}
const section = (title: string, rows: string) => `<tr><td style="padding-top:18px"><div style="font-size:13px;font-weight:800;color:#f9a8d4;text-transform:uppercase;letter-spacing:.05em">${esc(title)}</div>${rows}</td></tr>`;
const row = (main: string, sub: string, href: string) =>
  `<a href="${esc(href)}" style="display:block;margin-top:8px;padding:11px 13px;background:#1a1a2e;border-radius:10px;text-decoration:none"><span style="display:block;font-size:14px;font-weight:700;color:#f1f5f9">${esc(main)}</span><span style="display:block;margin-top:2px;font-size:12px;color:#94a3b8">${esc(sub)}</span></a>`;
const stat = (big: string, label: string) => `<tr><td style="padding-top:14px"><span style="font-size:26px;font-weight:800;color:#34d399">${esc(big)}</span> <span style="font-size:13px;color:#cbd5e1">${esc(label)}</span></td></tr>`;

/** Bản tóm tắt cho 1 người; null = tuần này không có gì đáng gửi (không làm phiền). */
export async function buildDigest(u: DigestUser, now = new Date()): Promise<Digest | null> {
  const since = new Date(now.getTime() - 7 * DAY);
  // Tên đầy đủ: người dùng ghi cả "Lan Nguyen" lẫn "Nguyễn Lan" — đoán tên riêng dễ sai.
  const first = (u.name || "").trim() || "bạn";
  const where = u.state ? stateName(u.market, u.state) : u.market === "AU" ? "Úc" : "Mỹ";

  if (u.role === "TECHNICIAN") {
    const [jobs, views, designs] = await Promise.all([
      prisma.job.findMany({
        where: { market: u.market, ...(u.state ? { state: u.state } : {}), createdAt: { gte: since } },
        orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: { id: true, title: true, salonName: true, city: true, salaryAmount: true, salaryType: true },
      }),
      prisma.profileView.count({ where: { profileId: u.id, createdAt: { gte: since }, viewer: { role: "OWNER" } } }).catch(() => 0),
      prisma.nailDesign.count({ where: { status: "published", publishedAt: { gte: since } } }).catch(() => 0),
    ]);
    if (!jobs.length && !views) return null;
    const pays = jobs.map((j) => weeklyPay(j.salaryAmount || "", j.salaryType || "")).filter((x): x is number => !!x).sort((a, b) => a - b);
    const median = pays.length >= 3 ? pays[Math.floor(pays.length / 2)] : null;
    const blocks = [
      views ? stat(String(views), `lượt chủ tiệm đã xem hồ sơ bạn tuần này`) : "",
      jobs.length ? section(`${jobs.length} việc mới tại ${where}`, jobs.slice(0, 5).map((j) => row(j.title, `${j.salonName} · ${j.city}${j.salaryAmount ? ` · ${j.salaryAmount}` : ""}`, `${SITE_URL}/jobs/${j.id}`)).join("")) : "",
      median ? stat(money(median, u.market), `lương tuần trung bình của tin mới ở ${where}`) : "",
      designs ? section("Mẫu nail mới", row(`${designs} mẫu mới tuần này`, "Có sẵn vật tư, các bước làm và giá gợi ý", `${SITE_URL}/designs`)) : "",
    ].join("");
    const subject = jobs.length ? `${jobs.length} việc nail mới tại ${where} tuần này${views ? ` · ${views} tiệm đã xem hồ sơ bạn` : ""}` : `${views} tiệm đã xem hồ sơ bạn tuần này`;
    const intro = `Chào ${esc(first)}, đây là những gì mới trên PawNail tuần qua — số liệu thật từ ${esc(where)}.`;
    const text = [`Chào ${first},`, ...jobs.slice(0, 5).map((j) => `• ${j.title} — ${j.salonName}, ${j.city} ${j.salaryAmount ?? ""}: ${SITE_URL}/jobs/${j.id}`), views ? `${views} lượt chủ tiệm xem hồ sơ bạn.` : "", `Mở PawNail: ${SITE_URL}/?tab=jobs`, `Hủy nhận: ${unsubUrl(u.id)}`].filter(Boolean).join("\n");
    return { subject, html: shell(jobs.length ? `${jobs.length} việc mới gần bạn` : "Tiệm đang để ý bạn", intro, blocks, { label: "Xem việc mới", href: `${SITE_URL}/?tab=jobs` }, u.id), text };
  }

  if (u.role === "OWNER") {
    const [techs, myJobs] = await Promise.all([
      prisma.technicianProfile.findMany({
        where: { status: { in: ["AVAILABLE", "URGENT"] }, user: { market: u.market, ...(u.state ? { state: u.state } : {}) } },
        orderBy: { user: { createdAt: "desc" } },
        take: 5,
        select: { yearsOfExperience: true, specialties: true, user: { select: { id: true, name: true, city: true } } },
      }),
      prisma.job.findMany({ where: { ownerId: u.id }, select: { id: true } }),
    ]);
    const day0 = since.toISOString().slice(0, 10);
    const daily = myJobs.length
      ? await prisma.jobDaily.aggregate({ where: { jobId: { in: myJobs.map((j) => j.id) }, day: { gte: day0 } }, _sum: { views: true, contacts: true } }).catch(() => null)
      : null;
    const views = daily?._sum.views ?? 0;
    const contacts = daily?._sum.contacts ?? 0;
    if (!techs.length && !views) return null;
    const blocks = [
      views ? stat(String(views), `lượt xem tin tuyển của bạn tuần này${contacts ? ` · ${contacts} lượt bấm gọi/nhắn` : ""}`) : "",
      techs.length ? section(`Thợ đang rảnh tại ${where}`, techs.map((t) => row(t.user.name, `${t.specialties?.split(",").slice(0, 2).join(", ") || "Thợ nail"} · ${t.yearsOfExperience ? `${t.yearsOfExperience} năm KN` : "Thợ mới"}${t.user.city ? ` · ${t.user.city}` : ""}`, `${SITE_URL}/profile/${t.user.id}`)).join("")) : "",
      !myJobs.length ? section("Mẹo", row("Đăng tin tuyển miễn phí", "Thợ gần tiệm nhận báo ngay khi bạn đăng", `${SITE_URL}/jobs/create`)) : "",
    ].join("");
    const subject = techs.length ? `${techs.length} thợ đang rảnh tại ${where} tuần này${views ? ` · tin của bạn có ${views} lượt xem` : ""}` : `Tin tuyển của bạn có ${views} lượt xem tuần này`;
    const intro = `Chào ${esc(first)}, đây là tình hình tuyển thợ quanh tiệm bạn tuần qua — số liệu thật.`;
    const text = [`Chào ${first},`, ...techs.map((t) => `• ${t.user.name}: ${SITE_URL}/profile/${t.user.id}`), views ? `Tin của bạn: ${views} lượt xem, ${contacts} lượt liên hệ.` : "", `Mở PawNail: ${SITE_URL}/?tab=portfolio`, `Hủy nhận: ${unsubUrl(u.id)}`].filter(Boolean).join("\n");
    return { subject, html: shell(techs.length ? "Thợ đang rảnh gần tiệm bạn" : "Tin tuyển của bạn tuần này", intro, blocks, { label: "Xem thợ đang rảnh", href: `${SITE_URL}/?tab=portfolio` }, u.id), text };
  }
  return null;
}
