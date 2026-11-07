// Bộ sticker theo mùa: hiện theo NGÀY ĐỊA PHƯƠNG của người xem + thị trường (Mỹ / Úc — mùa ngược nhau).
// Cửa sổ tính cả 2 đầu. THUẦN (không đọc giờ hệ thống) để kiểm thử được: truyền ngày vào.
import { SEASON_PACKS, TET_ZODIAC, type Season, type StickerPack } from "./packs";

export type StickerMarket = "US" | "AU";

/** Ngày Tết (mùng 1) theo dương lịch. */
export const TET_DATES: Record<number, string> = { 2027: "2027-02-06", 2028: "2028-01-26", 2029: "2029-02-13", 2030: "2030-02-03" };
/** Rằm tháng 8 (Trung thu). */
export const MIDAUTUMN_DATES: Record<number, string> = { 2027: "2027-09-15", 2028: "2028-10-03", 2029: "2029-09-22", 2030: "2030-09-12" };

const DAY = 86_400_000;
/** Ngày (không giờ) dưới dạng số ngày UTC — so sánh / cộng trừ ngày không lệch múi giờ. */
const dayNum = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / DAY);
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return dayNum(y, m, d);
};
/** Thứ Năm thứ 4 của tháng 11 (Lễ Tạ ơn ở Mỹ). */
export function thanksgivingDay(year: number): number {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay(); // 0 = CN
  const firstThu = 1 + ((4 - first + 7) % 7);
  return dayNum(year, 11, firstThu + 21);
}
/** Chủ nhật thứ 2 của tháng 5 (Ngày của Mẹ — cả Mỹ lẫn Úc). */
export function mothersDay(year: number): number {
  const first = new Date(Date.UTC(year, 4, 1)).getUTCDay();
  const firstSun = 1 + ((7 - first) % 7);
  return dayNum(year, 5, firstSun + 7);
}

type Rule = { season: Season; markets: StickerMarket[] | "all"; windows: (year: number) => [number, number][] };
const ALL: StickerMarket[] | "all" = "all";
// Thứ tự = thứ tự hiện trên thanh bộ sticker (cụ thể trước, chung sau).
const RULES: Rule[] = [
  { season: "halloween", markets: ["US", "AU"], windows: (y) => [[dayNum(y, 10, 15), dayNum(y, 10, 31)]] },
  { season: "thanksgiving_us", markets: ["US"], windows: (y) => [[dayNum(y, 11, 1), thanksgivingDay(y) + 1]] },
  { season: "fall_us", markets: ["US"], windows: (y) => [[dayNum(y, 9, 22), dayNum(y, 11, 30)]] },
  { season: "spring_au", markets: ["AU"], windows: (y) => [[dayNum(y, 9, 1), dayNum(y, 11, 30)]] },
  { season: "christmas_us", markets: ["US"], windows: (y) => [[dayNum(y, 12, 1), dayNum(y, 12, 26)]] },
  { season: "christmas_au", markets: ["AU"], windows: (y) => [[dayNum(y, 12, 1), dayNum(y, 12, 26)]] },
  // qua năm mới: 26/12 năm trước → 7/1
  { season: "newyear", markets: ALL, windows: (y) => [[dayNum(y, 12, 26), dayNum(y + 1, 1, 7)], [dayNum(y - 1, 12, 26), dayNum(y, 1, 7)]] },
  { season: "tet", markets: ALL, windows: (y) => (TET_DATES[y] ? [[fromIso(TET_DATES[y]) - 21, fromIso(TET_DATES[y]) + 15]] : []) },
  { season: "valentine", markets: ALL, windows: (y) => [[dayNum(y, 2, 1), dayNum(y, 2, 14)]] },
  { season: "women", markets: ALL, windows: (y) => [[dayNum(y, 3, 1), dayNum(y, 3, 8)], [dayNum(y, 10, 13), dayNum(y, 10, 20)]] },
  { season: "mothers_day", markets: ["US", "AU"], windows: (y) => [[mothersDay(y) - 7, mothersDay(y)]] },
  { season: "midautumn", markets: ALL, windows: (y) => (MIDAUTUMN_DATES[y] ? [[fromIso(MIDAUTUMN_DATES[y]) - 14, fromIso(MIDAUTUMN_DATES[y]) + 1]] : []) },
];

/** Ngày địa phương của 1 Date → [năm, tháng, ngày]. */
export function localYmd(d: Date): [number, number, number] {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}

/** Các mùa đang diễn ra vào ngày (y, m, d) cho thị trường này, theo thứ tự hiển thị. */
export function activeSeasonsOn(ymd: [number, number, number], market: StickerMarket): Season[] {
  const [y, m, d] = ymd;
  const today = dayNum(y, m, d);
  const out: Season[] = [];
  for (const r of RULES) {
    if (r.markets !== "all" && !r.markets.includes(market)) continue;
    // cửa sổ có thể thuộc năm nay hoặc năm sau (Tết tháng 1 bắt đầu từ tháng 1; newyear qua năm)
    const wins = [...r.windows(y), ...r.windows(y + 1)];
    if (wins.some(([a, b]) => today >= a && today <= b)) out.push(r.season);
  }
  return out;
}

export function activeSeasons(date: Date, market: StickerMarket): Season[] {
  return activeSeasonsOn(localYmd(date), market);
}

/** Năm âm lịch của Tết gần nhất đang trong cửa sổ (để chèn con giáp). */
function tetYearFor(ymd: [number, number, number]): number | null {
  const today = dayNum(...ymd);
  for (const y of [ymd[0], ymd[0] + 1]) {
    const iso = TET_DATES[y];
    if (iso && today >= fromIso(iso) - 21 && today <= fromIso(iso) + 15) return y;
  }
  return null;
}

/** Bộ Tết kèm con giáp của năm (chèn ở vị trí thứ 4). Năm không có trong bảng → bộ gốc. */
export function tetPackFor(year: number | null, base: StickerPack): StickerPack {
  const z = year != null ? TET_ZODIAC[year] : undefined;
  if (!z) return base;
  const items = [...base.items];
  items.splice(3, 0, z);
  return { ...base, items };
}

/** Bộ mùa đang hiện (theo thứ tự hiển thị). */
export function activeSeasonPacks(date: Date, market: StickerMarket): StickerPack[] {
  const ymd = localYmd(date);
  return activeSeasonsOn(ymd, market)
    .map((s) => SEASON_PACKS.find((p) => p.season === s))
    .filter((p): p is StickerPack => !!p)
    .map((p) => (p.season === "tet" ? tetPackFor(tetYearFor(ymd), p) : p));
}

/** Năm Tết đang tới (để chèn con giáp khi tìm kiếm bộ Tết ngoài mùa). */
export function upcomingTetYear(date: Date): number | null {
  const today = dayNum(...localYmd(date));
  const years = Object.keys(TET_DATES).map(Number).sort((a, b) => a - b);
  for (const y of years) if (fromIso(TET_DATES[y]) + 15 >= today) return y;
  return null;
}
