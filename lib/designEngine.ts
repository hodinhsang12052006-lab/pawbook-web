// MÁY TẠO MẪU NAIL CỦA PAWNAIL — không gọi AI bên ngoài, chi phí 0đ.
//
// Ghép mẫu từ KIẾN THỨC NGHỀ soạn sẵn: hệ móng (Gel-X / bột / dip / sơn gel),
// dáng móng, hiệu ứng bề mặt, hoạ tiết, bảng màu có tên theo dịp lễ/mùa.
// Mỗi phần mang sẵn vật tư + bước làm + thời gian + độ khó, nên công thức ra
// luôn đúng kỹ thuật (AI chung hay bịa vật tư). Tự tính giá gợi ý theo Mỹ/Úc,
// viết mô tả song ngữ, và mô tả ảnh tiếng Anh để sau này gắn máy vẽ ảnh.
//
// Ngẫu nhiên CÓ HẠT GIỐNG (ngày + thị trường) → cùng ngày chạy lại ra cùng
// kết quả; tránh trùng tên với các mẫu đã có.

import { activeTrends, type Trend } from "@/lib/trendRadar";
export interface Bi { vi: string; en: string }
export type Mat = Bi & { qty: string };
export type Shape = "almond" | "coffin" | "square" | "oval" | "stiletto";
export type Finish = "glossy" | "matte" | "chrome" | "cateye" | "glitter";
export type SystemId = "gelx" | "acrylic" | "dip" | "gel";

interface Color { vi: string; en: string; hex: string }
const col = (vi: string, en: string, hex: string): Color => ({ vi, en, hex });

// MÀU GEL THẬT (không phải mã màu giao diện Tailwind): kem hơn, trầm hơn, ít chói — navy #1e3a8a ra xanh hoàng gia,
// cam #ea580c ra cam nón giao thông, hồng #ec4899 ra bút dạ quang (soi tờ catalog 25/10). Giữ đủ mọi khoá cũ (mẫu cũ,
// lib/tryon/advice dùng lại), chỉ đổi mã màu; thêm màu mùa 2026–27.
export const COLORS = {
  black: col("đen tuyền", "jet black", "#151314"),
  white: col("trắng sữa", "milky white", "#f2ede6"),
  milky: col("trắng sữa", "milky white", "#f2ede6"),
  nude: col("nude be", "beige nude", "#e8c4a8"),
  pinkNude: col("hồng nude", "pink nude", "#f2c4c4"),
  babyPink: col("hồng phấn", "baby pink", "#f4c7cf"),
  hotPink: col("hồng cánh sen", "hot pink", "#e0457b"),
  cherry: col("đỏ cherry", "cherry red", "#b3122e"),
  velvet: col("đỏ nhung", "velvet red", "#7a0f1f"),
  redVelvet: col("đỏ nhung", "red velvet", "#7a0f1f"),
  burgundy: col("đỏ rượu vang", "burgundy", "#6e1a2b"),
  pumpkin: col("cam bí ngô", "pumpkin orange", "#c4541f"),
  burnt: col("cam cháy", "burnt orange", "#b5471b"),
  caramel: col("nâu caramel", "caramel", "#b45309"),
  cinnamon: col("nâu quế", "cinnamon", "#9c4a2b"),
  chocolate: col("nâu socola", "chocolate brown", "#5b3a29"),
  mocha: col("nâu mocha", "mocha", "#8b6b5a"),
  olive: col("xanh rêu", "olive green", "#4d5b2a"),
  sage: col("xanh xô thơm", "sage green", "#9caf88"),
  pine: col("xanh thông", "pine green", "#14532d"),
  emerald: col("xanh lục bảo", "emerald", "#0b5d3b"),
  mint: col("xanh mint", "mint", "#b7dcc6"),
  sky: col("xanh da trời", "sky blue", "#b9cce0"),
  navy: col("xanh navy", "navy", "#1f2a44"),
  cobalt: col("xanh cobalt", "cobalt blue", "#28418c"),
  teal: col("xanh ngọc", "teal", "#1f7a74"),
  aqua: col("xanh aqua", "aqua", "#6cc5c0"),
  lavender: col("tím lavender", "lavender", "#c9b8e0"),
  plum: col("tím mận", "plum", "#4a1d3f"),
  lemon: col("vàng chanh", "lemon yellow", "#f1d36b"),
  butter: col("vàng bơ", "butter yellow", "#f1e3a0"),
  coral: col("hồng san hô", "coral", "#e8786a"),
  champagne: col("champagne", "champagne", "#e9d7b4"),
  smoke: col("xám khói", "smoky grey", "#55585e"),
  pewter: col("xám thiếc", "pewter", "#8a8d91"),
  gold: col("vàng ánh kim", "gold", "#d4af37"),
  silver: col("bạc", "silver", "#c0c0c0"),
  pearl: col("ngọc trai", "pearl", "#f5f0e8"),
  roseGold: col("vàng hồng", "rose gold", "#b76e79"),
  greige: col("xám be", "greige", "#b8ada3"),
  bone: col("trắng ngà", "bone", "#e9e1d3"),
  espresso: col("nâu espresso", "espresso brown", "#3b2418"),
  sheer: col("hồng sữa", "milky pink", "#f6d5d0"),
  // màu 2026 (Pinterest Predicts 2026 · Pantone 2026 · báo cáo thu 2026)
  wasabi: col("xanh wasabi", "wasabi green", "#b5c42a"),
  jade: col("xanh ngọc bích", "jade", "#5f9c88"),
  plumNoir: col("tím mận đậm", "plum noir", "#3e1530"),
  coolBlue: col("xanh băng", "icy blue", "#a9c7e8"),
  persimmon: col("cam quả hồng", "persimmon", "#e2552b"),
  cloudDancer: col("trắng mây", "cloud white", "#f0ece2"),
  raspberry: col("hồng mâm xôi", "raspberry", "#c2185b"),
  coffee: col("nâu cà phê", "coffee brown", "#6f4e37"),
  aubergine: col("tím cà", "aubergine", "#3b1f3a"),
  mulledWine: col("đỏ rượu ấm", "mulled wine", "#5a1a2a"),
  periwinkle: col("tím xanh dừa cạn", "periwinkle", "#8f9fe0"),
  strawberry: col("đỏ dâu", "strawberry red", "#e0354a"),
  // Halloween "moody luxe" + màu mùa 2026–27 + Giáng sinh mùa hè ở Úc
  // (tên tiếng Anh tránh chữ "blood": mô tả ảnh gửi máy vẽ bị lọc chữ nhạy cảm)
  bloodRed: col("đỏ thẫm", "dark crimson", "#8a0303"),
  cherryCola: col("đỏ cherry cola", "cherry cola", "#4a0e17"),
  frangipani: col("trắng hoa sứ", "frangipani white", "#f6efdc"),
} as const;
type CK = keyof typeof COLORS;
const METALS: CK[] = ["gold", "silver", "roseGold", "pearl"];

// Bảng màu theo dịp: [màu chính, màu phụ, kim loại/điểm nhấn]. Mỗi bảng tối đa 2 màu sắc + 1 màu trung tính neo
// (nude / trắng sữa / kem / đen) + 1 kim loại; vàng đi với nền ấm, bạc với nền lạnh, vàng hồng với hồng / nude.
// Bảng nào ghép với hoạ tiết mà hoạ tiết bị chìm → máy bỏ, lấy bảng khác (xem paletteOk).
const PALETTES: Record<string, [CK, CK, CK][]> = {
  // Halloween 2026 "moody luxe": đen, tím cà, rượu ấm, cam cháy, đỏ thẫm, trắng ngà — bỏ pastel (hồng phấn + mắt quỷ nhìn "dị")
  halloween: [["black", "pumpkin", "silver"], ["black", "bone", "silver"], ["mulledWine", "black", "gold"], ["plumNoir", "bone", "silver"], ["aubergine", "pumpkin", "gold"],
    ["black", "bloodRed", "silver"], ["milky", "black", "silver"], ["nude", "black", "gold"], ["burnt", "black", "gold"], ["bone", "bloodRed", "silver"], ["plumNoir", "pumpkin", "gold"]],
  fall: [["burgundy", "caramel", "gold"], ["espresso", "nude", "gold"], ["olive", "bone", "gold"], ["cinnamon", "espresso", "gold"], ["coffee", "cloudDancer", "gold"],
    ["mulledWine", "nude", "gold"], ["pewter", "espresso", "silver"], ["emerald", "bone", "gold"], ["cherryCola", "nude", "gold"]],
  thanksgiving: [["cinnamon", "bone", "gold"], ["espresso", "caramel", "gold"], ["nude", "burnt", "gold"], ["mulledWine", "champagne", "gold"], ["caramel", "espresso", "gold"]],
  christmas: [["redVelvet", "milky", "gold"], ["emerald", "milky", "gold"], ["milky", "redVelvet", "gold"], ["pine", "bone", "gold"], ["cherry", "milky", "gold"], ["navy", "milky", "silver"], ["black", "redVelvet", "gold"]],
  // Giáng sinh ở Úc là MÙA HÈ: san hô, aqua, trắng hoa sứ, vàng ánh kim, đỏ cherry (không nhung, không caro, không len)
  christmasAU: [["coral", "frangipani", "gold"], ["aqua", "milky", "gold"], ["frangipani", "cherry", "gold"], ["cherry", "milky", "gold"], ["sheer", "coral", "gold"], ["aqua", "coral", "gold"]],
  newyear: [["black", "champagne", "gold"], ["champagne", "milky", "gold"], ["navy", "milky", "silver"], ["pewter", "black", "silver"], ["plumNoir", "champagne", "gold"], ["emerald", "champagne", "gold"], ["milky", "black", "silver"]],
  tet: [["cherry", "lemon", "gold"], ["redVelvet", "champagne", "gold"], ["sheer", "cherry", "gold"], ["milky", "cherry", "gold"], ["sheer", "hotPink", "gold"]],
  valentine: [["sheer", "cherry", "gold"], ["cherry", "milky", "gold"], ["milky", "hotPink", "roseGold"], ["babyPink", "redVelvet", "roseGold"], ["pinkNude", "raspberry", "roseGold"]],
  spring: [["sheer", "lavender", "pearl"], ["babyPink", "milky", "pearl"], ["mint", "milky", "gold"], ["butter", "sage", "gold"], ["sky", "milky", "silver"], ["sheer", "hotPink", "gold"], ["sage", "milky", "gold"], ["periwinkle", "milky", "silver"]],
  prom: [["plum", "silver", "silver"], ["hotPink", "silver", "silver"], ["navy", "silver", "silver"], ["emerald", "gold", "gold"], ["black", "silver", "silver"], ["cobalt", "silver", "silver"]],
  mothersday: [["pinkNude", "milky", "gold"], ["nude", "babyPink", "gold"], ["coral", "milky", "pearl"], ["sheer", "raspberry", "gold"]],
  wedding: [["milky", "pearl", "pearl"], ["nude", "milky", "pearl"], ["pinkNude", "milky", "silver"], ["sheer", "champagne", "gold"], ["bone", "pearl", "gold"]],
  summer: [["coral", "milky", "gold"], ["teal", "milky", "silver"], ["aqua", "milky", "gold"], ["hotPink", "persimmon", "gold"], ["lemon", "milky", "gold"], ["sheer", "coral", "gold"], ["cobalt", "milky", "silver"]],
  backtoschool: [["navy", "milky", "silver"], ["cherry", "navy", "gold"], ["olive", "butter", "gold"], ["nude", "chocolate", "gold"]],
  // Nail Hàn / nude tối giản: nền trong, hồng nude, trắng sữa, xám be, nâu socola + thạch màu (syrup)
  korean: [["sheer", "milky", "silver"], ["pinkNude", "milky", "silver"], ["milky", "pinkNude", "silver"], ["greige", "milky", "silver"], ["chocolate", "nude", "gold"], ["nude", "milky", "pearl"],
    ["mocha", "pinkNude", "gold"], ["sheer", "babyPink", "pearl"], ["raspberry", "sheer", "pearl"], ["sheer", "hotPink", "pearl"], ["coffee", "nude", "gold"]],
  // Trend quanh năm: espresso, đỏ cherry, vàng bơ, xanh rêu, ngọc lục bảo, cherry cola, cobalt…
  trend: [["espresso", "nude", "gold"], ["nude", "cherry", "gold"], ["butter", "milky", "gold"], ["olive", "nude", "gold"], ["babyPink", "milky", "silver"], ["mocha", "milky", "gold"],
    ["navy", "milky", "silver"], ["lavender", "milky", "silver"], ["pinkNude", "espresso", "gold"], ["milky", "cherry", "gold"], ["emerald", "bone", "gold"], ["cherryCola", "nude", "gold"],
    ["cobalt", "milky", "silver"], ["jade", "milky", "gold"], ["black", "milky", "silver"]],
  any: [["nude", "milky", "gold"], ["pinkNude", "milky", "gold"], ["mocha", "nude", "gold"], ["babyPink", "milky", "pearl"], ["burgundy", "nude", "gold"], ["navy", "nude", "silver"], ["black", "milky", "gold"], ["emerald", "milky", "gold"]],
};

// ----------------------------------------------------------------------------
// MÀU THEO MẮT NGƯỜI (CIELAB): hoạ tiết phải nổi trên nền — beige trên trắng, trắng trên bạc, lavender trên xanh da
// trời, vàng hồng trên mocha, bạc trên nude… là các cặp "chìm" khách nhìn thấy "dị" (soi catalog 25/10).
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const LAB = new Map<string, [number, number, number]>();
/** mã màu → [L*, a*, b*] (D65) */
export function lab(hex: string): [number, number, number] {
  const hit = LAB.get(hex);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16), R = lin(((n >> 16) & 255) / 255), G = lin(((n >> 8) & 255) / 255), B = lin((n & 255) / 255);
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  const out: [number, number, number] = [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  LAB.set(hex, out);
  return out;
}
const Lof = (hex: string) => lab(hex)[0];
/** Hai màu đủ tách nhau chưa: chênh sáng ΔL* ≥ ngưỡng; hoặc chênh sáng ≥ nửa ngưỡng mà khác hẳn sắc (cam bí ngô trên
 *  nude) — không cho 2 màu cùng độ sáng chỉ khác sắc (xanh lá trên đỏ nhung: nhìn nhoè, mù màu không thấy). */
export function contrastOk(a: string, b: string, min: number): boolean {
  const A = lab(a), B = lab(b), dL = Math.abs(A[0] - B[0]);
  return dL >= min || (dL >= min / 2 && 0.55 * Math.hypot(dL, A[1] - B[1], A[2] - B[2]) >= min);
}
/** Họ màu (để 2 mẫu liền nhau không cùng 1 họ, không cả lô màu be). */
export function hueFamily(hex: string): string {
  const [L, a, b] = lab(hex), C = Math.hypot(a, b), h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  if (C < 10) return L > 82 ? "white" : L < 25 ? "black" : "grey";
  if (L >= 72 && C <= 30 && (h < 95 || h >= 330)) return "nude";
  if (h >= 345 || h < 40) return L >= 62 ? "pink" : "red";
  if (h < 75) return L < 50 ? "brown" : "orange";
  if (h < 105) return "yellow";
  if (h < 200) return "green";
  if (h < 300) return "blue";
  return "purple";
}

// ----------------------------------------------------------------------------
// Hệ móng
interface Sys {
  id: SystemId; name: Bi; skill: string | null; minutes: number; price: number; difficulty: number;
  shapes: Shape[]; finishes: Finish[];
  prep: (shape: Bi) => { materials: Mat[]; steps: Bi[] };
  colorMat: (c: Color) => Mat;
  colorStep: (c: Color) => Bi;
}
const m = (vi: string, en: string, qty = "1 lọ"): Mat => ({ vi, en, qty });
const s = (vi: string, en: string): Bi => ({ vi, en });

const SHAPE_NAME: Record<Shape, Bi> = {
  almond: s("almond (hạnh nhân)", "almond"), coffin: s("coffin (ballerina)", "coffin"), square: s("vuông", "square"),
  oval: s("oval (tròn)", "oval"), stiletto: s("stiletto (nhọn)", "stiletto"),
};

const SYSTEMS: Sys[] = [
  {
    id: "gelx", name: s("Gel-X", "Gel-X"), skill: "Gel-X", minutes: 40, price: 50, difficulty: 1,
    shapes: ["almond", "coffin", "stiletto", "square", "oval"], finishes: ["glossy", "matte", "chrome", "cateye", "glitter"],
    prep: (sh) => ({
      materials: [m(`Móng úp Gel-X dáng ${sh.vi}`, `Gel-X ${sh.en} soft tips`, "1 hộp"), m("Gel dán móng (extend gel)", "Extend gel"), m("Dehydrator & primer", "Dehydrator & primer", "1 bộ")],
      steps: [s("Đẩy da, dũa nhẹ mặt móng, lau dehydrator và primer", "Push cuticles, lightly buff, apply dehydrator and primer"), s(`Chọn size móng úp, phủ extend gel, hơ đèn 60 giây, dũa form ${sh.vi}`, `Size the tips, apply extend gel, cure 60s, file into ${sh.en}`)],
    }),
    colorMat: (c) => m(`Gel ${c.vi}`, `${cap(c.en)} gel polish`),
    colorStep: (c) => s(`Sơn 2 lớp gel ${c.vi}, hơ đèn mỗi lớp`, `Two coats of ${c.en} gel, cure each coat`),
  },
  {
    id: "acrylic", name: s("bột", "acrylic"), skill: "Bột/Acrylic", minutes: 55, price: 50, difficulty: 2,
    shapes: ["coffin", "stiletto", "square", "almond"], finishes: ["glossy", "matte", "chrome", "cateye", "glitter"],
    prep: (sh) => ({
      materials: [m("Bột acrylic trong (clear)", "Clear acrylic powder", "1 hũ"), m("Nước đắp bột (monomer)", "Acrylic liquid (monomer)"), m("Form giấy hoặc móng tip", "Nail forms or tips", "1 hộp"), m("Cọ bột số 10", "Size 10 acrylic brush", "1 cây")],
      steps: [s("Đẩy da, dũa mặt móng, quét primer", "Push cuticles, buff, apply primer"), s(`Gắn form, đắp bột tạo dáng ${sh.vi}, để khô rồi dũa form và mặt móng mịn`, `Fit forms, sculpt ${sh.en} with acrylic, let set, then file shape and surface smooth`)],
    }),
    colorMat: (c) => m(`Gel ${c.vi}`, `${cap(c.en)} gel polish`),
    colorStep: (c) => s(`Sơn 2 lớp gel ${c.vi} lên bột, hơ đèn mỗi lớp`, `Two coats of ${c.en} gel over the acrylic, cure each`),
  },
  {
    id: "dip", name: s("dip", "dip"), skill: "Dip/SNS", minutes: 40, price: 42, difficulty: 1,
    shapes: ["square", "oval", "almond"], finishes: ["glossy", "matte", "glitter"],
    prep: (sh) => ({
      materials: [m("Bộ dung dịch dip (base, activator, top)", "Dip liquid set (base, activator, top)", "1 bộ"), m("Bột dip trong (clear)", "Clear dip powder", "1 hũ")],
      steps: [s(`Đẩy da, dũa nhám mặt móng, dũa dáng ${sh.vi}`, `Push cuticles, buff the surface, file into ${sh.en}`), s("Quét base, nhúng 1 lớp bột trong để móng chắc", "Brush on base and dip one clear layer for strength")],
    }),
    colorMat: (c) => m(`Bột dip ${c.vi}`, `${cap(c.en)} dip powder`, "1 hũ"),
    colorStep: (c) => s(`Quét base, nhúng 2 lớp bột dip ${c.vi}, gõ sạch bột thừa`, `Base, dip two layers of ${c.en} powder, tap off excess`),
  },
  {
    id: "gel", name: s("sơn gel móng thật", "gel manicure"), skill: null, minutes: 30, price: 35, difficulty: 1,
    shapes: ["oval", "square", "almond"], finishes: ["glossy", "matte", "chrome", "cateye", "glitter"],
    prep: (sh) => ({
      materials: [m("Base gel", "Base gel")],
      steps: [s(`Đẩy da, dũa móng thật dáng ${sh.vi}, dũa nhẹ mặt móng`, `Push cuticles, file natural nails into ${sh.en}, lightly buff`), s("Lau dehydrator, quét base gel, hơ đèn", "Dehydrate, apply base gel, cure")],
    }),
    colorMat: (c) => m(`Gel ${c.vi}`, `${cap(c.en)} gel polish`),
    colorStep: (c) => s(`Sơn 2 lớp gel ${c.vi}, hơ đèn mỗi lớp`, `Two coats of ${c.en} gel, cure each coat`),
  },
];

// ----------------------------------------------------------------------------
// Hoạ tiết
interface PCtx { c1: Color; c2: Color; metal: Color; sys: Sys; finish: Finish; keepHue?: boolean }
interface Pattern {
  id: string;
  occasions: string[] | "any";
  finishes: Finish[];
  systems?: SystemId[];
  minutes: number; price: number; difficulty: number; design: boolean;
  ownColor?: boolean; // hoạ tiết tự là lớp màu (đồi mồi) → bỏ bước sơn màu nền
  ownGlitter?: boolean; // nhũ nằm trong chính hoạ tiết (French nhũ, nhũ loang) → hiệu ứng "nhũ" không phủ thêm lớp nhũ cả móng
  keepHue?: boolean; // chrome giữ nguyên sắc màu nền (bột chrome trong), không ra bạc
  retired?: boolean; // máy KHÔNG chọn nữa (nhìn "dị" / trùng mẫu khác) — giữ lại để mẫu cũ vẫn vẽ / ghép lại được
  badBase?: CK[]; // màu nền làm hoạ tiết bị chìm (VD mèo đen trên nền đen) → không ghép
  title: (p: PCtx) => Bi;
  why: Bi; // vì sao đang được chuộng
  materials: (p: PCtx) => Mat[];
  steps: (p: PCtx) => Bi[];
  image: (p: PCtx) => string; // mô tả tiếng Anh cho máy vẽ ảnh
}
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const capVi = cap;
const LINER = (c: Color) => m(`Gel vẽ nét ${c.vi}`, `${cap(c.en)} liner gel`);
const LINER_BRUSH = m("Cọ nét mảnh 7–9mm", "7–9mm liner brush", "1 cây");
const DOT = m("Cây chấm bi (dotting tool)", "Dotting tool", "1 cây");
const isMai = (a: Color, b: Color) => a.hex === COLORS.lemon.hex || b.hex === COLORS.lemon.hex;
const ACC = s("ngón áp út và ngón trỏ", "ring and index fingers");
// Tên phải nói đúng cái khách thấy: French / nền trong mà chọn hiệu ứng chrome thì cả bộ được tráng (nền sáng → ánh ngọc
// trai kiểu glazed) — ghi rõ vào tên, không để tên "French micro" mà ảnh ra móng tráng gương.
const gz = (t: Bi, { finish, c1 }: PCtx): Bi => finish !== "chrome" ? t
  : Lof(c1.hex) > 70 ? s(`${t.vi} tráng ngọc trai`, `${t.en} with a pearl glaze`) : s(`${t.vi} tráng gương`, `${t.en} with a chrome glaze`);
// Bộ phối theo dịp (mix-*): bộ máy (lib/tryon/sets) tự chia vai từng móng; ở đây chỉ là tên + công thức cho thợ.
const MIX_NAME: Record<"halloween" | "christmas" | "valentine" | "fall" | "newyear", { vi: string; en: string; motifVi: string; motifEn: string; heroVi: string; heroEn: string }> = {
  halloween: { vi: "Halloween", en: "Halloween", motifVi: "ma, dơi, mạng nhện + móng trơn", motifEn: "ghost, bats, web plus a solid nail", heroVi: "ma / dơi / bí ngô", heroEn: "ghost, bat or pumpkin" },
  christmas: { vi: "Giáng sinh", en: "Christmas", motifVi: "lá holly, quả châu, French kẹo gậy + móng nhung", motifEn: "holly, ornament, candy-cane French plus a velvet nail", heroVi: "lá holly / quả châu", heroEn: "holly or ornament" },
  valentine: { vi: "Valentine", en: "Valentine", motifVi: "tim to, French tim, chấm bi", motifEn: "a big heart, heart French and dots", heroVi: "trái tim to", heroEn: "big heart" },
  fall: { vi: "mùa thu", en: "fall", motifVi: "lá thu, đầu đồi mồi, chrome caramel", motifEn: "autumn leaf, tortoise tip and caramel chrome", heroVi: "lá thu", heroEn: "autumn leaf" },
  newyear: { vi: "Năm mới", en: "New Year", motifVi: "sao, nhũ loang, chrome", motifEn: "stars, glitter fade and chrome", heroVi: "chùm sao lấp lánh", heroEn: "sparkle stars" },
};

export const PATTERNS: Pattern[] = [
  {
    // nhũ cả móng nhìn như giấy nhám / gàu (#2, #21) → nhũ chỉ còn ở French nhũ, nhũ loang, baby boomer
    id: "solid", occasions: "any", finishes: ["glossy", "matte", "chrome", "cateye"], minutes: 0, price: 0, difficulty: 1, design: false,
    title: ({ c1, finish, metal }) =>
      finish === "cateye" ? s(`Mắt mèo ${c1.vi}`, `${cap(c1.en)} cat eye`)
        : finish === "chrome" ? s(`${capVi(c1.vi)} tráng gương`, `${cap(c1.en)} chrome`)
          : finish === "glitter" ? s(`${capVi(c1.vi)} phủ nhũ ${metal.vi}`, `${cap(c1.en)} with ${metal.en} shimmer`)
            : finish === "matte" ? s(`${capVi(c1.vi)} nhám`, `Matte ${c1.en}`)
              : s(`${capVi(c1.vi)} bóng gương`, `Glossy ${c1.en}`),
    why: s("màu trơn hiệu ứng đẹp là mẫu khách chọn nhiều nhất, làm nhanh", "a great solid with a standout finish is the most-booked look and quick to do"),
    materials: () => [], steps: () => [],
    image: ({ c1 }) => `solid ${c1.en} color on every nail`,
  },
  {
    id: "french", occasions: "any", finishes: ["glossy", "chrome", "cateye"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: (p) => gz(s(`French ${p.c2.vi} nền ${p.c1.vi}`, `${cap(p.c2.en)} French on ${p.c1.en}`), p),
    why: s("French kiểu mới (đầu màu, viền mảnh) đang thay French trắng cổ điển", "modern French tips (colored, micro-thin) are replacing the classic white French"),
    materials: ({ c2, sys }) => [sys.id === "dip" ? m(`Bột dip ${c2.vi} (đầu French)`, `${cap(c2.en)} dip powder (French tips)`, "1 hũ") : m(`Gel ${c2.vi} (đầu French)`, `${cap(c2.en)} gel (French tips)`), m("Cọ French dẹt", "Flat French brush", "1 cây")],
    steps: ({ c2, sys }) => [sys.id === "dip" ? s(`Nhúng nghiêng đầu móng vào bột ${c2.vi} tạo đường French`, `Dip the tips at an angle into ${c2.en} powder for the French line`) : s(`Kẻ đầu French ${c2.vi} mảnh, đều 2 bên, hơ đèn`, `Paint a thin, even ${c2.en} French tip, cure`)],
    image: ({ c1, c2 }) => `${c1.en} base with thin crisp ${c2.en} French tips, clean smile line`,
  },
  {
    id: "ombre", occasions: "any", finishes: ["glossy", "matte"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Ombre ${c1.vi} – ${c2.vi}`, `${cap(c1.en)} to ${c2.en} ombre`),
    why: s("ombre chuyển màu mềm hợp mọi độ dài móng, khách nhìn là thích", "soft ombre flatters every length and photographs beautifully"),
    materials: ({ c2, sys }) => [sys.id === "dip" ? m(`Bột dip ${c2.vi}`, `${cap(c2.en)} dip powder`, "1 hũ") : m(`Gel ${c2.vi}`, `${cap(c2.en)} gel polish`), m("Mút tán màu / cọ ombre", "Ombre sponge or brush", "1 cái")],
    steps: ({ c1, c2, sys }) => [sys.id === "dip" ? s(`Nhúng ${c2.vi} từ đầu móng lên giữa móng, rắc nhẹ phần chuyển màu`, `Dip ${c2.en} from tip to mid-nail, sprinkle lightly at the blend line`) : s(`Tán ${c2.vi} từ đầu móng vào, hoà với ${c1.vi} ở giữa móng, hơ đèn; lặp lại 2 lớp`, `Sponge ${c2.en} from the tip, blending into ${c1.en} mid-nail, cure; repeat twice`)],
    image: ({ c1, c2 }) => `every nail has the same smooth vertical gradient ombre, ${c1.en} near the cuticle blending softly into ${c2.en} at the tip, all five nails matching`,
  },
  {
    id: "aura", occasions: ["spring", "summer", "valentine", "prom", "any"], finishes: ["glossy", "chrome"], systems: ["gelx", "acrylic", "gel"], minutes: 15, price: 10, difficulty: 2, design: true,
    title: (p) => gz(s(`Aura ${p.c2.vi} nền ${p.c1.vi}`, `${cap(p.c2.en)} aura on ${p.c1.en}`), p),
    why: s("móng aura (vầng sáng giữa móng) đang là trend lên nhanh trên mạng xã hội", "aura nails (a glowing center blush) are one of the fastest-rising trends on social"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (vầng aura)`, `${cap(c2.en)} gel (aura)`), m("Mút nhỏ hoặc máy phun airbrush", "Small sponge or airbrush", "1 cái")],
    steps: ({ c2 }) => [s(`Chấm tán ${c2.vi} thành vầng tròn mờ giữa móng, hơ đèn; tán thêm lớp 2 cho đậm tâm`, `Dab ${c2.en} into a soft circle in the center, cure; add a second pass for a deeper core`)],
    image: ({ c1, c2 }) => `${c1.en} base with a soft blurred ${c2.en} aura glow in the center of each nail`,
  },
  {
    id: "tortoise", occasions: ["fall", "thanksgiving", "any"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 20, price: 12, difficulty: 2, design: true, ownColor: true,
    title: ({ metal }) => s(`Đồi mồi caramel viền ${metal.vi}`, `Tortoiseshell with ${metal.en} accents`),
    why: s("đồi mồi là mẫu mùa thu bán chạy, sang mà dễ phối đồ", "tortoiseshell is a fall best-seller — chic and easy to wear"),
    materials: ({ metal }) => [m("Gel nâu caramel trong (jelly)", "Caramel jelly gel"), m("Gel nâu đậm", "Dark brown gel"), LINER(metal), DOT],
    steps: ({ metal }) => [s("Phủ 1 lớp jelly caramel mỏng, hơ đèn", "Apply a thin caramel jelly layer, cure"), s("Chấm loang nâu đậm, chưa hơ đèn để màu tự tan vào nhau", "Dot dark brown and let it bleed before curing"), s("Phủ thêm lớp jelly, hơ đèn để tạo chiều sâu", "Seal with more jelly and cure for depth"), s(`Viền chỉ ${metal.vi} mảnh quanh 2 ngón nhấn`, `Outline two accent nails with a fine ${metal.en} line`)],
    image: ({ metal }) => `glossy caramel and dark brown tortoiseshell pattern with thin ${metal.en} outlines on two accent nails`,
  },
  {
    id: "marble", occasions: ["any", "newyear", "wedding", "christmas"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 20, price: 12, difficulty: 2, design: true,
    title: ({ c1, metal }) => s(`Vân đá ${c1.vi} chỉ ${metal.vi}`, `${cap(c1.en)} marble with ${metal.en} veins`),
    why: s("vân đá chỉ kim loại nhìn cao cấp, giá bán tốt", "metallic-veined marble looks luxe and sells at a premium"),
    materials: ({ metal }) => [m("Gel loang (blooming gel)", "Blooming gel"), m("Gel đen hoặc xám (vẽ vân)", "Black or grey gel (veins)"), LINER(metal), LINER_BRUSH],
    steps: ({ metal }) => [s(`Quét blooming gel trên ${ACC.vi}, kéo vân mảnh bằng cọ nét, để loang 10 giây rồi hơ đèn`, `Brush blooming gel on the ${ACC.en}, drag fine veins, let them bloom 10s, cure`), s(`Viền vài đường chỉ ${metal.vi} dọc theo vân`, `Trace a few ${metal.en} lines along the veins`)],
    image: ({ c1, metal }) => `${c1.en} stone marble effect with thin ${metal.en} veins on two accent nails, solid ${c1.en} on the others`,
  },
  {
    id: "lines", occasions: "any", finishes: ["glossy", "matte"], minutes: 12, price: 6, difficulty: 2, design: true,
    title: ({ c1, metal }) => s(`${capVi(c1.vi)} kẻ chỉ ${metal.vi}`, `${cap(c1.en)} with ${metal.en} line art`),
    why: s("kẻ chỉ tối giản (minimal) hợp khách văn phòng, làm nhanh mà vẫn nổi", "minimal line art suits office clients — fast yet eye-catching"),
    materials: ({ metal }) => [LINER(metal), LINER_BRUSH],
    steps: ({ metal }) => [s(`Kẻ 1–2 đường chỉ ${metal.vi} cong nhẹ trên mỗi móng, hơ đèn`, `Draw one or two gently curved ${metal.en} lines on each nail, cure`)],
    image: ({ c1, metal }) => `${c1.en} nails with clearly visible thin metallic ${metal.en} curved line art painted on every nail`,
  },
  {
    id: "dots", occasions: ["spring", "summer", "backtoschool", "any"], finishes: ["glossy", "matte"], minutes: 10, price: 5, difficulty: 1, design: true,
    title: ({ c1, c2 }) => s(`${capVi(c1.vi)} chấm bi ${c2.vi}`, `${cap(c1.en)} with ${c2.en} polka dots`),
    why: s("chấm bi dễ thương, thợ mới làm đẹp được ngay", "cute polka dots that newer techs can nail on day one"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (chấm bi)`, `${cap(c2.en)} gel (dots)`), DOT],
    steps: ({ c2 }) => [s(`Chấm bi ${c2.vi} đều tay trên ${ACC.vi}, hơ đèn`, `Dot ${c2.en} evenly on the ${ACC.en}, cure`)],
    image: ({ c1, c2 }) => `${c1.en} nails with small neat ${c2.en} polka dots on the accent nails`,
  },
  {
    id: "hearts", occasions: ["valentine"], finishes: ["glossy", "matte"], minutes: 12, price: 6, difficulty: 1, design: true,
    title: ({ c1, c2 }) => s(`${capVi(c1.vi)} tim nhỏ ${c2.vi}`, `${cap(c1.en)} with tiny ${c2.en} hearts`),
    why: s("tim nhỏ là mẫu Valentine được đặt nhiều nhất cho cặp đôi và hội bạn thân", "tiny hearts are the most-booked Valentine look for couples and besties"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (vẽ tim)`, `${cap(c2.en)} gel (hearts)`), DOT],
    steps: ({ c2 }) => [s(`Chấm 2 chấm ${c2.vi} sát nhau rồi kéo nhọn xuống thành tim trên ${ACC.vi}, hơ đèn`, `Place two ${c2.en} dots side by side and drag down into a heart on the ${ACC.en}, cure`)],
    image: ({ c1, c2 }) => `${c1.en} nails with tiny hand-painted ${c2.en} hearts on two accent nails`,
  },
  {
    id: "floral", occasions: ["spring", "mothersday", "wedding", "summer"], finishes: ["glossy", "matte"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Hoa nhí ${c2.vi} nền ${c1.vi}`, `${cap(c2.en)} ditsy florals on ${c1.en}`),
    why: s("hoa nhí vẽ tay nhẹ nhàng, khách tặng mẹ và cô dâu rất chuộng", "hand-painted ditsy florals are a favorite for moms and brides"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (cánh hoa)`, `${cap(c2.en)} gel (petals)`), m("Gel vàng (nhuỵ hoa)", "Yellow gel (flower centers)"), DOT],
    steps: ({ c2 }) => [s(`Chấm 5 cánh hoa ${c2.vi} quanh 1 tâm trên ${ACC.vi}, hơ đèn`, `Dot five ${c2.en} petals around a center on the ${ACC.en}, cure`), s("Chấm nhuỵ vàng giữa mỗi bông, hơ đèn", "Add a yellow center to each flower, cure")],
    image: ({ c1, c2 }) => `${c1.en} nails with small hand-painted five-petal ${c2.en} flowers on accent nails`,
  },
  {
    id: "web", occasions: ["halloween"], finishes: ["matte", "glossy"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1, metal }) => s(`${capVi(c1.vi)} mạng nhện ${metal.vi}`, `${cap(c1.en)} with ${metal.en} spiderwebs`),
    why: s("mạng nhện là mẫu Halloween được hỏi nhiều nhất — sang mà không “lố”", "spiderwebs are the most-requested Halloween look — chic, not costume-y"),
    materials: ({ metal }) => [LINER(metal), LINER_BRUSH],
    steps: ({ metal }) => [s(`Vẽ 3 đường chéo từ góc móng rồi nối các vòng cung ${metal.vi} thành mạng nhện trên ${ACC.vi}`, `Draw three diagonal spokes from a corner and connect ${metal.en} arcs into a web on the ${ACC.en}`)],
    image: ({ c1, metal }) => `${c1.en} nails with delicate thin ${metal.en} spider web line art (only the web lines, no spiders) on two accent nails`,
  },
  {
    id: "snow", occasions: ["christmas", "newyear"], finishes: ["glossy", "matte"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1 }) => s(`Bông tuyết trên nền ${c1.vi}`, `Snowflakes on ${c1.en}`),
    why: s("bông tuyết vẽ tay là mẫu Noel được lưu nhiều nhất", "hand-painted snowflakes are the most-saved holiday look"),
    materials: () => [LINER(COLORS.white), LINER_BRUSH, m("Nhũ bạc mịn (tuỳ chọn)", "Fine silver glitter (optional)", "1 hũ")],
    steps: () => [s(`Vẽ dấu * 6 cánh màu trắng, thêm nhánh nhỏ ở đầu mỗi cánh trên ${ACC.vi}`, `Paint a white six-point star and add tiny branches on each arm on the ${ACC.en}`)],
    image: ({ c1 }) => `${c1.en} nails with delicate white hand-painted snowflakes on accent nails`,
  },
  {
    id: "candy", occasions: ["christmas"], finishes: ["glossy"], minutes: 18, price: 8, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Sọc kẹo gậy ${c1.vi} – ${c2.vi}`, `${cap(c1.en)} & ${c2.en} candy-cane stripes`),
    why: s("sọc kẹo gậy vui mắt, khách trẻ và trẻ em rất thích dịp Noel", "playful candy-cane stripes are a hit with younger clients at Christmas"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (sọc)`, `${cap(c2.en)} gel (stripes)`), m("Băng keo kẻ sọc hoặc cọ nét", "Striping tape or liner brush", "1 cuộn")],
    steps: ({ c2 }) => [s(`Kẻ sọc chéo ${c2.vi} đều nhau trên ${ACC.vi}, hơ đèn`, `Paint even diagonal ${c2.en} stripes on the ${ACC.en}, cure`)],
    image: ({ c1, c2 }) => `diagonal ${c1.en} and ${c2.en} candy-cane stripes on accent nails`,
  },
  {
    id: "stars", occasions: ["newyear", "prom", "trend"], finishes: ["glossy", "chrome"], minutes: 12, price: 8, difficulty: 1, design: true,
    title: ({ c1, metal }) => s(`Sao lấp lánh ${metal.vi} nền ${c1.vi}`, `${cap(c1.en)} with ${metal.en} sparkle stars`),
    why: s("sao lấp lánh hợp đi tiệc đếm ngược, chụp ảnh rất ăn đèn", "sparkle stars are made for countdown parties and photos"),
    materials: ({ metal }) => [m(`Charm ngôi sao ${metal.vi}`, `${cap(metal.en)} star charms`, "1 gói"), m("Gel dán charm", "Charm gel")],
    steps: ({ metal }) => [s(`Gắn charm sao ${metal.vi} bằng gel dán trên ${ACC.vi}, hơ đèn 60 giây`, `Set ${metal.en} star charms with charm gel on the ${ACC.en}, cure 60s`)],
    image: ({ c1, metal }) => `${c1.en} nails with small ${metal.en} star charms on accent nails`,
  },
  {
    id: "gems", occasions: ["prom", "wedding", "newyear"], finishes: ["glossy", "chrome"], systems: ["gelx", "acrylic"], minutes: 20, price: 15, difficulty: 2, design: true,
    title: ({ c1 }) => s(`${capVi(c1.vi)} đính đá`, `${cap(c1.en)} with crystals`),
    why: s("đính đá là lựa chọn số 1 cho prom và tiệc — giá bán cao", "crystals are the #1 pick for prom and parties — a high-ticket service"),
    materials: () => [m("Đá đính móng nhiều size", "Assorted nail crystals", "1 vỉ"), m("Gel dán đá", "Gem gel"), m("Que chấm sáp gắp đá", "Wax pick-up pencil", "1 cây")],
    steps: () => [s(`Gắp đá xếp vòng cung ở chân móng ${ACC.vi}, cố định bằng gel dán đá, hơ đèn 60 giây`, `Arrange crystals in an arc at the cuticle of the ${ACC.en}, secure with gem gel, cure 60s`)],
    image: ({ c1 }) => `${c1.en} nails with an arc of small clear crystals at the cuticle of accent nails`,
  },
  {
    id: "pearls", occasions: ["wedding", "mothersday"], finishes: ["glossy", "chrome"], systems: ["gelx", "acrylic", "gel"], minutes: 15, price: 10, difficulty: 1, design: true,
    title: ({ c1 }) => s(`${capVi(c1.vi)} ngọc trai`, `${cap(c1.en)} with pearls`),
    why: s("ngọc trai nhỏ là chi tiết cô dâu chọn nhiều nhất", "tiny pearls are the detail brides ask for most"),
    materials: () => [m("Hạt ngọc trai mini", "Mini nail pearls", "1 hũ"), m("Gel dán charm", "Charm gel")],
    steps: () => [s(`Gắn 3–5 hạt ngọc trai ở chân móng ${ACC.vi}, hơ đèn 60 giây`, `Place three to five pearls at the cuticle of the ${ACC.en}, cure 60s`)],
    image: ({ c1 }) => `${c1.en} nails with tiny white pearls at the cuticle of accent nails`,
  },
  {
    id: "leaf", occasions: ["fall", "thanksgiving"], finishes: ["glossy", "matte"], minutes: 12, price: 6, difficulty: 1, design: true,
    title: ({ c1, metal }) => s(`Lá phong ${metal.vi} nền ${c1.vi}`, `${cap(metal.en)} maple leaf on ${c1.en}`),
    why: s("lá phong nhỏ trên ngón áp út — mẫu mùa thu, Lễ Tạ Ơn dễ bán", "a tiny maple leaf on the ring finger — an easy fall and Thanksgiving seller"),
    materials: ({ metal }) => [m(`Sticker lá phong ${metal.vi}`, `${cap(metal.en)} maple leaf decals`, "1 tấm")],
    steps: () => [s("Dán sticker lá phong lên ngón áp út trước lớp top", "Place a maple decal on the ring finger before top coat")],
    image: ({ c1, metal }) => `${c1.en} nails with a small ${metal.en} maple leaf on the ring finger`,
  },
  {
    id: "blossom", occasions: ["tet"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1, c2 }) => (isMai(c1, c2) ? s(`Hoa mai vẽ tay nền ${c1.vi}`, `Apricot blossoms on ${c1.en}`) : s(`Hoa đào vẽ tay nền ${c1.vi}`, `Peach blossoms on ${c1.en}`)),
    why: s("hoa mai, hoa đào vẽ tay là mẫu Tết khách Việt và khách Á Đông hỏi nhiều nhất", "hand-painted blossoms are the Lunar New Year look Vietnamese and Asian clients ask for most"),
    materials: ({ c1, c2 }) => [m(`Gel ${isMai(c1, c2) ? "vàng mai" : "hồng đào"} (cánh hoa)`, `${isMai(c1, c2) ? "Apricot yellow" : "Peach pink"} gel (petals)`), m("Gel nâu (cành)", "Brown gel (branches)"), LINER_BRUSH, DOT],
    steps: () => [s(`Kẻ cành nâu mảnh chéo móng trên ${ACC.vi}`, `Draw a thin brown branch diagonally on the ${ACC.en}`), s("Chấm 5 cánh hoa dọc cành, chấm nhuỵ, hơ đèn", "Dot five-petal blossoms along the branch, add centers, cure")],
    image: ({ c1, c2 }) => `${c1.en} nails with hand-painted ${isMai(c1, c2) ? "yellow apricot" : "pink peach"} blossoms on a thin brown branch on accent nails`,
  },
  {
    id: "plaid", occasions: ["backtoschool", "fall"], finishes: ["matte", "glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Caro ${c1.vi} – ${c2.vi}`, `${cap(c1.en)} & ${c2.en} plaid`),
    why: s("caro kiểu áo dạ là mẫu tựu trường và đầu thu đang lên", "flannel plaid is trending for back-to-school and early fall"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (kẻ caro)`, `${cap(c2.en)} gel (plaid lines)`), LINER(COLORS.white), LINER_BRUSH],
    steps: ({ c2 }) => [s(`Kẻ 2 sọc dọc + 2 sọc ngang ${c2.vi} trên ${ACC.vi}, hơ đèn`, `Paint two vertical and two horizontal ${c2.en} bands on the ${ACC.en}, cure`), s("Thêm sọc trắng mảnh xen giữa, hơ đèn", "Add thin white lines in between, cure")],
    image: ({ c1, c2 }) => `${c1.en} nails, with a neat ${c1.en}, ${c2.en} and thin white tartan plaid pattern painted on two accent nails only`,
  },
  {
    id: "waves", retired: true, occasions: ["summer"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1 }) => s(`Sóng biển ${c1.vi}`, `${cap(c1.en)} ocean waves`),
    why: s("sóng biển hợp khách đi du lịch mùa hè, làm cả tay lẫn chân", "ocean waves suit vacation clients — great for mani + pedi combos"),
    materials: () => [LINER(COLORS.white), LINER_BRUSH],
    steps: () => [s(`Kẻ 2–3 đường sóng uốn lượn màu trắng ở đầu móng ${ACC.vi}, hơ đèn`, `Paint two or three white wavy lines across the tips of the ${ACC.en}, cure`)],
    image: ({ c1 }) => `${c1.en} nails with white swirling ocean-wave lines across the tips`,
  },

  // ---------------- Nail Hàn / nude tối giản (quanh năm) ----------------
  {
    id: "jelly", occasions: ["korean"], finishes: ["glossy", "chrome"], systems: ["gelx", "gel", "acrylic"], minutes: 5, price: 3, difficulty: 1, design: false,
    title: ({ c1, finish }) => finish === "chrome" ? s(`Thạch ${c1.vi} tráng ngọc trai`, `Sheer ${c1.en} with pearl glaze`) : s(`Thạch ${c1.vi} trong veo`, `Sheer ${c1.en} jelly`),
    why: s("nail thạch trong veo kiểu Hàn đang được đặt nhiều nhất — nhẹ nhàng, móng mọc ra vẫn đẹp", "Korean-style sheer jelly nails are the most-booked look — soft, and they grow out gracefully"),
    materials: ({ c1 }) => [m(`Gel thạch (sheer) ${c1.vi}`, `${cap(c1.en)} sheer jelly gel`)],
    steps: ({ c1 }) => [s(`Thêm 1 lớp thạch ${c1.vi} thật mỏng để vẫn thấy móng thật bên dưới, hơ đèn`, `Add one very thin ${c1.en} jelly layer so the natural nail still shows through, cure`)],
    image: ({ c1 }) => `translucent sheer ${c1.en} jelly nails, clean minimalist Korean nail style`,
  },
  {
    id: "babyboomer", occasions: ["korean", "wedding"], finishes: ["glossy", "glitter"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: () => s("Ombre baby boomer hồng – trắng sữa", "Pink to milky white baby boomer"),
    why: s("baby boomer (hồng nude chuyển trắng sữa) là mẫu sang, hợp mọi khách và mọi dịp", "baby boomer (pink nude fading to milky white) is elegant and suits every client and occasion"),
    materials: ({ sys }) => [sys.id === "dip" ? m("Bột dip trắng sữa", "Milky white dip powder", "1 hũ") : m("Gel trắng sữa", "Milky white gel polish"), m("Mút tán màu / cọ ombre", "Ombre sponge or brush", "1 cái")],
    steps: ({ sys }) => [sys.id === "dip" ? s("Nhúng trắng sữa từ đầu móng lên 2/3 móng, rắc nhẹ phần chuyển màu cho mờ", "Dip milky white from the tip up two-thirds, sprinkle lightly to soften the blend") : s("Tán trắng sữa từ đầu móng vào, mờ dần về chân móng; hơ đèn, lặp lại 2 lớp", "Sponge milky white from the tip, fading toward the cuticle; cure, repeat twice")],
    image: () => "every nail has the same soft baby boomer gradient, pink nude near the cuticle blending into milky white at the tip, all five nails matching",
  },
  {
    id: "chromefrench", occasions: ["korean", "newyear", "wedding"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 10, difficulty: 2, design: true,
    title: ({ c1, metal }) => s(`French tráng gương ${metal.vi} nền ${c1.vi}`, `${cap(metal.en)} chrome French on ${c1.en}`),
    why: s("đầu French tráng gương (bạc, ngọc trai) đang thay French trắng — sang, ăn ảnh", "mirror-chrome French tips (silver or pearl) are replacing white French — luxe and photogenic"),
    materials: ({ metal }) => [m(`Bột tráng gương ${metal.vi}`, `${cap(metal.en)} chrome powder`, "1 hũ"), m("Top gel bóng (no-wipe)", "No-wipe glossy top coat"), m("Cọ French dẹt", "Flat French brush", "1 cây")],
    steps: ({ metal }) => [s("Kẻ đầu French mảnh bằng top no-wipe, hơ đèn", "Paint a thin French tip with no-wipe top, cure"), s(`Xoa bột tráng gương ${metal.vi} lên đầu French, phủ top khoá bột, hơ đèn`, `Buff ${metal.en} chrome powder onto the tips, seal with top coat, cure`)],
    image: ({ c1, metal }) => `${c1.en} base with clearly contrasting French tips made of highly reflective mirror-like metallic ${metal.en} chrome that shines like polished metal on every nail`,
  },
  {
    id: "charm3d", occasions: ["korean", "valentine", "wedding"], finishes: ["glossy", "cateye"], systems: ["gelx", "acrylic", "gel"], minutes: 15, price: 10, difficulty: 1, design: true,
    title: ({ c1, metal }) => s(`${capVi(c1.vi)} charm nơ ${metal.vi} 3D`, `${cap(c1.en)} with 3D ${metal.en} bow charms`),
    why: s("charm kim loại 3D (nơ, tim, hoa) trên 1–2 ngón đang rất hot với khách trẻ", "3D metal charms (bows, hearts, flowers) on one or two nails are hot with younger clients"),
    materials: ({ metal }) => [m(`Charm kim loại 3D ${metal.vi} (nơ / tim / hoa)`, `3D ${metal.en} metal charms (bow / heart / flower)`, "1 gói"), m("Gel dán charm", "Charm gel"), m("Kềm gắp charm", "Charm tweezers", "1 cây")],
    steps: ({ metal }) => [s(`Chấm gel dán, đặt charm ${metal.vi} giữa móng ${ACC.vi}, hơ đèn 60 giây; phủ top quanh viền charm (không phủ lên mặt charm)`, `Dot charm gel, set the ${metal.en} charm on the ${ACC.en}, cure 60s; top coat around the charm edge (not over its face)`)],
    image: ({ c1, metal }) => `${c1.en} nails with small 3D ${metal.en} bow charms on two accent nails`,
  },
  {
    id: "polka", occasions: ["trend", "korean", "any"], finishes: ["glossy", "cateye", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 1, design: true,
    title: ({ c1, c2, finish }) => finish === "cateye" ? s(`Mắt mèo ${c1.vi} chấm bi ${c2.vi}`, `${cap(c1.en)} polka dot cat eye`) : s(`Chấm bi ${c2.vi} nền ${c1.vi}`, `${cap(c2.en)} polka dots on ${c1.en}`),
    why: s("chấm bi đang hot lại — riêng \"mắt mèo chấm bi\" tăng 1.585% lượt tìm trên Pinterest (Pinterest Predicts 2026)", "polka dots are back — \"polka dot cat eye nails\" searches jumped 1,585% on Pinterest (Pinterest Predicts 2026)"),
    materials: ({ c2 }) => [m(`Gel vẽ ${c2.vi}`, `${cap(c2.en)} art gel`), DOT],
    steps: ({ c2 }) => [s(`Chấm bi ${c2.vi} đều tay thành hàng so le trên cả 5 móng (cây chấm bi cỡ vừa), hơ đèn`, `Dot ${c2.en} polka dots in staggered rows on all five nails (medium dotting tool), cure`)],
    image: ({ c1, c2 }) => `${c1.en} nails with neat small ${c2.en} polka dots in staggered rows on every nail`,
  },
  {
    id: "auroracat", occasions: ["newyear"], badBase: ["white", "pearl", "sheer", "pinkNude", "babyPink", "nude", "cloudDancer", "butter"], finishes: ["cateye"], systems: ["gelx", "gel", "acrylic"], minutes: 10, price: 8, difficulty: 2, design: true,
    title: ({ c1 }) => s(`Mắt mèo aurora nền ${c1.vi}`, `Aurora cat eye on ${c1.en}`),
    why: s("mắt mèo aurora đổi sắc như cực quang — tìm kiếm tăng 895% trên Pinterest (Pinterest Predicts 2026)", "aurora cat eye shifts colour like the northern lights — searches up 895% on Pinterest (Pinterest Predicts 2026)"),
    materials: () => [m("Gel mắt mèo aurora (nhũ đổi màu)", "Aurora (multichrome) cat-eye gel"), m("Nam châm mắt mèo", "Cat-eye magnet", "1 cây")],
    steps: () => [s("Phủ 1 lớp gel mắt mèo aurora mỏng, hút nam châm nghiêng 45° để dải sáng đổi sắc chạy chéo, hơ đèn ngay", "Apply a thin coat of aurora cat-eye gel, hold the magnet at 45° so the colour-shifting band runs diagonally, cure right away")],
    image: ({ c1 }) => `${c1.en} cat eye nails with a glowing multichrome aurora band shifting pink, violet and icy blue`,
  },
  {
    id: "stripes", occasions: ["trend", "korean", "summer"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1, c2, metal }) => s(`Sọc mảnh ${c2.vi} & ${metal.vi} nền ${c1.vi}`, `${cap(c2.en)} & ${metal.en} pinstripes on ${c1.en}`),
    why: s("móng hạnh nhân kẻ sọc tăng 694% lượt tìm (Pinterest Predicts 2026) — làm ngón tay thon dài", "almond nails with stripes are up 694% in searches (Pinterest Predicts 2026) — they make fingers look longer"),
    materials: ({ c2, metal }) => [LINER(c2), LINER(metal), LINER_BRUSH],
    steps: ({ c2, metal }) => [s(`Kẻ sọc mảnh dọc móng xen kẽ ${c2.vi} và ${metal.vi} (cọ nét 9mm, kéo 1 lần từ chân lên đầu móng), hơ đèn`, `Pull thin vertical stripes alternating ${c2.en} and ${metal.en} (9mm liner, one stroke base to tip), cure`)],
    image: ({ c1, c2, metal }) => `${c1.en} almond nails with thin vertical ${c2.en} and ${metal.en} pinstripes`,
  },
  {
    id: "chocodip", occasions: ["trend", "valentine", "summer"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Dâu nhúng sô-cô-la (${c1.vi} – ${c2.vi})`, `Chocolate-covered strawberry (${c1.en} & ${c2.en})`),
    why: s("\"dâu nhúng sô-cô-la\" là 1 trong các màu nail Pinterest dự báo cho 2026 — ngọt, ấm, rất ăn ảnh", "\"chocolate-covered strawberry\" is one of Pinterest's predicted nail looks for 2026 — sweet, warm and photogenic"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi}`, `${cap(c2.en)} gel`), LINER(COLORS.white), LINER_BRUSH],
    steps: ({ c2 }) => [s(`Phủ đầu móng bằng gel ${c2.vi} theo đường lượn sóng + 1–2 giọt chảy, hơ đèn`, `Paint the tips in ${c2.en} gel with a wavy edge and one or two drips, cure`), s("Rưới vài nét trắng mảnh chéo lên phần sô-cô-la, hơ đèn", "Drizzle a few thin white diagonal lines over the chocolate, cure")],
    image: ({ c1, c2 }) => `${c1.en} nails with ${c2.en} chocolate dipped wavy tips and thin white drizzle, like chocolate covered strawberries`,
  },
  {
    id: "fawn", occasions: ["fall", "trend"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Da hươu ${c2.vi} nền ${c1.vi}`, `${cap(c2.en)} fawn print on ${c1.en}`),
    why: s("họa tiết da hươu (fawn) mềm mại là bản animal print của mùa thu 2026 — nhẹ nhàng hơn da báo", "soft fawn print is fall 2026's animal print — gentler than leopard"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi}`, `${cap(c2.en)} gel`), m("Cọ tán mềm", "Soft blending brush", "1 cây")],
    steps: ({ c2 }) => [s(`Chấm các đốm thuôn ${c2.vi} trên ${ACC.vi}, tán nhẹ mép cho loang mềm (không viền), hơ đèn`, `Dab elongated ${c2.en} spots on the ${ACC.en}, soften the edges with a brush (no outline), cure`)],
    image: ({ c1, c2 }) => `${c1.en} nails with soft ${c2.en} fawn spots on two accent nails`,
  },
  {
    id: "chromedrops", occasions: ["korean", "newyear", "any"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 20, price: 12, difficulty: 2, design: true,
    title: ({ c1, metal }) => s(`${capVi(c1.vi)} giọt chrome ${metal.vi} 3D`, `${cap(c1.en)} with 3D ${metal.en} chrome drops`),
    why: s("giọt chrome kim loại 3D (blob) là trend lên ngôi — như giọt bạc / vàng nóng chảy trên móng, cực bắt sáng", "3D chrome blobs are trending hard — like drops of molten silver or gold, super eye-catching"),
    materials: ({ metal }) => [m("Gel đặc 3D (gel vẽ nổi)", "3D sculpting gel"), m(`Bột tráng gương ${metal.vi}`, `${cap(metal.en)} chrome powder`, "1 hũ"), m("Top gel bóng (no-wipe)", "No-wipe glossy top coat")],
    steps: ({ metal }) => [s("Chấm gel đặc thành giọt tròn to nhỏ khác nhau, hơ đèn 60 giây", "Dot thick gel into round drops of mixed sizes, cure 60s"), s(`Phủ top no-wipe, hơ đèn, xoa bột tráng gương ${metal.vi} lên các giọt`, `No-wipe top, cure, then buff ${metal.en} chrome powder onto the drops`), s("Phủ top khoá bột, hơ đèn", "Seal with top coat, cure")],
    image: ({ c1, metal }) => `${c1.en} nails decorated with glossy 3D ${metal.en} chrome blob drops of different sizes`,
  },
  {
    id: "droplets", occasions: ["korean", "any"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 15, price: 10, difficulty: 2, design: true,
    title: ({ c1 }) => s(`${capVi(c1.vi)} giọt nước 3D`, `${cap(c1.en)} with 3D water drops`),
    why: s("giọt nước 3D trong veo đang viral — móng như vừa đọng sương, chụp ảnh rất ăn", "glassy 3D water drops are viral right now — dewy and very photogenic"),
    materials: () => [m("Gel đặc trong suốt (gel giọt nước 3D / builder trong)", "Clear thick gel (3D drop gel / clear builder)"), m("Cây chấm bi", "Dotting tool", "1 cây"), m("Top gel bóng (no-wipe)", "No-wipe glossy top coat")],
    steps: () => [s("Chấm từng giọt gel đặc trong suốt to nhỏ khác nhau lên móng, chờ 5 giây cho giọt tự tròn rồi hơ đèn 60 giây", "Dot clear thick gel in mixed sizes, wait 5s for each drop to dome, then cure 60s"), s("Phủ top bóng mỏng cả móng lẫn giọt, hơ đèn", "Thin glossy top coat over the nail and drops, cure")],
    image: ({ c1 }) => `${c1.en} nails decorated with several glossy clear 3D water droplets of different sizes`,
  },
  {
    id: "gemcluster", occasions: ["korean", "prom", "newyear"], finishes: ["glossy"], systems: ["gelx", "acrylic"], minutes: 25, price: 18, difficulty: 2, design: true,
    title: ({ c1 }) => s(`${capVi(c1.vi)} cụm đá & charm`, `${cap(c1.en)} with crystal clusters`),
    why: s("cụm đá mix charm trên 2 ngón là điểm nhấn sang kiểu Hàn — giá bán cao", "crystal-and-charm clusters on two nails are a luxe Korean-style accent — a high-ticket add-on"),
    materials: () => [m("Đá đính móng nhiều size (pha lê + đá màu khói)", "Assorted crystals (clear + smoky)", "1 vỉ"), m("Charm bạc mini", "Mini silver charms", "1 gói"), m("Gel dán đá đặc (builder)", "Thick gem gel (builder)"), m("Que sáp gắp đá", "Wax pick-up pencil", "1 cây")],
    steps: () => [s(`Đắp gel dán đặc thành cụm nhỏ trên ${ACC.vi}`, `Build a small mound of gem gel on the ${ACC.en}`), s("Đặt đá to giữa, đá nhỏ và charm xung quanh cho kín chân; hơ đèn 60 giây", "Place a large stone in the middle, small stones and charms around it; cure 60s"), s("Phủ top quanh chân đá để khoá, không phủ lên mặt đá", "Seal top coat around the base of the stones, not over their faces")],
    image: ({ c1 }) => `${c1.en} nails with a cluster of clear crystals and tiny silver charms on two accent nails`,
  },
  {
    id: "foil", occasions: ["korean", "newyear", "fall"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 10, price: 6, difficulty: 1, design: true,
    title: ({ c1, metal }) => s(`${capVi(c1.vi)} giấy ${metal.vi} (foil)`, `${cap(c1.en)} with ${metal.en} foil flakes`),
    why: s("vụn giấy foil kim loại tạo điểm sáng nhẹ, làm nhanh mà nhìn cao cấp", "metallic foil flakes add a subtle glint — quick to do, looks high-end"),
    materials: ({ metal }) => [m(`Giấy foil ${metal.vi} (dạng vụn)`, `${cap(metal.en)} foil flakes`, "1 hũ"), m("Gel dán foil", "Foil gel")],
    steps: ({ metal }) => [s(`Quét gel dán foil, chờ 10 giây, ấn vụn foil ${metal.vi} lên ${ACC.vi}, hơ đèn`, `Brush foil gel, wait 10s, press ${metal.en} foil flakes onto the ${ACC.en}, cure`)],
    image: ({ c1, metal }) => `${c1.en} nails with scattered crinkled ${metal.en} foil flakes on accent nails`,
  },
  {
    id: "chromeline", occasions: ["korean", "prom"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 20, price: 12, difficulty: 2, design: true,
    title: ({ c1, metal }) => s(`${capVi(c1.vi)} line ${metal.vi} nổi tráng gương`, `${cap(c1.en)} with raised ${metal.en} chrome lines`),
    why: s("đường line nổi tráng gương (3D chrome) là trend nail Hàn đang lên nhanh", "raised 3D chrome lines are a fast-rising Korean nail trend"),
    materials: ({ metal }) => [m("Gel vẽ nổi 3D", "3D sculpting gel"), m(`Bột tráng gương ${metal.vi}`, `${cap(metal.en)} chrome powder`, "1 hũ"), LINER_BRUSH],
    steps: ({ metal }) => [s("Vẽ đường cong nổi bằng gel 3D, hơ đèn (lau lớp dính)", "Draw raised curved lines with 3D gel, cure (wipe the sticky layer)"), s(`Xoa bột tráng gương ${metal.vi} lên đường nổi, phủ top bóng khoá bột`, `Buff ${metal.en} chrome onto the raised lines, seal with glossy top`)],
    image: ({ c1, metal }) => `${c1.en} nails with raised organic mirror ${metal.en} chrome lines`,
  },
  {
    id: "mixmatch", occasions: ["korean", "fall"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 5, price: 3, difficulty: 1, design: false,
    title: ({ c1, c2 }) => s(`Mix màu ${c1.vi} – ${c2.vi}`, `${cap(c1.en)} & ${c2.en} mix-and-match`),
    why: s("mix 2 tông màu xen kẽ các ngón là cách nhanh nhất để móng có điểm nhấn", "alternating two tones across the fingers is the quickest way to make a set stand out"),
    materials: ({ c2, sys }) => [sys.colorMat(c2)],
    steps: ({ c2 }) => [s(`Ngón giữa và ngón áp út đổi sang ${c2.vi} (2 lớp, hơ đèn mỗi lớp)`, `Switch the middle and ring fingers to ${c2.en} (two coats, cure each)`)],
    image: ({ c1, c2 }) => `mix-and-match manicure alternating ${c1.en} and ${c2.en} nails`,
  },

  // ---------------- Trend đang được ưa chuộng (quanh năm) ----------------
  {
    id: "doublefrench", occasions: ["trend", "korean", "wedding"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1, c2, metal }) => s(`French đôi ${c2.vi} viền ${metal.vi} nền ${c1.vi}`, `${cap(c2.en)} & ${metal.en} double French on ${c1.en}`),
    why: s("French đôi (2 đường mảnh song song ở đầu móng) là biến tấu French đang được lưu nhiều", "the double French (two fine parallel tip lines) is the French twist everyone is saving"),
    materials: ({ c2, metal }) => [m(`Gel ${c2.vi} (đường French)`, `${cap(c2.en)} gel (French line)`), LINER(metal), LINER_BRUSH],
    steps: ({ c2, metal }) => [s(`Kẻ đường French ${c2.vi} thật mảnh ở đầu móng, hơ đèn`, `Paint a micro-thin ${c2.en} French line at the tip, cure`), s(`Kẻ đường thứ hai ${metal.vi} song song, cách đường đầu ~1mm, hơ đèn`, `Add a second ${metal.en} line parallel to it, about 1 mm below, cure`)],
    image: ({ c1, c2, metal }) => `${c1.en} nails with a clearly visible double French on every nail: a thin ${c2.en} tip line and a second fine ${metal.en} line just below it, crisp and parallel`,
  },
  {
    id: "swirl", occasions: ["trend", "summer", "spring"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1, c2, metal }) => s(`Swirl ${c2.vi} – ${metal.vi} nền ${c1.vi}`, `${cap(c2.en)} & ${metal.en} swirls on ${c1.en}`),
    why: s("đường swirl uốn lượn kiểu retro đang là trend vẽ tay được thử nhiều nhất", "retro abstract swirls are the hand-painted trend clients try most"),
    materials: ({ c2, metal }) => [m(`Gel ${c2.vi} (đường swirl)`, `${cap(c2.en)} gel (swirls)`), LINER(metal), LINER_BRUSH],
    steps: ({ c2, metal }) => [s(`Kẻ 2–3 đường cong uốn lượn ${c2.vi} chạy từ cạnh móng, hơ đèn`, `Paint two or three flowing ${c2.en} curves from the side of each nail, cure`), s(`Viền thêm 1 đường ${metal.vi} mảnh song song với đường cong, hơ đèn`, `Trace one fine ${metal.en} line alongside the curves, cure`)],
    image: ({ c1, c2, metal }) => `${c1.en} nails with flowing retro abstract swirl lines in ${c2.en} and thin ${metal.en}`,
  },
  {
    id: "droplet", retired: true, occasions: ["trend", "korean", "summer"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 1, design: true,
    title: ({ c1 }) => s(`Giọt nước 3D trên nền ${c1.vi}`, `3D water droplets on ${c1.en}`),
    why: s("giọt nước 3D trong veo nhìn như móng vừa ướt — trend 'glass nails' ăn ảnh", "clear 3D droplets make nails look freshly dewy — the photogenic 'glass nails' trend"),
    materials: () => [m("Gel đắp trong suốt (builder clear)", "Clear builder gel"), DOT],
    steps: () => [s(`Chấm các giọt gel trong to nhỏ trên ${ACC.vi}, chờ 5 giây cho giọt tự tròn rồi hơ đèn`, `Dot clear gel droplets of different sizes on the ${ACC.en}, wait 5s for them to dome, cure`)],
    image: ({ c1 }) => `glossy ${c1.en} nails with clear raised 3D water droplet bubbles on two accent nails, wet glass look`,
  },
  {
    id: "milkbath", occasions: ["trend", "spring", "wedding", "mothersday", "korean"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 12, difficulty: 2, design: true, ownColor: true,
    title: ({ c2 }) => s(`Milk bath hoa khô ${c2.vi}`, `${cap(c2.en)} milk bath nails`),
    why: s("milk bath (hoa khô ẩn dưới lớp trắng sữa) là mẫu mùa xuân và cô dâu được lưu nhiều", "milk bath nails (dried flowers under milky white) are a top saved look for spring and brides"),
    materials: ({ c2 }) => [m("Gel thạch trắng sữa (milky jelly)", "Milky white jelly gel"), m(`Hoa khô mini tông ${c2.vi}`, `Mini dried flowers (${c2.en} tones)`, "1 hộp"), m("Kềm gắp", "Tweezers", "1 cây")],
    steps: () => [s("Sơn 1 lớp thạch trắng sữa, đặt hoa khô lên khi chưa hơ đèn, ấn nhẹ cho phẳng, hơ đèn", "Paint one milky jelly coat, set the dried flowers before curing, press flat, cure"), s("Phủ thêm 1 lớp thạch trắng sữa mỏng trùm lên hoa để hoa 'chìm' mờ, hơ đèn", "Cover with another thin milky coat so the flowers look softly submerged, cure")],
    image: ({ c2 }) => `milky white jelly nails with tiny ${c2.en} dried flowers softly visible under the milky layer`,
  },
  {
    id: "leopard", occasions: ["trend", "fall"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Da báo ${c2.vi} nền ${c1.vi}`, `${cap(c2.en)} leopard print on ${c1.en}`),
    why: s("hoạ tiết da báo quay lại mạnh — làm 2 ngón nhấn là đủ sang", "leopard print is back — two accent nails is all it takes"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (đốm báo)`, `${cap(c2.en)} gel (spots)`), LINER(COLORS.black), LINER_BRUSH],
    steps: ({ c2 }) => [s(`Chấm các đốm ${c2.vi} không đều nhau trên ${ACC.vi}, hơ đèn`, `Dab irregular ${c2.en} spots on the ${ACC.en}, cure`), s("Viền mỗi đốm bằng nét đen đứt quãng hình chữ C, hơ đèn", "Outline each spot with broken black C-shaped strokes, cure")],
    image: ({ c1, c2 }) => `${c1.en} nails with ${c2.en} and black leopard print spots on two accent nails`,
  },
  {
    id: "checker", occasions: ["trend", "summer", "backtoschool"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 25, price: 12, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Bàn cờ ${c1.vi} – ${c2.vi}`, `${cap(c1.en)} & ${c2.en} checkerboard`),
    why: s("hoạ tiết bàn cờ (checkerboard) là trend trẻ trung, khách Gen Z rất thích", "checkerboard nails are a playful trend Gen Z clients love"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (ô cờ)`, `${cap(c2.en)} gel (squares)`), m("Cọ dẹt nhỏ", "Small flat brush", "1 cây")],
    steps: ({ c2 }) => [s(`Chia mặt móng ${ACC.vi} thành lưới ô vuông nhỏ, tô xen kẽ ô ${c2.vi}, hơ đèn`, `Grid the ${ACC.en} into small squares and fill alternating squares with ${c2.en}, cure`)],
    image: ({ c1, c2 }) => `${c1.en} nails with a neat ${c1.en} and ${c2.en} checkerboard pattern on two accent nails`,
  },
  {
    id: "cherry", occasions: ["trend", "summer", "valentine"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1 }) => s(`Cherry đỏ vẽ tay nền ${c1.vi}`, `Hand-painted cherries on ${c1.en}`),
    why: s("cherry đỏ vẽ tay nhỏ xinh là mẫu 'cherry coded' đang hot", "tiny hand-painted cherries are the hot 'cherry-coded' look"),
    materials: () => [m("Gel đỏ cherry (quả)", "Cherry red gel (fruit)"), m("Gel xanh lá (cuống, lá)", "Green gel (stems, leaves)"), LINER_BRUSH, DOT],
    steps: () => [s(`Chấm 2 quả cherry đỏ cạnh nhau trên ${ACC.vi}, hơ đèn`, `Dot two red cherries side by side on the ${ACC.en}, cure`), s("Kẻ cuống xanh nối 2 quả, thêm 1 lá nhỏ và chấm điểm sáng trắng lên quả, hơ đèn", "Draw green stems joining them, add a tiny leaf and a white highlight dot, cure")],
    image: ({ c1 }) => `${c1.en} nails with tiny hand-painted red cherries with green stems on two accent nails`,
  },
  {
    id: "lace", occasions: ["wedding", "korean", "valentine"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 10, difficulty: 2, design: true,
    title: ({ c1 }) => s(`Ren trắng nền ${c1.vi}`, `White lace on ${c1.en}`),
    why: s("hoạ tiết ren in (stamping) nhìn tinh tế như váy cưới, làm nhanh hơn vẽ tay", "stamped lace looks as delicate as a wedding dress and is faster than hand-painting"),
    materials: () => [m("Khuôn in hoạ tiết ren (stamping plate)", "Lace stamping plate", "1 tấm"), m("Sơn in stamping trắng", "White stamping polish"), m("Con dấu silicone + gạt", "Silicone stamper + scraper", "1 bộ")],
    steps: () => [s(`Quét sơn stamping trắng lên khuôn ren, gạt sạch, lăn con dấu rồi in lên ${ACC.vi}`, `Swipe white stamping polish over the lace plate, scrape, pick up with the stamper and press onto the ${ACC.en}`), s("Chờ khô 1 phút trước khi phủ top để không lem", "Let it dry a minute before top coat so it doesn't smear")],
    image: ({ c1 }) => `${c1.en} nails with delicate white stamped lace pattern on two accent nails`,
  },
  {
    id: "negative", occasions: ["trend", "korean"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true, ownColor: true,
    title: ({ c2, metal }) => s(`Negative space ${c2.vi} viền ${metal.vi}`, `${cap(c2.en)} negative space with ${metal.en}`),
    why: s("negative space (chừa móng thật, vẽ khối hình học) — tối giản mà vẫn nghệ thuật, móng mọc ra không lộ", "negative space (bare nail with geometric shapes) is minimal yet artsy — and grows out invisibly"),
    materials: ({ c2, metal }) => [m("Gel base trong / nude trong", "Clear or sheer nude base gel"), m(`Gel ${c2.vi} (khối hình)`, `${cap(c2.en)} gel (shapes)`), LINER(metal), LINER_BRUSH],
    steps: ({ c2, metal }) => [s("Phủ 1 lớp base trong (giữ màu móng thật), hơ đèn", "Apply a clear base layer (keep the natural nail visible), cure"), s(`Vẽ khối nửa vầng trăng / hình học ${c2.vi} ở 1 góc móng, chừa khoảng trống còn lại, hơ đèn`, `Paint a ${c2.en} half-moon or geometric block in one corner, leaving the rest bare, cure`), s(`Viền mép khối bằng nét ${metal.vi} mảnh, hơ đèn`, `Edge the shape with a fine ${metal.en} line, cure`)],
    image: ({ c2, metal }) => `negative space nails: clear natural base with ${c2.en} geometric half-moon shapes outlined in thin ${metal.en}`,
  },
  {
    id: "velvet", occasions: ["trend", "fall", "christmas", "korean"], finishes: ["cateye"], systems: ["gelx", "gel", "acrylic"], minutes: 5, price: 5, difficulty: 2, design: false,
    // nền "đỏ nhung" (red velvet) → "Velvet đỏ nhung", không "Velvet nhung đỏ nhung"
    title: ({ c1 }) => (/nhung/.test(c1.vi) ? s(`Velvet ${c1.vi}`, `${cap(c1.en)} nails`) : s(`Velvet nhung ${c1.vi}`, `${cap(c1.en)} velvet nails`)),
    why: s("móng velvet (mắt mèo rải đều như nhung) đang thay mắt mèo dải sáng — nhìn sang, lấp lánh dưới đèn", "velvet nails (cat-eye spread evenly like velvet) are replacing the classic cat-eye stripe — luxe and sparkly"),
    materials: () => [m("Nam châm phẳng cho hiệu ứng velvet", "Flat magnet for velvet effect", "1 cái")],
    steps: () => [],
    image: ({ c1 }) => `${c1.en} velvet nails covered edge to edge in dense fine shimmering magnetic sparkle, plush velvet texture clearly visible`,
  },

  // ---------------- Halloween 🎃 (vẽ trên 1–2 ngón nhấn, còn lại màu nền) ----------------
  {
    id: "ghost", occasions: ["halloween"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 1, design: true, badBase: ["white", "pearl", "butter", "sheer"],
    title: ({ c1 }) => s(`Ma trắng dễ thương nền ${c1.vi}`, `Cute white ghosts on ${c1.en}`),
    why: s("ma trắng mặt cười là mẫu Halloween dễ thương, khách mọi tuổi đều chọn", "cute smiling ghosts are the Halloween look every age group picks"),
    materials: () => [m("Gel trắng đặc (thân ma)", "Opaque white gel (ghost body)"), LINER(COLORS.black), DOT],
    steps: () => [s(`Vẽ thân ma trắng hình giọt nước lộn ngược, chân lượn sóng trên ${ACC.vi}, hơ đèn`, `Paint an upside-down teardrop white ghost with a wavy hem on the ${ACC.en}, cure`), s("Chấm 2 mắt + miệng tròn đen, hơ đèn", "Dot two black eyes and a round mouth, cure")],
    image: ({ c1 }) => `${c1.en} nails with a small cute hand-painted white cartoon ghost with black dot eyes on two accent nails`,
  },
  {
    id: "jackolantern", occasions: ["halloween"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 1, design: true, badBase: ["pumpkin", "burnt", "caramel"],
    title: ({ c1 }) => s(`Bí ngô mặt cười nền ${c1.vi}`, `Jack-o'-lantern on ${c1.en}`),
    why: s("bí ngô mặt cười (jack-o'-lantern) là biểu tượng Halloween, làm nhanh, khách nhận ra ngay", "the jack-o'-lantern is the Halloween icon — quick to paint and instantly recognizable"),
    materials: () => [m("Gel cam bí ngô (mặt bí)", "Pumpkin orange gel (pumpkin face)"), LINER(COLORS.black), m("Gel xanh lá (cuống)", "Green gel (stem)")],
    steps: () => [s(`Tô cả móng ${ACC.vi} màu cam bí ngô, hơ đèn`, `Fill the ${ACC.en} with pumpkin orange, cure`), s("Vẽ mắt tam giác + miệng răng cưa màu đen, thêm cuống xanh ở chân móng, hơ đèn", "Paint black triangle eyes and a zigzag grin, add a green stem near the cuticle, cure")],
    image: ({ c1 }) => `${c1.en} nails with two accent nails painted as orange jack-o'-lantern pumpkins with black carved triangle eyes and zigzag smile`,
  },
  {
    id: "bats", occasions: ["halloween"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 12, price: 6, difficulty: 1, design: true,
    title: ({ c1, metal }) => s(`Dơi bay ${metal.vi} nền ${c1.vi}`, `${cap(metal.en)} flying bats on ${c1.en}`),
    why: s("đàn dơi nhỏ bay chéo móng — tinh tế, đi làm vẫn đeo được", "tiny bats flying across the nail — subtle enough for the office"),
    materials: ({ metal }) => [LINER(metal), m("Sticker dơi (tuỳ chọn, làm nhanh)", "Bat decals (optional, faster)", "1 tấm"), LINER_BRUSH],
    steps: ({ metal }) => [s(`Vẽ 2–3 con dơi nhỏ ${metal.vi} bay chéo trên ${ACC.vi} (hoặc dán sticker), hơ đèn`, `Paint two or three tiny ${metal.en} bats flying diagonally on the ${ACC.en} (or use decals), cure`)],
    image: ({ c1, metal }) => `${c1.en} nails with tiny ${metal.en} bat silhouettes flying diagonally on two accent nails`,
  },
  {
    id: "candycorn", retired: true, occasions: ["halloween"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: () => s("Kẹo bắp 3 màu vàng – cam – trắng", "Candy corn yellow, orange & white"),
    why: s("kẹo bắp (candy corn) 3 màu là mẫu Halloween vui mắt, khách trẻ và trẻ em rất thích", "three-tone candy corn is a cheerful Halloween classic kids and young clients love"),
    materials: () => [m("Gel vàng chanh", "Lemon yellow gel"), m("Gel cam bí ngô", "Pumpkin orange gel"), m("Gel trắng", "White gel"), m("Mút tán màu", "Blending sponge", "1 cái")],
    steps: () => [s("Chia móng 3 dải: vàng ở chân, cam ở giữa, trắng ở đầu móng; tán nhẹ ranh giới, hơ đèn", "Paint three bands — yellow at the cuticle, orange in the middle, white at the tip; soften the edges, cure")],
    image: () => "candy corn nails with yellow at the cuticle, orange in the middle and white at the tip on every nail",
  },
  {
    id: "skull", occasions: ["halloween"], finishes: ["matte", "glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true, badBase: ["white", "pearl", "butter", "sheer"],
    title: ({ c1 }) => s(`Đầu lâu tối giản nền ${c1.vi}`, `Minimal skulls on ${c1.en}`),
    why: s("đầu lâu nét tối giản (không ghê) đang được khách thích phong cách gothic chọn", "minimal line skulls (cute, not gory) are a favorite with gothic-style clients"),
    materials: () => [m("Gel trắng đặc", "Opaque white gel"), LINER(COLORS.black), LINER_BRUSH],
    steps: () => [s(`Vẽ đầu lâu trắng nhỏ tròn trên ${ACC.vi}, hơ đèn`, `Paint a small rounded white skull on the ${ACC.en}, cure`), s("Kẻ 2 hốc mắt + mũi tam giác + răng bằng nét đen, hơ đèn", "Add black eye sockets, a triangle nose and teeth lines, cure")],
    image: ({ c1 }) => `${c1.en} nails with a small cute minimalist white cartoon skull on two accent nails`,
  },
  {
    id: "eyeball", retired: true, occasions: ["halloween"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1 }) => s(`Mắt quỷ 3D nền ${c1.vi}`, `Spooky 3D eyeballs on ${c1.en}`),
    why: s("mắt quỷ 3D trợn tròn là mẫu 'chơi' Halloween được chụp ảnh nhiều nhất", "bulging 3D eyeballs are the most-photographed playful Halloween look"),
    materials: () => [m("Gel đắp trắng (builder white)", "White builder gel"), m("Gel xanh / đỏ (con ngươi)", "Green or red gel (iris)"), LINER(COLORS.black), DOT],
    steps: () => [s(`Chấm 1 giọt gel đắp trắng tròn giữa ${ACC.vi}, để tự tròn rồi hơ đèn`, `Dot a round dome of white builder gel in the center of the ${ACC.en}, let it dome, cure`), s("Chấm con ngươi màu + đồng tử đen + điểm sáng trắng, hơ đèn", "Add a colored iris, black pupil and white highlight, cure")],
    image: ({ c1 }) => `${c1.en} nails with a cute cartoon 3D eyeball on two accent nails, playful Halloween style`,
  },
  {
    id: "slimedrip", occasions: ["halloween"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1 }) => s(`Slime xanh chảy từ đầu móng nền ${c1.vi}`, `Green slime drips on ${c1.en}`),
    why: s("slime xanh chảy từ đầu móng — vui, nổi, đúng không khí Halloween", "green slime dripping from the tips is fun, bold and very Halloween"),
    materials: () => [m("Gel xanh slime (xanh nõn chuối)", "Slime green gel"), LINER_BRUSH],
    steps: () => [s("Vẽ đường viền slime xanh ở đầu móng, kéo 2–3 giọt chảy xuống dài ngắn khác nhau, hơ đèn", "Paint slime green along the tips and pull two or three drips of different lengths down the nail, cure")],
    image: ({ c1 }) => `${c1.en} nails with glossy bright green slime dripping down from the tips`,
  },
  {
    id: "moonstars", occasions: ["halloween"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 1, design: true,
    title: ({ c1, metal }) => s(`Trăng khuyết & sao ${metal.vi} nền ${c1.vi}`, `${cap(metal.en)} crescent moon & stars on ${c1.en}`),
    why: s("trăng khuyết và sao kiểu 'witchy' — Halloween mà sang, đeo được cả sau lễ", "witchy crescent moons and stars — Halloween but elegant, wearable well after the holiday"),
    materials: ({ metal }) => [LINER(metal), m(`Charm trăng & sao ${metal.vi} (tuỳ chọn)`, `${cap(metal.en)} moon & star charms (optional)`, "1 gói"), DOT],
    steps: ({ metal }) => [s(`Vẽ trăng khuyết ${metal.vi} + 2–3 ngôi sao nhỏ trên ${ACC.vi} (hoặc gắn charm), hơ đèn`, `Paint a ${metal.en} crescent moon and two or three tiny stars on the ${ACC.en} (or set charms), cure`)],
    image: ({ c1, metal }) => `${c1.en} nails with a small ${metal.en} crescent moon and tiny stars on two accent nails, witchy celestial style`,
  },
  {
    id: "blackcat", occasions: ["halloween"], finishes: ["glossy", "matte"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true, badBase: ["black", "chocolate", "smoke", "plum", "burgundy", "espresso", "navy", "pine"],
    title: ({ c1 }) => s(`Mèo đen ngồi nền ${c1.vi}`, `Black cat silhouette on ${c1.en}`),
    why: s("mèo đen (biểu tượng phù thuỷ) vẽ dáng ngồi — dễ thương, người nuôi mèo rất thích", "a sitting black cat (the witch's companion) is adorable — cat lovers ask for it"),
    materials: () => [m("Gel đen đặc (dáng mèo)", "Opaque black gel (cat shape)"), m("Gel vàng (mắt mèo)", "Yellow gel (cat eyes)"), LINER_BRUSH, DOT],
    steps: () => [s(`Vẽ dáng mèo đen ngồi (đầu tròn, 2 tai nhọn, đuôi cong) ở chân móng ${ACC.vi}, hơ đèn`, `Paint a sitting black cat (round head, pointed ears, curled tail) near the cuticle of the ${ACC.en}, cure`), s("Chấm 2 mắt vàng nhỏ, hơ đèn", "Dot two tiny yellow eyes, cure")],
    image: ({ c1 }) => `${c1.en} nails with a clearly visible black cat silhouette with yellow eyes painted large on the surface of two accent nails`,
  },
  {
    id: "witchy", retired: true, occasions: ["halloween"], finishes: ["cateye", "glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 12, price: 8, difficulty: 2, design: true, badBase: ["nude", "pinkNude", "babyPink", "lavender", "white", "pearl", "pumpkin", "sheer"],
    title: ({ c1, metal }) => s(`Phù thuỷ ${c1.vi} viền ${metal.vi}`, `Witchy ${c1.en} with ${metal.en} accents`),
    why: s("tông phù thuỷ (tím mận, xanh rêu mắt mèo + viền kim loại) là Halloween kiểu sang", "witchy tones (plum or olive cat-eye with metallic accents) are Halloween done luxe"),
    materials: ({ metal }) => [LINER(metal), m(`Charm sao ${metal.vi} mini`, `Mini ${metal.en} star charms`, "1 gói"), m("Gel dán charm", "Charm gel")],
    steps: ({ metal }) => [s(`Kẻ viền ${metal.vi} mảnh quanh mép ${ACC.vi}, gắn 1 charm sao nhỏ ở chân móng, hơ đèn 60 giây`, `Outline the ${ACC.en} with a fine ${metal.en} line and set one small star charm near the cuticle, cure 60s`)],
    image: ({ c1, metal }) => `witchy ${c1.en} nails with thin ${metal.en} outlines and tiny star charms on two accent nails`,
  },
  {
    id: "mummy", occasions: ["halloween"], finishes: ["matte", "glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true, badBase: ["white", "pearl", "butter", "sheer"],
    title: ({ c1 }) => s(`Xác ướp băng trắng nền ${c1.vi}`, `Mummy wraps on ${c1.en}`),
    why: s("xác ướp quấn băng + 2 mắt tròn — mẫu Halloween vui, dễ làm", "mummy wraps with two peeking eyes — a fun, easy Halloween design"),
    materials: () => [m("Gel trắng đặc (băng quấn)", "Opaque white gel (wraps)"), LINER(COLORS.black), LINER_BRUSH, DOT],
    steps: () => [s(`Kẻ các dải trắng chéo đan nhau kín mặt ${ACC.vi}, chừa 1 khe nhỏ, hơ đèn`, `Paint overlapping diagonal white bands across the ${ACC.en}, leaving a small gap, cure`), s("Chấm 2 mắt đen trong khe hở, hơ đèn", "Dot two black eyes peeking through the gap, cure")],
    image: ({ c1 }) => `${c1.en} nails with two accent nails painted as cute white mummy bandage wraps with two peeking eyes`,
  },
  {
    id: "stitches", retired: true, occasions: ["halloween"], finishes: ["matte", "glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 12, price: 6, difficulty: 1, design: true, badBase: ["black", "chocolate", "espresso", "navy", "plum", "burgundy", "smoke"],
    title: ({ c1 }) => s(`Đường khâu Frankenstein nền ${c1.vi}`, `Frankenstein stitches on ${c1.en}`),
    why: s("đường khâu kiểu Frankenstein — tối giản, làm nhanh mà vẫn 'chất' Halloween", "Frankenstein stitch lines are minimal and quick yet unmistakably Halloween"),
    materials: () => [LINER(COLORS.black), LINER_BRUSH],
    steps: () => [s(`Kẻ 1 đường dọc đen trên ${ACC.vi}, thêm các vạch ngang ngắn như đường khâu, hơ đèn`, `Draw a black line down the ${ACC.en} and cross it with short stitch marks, cure`)],
    image: ({ c1 }) => `${c1.en} nails with thin black Frankenstein stitch lines on two accent nails`,
  },

  // ---------------- French biến tấu — nền TRONG (sheer) cả 4 móng, màu c2 nằm ở ĐẦU móng ----------------
  // (French là nhóm mẫu được đặt nhiều nhất ở tiệm Mỹ; màu đậm của bảng màu dồn lên đầu móng, không nằm dưới đầu trắng)
  {
    id: "fr-micro", occasions: ["any", "korean", "trend", "fall", "wedding"], finishes: ["glossy", "chrome"], systems: ["gelx", "gel", "acrylic"], minutes: 10, price: 6, difficulty: 1, design: true,
    title: (p) => gz(s(`French micro ${p.c2.vi} nền ${p.c1.vi}`, `${cap(p.c2.en)} micro French on ${p.c1.en}`), p),
    why: s("micro French (đầu móng mảnh 1–2mm) là kiểu French được đặt nhiều nhất bây giờ — tinh tế, hợp cả móng ngắn", "the micro French (a 1–2 mm tip line) is the most-booked French right now — subtle and great even on short nails"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (đầu French)`, `${cap(c2.en)} gel (French tips)`), m("Cọ nét mảnh hoặc mút silicone in French", "Liner brush or silicone French stamper", "1 cây")],
    steps: ({ c2 }) => [s(`Kẻ đường French ${c2.vi} thật mảnh (1–2mm) ôm sát mép móng, 2 bên đều nhau, hơ đèn`, `Paint a very thin (1–2 mm) ${c2.en} French line hugging the free edge, even on both sides, cure`)],
    image: ({ c1, c2 }) => `sheer ${c1.en} base with an ultra-thin ${c2.en} micro French tip line on every nail`,
  },
  {
    id: "fr-deep", occasions: ["any", "trend", "wedding", "valentine"], finishes: ["glossy", "chrome"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: (p) => gz(s(`French sâu ${p.c2.vi} nền ${p.c1.vi}`, `Deep ${p.c2.en} French on ${p.c1.en}`), p),
    why: s("French đường cười sâu (2 bên kéo xuống gần nửa móng) làm móng thon dài — kiểu French sang của tiệm Mỹ", "a deep smile-line French (sides reaching halfway down) makes nails look long and slim — the upscale salon French"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (đầu French)`, `${cap(c2.en)} gel (French tips)`), m("Cọ French dẹt", "Flat French brush", "1 cây")],
    steps: ({ c2 }) => [s(`Kẻ đường cười French ${c2.vi} sâu: giữa móng cao, 2 bên kéo xuống ôm mép móng, tô kín đầu móng, hơ đèn`, `Paint a deep ${c2.en} smile line — high in the centre, sides sweeping down along the sidewalls — fill the tip, cure`)],
    image: ({ c1, c2 }) => `sheer ${c1.en} base with deep curved ${c2.en} French tips on every nail`,
  },
  {
    id: "fr-v", occasions: ["trend", "halloween", "prom", "newyear"], finishes: ["glossy", "chrome"], systems: ["gelx", "acrylic", "gel"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: (p) => gz(s(`French chữ V ${p.c2.vi} nền ${p.c1.vi}`, `${cap(p.c2.en)} V-French on ${p.c1.en}`), p),
    why: s("French chữ V (đầu móng nhọn hình mũi tên) làm móng dài và sắc hơn — hợp dáng hạnh nhân, coffin, nhọn", "the V-French (a pointed chevron tip) makes nails look longer and sharper — made for almond, coffin and stiletto"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (đầu French)`, `${cap(c2.en)} gel (French tips)`), LINER_BRUSH],
    steps: ({ c2 }) => [s(`Kẻ 2 đường chéo ${c2.vi} từ 2 mép móng gặp nhau ở giữa thành chữ V, tô kín phần đầu móng, hơ đèn`, `Draw two ${c2.en} diagonals from each sidewall meeting in the centre as a V, fill the tip, cure`)],
    image: ({ c1, c2 }) => `sheer ${c1.en} base with sharp ${c2.en} V-shaped chevron French tips on every nail`,
  },
  {
    id: "fr-side", occasions: ["trend", "korean", "summer"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`French lệch ${c2.vi} nền ${c1.vi}`, `${cap(c2.en)} side French on ${c1.en}`),
    why: s("French lệch (đường French chéo từ 1 bên mép) là biến tấu French hiện đại, nhìn có ý đồ mà vẫn tối giản", "the side French (a diagonal tip from one sidewall) is a modern twist — designed but still minimal"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (đầu French)`, `${cap(c2.en)} gel (French tips)`), LINER_BRUSH],
    steps: ({ c2 }) => [s(`Kẻ đường French ${c2.vi} chéo từ 1 bên mép móng sang góc đối diện ở đầu móng, tô kín góc đầu, hơ đèn`, `Paint a diagonal ${c2.en} French line from one sidewall across to the opposite tip corner, fill the corner, cure`)],
    image: ({ c1, c2 }) => `sheer ${c1.en} base with asymmetric diagonal ${c2.en} side French tips`,
  },
  {
    id: "fr-pinkwhite", occasions: ["any", "wedding", "korean"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: () => s("French hồng – trắng cổ điển", "Classic pink & white French"),
    why: s("pink & white (nền hồng trong, đầu trắng đặc) là mẫu kinh điển khách văn phòng, cô dâu đặt quanh năm", "pink & white (a sheer pink base with solid white tips) is the evergreen classic for office clients and brides"),
    materials: () => [m("Gel trắng đặc (đầu French)", "Opaque white gel (French tips)"), m("Cọ French dẹt", "Flat French brush", "1 cây")],
    steps: () => [s("Kẻ đường cười trắng đặc đều 2 bên, đầu móng trắng kín màu (2 lớp mỏng), hơ đèn mỗi lớp", "Paint an even opaque white smile line and fill the tips (two thin coats), cure each coat")],
    image: () => "classic pink and white French manicure, sheer pink base with crisp opaque white tips",
  },
  {
    id: "fr-halfmoon", occasions: ["trend", "fall", "korean"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Half-moon ${c2.vi} nền ${c1.vi}`, `${cap(c2.en)} half-moon on ${c1.en}`),
    why: s("half-moon (vầng trăng ở chân móng) là French ngược kiểu retro đang quay lại — tinh tế, móng mọc ra không lộ", "the half-moon (a crescent at the cuticle) is the retro reverse French making a comeback — subtle and grows out gracefully"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (vầng trăng)`, `${cap(c2.en)} gel (half-moon)`), LINER_BRUSH],
    steps: ({ c2 }) => [s(`Kẻ vầng trăng ${c2.vi} theo đường cong chân móng (chừa khe nhỏ sát da), tô kín, hơ đèn`, `Paint a ${c2.en} crescent following the cuticle curve (leave a tiny gap at the skin), fill, cure`)],
    image: ({ c1, c2 }) => `sheer ${c1.en} nails with a ${c2.en} half-moon crescent at the cuticle`,
  },
  {
    id: "fr-skittle", occasions: ["trend", "fall", "spring", "summer"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c2 }) => s(`French mỗi ngón 1 tông ${c2.vi}`, `Skittle French in ${c2.en} tones`),
    why: s("French \"skittle\" — mỗi ngón 1 tông đậm nhạt của cùng 1 màu — nhìn có thiết kế mà không cần vẽ hình", "the skittle French — each tip a lighter or deeper shade of one colour — looks designed with zero motif risk"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} + gel trắng / đen để pha tông`, `${cap(c2.en)} gel plus white / black gel to mix shades`), LINER_BRUSH],
    steps: ({ c2 }) => [s(`Pha 4 tông ${c2.vi} từ nhạt tới đậm (thêm trắng / đen), kẻ đầu French mỗi ngón 1 tông theo thứ tự, hơ đèn`, `Mix four ${c2.en} shades light to deep (add white / black), paint each finger's French tip a step deeper, cure`)],
    image: ({ c1, c2 }) => `sheer ${c1.en} base with French tips in graduated shades of ${c2.en}, a different shade on each finger`,
  },
  {
    id: "fr-glitter", occasions: ["newyear", "prom", "christmas", "wedding"], finishes: ["glitter"], systems: ["gelx", "gel", "acrylic"], minutes: 10, price: 6, difficulty: 1, design: true, ownGlitter: true,
    title: ({ c1, metal }) => s(`French nhũ ${metal.vi} nền ${c1.vi}`, `${cap(metal.en)} glitter French on ${c1.en}`),
    why: s("đầu French nhũ (không nhũ cả móng) lấp lánh mà vẫn sang — mẫu đi tiệc cuối năm khách hỏi nhiều", "a glitter French tip (not glitter all over) sparkles yet stays elegant — the party look clients ask for at year end"),
    materials: ({ metal }) => [m(`Gel nhũ ${metal.vi} mịn`, `Fine ${metal.en} glitter gel`), m("Cọ French dẹt", "Flat French brush", "1 cây")],
    steps: ({ metal }) => [s(`Kẻ đầu French bằng gel nhũ ${metal.vi}, dặm thêm lớp 2 sát mép móng cho dày nhũ, hơ đèn`, `Paint the French tip with ${metal.en} glitter gel, add a second coat at the very edge for density, cure`)],
    image: ({ c1, metal }) => `sheer ${c1.en} base with sparkling ${metal.en} glitter French tips`,
  },
  {
    id: "fr-santa", occasions: ["christmas"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c2 }) => s(`French mũ Noel ${c2.vi} viền lông trắng`, `Santa-hat French: ${c2.en} tips with fluffy white trim`),
    why: s("French mũ Ông già Noel (đầu đỏ + viền lông trắng xù) — vui, ăn ảnh, đúng mùa Giáng sinh mà không \"lố\"", "the Santa-hat French (red tips with a fluffy white trim) is fun and photogenic without looking costume-y"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (đầu French)`, `${cap(c2.en)} gel (French tips)`), m("Gel trắng đặc 3D (viền lông)", "Thick white 3D gel (fluffy trim)"), DOT],
    steps: ({ c2 }) => [s(`Kẻ đầu French ${c2.vi} sâu vừa, hơ đèn`, `Paint medium-deep ${c2.en} French tips, cure`), s("Chấm gel trắng đặc dọc đường cười rồi kéo xù nhẹ như lông mũ Noel, hơ đèn", "Dab thick white gel along the smile line and texture it like the fur trim of a Santa hat, cure")],
    image: ({ c1, c2 }) => `sheer ${c1.en} nails with ${c2.en} French tips and a fluffy textured white trim along the smile line, Santa hat style`,
  },
  {
    id: "fr-candycane", occasions: ["christmas"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c2 }) => s(`French kẹo gậy ${c2.vi} – trắng`, `${cap(c2.en)} & white candy-cane French`),
    why: s("French kẹo gậy (sọc chéo chỉ ở đầu móng) là mẫu Noel vui mà vẫn gọn — không sọc kín móng như băng cảnh báo", "a candy-cane French (diagonal stripes only on the tip) is festive but neat — not stripes all over like caution tape"),
    materials: ({ c2 }) => [m("Gel trắng đặc (đầu French)", "Opaque white gel (French tips)"), m(`Gel ${c2.vi} (sọc)`, `${cap(c2.en)} gel (stripes)`), LINER_BRUSH],
    steps: ({ c2 }) => [s("Kẻ đầu French trắng đặc, hơ đèn", "Paint opaque white French tips, cure"), s(`Kẻ 5–6 sọc chéo ${c2.vi} mảnh đều nhau trên phần đầu French, hơ đèn`, `Paint five or six thin, evenly spaced ${c2.en} diagonal stripes across the white tips, cure`)],
    image: ({ c1, c2 }) => `sheer ${c1.en} nails with white French tips striped diagonally in ${c2.en} like a candy cane`,
  },
  {
    id: "fr-tortoise", occasions: ["fall", "thanksgiving", "trend"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1 }) => s(`French đồi mồi nền ${c1.vi}`, `Tortoiseshell French on ${c1.en}`),
    why: s("đầu French đồi mồi trên nền trong — cách đeo đồi mồi mùa thu nhẹ nhàng, sang mà không nặng tay", "tortoiseshell French tips on a sheer base — the lighter, chic way to wear fall tortoise"),
    materials: () => [m("Gel nâu caramel trong (jelly)", "Caramel jelly gel"), m("Gel nâu đậm", "Dark brown gel"), DOT],
    steps: () => [s("Tô đầu French bằng jelly caramel, chấm loang vài đốm nâu đậm, để màu tự tan 10 giây rồi hơ đèn", "Fill the French tips with caramel jelly, dot in a few dark brown spots, let them bleed 10s, cure"), s("Phủ thêm 1 lớp jelly lên đầu móng cho có chiều sâu, hơ đèn", "Seal the tips with another jelly layer for depth, cure")],
    image: ({ c1 }) => `sheer ${c1.en} nails with glossy amber tortoiseshell French tips`,
  },

  // ---------------- Nail Hàn: syrup / má hồng / clean girl (nền trong, bóng như kính) ----------------
  {
    id: "syrup", occasions: ["korean", "trend", "summer"], finishes: ["glossy", "chrome"], systems: ["gelx", "gel", "acrylic"], minutes: 10, price: 6, difficulty: 1, design: true, ownColor: true,
    title: (p) => gz(s(`Syrup ${p.c1.vi} trong veo`, `${cap(p.c1.en)} syrup nails`), p),
    why: s("nail syrup (thạch màu trong, đậm dần về đầu móng như siro) là trend nail Hàn đang lên — nhẹ mà vẫn có màu", "syrup nails (sheer jelly colour that deepens toward the tip like syrup) are a rising Korean trend — light yet colourful"),
    materials: ({ c1 }) => [m(`Gel thạch (syrup) ${c1.vi}`, `${cap(c1.en)} syrup jelly gel`), m("Cọ dẹt tán màu", "Flat blending brush", "1 cây")],
    steps: ({ c1 }) => [s(`Quét 1 lớp thạch ${c1.vi} thật mỏng cả móng để vẫn thấy móng thật, hơ đèn`, `Brush one very thin ${c1.en} jelly coat over the whole nail so the natural nail shows, cure`), s("Quét lớp 2 chỉ ở nửa đầu móng, tán mờ ranh giới về phía chân móng cho đậm dần, hơ đèn", "Add a second coat only on the tip half, feathering it toward the cuticle so the colour deepens, cure")],
    image: ({ c1 }) => `glossy translucent ${c1.en} syrup jelly nails, sheer at the cuticle and deeper toward the tips`,
  },
  {
    id: "blush", occasions: ["korean", "valentine", "spring"], finishes: ["glossy", "chrome"], systems: ["gelx", "gel", "acrylic"], minutes: 12, price: 6, difficulty: 1, design: true,
    title: (p) => gz(s(`Nail má hồng tông ${p.c2.vi} nền ${p.c1.vi}`, `${cap(p.c2.en)} blush nails on ${p.c1.en}`), p),
    why: s("nail má hồng (blush) — vầng màu ửng nhẹ giữa móng trên nền trong — là kiểu Hàn \"ửng hồng tự nhiên\" đang được lưu nhiều", "blush nails — a soft flush of colour in the centre of a sheer nail — are the Korean 'natural flush' look everyone saves"),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (vầng má hồng)`, `${cap(c2.en)} gel (blush)`), m("Mút nhỏ hoặc cọ tán", "Small sponge or blending brush", "1 cái")],
    steps: ({ c2 }) => [s(`Chấm tán ${c2.vi} thành vầng mờ ở giữa móng, mép tan hẳn vào nền, hơ đèn; dặm lớp 2 ở tâm`, `Dab ${c2.en} into a soft glow in the centre, edges fully blended into the base, cure; build the centre with a second pass`)],
    image: ({ c1, c2 }) => `sheer ${c1.en} nails with a soft diffused ${c2.en} blush glow in the centre of each nail, glass-glossy`,
  },
  {
    id: "cleanmilky", occasions: ["korean", "wedding", "any"], finishes: ["glossy", "chrome"], systems: ["gelx", "gel", "acrylic"], minutes: 10, price: 6, difficulty: 1, design: true,
    title: (p) => gz(s(`Clean girl ${p.c1.vi} đính hạt ${p.metal.vi}`, `Clean-girl ${p.c1.en} with ${p.metal.en} micro studs`), p),
    why: s("kiểu \"clean girl\" — nền trong sạch sẽ + 1 điểm nhấn kim loại nhỏ — là nail tối giản khách văn phòng đặt nhiều nhất", "the 'clean girl' look — a clean sheer base with one tiny metal accent — is the minimalist set office clients book most"),
    materials: ({ metal }) => [m(`Hạt kim loại mini ${metal.vi}`, `Mini ${metal.en} studs`, "1 gói"), m("Gel dán charm", "Charm gel")],
    steps: ({ metal }) => [s(`Chấm gel dán, đặt 1 hạt ${metal.vi} nhỏ sát chân móng (3 ngón), hơ đèn 60 giây; phủ top quanh viền hạt`, `Dot charm gel and set one tiny ${metal.en} stud at the cuticle of three nails, cure 60s; top coat around the stud`)],
    image: ({ c1, metal }) => `clean glossy sheer ${c1.en} nails with a tiny ${metal.en} stud near the cuticle`,
  },

  // ---------------- Chrome màu & nhũ loang ----------------
  {
    id: "colorchrome", occasions: ["fall", "trend", "newyear", "christmas", "halloween"], finishes: ["chrome"], systems: ["gelx", "gel", "acrylic"], minutes: 10, price: 6, difficulty: 2, design: false, keepHue: true,
    title: ({ c1 }) => s(`Chrome ${c1.vi} giữ màu`, `${cap(c1.en)} colour chrome`),
    why: s("chrome màu (nâu, caramel, xám thiếc, đỏ cherry…) giữ nguyên sắc màu nền mà vẫn bóng gương — trend thu đông 2026", "colour chrome (brown, caramel, pewter, cherry…) keeps the base hue with a mirror shine — the fall/winter 2026 trend"),
    materials: () => [],
    steps: () => [],
    image: ({ c1 }) => `${c1.en} chrome nails with a smooth mirror shine that keeps the deep ${c1.en} colour`,
  },
  {
    id: "glitterfade", occasions: ["any", "newyear", "christmas", "prom", "wedding"], finishes: ["glitter"], systems: ["gelx", "gel", "acrylic"], minutes: 10, price: 6, difficulty: 1, design: true, ownGlitter: true,
    title: ({ c1, metal }) => s(`Nhũ ${metal.vi} loang nền ${c1.vi}`, `${cap(metal.en)} glitter fade on ${c1.en}`),
    why: s("nhũ loang (dày ở đầu móng, thưa dần lên giữa móng) là dịch vụ thêm khách chỉ vào là làm — hợp mọi dịp", "a glitter fade (dense at the tip, thinning toward mid-nail) is the add-on clients point at — works for every occasion"),
    materials: ({ metal }) => [m(`Gel nhũ ${metal.vi}`, `${cap(metal.en)} glitter gel`), m("Cọ dẹt tán nhũ", "Flat glitter brush", "1 cây")],
    steps: ({ metal }) => [s(`Chấm gel nhũ ${metal.vi} dày ở đầu móng, dùng cọ dẹt kéo thưa dần lên giữa móng cho loang tự nhiên, hơ đèn; dặm lại đầu móng`, `Pack ${metal.en} glitter gel at the tip, drag it thinner toward mid-nail with a flat brush for a natural fade, cure; repack the tip`)],
    image: ({ c1, metal }) => `${c1.en} nails with ${metal.en} glitter densely packed at the tips fading out toward the middle`,
  },

  // ---------------- Hoạ tiết vẽ tay mới (Giáng sinh, hoa gel 3D) ----------------
  {
    id: "holly", occasions: ["christmas"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1 }) => s(`Lá holly quả đỏ nền ${c1.vi}`, `Holly leaves & red berries on ${c1.en}`),
    why: s("lá holly + quả đỏ vẽ tay là hoạ tiết Giáng sinh sang, không trẻ con — khách đặt nhiều tháng 12", "hand-painted holly with red berries is the elegant, grown-up Christmas motif clients book all December"),
    materials: () => [m("Gel xanh lá đậm (lá holly)", "Deep green gel (holly leaves)"), m("Gel đỏ (quả)", "Red gel (berries)"), LINER_BRUSH, DOT],
    steps: () => [s("Vẽ 2 lá holly răng cưa xanh đậm chụm lại lệch 1 góc móng, kẻ gân lá mảnh, hơ đèn", "Paint two serrated deep-green holly leaves meeting off to one side, add a fine midrib, cure"), s("Chấm 3 quả đỏ tròn ở cuống lá + 1 chấm sáng trắng trên mỗi quả, hơ đèn", "Dot three round red berries where the leaves meet plus a white highlight on each, cure")],
    image: ({ c1 }) => `${c1.en} nails with hand-painted deep green holly leaves and three glossy red berries`,
  },
  {
    id: "ornament", occasions: ["christmas"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Quả châu Noel ${c2.vi} nền ${c1.vi}`, `${cap(c2.en)} Christmas ornaments on ${c1.en}`),
    why: s("quả châu Noel treo trên sợi chỉ kim loại — hoạ tiết Giáng sinh to rõ, ăn ảnh", "a Christmas bauble hanging from a fine metal thread — a bold, photogenic holiday motif"),
    materials: ({ c2, metal }) => [m(`Gel ${c2.vi} (quả châu)`, `${cap(c2.en)} gel (ornament)`), LINER(metal), DOT],
    steps: ({ c2, metal }) => [s(`Kẻ sợi chỉ ${metal.vi} mảnh từ đầu móng xuống, vẽ quả châu tròn ${c2.vi} treo ở cuối sợi, hơ đèn`, `Draw a fine ${metal.en} thread down from the tip and paint a round ${c2.en} bauble hanging from it, cure`), s(`Kẻ nắp châu ${metal.vi} + 1 điểm sáng trắng trên quả, hơ đèn`, `Add a ${metal.en} cap and a white highlight on the bauble, cure`)],
    image: ({ c1, c2, metal }) => `${c1.en} nails with a hand-painted ${c2.en} Christmas ornament hanging from a thin ${metal.en} thread`,
  },
  {
    id: "gelflower", occasions: ["korean", "spring", "wedding", "mothersday"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 20, price: 12, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Hoa gel 3D ${c2.vi} nhụy ngọc trai nền ${c1.vi}`, `3D ${c2.en} gel flower with a pearl centre on ${c1.en}`),
    why: s("hoa gel nổi 3D nhụy ngọc trai là trend nail Hàn – Mỹ 2025–26 — nhẹ nhàng mà có chiều sâu", "raised 3D gel flowers with a pearl centre are the 2025–26 Korean and US trend — soft but dimensional"),
    materials: ({ c2 }) => [m(`Gel đặc 3D ${c2.vi} (cánh hoa)`, `${cap(c2.en)} 3D sculpting gel (petals)`), m("Hạt ngọc trai mini (nhụy)", "Mini pearls (flower centres)", "1 hũ"), m("Cọ đầu tròn nhỏ", "Small round brush", "1 cây")],
    steps: ({ c2 }) => [s(`Đắp 5 cánh hoa gel đặc ${c2.vi} gần chân móng, dùng cọ ấn lõm giữa mỗi cánh, hơ đèn 60 giây`, `Build five thick ${c2.en} gel petals near the cuticle, press a dip into each petal with the brush, cure 60s`), s("Đặt 1 hạt ngọc trai giữa bông hoa, phủ top quanh hoa (không phủ lên ngọc), hơ đèn", "Set a pearl in the centre and top coat around the flower (not over the pearl), cure")],
    image: ({ c1, c2 }) => `${c1.en} nails with a raised 3D ${c2.en} gel flower with a pearl centre`,
  },

  // ---------------- Bộ phối theo dịp: MỖI MÓNG MỘT KIỂU (móng chính / móng phụ / móng nối), không 2 móng giống nhau ----------------
  ...(["halloween", "christmas", "valentine", "fall", "newyear"] as const).map((occ): Pattern => ({
    // chỉ bóng: chrome / mắt mèo phủ cả bộ thì móng chính vẽ tay mất nét (bộ máy tự cho móng nối làm velvet / chrome nếu cần)
    id: `mix-${occ}`, occasions: occ === "fall" ? ["fall", "thanksgiving"] : [occ], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 25, price: 15, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Bộ ${MIX_NAME[occ].vi} mỗi móng một kiểu (${c1.vi} – ${c2.vi})`, `Mismatched ${MIX_NAME[occ].en} set (${c1.en} & ${c2.en})`),
    why: s(`bộ phối mỗi móng một hoạ tiết (${MIX_NAME[occ].motifVi}) là cách tiệm làm mẫu ${MIX_NAME[occ].vi} thật — có móng chính, móng phụ, không 2 móng giống hệt nhau`, `a mismatched set (${MIX_NAME[occ].motifEn}) is how real salons do ${MIX_NAME[occ].en} — one hero nail, supporting nails, no two alike`),
    materials: ({ c2 }) => [m(`Gel ${c2.vi} (hoạ tiết)`, `${cap(c2.en)} gel (art)`), m("Gel trắng đặc + gel đen vẽ nét", "Opaque white gel + black liner gel"), LINER_BRUSH, DOT],
    steps: ({ c2 }) => [s(`Ngón áp út (móng chính): vẽ hoạ tiết to (${MIX_NAME[occ].heroVi}) lệch 1 bên móng, hơ đèn`, `Ring finger (hero): paint the big motif (${MIX_NAME[occ].heroEn}) off-centre, cure`), s("Ngón trỏ (móng phụ): hoạ tiết nhỏ khác cùng chủ đề gần đầu móng, hơ đèn", "Index finger (echo): a smaller, different motif from the same theme near the tip, cure"), s(`Ngón giữa và ngón út: để trơn hoặc micro French ${c2.vi} cho nối bộ, hơ đèn`, `Middle and pinky: leave solid or add a ${c2.en} micro French to tie the set together, cure`)],
    image: ({ c1, c2 }) => `mismatched ${MIX_NAME[occ].en} nail set in ${c1.en} and ${c2.en}: a large ${MIX_NAME[occ].heroEn} on the ring finger, a smaller different motif on the index, the other nails solid or micro French`,
  })),
];

// ----------------------------------------------------------------------------
// VAI MÀU THEO HOẠ TIẾT: mỗi hoạ tiết khai báo màu nào là NỀN (c1), màu nào là HOẠ TIẾT (c2 / kim loại / màu cố định
// của bộ vẽ) và lớp kiểm tương phản. Bảng màu nào làm hoạ tiết chìm → máy bỏ, lấy bảng khác của dịp, rồi tới bảng mặc
// định của chính hoạ tiết — không bao giờ ra cặp chìm (lavender trên xanh da trời, trắng trên bạc, bạc trên nude…).
//   motif: hoạ tiết vẽ (chấm, hoa, ma, dơi…) ΔL* ≥ 30 · glow: quầng / vân đá / loang ΔL* ≥ 25 · line: nét mảnh ΔL* ≥ 40
//   tip: đầu French ΔL* ≥ 20 (đầu trắng đặc trên nền TRONG luôn được — mắt đọc bằng độ đặc, không bằng độ sáng)
//   relief: khối 3D / charm kim loại (đọc bằng bóng đổ + ánh kim) chỉ cần khác nền ΔL* ≥ 6
//   tone: tông trên tông (chrome màu, mắt mèo, thạch, đồi mồi, nhũ loang) — đọc bằng hiệu ứng, không kiểm độ sáng
type Gate = "motif" | "glow" | "line" | "tip" | "relief" | "tone";
const GATE_MIN: Record<Gate, number> = { motif: 30, glow: 25, line: 40, tip: 20, relief: 6, tone: 0 };
interface Role {
  g: Gate;
  on?: "c2" | "metal" | `#${string}`; // màu hoạ tiết (mặc định c2); mã màu = màu cố định bộ vẽ dùng (ma trắng, mèo đen…)
  vs?: string; // so với màu này thay cho nền c1 (negative space: so với móng thật)
  base?: "sheer" | "dark"; // nền bắt buộc: trong (French, nail Hàn) / tối (mắt mèo, velvet, giọt nước)
  shapes?: Shape[]; // dáng được phép (mặc định: mọi dáng trừ nhọn)
  pal?: [CK, CK, CK][]; // bảng màu mặc định khi bảng của dịp không hợp
  ok?: (k: [CK, CK, CK]) => boolean; // luật riêng
}
const hx = (k: CK) => COLORS[k].hex;
const chroma = (hex: string) => { const [, a, b] = lab(hex); return Math.hypot(a, b); };
/** cùng nhiệt độ màu (ấm: đỏ / hồng / cam / nâu / nude / vàng · lạnh: xanh / tím · trắng / xám / đen đi được cả hai) */
const tempOf = (k: CK) => { const f = hueFamily(hx(k)); return ["white", "grey", "black"].includes(f) ? "n" : ["red", "pink", "orange", "brown", "nude", "yellow"].includes(f) ? "w" : "c"; };
const sameTemp = (a: CK, b: CK) => tempOf(a) === "n" || tempOf(b) === "n" || tempOf(a) === tempOf(b);
const SH4: Shape[] = ["almond", "oval", "square", "coffin"], SH5: Shape[] = [...SH4, "stiletto"], SHORT: Shape[] = ["oval", "square", "almond"];
/** nền trong / nude / sữa — nền của French và nail Hàn */
const SHEER: CK[] = ["sheer", "pinkNude", "nude", "milky", "white", "cloudDancer", "bone", "greige", "babyPink", "frangipani"];
const RED_TIP: CK[] = ["cherry", "redVelvet", "velvet", "strawberry", "bloodRed"];
const BERRY: CK[] = ["strawberry", "cherry", "raspberry", "babyPink", "pinkNude"];
const W = "#f0f2f4", K = "#151314"; // trắng / đen của bộ vẽ (ma, đầu lâu, bông tuyết / mèo đen, viền da báo)
// vân đá: nền SÁNG + vân xám/đen (+ 1 vân vàng), hoặc nền đen / lục bảo / ngọc bích + vân trắng; KHÔNG nền đỏ, đỏ rượu, hồng (nhìn như thịt sống #6)
const MARBLE_LIGHT: CK[] = ["milky", "white", "cloudDancer", "nude", "greige", "bone", "champagne"];
const marbleOk = ([a, b]: [CK, CK, CK]) =>
  (MARBLE_LIGHT.includes(a) && chroma(hx(b)) < 14 && Lof(hx(b)) <= 62) || (["black", "emerald", "jade", "pine", "navy"].includes(a) && Lof(hx(b)) >= 88);
const ROLES: Record<string, Role> = {
  solid: { g: "tone", shapes: SH5, pal: [["milky", "pearl", "pearl"], ["cherry", "gold", "gold"], ["espresso", "nude", "gold"], ["black", "silver", "silver"]] },
  french: { g: "tip", base: "sheer", pal: [["sheer", "white", "gold"], ["sheer", "espresso", "gold"], ["nude", "burgundy", "gold"], ["milky", "black", "silver"]] },
  // ombre: chân móng sáng → đầu móng đậm hơn 20–66 L*, cùng nhiệt độ màu (nâu ấm → trắng lạnh nhìn như ố #3), không loang ra trắng đặc
  ombre: { g: "glow", ok: ([a, b]) => Lof(hx(a)) - Lof(hx(b)) >= 20 && Lof(hx(a)) - Lof(hx(b)) <= 66 && Lof(hx(b)) < 90 && sameTemp(a, b), pal: [["nude", "espresso", "gold"], ["sheer", "burgundy", "gold"], ["nude", "coffee", "gold"], ["pinkNude", "raspberry", "gold"]] },
  // aura: nền trong / sữa với lõi màu rực đậm hơn ≥ 20 L*, hoặc nền gần đen với lõi rực (aura nude trên cherry cola = vết bẩn)
  aura: { g: "glow", ok: ([a, b]) => chroma(hx(b)) >= 35 && ((SHEER.includes(a) && Lof(hx(a)) - Lof(hx(b)) >= 20) || Lof(hx(a)) < 20), pal: [["sheer", "raspberry", "gold"], ["milky", "hotPink", "silver"], ["black", "persimmon", "gold"], ["black", "periwinkle", "silver"]] },
  tortoise: { g: "tone", pal: [["caramel", "chocolate", "gold"]] },
  marble: { g: "glow", ok: marbleOk, pal: [["milky", "smoke", "gold"], ["cloudDancer", "pewter", "gold"], ["black", "milky", "gold"], ["emerald", "milky", "gold"], ["jade", "milky", "gold"]] },
  lines: { g: "line", on: "metal", pal: [["black", "milky", "gold"], ["navy", "milky", "silver"], ["espresso", "nude", "gold"]] },
  dots: { g: "motif", pal: [["milky", "black", "silver"], ["navy", "milky", "silver"], ["sheer", "burgundy", "gold"]] },
  hearts: { g: "motif", pal: [["sheer", "cherry", "gold"], ["milky", "redVelvet", "gold"], ["cherry", "milky", "gold"]] },
  floral: { g: "motif", pal: [["sheer", "hotPink", "gold"], ["nude", "raspberry", "gold"], ["jade", "milky", "gold"], ["navy", "milky", "silver"]] },
  web: { g: "line", on: "metal", shapes: SH5, pal: [["black", "milky", "silver"], ["mulledWine", "milky", "silver"], ["plumNoir", "milky", "silver"]] },
  snow: { g: "motif", on: W, pal: [["navy", "milky", "silver"], ["redVelvet", "milky", "gold"], ["emerald", "milky", "gold"]] },
  candy: { g: "glow", pal: [["milky", "cherry", "gold"], ["cherry", "milky", "gold"]] },
  stars: { g: "relief", on: "metal", shapes: SH5, pal: [["black", "milky", "gold"], ["navy", "milky", "silver"], ["plumNoir", "milky", "silver"]] },
  gems: { g: "relief", on: "#f4f4f6", pal: [["plum", "silver", "silver"], ["black", "silver", "silver"], ["pinkNude", "milky", "silver"], ["navy", "silver", "silver"]] },
  pearls: { g: "relief", on: "#efe6d6", pal: [["pinkNude", "milky", "pearl"], ["nude", "milky", "pearl"], ["mocha", "milky", "pearl"]] },
  leaf: { g: "motif", on: "metal", pal: [["burgundy", "bone", "gold"], ["espresso", "nude", "gold"], ["olive", "bone", "gold"]] },
  blossom: { g: "motif", pal: [["cherry", "lemon", "gold"], ["sheer", "hotPink", "gold"]] },
  // caro: đỏ / xanh thông cùng độ sáng vẫn đọc ra nhờ khác hẳn sắc + chỉ kẻ trắng / vàng
  plaid: { g: "tone", shapes: SHORT, ok: ([a, b]) => hueFamily(hx(a)) !== hueFamily(hx(b)) && Math.hypot(...lab(hx(a)).map((v, i) => v - lab(hx(b))[i])) >= 30, pal: [["redVelvet", "pine", "gold"], ["caramel", "espresso", "gold"], ["cherry", "navy", "gold"]] },
  waves: { g: "line", on: W },
  jelly: { g: "tone", pal: [["raspberry", "milky", "gold"], ["hotPink", "milky", "silver"], ["persimmon", "milky", "gold"]] },
  babyboomer: { g: "tone", shapes: SH4 },
  chromefrench: { g: "tone", pal: [["sheer", "silver", "silver"], ["milky", "pearl", "pearl"], ["nude", "gold", "gold"]] },
  charm3d: { g: "relief", on: "metal", pal: [["babyPink", "milky", "silver"], ["redVelvet", "milky", "gold"], ["milky", "pearl", "gold"]] },
  polka: { g: "motif", pal: [["plumNoir", "milky", "silver"], ["black", "milky", "silver"], ["nude", "chocolate", "gold"]] },
  auroracat: { g: "tone", base: "dark", shapes: SH5, pal: [["black", "milky", "silver"], ["navy", "milky", "silver"], ["plumNoir", "milky", "silver"]] },
  stripes: { g: "line", pal: [["nude", "black", "gold"], ["cloudDancer", "coffee", "gold"], ["milky", "navy", "silver"]] },
  chocodip: { g: "tone", shapes: ["almond", "oval"], pal: [["strawberry", "chocolate", "gold"]] },
  // da hươu: tông ấm (caramel, nâu, nude, kem) — đốm kem trên nền lục bảo nhìn thành chấm bi, không ra da hươu
  fawn: { g: "glow", ok: ([a, b]) => [a, b].every((c) => ["brown", "orange", "nude", "white"].includes(hueFamily(hx(c)))), pal: [["caramel", "cloudDancer", "gold"], ["coffee", "nude", "gold"]] },
  chromedrops: { g: "relief", on: "metal", pal: [["milky", "silver", "silver"], ["sheer", "gold", "gold"], ["black", "silver", "silver"]] },
  // giọt nước 3D chỉ đọc ra trên nền tối bóng (trên nền trắng / pastel đặc nhìn như vòng đệm xám #30)
  droplets: { g: "tone", base: "dark", pal: [["black", "milky", "silver"], ["emerald", "milky", "gold"], ["plumNoir", "milky", "silver"]] },
  droplet: { g: "tone", base: "dark" },
  gemcluster: { g: "relief", on: "#f4f4f6", pal: [["pinkNude", "milky", "silver"], ["black", "milky", "silver"], ["mocha", "milky", "gold"]] },
  foil: { g: "relief", on: "metal", pal: [["black", "milky", "gold"], ["burgundy", "nude", "gold"], ["milky", "nude", "gold"]] },
  // line nổi tráng gương mảnh: cần nền tách hẳn kim loại (bạc trên xám be gần như tàng hình — soi lượt 25/10)
  chromeline: { g: "glow", on: "metal", pal: [["black", "milky", "silver"], ["navy", "milky", "silver"], ["espresso", "nude", "gold"], ["emerald", "milky", "gold"]] },
  mixmatch: { g: "tone", ok: ([a, b]) => a !== b && Math.hypot(...lab(hx(a)).map((v, i) => v - lab(hx(b))[i])) >= 18, pal: [["espresso", "caramel", "gold"], ["plumNoir", "periwinkle", "silver"], ["navy", "sky", "silver"]] },
  doublefrench: { g: "tip", base: "sheer", shapes: ["almond", "square", "coffin"], pal: [["sheer", "black", "gold"], ["milky", "espresso", "gold"]] },
  swirl: { g: "glow", pal: [["milky", "raspberry", "gold"], ["nude", "burnt", "gold"], ["sheer", "cobalt", "silver"]] },
  milkbath: { g: "motif", pal: [["milky", "hotPink", "gold"], ["milky", "raspberry", "gold"], ["milky", "coral", "gold"]] },
  // da báo: đốm là tông ấm (caramel, nâu, đỏ, hồng) — đốm trắng sữa trên mocha nhìn như vết sơn bong, không ra da báo
  leopard: { g: "motif", on: K, shapes: SH4, ok: ([a, b]) => a !== b && ["brown", "orange", "red", "pink"].includes(hueFamily(hx(b))), pal:[["nude", "caramel", "gold"], ["caramel", "espresso", "gold"], ["babyPink", "raspberry", "roseGold"]] },
  checker: { g: "glow", shapes: SHORT, pal: [["milky", "cherry", "gold"], ["milky", "black", "silver"], ["bone", "coffee", "gold"]] },
  cherry: { g: "motif", on: "#c3101c", shapes: SH4, pal: [["milky", "cherry", "gold"], ["sheer", "cherry", "gold"], ["nude", "cherry", "gold"]] },
  // ren: đặt ở đầu móng / góc, ren trắng trên nền trong (không quấn ngang thân như vớ #42)
  lace: { g: "tip", on: "#f4f4f6", base: "sheer", pal: [["sheer", "milky", "pearl"], ["pinkNude", "milky", "pearl"], ["nude", "milky", "gold"]] },
  negative: { g: "glow", vs: "#e4bcb2", pal: [["nude", "espresso", "gold"], ["nude", "black", "gold"], ["nude", "burgundy", "gold"]] },
  velvet: { g: "tone", base: "dark", shapes: SH5, pal: [["plumNoir", "milky", "gold"], ["redVelvet", "milky", "gold"], ["espresso", "milky", "gold"]] },
  // ma / đầu lâu / xác ướp: chỉ nền tối kiểu "moody luxe" (không ma trắng trên nền cam bí ngô / pastel — nhìn như đồ hoá trang)
  ghost: { g: "motif", on: W, ok: ([a]) => Lof(hx(a)) < 30, pal: [["black", "milky", "silver"], ["mulledWine", "milky", "silver"], ["plumNoir", "milky", "silver"]] },
  jackolantern: { g: "motif", on: "#ef8227", pal: [["black", "milky", "gold"], ["nude", "black", "gold"]] },
  // dơi chỉ bạc: dơi vàng trên nền đen nhìn thành vệt vàng nhoè (soi lượt sắp ra 25/10)
  bats: { g: "motif", on: "metal", shapes: SH5, ok: ([, , mt]) => mt === "silver", pal: [["aubergine", "milky", "silver"], ["black", "milky", "silver"], ["mulledWine", "milky", "silver"]] },
  candycorn: { g: "tone" },
  skull: { g: "motif", on: W, shapes: SH5, ok: ([a]) => Lof(hx(a)) < 30, pal: [["black", "milky", "silver"], ["mulledWine", "milky", "silver"]] },
  eyeball: { g: "motif", on: W },
  slimedrip: { g: "motif", on: "#76c326", pal: [["black", "milky", "silver"], ["plumNoir", "milky", "silver"]] },
  moonstars: { g: "motif", on: "metal", shapes: SH5, pal: [["navy", "milky", "gold"], ["black", "milky", "gold"], ["mulledWine", "milky", "gold"]] },
  blackcat: { g: "motif", on: K, pal: [["burnt", "milky", "gold"], ["nude", "milky", "gold"], ["milky", "black", "gold"]] },
  witchy: { g: "tone", base: "dark" },
  mummy: { g: "motif", on: "#e6e2da", ok: ([a]) => Lof(hx(a)) < 30, pal: [["black", "milky", "silver"], ["plumNoir", "milky", "silver"]] },
  stitches: { g: "line", on: K },
  // French biến tấu: nền trong, đầu c2
  "fr-micro": { g: "tip", base: "sheer", pal: [["sheer", "espresso", "gold"], ["sheer", "burgundy", "gold"], ["milky", "black", "silver"], ["sheer", "olive", "gold"], ["sheer", "cherry", "gold"]] },
  "fr-deep": { g: "tip", base: "sheer", pal: [["sheer", "white", "gold"], ["sheer", "mulledWine", "gold"], ["pinkNude", "espresso", "gold"]] },
  "fr-v": { g: "tip", base: "sheer", shapes: ["almond", "coffin", "stiletto"], pal: [["sheer", "black", "silver"], ["sheer", "burgundy", "gold"], ["milky", "bloodRed", "silver"]] },
  "fr-side": { g: "tip", base: "sheer", pal: [["sheer", "espresso", "gold"], ["milky", "navy", "silver"], ["sheer", "emerald", "gold"]] },
  "fr-pinkwhite": { g: "tone", base: "sheer", pal: [["pinkNude", "white", "gold"], ["sheer", "white", "silver"]] },
  "fr-halfmoon": { g: "tip", base: "sheer", pal: [["nude", "burgundy", "gold"], ["milky", "black", "gold"], ["sheer", "espresso", "gold"]] },
  "fr-skittle": { g: "tip", base: "sheer", pal: [["sheer", "coffee", "gold"], ["sheer", "burgundy", "gold"], ["milky", "sage", "gold"], ["sheer", "hotPink", "gold"]] },
  "fr-glitter": { g: "tone", base: "sheer", ok: ([, , mt]) => mt !== "pearl", pal: [["sheer", "gold", "gold"], ["nude", "gold", "gold"], ["milky", "silver", "silver"]] },
  "fr-santa": { g: "tip", base: "sheer", pal: [["sheer", "cherry", "gold"], ["milky", "redVelvet", "gold"]] },
  "fr-candycane": { g: "tip", base: "sheer", pal: [["milky", "cherry", "gold"], ["sheer", "redVelvet", "gold"]] },
  "fr-tortoise": { g: "tone", base: "sheer", pal: [["sheer", "caramel", "gold"], ["nude", "caramel", "gold"]] },
  // nail Hàn
  syrup: { g: "tone", ok: ([a]) => chroma(hx(a)) >= 20 && Lof(hx(a)) < 72, pal: [["raspberry", "sheer", "pearl"], ["persimmon", "sheer", "gold"], ["coffee", "nude", "gold"], ["cherry", "sheer", "gold"]] },
  blush: { g: "glow", base: "sheer", pal: [["sheer", "hotPink", "pearl"], ["sheer", "raspberry", "pearl"], ["nude", "persimmon", "gold"]] },
  cleanmilky: { g: "tone", base: "sheer", pal: [["milky", "pearl", "gold"], ["sheer", "milky", "gold"], ["pinkNude", "milky", "pearl"]] },
  // chrome màu / nhũ loang
  // chrome màu cần nền có sắc (trung–đậm, hoặc màu rực như aqua / san hô) — nude / pastel nhạt tráng gương ra bạc be
  // nhạt, không còn "giữ màu" (soi lượt 25/10: "Chrome nude be" ra sọc bạc); xám thiếc / champagne là màu kim loại sẵn
  colorchrome: { g: "tone", shapes: SH5, ok: ([a]) => a === "pewter" || a === "champagne" || (chroma(hx(a)) >= 12 && Lof(hx(a)) < 62) || chroma(hx(a)) >= 28, pal: [["espresso", "espresso", "gold"], ["caramel", "caramel", "gold"], ["pewter", "pewter", "silver"], ["mulledWine", "mulledWine", "gold"], ["emerald", "emerald", "gold"], ["cherry", "cherry", "gold"]] },
  glitterfade: { g: "tone", shapes: SH5, ok: ([, , mt]) => mt !== "pearl", pal: [["sheer", "gold", "gold"], ["black", "silver", "silver"], ["nude", "roseGold", "roseGold"], ["cherry", "gold", "gold"]] },
  // hoạ tiết vẽ tay mới
  holly: { g: "motif", on: "#1f5a32", pal: [["milky", "redVelvet", "gold"], ["bone", "cherry", "gold"], ["sheer", "redVelvet", "gold"]] },
  ornament: { g: "motif", pal: [["milky", "redVelvet", "gold"], ["sheer", "emerald", "gold"], ["redVelvet", "milky", "gold"]] },
  gelflower: { g: "relief", base: "sheer", pal: [["sheer", "milky", "pearl"], ["milky", "babyPink", "pearl"], ["nude", "milky", "gold"], ["sheer", "lavender", "pearl"]] },
  // bộ phối theo dịp: 2 màu chính phải tách nhau (móng chính / móng nối)
  // Halloween "moody luxe": nền tối, hoặc trắng ngà / trắng sữa + đen — không nền cam bí ngô dưới ma / đầu lâu
  "mix-halloween": { g: "glow", shapes: SH5, ok: ([a]) => (Lof(hx(a)) < 30 && chroma(hx(a)) < 35) || a === "bone" || a === "milky", pal: [["black", "pumpkin", "silver"], ["milky", "black", "silver"], ["plumNoir", "bone", "silver"]] },
  "mix-christmas": { g: "glow", pal: [["redVelvet", "milky", "gold"], ["milky", "redVelvet", "gold"], ["emerald", "milky", "gold"]] },
  "mix-valentine": { g: "glow", pal: [["sheer", "cherry", "gold"], ["milky", "raspberry", "roseGold"], ["cherry", "milky", "gold"]] },
  "mix-fall": { g: "glow", pal: [["espresso", "caramel", "gold"], ["bone", "cinnamon", "gold"], ["mulledWine", "nude", "gold"]] },
  "mix-newyear": { g: "glow", pal: [["black", "champagne", "gold"], ["milky", "black", "silver"], ["navy", "milky", "silver"]] },
};
/** mẫu cũ lưu tên hoạ tiết đã gộp → hoạ tiết mới (giọt nước 3D "droplet" trùng "droplets") */
const ALIAS: Record<string, string> = { droplet: "droplets" };
/** Màu bắt buộc của vài hoạ tiết (đồi mồi luôn caramel, baby boomer luôn hồng → trắng sữa…). */
function forcedKeys(pid: string, k: [CK, CK, CK]): [CK, CK, CK] {
  switch (pid) {
    // dâu nhúng sô-cô-la: đầu móng LUÔN là sô-cô-la, nền LUÔN là màu dâu (đỏ / hồng) — nền navy, rêu, nâu… → đỏ dâu
    case "chocodip": return [BERRY.includes(k[0]) ? k[0] : "strawberry", "chocolate", k[2]];
    case "tortoise": return ["caramel", "chocolate", k[2]];
    case "babyboomer": return ["pinkNude", "white", k[2]];
    case "milkbath": return ["white", k[1] === "white" || k[1] === "milky" ? "babyPink" : k[1], k[2]];
    case "fr-pinkwhite": return [k[0] === "sheer" ? "sheer" : "pinkNude", "white", k[2]];
    case "fr-santa": case "fr-candycane": return [k[0], RED_TIP.includes(k[1]) ? k[1] : "cherry", k[2]];
    default: return k;
  }
}
/** Đưa bảng màu về đúng vai: hoạ tiết nền TRONG (French, má hồng…) mà màu chính đậm → màu đậm lên ĐẦU móng / thành
 *  hoạ tiết, nền đổi sang hồng sữa (nền tối hẳn → trắng sữa) — không bao giờ để màu đậm nằm dưới đầu French trắng. */
function fitRoles(pid: string, k: [CK, CK, CK]): [CK, CK, CK] {
  if (ROLES[pid]?.base === "sheer" && !SHEER.includes(k[0])) return [Lof(hx(k[0])) < 30 ? "milky" : "sheer", k[0], k[2]];
  if (pid === "syrup" && SHEER.includes(k[0]) && !SHEER.includes(k[1])) return [k[1], k[0], k[2]];
  return k;
}
/** Kim loại hợp nhiệt độ màu nền: bạc không đi với nâu / cam / vàng ấm; vàng hồng chỉ với hồng / nude. */
function metalOk(c1: CK, mt: CK): boolean {
  const fam = hueFamily(hx(c1));
  if (mt === "silver" && ["brown", "orange", "yellow"].includes(fam)) return false;
  if (mt === "roseGold" && !["pink", "nude", "white"].includes(fam)) return false;
  return true;
}
/** Bảng màu này ghép với hoạ tiết này có ổn không (đúng vai màu, hoạ tiết đủ nổi, kim loại hợp nền). */
export function paletteOk(pid: string, colors: [string, string, string]): boolean {
  const pat = PATTERNS.find((p) => p.id === (ALIAS[pid] ?? pid));
  if (!pat || !colors.every((c) => c in COLORS)) return false;
  const role = ROLES[pat.id] ?? { g: "tone" as const };
  const k = forcedKeys(pat.id, colors as [CK, CK, CK]);
  const [c1, c2, mt] = k.map(hx);
  if (role.base === "sheer" && !SHEER.includes(k[0])) return false;
  if (role.base === "dark" && Lof(c1) >= 45) return false;
  if (pat.badBase?.includes(k[0]) || !metalOk(k[0], k[2]) || (role.ok && !role.ok(k))) return false;
  if (role.g === "tone") return true;
  const fg = role.on === "metal" ? mt : !role.on || role.on === "c2" ? c2 : role.on, bg = role.vs ?? c1;
  if (role.g === "tip" && Lof(fg) > 88 && Lof(bg) < 92 && SHEER.includes(k[0])) return true; // đầu trắng đặc trên nền trong
  return contrastOk(fg, bg, GATE_MIN[role.g]);
}
/** Hiệu ứng hợp nền: nhũ chỉ ở French nhũ / nhũ loang / baby boomer; nhám chỉ nền trung–tối (L* < 55, nền sáng nhám
 *  nhìn như bút xoá #1); mắt mèo / velvet chỉ nền tối (L* < 45 — nền sáng ra móng trắng trơn, dải sáng không đọc được). */
const GLITTER_OK = new Set(["glitterfade", "fr-glitter", "babyboomer"]);
const CHROME_ANY = new Set(["solid", "colorchrome", "jelly"]); // chrome là chính mẫu (trơn / chrome màu) hoặc thạch tráng ngọc trai
export function finishOk(pid: string, c1hex: string, f: Finish): boolean {
  if (f === "glitter") return GLITTER_OK.has(pid);
  if (f === "matte") return Lof(c1hex) < 55;
  if (f === "cateye") return Lof(c1hex) < 45;
  // chrome trên mẫu có hoạ tiết / French: chỉ nền thật sáng (L* ≥ 84) — bộ vẽ ra lớp glazed ngọc trai, vẫn thấy màu + hoạ tiết.
  // Nền trung–tối thì bột chrome thành gương bạc phủ mất hoạ tiết (aura cherry cola, sao trên lục bảo ra bạc / xanh bạc hà).
  if (f === "chrome") return CHROME_ANY.has(pid) || Lof(c1hex) >= 84;
  return true;
}
/** Dáng móng được phép của hoạ tiết: dáng nhọn chỉ cho mẫu trơn / mắt mèo / aurora / chrome màu / French V / Halloween
 *  gothic — dâu nhúng sô-cô-la, French đôi, cherry, giọt nước, da báo, chấm bi trên móng nhọn nhìn như bút chì / răng nanh. */
export const patternShapes = (pid: string): Shape[] => ROLES[ALIAS[pid] ?? pid]?.shapes ?? SH4;
// Tỉ lệ dáng (dáng hạnh nhân nhiều nhất) và hiệu ứng (bóng là chính; mắt mèo / chrome là thế mạnh của bộ vẽ; nhũ, nhám ít)
const SHAPE_W: Record<Shape, number> = { almond: 0.35, oval: 0.2, square: 0.2, coffin: 0.15, stiletto: 0.1 };
const FINISH_W: Record<Finish, number> = { glossy: 0.5, cateye: 0.2, chrome: 0.18, glitter: 0.07, matte: 0.05 };
const ALMOND_FIRST = new Set(["french", "lace", "aura", "floral", "fr-micro", "fr-deep", "fr-pinkwhite", "fr-glitter", "gelflower"]);

// Nhóm để chia đều 1 lượt 6 mẫu
export const FRENCH_FAMILY = new Set(["french", "chromefrench", "doublefrench", "fr-micro", "fr-deep", "fr-v", "fr-side", "fr-pinkwhite", "fr-halfmoon", "fr-skittle", "fr-glitter", "fr-santa", "fr-candycane", "fr-tortoise"]);
const METAL_DOM = new Set(["colorchrome", "chromefrench", "chromedrops", "chromeline", "glitterfade", "fr-glitter", "foil"]);
const PLAIN = new Set(["solid", "velvet", "colorchrome", "jelly", "mixmatch"]);
const OCC_MOTIF = new Set(["web", "snow", "candy", "ghost", "jackolantern", "bats", "skull", "blackcat", "mummy", "moonstars", "slimedrip", "eyeball", "stitches", "candycorn", "witchy",
  "holly", "ornament", "hearts", "leaf", "blossom", "fr-santa", "fr-candycane", "mix-halloween", "mix-christmas", "mix-valentine", "mix-fall", "mix-newyear"]);
// cùng "họ" hoạ tiết không ra 2 lần liền (trăng sao + sao, ma + xác ướp)
const MOTIF_FAM: Record<string, string> = { moonstars: "sky", stars: "sky", ghost: "ghost", mummy: "ghost", bats: "bats" };
const JEWEL_HEX = new Set((["emerald", "cherry", "redVelvet", "raspberry", "hotPink", "persimmon", "strawberry", "cobalt", "burgundy", "teal", "plum", "cherryCola", "pumpkin"] as CK[]).map(hx));
export const RETIRED_PATTERNS = () => PATTERNS.filter((p) => p.retired).map((p) => p.id);

/** Đặc điểm 1 mẫu để chia đều lượt 6 mẫu (nền nude / tối / màu đá quý, kim loại, French, hoạ tiết dịp lễ…). */
export function designTraits(d: { pattern: string; palette: string[]; finish: string }) {
  const c1 = d.palette[0], [L, a, b] = lab(c1), C = Math.hypot(a, b), fam = hueFamily(c1);
  return {
    french: FRENCH_FAMILY.has(d.pattern),
    jewel: d.pattern === "auroracat" || JEWEL_HEX.has(c1) || (C >= 40 && L < 75),
    dark: L < 22,
    metal: d.finish === "chrome" || METAL_DOM.has(d.pattern),
    nude: fam === "nude" || fam === "white",
    white: L > 90,
    plain: PLAIN.has(d.pattern),
    motif: OCC_MOTIF.has(d.pattern),
    fam,
  };
}
const QUOTA = ["french", "jewel", "dark", "metal"] as const;
/** Lỗi phân bổ của 1 lượt 6 mẫu (rỗng = đạt): ≥1 French · ≥1 màu đá quý / rực · ≥1 nền gần đen · ≥1 kim loại chủ đạo ·
 *  nude/trong ≤ 40% · ≤1 nền gần trắng · ≤2 hoạ tiết dịp lễ · ≤1 mẫu trơn · 2 mẫu liền nhau không cùng họ màu. */
export function runIssues(ds: { pattern: string; palette: string[]; finish: string }[]): string[] {
  const t = ds.map(designTraits), out: string[] = QUOTA.filter((q) => !t.some((x) => x[q]));
  if (t.filter((x) => x.nude).length > 2) out.push("nude>2");
  if (t.filter((x) => x.white).length > 1) out.push("white>1");
  if (t.filter((x) => x.motif).length > 2) out.push("motif>2");
  if (t.filter((x) => x.plain).length > 1) out.push("plain>1");
  if (t.some((x, i) => i > 0 && x.fam === t[i - 1].fam)) out.push("adjacent-hue");
  return out;
}

// Hiệu ứng bề mặt
const FINISH_STEP: Record<Finish, (p: PCtx) => { materials: Mat[]; steps: Bi[]; minutes: number; price: number }> = {
  glossy: () => ({ materials: [m("Top gel bóng (no-wipe)", "No-wipe glossy top coat")], steps: [], minutes: 0, price: 0 }),
  matte: () => ({ materials: [m("Top nhám (matte top)", "Matte top coat")], steps: [s("Phủ top nhám, hơ đèn (muốn hoạ tiết kim loại nổi thì chấm lại top bóng lên nét)", "Matte top coat, cure (dab glossy top back over metallic details to make them pop)")], minutes: 3, price: 3 }),
  chrome: ({ c1, keepHue }) => ({
    // nền sáng → bột ánh ngọc trai (glazed); chrome màu → bột trong giữ sắc nền (nâu vẫn nâu, không ra bạc)
    // nền có màu rõ (hồng cánh sen, đỏ cherry…) dùng bột trong giữ màu — bột bạc biến móng đỏ thành móng bạc, sai tên mẫu
    materials: [keepHue || (Lof(c1.hex) <= 70 && chroma(c1.hex) >= 20) ? m("Bột tráng gương trong (giữ màu nền)", "Clear mirror chrome powder (keeps the base colour)", "1 hũ")
      : m(`Bột tráng gương ${Lof(c1.hex) > 70 ? "ánh ngọc trai" : "bạc"}`, `${Lof(c1.hex) > 70 ? "Pearl" : "Silver"} chrome powder`, "1 hũ"), m("Mút xoa bột chrome", "Chrome applicator sponge", "1 gói"), m("Top gel bóng (no-wipe)", "No-wipe glossy top coat")],
    steps: [s("Phủ top no-wipe, hơ đèn, xoa bột chrome đều tay bằng mút", "No-wipe top, cure, buff chrome powder in with a sponge"), s("Phủ top khoá bột, hơ đèn", "Seal with top coat, cure")],
    minutes: 8, price: 8,
  }),
  cateye: () => ({
    // Bước hút nam châm nằm ngay trong lớp màu (xem colorStep) — đúng kỹ thuật.
    materials: [m("Nam châm mắt mèo", "Cat-eye magnet", "1 cái"), m("Top gel bóng (no-wipe)", "No-wipe glossy top coat")],
    steps: [],
    minutes: 5, price: 7,
  }),
  glitter: ({ metal }) => ({
    materials: [m(`Gel nhũ ${metal.vi}`, `${cap(metal.en)} glitter gel`), m("Top gel bóng (no-wipe)", "No-wipe glossy top coat")],
    steps: [s(`Phủ 1 lớp nhũ ${metal.vi} mỏng (đậm dần về đầu móng), hơ đèn`, `One sheer ${metal.en} glitter coat, denser toward the tip, cure`)],
    minutes: 5, price: 5,
  }),
};
// Dip: hoàn thiện bằng activator + top dip tự khô (không hơ đèn).
const DIP_POWDER_PATTERNS = ["solid", "french", "ombre", "babyboomer"];
function DIP_FINISH(finish: Finish, metal: Color): { materials: Mat[]; steps: Bi[]; minutes: number; price: number } {
  if (finish === "glitter") {
    return { materials: [m(`Bột dip nhũ ${metal.vi}`, `${cap(metal.en)} glitter dip powder`, "1 hũ")], steps: [s(`Quét base, rắc 1 lớp bột nhũ ${metal.vi} đậm dần về đầu móng`, `Base, then sprinkle ${metal.en} glitter powder, denser toward the tip`)], minutes: 5, price: 5 };
  }
  if (finish === "matte") return { materials: [m("Top nhám cho dip", "Matte dip top coat")], steps: [], minutes: 2, price: 3 };
  return { materials: [], steps: [], minutes: 0, price: 0 };
}

const FINISH_EN: Record<Finish, string> = {
  glossy: "high-gloss",
  matte: "velvety matte",
  chrome: "reflective mirror chrome",
  // Ảnh kiểm tra cho thấy "magnetic cat-eye" hay ra màu trơn → tả rõ dải sáng.
  cateye: "magnetic cat-eye gel with a bright shimmering diagonal light band clearly visible across each nail",
  glitter: "shimmering glitter",
};

// ----------------------------------------------------------------------------
export interface EngineSpec { occasion: string | null; system: SystemId; shape: Shape; finish: Finish; pattern: string; colors: [CK, CK, CK]; style?: "korean" | "trend" }

export interface EngineDesign {
  occasion: string | null;
  title: Bi;
  description: Bi;
  skills: string[];
  difficulty: number;
  minutes: number;
  priceHint: string;
  materials: Mat[];
  steps: Bi[];
  palette: string[];
  shape: Shape;
  finish: Finish;
  pattern: string;
  imagePrompt: string;
  spec: EngineSpec;
}

export interface OccasionInfo { id: string; title: string; emoji?: string; startsIn: number }

const range = (lo: number, market: "US" | "AU") => {
  const k = market === "AU" ? 1.5 : 1;
  const r5 = (x: number) => Math.round((x * k) / 5) * 5;
  return `${market === "AU" ? "A$" : "$"}${r5(lo)}–${r5(lo + 15)}`;
};

/** Ghép 1 mẫu hoàn chỉnh từ thông số (dùng cho máy tạo mẫu và cho kiểm thử). */
export function buildDesign(spec: EngineSpec, market: "US" | "AU" = "US", occ?: OccasionInfo | null, trendTag?: string | null, radar?: { name: Bi; source: Bi } | null): EngineDesign {
  const sys = SYSTEMS.find((x) => x.id === spec.system)!;
  const pat = PATTERNS.find((x) => x.id === (ALIAS[spec.pattern] ?? spec.pattern))!;
  const keys = forcedKeys(pat.id, spec.colors);
  const [c1, c2, metal] = keys.map((k) => COLORS[k]) as [Color, Color, Color];
  const ctx: PCtx = { c1, c2, metal, sys, finish: spec.finish, keepHue: pat.keepHue };
  const shapeName = SHAPE_NAME[spec.shape];
  const prep = sys.prep(shapeName);
  // French nhũ / nhũ loang: nhũ nằm trong hoạ tiết → không phủ thêm 1 lớp nhũ cả móng
  const fin = sys.id === "dip" ? DIP_FINISH(spec.finish, metal) : FINISH_STEP[pat.ownGlitter && spec.finish === "glitter" ? "glossy" : spec.finish](ctx);

  // Lớp màu chính: mắt mèo dùng chính gel mắt mèo làm lớp màu.
  const colorMat = spec.finish === "cateye" ? m(`Gel mắt mèo ${c1.vi}`, `${cap(c1.en)} cat-eye gel`) : sys.colorMat(c1);
  const colorStep = pat.id === "velvet"
    ? s(`Sơn gel mắt mèo ${c1.vi}, lướt nam châm phẳng khắp mặt móng theo vòng tròn để ánh nhũ rải đều như nhung (KHÔNG tạo dải), hơ đèn NGAY; lặp lại lớp 2`, `Apply ${c1.en} cat-eye gel, sweep a flat magnet in circles over the whole nail so the shimmer spreads evenly like velvet (no stripe), cure immediately; repeat for coat two`)
    : spec.finish === "cateye"
    ? s(`Sơn gel mắt mèo ${c1.vi}, hút nam châm 5–10 giây cho dải sáng đẹp rồi hơ đèn NGAY; lặp lại lớp 2`, `Apply ${c1.en} cat-eye gel, hold the magnet 5–10s until the band looks right, cure immediately; repeat for coat two`)
    : sys.colorStep(c1);

  const materials: Mat[] = [];
  const seen = new Set<string>();
  for (const x of [...prep.materials, ...(pat.ownColor ? [] : [colorMat]), ...pat.materials(ctx), ...fin.materials]) {
    if (seen.has(x.vi)) continue;
    seen.add(x.vi);
    materials.push(x);
  }
  const ownTop = spec.finish === "matte" || spec.finish === "chrome"; // các hiệu ứng này đã có bước phủ top riêng
  const finalStep = sys.id === "dip"
    ? s(`Quét activator, chờ 2 phút, dũa mịn mặt móng; phủ 2 lớp top ${spec.finish === "matte" ? "nhám " : ""}dip, để khô tự nhiên, thoa dầu dưỡng da`, `Activator, wait 2 min, buff smooth; two coats of ${spec.finish === "matte" ? "matte " : ""}dip top, air-dry, finish with cuticle oil`)
    : ownTop
    ? s("Lau lớp dính (nếu có), thoa dầu dưỡng da", "Wipe if needed, finish with cuticle oil")
    : s("Phủ top bóng, hơ đèn, thoa dầu dưỡng da", "Glossy top coat, cure, finish with cuticle oil");
  const steps: Bi[] = [...prep.steps, ...(pat.ownColor ? [] : [colorStep]), ...pat.steps(ctx), ...fin.steps, finalStep];

  const minutes = Math.round((sys.minutes + pat.minutes + fin.minutes) / 5) * 5;
  const difficulty = Math.min(3, Math.max(sys.difficulty, pat.difficulty, spec.finish === "chrome" || spec.finish === "cateye" ? 2 : 1, pat.id === "gems" && sys.id === "acrylic" ? 3 : 1, (pat.minutes >= 20 && sys.id === "acrylic") ? 3 : 1));
  const skills = [sys.skill, pat.design ? "Design" : null].filter((x): x is string => !!x);

  const title = pat.title(ctx);
  const when = radar && !occ
    ? s(`Trend đang được ưa chuộng · ${radar.name.vi}`, `A trend clients are loving · ${radar.name.en}`)
    : occ
    ? occ.startsIn > 0
      ? s(`Chuẩn bị cho ${OCC_VI[occ.id] ?? occ.title}${occ.emoji ? " " + occ.emoji : ""} (còn ~${occ.startsIn} ngày)`, `Get ready for ${occTitleEn(occ.id) ?? occ.title}${occ.emoji ? " " + occ.emoji : ""} (in ~${occ.startsIn} days)`)
      : s(`Đang vào ${OCC_VI[occ.id] ?? occ.title}${occ.emoji ? " " + occ.emoji : ""}`, `${occTitleEn(occ.id) ?? occ.title} season is here${occ.emoji ? " " + occ.emoji : ""}`)
    : spec.style === "korean"
      ? s("Trend nail Hàn tối giản", "Korean minimalist trend")
      : spec.style === "trend"
      ? s("Trend đang được ưa chuộng", "A trend clients are loving")
      : s("Mẫu dễ bán quanh năm", "An easy seller all year round");
  const who = difficulty === 1
    ? s("Thợ mới làm đẹp được", "Newer techs can do it beautifully")
    : difficulty === 2 ? s("Hợp khách thích nổi bật vừa phải", "Great for clients who like a little statement") : s("Mẫu nghệ thuật cho khách đi tiệc, nên báo giá cao", "An art set for party clients, price it high");
  const trend = trendTag ? s(` · đang lên #${trendTag} trên PawNail`, ` · #${trendTag} is rising on PawNail`) : s("", "");
  const src = !radar ? s("", "") : occ ? s(` · ${radar.name.vi} (${radar.source.vi})`, ` · ${radar.name.en} (${radar.source.en})`) : s(` (${radar.source.vi})`, ` (${radar.source.en})`);
  const description: Bi = {
    vi: `${when.vi}${src.vi}: ${pat.why.vi}${trend.vi}. ${who.vi}. Làm ${sys.name.vi}, dáng ${shapeName.vi}, khoảng ${minutes} phút.`,
    en: `${when.en}${src.en}: ${pat.why.en}${trend.en}. ${who.en}. ${cap(sys.name.en)}, ${shapeName.en} shape, about ${minutes} minutes.`,
  };

  const length = spec.shape === "stiletto" || spec.shape === "coffin" ? "long" : spec.shape === "square" || spec.shape === "oval" ? "short" : "medium-length";
  const imagePrompt = `${length} ${spec.shape} nails, ${pat.image(ctx)}, ${FINISH_EN[spec.finish]} finish, all nail art painted only on the nail surfaces (never on the skin), all five nails fully painted`;

  return {
    occasion: spec.occasion, title, description, skills, difficulty, minutes,
    priceHint: range(sys.price + pat.price + fin.price, market),
    materials, steps,
    palette: [c1.hex, c2.hex, metal.hex].filter((h, i, a) => a.indexOf(h) === i),
    shape: spec.shape, finish: spec.finish, pattern: pat.id, imagePrompt, spec,
  };
}

const OCC_EN: Record<string, string> = {
  halloween: "Halloween", fall: "Fall", thanksgiving: "Thanksgiving & Black Friday", christmas: "Christmas", newyear: "New Year", tet: "Lunar New Year",
  valentine: "Valentine's Day", spring: "Spring pastel", prom: "Prom", mothersday: "Mother's Day", wedding: "Wedding", summer: "Summer", backtoschool: "Back to school",
};
const occTitleEn = (id: string) => OCC_EN[id];
const OCC_VI: Record<string, string> = {
  halloween: "mùa Halloween", fall: "mùa thu", thanksgiving: "Lễ Tạ Ơn", christmas: "mùa Giáng Sinh", newyear: "dịp Năm Mới", tet: "Tết Nguyên Đán",
  valentine: "Valentine", spring: "mùa xuân", prom: "mùa Prom", mothersday: "Ngày của Mẹ", wedding: "mùa cưới", summer: "mùa hè", backtoschool: "mùa tựu trường",
};

// Ngẫu nhiên có hạt giống (mulberry32)
function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

// Hashtag đang lên → hoạ tiết/hiệu ứng tương ứng (để mô tả nói thật "đang lên").
const TAG_HINTS: [RegExp, { pattern?: string; finish?: Finish }][] = [
  [/french/i, { pattern: "french" }], [/ombre|ombré/i, { pattern: "ombre" }], [/aura/i, { pattern: "aura" }], [/tortoise|doimoi|đồimồi/i, { pattern: "tortoise" }],
  [/marble|vanda/i, { pattern: "marble" }], [/minimal|line/i, { pattern: "lines" }], [/chrome|trangguong/i, { finish: "chrome" }], [/cateye|matmeo|mắtmèo/i, { finish: "cateye" }],
  [/glitter|nhu|nhũ/i, { finish: "glitter" }], [/matte|nham/i, { finish: "matte" }], [/flower|hoa|floral/i, { pattern: "floral" }], [/heart|tim/i, { pattern: "hearts" }],
];

export interface EngineInput {
  market: "US" | "AU"; date: string; occasions: OccasionInfo[]; risingTags: string[]; usedTitles: Set<string>; salt?: string;
  /** false: không lấy từ radar trend */ radar?: boolean;
  /** hoạ tiết của ~18 mẫu PawNail vừa ra (3 lượt gần nhất) — lượt này né, kho mẫu không lặp trăng sao / dơi / velvet mỗi lượt */
  recentPatterns?: string[];
}

const wpick = <T,>(r: () => number, arr: readonly T[], w: (x: T) => number): T => {
  let x = r() * arr.reduce((a, it) => a + w(it), 0);
  for (const it of arr) { x -= w(it); if (x <= 0) return it; }
  return arr[arr.length - 1];
};

// MÙA THEO BÁN CẦU: Úc ngược mùa (tháng 9–11 xuân, 12–2 hè, 3–5 thu). Lịch chủ đề chung (thu / xuân / hè / tựu trường)
// là mùa của Mỹ → ở Úc đổi sang đúng mùa Úc (tháng 10 ở Úc là mùa xuân, không phải mùa thu nâu caramel).
// Halloween hết sau 31/10: tháng 11–12 không ra mẫu Halloween nữa dù lịch còn sót.
const SEASONAL = new Set(["fall", "spring", "summer", "backtoschool"]);
const AU_SEASON: Record<number, string> = { 9: "spring", 10: "spring", 11: "spring", 12: "summer", 1: "summer", 2: "summer", 3: "fall", 4: "fall", 5: "fall" };
// Úc tháng 11–2 là mùa hè (Giáng sinh mùa hè): không nhung, caro, bông tuyết
const AU_SUMMER_NO = new Set(["velvet", "plaid", "snow"]);
export function liveOccasions(occs: OccasionInfo[], market: "US" | "AU", month: number): OccasionInfo[] {
  let out = occs.filter((o) => !(o.id === "halloween" && month >= 11));
  if (market === "AU" && out.some((o) => SEASONAL.has(o.id))) {
    out = out.filter((o) => !SEASONAL.has(o.id));
    const au = AU_SEASON[month];
    if (au) out.push({ id: au, title: au, startsIn: 0 });
  }
  return out;
}
const palKey = (occId: string, market: "US" | "AU") => (market === "AU" && occId === "christmas" ? "christmasAU" : occId);

// Kế hoạch 1 lượt 6 mẫu: ô 0 DỄ (thợ mới làm được — French micro, syrup…) · 2 ô radar trend · 1 ô nail Hàn / nền trong ·
// 1 ô dịp lễ (ưu tiên bộ phối mỗi móng một kiểu) · 1 ô trend / nail Hàn quanh năm.
type Slot = "easy" | "radar" | "korean" | "occasion" | "trend";
type Need = (typeof QUOTA)[number];
const SLOT_PLAN: Slot[] = ["easy", "radar", "korean", "occasion", "radar", "trend"];
// màu trơn (solid) chỉ ra từ radar trend (có nguồn) hoặc làm móng nối trong bộ phối — không tự bốc vào ô thường (≤ 1 mẫu trơn / 6)
const BASIC_OK = new Set(["french", "ombre", "aura", "lines", "fr-micro", "colorchrome", "glitterfade"]);
// Hoạ tiết "chung" ghép được với mọi dịp lễ (với bảng màu của dịp đó) — French biến tấu, chrome màu, nhũ loang, velvet…
const OCCASION_BASICS = ["fr-micro", "fr-deep", "fr-v", "fr-side", "fr-skittle", "fr-glitter", "colorchrome", "glitterfade", "velvet", "aura", "french", "ombre", "doublefrench"];
const EASY_FIRST = new Set(["fr-micro", "syrup", "cleanmilky"]);

interface ComposeOpts {
  market: "US" | "AU"; occ: OccasionInfo | null; style?: "korean" | "trend" | null; easy?: boolean; need: Need[];
  /** lượt đã đủ 2 mẫu nude/trong (hoặc đã có 1 nền gần trắng) → ưu tiên nền có màu; họ màu của mẫu liền trước → ưu tiên họ khác */
  avoidNude?: boolean; avoidWhite?: boolean; avoidFam?: string;
  finish?: Finish; shapes?: Shape[]; strict?: boolean; tag?: string | null; radar?: { name: Bi; source: Bi } | null;
}
/** Ghép 1 mẫu cho hoạ tiết `pat`: chọn bảng màu hợp vai (bảng của dịp → bảng mặc định của hoạ tiết), hệ móng, hiệu ứng
 *  (theo tỉ lệ + luật nền), dáng (theo danh sách được phép). null nếu không ghép được. */
function compose(r: () => number, pat: Pattern, palettes: readonly (readonly string[])[], o: ComposeOpts): EngineDesign | null {
  const fits = (list: readonly (readonly string[])[]) => list.filter((k) => k.length === 3 && k.every((c) => c in COLORS)).map((k) => fitRoles(pat.id, k as [CK, CK, CK])).filter((k) => paletteOk(pat.id, k));
  let cands = fits(palettes);
  if (!cands.length && !o.strict) cands = fits(ROLES[pat.id]?.pal ?? []);
  if (!cands.length) return null;
  const tr = (k: [CK, CK, CK]) => designTraits({ pattern: pat.id, palette: [hx(forcedKeys(pat.id, k)[0])], finish: "glossy" });
  // lượt còn thiếu nền tối / màu đá quý mà sắp hết ô → ưu tiên bảng màu lấp chỉ tiêu đó (bảng của dịp không có thì mượn
  // bảng mặc định của hoạ tiết / bảng trend); đủ nude rồi → nền có màu; khác họ màu mẫu liền trước
  const wants = (k: [CK, CK, CK]) => o.need.some((q) => tr(k)[q]);
  // (bảng lấp chỉ tiêu mà cùng họ màu với mẫu liền trước — VD lượt cần màu đá quý, bảng nail Hàn chỉ có mâm xôi đỏ ngay
  // sau mẫu đỏ rượu — cũng mượn: lục bảo / cobalt…). Ô dịp lễ chỉ mượn bảng mặc định của hoạ tiết, không mượn bảng trend
  // (từng ra "Bộ Halloween xanh cobalt")
  const good = (k: [CK, CK, CK]) => wants(k) && (!o.avoidFam || tr(k).fam !== o.avoidFam);
  if (o.need.length && !o.strict && !cands.some(good)) { const ext = fits([...(ROLES[pat.id]?.pal ?? []), ...(o.occ ? [] : PALETTES.trend)]).filter(good); if (ext.length) cands = ext; }
  for (const f of [o.need.length ? wants : null, o.avoidNude ? (k: [CK, CK, CK]) => !tr(k).nude : null, o.avoidWhite ? (k: [CK, CK, CK]) => !tr(k).white : null, o.avoidFam ? (k: [CK, CK, CK]) => tr(k).fam !== o.avoidFam : null]) {
    if (!f) continue;
    const w = cands.filter(f);
    if (w.length) cands = w;
  }
  const colors = pick(r, cands);
  const c1hex = hx(forcedKeys(pat.id, colors)[0]);
  const allowed = (o.shapes ?? patternShapes(pat.id)).filter((sh) => patternShapes(pat.id).includes(sh));
  const finsOf = (x: Sys) => (o.finish ? [o.finish] : pat.finishes).filter((f) => x.finishes.includes(f) && finishOk(pat.id, c1hex, f) && !(o.easy && (f === "chrome" || f === "cateye")));
  const sysPool = SYSTEMS.filter((x) => (!pat.systems || pat.systems.includes(x.id)) && (x.id !== "dip" || DIP_POWDER_PATTERNS.includes(pat.id)) && x.shapes.some((sh) => allowed.includes(sh)) && finsOf(x).length);
  if (!sysPool.length) return null;
  // mẫu dễ: ưu tiên sơn gel móng thật / dip (thợ mới làm được)
  const sys = o.easy ? (sysPool.find((x) => x.id === "gel") ?? sysPool.find((x) => x.difficulty === 1) ?? sysPool[0]) : pick(r, sysPool);
  let fins = finsOf(sys);
  const hint = o.tag ? TAG_HINTS.find(([re]) => re.test(o.tag!))?.[1] : undefined;
  if (hint?.finish && fins.includes(hint.finish)) fins = [hint.finish];
  else if (o.need.includes("metal") && !METAL_DOM.has(pat.id) && fins.includes("chrome")) fins = ["chrome"];
  const finish = wpick(r, fins, (f) => FINISH_W[f]);
  const almond = ALMOND_FIRST.has(pat.id) || finish === "chrome"; // French, ren, aura, hoa, chrome: dáng hạnh nhân là chính
  const shape = wpick(r, allowed.filter((sh) => sys.shapes.includes(sh)), (sh) => SHAPE_W[sh] * (almond && sh === "almond" ? 2.5 : 1));
  // Chỉ nói "đang lên #tag" khi mẫu dùng đúng hoạ tiết/hiệu ứng của tag đó.
  const honestTag = hint && ((hint.pattern && hint.pattern === pat.id) || (hint.finish && hint.finish === finish)) ? o.tag! : null;
  return buildDesign({ occasion: o.occ?.id ?? null, system: sys.id, shape, finish, pattern: pat.id, colors, ...(o.occ ? {} : o.style ? { style: o.style } : {}) }, o.market, o.occ, honestTag, o.radar ?? null);
}

/** Tạo `n` mẫu khác nhau. Mỗi lượt 6 mẫu theo kế hoạch ô (SLOT_PLAN) và chỉ tiêu (runIssues): ≥1 French, ≥1 màu đá quý /
 *  rực, ≥1 nền gần đen, ≥1 kim loại chủ đạo; nude/trong ≤ 40%; ≤ 2 hoạ tiết dịp lễ; 2 mẫu liền nhau khác họ màu; ô dịp lễ
 *  ưu tiên bộ phối mỗi móng một kiểu; né hoạ tiết của 3 lượt gần nhất (recentPatterns). Luật "mềm" nới dần khi bí. */
export function generateEngineDesigns(n: number, input: EngineInput): EngineDesign[] {
  const r = rng(`${input.date}|${input.market}|${input.salt ?? ""}`);
  const month = Number(input.date.slice(5, 7));
  const occs = liveOccasions(input.occasions, input.market, month);
  const auSummer = input.market === "AU" && [11, 12, 1, 2].includes(month);
  const live = (p: Pattern) => !p.retired && !(auSummer && AU_SUMMER_NO.has(p.id));
  const out: EngineDesign[] = [];
  const usedPatterns = new Set<string>(), usedFams = new Set<string>(), usedRadar = new Set<string>();
  const usedTitles = new Set([...input.usedTitles].map((t) => t.toLowerCase()));
  // 3 lượt gần nhất: né hoạ tiết + họ hoạ tiết (bộ phối theo dịp thì không — mỗi bộ vẽ ra khác hẳn theo hạt giống)
  const recent = new Set((input.recentPatterns ?? []).map((p) => ALIAS[p] ?? p).filter((p) => !p.startsWith("mix-")));
  const recentFams = new Set([...recent].map((p) => MOTIF_FAM[p]).filter(Boolean));
  const tags = input.risingTags.map((t) => t.replace(/^#/, ""));
  const hit = tags.map((t) => [t, TAG_HINTS.find(([re]) => re.test(t))?.[1]] as const).find(([, h]) => h);
  // RADAR TREND: 2/6 ô lấy từ trend đang lên trong mùa (theo thị trường: Úc ngược mùa) — xoay vòng theo ngày
  const radarTrends = input.radar === false ? [] : activeTrends(new Date(`${input.date}T12:00:00Z`), input.market);

  // mix: ô dịp lễ lần này thử bộ phối mỗi móng một kiểu (3/4 số lần → ~60% ô dịp lễ ra bộ phối: đủ ≥ 50% mà 3 lượt/ngày
  // không lượt nào cũng 1 tên "Bộ … mỗi móng một kiểu")
  type Steer = { need: Need[]; avoidNude: boolean; avoidWhite: boolean; avoidFam?: string; mix?: boolean };
  // fresh: chưa nới luật (bậc < 2) → bỏ luôn hoạ tiết của 3 lượt trước khỏi danh sách chọn (không trông vào loại dần)
  const radarCand = (st: Steer, fresh: boolean): { d: EngineDesign; id: string } | null => {
    const okLook = (l: Trend["looks"][number]) => { const p = PATTERNS.find((x) => x.id === (ALIAS[l.pattern] ?? l.pattern)); return !!p && live(p) && !usedPatterns.has(p.id) && !(fresh && recent.has(p.id)); };
    // trend gắn dịp lễ chỉ khi dịp đó đang / sắp diễn ra (cùng danh sách dịp của lượt tạo mẫu)
    const pool = radarTrends.filter((t) => !usedRadar.has(t.id) && (!t.occasion || occs.some((o) => o.id === t.occasion)) && t.looks.some(okLook));
    if (!pool.length) return null;
    // trend theo mùa / dịp lễ đang diễn ra được ưu tiên gấp đôi (chỉ "nóng" trong vài tuần)
    const tr = wpick(r, pool, (t) => t.weight * (t.months ? 2 : 1));
    const look = pick(r, tr.looks.filter(okLook));
    const pat = PATTERNS.find((x) => x.id === (ALIAS[look.pattern] ?? look.pattern))!;
    const occ = tr.occasion ? occs.find((o) => o.id === tr.occasion) ?? null : null;
    const d = compose(r, pat, look.colors, { market: input.market, occ, style: "trend", ...st, finish: look.finish, shapes: look.shapes, strict: true, radar: { name: tr.name, source: tr.source } });
    return d && { d, id: tr.id };
  };

  const poolCand = (kind: Slot, tries: number, st: Steer, fresh: boolean): EngineDesign | null => {
    const need = st.need;
    let occ: OccasionInfo | null = null, style: "korean" | "trend" | null = null;
    const mixOf = (o: OccasionInfo) => PATTERNS.find((p) => p.id === `mix-${o.id}` && live(p) && !usedPatterns.has(p.id));
    // ô dịp lễ: lấy bộ phối thì lấy dịp có bộ phối; không thì xoay vòng các dịp (bảng màu Valentine toàn đỏ / hồng — xoay
    // sang Tết / xuân mới tránh được 2 ô đỏ liền nhau)
    if (kind === "occasion") occ = (st.mix && tries < 40 ? occs.find((o) => mixOf(o)) : undefined) ?? occs[(Math.floor(out.length / 6) + Math.floor(tries / 20)) % occs.length];
    // ô dễ: thường theo dịp lễ; 1/3 số lần thử lấy mẫu dễ quanh năm (mẫu dễ của dịp ít — French micro, nhũ loang — mà 3 lượt
    // trước đã ra thì vẫn có mẫu dễ khác, không lặp)
    else if (kind === "easy" && occs.length && tries % 3 !== 2) occ = occs[Math.floor(tries / 20) % occs.length];
    else style = kind === "korean" ? "korean" : kind === "trend" ? "trend" : r() < 0.5 ? "korean" : "trend";
    const occId = occ?.id ?? style!;
    const tagged = (p: Pattern) => p.occasions !== "any" && p.occasions.includes(occId);
    let pool: Pattern[];
    if (occ) {
      const special = PATTERNS.filter((p) => live(p) && tagged(p) && !p.id.startsWith("mix-"));
      const basics = PATTERNS.filter((p) => live(p) && OCCASION_BASICS.includes(p.id) && !special.includes(p));
      const mix = mixOf(occ);
      // ô dịp lễ: bộ phối mỗi móng một kiểu (≥ 50% ô dịp lễ, xem st.mix); còn lại 45% hoạ tiết riêng của dịp, 55% hoạ tiết
      // chung trên bảng màu của dịp (French biến tấu, chrome màu, nhũ loang, velvet…) — không ngập sticker Halloween
      if (kind === "occasion" && mix && st.mix && tries < 40) pool = [mix];
      else pool = special.length && r() < 0.45 ? special : [...basics, ...special.filter((p) => !OCC_MOTIF.has(p.id))];
    } else pool = PATTERNS.filter((p) => live(p) && (tagged(p) || BASIC_OK.has(p.id)));
    if (kind === "easy") {
      pool = pool.filter((p) => p.difficulty === 1);
      const first = pool.filter((p) => EASY_FIRST.has(p.id));
      if (first.length && r() < 0.6) pool = first;
    }
    // cần French: lấy cả nhóm French dùng quanh năm (French tráng gương đi được nền tối khi lượt đã đủ nude)
    // (ô dịp lễ chỉ lấy French của chính dịp đó hoặc French quanh năm — French tráng gương kiểu Hàn không sang ô Noel)
    if (need.includes("french")) { const f = PATTERNS.filter((p) => live(p) && FRENCH_FAMILY.has(p.id) && (pool.includes(p) || p.occasions === "any" || (p.occasions as string[]).some((x) => x === "any" || (occ ? x === occId : x === "korean" || x === "trend")))); if (f.length) pool = f; }
    else if (need.includes("metal")) { const f = pool.filter((p) => METAL_DOM.has(p.id) || p.finishes.includes("chrome")); if (f.length) pool = f; }
    // lượt đã đủ 2 mẫu nền trong / nude → bỏ hoạ tiết bắt buộc nền trong (French, má hồng…) cho ô này
    if (st.avoidNude) { const f = pool.filter((p) => ROLES[p.id]?.base !== "sheer"); if (f.length) pool = f; }
    if (fresh) { const f = pool.filter((p) => !recent.has(p.id)); if (f.length) pool = f; }
    if (!pool.length) return null;
    let pat = pick(r, pool);
    // Hashtag đang lên khớp hoạ tiết → ưu tiên (1/3 số lần), nếu hoạ tiết đó hợp ô này.
    let tag: string | null = null;
    if (hit && r() < 0.34) {
      const p2 = hit[1]!.pattern ? PATTERNS.find((p) => p.id === hit[1]!.pattern) : undefined;
      if (p2 && live(p2) && (p2.occasions === "any" || tagged(p2)) && (kind !== "easy" || p2.difficulty === 1)) pat = p2;
      tag = hit[0];
    }
    return compose(r, pat, PALETTES[palKey(occId, input.market)] ?? PALETTES.any, { market: input.market, occ, style, easy: kind === "easy", ...st, tag });
  };

  // Nới luật theo bậc khi bí (mỗi bậc 60 lần thử): 0 đủ luật · 1 bỏ "≤ 2 mẫu / họ màu" · 2 bỏ né 3 lượt trước ·
  // 3 bỏ chỉ tiêu mềm (nude / trắng / trơn / 2 ô liền nhau cùng họ màu) · 4 cuối cùng mới cho trùng hoạ tiết trong lượt.
  // Trần hoạ tiết dịp lễ (≤ 2 / 6) giữ tới bậc 4 — lượt nào cũng không ngập sticker.
  const accept = (d: EngineDesign, lvl: number): boolean => {
    const k = out.length, p6 = k % 6, block = out.slice(k - p6), full = n - (k - p6) >= 6;
    if (usedTitles.has(d.title.vi.toLowerCase())) return false;
    const fam = MOTIF_FAM[d.pattern];
    if (lvl < 4 && (usedPatterns.has(d.pattern) || (fam && usedFams.has(fam)))) return false;
    if (lvl < 2 && (recent.has(d.pattern) || (fam && recentFams.has(fam)))) return false;
    const T = designTraits(d), bt = block.map(designTraits);
    if (lvl < 4 && T.motif && bt.filter((x) => x.motif).length >= 2) return false;
    if (lvl < 3) {
      if (full && QUOTA.filter((q) => !T[q] && !bt.some((x) => x[q])).length > 5 - p6) return false;
      if ((T.nude && bt.filter((x) => x.nude).length >= 2) || (T.white && bt.some((x) => x.white)) || (T.plain && bt.some((x) => x.plain))) return false;
      if (k > 0 && designTraits(out[k - 1]).fam === T.fam) return false;
    }
    if (lvl < 1 && bt.filter((x) => x.fam === T.fam).length >= 2) return false;
    return true;
  };

  for (let guard = 0; out.length < n && guard < n * 3; guard++) {
    const k = out.length, p6 = k % 6, full = n - (k - p6) >= 6;
    let slot = SLOT_PLAN[p6];
    if (slot === "occasion" && !occs.length) slot = "trend";
    if (p6 === 5 && r() < 0.5) slot = "korean"; // ô cuối: nửa nail Hàn, nửa trend
    // chỉ tiêu còn thiếu mà số ô còn lại vừa đủ → ô này nhắm lấp chỉ tiêu
    const bt = out.slice(k - p6).map(designTraits);
    const unmet = full ? QUOTA.filter((q) => !bt.some((x) => x[q])) : [];
    // French gần như luôn là nền trong (nude) → đã có 1 mẫu nude mà chưa có French thì ô này nhắm French luôn (còn đúng 1 suất nude)
    const nudeN = bt.filter((x) => x.nude).length;
    const need = unmet.length >= 5 - p6 ? unmet : unmet.includes("french") && nudeN >= 1 ? (["french"] as Need[]) : [];
    const st: Steer = { need, avoidNude: nudeN >= 2, avoidWhite: bt.some((x) => x.white), avoidFam: k ? designTraits(out[k - 1]).fam : undefined, mix: r() < 0.75 };
    let made: EngineDesign | null = null;
    for (let tries = 0; !made && tries < 300; tries++) {
      const lvl = Math.floor(tries / 60); // nới dần luật mềm khi bí (xem accept)
      const kind: Slot = slot === "radar" && (!radarTrends.length || tries >= 30) ? (tries % 2 ? "trend" : "korean") : slot;
      let d: EngineDesign | null = null, rid: string | null = null;
      if (kind === "radar") { const c = radarCand(st, lvl < 2); if (c) { d = c.d; rid = c.id; } }
      else d = poolCand(kind, tries, st, lvl < 2);
      if (d && accept(d, lvl)) { made = d; if (rid) usedRadar.add(rid); }
    }
    if (!made) continue;
    out.push(made);
    usedTitles.add(made.title.vi.toLowerCase());
    usedPatterns.add(made.pattern);
    if (MOTIF_FAM[made.pattern]) usedFams.add(MOTIF_FAM[made.pattern]);
  }
  return out;
}

/** Tạo CẢ BỘ `n` mẫu cho 1 dịp lễ (VD 100 mẫu Halloween): xoay vòng hoạ tiết riêng
 *  của dịp + hoạ tiết chung × bảng màu của dịp; không trùng tên, không ghép màu
 *  làm hoạ tiết bị chìm, trộn hệ móng/dáng/hiệu ứng. Hoạ tiết riêng được ưu tiên. */
export function generateOccasionBatch(n: number, input: Omit<EngineInput, "occasions"> & { occasion: OccasionInfo }): EngineDesign[] {
  const r = rng(`batch|${input.date}|${input.market}|${input.occasion.id}|${input.salt ?? ""}`);
  const occId = input.occasion.id;
  const palettes = PALETTES[palKey(occId, input.market)] ?? PALETTES.any;
  const special = PATTERNS.filter((p) => !p.retired && p.occasions !== "any" && p.occasions.includes(occId));
  const basics = PATTERNS.filter((p) => !p.retired && OCCASION_BASICS.includes(p.id) && !special.includes(p));
  const usedTitles = new Set([...input.usedTitles].map((t) => t.toLowerCase()));
  const out: EngineDesign[] = [];
  // Mỗi vòng: mọi hoạ tiết riêng 1 lần + 1/3 hoạ tiết chung → bộ mẫu thiên về chủ đề.
  for (let round = 0; out.length < n && round < palettes.length * 4; round++) {
    const pool = [...special, ...basics.filter((_, k) => (k + round) % 3 === 0)];
    for (const [pi, pat] of pool.entries()) {
      if (out.length >= n) break;
      const colors = fitRoles(pat.id, palettes[(round + pi) % palettes.length]);
      if (!paletteOk(pat.id, colors)) continue;
      const c1hex = hx(forcedKeys(pat.id, colors)[0]), allowed = patternShapes(pat.id);
      const sysPool = SYSTEMS.filter((x) => (!pat.systems || pat.systems.includes(x.id)) && (x.id !== "dip" || DIP_POWDER_PATTERNS.includes(pat.id)) && x.shapes.some((sh) => allowed.includes(sh)));
      if (!sysPool.length) continue;
      const sys = pick(r, sysPool);
      const finishes = pat.finishes.filter((f) => sys.finishes.includes(f) && finishOk(pat.id, c1hex, f));
      if (!finishes.length) continue;
      const finish = finishes[(round + pi) % finishes.length];
      const shape = wpick(r, allowed.filter((sh) => sys.shapes.includes(sh)), (sh) => SHAPE_W[sh]);
      const d = buildDesign({ occasion: occId, system: sys.id, shape, finish, pattern: pat.id, colors }, input.market, input.occasion, null);
      const key = d.title.vi.toLowerCase();
      if (usedTitles.has(key)) continue;
      usedTitles.add(key);
      out.push(d);
    }
  }
  return out;
}

export const PATTERN_IDS = PATTERNS.map((p) => p.id);
export { METALS };
