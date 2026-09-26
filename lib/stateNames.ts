// Tên đầy đủ cho các mã bang viết tắt dùng trong toàn app — dữ liệu/lọc
// vẫn lưu và so khớp bằng MÃ VIẾT TẮT (CA, TX, NSW...) để tương thích với
// dữ liệu đã seed + DEMAND_SIGNAL trong lib/nailRadarData.ts, chỉ đổi
// PHẦN HIỂN THỊ sang tên đầy đủ cho người dùng dễ đọc.
//
// Lưu ý "WA" trùng mã giữa Washington (US) và Western Australia (AU) — luôn
// tra theo đúng market, không dùng chung 1 bảng cho cả 2 quốc gia.

export const US_STATE_NAMES: Record<string, string> = {
  CA: "California",
  TX: "Texas",
  FL: "Florida",
  NY: "New York",
  WA: "Washington",
  GA: "Georgia",
  NC: "North Carolina",
  VA: "Virginia",
  AZ: "Arizona",
  IL: "Illinois",
};

export const AU_STATE_NAMES: Record<string, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  ACT: "Australian Capital Territory",
};

export function stateName(market: "US" | "AU", code: string | null | undefined): string {
  if (!code) return "";
  const table = market === "AU" ? AU_STATE_NAMES : US_STATE_NAMES;
  return table[code] || code;
}
