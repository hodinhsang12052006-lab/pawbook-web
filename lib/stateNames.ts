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

// Đủ 50 bang + DC: tin tổng hợp có cả MN, MT, ND… — trước đây chỉ 10 bang lớn nên hiện trơ "MN" (17/10/2026).
const US_ALL: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington DC",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
  NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const AU_ALL: Record<string, string> = { ...AU_STATE_NAMES, TAS: "Tasmania", NT: "Northern Territory" };

export function stateName(market: "US" | "AU", code: string | null | undefined): string {
  if (!code) return "";
  const c = code.trim().toUpperCase();
  return market === "AU" ? AU_ALL[c] || code : US_ALL[c] || code;
}
/** Tên đầy đủ khi không biết thị trường (mã Úc 3 chữ ưu tiên Úc; "WA" coi là Washington). */
export const anyStateName = (code: string | null | undefined): string =>
  !code ? "" : US_ALL[code.trim().toUpperCase()] || AU_ALL[code.trim().toUpperCase()] || "";

/** "Houston, Texas" — bỏ phần trống để không ra ", Georgia" khi tin thiếu thành phố. */
// Tool cào hay ghi thành phố = mã bang ("MN") → bỏ phần thành phố trùng, không ra "MN, Minnesota".
export function placeLabel(city: string | null | undefined, market: "US" | "AU", code: string | null | undefined): string {
  const st = stateName(market, code);
  const c = city?.trim() || "";
  const dup = !!c && (c.toUpperCase() === String(code || "").toUpperCase() || c.toLowerCase() === st.toLowerCase());
  return [dup ? "" : c, st].filter(Boolean).join(", ");
}
