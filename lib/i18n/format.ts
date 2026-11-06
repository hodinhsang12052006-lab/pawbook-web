// Ngày giờ theo ngôn ngữ + thị trường (Intl), dùng chung máy chủ + trình duyệt. THUẦN: ngôn ngữ và thị
// trường luôn truyền tường minh (không đọc tr()), nên route handler, SMS soạn sẵn và component đều dùng được.
//
//   en-US  "3:16 AM" · "Sat, Nov 7 · 2:30 PM" · "Nov 2 – 8"
//   en-AU  "3:16 am" · "Sat 7 Nov · 2:30 pm"  · "2–8 Nov"
//   vi     "03:16"   · "Thứ 7, 7/11 · 14:30"  · "02/11 – 08/11"
//
// Ngày "YYYY-MM-DD" và giờ hẹn "YYYY-MM-DDTHH:mm" là GIỜ ĐỊA PHƯƠNG của tiệm (không có múi giờ) → luôn
// định dạng với timeZone "UTC" để không bị lệch ngày theo múi giờ của máy chủ / người xem.
import { intlLocale, type Locale } from "@/lib/i18n/config";

export type MarketCode = "US" | "AU";

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${locale}|${JSON.stringify(opts)}`;
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, opts);
    fmtCache.set(k, f);
  }
  return f;
}

const VI_WEEKDAY = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const VI_WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const pad = (n: number) => String(n).padStart(2, "0");

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));

/** Giờ đồng hồ: en-US "3:16 AM", en-AU "3:16 am", vi "03:16". `timeZone` bỏ trống = múi giờ của máy đang chạy. */
export function clockTime(d: Date | string | number, lang: Locale, market?: string | null, timeZone?: string): string {
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return "";
  if (lang === "vi") return fmt("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, ...(timeZone ? { timeZone } : {}) }).format(date);
  return fmt(intlLocale(lang, market), { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(date);
}

/** Ngày ngắn không có năm: en-US "Nov 2", en-AU "2 Nov", vi "02/11". */
export function shortDate(d: Date | string | number, lang: Locale, market?: string | null, timeZone?: string): string {
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return "";
  if (lang === "vi") {
    const parts = fmt("en-US", { day: "2-digit", month: "2-digit", ...(timeZone ? { timeZone } : {}) }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    return `${day}/${month}`;
  }
  return fmt(intlLocale(lang, market), { day: "numeric", month: "short", ...(timeZone ? { timeZone } : {}) }).format(date);
}

/** Ngày đầy đủ (vạch ngăn ngày trong chat): en-US "November 2, 2026", en-AU "2 November 2026", vi "2 tháng 11, 2026". */
export function longDate(d: Date | string | number, lang: Locale, market?: string | null): string {
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return "";
  return fmt(intlLocale(lang, market), { day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** Thời gian ngắn ở danh sách hội thoại: hôm nay → giờ · trong tuần → thứ · cũ hơn → ngày. */
export function chatListTime(iso: string, lang: Locale, market?: string | null, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.toDateString() === now.toDateString()) return clockTime(d, lang, market);
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 7) return lang === "vi" ? VI_WEEKDAY_SHORT[d.getDay()] : fmt(intlLocale(lang, market), { weekday: "short" }).format(d);
  return shortDate(d, lang, market);
}

/** Khoảng tuần: en-US "Nov 2 – 8", en-AU "2–8 Nov", vi "02/11 – 08/11". */
export function weekRange(start: Date, end: Date, lang: Locale, market?: string | null): string {
  if (lang === "vi") return `${shortDate(start, "vi")} – ${shortDate(end, "vi")}`;
  const f = fmt(intlLocale(lang, market), { day: "numeric", month: "short" });
  const range = (f as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string }).formatRange;
  return typeof range === "function" ? range.call(f, start, end) : `${f.format(start)} – ${f.format(end)}`;
}

/** "2026-11-07" → Date (nửa đêm UTC) hoặc null. */
export function parseYmd(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ""));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ngày có thứ: en-US "Sat, Nov 7", en-AU "Sat 7 Nov", vi "Thứ 7, 7/11". */
export function dayLabel(ymdStr: string | null | undefined, lang: Locale, market?: string | null): string {
  const d = parseYmd(ymdStr);
  if (!d) return "";
  if (lang === "vi") return `${VI_WEEKDAY[d.getUTCDay()]}, ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  return fmt(intlLocale(lang, market), { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

/** Giờ hẹn đã chốt dạng ISO "YYYY-MM-DDTHH:mm" (giờ địa phương của tiệm). */
export const SCHEDULED_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

/** "14:30" → "2:30 PM" (en-US) · "2:30 pm" (en-AU) · "14:30" (vi). */
export function hmLabel(hm: string, lang: Locale, market?: string | null): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!m) return hm;
  const d = new Date(Date.UTC(2000, 0, 1, +m[1], +m[2]));
  return clockTime(d, lang, market, "UTC");
}

/**
 * Giờ hẹn hiển thị / gửi SMS: "2026-11-07T14:30" → en-US "Sat, Nov 7 · 2:30 PM", en-AU "Sat 7 Nov · 2:30 pm",
 * vi "Thứ 7, 7/11 · 14:30". Dữ liệu cũ (chữ tự do) giữ nguyên.
 */
export function scheduledLabel(v: string | null | undefined, lang: Locale, market?: string | null): string {
  if (!v) return "";
  const m = SCHEDULED_RE.exec(v);
  if (!m) return v;
  return `${dayLabel(m[1], lang, market)} · ${hmLabel(`${m[2]}:${m[3]}`, lang, market)}`;
}

/** Ngày "YYYY-MM-DD" theo giờ địa phương của máy đang chạy. */
export function localYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
