// SOI TAY → GỢI Ý MẪU HỢP TAY: từ khuôn các móng đã nhận (màu da sau chân móng, màu móng đang sơn, dài / rộng /
// độ bo đầu móng) suy ra tông da (ấm / lạnh / trung tính), độ sáng da, dáng + độ dài móng; rồi chọn 10 mẫu theo
// TREND đang hot, hợp tông da và làm ngón tay thon hơn — mỗi mẫu kèm 1 câu "vì sao hợp với bạn" như thợ tư vấn.
// Thuần TypeScript, không gọi AI.
import { buildDesign, COLORS, type EngineSpec, type Shape } from "@/lib/designEngine";
import type { StudioLook } from "@/lib/studio";
import type { HandProfile } from "./profile";

export type { HandProfile };

type Bi = { vi: string; en: string };
type CK = keyof typeof COLORS;

const TONE_VI = { warm: "ấm (ngả vàng)", cool: "lạnh (ngả hồng)", neutral: "trung tính" } as const;
const TONE_EN = { warm: "warm (golden)", cool: "cool (pink)", neutral: "neutral" } as const;
const DEPTH_VI = { fair: "sáng", medium: "trung bình", tan: "rám", deep: "đậm" } as const;
const DEPTH_EN = { fair: "fair", medium: "medium", tan: "tan", deep: "deep" } as const;
const LEN_VI = { short: "ngắn", medium: "vừa", long: "dài" } as const;
const LEN_EN = { short: "short", medium: "medium", long: "long" } as const;

/** Mấy dòng tóm tắt "tay bạn" để hiện trên thẻ soi tay. */
export function profileChips(p: HandProfile): Bi[] {
  return [
    { vi: `Da ${DEPTH_VI[p.depth]}, tông ${TONE_VI[p.undertone]}`, en: `${DEPTH_EN[p.depth][0].toUpperCase()}${DEPTH_EN[p.depth].slice(1)} skin, ${TONE_EN[p.undertone]} undertone` },
    { vi: `Móng ${LEN_VI[p.length]} · ${p.nails} móng`, en: `${LEN_EN[p.length][0].toUpperCase()}${LEN_EN[p.length].slice(1)} nails · ${p.nails} found` },
    { vi: `Dáng hợp nhất: ${SHAPE_VI[bestShape(p)]}`, en: `Most flattering shape: ${bestShape(p)}` },
  ];
}
const SHAPE_VI: Record<Shape, string> = { almond: "hạnh nhân", oval: "oval", square: "vuông", coffin: "coffin", stiletto: "nhọn" };

/** Dáng làm ngón tay thon nhất: móng ngắn / bè → hạnh nhân, oval (kéo dài ngón); móng dài → coffin / hạnh nhân. */
export function bestShape(p: HandProfile): Shape {
  if (p.length === "short") return p.ratio < 0.9 ? "almond" : "oval";
  if (p.length === "medium") return p.tip === "square" || p.tip === "squoval" ? "square" : "almond";
  return p.tip === "square" ? "coffin" : "almond";
}

// Bảng màu theo tông da (thợ hay tư vấn): [nude hợp tông, màu đậm hợp tông, kim loại hợp tông, màu sáng / pastel]
// + aura: quầng màu đủ tương phản với nền nude (vàng bơ trên nude từng gần như không thấy) · ombre: nude → màu ĐẬM cùng họ
const TONE: Record<HandProfile["undertone"], { nude: CK[]; rich: CK[]; metal: CK; pastel: CK[]; pop: CK[]; aura: [CK, CK][]; deepOf: CK[] }> = {
  warm: { nude: ["nude", "caramel"], rich: ["burnt", "olive", "espresso", "burgundy"], metal: "gold", pastel: ["butter", "coral", "champagne"], pop: ["pumpkin", "coral"], aura: [["nude", "coral"], ["nude", "hotPink"], ["butter", "pumpkin"]], deepOf: ["mocha", "espresso", "chocolate", "burgundy"] },
  cool: { nude: ["pinkNude", "sheer"], rich: ["cherry", "burgundy", "plum", "navy"], metal: "silver", pastel: ["lavender", "babyPink", "sky"], pop: ["hotPink", "cherry"], aura: [["sheer", "lavender"], ["pinkNude", "hotPink"], ["white", "sky"]], deepOf: ["burgundy", "plum", "mocha"] },
  neutral: { nude: ["sheer", "nude"], rich: ["burgundy", "mocha", "espresso", "cherry"], metal: "roseGold", pastel: ["babyPink", "lavender", "butter"], pop: ["cherry", "hotPink"], aura: [["sheer", "babyPink"], ["nude", "coral"], ["pinkNude", "lavender"]], deepOf: ["mocha", "burgundy", "espresso"] },
};

export interface AdviceLook extends StudioLook { why: Bi; tag: Bi }

/** 10 mẫu hợp tay + đang trend. `salt` đổi bộ ("Bộ khác"); `extension`: đang chọn đắp móng (giá theo Gel-X). */
export function adviceLooks(p: HandProfile, market: "US" | "AU", salt: string, extension = false, now = new Date()): AdviceLook[] {
  const month = now.getUTCMonth() + 1;
  let h = 2166136261;
  for (const c of salt) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
  const t = TONE[p.undertone];
  const deep = p.depth === "deep" || p.depth === "tan";
  const shape = bestShape(p);
  const sys = extension ? "gelx" : "gel";
  const tone = { vi: `tông da ${TONE_VI[p.undertone]}`, en: `your ${TONE_EN[p.undertone]} undertone` };
  const slim = { vi: `móng ${LEN_VI[p.length]} của bạn trông dài hơn`, en: `makes your ${LEN_EN[p.length]} nails look longer` };
  const TAG = {
    skin: { vi: "Hợp tông da", en: "Suits your skin" }, trend: { vi: "Trend 2026", en: "2026 trend" },
    slim: { vi: "Làm ngón thon", en: "Slimming" }, bold: { vi: "Cá tính", en: "Statement" },
  };
  const metal = t.metal;
  const nude = pick(t.nude), rich = deep ? pick(["cherry", "emerald", "plum", ...t.rich] as CK[]) : pick(t.rich);
  const items: { spec: Omit<EngineSpec, "system" | "occasion">; tag: Bi; why: Bi }[] = [
    { spec: { shape, finish: "glossy", pattern: "solid", colors: [nude, "white", metal], style: "trend" }, tag: TAG.skin,
      why: { vi: `Nude ${COLORS[nude].vi} đúng ${tone.vi} — nhìn như ngón tay dài ra, đi làm / đi chơi đều hợp`, en: `${COLORS[nude].en} nude matched to ${tone.en} — visually lengthens your fingers, works everywhere` } },
    { spec: { shape, finish: "glossy", pattern: "solid", colors: [rich, "nude", metal], style: "trend" }, tag: TAG.skin,
      why: { vi: `${COLORS[rich].vi[0].toUpperCase()}${COLORS[rich].vi.slice(1)} làm da ${deep ? "đậm sáng bừng" : "trông trắng sáng"}, hợp ${tone.vi}`, en: `${COLORS[rich].en[0].toUpperCase()}${COLORS[rich].en.slice(1)} makes ${deep ? "deeper skin glow" : "your skin look brighter"} — right for ${tone.en}` } },
    { spec: { shape, finish: "chrome", pattern: "solid", colors: [deep ? "pearl" : "white", "pearl", "pearl"], style: "trend" }, tag: TAG.trend,
      why: { vi: "Glazed donut — ánh ngọc trai tráng gương, mẫu được đặt nhiều nhất năm nay", en: "Glazed donut — pearly chrome glaze, the most-booked look this year" } },
    { spec: { shape, finish: "glossy", pattern: "french", colors: [p.undertone === "warm" ? "nude" : "sheer", pick(["white", rich, metal] as CK[]), metal], style: "trend" }, tag: TAG.trend,
      why: { vi: "Micro French viền mảnh — sang, tối giản, móng mọc ra vẫn đẹp", en: "Micro French — a fine tip line, minimal and luxe, grows out gracefully" } },
    // HỌ MẮT MÈO — nhóm trend tăng mạnh nhất 2026 (Pinterest Predicts 2026): xoay vòng theo "Bộ khác"
    (() => {
      const kind = pick(["velvet", "polka", "auroracat", "darkred", "twotone"] as const);
      const deepC = deep ? "plum" : pick(["burgundy", "espresso", "plum", "navy", "plumNoir"] as CK[]);
      if (kind === "polka") return { spec: { shape, finish: "cateye" as const, pattern: "polka", colors: [pick(["plumNoir", "black", "navy"] as CK[]), "white", metal === "pearl" ? "silver" : metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Mắt mèo chấm bi — tìm kiếm tăng 1.585% trên Pinterest, vừa sang vừa nghịch", en: "Polka dot cat eye — Pinterest searches up 1,585%, chic yet playful" } };
      if (kind === "auroracat") return { spec: { shape, finish: "cateye" as const, pattern: "auroracat", colors: [pick(["black", "navy", "plumNoir"] as CK[]), "white", "silver"] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Mắt mèo aurora — dải sáng đổi sắc như cực quang, tìm kiếm +895% trên Pinterest", en: "Aurora cat eye — a colour-shifting band like the northern lights, Pinterest searches +895%" } };
      if (kind === "darkred") return { spec: { shape, finish: "cateye" as const, pattern: "solid", colors: [pick(["burgundy", "mulledWine", "cherry"] as CK[]), "gold", "gold"] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: `Mắt mèo đỏ sẫm — tìm kiếm +735% trên Pinterest, làm da ${deep ? "đậm sáng bừng" : "trông trắng sáng"}`, en: `Dark red cat eye — Pinterest searches +735%, makes ${deep ? "deeper skin glow" : "skin look brighter"}` } };
      if (kind === "twotone") return { spec: { shape, finish: "cateye" as const, pattern: "mixmatch", colors: [deepC, pick(["navy", "plumNoir", "periwinkle"] as CK[]), "silver"] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Mắt mèo 2 tông xen kẽ — tìm kiếm +515% trên Pinterest", en: "Two-tone cat eye, alternating — Pinterest searches +515%" } };
      return { spec: { shape, finish: "cateye" as const, pattern: "velvet", colors: [deepC, "white", metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Velvet nhung — mắt mèo rải đều như nhung, lấp lánh dưới đèn", en: "Velvet — cat-eye shimmer spread like velvet, sparkles under light" } };
    })(),
    { spec: { shape, finish: "glossy", pattern: "aura", colors: [...pick(t.aura), metal] as [CK, CK, CK], style: "trend" }, tag: TAG.trend,
      why: { vi: `Aura nail — quầng màu mềm giữa móng, hợp ${tone.vi}`, en: `Aura nails — a soft glow in the centre, flattering on ${tone.en}` } },
    { spec: { shape: shape === "square" ? "oval" : shape, finish: "glossy", pattern: "babyboomer", colors: ["pinkNude", "white", metal], style: "trend" }, tag: TAG.slim,
      why: { vi: `Baby boomer chuyển trắng sữa — ${slim.vi}`, en: `Baby boomer milky fade — ${slim.en}` } },
    { spec: { shape, finish: "glossy", pattern: "ombre", colors: [t.nude[0], pick(t.deepOf), metal], style: "trend" }, tag: TAG.slim,
      why: { vi: `Ombre dọc móng kéo dài ngón — ${slim.vi}`, en: `A vertical ombre draws the eye along the nail — ${slim.en}` } },
    // 2 mẫu "WOW" mỗi bộ (khách lướt thấy là muốn chụp): 1 mẫu chi tiết KIM LOẠI + 1 mẫu 3D — xoay vòng theo "Bộ khác"
    (() => {
      const fallM = month >= 9 && month <= 11;
      const kind = pick(["chromeline", "chromefrench", "lines", "marble", "tortoise", "foil", "leopard", "checker", "stripes", "polka", ...(fallM ? (["fawn", "tortoise"] as const) : [])] as const);
      if (kind === "stripes") return { spec: { shape: shape === "square" ? "almond" : shape, finish: "glossy" as const, pattern: "stripes", colors: [pick([nude, "pinkNude", "cloudDancer"] as CK[]), pick(["white", "espresso", "black"] as CK[]), metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.slim,
        why: { vi: `Sọc mảnh dọc móng — kéo dài ngón tay, "almond nails stripes" +694% trên Pinterest`, en: `Fine vertical stripes — lengthen the fingers; "almond nails stripes" +694% on Pinterest` } };
      if (kind === "polka") return { spec: { shape, finish: "glossy" as const, pattern: "polka", colors: [pick([nude, "cloudDancer", "babyPink"] as CK[]), pick(["chocolate", "burgundy", "white"] as CK[]), metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.bold,
        why: { vi: "Chấm bi nhỏ tối giản — đang hot lại, hợp móng ngắn", en: "Minimal tiny polka dots — back in style, perfect on short nails" } };
      if (kind === "fawn") return { spec: { shape, finish: "glossy" as const, pattern: "fawn", colors: [pick(["caramel", "coffee"] as CK[]), "cloudDancer", metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.bold,
        why: { vi: "Da hươu (fawn) — animal print mềm của thu 2026, nhẹ nhàng hơn da báo", en: "Fawn print — fall 2026's soft animal print, gentler than leopard" } };
      if (kind === "foil") return { spec: { shape, finish: "glossy" as const, pattern: "foil", colors: [pick([rich, nude, "olive"] as CK[]), "white", metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.bold,
        why: { vi: `Foil ${COLORS[metal].vi} vụn trên 2 ngón — sang, bắt sáng mỗi lần cử động`, en: `${COLORS[metal].en[0].toUpperCase()}${COLORS[metal].en.slice(1)} foil flakes on two nails — luxe, catches the light as you move` } };
      if (kind === "leopard") return { spec: { shape, finish: "glossy" as const, pattern: "leopard", colors: [nude, pick(["caramel", "chocolate", "cherry"] as CK[]), metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.bold,
        why: { vi: "Da báo trên 2 ngón nhấn — trend đang quay lại mạnh, cá tính mà vẫn sang", en: "Leopard print on two accent nails — back in a big way, bold yet chic" } };
      if (kind === "checker") return { spec: { shape, finish: "glossy" as const, pattern: "checker", colors: [pick(["babyPink", "white", nude] as CK[]), pick(["espresso", "black", "cherry"] as CK[]), metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.bold,
        why: { vi: "Bàn cờ Y2K trên 2 ngón — trẻ trung, chụp ảnh rất nổi", en: "Y2K checkerboard on two nails — playful and very photogenic" } };
      if (kind === "chromefrench") return { spec: { shape, finish: "glossy" as const, pattern: "chromefrench", colors: [nude, metal, metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.bold,
        why: { vi: `Đầu French tráng gương ${COLORS[metal].vi} — đang thay French trắng, ${tone.vi} lên màu sang`, en: `Mirror ${COLORS[metal].en} chrome French — replacing the white French, luxe on ${tone.en}` } };
      if (kind === "marble") return { spec: { shape, finish: "glossy" as const, pattern: "marble", colors: ["white", "smoke", metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.bold,
        why: { vi: `Vân đá trắng gân ${COLORS[metal].vi} trên 2 ngón — sang kiểu tối giản`, en: `White marble with ${COLORS[metal].en} veins on two nails — minimal luxe` } };
      if (kind === "tortoise") return { spec: { shape, finish: "glossy" as const, pattern: "tortoise", colors: ["caramel", "chocolate", metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.bold,
        why: { vi: "Đồi mồi hổ phách — mẫu thu đông lên tay nào cũng sang", en: "Amber tortoiseshell — the autumn look that flatters every hand" } };
      return { spec: { shape, finish: "glossy" as const, pattern: kind, colors: [pick([nude, "white", "espresso"] as CK[]), "nude", metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.bold,
        why: { vi: `Nét ${COLORS[metal].vi} nổi mảnh — chi tiết nhỏ mà bắt sáng, hợp ${tone.vi}`, en: `A fine raised ${COLORS[metal].en} line — small but catches the light, suits ${tone.en}` } };
    })(),
    (() => {
      // + hoạ tiết ĐÚNG MÙA (tháng 10: Halloween · 11–12: Giáng sinh · xuân: hoa · hè: cherry)
      const seasonal = month === 10 ? (["ghost", "bats", "jackolantern", "web", "moonstars"] as const) : month >= 11 ? (["snow", "candy", "plaid", "charm3d"] as const) : month >= 3 && month <= 5 ? (["floral"] as const) : month >= 6 && month <= 8 ? (["cherry"] as const) : ([] as const);
      const kind = pick(["pearls", "droplets", "gemcluster", "chromedrops", "charm3d", "stars", "hearts", ...seasonal, ...seasonal] as const);
      if (kind === "ghost" || kind === "bats" || kind === "web" || kind === "moonstars" || kind === "jackolantern") {
        const base: CK = kind === "jackolantern" ? nude : pick(["black", "plumNoir", "aubergine", "navy"] as CK[]);
        const label = { ghost: ["ma nhỏ dễ thương", "cute little ghosts"], bats: ["dơi bạc", "silver bats"], web: ["mạng nhện tối giản", "a minimal spiderweb"], moonstars: ["trăng khuyết & sao", "a crescent moon & stars"], jackolantern: ["bí ngô mini", "mini pumpkins"] }[kind];
        return { spec: { shape, finish: "glossy" as const, pattern: kind, colors: [base, "white", kind === "moonstars" ? "gold" : "silver"] as [CK, CK, CK], style: "trend" as const }, tag: { vi: "Halloween", en: "Halloween" },
          why: { vi: `Halloween 2026 kiểu "moody luxe": ${label[0]} trên 2 ngón, nền trầm — đi làm vẫn hợp`, en: `Halloween 2026 "moody luxe": ${label[1]} on two nails over a deep base — still office-friendly` } };
      }
      if (kind === "snow" || kind === "candy" || kind === "plaid") {
        const cols: [CK, CK, CK] = kind === "snow" ? [pick(["coolBlue", "navy", "cherry"] as CK[]), "white", "silver"] : kind === "candy" ? ["white", "cherry", "gold"] : [pick(["velvet", "cherry"] as CK[]), "pine", "gold"];
        const label = { snow: ["bông tuyết", "snowflakes"], candy: ["sọc kẹo gậy", "candy-cane stripes"], plaid: ["caro tartan", "tartan"] }[kind];
        return { spec: { shape, finish: "glossy" as const, pattern: kind, colors: cols, style: "trend" as const }, tag: { vi: "Giáng sinh", en: "Christmas" },
          why: { vi: `Giáng sinh 2026: ${label[0]} trên 2 ngón — vào mùa lễ là khách hỏi`, en: `Christmas 2026: ${label[1]} on two nails — the holiday request` } };
      }
      if (kind === "floral" || kind === "cherry") {
        return { spec: { shape, finish: "glossy" as const, pattern: kind, colors: [pick(["white", "sheer", "cloudDancer"] as CK[]), kind === "floral" ? pick(["babyPink", "lavender", "coral"] as CK[]) : "cherry", metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
          why: kind === "floral" ? { vi: "Hoa nhí vẽ tay — mùa xuân là mẫu được đặt nhiều nhất", en: "Hand-painted ditsy florals — the most-booked spring look" } : { vi: "Cherry vẽ tay — dễ thương, rực rỡ mùa hè", en: "Hand-painted cherries — cute and summery" } };
      }
      const soft = pick([...t.pastel, ...t.nude] as CK[]);
      if (kind === "chromedrops") return { spec: { shape, finish: "glossy" as const, pattern: "chromedrops", colors: [pick([nude, "sheer", "pinkNude", rich] as CK[]), "white", metal === "pearl" ? "silver" : metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Giọt chrome 3D — như giọt kim loại nóng chảy, mẫu đang lên rất nhanh", en: "3D chrome blobs — like drops of molten metal, rising fast" } };
      if (kind === "charm3d") return { spec: { shape, finish: "glossy" as const, pattern: "charm3d", colors: [pick(["babyPink", "pinkNude", "sheer", soft] as CK[]), "white", "silver"] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Charm nơ bạc 3D — điểm nhấn cute kiểu Hàn, khách trẻ mê", en: "3D silver bow charms — a cute Korean-style accent loved by younger clients" } };
      if (kind === "stars") return { spec: { shape, finish: "glossy" as const, pattern: "stars", colors: [pick(["navy", "black", rich] as CK[]), "white", metal === "pearl" ? "silver" : metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Charm sao kim loại trên nền đậm — Y2K lấp lánh, đi tiệc rất hợp", en: "Metal star charms on a deep base — sparkly Y2K, perfect for a night out" } };
      if (kind === "hearts") return { spec: { shape, finish: "glossy" as const, pattern: "hearts", colors: [pick(["white", "babyPink", "sheer"] as CK[]), pick(["cherry", "hotPink"] as CK[]), metal] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Tim nhỏ vẽ tay — đáng yêu, tối giản, hợp đi học / đi làm", en: "Tiny hand-painted hearts — sweet and minimal, school- and work-friendly" } };
      if (kind === "pearls") return { spec: { shape, finish: "glossy" as const, pattern: "pearls", colors: [pick(["pinkNude", "sheer", "white", soft] as CK[]), "white", "pearl"] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Viền ngọc trai chân móng — điểm nhấn cô dâu / tiệc, nhẹ nhàng mà sang", en: "A pearl cuticle arc — bridal and party-ready, soft but luxe" } };
      if (kind === "droplets") return { spec: { shape, finish: "glossy" as const, pattern: "droplets", colors: [pick(["babyPink", "sheer", "lavender", "sky", soft] as CK[]), "white", "silver"] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Giọt nước 3D trong veo — mẫu đang viral, móng như vừa đọng sương", en: "Glassy 3D water drops — viral right now, dewy like morning mist" } };
      return { spec: { shape, finish: "glossy" as const, pattern: "gemcluster", colors: [nude, "white", "silver"] as [CK, CK, CK], style: "trend" as const }, tag: TAG.trend,
        why: { vi: "Cụm đá pha lê + ngọc trai trên 2 ngón — lấp lánh mỗi lần cử động tay", en: "A crystal-and-pearl cluster on two nails — sparkles every time you move" } };
    })(),
  ];
  return items.map((it, i) => {
    const d = buildDesign({ occasion: null, system: sys, ...it.spec } as EngineSpec, market);
    // tên trend khách hay tìm (glazed donut, micro French) thay tên kỹ thuật
    const c1 = COLORS[it.spec.colors[0]];
    const title = it.spec.finish === "chrome" && it.spec.pattern === "solid"
      ? { vi: `Glazed donut ${c1.vi}`, en: `${c1.en[0].toUpperCase()}${c1.en.slice(1)} glazed donut` }
      : it.spec.pattern === "french" ? { vi: `Micro French ${COLORS[it.spec.colors[1]].vi}`, en: `${COLORS[it.spec.colors[1]].en[0].toUpperCase()}${COLORS[it.spec.colors[1]].en.slice(1)} micro French` }
      : d.title;
    return {
      id: `${salt}-a${i}`, title, palette: d.palette, shape: d.shape, finish: d.finish, pattern: d.pattern,
      priceHint: d.priceHint, minutes: d.minutes, skills: d.skills, why: it.why, tag: it.tag,
    };
  });
}
