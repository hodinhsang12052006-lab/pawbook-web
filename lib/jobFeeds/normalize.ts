// CHUẨN HOÁ tin việc từ đối tác → ExternalJobInput. Thuần hàm (không DB, không mạng) → kiểm thử được:
// scripts/qa/external_jobs_unit.mts
//   - bỏ HTML, cắt độ dài; đoạn trích có SĐT / email → bỏ hẳn đoạn trích (không bao giờ lấy SĐT từ tin đối tác)
//   - lương "dự đoán" của Adzuna (salary_is_predicted = "1") KHÔNG phải lương tiệm trả → không lưu, không hiện
//   - chỉ nhận link về đúng trang Adzuna (redirect_url giữ nguyên tham số theo dõi của Adzuna)
//   - lọc việc không phải nail (thợ đóng đinh "nailer", lợp mái…) theo tiêu đề
import crypto from "node:crypto";
import { AU_ALL_CODES, US_ALL_CODES, stateName } from "@/lib/stateNames";
import type { ExternalJobInput, FeedMarket } from "@/lib/jobFeeds/types";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
/** "<strong>Nail</strong> Tech &amp; Spa" → "Nail Tech & Spa" (chữ thuần, không thẻ HTML). */
export function stripHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+\d*);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      if (ENTITIES[k]) return ENTITIES[k];
      const n = k.startsWith("#x") ? parseInt(k.slice(2), 16) : k.startsWith("#") ? Number(k.slice(1)) : NaN;
      return Number.isFinite(n) && n > 31 && n < 0x10000 ? String.fromCharCode(n) : m;
    })
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

// SĐT Mỹ / Úc (cùng dạng lib/jobIngest/parse findPhone) + email.
const US_PHONE = /(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const AU_PHONE = /(?:\+?61[\s.-]?|\b0)[2-478](?:[\s.-]?\d){8}\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export const hasContactInfo = (s: string) => new RegExp(US_PHONE.source).test(s) || new RegExp(AU_PHONE.source).test(s) || new RegExp(EMAIL.source, "i").test(s);
const dropContacts = (s: string) => s.replace(US_PHONE, " ").replace(AU_PHONE, " ").replace(EMAIL, " ").replace(/\s+/g, " ").trim();

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
  const ta = [...new Set(companyTokens(a))];
  const tb = [...new Set(companyTokens(b))];
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
const httpsUrl = (u: unknown, host?: RegExp) => {
  try {
    const x = new URL(String(u || ""));
    if (x.protocol !== "https:" && x.protocol !== "http:") return null;
    if (host && !host.test(x.hostname)) return null;
    return x.toString();
  } catch {
    return null;
  }
};
function postedDate(v: unknown, now: Date): Date {
  const d = new Date(String(v || ""));
  return Number.isFinite(d.getTime()) ? new Date(Math.min(d.getTime(), now.getTime())) : now;
}
function snippetOf(raw: unknown): string | null {
  const s = clip(stripHtml(raw), 500);
  return !s || hasContactInfo(s) ? null : s; // có SĐT / email → bỏ cả đoạn, không "làm sạch" để giữ lại
}

// ===== Adzuna (https://developer.adzuna.com/docs/search) =====
export interface AdzunaResult {
  id?: string | number; title?: string; description?: string; redirect_url?: string; created?: string;
  salary_min?: number | string; salary_max?: number | string; salary_is_predicted?: string | number;
  company?: { display_name?: string }; location?: { display_name?: string; area?: string[] };
  latitude?: number; longitude?: number; contract_time?: string; contract_type?: string;
}
const ADZUNA_HOST = /(^|\.)adzuna\.[a-z.]+$/i;

export function normalizeAdzuna(r: AdzunaResult, market: FeedMarket, now = new Date()): ExternalJobInput | null {
  const providerJobId = String(r?.id ?? "").trim();
  if (!/^[\w-]{1,64}$/.test(providerJobId)) return null;
  const redirectUrl = httpsUrl(r.redirect_url, ADZUNA_HOST);
  if (!redirectUrl || !redirectUrl.startsWith("https:")) return null;
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
  const lat = finite(r.latitude);
  const lng = finite(r.longitude);
  return {
    provider: "adzuna",
    providerJobId,
    market,
    title,
    company,
    locationLabel,
    state,
    city,
    lat: lat != null && Math.abs(lat) <= 90 ? lat : null,
    lng: lng != null && Math.abs(lng) <= 180 ? lng : null,
    salaryMin,
    salaryMax,
    salaryCurrency: hasSalary ? (market === "AU" ? "AUD" : "USD") : null,
    salaryPeriod: hasSalary ? "YEAR" : null,
    contractTime: r.contract_time === "full_time" || r.contract_time === "part_time" ? r.contract_time : null,
    contractType: r.contract_type === "permanent" || r.contract_type === "contract" ? r.contract_type : null,
    snippet,
    redirectUrl,
    providerCreatedAt: postedDate(r.created, now),
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
  const url = httpsUrl(j?.url);
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
    lat: null,
    lng: null,
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
