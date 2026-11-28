// Tách số liệu của bài SANG / BÁN tiệm nail (mục Sang tiệm): giá sang, tiền thuê, doanh thu, ghế, bàn, diện tích.
// Thuần (không đọc DB) — dùng cho bài từ nhóm cộng đồng (bot) và kiểm thử. Không đoán bừa: không thấy → null.
//   "Giá sang: $120k" · "sang lại 85,000" · "asking $95K" · "Rent: $1,950 / tháng" · "In Come: $500k/ năm" ·
//   "8 ghế spa + 1 ghế em bé" · "8 bàn làm tay" · "1,400 sqft"

export interface SaleDetails {
  askingPrice: number | null;
  monthlyRent: number | null;
  monthlyRevenue: number | null;
  chairs: number | null;
  tables: number | null;
  sqft: number | null;
}

// Số tiền: "$120k", "120K", "$1.2M", "$120,000", "85.000", "1tr2"? (không — bài Mỹ / Úc ghi $) · trả về số nguyên.
// Hậu tố k / M không được dính chữ phía sau ("18,000 mỗi tháng": "m" của "mỗi" không phải triệu) — gồm chữ có dấu.
const MONEY = String.raw`\$?\s?(\d{1,3}(?:[,.]\d{3})+|\d+(?:[.,]\d+)?)\s*(?:(k|K|m|M|ngh[ìi]n|ng[àa]n)(?![A-Za-zÀ-ỹ\d]))?`;

export function moneyValue(num: string, suffix?: string | null): number | null {
  let s = num.trim();
  // "120,000" / "85.000" (dấu nhóm nghìn) → bỏ; "1.2" + M → thập phân
  if (/^\d{1,3}([,.]\d{3})+$/.test(s)) s = s.replace(/[,.]/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const u = (suffix || "").toLowerCase();
  const v = u === "k" || /^ngh|^ng/.test(u) ? n * 1000 : u === "m" ? n * 1_000_000 : n;
  return Math.round(v);
}

const firstMoney = (text: string, labels: string, after = ""): { value: number; tail: string } | null => {
  const re = new RegExp(`(?:${labels})\\s*(?:là|la|is|of|khoảng|khoang|about|~)?\\s*[:=\\-–]?\\s*${MONEY}${after}`, "i");
  const m = text.match(re);
  if (!m) return null;
  const v = moneyValue(m[1], m[2]);
  return v == null ? null : { value: v, tail: m[3] ?? "" };
};

const PRICE_LABELS = String.raw`gi[áa]\s*sang|gi[áa]\s*b[áa]n|(?:b[áa]n|sang)\s*ti[ệe]m(?:\s*nails?)?|sang\s*(?:l[ạa]i\s*)?(?:v[ớo]i\s*)?(?:gi[áa]\s*)?|b[áa]n\s*(?:l[ạa]i\s*)?(?:v[ớo]i\s*)?(?:gi[áa]\s*)?|asking(?:\s*price)?|price|gi[áa]`;
const RENT_LABELS = String.raw`rent|ti[ềe]n\s*thu[êe](?:\s*nh[àa])?|thu[êe](?:\s*nh[àa])?|ti[ềe]n\s*nh[àa]|lease`;
const REVENUE_LABELS = String.raw`in\s*come|income|doanh\s*thu|thu\s*nh[ậa]p|revenue|gross|sales|thu\s*v[ôo]`;
const PERIOD = String.raw`\s*(?:\+\s*)?(?:\/|m[ộo]t|1|m[ỗo]i|per|a)?\s*(n[ăa]m|year|yr|th[áa]ng|month|mo|tu[ầa]n|week|wk)?`;

/** Doanh thu quy ra / tháng: ghi theo năm → /12, theo tuần → ×52/12; không ghi kỳ → ≥ 150k coi là / năm. */
function perMonth(value: number, period: string): number {
  const p = period.toLowerCase();
  if (/^(n|y)/.test(p)) return Math.round(value / 12);
  if (/^(tu|w)/.test(p)) return Math.round((value * 52) / 12);
  if (/^(th|mo)/.test(p)) return value;
  return value >= 150_000 ? Math.round(value / 12) : value;
}

const count = (text: string, re: RegExp, max: number) => {
  let best: number | null = null;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n <= max) best = Math.max(best ?? 0, n);
  }
  return best;
};

export function parseSaleDetails(raw: string): SaleDetails {
  // Bỏ SĐT trước (10 số liền / 3-3-4) để không thành "giá" / "diện tích".
  const text = String(raw || "")
    .normalize("NFKC")
    .replace(/(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g, " ")
    .replace(/[ \t]+/g, " ");

  const rentHit = firstMoney(text, RENT_LABELS, PERIOD);
  let monthlyRent = rentHit ? (/^(n|y)/i.test(rentHit.tail) ? Math.round(rentHit.value / 12) : rentHit.value) : null;
  if (monthlyRent != null && (monthlyRent < 200 || monthlyRent > 100_000)) monthlyRent = null;

  const revHit = firstMoney(text, REVENUE_LABELS, PERIOD);
  let monthlyRevenue = revHit ? perMonth(revHit.value, revHit.tail) : null;
  if (monthlyRevenue != null && (monthlyRevenue < 1_000 || monthlyRevenue > 2_000_000)) monthlyRevenue = null;

  // Giá sang: dòng có nhãn giá; bỏ các dòng tiền thuê / doanh thu để "giá" không bắt nhầm số của chúng.
  // Tách theo dòng VÀ theo vế câu (", " / "; " / ". ") — "Bán tiệm 95K, doanh thu 18,000 mỗi tháng" nằm trên 1 dòng.
  // (Không tách ở "18,000" / "1.2M": dấu phẩy / chấm đứng giữa chữ số.)
  const priceText = text
    .split(/\n|[;,.](?=\s)/)
    .filter((l) => !new RegExp(`(${RENT_LABELS}|${REVENUE_LABELS})`, "i").test(l) || /gi[áa]\s*sang|asking/i.test(l))
    .join("\n");
  const priceHit = firstMoney(priceText, PRICE_LABELS);
  let askingPrice = priceHit?.value ?? null;
  if (askingPrice != null && (askingPrice < 5_000 || askingPrice > 10_000_000)) askingPrice = null;

  const chairs = count(text, /(\d{1,2})\s*(?:c[áa]i\s*)?(?:gh[ếe]\s*(?:spa|pedi|pedicure|l[àa]m\s*ch[âa]n|ng[âa]m\s*ch[âa]n)|(?:spa|pedi(?:cure)?)\s*chairs?)/gi, 40);
  const tables = count(text, /(\d{1,2})\s*(?:c[áa]i\s*)?(?:b[àa]n\s*(?:l[àa]m\s*)?(?:tay|nail|móng|mong|manicure)?|(?:mani(?:cure)?|nail)\s*(?:tables?|stations?))(?![a-zà-ỹ])/gi, 40);
  let sqft = count(text.replace(/(\d),(\d{3})/g, "$1$2"), /(\d{3,5})\s*(?:sq\.?\s*ft|sqft|sf\b|square\s*feet|feet\s*vu[ôo]ng|ft2)/gi, 20_000);
  if (sqft != null && sqft < 200) sqft = null;

  return { askingPrice, monthlyRent, monthlyRevenue, chairs, tables, sqft };
}

/** "$120,000" / "$120K" (gọn) theo thị trường. */
export function formatMoney(n: number | null | undefined, market: "US" | "AU" = "US", short = false): string {
  if (n == null || !Number.isFinite(n)) return "";
  const cur = market === "AU" ? "A$" : "$";
  if (short && n >= 1_000_000) return `${cur}${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (short && n >= 10_000) return `${cur}${Math.round(n / 1000)}K`;
  return `${cur}${Math.round(n).toLocaleString("en-US")}`;
}
