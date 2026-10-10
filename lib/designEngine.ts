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

export interface Bi { vi: string; en: string }
export type Mat = Bi & { qty: string };
export type Shape = "almond" | "coffin" | "square" | "oval" | "stiletto";
export type Finish = "glossy" | "matte" | "chrome" | "cateye" | "glitter";
export type SystemId = "gelx" | "acrylic" | "dip" | "gel";

interface Color { vi: string; en: string; hex: string }
const col = (vi: string, en: string, hex: string): Color => ({ vi, en, hex });

export const COLORS = {
  black: col("đen tuyền", "jet black", "#111111"),
  white: col("trắng sữa", "milky white", "#f8fafc"),
  nude: col("nude be", "beige nude", "#e8c4a8"),
  pinkNude: col("hồng nude", "pink nude", "#f2c4c4"),
  babyPink: col("hồng phấn", "baby pink", "#f9a8d4"),
  hotPink: col("hồng cánh sen", "hot pink", "#ec4899"),
  cherry: col("đỏ cherry", "cherry red", "#b91c1c"),
  velvet: col("đỏ nhung", "velvet red", "#9f1239"),
  burgundy: col("đỏ rượu vang", "burgundy", "#7f1d1d"),
  pumpkin: col("cam bí ngô", "pumpkin orange", "#ea580c"),
  burnt: col("cam cháy", "burnt orange", "#c2410c"),
  caramel: col("nâu caramel", "caramel", "#b45309"),
  chocolate: col("nâu socola", "chocolate brown", "#5b3a29"),
  mocha: col("nâu mocha", "mocha", "#8b6b5a"),
  olive: col("xanh rêu", "olive green", "#4d5b2a"),
  pine: col("xanh thông", "pine green", "#14532d"),
  emerald: col("xanh lục bảo", "emerald", "#047857"),
  mint: col("xanh mint", "mint", "#a7f3d0"),
  sky: col("xanh da trời", "sky blue", "#7dd3fc"),
  navy: col("xanh navy", "navy", "#1e3a8a"),
  teal: col("xanh ngọc", "teal", "#0d9488"),
  lavender: col("tím lavender", "lavender", "#c4b5fd"),
  plum: col("tím mận", "plum", "#581c87"),
  lemon: col("vàng chanh", "lemon yellow", "#fde047"),
  butter: col("vàng bơ", "butter yellow", "#fef3c7"),
  coral: col("hồng san hô", "coral", "#fb7185"),
  champagne: col("champagne", "champagne", "#f3e5ab"),
  smoke: col("xám khói", "smoky grey", "#475569"),
  gold: col("vàng ánh kim", "gold", "#d4af37"),
  silver: col("bạc", "silver", "#c0c0c0"),
  pearl: col("ngọc trai", "pearl", "#f5f0e8"),
  roseGold: col("vàng hồng", "rose gold", "#b76e79"),
  greige: col("xám be", "greige", "#b8ada3"),
  espresso: col("nâu espresso", "espresso brown", "#3b2418"),
  sheer: col("hồng sữa", "milky pink", "#f6d5d0"),
} as const;
type CK = keyof typeof COLORS;
const METALS: CK[] = ["gold", "silver", "roseGold", "pearl"];

// Bảng màu theo dịp: [màu chính, màu phụ, kim loại/điểm nhấn]
const PALETTES: Record<string, [CK, CK, CK][]> = {
  halloween: [["black", "pumpkin", "silver"], ["olive", "black", "gold"], ["pumpkin", "black", "gold"], ["plum", "black", "silver"], ["black", "white", "silver"],
    ["black", "cherry", "silver"], ["burgundy", "black", "gold"], ["nude", "black", "silver"], ["lavender", "black", "silver"], ["smoke", "black", "silver"],
    ["pinkNude", "black", "silver"], ["babyPink", "black", "silver"], ["chocolate", "pumpkin", "gold"]],
  fall: [["burgundy", "caramel", "gold"], ["caramel", "chocolate", "gold"], ["olive", "nude", "gold"], ["burnt", "mocha", "gold"], ["mocha", "nude", "roseGold"]],
  thanksgiving: [["pinkNude", "burnt", "gold"], ["mocha", "champagne", "gold"], ["chocolate", "nude", "gold"], ["nude", "caramel", "gold"]],
  christmas: [["velvet", "pine", "gold"], ["pine", "white", "gold"], ["white", "sky", "silver"], ["cherry", "white", "gold"], ["velvet", "white", "gold"]],
  newyear: [["silver", "black", "silver"], ["champagne", "white", "gold"], ["black", "champagne", "gold"], ["smoke", "silver", "silver"], ["plum", "black", "gold"]],
  tet: [["cherry", "lemon", "gold"], ["velvet", "champagne", "gold"], ["babyPink", "white", "gold"], ["lemon", "white", "gold"]],
  valentine: [["babyPink", "cherry", "gold"], ["cherry", "white", "gold"], ["hotPink", "babyPink", "silver"], ["pinkNude", "cherry", "roseGold"]],
  spring: [["lavender", "mint", "pearl"], ["babyPink", "butter", "pearl"], ["mint", "white", "gold"], ["sky", "lavender", "silver"], ["pinkNude", "white", "pearl"]],
  prom: [["plum", "silver", "silver"], ["hotPink", "silver", "silver"], ["navy", "silver", "silver"], ["emerald", "gold", "gold"]],
  mothersday: [["pinkNude", "white", "gold"], ["nude", "babyPink", "gold"], ["coral", "white", "pearl"]],
  wedding: [["white", "pearl", "pearl"], ["nude", "white", "pearl"], ["pinkNude", "white", "silver"]],
  summer: [["coral", "lemon", "gold"], ["teal", "white", "silver"], ["sky", "white", "pearl"], ["hotPink", "pumpkin", "gold"], ["lemon", "mint", "gold"]],
  backtoschool: [["navy", "white", "silver"], ["cherry", "navy", "gold"], ["olive", "butter", "gold"], ["nude", "chocolate", "gold"]],
  // Nail Hàn / nude tối giản: nền trong, hồng nude, trắng sữa, xám be, nâu socola + bạc
  korean: [["sheer", "white", "silver"], ["pinkNude", "white", "silver"], ["white", "pinkNude", "silver"], ["greige", "white", "silver"], ["chocolate", "nude", "silver"], ["nude", "white", "pearl"], ["mocha", "pinkNude", "silver"], ["sheer", "babyPink", "pearl"]],
  // Trend quanh năm: espresso, đỏ cherry, vàng bơ, xanh rêu, hồng phấn, tím lavender…
  trend: [["espresso", "nude", "gold"], ["nude", "cherry", "gold"], ["butter", "white", "gold"], ["olive", "nude", "gold"], ["babyPink", "white", "silver"], ["mocha", "white", "gold"], ["navy", "white", "silver"], ["lavender", "white", "silver"], ["pinkNude", "espresso", "gold"], ["white", "cherry", "silver"]],
  any: [["nude", "white", "gold"], ["pinkNude", "white", "gold"], ["mocha", "nude", "gold"], ["babyPink", "white", "pearl"], ["burgundy", "nude", "gold"], ["navy", "nude", "silver"]],
};

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
interface PCtx { c1: Color; c2: Color; metal: Color; sys: Sys; finish: Finish }
interface Pattern {
  id: string;
  occasions: string[] | "any";
  finishes: Finish[];
  systems?: SystemId[];
  minutes: number; price: number; difficulty: number; design: boolean;
  ownColor?: boolean; // hoạ tiết tự là lớp màu (đồi mồi) → bỏ bước sơn màu nền
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

export const PATTERNS: Pattern[] = [
  {
    id: "solid", occasions: "any", finishes: ["glossy", "matte", "chrome", "cateye", "glitter"], minutes: 0, price: 0, difficulty: 1, design: false,
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
    id: "french", occasions: "any", finishes: ["glossy", "matte", "chrome", "cateye", "glitter"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`French ${c2.vi} nền ${c1.vi}`, `${cap(c2.en)} French on ${c1.en}`),
    why: s("French kiểu mới (đầu màu, viền mảnh) đang thay French trắng cổ điển", "modern French tips (colored, micro-thin) are replacing the classic white French"),
    materials: ({ c2, sys }) => [sys.id === "dip" ? m(`Bột dip ${c2.vi} (đầu French)`, `${cap(c2.en)} dip powder (French tips)`, "1 hũ") : m(`Gel ${c2.vi} (đầu French)`, `${cap(c2.en)} gel (French tips)`), m("Cọ French dẹt", "Flat French brush", "1 cây")],
    steps: ({ c2, sys }) => [sys.id === "dip" ? s(`Nhúng nghiêng đầu móng vào bột ${c2.vi} tạo đường French`, `Dip the tips at an angle into ${c2.en} powder for the French line`) : s(`Kẻ đầu French ${c2.vi} mảnh, đều 2 bên, hơ đèn`, `Paint a thin, even ${c2.en} French tip, cure`)],
    image: ({ c1, c2 }) => `${c1.en} base with thin crisp ${c2.en} French tips, clean smile line`,
  },
  {
    id: "ombre", occasions: "any", finishes: ["glossy", "glitter", "matte"], minutes: 15, price: 8, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Ombre ${c1.vi} – ${c2.vi}`, `${cap(c1.en)} to ${c2.en} ombre`),
    why: s("ombre chuyển màu mềm hợp mọi độ dài móng, khách nhìn là thích", "soft ombre flatters every length and photographs beautifully"),
    materials: ({ c2, sys }) => [sys.id === "dip" ? m(`Bột dip ${c2.vi}`, `${cap(c2.en)} dip powder`, "1 hũ") : m(`Gel ${c2.vi}`, `${cap(c2.en)} gel polish`), m("Mút tán màu / cọ ombre", "Ombre sponge or brush", "1 cái")],
    steps: ({ c1, c2, sys }) => [sys.id === "dip" ? s(`Nhúng ${c2.vi} từ đầu móng lên giữa móng, rắc nhẹ phần chuyển màu`, `Dip ${c2.en} from tip to mid-nail, sprinkle lightly at the blend line`) : s(`Tán ${c2.vi} từ đầu móng vào, hoà với ${c1.vi} ở giữa móng, hơ đèn; lặp lại 2 lớp`, `Sponge ${c2.en} from the tip, blending into ${c1.en} mid-nail, cure; repeat twice`)],
    image: ({ c1, c2 }) => `every nail has the same smooth vertical gradient ombre, ${c1.en} near the cuticle blending softly into ${c2.en} at the tip, all five nails matching`,
  },
  {
    id: "aura", occasions: ["spring", "summer", "valentine", "prom", "any"], finishes: ["glossy", "chrome"], systems: ["gelx", "acrylic", "gel"], minutes: 15, price: 10, difficulty: 2, design: true,
    title: ({ c1, c2 }) => s(`Aura ${c2.vi} nền ${c1.vi}`, `${cap(c2.en)} aura on ${c1.en}`),
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
    id: "waves", occasions: ["summer"], finishes: ["glossy"], systems: ["gelx", "acrylic", "gel"], minutes: 15, price: 8, difficulty: 2, design: true,
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
    id: "droplet", occasions: ["trend", "korean", "summer"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 1, design: true,
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
    title: ({ c1 }) => s(`Velvet nhung ${c1.vi}`, `${cap(c1.en)} velvet nails`),
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
    id: "candycorn", occasions: ["halloween"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 20, price: 10, difficulty: 2, design: true,
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
    id: "eyeball", occasions: ["halloween"], finishes: ["glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 2, design: true,
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
    id: "moonstars", occasions: ["halloween"], finishes: ["matte", "glossy", "glitter"], systems: ["gelx", "gel", "acrylic"], minutes: 15, price: 8, difficulty: 1, design: true,
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
    id: "witchy", occasions: ["halloween"], finishes: ["cateye", "glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 12, price: 8, difficulty: 2, design: true, badBase: ["nude", "pinkNude", "babyPink", "lavender", "white", "pearl", "pumpkin", "sheer"],
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
    id: "stitches", occasions: ["halloween"], finishes: ["matte", "glossy"], systems: ["gelx", "gel", "acrylic"], minutes: 12, price: 6, difficulty: 1, design: true, badBase: ["black", "chocolate", "espresso", "navy", "plum", "burgundy", "smoke"],
    title: ({ c1 }) => s(`Đường khâu Frankenstein nền ${c1.vi}`, `Frankenstein stitches on ${c1.en}`),
    why: s("đường khâu kiểu Frankenstein — tối giản, làm nhanh mà vẫn 'chất' Halloween", "Frankenstein stitch lines are minimal and quick yet unmistakably Halloween"),
    materials: () => [LINER(COLORS.black), LINER_BRUSH],
    steps: () => [s(`Kẻ 1 đường dọc đen trên ${ACC.vi}, thêm các vạch ngang ngắn như đường khâu, hơ đèn`, `Draw a black line down the ${ACC.en} and cross it with short stitch marks, cure`)],
    image: ({ c1 }) => `${c1.en} nails with thin black Frankenstein stitch lines on two accent nails`,
  },
];

// Hiệu ứng bề mặt
const FINISH_STEP: Record<Finish, (p: PCtx) => { materials: Mat[]; steps: Bi[]; minutes: number; price: number }> = {
  glossy: () => ({ materials: [m("Top gel bóng (no-wipe)", "No-wipe glossy top coat")], steps: [], minutes: 0, price: 0 }),
  matte: () => ({ materials: [m("Top nhám (matte top)", "Matte top coat")], steps: [s("Phủ top nhám, hơ đèn (muốn hoạ tiết kim loại nổi thì chấm lại top bóng lên nét)", "Matte top coat, cure (dab glossy top back over metallic details to make them pop)")], minutes: 3, price: 3 }),
  chrome: ({ c1 }) => ({
    materials: [m(`Bột tráng gương ${["white", "pearl", "babyPink", "pinkNude", "nude", "champagne", "butter", "sheer", "greige"].some((k) => COLORS[k as CK].hex === c1.hex) ? "ánh ngọc trai" : "bạc"}`, `${["white", "pearl", "babyPink", "pinkNude", "nude", "champagne", "butter", "sheer", "greige"].some((k) => COLORS[k as CK].hex === c1.hex) ? "Pearl" : "Silver"} chrome powder`, "1 hũ"), m("Mút xoa bột chrome", "Chrome applicator sponge", "1 gói"), m("Top gel bóng (no-wipe)", "No-wipe glossy top coat")],
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
export function buildDesign(spec: EngineSpec, market: "US" | "AU" = "US", occ?: OccasionInfo | null, trendTag?: string | null): EngineDesign {
  const sys = SYSTEMS.find((x) => x.id === spec.system)!;
  const pat = PATTERNS.find((x) => x.id === spec.pattern)!;
  const keys: [CK, CK, CK] = spec.pattern === "tortoise" ? ["caramel", "chocolate", spec.colors[2]] : spec.pattern === "babyboomer" ? ["pinkNude", "white", spec.colors[2]] : spec.pattern === "milkbath" ? ["white", spec.colors[1] === "white" ? "babyPink" : spec.colors[1], spec.colors[2]] : spec.colors;
  const [c1, c2, metal] = keys.map((k) => COLORS[k]) as [Color, Color, Color];
  const ctx: PCtx = { c1, c2, metal, sys, finish: spec.finish };
  const shapeName = SHAPE_NAME[spec.shape];
  const prep = sys.prep(shapeName);
  const fin = sys.id === "dip" ? DIP_FINISH(spec.finish, metal) : FINISH_STEP[spec.finish](ctx);

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
  const when = occ
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
  const description: Bi = {
    vi: `${when.vi}: ${pat.why.vi}${trend.vi}. ${who.vi}. Làm ${sys.name.vi}, dáng ${shapeName.vi}, khoảng ${minutes} phút.`,
    en: `${when.en}: ${pat.why.en}${trend.en}. ${who.en}. ${cap(sys.name.en)}, ${shapeName.en} shape, about ${minutes} minutes.`,
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

export interface EngineInput { market: "US" | "AU"; date: string; occasions: OccasionInfo[]; risingTags: string[]; usedTitles: Set<string>; salt?: string }

/** Tạo `n` mẫu khác nhau: ưu tiên dịp lễ đang/sắp tới, trộn hệ móng/độ khó, không trùng tên đã có. */
export function generateEngineDesigns(n: number, input: EngineInput): EngineDesign[] {
  const r = rng(`${input.date}|${input.market}|${input.salt ?? ""}`);
  const occs = input.occasions.length ? input.occasions : [];
  const out: EngineDesign[] = [];
  const usedPatterns = new Set<string>();
  const usedTitles = new Set([...input.usedTitles].map((t) => t.toLowerCase()));
  const tags = input.risingTags.map((t) => t.replace(/^#/, ""));

  for (let i = 0, tries = 0; out.length < n && tries < n * 60; tries++) {
    // Một nửa theo dịp lễ, một nửa "quanh năm" — trong đó phần lớn là trend nail Hàn
    // tối giản (nude, thạch trong, French tráng gương, charm, cụm đá) khách đặt nhiều.
    const yearRound = !occs.length || out.length % 2 === 1;
    const occ = yearRound ? null : occs[(i + Math.floor(tries / 20)) % occs.length];
    // Quanh năm: ~45% nail Hàn, ~45% trend đang chuộng, còn lại mẫu cơ bản dễ bán.
    const roll = yearRound ? r() : 1;
    const style: "korean" | "trend" | null = roll < 0.45 ? "korean" : roll < 0.9 ? "trend" : null;
    const korean = style === "korean";
    const occId = occ?.id ?? style ?? "any";
    const BASIC_OK = new Set(["solid", "french", "ombre", "aura", "lines"]);
    const cands = PATTERNS.filter((p) =>
      style ? (p.occasions !== "any" && p.occasions.includes(style)) || BASIC_OK.has(p.id)
        : p.occasions === "any" ? true : p.occasions.includes(occId) || (occId === "any" && p.occasions.includes("any")));
    // Dịp lễ: ưu tiên hoạ tiết riêng của dịp đó (mạng nhện cho Halloween…).
    const special = cands.filter((p) => p.occasions !== "any" && p.occasions.includes(occId));
    let pat = (special.length && r() < 0.65 ? pick(r, special) : pick(r, cands));
    // Hashtag đang lên khớp hoạ tiết → ưu tiên (1/3 số lần).
    let trendTag: string | null = null;
    const hit = tags.map((t) => [t, TAG_HINTS.find(([re]) => re.test(t))?.[1]] as const).find(([, h]) => h);
    if (hit && r() < 0.34) {
      const h = hit[1]!;
      const p2 = h.pattern ? PATTERNS.find((p) => p.id === h.pattern) : undefined;
      if (p2) pat = p2;
      trendTag = hit[0];
    }
    if (out.length === 0 && pat.difficulty > 1 && tries < n * 40) continue; // mẫu đầu lô: thợ mới làm được
    if (usedPatterns.has(pat.id) && tries < n * 30) continue;

    const palettes = PALETTES[occId] ?? PALETTES.any;
    const colors = pick(r, palettes);
    // Mẫu đầu tiên trong mỗi lô: dễ (thợ mới làm được) → ưu tiên dip/sơn gel.
    const sysPool = SYSTEMS.filter((x) => (!pat.systems || pat.systems.includes(x.id)) && (x.id !== "dip" || DIP_POWDER_PATTERNS.includes(pat.id)));
    const sys = out.length === 0 ? (sysPool.find((x) => x.id === "gel") ?? sysPool[0]) : pick(r, sysPool);
    let finishes = pat.finishes.filter((f) => sys.finishes.includes(f));
    const hintFinish = trendTag ? TAG_HINTS.find(([re]) => re.test(trendTag!))?.[1].finish : undefined;
    if (hintFinish && finishes.includes(hintFinish)) finishes = [hintFinish];
    if (!finishes.length) continue;
    if (out.length === 0) finishes = finishes.filter((f) => f !== "chrome" && f !== "cateye");
    if (!finishes.length) continue;
    const finish = pick(r, finishes);
    const shape = pick(r, sys.shapes);

    // Chỉ nói "đang lên #tag" khi mẫu dùng đúng hoạ tiết/hiệu ứng của tag đó.
    const hint = trendTag ? TAG_HINTS.find(([re]) => re.test(trendTag!))?.[1] : undefined;
    const honestTag = hint && ((hint.pattern && hint.pattern === pat.id) || (hint.finish && hint.finish === finish)) ? trendTag : null;
    const d = buildDesign({ occasion: occ?.id ?? null, system: sys.id, shape, finish, pattern: pat.id, colors, ...(style ? { style } : {}) }, input.market, occ, honestTag);
    const key = d.title.vi.toLowerCase();
    if (usedTitles.has(key)) continue;
    usedTitles.add(key);
    usedPatterns.add(pat.id);
    out.push(d);
    i++;
  }
  return out;
}

// Hoạ tiết "chung" ghép được với mọi dịp lễ (với bảng màu của dịp đó).
const OCCASION_BASICS = ["solid", "french", "ombre", "lines", "velvet", "doublefrench", "foil", "chromefrench", "gemcluster"];

/** Tạo CẢ BỘ `n` mẫu cho 1 dịp lễ (VD 100 mẫu Halloween): xoay vòng hoạ tiết riêng
 *  của dịp + hoạ tiết chung × bảng màu của dịp; không trùng tên, không ghép màu
 *  làm hoạ tiết bị chìm, trộn hệ móng/dáng/hiệu ứng. Hoạ tiết riêng được ưu tiên. */
export function generateOccasionBatch(n: number, input: Omit<EngineInput, "occasions"> & { occasion: OccasionInfo }): EngineDesign[] {
  const r = rng(`batch|${input.date}|${input.market}|${input.occasion.id}|${input.salt ?? ""}`);
  const occId = input.occasion.id;
  const palettes = PALETTES[occId] ?? PALETTES.any;
  const special = PATTERNS.filter((p) => p.occasions !== "any" && p.occasions.includes(occId));
  const basics = PATTERNS.filter((p) => OCCASION_BASICS.includes(p.id) && !special.includes(p));
  const usedTitles = new Set([...input.usedTitles].map((t) => t.toLowerCase()));
  const out: EngineDesign[] = [];
  // Mỗi vòng: mọi hoạ tiết riêng 1 lần + một nửa hoạ tiết chung → bộ mẫu thiên về chủ đề.
  for (let round = 0; out.length < n && round < palettes.length * 3; round++) {
    const pool = [...special, ...basics.filter((_, k) => (k + round) % 2 === 0)];
    for (const [pi, pat] of pool.entries()) {
      if (out.length >= n) break;
      const colors = palettes[(round + pi) % palettes.length];
      if (pat.badBase?.includes(colors[0])) continue;
      const sysPool = SYSTEMS.filter((x) => (!pat.systems || pat.systems.includes(x.id)) && (x.id !== "dip" || DIP_POWDER_PATTERNS.includes(pat.id)));
      if (!sysPool.length) continue;
      const sys = pick(r, sysPool);
      const finishes = pat.finishes.filter((f) => sys.finishes.includes(f));
      if (!finishes.length) continue;
      const finish = finishes[(round + pi) % finishes.length];
      const shape = pick(r, sys.shapes);
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
