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
  /** mùa theo bán cầu (thu / xuân…): ở Úc lệch 6 tháng (tháng 10 ở Úc là mùa xuân) */
  hemi?: boolean;
  /** chỉ ra ở các thị trường này (Giáng sinh mùa hè chỉ ở Úc; nhung / caro / tuyết chỉ ở Mỹ) */
  markets?: ("US" | "AU")[];
  /** độ "nóng" để chọn thường hơn (1–3) */
  weight: number;
  looks: TrendLook[];
}

const PP = (stat: string, statEn: string): Bi => ({ vi: `Pinterest Predicts 2026: ${stat}`, en: `Pinterest Predicts 2026: ${statEn}` });
const FALL = [9, 10, 11];
const HALLOWEEN = [10];
const XMAS = [11, 12];
const NYE = [12, 1];
const SPRING = [3, 4, 5];

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
    looks: [{ pattern: "solid", finish: "chrome", colors: [["hotPink", "hotPink", "silver"], ["raspberry", "raspberry", "silver"]] }] },
  { id: "caramel-nude", name: { vi: "Nude caramel", en: "Caramel nude" }, source: PP("\"caramel nude nails\" +943%", "\"caramel nude nails\" +943%"), weight: 3,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["caramel", "milky", "gold"]] }, { pattern: "fr-micro", finish: "glossy", colors: [["sheer", "caramel", "gold"]] }, { pattern: "french", finish: "glossy", colors: [["nude", "caramel", "gold"]] }, { pattern: "syrup", finish: "glossy", colors: [["caramel", "nude", "gold"]] }] },
  { id: "coffee", name: { vi: "Nâu cà phê", en: "Coffee nails" }, source: PP("\"coffee nails ideas\" +922%", "\"coffee nails ideas\" +922%"), weight: 3,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["coffee", "milky", "gold"], ["espresso", "nude", "gold"]] }, { pattern: "ombre", finish: "glossy", colors: [["nude", "coffee", "gold"]] }, { pattern: "velvet", finish: "cateye", colors: [["coffee", "milky", "gold"]] }] },
  { id: "raspberry-jelly", name: { vi: "Thạch mâm xôi", en: "Raspberry jelly" }, source: PP("\"raspberry jelly nails\" +828%", "\"raspberry jelly nails\" +828%"), weight: 2,
    looks: [{ pattern: "jelly", finish: "glossy", colors: [["raspberry", "milky", "gold"], ["strawberry", "milky", "gold"]] }] },
  { id: "dark-red-cat-eye", name: { vi: "Mắt mèo đỏ sẫm", en: "Dark red cat eye" }, source: PP("\"dark red cat eye nails design\" +735%", "\"dark red cat eye nails design\" +735%"), weight: 2,
    looks: [{ pattern: "solid", finish: "cateye", colors: [["burgundy", "gold", "gold"], ["mulledWine", "gold", "gold"], ["cherry", "silver", "silver"]] }] },
  { id: "cat-eye-chrome", name: { vi: "Mắt mèo + đầu tráng gương", en: "Cat eye & chrome" }, source: PP("\"cat eye and chrome nails\" +732%", "\"cat eye and chrome nails\" +732%"), weight: 2,
    looks: [{ pattern: "chromefrench", finish: "cateye", colors: [["plumNoir", "silver", "silver"], ["navy", "silver", "silver"], ["burgundy", "gold", "gold"]] }] },
  { id: "almond-stripes", name: { vi: "Móng hạnh nhân kẻ sọc", en: "Almond stripes" }, source: PP("\"almond nails stripes\" +694%", "\"almond nails stripes\" +694%"), weight: 2,
    looks: [{ pattern: "stripes", finish: "glossy", colors: [["pinkNude", "espresso", "gold"], ["cloudDancer", "coffee", "gold"], ["nude", "black", "gold"]], shapes: ["almond"] }] },
  { id: "two-tone-cat-eye", name: { vi: "Mắt mèo 2 tông", en: "Two-tone cat eye" }, source: PP("\"two tone cat eye nails\" +515%", "\"two tone cat eye nails\" +515%"), weight: 2,
    looks: [{ pattern: "mixmatch", finish: "cateye", colors: [["plumNoir", "navy", "silver"], ["burgundy", "plumNoir", "gold"], ["emerald", "black", "gold"]] }] },
  { id: "jade-marble", name: { vi: "Vân đá ngọc bích", en: "Jade marble" }, source: PP("\"jade marble nails\" +450%", "\"jade marble nails\" +450%"), weight: 2,
    looks: [{ pattern: "marble", finish: "glossy", colors: [["jade", "milky", "gold"], ["jade", "milky", "silver"]] }] },
  { id: "gothic-chrome", name: { vi: "Chrome gothic", en: "Gothic chrome" }, source: PP("\"gothic chrome nails\" +400%", "\"gothic chrome nails\" +400%"), weight: 1,
    looks: [{ pattern: "solid", finish: "chrome", colors: [["black", "black", "silver"], ["aubergine", "aubergine", "silver"]], shapes: ["stiletto", "almond"] }] },
  { id: "cool-blue", name: { vi: "Xanh băng", en: "Cool blue" }, source: PP("màu xanh băng tăng 235% lượt tìm", "cool blue searches +235%"), weight: 2,
    looks: [{ pattern: "solid", finish: "chrome", colors: [["coolBlue", "coolBlue", "silver"]] }, { pattern: "glitterfade", finish: "glitter", colors: [["coolBlue", "silver", "silver"]] }] },
  { id: "plum-noir", name: { vi: "Tím mận đậm", en: "Plum noir" }, source: PP("tím mận đậm tăng 220% lượt tìm", "plum noir searches +220%"), weight: 2,
    looks: [{ pattern: "velvet", finish: "cateye", colors: [["plumNoir", "milky", "gold"]] }, { pattern: "solid", finish: "glossy", colors: [["plumNoir", "milky", "gold"]] }, { pattern: "fr-micro", finish: "glossy", colors: [["sheer", "plumNoir", "gold"]] }] },
  { id: "wasabi", name: { vi: "Xanh wasabi", en: "Wasabi green" }, source: PP("xanh wasabi tăng 175% lượt tìm", "wasabi green searches +175%"), weight: 1,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["wasabi", "milky", "gold"]] }, { pattern: "french", finish: "glossy", colors: [["sheer", "wasabi", "gold"]] }] },
  { id: "blood-orange", name: { vi: "Cam đỏ (persimmon)", en: "Blood orange / persimmon" }, source: PP("\"blood orange nails\" +161%", "\"blood orange nails\" +161%"), weight: 1,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["persimmon", "milky", "gold"]] }, { pattern: "jelly", finish: "glossy", colors: [["persimmon", "milky", "gold"]] }, { pattern: "syrup", finish: "glossy", colors: [["persimmon", "sheer", "gold"]] }] },
  { id: "choco-strawberry", name: { vi: "Dâu nhúng sô-cô-la", en: "Chocolate-covered strawberry" }, source: PP("1 trong các màu nail Pinterest dự báo cho 2026", "one of Pinterest's predicted nail looks for 2026"), weight: 2,
    looks: [{ pattern: "chocodip", finish: "glossy", colors: [["strawberry", "chocolate", "gold"], ["babyPink", "chocolate", "gold"]] }] },
  { id: "cloud-dancer", name: { vi: "Trắng mây (màu Pantone 2026)", en: "Cloud Dancer (Pantone 2026)" }, source: { vi: "Màu của năm Pantone 2026: Cloud Dancer", en: "Pantone Colour of the Year 2026: Cloud Dancer" }, weight: 2,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["cloudDancer", "milky", "gold"]] }, { pattern: "french", finish: "glossy", colors: [["sheer", "cloudDancer", "gold"]] }, { pattern: "gelflower", finish: "glossy", colors: [["sheer", "cloudDancer", "pearl"]] }] },

  // ---- Quanh năm, nhóm mẫu mới (French ren / hồng – trắng, mắt mèo 9D trên màu đá quý) ----
  { id: "lace-french", name: { vi: "French ren & French hồng – trắng", en: "Lace French & pink-and-white French" }, source: { vi: "Trend 2026: móng ren (lace) và French hồng – trắng cổ điển quay lại", en: "2026 trend: lace nails and the classic pink-and-white French are back" }, weight: 2,
    looks: [{ pattern: "lace", finish: "glossy", colors: [["sheer", "milky", "pearl"], ["pinkNude", "milky", "pearl"]], shapes: ["almond", "oval", "coffin"] }, { pattern: "fr-pinkwhite", finish: "glossy", colors: [["pinkNude", "white", "gold"]] }] },
  { id: "cat-eye-9d", name: { vi: "Mắt mèo 9D màu đá quý", en: "9D jewel-tone cat eye" }, source: { vi: "Trend mắt mèo 2025–26: mắt mèo 9D nhiều dải sáng trên nền màu đá quý", en: "2025–26 cat-eye trend: multi-band 9D cat eye on jewel tones" }, weight: 2,
    looks: [{ pattern: "solid", finish: "cateye", colors: [["emerald", "gold", "gold"], ["cherryCola", "gold", "gold"], ["cobalt", "silver", "silver"], ["plumNoir", "silver", "silver"]], shapes: ["almond", "coffin", "stiletto"] }] },

  // ---- Thu 2026 (báo cáo trend mùa thu 2026: nâu sô-cô-la, tím mận, velvet, micro French, chrome nâu, chấm nhỏ, đồi mồi mảnh, da hươu) ----
  // hemi: ở Úc là mùa thu tháng 3–5 (không ra nâu caramel giữa mùa xuân Úc)
  { id: "fall-chocolate", occasion: "fall", hemi: true, name: { vi: "Nâu sô-cô-la thu 2026", en: "Fall 2026 chocolate" }, source: { vi: "Trend thu 2026: \"sô-cô-la là màu đen mới\"", en: "Fall 2026: \"chocolate is the new black\"" }, months: FALL, weight: 3,
    looks: [{ pattern: "velvet", finish: "cateye", colors: [["chocolate", "milky", "gold"]] }, { pattern: "solid", finish: "glossy", colors: [["chocolate", "milky", "gold"]] }, { pattern: "fr-micro", finish: "glossy", colors: [["sheer", "chocolate", "gold"]] }] },
  { id: "fall-micro-french", occasion: "fall", hemi: true, name: { vi: "French micro màu thu", en: "Fall micro French" }, source: { vi: "Trend thu 2026: micro French đầu nâu, đỏ rượu, xanh rêu", en: "Fall 2026: micro French tips in brown, burgundy and olive" }, months: FALL, weight: 3,
    looks: [{ pattern: "fr-micro", finish: "glossy", colors: [["sheer", "espresso", "gold"], ["sheer", "burgundy", "gold"], ["sheer", "olive", "gold"], ["milky", "mulledWine", "gold"]] }, { pattern: "fr-skittle", finish: "glossy", colors: [["sheer", "coffee", "gold"]] }] },
  { id: "fall-brown-chrome", occasion: "fall", hemi: true, name: { vi: "Chrome nâu & xám thiếc", en: "Brown & pewter chrome" }, source: { vi: "Trend thu 2026: chrome nâu, caramel, xám thiếc", en: "Fall 2026: brown, caramel and pewter chrome" }, months: FALL, weight: 2,
    looks: [{ pattern: "colorchrome", finish: "chrome", colors: [["espresso", "espresso", "gold"], ["coffee", "coffee", "gold"], ["caramel", "caramel", "gold"], ["pewter", "pewter", "silver"]] }] },
  { id: "fall-plum-velvet", occasion: "fall", hemi: true, name: { vi: "Velvet tông tím mận", en: "Plum-tone velvet" }, source: { vi: "Trend thu 2026: tông tím vào mùa thu, velvet là hiệu ứng hot", en: "Fall 2026: purple tones move into fall, velvet is the hot finish" }, months: FALL, weight: 2,
    looks: [{ pattern: "velvet", finish: "cateye", colors: [["plum", "milky", "gold"], ["aubergine", "milky", "gold"]] }] },
  { id: "fall-tortoise", occasion: "fall", hemi: true, name: { vi: "Đồi mồi nhiều tông", en: "Fine tortoiseshell" }, source: { vi: "Trend thu 2026: đồi mồi mảnh, pha 3–4 tông", en: "Fall 2026: finer tortoiseshell blending 3–4 tones" }, months: FALL, weight: 2,
    looks: [{ pattern: "tortoise", finish: "glossy", colors: [["caramel", "chocolate", "gold"]] }, { pattern: "fr-tortoise", finish: "glossy", colors: [["sheer", "caramel", "gold"]] }] },
  { id: "fall-fawn", occasion: "fall", hemi: true, name: { vi: "Da hươu (fawn)", en: "Fawn print" }, source: { vi: "Trend thu 2026: animal print mềm — da hươu", en: "Fall 2026: soft animal print — fawn" }, months: FALL, weight: 2,
    looks: [{ pattern: "fawn", finish: "glossy", colors: [["caramel", "cloudDancer", "gold"], ["coffee", "nude", "gold"]] }] },
  { id: "fall-micro-dots", occasion: "fall", hemi: true, name: { vi: "Chấm nhỏ tối giản", en: "Minimal tiny dots" }, source: { vi: "Trend thu 2026: móng ngắn, hoạ tiết nhỏ mà tinh", en: "Fall 2026: short nails, small but impactful art" }, months: FALL, weight: 1,
    looks: [{ pattern: "polka", finish: "glossy", colors: [["nude", "chocolate", "gold"], ["cloudDancer", "burgundy", "gold"]], shapes: ["oval", "square"] }] },

  // ---- Xuân 2026 (hemi: ở Úc là tháng 9–11) — nail Hàn nổi 3D, syrup, má hồng ----
  { id: "spring-gel-flower", occasion: "spring", hemi: true, name: { vi: "Hoa gel 3D nhụy ngọc trai", en: "3D gel flowers with pearl centres" }, source: { vi: "Trend xuân 2026: hoa gel nổi 3D, syrup, má hồng kiểu Hàn", en: "Spring 2026: raised 3D gel flowers, syrup and Korean blush nails" }, months: SPRING, weight: 2,
    looks: [{ pattern: "gelflower", finish: "glossy", colors: [["sheer", "milky", "pearl"], ["milky", "babyPink", "pearl"]] }, { pattern: "blush", finish: "glossy", colors: [["sheer", "hotPink", "pearl"]] }, { pattern: "syrup", finish: "glossy", colors: [["raspberry", "sheer", "pearl"]] }] },

  // ---- Halloween 2026: "moody luxe" — 1 hoạ tiết trên nền đen / đỏ rượu / tím cà, cam cháy thay cam chói ----
  { id: "hw-web", occasion: "halloween", name: { vi: "Mạng nhện tối giản", en: "Minimal spiderweb" }, source: { vi: "Halloween 2026: \"moody luxe\" — 1 hoạ tiết trên nền đen bóng", en: "Halloween 2026: \"moody luxe\" — one motif on glossy black" }, months: HALLOWEEN, weight: 2,
    looks: [{ pattern: "web", finish: "glossy", colors: [["black", "milky", "silver"], ["mulledWine", "milky", "silver"]] }] },
  { id: "hw-bats", occasion: "halloween", name: { vi: "Dơi bạc", en: "Silver bats" }, source: { vi: "Halloween 2026: dơi / bí ngô / ma nhỏ trên nền trơn", en: "Halloween 2026: tiny bats, pumpkins, ghosts on a plain base" }, months: HALLOWEEN, weight: 2,
    looks: [{ pattern: "bats", finish: "glossy", colors: [["aubergine", "milky", "silver"], ["black", "milky", "silver"]] }] },
  { id: "hw-ghost", occasion: "halloween", name: { vi: "Ma nhỏ dễ thương", en: "Cute ghosts" }, source: { vi: "Halloween 2026: dơi / bí ngô / ma nhỏ trên nền trơn", en: "Halloween 2026: tiny bats, pumpkins, ghosts on a plain base" }, months: HALLOWEEN, weight: 2,
    looks: [{ pattern: "ghost", finish: "glossy", colors: [["black", "milky", "silver"], ["plumNoir", "milky", "silver"]] }] },
  { id: "hw-pumpkin", occasion: "halloween", name: { vi: "Bí ngô mini", en: "Mini pumpkins" }, source: { vi: "Halloween 2026: dơi / bí ngô / ma nhỏ trên nền trơn", en: "Halloween 2026: tiny bats, pumpkins, ghosts on a plain base" }, months: HALLOWEEN, weight: 1,
    looks: [{ pattern: "jackolantern", finish: "glossy", colors: [["bone", "black", "gold"], ["black", "milky", "gold"]] }] },
  { id: "hw-moon", occasion: "halloween", name: { vi: "Trăng & sao", en: "Moon & stars" }, source: { vi: "Halloween 2026: trăng khuyết trên nền đậm", en: "Halloween 2026: moon phases on a deep base" }, months: HALLOWEEN, weight: 1,
    looks: [{ pattern: "moonstars", finish: "glossy", colors: [["navy", "milky", "gold"], ["mulledWine", "milky", "gold"]] }] },
  { id: "hw-moody", occasion: "halloween", name: { vi: "Cam cháy / đỏ rượu ấm", en: "Burnt orange & mulled wine" }, source: { vi: "Halloween 2026: cam cháy, đỏ rượu ấm, tím cà thay cam chói", en: "Halloween 2026: burnt orange, mulled wine, aubergine replace traffic-cone orange" }, months: HALLOWEEN, weight: 1,
    looks: [{ pattern: "solid", finish: "glossy", colors: [["burnt", "milky", "gold"], ["mulledWine", "milky", "gold"]] }, { pattern: "solid", finish: "cateye", colors: [["aubergine", "gold", "gold"]] },
      { pattern: "colorchrome", finish: "chrome", colors: [["pumpkin", "pumpkin", "gold"], ["mulledWine", "mulledWine", "gold"]] }, { pattern: "fr-v", finish: "glossy", colors: [["sheer", "mulledWine", "gold"]] }] },

  // ---- Giáng sinh / năm mới 2026 (nhung, caro, tuyết chỉ ở Mỹ — Giáng sinh ở Úc là mùa hè) ----
  { id: "xmas-tartan", occasion: "christmas", markets: ["US"], name: { vi: "Caro tartan", en: "Tartan" }, source: { vi: "Giáng sinh 2026: caro tartan / bàn cờ là trend phải thử", en: "Christmas 2026: tartan and checkerboard are must-tries" }, months: XMAS, weight: 2,
    looks: [{ pattern: "plaid", finish: "glossy", colors: [["redVelvet", "pine", "gold"], ["cherry", "pine", "gold"]] }, { pattern: "checker", finish: "glossy", colors: [["milky", "cherry", "gold"]] }] },
  { id: "xmas-candy", occasion: "christmas", name: { vi: "Sọc kẹo gậy", en: "Candy cane" }, source: { vi: "Giáng sinh 2026: French kẹo gậy", en: "Christmas 2026: candy-cane accents" }, months: XMAS, weight: 1,
    looks: [{ pattern: "fr-candycane", finish: "glossy", colors: [["milky", "cherry", "gold"], ["sheer", "redVelvet", "gold"]] }] },
  { id: "xmas-snow", occasion: "christmas", markets: ["US"], name: { vi: "Bông tuyết", en: "Snowflakes" }, source: { vi: "Giáng sinh 2026: bông tuyết tinh tế", en: "Christmas 2026: delicate snowflakes" }, months: XMAS, weight: 2,
    looks: [{ pattern: "snow", finish: "glossy", colors: [["navy", "milky", "silver"], ["redVelvet", "milky", "gold"], ["cherry", "milky", "gold"]] }] },
  { id: "xmas-red", occasion: "christmas", name: { vi: "Đỏ Giáng sinh lấp lánh", en: "Sparkly Christmas red" }, source: { vi: "Giáng sinh 2026: đỏ trầm + nhũ / chrome", en: "Christmas 2026: deep red with glitter or chrome" }, months: XMAS, weight: 2,
    looks: [{ pattern: "glitterfade", finish: "glitter", colors: [["cherry", "gold", "gold"]] }, { pattern: "velvet", finish: "cateye", colors: [["redVelvet", "milky", "gold"]] }, { pattern: "colorchrome", finish: "chrome", colors: [["cherry", "cherry", "gold"]] }] },
  { id: "xmas-bow", occasion: "christmas", markets: ["US"], name: { vi: "Đỏ nhung + nơ vàng 3D", en: "Red velvet & 3D gold bows" }, source: { vi: "Giáng sinh 2026: đỏ nhung, nơ 3D", en: "Christmas 2026: red velvet and 3D bows" }, months: XMAS, weight: 2,
    looks: [{ pattern: "charm3d", finish: "cateye", colors: [["redVelvet", "milky", "gold"]] }, { pattern: "velvet", finish: "cateye", colors: [["redVelvet", "milky", "gold"]] }] },
  { id: "xmas-holly", occasion: "christmas", name: { vi: "Lá holly & quả châu vẽ tay", en: "Hand-painted holly & baubles" }, source: { vi: "Giáng sinh 2026: lá holly, quả châu vẽ tay trên nền trắng sữa", en: "Christmas 2026: hand-painted holly and baubles on milky white" }, months: XMAS, weight: 2,
    looks: [{ pattern: "holly", finish: "glossy", colors: [["milky", "redVelvet", "gold"], ["bone", "cherry", "gold"]] }, { pattern: "ornament", finish: "glossy", colors: [["milky", "redVelvet", "gold"], ["sheer", "emerald", "gold"]] }, { pattern: "fr-santa", finish: "glossy", colors: [["sheer", "cherry", "gold"]] }] },
  { id: "au-summer-xmas", occasion: "christmas", markets: ["AU"], name: { vi: "Giáng sinh mùa hè (Úc)", en: "Aussie summer Christmas" }, source: { vi: "Giáng sinh ở Úc là mùa hè: san hô, xanh aqua, trắng hoa sứ, vàng ánh kim", en: "Christmas in Australia is summer: coral, aqua, frangipani white and gold" }, months: XMAS, weight: 3,
    looks: [{ pattern: "fr-micro", finish: "glossy", colors: [["sheer", "coral", "gold"], ["sheer", "aqua", "gold"]] }, { pattern: "colorchrome", finish: "chrome", colors: [["aqua", "aqua", "gold"], ["coral", "coral", "gold"]] },
      { pattern: "glitterfade", finish: "glitter", colors: [["frangipani", "gold", "gold"]] }, { pattern: "fr-santa", finish: "glossy", colors: [["sheer", "cherry", "gold"]] }] },
  { id: "nye-sparkle", occasion: "newyear", name: { vi: "Lấp lánh đêm giao thừa", en: "New Year's Eve sparkle" }, source: { vi: "Năm mới: bạc / vàng tráng gương, sao, foil, nhũ loang", en: "New Year: silver and gold chrome, stars, foil, glitter fade" }, months: NYE, weight: 2,
    looks: [{ pattern: "stars", finish: "glossy", colors: [["black", "milky", "gold"], ["navy", "milky", "silver"]] }, { pattern: "foil", finish: "glossy", colors: [["black", "milky", "gold"]] },
      { pattern: "glitterfade", finish: "glitter", colors: [["black", "silver", "silver"], ["champagne", "gold", "gold"]] }, { pattern: "fr-glitter", finish: "glitter", colors: [["sheer", "gold", "gold"]] }, { pattern: "colorchrome", finish: "chrome", colors: [["champagne", "champagne", "gold"]] }] },
];

/** Trend đang trong mùa của ngày đó ở thị trường đó: trend theo mùa (hemi) ở Úc lệch 6 tháng (thu Mỹ tháng 9–11 = thu Úc
 *  tháng 3–5); trend chỉ dành cho 1 thị trường (Giáng sinh mùa hè Úc, nhung / caro Mỹ) lọc theo thị trường. */
export function activeTrends(date: Date, market: "US" | "AU" = "US"): Trend[] {
  const m = date.getUTCMonth() + 1;
  const monthsOf = (t: Trend) => (market === "AU" && t.hemi && t.months ? t.months.map((x) => ((x + 5) % 12) + 1) : t.months);
  return TREND_RADAR.filter((t) => (!t.markets || t.markets.includes(market)) && (!monthsOf(t) || monthsOf(t)!.includes(m)));
}
