// Hiển thị số điện thoại dễ đọc: "+1 2145550123" → "(214) 555-0123",
// "0412345678" (Úc) → "0412 345 678". Không nhận ra định dạng → giữ nguyên.
export function formatPhone(raw: string | null | undefined, market: "US" | "AU" | string = "US"): string {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (market === "AU") {
    const local = d.startsWith("61") ? "0" + d.slice(2) : d;
    if (/^04\d{8}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`; // di động
    if (/^0[2378]\d{8}$/.test(local)) return `(${local.slice(0, 2)}) ${local.slice(2, 6)} ${local.slice(6)}`; // cố định
    if (AU_SERVICE.test(d)) return auServiceDisplay(d); // 1300 / 1800 / 13 xx xx
    return String(raw).trim();
  }
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (/^[2-9]\d{9}$/.test(ten)) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return String(raw).trim();
}

/** Số cho link tel: (luôn có mã quốc gia nếu nhận ra). */
export function telHref(raw: string | null | undefined, market: "US" | "AU" | string = "US"): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (market === "AU") {
    // 1300 / 1800 / 13 xx xx chỉ gọi được trong nước Úc → quay số đúng như ghi, không thêm +61
    if (AU_SERVICE.test(d)) return `tel:${d}`;
    const local = d.startsWith("61") ? d.slice(2) : d.replace(/^0/, "");
    return /^\d{9}$/.test(local) ? `tel:+61${local}` : `tel:${raw ?? ""}`;
  }
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return /^\d{10}$/.test(ten) ? `tel:+1${ten}` : `tel:${raw ?? ""}`;
}

// ===== Số điện thoại HỢP LỆ theo thị trường của tin tuyển (11/2026) =====
// Sản phẩm thật từng có: tin đăng tay ở New York mang SĐT Việt Nam "+1 03xxxxxxxx"; bot đăng bài nhóm nail ở Anh
// (07xxx xxxxxx → bỏ số 0 đầu thành số Mỹ (747) …). Một tin chỉ được mang số gọi được ở ĐÚNG thị trường của nó.
export type PhoneMarket = "US" | "AU";
export type MarketPhone = { e164: string; display: string };

// NANP (Mỹ / Canada): mã vùng NXX + đầu số NXX + 4 số; N = 2–9, không phải mã dịch vụ N11 (211, 911…).
const NANP = /^[2-9](?!11)\d{2}[2-9](?!11)\d{2}\d{4}$/;
// Úc: di động 04xx xxx xxx, cố định 02 / 03 / 07 / 08 + 8 số (số quốc gia 9 chữ số, không có số 0 đầu), và số doanh
// nghiệp 1300 / 1800 xxx xxx, 13 xx xx (không có số 0 trung kế — tiệm / chuỗi tiệm ở Úc hay dùng).
const AU_NATIONAL = /^(?:4\d{8}|[2378]\d{8}|1[38]00\d{6}|13\d{4})$/;
// Số doanh nghiệp Úc viết liền (chỉ chữ số): 1300 655 506 · 1800 123 456 · 13 12 34
const AU_SERVICE = /^1(?:[38]00\d{6}|3\d{4})$/;
function auServiceDisplay(nat: string): string {
  return nat.length === 10 ? `${nat.slice(0, 4)} ${nat.slice(4, 7)} ${nat.slice(7)}` : `${nat.slice(0, 2)} ${nat.slice(2, 4)} ${nat.slice(4)}`;
}
// Chỉ chữ số + ký tự phân cách thường gặp; "+" chỉ được đứng đầu.
const PHONE_CHARS = /^\+?[\d\s().‐-―-]+$/;

/**
 * Số người dùng gõ (form đăng tin, đăng ký chủ tiệm) hoặc bot gửi cho 1 tin ở thị trường `market` → E.164 + dạng
 * hiển thị chuẩn, hoặc null khi KHÔNG phải số hợp lệ của thị trường đó:
 *   US: 10 số (có thể kèm +1 / 1 đầu), mã vùng và đầu số không bắt đầu bằng 0/1 → "(713) 555-0123"
 *   AU: 04xx xxx xxx · (02|03|07|08) xxxx xxxx · +61 (bỏ số 0 trung kế; "+61 (0)4…" vẫn nhận) → "0412 345 678" / "(02) 9123 4567";
 *       số doanh nghiệp 1300 / 1800 xxx xxx, 13 xx xx → "1300 655 506" / "13 12 34"
 */
export function parseMarketPhone(raw: unknown, market: string | null | undefined): MarketPhone | null {
  if (typeof raw !== "string") return null;
  const t = raw.normalize("NFKC").trim();
  if (!t || t.length > 40 || !PHONE_CHARS.test(t)) return null;
  const plus = t.startsWith("+");
  const d = t.replace(/\D/g, "");
  if (market === "AU") {
    let nat = "";
    if (plus) nat = d.startsWith("61") ? d.slice(2).replace(/^0/, "") : "";
    else if (d.length === 11 && d.startsWith("61")) nat = d.slice(2);
    else if (d.length === 10 && d.startsWith("0")) nat = d.slice(1);
    else if (AU_SERVICE.test(d)) nat = d;
    if (!AU_NATIONAL.test(nat)) return null;
    const display = nat.startsWith("1") ? auServiceDisplay(nat) : nat.startsWith("4") ? `0${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}` : `(0${nat[0]}) ${nat.slice(1, 5)} ${nat.slice(5)}`;
    return { e164: `+61${nat}`, display };
  }
  if (market !== "US") return null;
  let ten = "";
  if (plus) ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : "";
  else if (d.length === 10) ten = d;
  else if (d.length === 11 && d.startsWith("1")) ten = d.slice(1);
  if (!NANP.test(ten)) return null;
  return { e164: `+1${ten}`, display: `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` };
}

/** Lời nhắc khi số không hợp lệ cho thị trường đã chọn (form đăng tin + API trả cùng 1 câu). */
export function marketPhoneError(market: string | null | undefined): { vi: string; en: string } {
  return market === "AU"
    ? { vi: "Số điện thoại không đúng số Úc. Nhập số di động 04xx xxx xxx hoặc số bàn (02) xxxx xxxx.", en: "That isn't an Australian phone number. Enter a mobile like 0412 345 678 or a landline like (02) 9123 4567." }
    : { vi: "Số điện thoại không đúng số Mỹ. Nhập đủ 10 số, VD (713) 555-0123.", en: "That isn't a US phone number. Enter all 10 digits, e.g. (713) 555-0123." };
}

/**
 * Lúc HIỂN THỊ tin đã lưu (dữ liệu cũ chưa qua kiểm tra): chuỗi có chứa ít nhất 1 số có HÌNH DẠNG gọi được ở thị
 * trường đó không. Rộng hơn parseMarketPhone (giữ số có ghi chú kèm "713-555-0123 (chị Lan)", số mẫu (555) 000-…),
 * chỉ bắt số chắc chắn sai nước: "+1 03xxxxxxxx" (mã vùng bắt đầu bằng 0), số Anh 07xxx xxxxxx / +44 trong tin Mỹ…
 */
export function hasCallableNumber(raw: string | null | undefined, market: string | null | undefined): boolean {
  // Gạch nối Unicode (‐ ‑ ‒ – — ― −, hay gặp khi dán từ Word / Facebook) → "-" như parseMarketPhone vẫn nhận
  const t = String(raw ?? "").normalize("NFKC").replace(/[‐-―−]/g, "-");
  if (!t.trim()) return false;
  // Không dùng lookbehind "(?<!…)": file này vào bundle trình duyệt (trang tin, form đăng tin) — Safari < 16.4 báo lỗi cú
  // pháp cả chunk. Ký tự đứng trước số (không phải chữ số / "+") được bắt vào nhóm 1 thay cho lookbehind.
  // Úc: số có số 0 trung kế / +61 (nhóm 2) hoặc số doanh nghiệp 1300 / 1800 xxx xxx, 13 xx xx (KHÔNG thuộc nhóm 2 → vẫn
  // qua bước loại "đứng sau mã nước khác" bên dưới).
  const re = market === "AU"
    ? /(^|[^\d+])(?:(\+?61[\s.-]?(?:\(0\)\s?)?|\(?0)[2-478]\)?(?:[\s.-]?\d){8}|1[38]00(?:[\s.-]?\d){6}|13(?:[\s.-]?\d){4})(?!\d)/g
    : /(^|[^\d+])(\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;
  for (const m of t.matchAll(re)) {
    // "+44 747 333 5462": đúng hình dạng nhưng đứng sau mã nước khác → không tính
    if (!m[2] && /(?:\+|\b00)\s?\d{1,3}[\s.-]?$/.test(t.slice(0, (m.index ?? 0) + m[1].length))) continue;
    return true;
  }
  return false;
}
