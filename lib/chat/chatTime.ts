import { currentLocale } from "@/lib/i18n/tr";

// Giờ / ngày trong chat theo đúng ngôn ngữ + thị trường: VI "15:13", Mỹ "3:13 PM", Úc "3:13 pm".
// (Trước đây giờ bong bóng ghim cứng "vi-VN" → người dùng Mỹ/Úc thấy giờ 24h.)
export function chatLocale(market?: string | null): string {
  if (currentLocale() === "vi") return "vi-VN";
  return market === "AU" ? "en-AU" : "en-US";
}

// Bộ định dạng Intl dùng lại theo (ngôn ngữ, kiểu): toLocale*String() tạo bộ định dạng MỚI mỗi lần gọi (~1 ms / lần ở CPU
// chậm 4x — mở 1 cuộc trò chuyện là hàng trăm lần: giờ của từng bong bóng, viên ngày). Kết quả giống hệt (cùng tuỳ chọn).
const fmts = new Map<string, Intl.DateTimeFormat>();
function fmt(loc: string, kind: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${loc}|${kind}`;
  let f = fmts.get(k);
  if (!f) fmts.set(k, (f = new Intl.DateTimeFormat(loc, opts)));
  return f;
}

/** Giờ trong bong bóng: "3:13 PM" / "15:13". */
export function bubbleTime(iso: string | Date, market?: string | null): string {
  return fmt(chatLocale(market), "hm", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Nhãn viên ngày: Hôm nay / Hôm qua / thứ (≤ 6 ngày) / "Oct 30" (năm nay) / "Oct 30, 2025". */
export function dayLabel(iso: string | Date, today: string, yesterday: string, market?: string | null): string {
  const d = new Date(iso);
  const loc = chatLocale(market);
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return today;
  if (days === 1) return yesterday;
  if (days <= 6) return fmt(loc, "wl", { weekday: "long" }).format(d);
  if (d.getFullYear() === new Date().getFullYear()) return fmt(loc, "md", { month: "short", day: "numeric" }).format(d);
  return fmt(loc, "mdy", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

/** Giờ ở danh sách chat: hôm nay → giờ · trong tuần → thứ viết tắt · cũ hơn → "Oct 30". */
export function listTime(iso: string | Date, market?: string | null): string {
  const d = new Date(iso);
  const loc = chatLocale(market);
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return bubbleTime(d, market);
  if (days < 7) return fmt(loc, "ws", { weekday: "short" }).format(d);
  if (d.getFullYear() === new Date().getFullYear()) return fmt(loc, "md", { month: "short", day: "numeric" }).format(d);
  return fmt(loc, "mdy2", { month: "short", day: "numeric", year: "2-digit" }).format(d);
}

/** Gom tin vào 1 cụm: cùng người, cùng ngày, cách nhau ≤ 5 phút, không phải tin hệ thống / cuộc gọi. */
export function sameChatGroup(
  a: { senderId: string; type?: string; createdAt: string } | null,
  b: { senderId: string; type?: string; createdAt: string } | null
): boolean {
  if (!a || !b || a.senderId !== b.senderId) return false;
  if (a.type === "SYSTEM" || b.type === "SYSTEM" || a.type === "CALL" || b.type === "CALL" || a.type === "ATTENDANCE" || b.type === "ATTENDANCE") return false;
  const ta = new Date(a.createdAt), tb = new Date(b.createdAt);
  return ta.toDateString() === tb.toDateString() && Math.abs(tb.getTime() - ta.getTime()) <= 5 * 60_000;
}
