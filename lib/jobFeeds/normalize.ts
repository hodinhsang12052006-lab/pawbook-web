// CHUẨN HOÁ tin việc từ đối tác → ExternalJobInput. Thuần hàm (không DB, không mạng) → kiểm thử được:
// scripts/qa/external_jobs_unit.mts
//   - bỏ HTML, cắt độ dài; đoạn trích có SĐT / email → bỏ hẳn đoạn trích (không bao giờ lấy SĐT từ tin đối tác)
//   - lương "dự đoán" của Adzuna (salary_is_predicted = "1") KHÔNG phải lương tiệm trả → không lưu, không hiện
//   - chỉ nhận link HTTPS về đúng tên miền của đối tác (Adzuna: adzuna.com / adzuna.com.au; Careerjet: careerjet.* /
//     jobviewtrack.com — link theo dõi của Careerjet), giữ nguyên tham số theo dõi
//   - lọc việc không phải nail (thợ đóng đinh "nailer", lợp mái…) theo tiêu đề
//   - KHÔNG bịa ngày đăng: đối tác không ghi / ghi sai ngày → null ("không ghi ngày"), không bao giờ "vừa đăng"
//   - không lưu toạ độ (chưa có tính năng nào cần)
import crypto from "node:crypto";
import { AU_ALL_CODES, US_ALL_CODES, stateName } from "@/lib/stateNames";
import type { ExternalJobInput, FeedMarket } from "@/lib/jobFeeds/types";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
/** "<strong>Nail</strong> Tech &amp; Spa" → "Nail Tech & Spa" (chữ thuần, không thẻ HTML). */
export function stripHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/<\/?(?:b|strong|i|em|u|span|a|mark|small)[^>]*>/gi, "") // thẻ trong dòng: bỏ, không chèn cách
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+\d*);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      if (ENTITIES[k]) return ENTITIES[k];
      const n = k.startsWith("#x") ? parseInt(k.slice(2), 16) : k.startsWith("#") ? Number(k.slice(1)) : NaN;
      return Number.isFinite(n) && n > 31 && n < 0x10000 ? String.fromCharCode(n) : m;
    })
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

// SĐT Mỹ / Úc (cùng dạng lib/jobIngest/parse findPhone) + email (kể cả kiểu viết lách "name[at]domain[dot]com").
const US_PHONE = /(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
// Úc: 04xx / 0[2378] + 8 số, +61 4xx…, "+61 (0)412 345 678"; số dịch vụ 1300 / 1800 (10 số) và 13 xx xx (6 số)
const AU_PHONE = /(?:\+?61[\s.-]?(?:\(0\)[\s.-]?)?|\b0)[2-478](?:[\s.-]?\d){8}\b/g;
const AU_SERVICE = /(?<![\d$])\b1[38]00(?:[\s.-]?\d){6}\b|(?<![\d$.,])\b13(?:[\s.-]?\d){4}\b(?![\d,])/g;
const AT = String.raw`(?:@|\s*[\[({]\s*at\s*[\])}]\s*)`;
const DOT = String.raw`(?:\.|\s*[\[({]\s*dot\s*[\])}]\s*)`;
const EMAIL = new RegExp(String.raw`[A-Z0-9._%+-]+${AT}[A-Z0-9-]+(?:${DOT}[A-Z0-9-]+)*${DOT}[A-Z]{2,}\b`, "gi");
const CONTACT_RES = [US_PHONE, AU_PHONE, AU_SERVICE, EMAIL];
export const hasContactInfo = (s: string) => CONTACT_RES.some((re) => new RegExp(re.source, re.flags.replace("g", "")).test(s));
// Sau khi bỏ số / email, tiêu đề hay còn đuôi thừa: "Nail Tech - call", "Manicurist | text or", "Nail Artist ph:"
// (kèm chữ Việt hay gặp trong bài tuyển thợ: "gọi", "nhắn tin", "LH", "SĐT", "hoặc"…)
const CONTACT_WORDS = "call|text|txt|sms|ph|phone|tel|mob|mobile|cell|email|e-mail|whatsapp|contact|or|on|at|now|gọi|goi|nhắn tin|nhắn|nhan tin|lh|liên hệ|lien he|liên lạc|lien lac|sđt|sdt|đt|dt|số|hoặc|hoac|xin";
const CONTACT_TAIL = new RegExp(String.raw`(?:\s*[-–—|:,/•·]\s*|\s+|^)(?:${CONTACT_WORDS})\.?\s*:?\s*$`, "i");
const CONTACT_PAREN = new RegExp(String.raw`\(\s*(?:(?:${CONTACT_WORDS})(?=[\s:./)]|$)[\s:./]*)*\)`, "gi");
/** Bỏ SĐT / email khỏi tiêu đề, tên công ty; dọn mảnh "call / text / ph" còn sót ("Nail Tech - call", "(call )"). */
export function dropContacts(s: string): string {
  const src = s.replace(/\s+/g, " ").trim();
  let out = CONTACT_RES.reduce((acc, re) => acc.replace(re, " "), src).replace(/\s+/g, " ").trim();
  if (out === src) return out; // không có gì bị bỏ → giữ nguyên câu chữ gốc
  out = out.replace(CONTACT_PAREN, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4 && CONTACT_TAIL.test(out); i++) out = out.replace(CONTACT_TAIL, "").trim();
  return out.replace(/[\s\-–—|:,/•·(]+$/, "").replace(/\s+/g, " ").trim();
}

// Lọc liên quan: tiêu đề quyết định; đoạn trích chỉ dùng khi tiêu đề là việc ngành làm đẹp chung chung.
const NAIL_ALLOW = /\bnails?\s*(?:tech|techs|technicians?|artists?|specialists?|stylists?|designers?)\b|\bmanicurists?\b|\bpedicurists?\b|\bnail\s+(?:salon|bar|spa|studio|lounge)\b|\bmani(?:cure)?s?\b|\bpedi(?:cure)?s?\b/i;
const NAIL_DENY = /nailer|nail\s*gun|\broof|\bfram(?:e|er|ers|ing)\b|carpent|siding|drywall|construction|shingle|nail\s*plate|nail\s*polish\s*(?:factory|production|manufactur)/i;
const BEAUTY_TITLE = /beaut|salon|\bspa\b|esthetic|cosmetolog|therapist/i;
export function isNailJob(title: string, snippet?: string | null): boolean {
  if (NAIL_DENY.test(title)) return false;
  if (NAIL_ALLOW.test(title)) return true;
  const s = snippet || "";
  return BEAUTY_TITLE.test(title) && NAIL_ALLOW.test(s) && !NAIL_DENY.test(s);
}

// Chuẩn hoá tên để so trùng với tin tiệm tự đăng: bỏ dấu, ký tự lạ, chữ chung chung (nails, salon, llc…).
const COMPANY_STOP = new Set(["nails", "nail", "salon", "salons", "spa", "llc", "inc", "pty", "ltd", "co", "corp", "the", "and"]);
export const normText = (s: string | null | undefined) =>
  String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const companyTokens = (s: string | null | undefined) => normText(s).split(" ").filter((w) => w && !COMPANY_STOP.has(w));
/** Cùng 1 tiệm? bằng nhau, tên này chứa trọn tên kia (theo từ), hoặc Jaccard ≥ 0,8. */
export function companyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return companyTokensMatch([...new Set(companyTokens(a))], [...new Set(companyTokens(b))]);
}
/** Như companyMatch nhưng nhận sẵn danh sách từ (đã bỏ trùng) — để so hàng nghìn cặp mà không chuẩn hoá lại mỗi lần. */
export function companyTokensMatch(ta: string[], tb: string[]): boolean {
  if (!ta.length || !tb.length) return false;
  const [short, long] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  if (short.join(" ").length >= 3 && short.every((w) => long.has(w))) return true;
  const inter = ta.filter((w) => tb.includes(w)).length;
  return inter / new Set([...ta, ...tb]).size >= 0.8;
}
export const sameCity = (a: string | null | undefined, b: string | null | undefined) => !normText(a) || !normText(b) || normText(a) === normText(b);

export const dedupeKeyOf = (title: string, company: string | null, city: string | null, market: FeedMarket) =>
  crypto.createHash("sha1").update([normText(title), companyTokens(company).join(" "), normText(city), market].join("|")).digest("hex");

// Tên bang đầy đủ (Adzuna location.area[1]) → mã PawNail.
const US_BY_NAME = new Map<string, string>([...US_ALL_CODES.map((c) => [normText(stateName("US", c)), c] as [string, string]), ["district of columbia", "DC"]]);
const AU_BY_NAME = new Map<string, string>(AU_ALL_CODES.map((c) => [normText(stateName("AU", c)), c] as [string, string]));
export function stateCode(market: FeedMarket, raw: string | null | undefined): string | null {
  const v = String(raw || "").trim();
  if (!v) return null;
  const up = v.toUpperCase();
  if (market === "US") return US_ALL_CODES.includes(up) ? up : US_BY_NAME.get(normText(v)) ?? null;
  return AU_ALL_CODES.includes(up) ? up : AU_BY_NAME.get(normText(v)) ?? null;
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
const finite = (v: unknown) => (Number.isFinite(num(v)) ? num(v) : null);
/** Chỉ link HTTPS về đúng tên miền cho phép (bảo vệ người dùng + giữ link theo dõi của đối tác). */
const httpsUrl = (u: unknown, host: RegExp) => {
  try {
    const x = new URL(String(u || ""));
    if (x.protocol !== "https:" || x.username || x.password) return null;
    if (!host.test(x.hostname)) return null;
    return x.toString();
  } catch {
    return null;
  }
};
/** Ngày đăng của đối tác, hoặc null nếu không ghi / không đọc được / ở tương lai quá 1 ngày (lệch giờ ≤ 1 ngày → "bây giờ").
 *  KHÔNG BAO GIỜ thay ngày thiếu bằng "bây giờ" — như thế tin cũ sẽ hiện "vừa đăng". */
export function postedDate(v: unknown, now: Date): Date | null {
  if ((typeof v !== "string" && typeof v !== "number") || String(v).trim() === "") return null;
  const t = new Date(typeof v === "number" ? v : v.trim()).getTime();
  if (!Number.isFinite(t) || t < Date.UTC(2000, 0, 1) || t > now.getTime() + 86_400_000) return null;
  return new Date(Math.min(t, now.getTime()));
}
function snippetOf(raw: unknown): string | null {
  const full = stripHtml(raw);
  // Kiểm SĐT / email trên TOÀN BỘ chữ (cắt trước có thể chặt đôi 1 số điện thoại) → có thì bỏ cả đoạn
  return !full || hasContactInfo(full) ? null : clip(full, 500);
}

// ===== Adzuna (https://developer.adzuna.com/docs/search) =====
export interface AdzunaResult {
  id?: string | number; title?: string; description?: string; redirect_url?: string; created?: string;
  salary_min?: number | string; salary_max?: number | string; salary_is_predicted?: string | number;
  company?: { display_name?: string }; location?: { display_name?: string; area?: string[] };
  latitude?: number; longitude?: number; contract_time?: string; contract_type?: string; // toạ độ: không lưu
}
// Chỉ tên miền Adzuna của 2 thị trường PawNail (không nhận "adzuna.attacker.com" / "evil-adzuna.com").
export const ADZUNA_HOST = /^(?:[a-z0-9-]+\.)*adzuna\.(?:com|com\.au)$/i;
// Link tin Careerjet: trang Careerjet hoặc link theo dõi jobviewtrack.com của Careerjet.
export const CAREERJET_HOST = /^(?:[a-z0-9-]+\.)*(?:careerjet\.(?:com|com\.au|net)|jobviewtrack\.com)$/i;

export function normalizeAdzuna(r: AdzunaResult, market: FeedMarket, now = new Date()): ExternalJobInput | null {
  const providerJobId = String(r?.id ?? "").trim();
  if (!/^[\w-]{1,64}$/.test(providerJobId)) return null;
  const redirectUrl = httpsUrl(r.redirect_url, ADZUNA_HOST);
  if (!redirectUrl) return null;
  // Adzuna luôn ghi "created"; thiếu / sai → BỎ tin (không bịa ngày đăng, không để tin cũ hiện "vừa đăng").
  const providerCreatedAt = postedDate(r.created, now);
  if (!providerCreatedAt) return null;
  const title = clip(dropContacts(stripHtml(r.title)), 140);
  if (!title) return null;
  const company = clip(dropContacts(stripHtml(r.company?.display_name)), 100) || null;
  const area = Array.isArray(r.location?.area) ? r.location!.area!.map((x) => stripHtml(x)).filter(Boolean) : [];
  const state = stateCode(market, area[1]);
  let city: string | null = area.length >= 3 ? clip(area[area.length - 1], 60) : null;
  if (city && area.length === 3 && /\b(county|region|shire)$/i.test(city)) city = null;
  const locationLabel = clip(stripHtml(r.location?.display_name), 120) || [city, state].filter(Boolean).join(", ") || (market === "US" ? "United States" : "Australia");
  const predicted = String(r.salary_is_predicted ?? "1") !== "0";
  const sMin = predicted ? null : finite(r.salary_min);
  const sMax = predicted ? null : finite(r.salary_max);
  const salaryMin = sMin && sMin > 0 ? Math.round(sMin) : null;
  const salaryMax = sMax && sMax > 0 ? Math.round(sMax) : null;
  const hasSalary = salaryMin != null || salaryMax != null;
  const snippet = snippetOf(r.description);
  return {
    provider: "adzuna",
    providerJobId,
    market,
    title,
    company,
    locationLabel,
    state,
    city,
    salaryMin,
    salaryMax,
    salaryCurrency: hasSalary ? (market === "AU" ? "AUD" : "USD") : null,
    salaryPeriod: hasSalary ? "YEAR" : null,
    contractTime: r.contract_time === "full_time" || r.contract_time === "part_time" ? r.contract_time : null,
    contractType: r.contract_type === "permanent" || r.contract_type === "contract" ? r.contract_type : null,
    snippet,
    redirectUrl,
    providerCreatedAt,
    dedupeKey: dedupeKeyOf(title, company, city, market),
    notNail: !isNailJob(title, snippet),
  };
}

// ===== Careerjet (https://www.careerjet.com/partners/api) — CHỈ tìm trực tiếp, không lưu =====
export interface CareerjetJob {
  title?: string; company?: string; locations?: string; salary?: string; salary_min?: number | string; salary_max?: number | string;
  salary_currency_code?: string; salary_type?: string; date?: string; description?: string; url?: string;
}
const CJ_PERIOD: Record<string, string> = { Y: "YEAR", YEAR: "YEAR", YEARLY: "YEAR", M: "MONTH", MONTH: "MONTH", MONTHLY: "MONTH", W: "WEEK", WEEK: "WEEK", WEEKLY: "WEEK", D: "DAY", DAY: "DAY", DAILY: "DAY", H: "HOUR", HOUR: "HOUR", HOURLY: "HOUR" };

export function normalizeCareerjet(j: CareerjetJob, market: FeedMarket, now = new Date()): ExternalJobInput | null {
  const url = httpsUrl(j?.url, CAREERJET_HOST);
  if (!url) return null;
  const title = clip(dropContacts(stripHtml(j.title)), 140);
  if (!title) return null;
  const company = clip(dropContacts(stripHtml(j.company)), 100) || null;
  const loc = clip(stripHtml(j.locations), 120);
  // "Houston, TX" · "Sydney NSW" · "Parramatta, New South Wales"
  const parts = loc.split(/\s*,\s*/).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const tailCode = last.match(/\b([A-Z]{2,3})$/)?.[1];
  const state = stateCode(market, tailCode || last);
  const cityRaw = parts.length > 1 ? parts[0] : tailCode ? last.replace(/\s*\b[A-Z]{2,3}$/, "") : "";
  const city = cityRaw && !stateCode(market, cityRaw) ? clip(cityRaw, 60) : null;
  const sMin = finite(j.salary_min);
  const sMax = finite(j.salary_max);
  const salaryMin = sMin && sMin > 0 ? Math.round(sMin) : null;
  const salaryMax = sMax && sMax > 0 ? Math.round(sMax) : null;
  const hasSalary = salaryMin != null || salaryMax != null;
  const currency = String(j.salary_currency_code || "").toUpperCase();
  const snippet = snippetOf(j.description);
  return {
    provider: "careerjet",
    providerJobId: crypto.createHash("sha1").update(url).digest("hex").slice(0, 20),
    market,
    title,
    company,
    locationLabel: loc || (market === "US" ? "United States" : "Australia"),
    state,
    city,
    salaryMin,
    salaryMax,
    salaryCurrency: hasSalary ? (/^[A-Z]{3}$/.test(currency) ? currency : market === "AU" ? "AUD" : "USD") : null,
    salaryPeriod: hasSalary ? CJ_PERIOD[String(j.salary_type || "").toUpperCase()] ?? null : null,
    contractTime: null,
    contractType: null,
    snippet,
    redirectUrl: url,
    providerCreatedAt: postedDate(j.date, now),
    dedupeKey: dedupeKeyOf(title, company, city, market),
    notNail: !isNailJob(title, snippet),
  };
}
