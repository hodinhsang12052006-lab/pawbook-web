// RADAR TREND NAIL — danh mục trend ĐANG LÊN có nguồn (Pinterest Predicts 2026, báo cáo trend mùa / dịp lễ 2026),
// mỗi trend có "công thức" cụ thể (hoạ tiết + hiệu ứng + bảng màu + dáng) mà máy PawNail VẼ ĐƯỢC trên tay thật.
// Máy tạo mẫu (lib/designEngine) lấy ~1/2 số mẫu mỗi ngày từ radar, XOAY VÒNG theo ngày (mỗi ngày bộ trend khác),
// chỉ lấy trend đang trong mùa → kho "Mẫu nail" + Thử mẫu tự làm mới liên tục, không ai phải nhập tay.
// Số liệu tăng trưởng lấy đúng theo báo cáo đã công bố (ghi nguồn trong mô tả mẫu) — không tự bịa số.
// Thêm trend mới: thêm 1 mục vào TREND_RADAR (hoạ tiết phải nằm trong PROCEDURAL của lib/tryon/patterns).

export type Bi = { vi: string; en: string };
export type TrendFinish = "glossy" | "matte" | "chrome" | "cateye" | "glitter";
export interface TrendLook { pattern: string; finish: TrendFinish; colors: [string, string, string][]; shapes?: ("almond" | "coffin" | "square" | "oval" | "stiletto")[] }
export interface Trend {
  id: string;
  name: Bi;
  /** nguồn + số liệu (đúng như báo cáo) */
  source: Bi;
  /** tháng đang trong mùa (1–12); bỏ trống = quanh năm */
  months?: number[];
  /** gắn với dịp lễ (id chủ đề trong lib/contentEngine) — chỉ ra khi dịp đó đang / sắp diễn ra, mô tả nhắc đúng dịp */
  occasion?: string;
  /** độ "nóng" để chọn thường hơn (1–3) */
  weight: number;
  looks: TrendLook[];
}

const PP = (stat: string, statEn: string): Bi => ({ vi: `Pinterest Predicts 2026: ${stat}`, en: `Pinterest Predicts 2026: ${statEn}` });
const FALL = [9, 10, 11];
const HALLOWEEN = [10];
const XMAS = [11, 12];
const NYE = [12, 1];

export const TREND_RADAR: Trend[] = [
  // ---- Pinterest Predicts 2026 (báo cáo làm đẹp 2026 của Pinterest) ----
  { id: "polka-cat-eye", name: { vi: "Mắt mèo chấm bi", en: "Polka dot cat eye" }, source: PP("tìm kiếm \"polka dot cat eye nails\" +1.585%", "\"polka dot cat eye nails\" searches +1,585%"), weight: 3,
    looks: [{ pattern: "polka", finish: "cateye", colors: [["plumNoir", "white", "silver"], ["black", "white", "silver"], ["navy", "white", "silver"], ["burgundy", "pinkNude", "gold"]] }] },
  { id: "jelly-pink-chrome", name: { vi: "Hồng thạch tráng gương", en: "Jelly pink chrome" }, source: PP("\"jelly pink chrome nails\" +1.469%", "\"jelly pink chrome nails\" +1,469%"), weight: 3,
    looks: [{ pattern: "jelly", finish: "chrome", colors: [["hotPink", "white", "silver"], ["babyPink", "white", "pearl"], ["raspberry", "white", "silver"]], shapes: ["almond", "oval"] }] },
  { id: "milky-chrome", name: { vi: "Trắng sữa tráng gương (glazed)", en: "Milky white chrome" }, source: PP("\"milky white chrome nails almond\" +1.402%", "\"milky white chrome nails almond\" +1,402%"), weight: 3,
    looks: [{ pattern: "solid", finish: "chrome", colors: [["white", "pearl", "pearl"], ["cloudDancer", "pearl", "pearl"], ["sheer", "pearl", "pearl"]], shapes: ["almond"] }] },
  { id: "goth-cat-eye", name: { vi: "Mắt mèo gothic", en: "Goth cat eye" }, source: PP("\"goth cat eye nails\" +911%", "\"goth cat eye nails\" +911%"), weight: 2,
    looks: [{ pattern: "solid", finish: "cateye", colors: [["black", "silver", "silver"], ["plumNoir", "silver", "silver"], ["aubergine", "silver", "silver"]], shapes: ["almond", "stiletto", "coffin"] }] },
  { id: "aurora-cat-eye", name: { vi: "Mắt mèo aurora", en: "Aurora cat eye" }, source: PP("\"aurora cat eye nails\" +895%", "\"aurora cat eye nails\" +895%"), weight: 3,
    looks: [{ pattern: "auroracat", finish: "cateye", colors: [["black", "white", "silver"], ["navy", "white", "silver"], ["plumNoir", "white", "silver"]] }] },
  { id: "hot-pink-chrome", name: { vi: "Hồng cánh sen tráng gương", en: "Hot pink chrome" }, source: PP("\"hot pink chrome nails designs\" +884%", "\"hot pink chrome nails designs\" +884%"), weight: 2,
    looks: [{ pattern: "solid", finish: "chrome", colors: [["hotPink", "hotPink", "silver"], ["raspberry", "raspberry", "silver"]] }, { pattern: "chromefrench", finish: "glossy", colors: [["hotPink", "silver", "silver"]] }] },
  { id: "caramel-nude", name: { vi: "Nude caramel", en: "Caramel nude" }, source: PP("\"caramel nude nails\" +943%", "\"caramel nude nails\" +943%"), weight: 3,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["caramel", "white", "gold"]] }, { pattern: "french", finish: "glossy", colors: [["caramel", "white", "gold"], ["nude", "caramel", "gold"]] }, { pattern: "velvet", finish: "cateye", colors: [["caramel", "white", "gold"]] }] },
  { id: "coffee", name: { vi: "Nâu cà phê", en: "Coffee nails" }, source: PP("\"coffee nails ideas\" +922%", "\"coffee nails ideas\" +922%"), weight: 3,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["coffee", "white", "gold"], ["espresso", "nude", "gold"]] }, { pattern: "ombre", finish: "glossy", colors: [["nude", "coffee", "gold"]] }, { pattern: "velvet", finish: "cateye", colors: [["coffee", "white", "gold"]] }] },
  { id: "raspberry-jelly", name: { vi: "Thạch mâm xôi", en: "Raspberry jelly" }, source: PP("\"raspberry jelly nails\" +828%", "\"raspberry jelly nails\" +828%"), weight: 2,
    looks: [{ pattern: "jelly", finish: "glossy", colors: [["raspberry", "white", "gold"], ["strawberry", "white", "gold"]] }] },
  { id: "dark-red-cat-eye", name: { vi: "Mắt mèo đỏ sẫm", en: "Dark red cat eye" }, source: PP("\"dark red cat eye nails design\" +735%", "\"dark red cat eye nails design\" +735%"), weight: 2,
    looks: [{ pattern: "solid", finish: "cateye", colors: [["burgundy", "gold", "gold"], ["mulledWine", "gold", "gold"], ["cherry", "silver", "silver"]] }] },
  { id: "cat-eye-chrome", name: { vi: "Mắt mèo + đầu tráng gương", en: "Cat eye & chrome" }, source: PP("\"cat eye and chrome nails\" +732%", "\"cat eye and chrome nails\" +732%"), weight: 2,
    looks: [{ pattern: "chromefrench", finish: "cateye", colors: [["plumNoir", "silver", "silver"], ["navy", "silver", "silver"], ["burgundy", "gold", "gold"]] }] },
  { id: "almond-stripes", name: { vi: "Móng hạnh nhân kẻ sọc", en: "Almond stripes" }, source: PP("\"almond nails stripes\" +694%", "\"almond nails stripes\" +694%"), weight: 2,
    looks: [{ pattern: "stripes", finish: "glossy", colors: [["pinkNude", "white", "gold"], ["cloudDancer", "coffee", "gold"], ["nude", "black", "gold"]], shapes: ["almond"] }] },
  { id: "two-tone-cat-eye", name: { vi: "Mắt mèo 2 tông", en: "Two-tone cat eye" }, source: PP("\"two tone cat eye nails\" +515%", "\"two tone cat eye nails\" +515%"), weight: 2,
    looks: [{ pattern: "mixmatch", finish: "cateye", colors: [["plumNoir", "navy", "silver"], ["burgundy", "plumNoir", "gold"], ["coolBlue", "periwinkle", "silver"]] }] },
  { id: "jade-marble", name: { vi: "Vân đá ngọc bích", en: "Jade marble" }, source: PP("\"jade marble nails\" +450%", "\"jade marble nails\" +450%"), weight: 2,
    looks: [{ pattern: "marble", finish: "glossy", colors: [["jade", "white", "gold"], ["jade", "white", "silver"]] }] },
  { id: "gothic-chrome", name: { vi: "Chrome gothic", en: "Gothic chrome" }, source: PP("\"gothic chrome nails\" +400%", "\"gothic chrome nails\" +400%"), weight: 1,
    looks: [{ pattern: "solid", finish: "chrome", colors: [["black", "black", "silver"], ["aubergine", "aubergine", "silver"]], shapes: ["stiletto", "almond"] }] },
  { id: "cool-blue", name: { vi: "Xanh băng", en: "Cool blue" }, source: PP("màu xanh băng tăng 235% lượt tìm", "cool blue searches +235%"), weight: 2,
    looks: [{ pattern: "solid", finish: "chrome", colors: [["coolBlue", "coolBlue", "silver"]] }, { pattern: "aura", finish: "glossy", colors: [["white", "coolBlue", "silver"]] }, { pattern: "french", finish: "glossy", colors: [["sheer", "coolBlue", "silver"]] }] },
  { id: "plum-noir", name: { vi: "Tím mận đậm", en: "Plum noir" }, source: PP("tím mận đậm tăng 220% lượt tìm", "plum noir searches +220%"), weight: 2,
    looks: [{ pattern: "velvet", finish: "cateye", colors: [["plumNoir", "white", "gold"]] }, { pattern: "solid", finish: "glossy", colors: [["plumNoir", "white", "gold"]] }] },
  { id: "wasabi", name: { vi: "Xanh wasabi", en: "Wasabi green" }, source: PP("xanh wasabi tăng 175% lượt tìm", "wasabi green searches +175%"), weight: 1,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["wasabi", "white", "gold"]] }, { pattern: "french", finish: "glossy", colors: [["sheer", "wasabi", "gold"]] }] },
  { id: "blood-orange", name: { vi: "Cam đỏ (persimmon)", en: "Blood orange / persimmon" }, source: PP("\"blood orange nails\" +161%", "\"blood orange nails\" +161%"), weight: 1,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["persimmon", "white", "gold"]] }, { pattern: "jelly", finish: "glossy", colors: [["persimmon", "white", "gold"]] }] },
  { id: "choco-strawberry", name: { vi: "Dâu nhúng sô-cô-la", en: "Chocolate-covered strawberry" }, source: PP("1 trong các màu nail Pinterest dự báo cho 2026", "one of Pinterest's predicted nail looks for 2026"), weight: 2,
    looks: [{ pattern: "chocodip", finish: "glossy", colors: [["strawberry", "chocolate", "gold"], ["babyPink", "chocolate", "gold"]] }] },
  { id: "cloud-dancer", name: { vi: "Trắng mây (màu Pantone 2026)", en: "Cloud Dancer (Pantone 2026)" }, source: { vi: "Màu của năm Pantone 2026: Cloud Dancer", en: "Pantone Colour of the Year 2026: Cloud Dancer" }, weight: 2,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["cloudDancer", "white", "gold"]] }, { pattern: "french", finish: "glossy", colors: [["sheer", "cloudDancer", "gold"]] }, { pattern: "pearls", finish: "glossy", colors: [["cloudDancer", "white", "pearl"]] }] },

  // ---- Thu 2026 (báo cáo trend mùa thu 2026: nâu sô-cô-la, tím mận, lavender, velvet, micro French, chấm nhỏ, đồi mồi mảnh, da hươu) ----
  { id: "fall-chocolate", occasion: "fall", name: { vi: "Nâu sô-cô-la thu 2026", en: "Fall 2026 chocolate" }, source: { vi: "Trend thu 2026: \"sô-cô-la là màu đen mới\"", en: "Fall 2026: \"chocolate is the new black\"" }, months: FALL, weight: 3,
    looks: [{ pattern: "velvet", finish: "cateye", colors: [["chocolate", "white", "gold"]] }, { pattern: "solid", finish: "glossy", colors: [["chocolate", "white", "gold"]] }, { pattern: "french", finish: "glossy", colors: [["nude", "chocolate", "gold"]] }] },
  { id: "fall-lavender-velvet", occasion: "fall", name: { vi: "Lavender velvet", en: "Lavender velvet" }, source: { vi: "Trend thu 2026: lavender chính thức vào mùa thu, velvet là hiệu ứng hot", en: "Fall 2026: lavender moves into fall, velvet is the hot finish" }, months: FALL, weight: 2,
    looks: [{ pattern: "velvet", finish: "cateye", colors: [["lavender", "white", "silver"], ["plum", "white", "gold"]] }] },
  { id: "fall-tortoise", occasion: "fall", name: { vi: "Đồi mồi nhiều tông", en: "Fine tortoiseshell" }, source: { vi: "Trend thu 2026: đồi mồi mảnh, pha 3–4 tông", en: "Fall 2026: finer tortoiseshell blending 3–4 tones" }, months: FALL, weight: 2,
    looks: [{ pattern: "tortoise", finish: "glossy", colors: [["caramel", "chocolate", "gold"]] }] },
  { id: "fall-fawn", occasion: "fall", name: { vi: "Da hươu (fawn)", en: "Fawn print" }, source: { vi: "Trend thu 2026: animal print mềm — da hươu", en: "Fall 2026: soft animal print — fawn" }, months: FALL, weight: 2,
    looks: [{ pattern: "fawn", finish: "glossy", colors: [["caramel", "cloudDancer", "gold"], ["coffee", "nude", "gold"]] }] },
  { id: "fall-micro-dots", occasion: "fall", name: { vi: "Chấm nhỏ tối giản", en: "Minimal tiny dots" }, source: { vi: "Trend thu 2026: móng ngắn, hoạ tiết nhỏ mà tinh", en: "Fall 2026: short nails, small but impactful art" }, months: FALL, weight: 1,
    looks: [{ pattern: "polka", finish: "glossy", colors: [["nude", "chocolate", "gold"], ["cloudDancer", "burgundy", "gold"]], shapes: ["oval", "square"] }] },

  // ---- Halloween 2026: "moody luxe" — 1 hoạ tiết nhỏ trên nền đen / đỏ rượu / tím cà, cam cháy thay cam chói ----
  { id: "hw-web", occasion: "halloween", name: { vi: "Mạng nhện tối giản", en: "Minimal spiderweb" }, source: { vi: "Halloween 2026: \"moody luxe\" — 1 hoạ tiết trên nền đen bóng", en: "Halloween 2026: \"moody luxe\" — one motif on glossy black" }, months: HALLOWEEN, weight: 2,
    looks: [{ pattern: "web", finish: "glossy", colors: [["black", "white", "silver"], ["mulledWine", "white", "silver"]] }] },
  { id: "hw-bats", occasion: "halloween", name: { vi: "Dơi bạc", en: "Silver bats" }, source: { vi: "Halloween 2026: dơi / bí ngô / ma nhỏ trên nền trơn", en: "Halloween 2026: tiny bats, pumpkins, ghosts on a plain base" }, months: HALLOWEEN, weight: 2,
    looks: [{ pattern: "bats", finish: "glossy", colors: [["aubergine", "white", "silver"], ["black", "white", "gold"]] }] },
  { id: "hw-ghost", occasion: "halloween", name: { vi: "Ma nhỏ dễ thương", en: "Cute ghosts" }, source: { vi: "Halloween 2026: dơi / bí ngô / ma nhỏ trên nền trơn", en: "Halloween 2026: tiny bats, pumpkins, ghosts on a plain base" }, months: HALLOWEEN, weight: 2,
    looks: [{ pattern: "ghost", finish: "glossy", colors: [["black", "white", "silver"], ["plumNoir", "white", "silver"]] }] },
  { id: "hw-pumpkin", occasion: "halloween", name: { vi: "Bí ngô mini", en: "Mini pumpkins" }, source: { vi: "Halloween 2026: dơi / bí ngô / ma nhỏ trên nền trơn", en: "Halloween 2026: tiny bats, pumpkins, ghosts on a plain base" }, months: HALLOWEEN, weight: 1,
    looks: [{ pattern: "jackolantern", finish: "glossy", colors: [["nude", "white", "gold"], ["black", "white", "gold"]] }] },
  { id: "hw-moon", occasion: "halloween", name: { vi: "Trăng & sao", en: "Moon & stars" }, source: { vi: "Halloween 2026: trăng khuyết trên nền đậm", en: "Halloween 2026: moon phases on a deep base" }, months: HALLOWEEN, weight: 1,
    looks: [{ pattern: "moonstars", finish: "glossy", colors: [["navy", "white", "gold"], ["mulledWine", "white", "gold"]] }] },
  { id: "hw-moody", occasion: "halloween", name: { vi: "Cam cháy / đỏ rượu ấm", en: "Burnt orange & mulled wine" }, source: { vi: "Halloween 2026: cam cháy, đỏ rượu ấm, tím cà thay cam chói", en: "Halloween 2026: burnt orange, mulled wine, aubergine replace traffic-cone orange" }, months: HALLOWEEN, weight: 1,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["burnt", "white", "gold"], ["mulledWine", "white", "gold"]] }, { pattern: "solid", finish: "cateye", colors: [["aubergine", "gold", "gold"]] }] },

  // ---- Giáng sinh / năm mới 2026 ----
  { id: "xmas-tartan", occasion: "christmas", name: { vi: "Caro tartan", en: "Tartan" }, source: { vi: "Giáng sinh 2026: caro tartan / bàn cờ là trend phải thử", en: "Christmas 2026: tartan and checkerboard are must-tries" }, months: XMAS, weight: 2,
    looks: [{ pattern: "plaid", finish: "glossy", colors: [["velvet", "pine", "gold"], ["cherry", "pine", "gold"]] }, { pattern: "checker", finish: "glossy", colors: [["white", "cherry", "gold"]] }] },
  { id: "xmas-candy", occasion: "christmas", name: { vi: "Sọc kẹo gậy", en: "Candy cane" }, source: { vi: "Giáng sinh 2026: French kẹo gậy", en: "Christmas 2026: candy-cane accents" }, months: XMAS, weight: 1,
    looks: [{ pattern: "candy", finish: "glossy", colors: [["white", "cherry", "gold"]] }] },
  { id: "xmas-snow", occasion: "christmas", name: { vi: "Bông tuyết", en: "Snowflakes" }, source: { vi: "Giáng sinh 2026: bông tuyết tinh tế", en: "Christmas 2026: delicate snowflakes" }, months: XMAS, weight: 2,
    looks: [{ pattern: "snow", finish: "glossy", colors: [["coolBlue", "white", "silver"], ["navy", "white", "silver"], ["cherry", "white", "silver"]] }] },
  { id: "xmas-red", occasion: "christmas", name: { vi: "Đỏ Giáng sinh lấp lánh", en: "Sparkly Christmas red" }, source: { vi: "Giáng sinh 2026: đỏ trầm + nhũ / chrome", en: "Christmas 2026: deep red with glitter or chrome" }, months: XMAS, weight: 2,
    looks: [{ pattern: "solid", finish: "glitter", colors: [["cherry", "gold", "gold"]] }, { pattern: "velvet", finish: "cateye", colors: [["velvet", "white", "gold"]] }, { pattern: "solid", finish: "chrome", colors: [["cherry", "cherry", "gold"]] }] },
  { id: "xmas-bow", occasion: "christmas", name: { vi: "Nơ bạc 3D", en: "3D silver bows" }, source: { vi: "Giáng sinh 2026: nơ 3D + caro", en: "Christmas 2026: 3D bows with tartan" }, months: XMAS, weight: 1,
    looks: [{ pattern: "charm3d", finish: "glossy", colors: [["cherry", "white", "silver"], ["babyPink", "white", "silver"]] }] },
  { id: "nye-sparkle", occasion: "newyear", name: { vi: "Lấp lánh đêm giao thừa", en: "New Year's Eve sparkle" }, source: { vi: "Năm mới: bạc / vàng tráng gương, sao, foil", en: "New Year: silver and gold chrome, stars, foil" }, months: NYE, weight: 2,
    looks: [{ pattern: "stars", finish: "glossy", colors: [["black", "white", "gold"], ["navy", "white", "silver"]] }, { pattern: "foil", finish: "glossy", colors: [["black", "white", "gold"]] }, { pattern: "solid", finish: "chrome", colors: [["silver", "silver", "silver"]] }] },
];

/** Trend đang trong mùa của ngày đó. */
export function activeTrends(date: Date): Trend[] {
  const m = date.getUTCMonth() + 1;
  return TREND_RADAR.filter((t) => !t.months || t.months.includes(m));
}
