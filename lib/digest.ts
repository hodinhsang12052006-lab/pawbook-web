// EMAIL CẬP NHẬT HẰNG TUẦN — lý do để người dùng quay lại, chỉ gửi khi CÓ điều mới. Viết theo ngôn ngữ
// của người nhận (lib/userLocale.ts, mặc định tiếng Anh).
//   Thợ:     việc mới trong bang 7 ngày · lương tuần trung bình bang · tiệm đã xem hồ sơ · mẫu nail mới
//   Chủ tiệm: thợ đang rảnh trong bang · lượt xem / liên hệ tin tuyển của mình trong tuần
// Mọi số đều là số đếm thật. Có link hủy nhận (ký HMAC) + header List-Unsubscribe.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { activeJobWhere } from "@/lib/jobIngest/ingest";
import { weeklyPay } from "@/lib/trends";
import { stateName } from "@/lib/stateNames";
import { SITE_URL } from "@/lib/siteUrl";
import { realUserWhere } from "@/lib/demo";
import { dtEn } from "@/lib/i18n/dtEn";
import { localePath, type Locale } from "@/lib/i18n/config";
import { EMAIL_COLORS as C, emailBrandRow } from "@/lib/email";

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

export interface DigestUser { id: string; name: string; email: string; role: string; market: "US" | "AU"; state: string | null; city: string | null; locale?: Locale }
export interface Digest { subject: string; html: string; text: string }

function shell(locale: Locale, title: string, intro: string, blocks: string, cta: { label: string; href: string }, userId: string) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:${C.page};font-family:Arial,Helvetica,sans-serif;color:${C.body}">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border-radius:16px;border:1px solid ${C.line};padding:26px">
<tr><td>${emailBrandRow(L("Cập nhật tuần", "Weekly update"))}</td></tr>
<tr><td style="padding-top:16px;font-size:22px;font-weight:700;color:${C.text}">${esc(title)}</td></tr>
<tr><td style="padding-top:8px;font-size:14px;line-height:1.6;color:#cbd5e1">${intro}</td></tr>
${blocks}
<tr><td style="padding:22px 0 6px" align="center"><a href="${esc(cta.href)}" style="display:inline-block;background:#db2777;color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:12px">${esc(cta.label)}</a></td></tr>
<tr><td style="padding-top:18px;font-size:11px;line-height:1.6;color:#64748b">${L("Bạn nhận email này vì có tài khoản PawNail.", "You're receiving this because you have a PawNail account.")} <a href="${esc(unsubUrl(userId))}" style="color:#94a3b8">${L("Hủy nhận email cập nhật tuần", "Unsubscribe from weekly updates")}</a> · <a href="${SITE_URL}${localePath("/privacy", locale)}" style="color:#94a3b8">${L("Bảo mật", "Privacy")}</a></td></tr>
</table></td></tr></table></body></html>`;
}
const section = (title: string, rows: string) => `<tr><td style="padding-top:18px"><div style="font-size:13px;font-weight:800;color:#f9a8d4;letter-spacing:.02em">${esc(title)}</div>${rows}</td></tr>`;
const row = (main: string, sub: string, href: string) =>
  `<a href="${esc(href)}" style="display:block;margin-top:8px;padding:11px 13px;background:#1a1a2e;border-radius:10px;text-decoration:none"><span style="display:block;font-size:14px;font-weight:700;color:#f1f5f9">${esc(main)}</span><span style="display:block;margin-top:2px;font-size:12px;color:#94a3b8">${esc(sub)}</span></a>`;
const stat = (big: string, label: string) => `<tr><td style="padding-top:14px"><span style="font-size:26px;font-weight:800;color:#34d399">${esc(big)}</span> <span style="font-size:13px;color:#cbd5e1">${esc(label)}</span></td></tr>`;

/** Bản tóm tắt cho 1 người, theo ngôn ngữ của họ (mặc định tiếng Anh); null = tuần này không có gì đáng gửi. */
export async function buildDigest(u: DigestUser, now = new Date()): Promise<Digest | null> {
  const locale: Locale = u.locale === "vi" ? "vi" : "en";
  const en = locale === "en";
  const L = (vi: string, e: string) => (en ? e : vi);
  const T = (s: string | null | undefined) => (s ? (en ? dtEn(s) : s) : "");
  const url = (path: string) => `${SITE_URL}${localePath(path, locale)}`;
  const since = new Date(now.getTime() - 7 * DAY);
  // Tên đầy đủ: người dùng ghi cả "Lan Nguyen" lẫn "Nguyễn Lan" — đoán tên riêng dễ sai.
  const first = (u.name || "").trim() || L("bạn", "there");
  const where = u.state ? stateName(u.market, u.state) : u.market === "AU" ? L("Úc", "Australia") : L("Mỹ", "the US");

  if (u.role === "TECHNICIAN") {
    const [jobs, views, designs] = await Promise.all([
      prisma.job.findMany({
        where: { market: u.market, ...(u.state ? { state: u.state } : {}), createdAt: { gte: since }, owner: realUserWhere, ...activeJobWhere() }, // không giới thiệu tin mẫu / tin hết hạn
        orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: { id: true, title: true, salonName: true, city: true, salaryAmount: true, salaryType: true },
      }),
      prisma.profileView.count({ where: { profileId: u.id, createdAt: { gte: since }, viewer: { role: "OWNER", ...realUserWhere } } }).catch(() => 0),
      prisma.nailDesign.count({ where: { status: "published", publishedAt: { gte: since } } }).catch(() => 0),
    ]);
    if (!jobs.length && !views) return null;
    const pays = jobs.map((j) => weeklyPay(j.salaryAmount || "", j.salaryType || "")).filter((x): x is number => !!x).sort((a, b) => a - b);
    const median = pays.length >= 3 ? pays[Math.floor(pays.length / 2)] : null;
    const blocks = [
      views ? stat(String(views), L("lượt chủ tiệm đã xem hồ sơ của bạn tuần này", `salon view${views === 1 ? "" : "s"} of your profile this week`)) : "",
      jobs.length ? section(L(`${jobs.length} việc làm mới tại ${where}`, `${jobs.length} new job${jobs.length === 1 ? "" : "s"} in ${where}`), jobs.slice(0, 5).map((j) => row(T(j.title), `${j.salonName} · ${j.city}${j.salaryAmount ? ` · ${T(j.salaryAmount)}` : ""}`, url(`/jobs/${j.id}`))).join("")) : "",
      median ? stat(money(median, u.market), L(`lương tuần trung bình của tin mới tại ${where}`, `median weekly pay in new ${where} posts`)) : "",
      designs ? section(L("Mẫu nail mới", "New nail designs"), row(L(`${designs} mẫu mới tuần này`, `${designs} new design${designs === 1 ? "" : "s"} this week`), L("Kèm vật tư, các bước làm và giá gợi ý", "With materials, steps and a suggested price"), url("/designs"))) : "",
    ].join("");
    const subject = jobs.length
      ? L(`${jobs.length} việc làm nail mới tại ${where} tuần này${views ? ` · ${views} tiệm đã xem hồ sơ của bạn` : ""}`, `${jobs.length} new nail job${jobs.length === 1 ? "" : "s"} in ${where} this week${views ? ` · ${views} salon${views === 1 ? "" : "s"} viewed your profile` : ""}`)
      : L(`${views} tiệm đã xem hồ sơ của bạn tuần này`, `${views} salon${views === 1 ? "" : "s"} viewed your profile this week`);
    const intro = L(`Chào ${esc(first)}, đây là những gì mới trên PawNail tại ${esc(where)} tuần này.`, `Hi ${esc(first)}, here's what's new on PawNail in ${esc(where)} this week.`);
    const text = [
      L(`Chào ${first},`, `Hi ${first},`),
      ...jobs.slice(0, 5).map((j) => `• ${T(j.title)} — ${j.salonName}, ${j.city} ${T(j.salaryAmount)}: ${url(`/jobs/${j.id}`)}`),
      views ? L(`${views} lượt chủ tiệm xem hồ sơ của bạn.`, `${views} salon view${views === 1 ? "" : "s"} of your profile.`) : "",
      `${L("Mở PawNail", "Open PawNail")}: ${url("/?tab=jobs")}`,
      `${L("Hủy nhận", "Unsubscribe")}: ${unsubUrl(u.id)}`,
    ].filter(Boolean).join("\n");
    return { subject, html: shell(locale, jobs.length ? L(`${jobs.length} việc làm mới gần bạn`, `${jobs.length} new job${jobs.length === 1 ? "" : "s"} near you`) : L("Tiệm đã xem hồ sơ của bạn", "Salons viewed your profile"), intro, blocks, { label: L("Xem việc mới", "See new jobs"), href: url("/?tab=jobs") }, u.id), text };
  }

  if (u.role === "OWNER") {
    const [techs, myJobs] = await Promise.all([
      prisma.technicianProfile.findMany({
        where: { status: { in: ["AVAILABLE", "URGENT"] }, user: { market: u.market, ...(u.state ? { state: u.state } : {}), ...realUserWhere } }, // chỉ thợ thật
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
    const skills = (csv: string | null) => csv?.split(",").slice(0, 2).map((s) => T(s.trim())).join(", ") || L("Thợ nail", "Nail technician");
    const exp = (y: number | null) => (y ? L(`${y} năm kinh nghiệm`, `${y} yr${y === 1 ? "" : "s"} experience`) : L("Thợ mới", "New tech"));
    const blocks = [
      views ? stat(String(views), L(`lượt xem tin tuyển của bạn tuần này${contacts ? ` · ${contacts} lượt bấm gọi/nhắn` : ""}`, `view${views === 1 ? "" : "s"} of your job post this week${contacts ? ` · ${contacts} call or message tap${contacts === 1 ? "" : "s"}` : ""}`)) : "",
      techs.length ? section(L(`Thợ sẵn sàng nhận việc tại ${where}`, `Technicians available in ${where}`), techs.map((t) => row(t.user.name, `${skills(t.specialties)} · ${exp(t.yearsOfExperience)}${t.user.city ? ` · ${t.user.city}` : ""}`, url(`/profile/${t.user.id}`))).join("")) : "",
      !myJobs.length ? section(L("Gợi ý", "Tip"), row(L("Đăng tin tuyển", "Post a job"), L("Thợ gần tiệm được báo khi bạn đăng tin", "Techs near your salon are notified when you post"), url("/jobs/create"))) : "",
    ].join("");
    const subject = techs.length
      ? L(`${techs.length} thợ sẵn sàng nhận việc tại ${where} tuần này${views ? ` · tin của bạn có ${views} lượt xem` : ""}`, `${techs.length} technician${techs.length === 1 ? "" : "s"} available in ${where} this week${views ? ` · your job post had ${views} view${views === 1 ? "" : "s"}` : ""}`)
      : L(`Tin tuyển của bạn có ${views} lượt xem tuần này`, `Your job post had ${views} view${views === 1 ? "" : "s"} this week`);
    const intro = L(`Chào ${esc(first)}, đây là những gì mới trên PawNail tại ${esc(where)} tuần này.`, `Hi ${esc(first)}, here's what's new on PawNail in ${esc(where)} this week.`);
    const text = [
      L(`Chào ${first},`, `Hi ${first},`),
      ...techs.map((t) => `• ${t.user.name}: ${url(`/profile/${t.user.id}`)}`),
      views ? L(`Tin của bạn: ${views} lượt xem, ${contacts} lượt liên hệ.`, `Your job post: ${views} views, ${contacts} contacts.`) : "",
      `${L("Mở PawNail", "Open PawNail")}: ${url("/?tab=portfolio")}`,
      `${L("Hủy nhận", "Unsubscribe")}: ${unsubUrl(u.id)}`,
    ].filter(Boolean).join("\n");
    return { subject, html: shell(locale, techs.length ? L("Thợ sẵn sàng nhận việc gần tiệm bạn", "Technicians available near your salon") : L("Tin tuyển của bạn tuần này", "Your job post this week"), intro, blocks, { label: L("Xem thợ sẵn sàng", "See available techs"), href: url("/?tab=portfolio") }, u.id), text };
  }
  return null;
}
