// Thị trường của NGƯỜI XEM (Mỹ / Úc) — chọn danh sách bang, đầu số điện thoại, tiệm "gần bạn", mùa,
// chính tả (color / colour) và định dạng ngày. Dùng chung máy chủ + trình duyệt (THUẦN, không import prisma).
//
// Thứ tự chọn khi người xem chưa chọn (và chưa đăng nhập):
//   1. quốc gia theo IP (x-vercel-ip-country / CF-IPCountry) — chỉ máy chủ thấy → GET /api/market
//   2. vùng của Accept-Language / navigator.languages ("en-AU")
//   3. múi giờ của trình duyệt (Australia/*)
//   4. mặc định Mỹ
// Lựa chọn được nhớ trong cookie bitpaw_market (máy chủ đặt qua /api/market, Max-Age 1 năm) + localStorage.
// Người đã đăng nhập: luôn theo market của tài khoản.

export type Market = "US" | "AU";
export const MARKETS: readonly Market[] = ["US", "AU"];
export const MARKET_COOKIE = "bitpaw_market";
export const MARKET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isMarket = (v: unknown): v is Market => v === "US" || v === "AU";

/** Mã quốc gia ISO → thị trường. New Zealand đi chung với Úc (gần nhất về mùa, chính tả, đầu số). */
export function marketFromCountry(cc: string | null | undefined): Market | null {
  const c = String(cc ?? "").trim().toUpperCase();
  if (c === "AU" || c === "NZ") return "AU";
  if (c === "US" || c === "PR" || c === "GU" || c === "VI" || c === "AS" || c === "MP") return "US";
  return null;
}

/** "en-AU,en;q=0.9" → AU · "vi-VN,en-US;q=0.8" → US (vùng ĐẦU TIÊN là Mỹ/Úc thắng). */
export function marketFromLanguages(langs: readonly string[] | string | null | undefined): Market | null {
  const list = Array.isArray(langs) ? langs : String(langs ?? "").split(",").map((s) => s.split(";")[0]);
  for (const l of list) {
    const m = /^[a-z]{2,3}[-_]([a-z]{2})\b/i.exec(String(l).trim());
    const market = m ? marketFromCountry(m[1]) : null;
    if (market) return market;
  }
  return null;
}

/** Múi giờ IANA → thị trường ("Australia/Sydney" → AU, "America/Chicago" → US). */
export function marketFromTimeZone(tz: string | null | undefined): Market | null {
  const z = String(tz ?? "");
  if (/^Australia\//.test(z) || /^Pacific\/(Auckland|Chatham)$/.test(z) || z === "NZ") return "AU";
  if (/^(America\/(New_York|Detroit|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Boise|Indiana|Kentucky|North_Dakota|Juneau|Sitka|Nome|Adak|Menominee|Metlakatla|Yakutat|Puerto_Rico)|Pacific\/Honolulu|US\/)/.test(z)) return "US";
  return null;
}

/** Máy chủ: cookie → IP → Accept-Language → null. */
export function marketFromHeaders(get: (name: string) => string | null | undefined): { market: Market | null; source: "cookie" | "ip" | "language" | null } {
  const cookie = get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${MARKET_COOKIE}=(US|AU)(?:;|$)`));
  if (m) return { market: m[1] as Market, source: "cookie" };
  const ip = marketFromCountry(get("x-vercel-ip-country") || get("cf-ipcountry"));
  if (ip) return { market: ip, source: "ip" };
  const lang = marketFromLanguages(get("accept-language"));
  if (lang) return { market: lang, source: "language" };
  return { market: null, source: null };
}

// ---- Trình duyệt ----

export function readMarketCookie(): Market | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${MARKET_COOKIE}=(US|AU)(?:;|$)`));
  return m ? (m[1] as Market) : null;
}

/** Đoán tại trình duyệt (không có IP): ngôn ngữ trình duyệt → múi giờ → null. */
export function guessMarketInBrowser(): Market | null {
  if (typeof navigator === "undefined") return null;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const byLang = marketFromLanguages(langs);
  if (byLang) return byLang;
  try {
    return marketFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}
