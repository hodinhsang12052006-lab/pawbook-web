// Đặt lịch không cần tài khoản — kiểm tra đầu vào, chuẩn hoá SĐT Mỹ / Úc, câu nhắn soạn sẵn (dùng chung
// máy chủ + client).
import { SCHEDULED_RE, dayLabel, scheduledLabel } from "@/lib/i18n/format";

export const TIMES = ["morning", "afternoon", "evening"] as const;
export type BookingTime = (typeof TIMES)[number];
export const TIME_LABEL: Record<BookingTime, [string, string]> = {
  morning: ["Buổi sáng", "Morning"],
  afternoon: ["Buổi chiều", "Afternoon"],
  evening: ["Buổi tối", "Evening"],
};
export const STATUSES = ["new", "confirmed", "declined", "done"] as const;
export type BookingStatus = (typeof STATUSES)[number];
// Chuyển trạng thái hợp lệ (không cho "làm xong" một lịch chưa xác nhận, không mở lại lịch đã đóng)
export const NEXT: Record<BookingStatus, BookingStatus[]> = {
  new: ["confirmed", "declined"],
  confirmed: ["done", "declined"],
  declined: [],
  done: [],
};
export const BOOKING_DAYS_AHEAD = 60;

/** SĐT Mỹ (10 số, có thể kèm 1) hoặc Úc (04xx…, +61) → dạng E.164; sai → null. */
export function normalizePhone(raw: string): string | null {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1") && /^1[2-9]\d{2}[2-9]\d{6}$/.test(d)) return `+${d}`;
  if (d.length === 10 && /^0[2-478]\d{8}$/.test(d)) return `+61${d.slice(1)}`;
  if (d.length === 11 && /^61[2-478]\d{8}$/.test(d)) return `+${d}`;
  return null;
}

/** Hiển thị: +1 (214) 555-0123 · +61 412 345 678 */
export function formatPhone(e164: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (us) return `(${us[1]}) ${us[2]}-${us[3]}`;
  const au = /^\+61(4\d{2})(\d{3})(\d{3})$/.exec(e164);
  if (au) return `0${au[1]} ${au[2]} ${au[3]}`;
  return e164;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export interface BookingInput {
  techId: string;
  menuItemId: string | null;
  clientName: string;
  clientPhone: string;
  preferredDate: string | null;
  preferredTime: BookingTime | null;
  note: string | null;
  locale: "vi" | "en";
}

export function parseBooking(b: Record<string, unknown>, now = new Date()): { ok: true; value: BookingInput } | { ok: false; error: string } {
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const techId = str(b.techId, 40);
  if (!techId) return { ok: false, error: "Thiếu thợ / tiệm." };
  const clientName = str(b.name, 60);
  if (clientName.length < 2) return { ok: false, error: "Nhập tên của bạn." };
  const clientPhone = normalizePhone(String(b.phone ?? ""));
  if (!clientPhone) return { ok: false, error: "Số điện thoại chưa đúng (Mỹ 10 số, Úc 04xx…)." };
  let preferredDate: string | null = str(b.date, 10) || null;
  if (preferredDate) {
    // Cho phép từ hôm qua (lệch múi giờ Mỹ / Úc so với UTC) tới 60 ngày tới
    const min = ymd(new Date(now.getTime() - 86_400_000));
    const max = ymd(new Date(now.getTime() + BOOKING_DAYS_AHEAD * 86_400_000));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || preferredDate < min || preferredDate > max) return { ok: false, error: "Ngày chưa hợp lệ." };
  }
  const preferredTime = (TIMES as readonly string[]).includes(String(b.time)) ? (b.time as BookingTime) : null;
  if (!preferredDate) preferredDate = null;
  return {
    ok: true,
    value: {
      techId,
      menuItemId: str(b.menuItemId, 40) || null,
      clientName,
      clientPhone,
      preferredDate,
      preferredTime,
      note: str(b.note, 300) || null,
      locale: b.locale === "en" ? "en" : "vi",
    },
  };
}

/** Ngày mong muốn theo ngôn ngữ + thị trường: "Thứ 7, 18/10" · en-US "Sat, Oct 18" · en-AU "Sat 18 Oct". */
export function dateLabel(ymdStr: string | null, locale: "vi" | "en", market?: string | null): string {
  return dayLabel(ymdStr, locale, market);
}

/** Giờ chốt hợp lệ: "YYYY-MM-DDTHH:mm" (giờ địa phương của tiệm, từ ô chọn ngày + ô chọn giờ). */
export const isScheduledIso = (v: unknown): v is string => typeof v === "string" && SCHEDULED_RE.test(v);
/** Giờ ô chọn giờ đề xuất theo buổi khách muốn. */
export const DEFAULT_HOUR: Record<BookingTime, string> = { morning: "10:00", afternoon: "14:00", evening: "18:00" };

/**
 * Tin nhắn SMS soạn sẵn cho thợ gửi khách (từ điện thoại của chính thợ — 0đ). Ngôn ngữ theo KHÁCH (b.locale),
 * định dạng ngày giờ theo thị trường của tiệm (en-US "Sat, Nov 7 · 2:30 PM", en-AU "Sat 7 Nov · 2:30 pm") —
 * không bao giờ theo ngôn ngữ giao diện của thợ.
 */
export function smsText(b: { clientName: string; itemName: string | null; preferredDate: string | null; preferredTime: string | null; locale: string; scheduledFor?: string | null }, techName: string, kind: "confirm" | "ask" = "ask", market?: string | null): string {
  const en = b.locale === "en";
  const lang = en ? "en" : "vi";
  const t = (TIMES as readonly string[]).includes(String(b.preferredTime)) ? TIME_LABEL[b.preferredTime as BookingTime][en ? 1 : 0].toLowerCase() : "";
  const when = [dateLabel(b.preferredDate, lang, market), t].filter(Boolean).join(" ");
  const what = b.itemName ? (en ? ` for "${b.itemName}"` : ` làm mẫu "${b.itemName}"`) : "";
  if (kind === "confirm" && b.scheduledFor) {
    const at = scheduledLabel(b.scheduledFor, lang, market);
    return en
      ? `Hi ${b.clientName}, this is ${techName} (PawNail). You're booked${what} on ${at}. See you then!`
      : `Chào ${b.clientName}, mình là ${techName} (PawNail). Mình xác nhận lịch${what} vào ${at} nha. Hẹn gặp bạn!`;
  }
  return en
    ? `Hi ${b.clientName}, this is ${techName} (PawNail). Got your request${what}${when ? ` (${when})` : ""}. What time works best for you?`
    : `Chào ${b.clientName}, mình là ${techName} (PawNail). Mình nhận được yêu cầu đặt lịch${what}${when ? ` (${when})` : ""}. Bạn muốn ghé mấy giờ để mình giữ chỗ nha?`;
}

/** Tên hiển thị khi đánh giá: "Ngọc Anh" → "Ngọc A." · "Mia Tran" → "Mia T." (không lộ họ tên đầy đủ). */
export function shortName(full: string): string {
  const w = full.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!w.length) return "Khách";
  if (w.length === 1) return w[0].slice(0, 20);
  return `${w[0].slice(0, 20)} ${w[w.length - 1][0].toUpperCase()}.`;
}

/** Tin nhắn xin đánh giá sau buổi làm (gửi từ điện thoại thợ). */
export function reviewSms(b: { clientName: string; locale: string }, techName: string, url: string): string {
  return b.locale === "en"
    ? `Thanks for coming in, ${b.clientName}! It'd mean a lot if you rated your nails (1 min): ${url} — ${techName}`
    : `Cảm ơn ${b.clientName} đã ghé tiệm! Bạn chấm giúp ${techName} 1 phút nha, mình rất cảm kích: ${url}`;
}
export const REVIEW_DAYS = 30; // link đánh giá dùng được 30 ngày sau buổi làm
