// BỘ MÓNG PHỐI (set composition) — mỗi móng 1 VAI, không còn "2 móng trơn + 2 móng dán cùng 1 sticker".
// Thợ nail thật làm bộ: 1 móng HERO (hoạ tiết chính đủ to), 1 móng ECHO (chi tiết NHỎ KHÁC cùng chủ đề — trăng thì sao,
// hoa to thì nụ, ma thì 2 con ma nhỏ / góc mạng nhện, cụm đá thì 1 viên lẻ, cherry thì đầu French đỏ), móng THREAD
// (kỹ thuật nối bộ nhìn rõ ở ảnh nhỏ: French đủ sâu màu phụ / French gương kim loại / nhũ loang) và móng QUIET (trơn 1
// màu trong bảng màu). Hoạ tiết lặp (chấm bi, sọc, da báo, bàn cờ…) chỉ trên ≤ 2 móng KHÔNG kề nhau, còn lại trơn.
// renderLook gọi expandSet đầu tiên → mọi nơi vẽ (kho mẫu, Thử mẫu, gợi ý 10 mẫu) đều ra bộ phối, cùng hạt giống
// look.seed → cùng kết quả.
import type { LookColors, NailOverride } from "./engine";
import { ALL_NAIL_PATTERNS, PROCEDURAL } from "./patterns";

type Role = NonNullable<NailOverride["role"]>;
type BeadPick = NonNullable<NailOverride["pick"]>;
interface Pal { c1: string; c2: string; m: string }
/** chi tiết ECHO của 1 hoạ tiết: mẫu khác (danh sách ưu tiên — mẫu mới của nhóm khác chưa có thì dùng mẫu cuối) / chọn
 *  hạt nào / cỡ / lật / dời; `colors` riêng (VD đầu French đỏ của cherry) */
interface EchoSpec { pattern?: string | string[]; pick?: BeadPick; scale?: number; mirror?: boolean; uShift?: number; tShift?: number; colors?: (p: Pal) => string[] }

const CHERRY = "#b3122e", ORANGE = "#c4541f", SLIME = "#76c427"; // SLIME = màu slime cố định của engine (lin 0.18/0.55/0.02)
const h32 = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** độ sáng L* (0–100) của mã hex — so tương phản 2 màu (đầu French trắng trên nền trắng sữa thì không thấy) */
function lstar(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 50;
  const v = parseInt(m[1], 16), ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  const Y = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
}
/** mẫu mới của nhóm khác (holly, glitterfade, fr-*…) chỉ dùng khi bộ máy đã đăng ký vẽ được; không thì mẫu dự phòng */
const has = (id: string) => PROCEDURAL.has(id);
const avail = (ids: string | string[]) => { const a = Array.isArray(ids) ? ids : [ids]; return a.find(has) ?? a[a.length - 1]; };
/** màu đỏ rõ (đỏ cherry / đỏ tim) — đầu French echo lấy đúng màu đỏ của bảng màu thay vì 1 màu đỏ cố định */
const redish = (hex: string) => { const v = parseInt(hex.replace("#", ""), 16); if (!Number.isFinite(v)) return false; const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255; return r > 130 && r > 1.8 * g && r > 1.4 * b; };
const redOf = (p: Pal) => (redish(p.c2) ? p.c2 : redish(p.m) ? p.m : CHERRY);

// ECHO theo từng hoạ tiết. Không có trong bảng: hạt (đá / hoạ tiết vẽ) tự lấy phần nhỏ (bỏ hạt to nhất) hoặc 2 bản nhỏ;
// hoạ tiết nền (in lặp) lặp lại trên móng echo (hạt giống mỗi móng khác nhau → bố cục khác)
const ECHO: Record<string, EchoSpec[]> = {
  ghost: [{ pick: "twin", scale: 0.6 }, { pattern: "web" }],
  bats: [{ pick: "rest", scale: 0.95, mirror: true }],
  jackolantern: [{ pattern: "french", colors: (p) => [p.c1, ORANGE, p.m] }, { pick: "twin", scale: 0.58 }],
  skull: [{ pattern: "web" }, { pick: "twin", scale: 0.58 }],
  mummy: [{ pattern: "web" }, { pattern: "ghost", pick: "twin", scale: 0.6 }],
  eyeball: [{ pattern: "web" }, { pick: "twin", scale: 0.62 }],
  web: [{ pattern: "bats", pick: "rest", scale: 0.9 }],
  blackcat: [{ pattern: "moonstars", pick: "first", scale: 0.8 }],
  cherry: [{ pattern: "french", colors: (p) => [p.c1, redOf(p), p.m] }],
  // sóng biển → đầu French trắng (bọt sóng); ren cô dâu → French trắng cổ điển: echo cùng chủ đề, không lặp lại hoạ tiết
  waves: [{ pattern: "french" }],
  lace: [{ pattern: "french" }],
  // slime chảy → đầu French xanh slime (đúng màu slime bộ máy vẽ) thay vì 2 móng chảy slime giống hệt nhau
  slimedrip: [{ pattern: "french", colors: (p) => [p.c1, SLIME, p.m] }],
  // hero 1 tim to vẽ tay → echo 2 tim NHỎ xếp chéo (bản cỡ gần bằng hero nhìn như dán nhầm 2 sticker)
  hearts: [{ pick: "twin", scale: 0.5, mirror: true }],
  // hoa nhí: echo = 2–3 bông nhí + 1 lá ở góc đầu móng (1 chiếc lá lẻ trơ trọi nhìn như hạt bụi xanh)
  floral: [{ pattern: "floral:echo", pick: "all" }],
  blossom: [{ pick: "second", scale: 0.95 }],
  leaf: [{ pick: "twin", scale: 0.6, mirror: true }],
  snow: [{ pick: "rest", scale: 1, mirror: true }],
  // sao lấp lánh: echo = 1 sao cắt mặt nhỏ + tia ✦ + bụi sao (bố cục "stars:echo")
  stars: [{ pattern: "stars:echo", pick: "all" }],
  moonstars: [{ pick: "rest", scale: 1.1, mirror: true }],
  // đính đá: echo = cụm 4–5 viên nhỏ ở chân móng / hàng đá tí hon ôm vòng cung chân móng (1 viên lẻ trông như hạt bụi)
  gems: [{ pattern: "gems:echo", pick: "all" }],
  gemcluster: [{ pick: "first" }],
  pearls: [{ pick: "first" }],
  charm3d: [{ pattern: "pearls", pick: "all", scale: 0.62, uShift: -0.02 }],
  droplets: [{ pick: "rest" }], droplet: [{ pick: "rest" }],
  // giọt chrome hữu cơ: echo = 3 giọt nhỏ dòng ngắn ở nửa đầu móng (bỏ giọt to của vệt chảy 6 giọt vẫn còn 5 giọt — gần bằng hero)
  chromedrops: [{ pattern: "chromedrops:echo", pick: "all" }],
  holly: [{ pattern: ["fr-candycane", "holly"], pick: "twin", scale: 0.58, colors: (p) => [p.c1, redOf(p), p.m] }],
  ornament: [{ pick: "first", scale: 0.55, mirror: true }],
  gelflower: [{ pick: "first", scale: 0.55, mirror: true }],
  tortoise: [{ pattern: ["fr-tortoise", "tortoise"] }],
  candy: [{ pattern: ["fr-candycane", "french"] }],
  // chấm bi vẽ: echo = vài chấm nhỏ ở góc đầu móng / hàng chấm tí hon ôm chân móng (bố cục riêng "dots:echo" của beadsFor)
  dots: [{ pattern: "dots:echo", pick: "all" }],
};
/** hoạ tiết in lặp: chỉ hero + echo (không kề nhau), móng còn lại trơn — chấm bi / sọc kín 4 móng nhìn như giấy dán tường */
const PRINTS = new Set(["leopard", "checker", "plaid", "polka", "stripes", "tortoise", "fawn", "marble", "foil", "lines", "chromeline", "candy"]);
/** móng trơn của bộ in lặp lấy màu PHỤ (màu chấm / đốm / ô) — như thợ làm: chấm bi trắng thì móng trơn trắng */
const QUIET_C2 = new Set(["polka", "stripes", "checker", "leopard", "plaid"]);
const SKIP = new Set(["solid", "mixmatch"]);
/** móng hero vẽ bằng hoạ tiết vẽ tay riêng thay cho lớp nền in lặp: ren trắng = mảng ren in stamping (lưới lục giác +
 *  hoa 5 cánh + viền vỏ sò, beadsFor "lace:art") — dải lưới chấm đều của lớp nền đọc ra vải lưới / giấy in lỗi */
const HERO_ART: Record<string, string> = { lace: "lace:art" };
/**
 * Thứ tự móng theo vị trí trên bàn tay (trỏ → út; đủ 5 móng: cái → út): xếp theo hình chiếu tâm móng lên phương
 * vuông góc với hướng móng trung bình, rồi lật để móng ĐẦU MÚT NHỎ NHẤT (ngón út: hẹp + ngắn nhất) nằm cuối. So diện
 * tích hw × L chứ không chỉ bề ngang — 2 móng đầu mút rộng gần bằng nhau (p063: 45 / 49px) thì bề dài phân định thêm.
 * Đã soát 10 tay kho mẫu (p067, ombre, p027: ngón út ở chỉ số 0). Thứ tự móng trong Thử mẫu là thứ tự chạm, không phải
 * thứ tự ngón → không dùng chỉ số mảng.
 */
export function nailOrder(segs: { base: { x: number; y: number }; tip: { x: number; y: number }; hw: number; L?: number }[]): number[] {
  const n = segs.length, ord = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return ord;
  let ax = 0, ay = 0;
  for (const s of segs) { const dx = s.tip.x - s.base.x, dy = s.tip.y - s.base.y, l = Math.hypot(dx, dy) || 1; ax += dx / l; ay += dy / l; }
  const key = (s: (typeof segs)[number]) => ((s.base.x + s.tip.x) / 2) * -ay + ((s.base.y + s.tip.y) / 2) * ax;
  ord.sort((a, b) => key(segs[a]) - key(segs[b]));
  const size = (s: (typeof segs)[number]) => s.hw * (s.L ?? Math.hypot(s.tip.x - s.base.x, s.tip.y - s.base.y));
  if (size(segs[ord[0]]) < size(segs[ord[n - 1]])) ord.reverse();
  return ord;
}

/**
 * Vai từng móng. look.hero / look.echo (chỉ số móng — kho mẫu truyền đúng ngón áp út / ngón trỏ của ảnh tay) thắng;
 * không có thì đoán theo vị trí (`order` trỏ → út): 4 móng hero 2 · echo 0; 5 móng hero 3 · echo 1; ≤ 3 móng hero 1.
 * Móng còn lại xếp gần hero trước (hoà thì móng xa echo trước) và xen kẽ thread / quiet.
 */
export function setRoles(n: number, look: Pick<LookColors, "hero" | "echo">, order?: number[]): { roles: Role[]; variant: number[]; hero: number; echo: number } {
  const ord = order && order.length === n ? order : Array.from({ length: n }, (_, i) => i);
  const pos = new Array<number>(n); ord.forEach((idx, p) => { pos[idx] = p; });
  const ok = (v: number | undefined): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  let hero: number, echo = -1;
  if (ok(look.hero)) {
    hero = look.hero;
    if (ok(look.echo) && look.echo !== hero) echo = look.echo;
    else if (n >= 4) { const p = pos[hero] >= 2 ? pos[hero] - 2 : pos[hero] + 2; if (p < n) echo = ord[p]; }
  } else {
    hero = ord[n <= 3 ? Math.min(1, n - 1) : n - 2];
    if (n >= 4) echo = ord[n - 4];
  }
  const roles = new Array<Role>(n).fill("quiet"), variant = new Array<number>(n).fill(0);
  roles[hero] = "hero";
  if (echo >= 0) roles[echo] = "echo";
  const rest = ord.filter((i) => i !== hero && i !== echo).sort((a, b) => {
    const d = Math.abs(pos[a] - pos[hero]) - Math.abs(pos[b] - pos[hero]);
    if (d) return d;
    return echo >= 0 ? Math.abs(pos[b] - pos[echo]) - Math.abs(pos[a] - pos[echo]) : pos[b] - pos[a];
  });
  rest.forEach((i, k) => { roles[i] = k % 2 ? "quiet" : "thread"; variant[i] = k >> 1; });
  return { roles, variant, hero, echo };
}

const isFrench = (p?: string) => !!p && (p === "french" || p === "chromefrench" || p === "doublefrench" || p.startsWith("fr-"));
/** hoạ tiết mà móng hero VẼ BẰNG màu phụ c2 (chấm, hoa, tim, sọc, đốm…) — chỉ những bộ này móng nối mới được lấy c2
 *  (đầu French hồng baby trên bộ nâu mocha charm nơ vàng: màu hồng không có ở đâu trên móng hero → nhìn như nhầm bộ) */
const C2_SHOWN = new Set(["polka", "dots", "stripes", "checker", "leopard", "plaid", "candy", "swirl", "fawn", "marble", "tortoise", "floral", "blossom", "hearts", "snow", "ornament", "milkbath", "chocodip"]);
/** họ hoạ tiết → các kỹ thuật NỐI BỘ (móng thread) thợ hay dùng cho họ đó, kèm trọng số. Nhân vật Halloween: đầu gương
 *  kim loại / nhũ; hoa, tim, cherry: micro French màu hoạ tiết / 1 hạt ngọc trai; charm kim loại, giọt chrome, sao: 1
 *  đinh tán kim loại / chrome cả móng; đá: 1 viên đá lẻ; in lặp (da báo, đồi mồi…): micro French gương vàng / chrome màu */
/** line = NGÂN SÁCH "NÉT KIM LOẠI MẢNH" chung: đầu móng gương (chromefrench nền sáng / tip:metal nền tối) HOẶC viền chỉ
 *  chân móng (cuticle:line) — 3 kỹ thuật này ở ảnh nhỏ đều đọc ra cùng 1 "viền vàng mảnh trên ngón út" (lời chê gốc của
 *  chủ tiệm), nên chung 1 trọng số chứ không cộng dồn · velvet = 1 móng nhung mắt mèo cùng màu nền (connector Pinterest
 *  hay dùng, nhất là bộ nền tối) */
type Conn = "line" | "microTip" | "glitter" | "colorChrome" | "metalChrome" | "stud" | "gemStud" | "pearlStud" | "mini" | "velvet";
const FAM_CHAR = new Set(["ghost", "bats", "jackolantern", "skull", "blackcat", "mummy", "eyeball", "web", "slimedrip"]);
const FAM_FLORAL = new Set(["floral", "blossom", "cherry", "hearts", "holly", "ornament", "snow", "gelflower", "lace", "milkbath"]);
const FAM_METAL = new Set(["stars", "moonstars", "chromedrops"]);
const FAM_GEM = new Set(["gems", "gemcluster", "pearls"]);
/** bộ "tone": 1 móng trơn màu hoạ tiết — chỉ hoạ tiết mà c2 là màu CHÍNH của hình vẽ (chấm hồng → móng hồng; vân đá /
 *  đồi mồi c2 chỉ là gân / đốm phụ → móng trơn c2 nhìn lạc bộ) */
const TONE_OK = new Set(["dots", "hearts", "floral", "blossom", "snow", "ornament", "swirl", "candy"]);
/** MINI MOTIF nối bộ theo họ hoạ tiết (lib/tryon/engine beadsFor "mini:*"): 1 sao cắt mặt nhỏ (đêm Halloween, sao, Giáng
 *  sinh) · 1 lá phong kim loại nhỏ (lá) · cụm 3 chấm nhỏ dần màu c2 (chấm bi, hoa, tim — chỉ khi c2 có trên hero) · nơ
 *  nhỏ (charm nơ: bộ coquette 2 cỡ nơ — sao vàng cạnh nơ hồng là lạc đề) · cherry / ren / giọt chrome (đinh tán kim loại
 *  đã là "giọt" lẻ): không có mini hợp chủ đề */
const MINI: Record<string, string | null> = { leaf: "mini:leaf", dots: "mini:dots", floral: "mini:dots", hearts: "mini:dots", blossom: "mini:dots", milkbath: "mini:dots", charm3d: "mini:bow", cherry: null, lace: null, gelflower: null, chromedrops: null, droplets: null, droplet: null };
const miniFor = (pat: string, c2ok: boolean) => { const m = pat in MINI ? MINI[pat] : "mini:star"; return m === "mini:dots" && !c2ok ? null : m; };
function connWeights(pat: string): Partial<Record<Conn, number>> {
  // (vòng 2b) chrome màu cả móng từng chiếm 47% móng nối → hạ còn ~15%; rồi đầu micro chrome nền tối + viền chỉ chân móng
  // lại thành 34% (41% kể cả French gương) — vẫn 1 công thức "viền kim loại mảnh". Giờ mỗi họ ~10 điểm trọng số, nét kim
  // loại mảnh (line) 1–2 điểm (≤ ~20%), nền tối còn ×0.6 (threadFor) → không kỹ thuật nào quá ~25%.
  // lá phong vàng: nhũ vàng đầu móng / lá phong nhỏ / nhung; giọt nước (trong suốt): chrome tráng ngọc trai, 1 hạt ngọc
  // trai, nhũ — KHÔNG kim loại nào (đầu gương / viền vàng trên bộ giọt nước là lạc đề)
  if (pat === "leaf") return { glitter: 2, mini: 2, line: 1.5, colorChrome: 1.5, velvet: 1.5, stud: 1 };
  if (pat === "droplets" || pat === "droplet") return { colorChrome: 2.5, pearlStud: 1.5, glitter: 1.5 };
  // charm nơ (coquette): chrome ngọc trai (glazed) · nơ nhỏ · ngọc trai · đầu gương — không sao / đinh tán
  if (pat === "charm3d") return { colorChrome: 2.5, mini: 2, pearlStud: 1.5, line: 1.5, glitter: 1.5, velvet: 1 };
  if (FAM_CHAR.has(pat)) return { glitter: 2, velvet: 2, mini: 2, line: 1.5, colorChrome: 1.5, stud: 1 };
  if (FAM_FLORAL.has(pat)) return { microTip: 2.5, pearlStud: 2, line: 1.5, colorChrome: 1.5, mini: 1, glitter: 1, velvet: 0.5 };
  if (FAM_METAL.has(pat)) return { stud: 2, mini: 1.5, line: 1.5, metalChrome: 1.5, colorChrome: 1.5, glitter: 1.5, velvet: 1 };
  if (FAM_GEM.has(pat)) return pat === "pearls" ? { pearlStud: 2.5, colorChrome: 2, glitter: 2, line: 1.5, velvet: 1.5 } : { gemStud: 2.5, colorChrome: 2, glitter: 2, line: 1.5, velvet: 1.5, metalChrome: 0.5 };
  if (pat === "dots") return { microTip: 3, mini: 2, colorChrome: 1.5, pearlStud: 1, line: 1, glitter: 1, velvet: 0.5 };
  if (PRINTS.has(pat)) return { line: 2, colorChrome: 2, microTip: 1.5, glitter: 1.5, velvet: 1.5, stud: 1, metalChrome: 0.5 };
  return { colorChrome: 2, glitter: 2, line: 1.5, velvet: 1.5, stud: 1, mini: 1 };
}
/**
 * Móng THREAD: 1 kỹ thuật nối bộ theo HỌ hoạ tiết (connWeights), chỉ dùng màu đã có trên móng hero (nền c1 / kim loại;
 * c2 chỉ khi hoạ tiết vẽ bằng c2). Họ French (đầu gương, micro French) dựng nền gel hồng TRONG → chỉ trên nền SÁNG
 * (L* ≥ 62): navy / đen qua lớp gel trong ra tím xám như móng bẩn. Nhũ loang nằm ở ĐẦU móng (nhũ ở chân móng ở ảnh nhỏ
 * nhìn như móng mọc dài / bụi bẩn) — chân móng chỉ ~1/4 lần nhũ trên nền tối. Echo đã là French thì thread không French.
 * Đầu gương / đầu micro chrome / viền chỉ chân móng chung 1 ngân sách "nét kim loại mảnh" (≤ ~20% móng nối).
 * Biến thể k: móng thread thứ 2 (bộ 5 móng) lấy kỹ thuật khác móng thứ nhất.
 */
function threadFor(pal: Pal, seed: number, k: number, avoidFrench: boolean, pat = ""): NailOverride {
  const L1 = lstar(pal.c1), Lm = lstar(pal.m), light = L1 >= 62;
  const c2ok = C2_SHOWN.has(pat) && Math.abs(L1 - lstar(pal.c2)) >= 25 && pal.c2.toLowerCase() !== pal.m.toLowerCase();
  const w = connWeights(pat), opts: [NailOverride, number][] = [];
  const add = (c: Conn, o: NailOverride | null, k = 1) => { if (o && w[c]) opts.push([o, w[c]! * k]); };
  const cs = [pal.c1, pal.c2, pal.m];
  // NÉT KIM LOẠI MẢNH (1 ngân sách): đầu móng gương — nền SÁNG = French gương gel trong, nền TỐI = đầu micro chrome ĐẶC phủ
  // lên sơn nền (không dựng gel hồng trong) — hoặc viền chỉ kim loại chân móng (~1/3). Nền tối ×0.6: navy / nâu + viền vàng
  // từng là 35% móng nối nền tối. Echo đã là French thì không lặp đầu móng; kim loại sát độ sáng nền thì nét không đọc được
  const tipOk = !avoidFrench && Math.abs(L1 - Lm) >= 10, cutOk = Math.abs(L1 - Lm) >= 12;
  const lineO: NailOverride | null = tipOk && (!cutOk || h32(seed, 74) < 0.65) ? { pattern: light ? "chromefrench" : "tip:metal", colors: cs } : cutOk ? { pattern: "cuticle:line", colors: cs } : null;
  add("line", lineO, light ? 1 : 0.6);
  // đầu micro màu c2 (chỉ khi hoạ tiết vẽ bằng c2): nền sáng = micro French, nền tối = đầu micro sơn ĐẶC · kim loại không
  // đọc được trên nền thì viền chỉ chân móng màu c2 thay chỗ
  if (c2ok) add("microTip", !avoidFrench ? (light ? { pattern: avail(["fr-micro", "french"]), colors: cs } : { pattern: "tip:paint", colors: cs }) : { pattern: "cuticle:paint", colors: cs });
  add("glitter", has("glitterfade") ? { pattern: "glitterfade", colors: [pal.c1, pal.m, pal.m], finish: "glitter", fade: !light && h32(seed, 73) < 0.15 ? "cuticle" : "tip" } : null);
  // chrome màu: nền sáng = glazed ngọc trai — đẹp nhưng dễ thành 30% móng nối của bộ nền sáng → ×0.8
  add("colorChrome", has("colorchrome") ? { pattern: "colorchrome", colors: [pal.c1, pal.c1, pal.m], finish: "chrome" } : null, light ? 0.8 : 1);
  add("metalChrome", { pattern: "solid", colors: [pal.m, pal.m, pal.m], finish: "chrome" });
  add("stud", { pattern: "stud:metal", colors: cs });
  add("gemStud", { pattern: "stud:gem", colors: cs });
  // ngọc trai trắng trên nền trắng sữa / trắng (L* > 85) gần như biến mất → bỏ
  add("pearlStud", L1 > 85 ? null : { pattern: "stud:pearl", colors: cs });
  // NHUNG mắt mèo cùng màu nền: nền tối (navy, rượu vang, nâu, đen) ánh nhung rõ nhất → ×1.5; nền rất sáng (trắng sữa)
  // ánh nhung gần như mất → bỏ
  add("velvet", L1 > 80 ? null : { pattern: "velvet", colors: [pal.c1, pal.c1, pal.m], finish: "cateye" }, light ? 1 : 1.5);
  const mini = miniFor(pat, c2ok);
  add("mini", mini ? { pattern: mini, colors: cs } : null);
  if (!opts.length) return { pattern: "solid", colors: [pal.m, pal.m, pal.m], finish: "chrome" };
  // chọn theo trọng số; móng thread thứ 2 (k) bỏ kỹ thuật móng thứ nhất đã dùng
  const pickW = (r: number, skip = -1) => { const tot = opts.reduce((a, [, x], i) => a + (i === skip ? 0 : x), 0); let acc = 0; for (let i = 0; i < opts.length; i++) { if (i === skip) continue; acc += opts[i][1] / tot; if (r < acc) return i; } return opts.length - 1 === skip ? 0 : opts.length - 1; };
  const first = pickW(h32(seed, 71));
  return opts[k && opts.length > 1 ? pickW(h32(seed, 72 + k), first) : first][0];
}

/** BỘ THEO CHỦ ĐỀ (mix-*): mỗi móng 1 chi tiết khác nhau cùng 1 bảng màu (3 màu + 1 kim loại) — như bộ thợ vẽ thật */
type Theme = (p: Pal & { dark: string; light: string }, r: number) => Partial<Record<Role, NailOverride>>;
const THEMES: Record<string, Theme> = {
  "mix-halloween": ({ dark, light, m }, r) => {
    const v = Math.floor(r * 4);
    // dơi / mèo đen (hoạ tiết tối) nằm trên nền sáng; ma / bí ngô (sáng) trên nền tối. Nền xen kẽ như bộ Halloween thật
    // (đen – cam – đen – cam): echo cùng nền với hero (A), quiet + thread nền còn lại (B) — 2 móng kề nhau khác nền
    const A = v === 0 || v === 2 ? dark : light, B = A === dark ? light : dark;
    const hero: NailOverride[] = [
      { pattern: "ghost", colors: [dark, light, m] },
      { pattern: "bats", colors: [light, dark, dark] },
      { pattern: "jackolantern", colors: [dark, light, m] },
      { pattern: "blackcat", colors: [light, dark, m] },
    ];
    const echo: NailOverride[] = [
      { pattern: "ghost", pick: "twin", scale: 0.6, colors: [dark, light, m] },
      { pattern: "bats", pick: "rest", mirror: true, colors: [light, dark, dark] },
      { pattern: "french", colors: [dark, light, m] },
      { pattern: "moonstars", pick: "first", scale: 0.8, colors: [light, dark, m] },
    ];
    return {
      hero: hero[v], echo: echo[v],
      thread: has("glitterfade") ? { pattern: "glitterfade", colors: [B, m, m], finish: "glitter" } : v === 2 ? { pattern: "solid", colors: [m, m, m], finish: "chrome" } : { pattern: "chromefrench", colors: [B, A, m] },
      quiet: { pattern: "solid", colors: [B, A, m] },
    };
  },
  "mix-christmas": ({ dark, light, m }, r) => {
    const v = r < 0.5 ? 0 : 1;
    const hero = v === 0
      ? (has("holly") ? { pattern: "holly", colors: [light, dark, m] } : { pattern: "snow", colors: [dark, light, m] })
      : (has("ornament") ? { pattern: "ornament", colors: [light, dark, m] } : { pattern: "stars", colors: [dark, light, m] });
    return {
      hero,
      echo: { pattern: avail(["fr-candycane", "french"]), colors: [light, dark, m] },
      thread: has("glitterfade") ? { pattern: "glitterfade", colors: [light, m, m], finish: "glitter" } : { pattern: "solid", colors: [m, m, m], finish: "chrome" },
      quiet: { pattern: "velvet", colors: [dark, light, m], finish: "cateye" },
    };
  },
  "mix-valentine": ({ dark, light, m }) => ({
    hero: { pattern: "hearts", colors: [light, dark, m] },
    echo: { pattern: "french", colors: [light, dark, m] },
    thread: { pattern: "polka", colors: [light, dark, m] },
    quiet: { pattern: "solid", colors: [dark, light, m] },
  }),
  "mix-fall": ({ dark, light, m }) => ({
    // lá THU vẽ tay nhiều màu (mẫu "leaf" riêng giờ là lá phong KIM LOẠI theo tên mẫu)
    hero: { pattern: "leaf:autumn", colors: [dark, light, m] },
    echo: { pattern: avail(["fr-tortoise", "tortoise"]), colors: [light, dark, m] },
    thread: has("colorchrome") ? { pattern: "colorchrome", colors: [light, light, m], finish: "chrome" } : { pattern: "solid", colors: [light, light, m], finish: "chrome" },
    quiet: { pattern: "solid", colors: [dark, light, m] },
  }),
  "mix-newyear": ({ dark, light, m }, r) => {
    const v = r < 0.5 ? 0 : 1;
    return {
      hero: { pattern: v ? "gemcluster" : "stars", colors: [dark, light, m] },
      echo: v ? { pattern: "gemcluster", pick: "first", colors: [dark, light, m] } : { pattern: "stars", pick: "rest", mirror: true, colors: [dark, light, m] },
      thread: has("glitterfade") ? { pattern: "glitterfade", colors: [dark, m, m], finish: "glitter" } : { pattern: "solid", colors: [m, m, m], finish: "chrome" },
      quiet: { pattern: "solid", colors: [light, dark, m] },
    };
  },
};
export const THEME_SETS = Object.keys(THEMES);

/**
 * Mẫu chung → bộ móng phối (look.nails theo vai). Giữ nguyên khi: đã có nails do nơi gọi tự ghép, hoạ tiết phủ mọi móng
 * (French, ombre, thạch…), sơn trơn / mix màu, hoạ tiết SVG ngoài bộ máy. Chấm bi + mắt mèo: 2 móng hero + echo chấm
 * lưới đều, còn lại mắt mèo trơn.
 */
export function expandSet(look: LookColors, n: number, order?: number[]): LookColors {
  if (n <= 0 || look.nails?.some(Boolean)) return look;
  const pat = look.pattern, theme = THEMES[pat];
  if (!theme) {
    // CHẤM BI MẮT MÈO (trend "polka dot cat eye"): đúng 2 móng điểm nhấn hero + echo (không kề nhau) chấm LƯỚI SO LE ĐỀU kín
    // móng (beadsFor "polka:cat"), các móng còn lại MẮT MÈO TRƠN — mắt mèo là nền, chấm là điểm nhấn. Chấm rải ngẫu nhiên
    // 3 cỡ trên cả 4 móng đọc ra tuyết rơi / sơn văng; chấm thưa dồn nửa đầu móng đọc ra mặt xúc xắc / chữ nổi
    if (pat === "polka" && look.finish === "cateye") {
      const { roles, hero, echo } = setRoles(n, look, order);
      // pick "all": echo giữ NGUYÊN lưới (mặc định của echo bỏ chấm to nhất + kẹp hàng ngoài u 0.92 → chấm chồng ở đầu móng)
      const nails = roles.map((role): NailOverride => (role === "hero" || role === "echo" ? { role, art: true, pattern: "polka:cat", pick: "all" } : { role: "quiet", art: false, pattern: "solid" }));
      return { ...look, nails, hero, echo: echo >= 0 ? echo : undefined };
    }
    // họ French (fr-*) luôn phủ cả bộ, kể cả biến thể mới chưa kịp ghi vào ALL_NAIL_PATTERNS
    if (SKIP.has(pat) || ALL_NAIL_PATTERNS.has(pat) || pat.startsWith("fr-") || !(PROCEDURAL.has(pat) || ECHO[pat] || PRINTS.has(pat))) return look;
  }
  const cs = look.colors.length ? look.colors : ["#ec4899"];
  const pal: Pal = { c1: cs[0], c2: cs[1] ?? cs[0], m: cs[2] ?? (cs.length > 1 ? cs[cs.length - 1] : "#d4af37") };
  const { roles, variant, hero, echo } = setRoles(n, look, order);
  const seed = look.seed | 0;
  const nails: NailOverride[] = new Array(n);
  if (theme) {
    const L1 = lstar(pal.c1), L2 = lstar(pal.c2);
    const t = theme({ ...pal, dark: L1 <= L2 ? pal.c1 : pal.c2, light: L1 <= L2 ? pal.c2 : pal.c1 }, h32(seed, 3));
    for (let i = 0; i < n; i++) {
      const role = roles[i], base = t[role] ?? { pattern: "solid" };
      let o: NailOverride = { ...base };
      // bộ 5 móng: móng thread / quiet thứ 2 khác móng thứ nhất (không 2 móng y hệt)
      if (variant[i] && role === "thread") o = threadFor(pal, seed, variant[i], isFrench(t.echo?.pattern));
      if (variant[i] && role === "quiet") o = { pattern: "solid", colors: [o.colors?.[0] === pal.c1 ? pal.c2 : pal.c1] };
      nails[i] = { ...o, role, art: o.pattern !== "solid" };
    }
    return { ...look, nails, hero, echo: echo >= 0 ? echo : undefined };
  }
  const specs = ECHO[pat];
  const es = specs?.length ? specs[Math.floor(h32(seed, 5) * specs.length)] : undefined;
  const echoOv: NailOverride = { pattern: es?.pattern ? avail(es.pattern) : pat, pick: es?.pick, scale: es?.scale, mirror: es?.mirror ?? true, uShift: es?.uShift, tShift: es?.tShift, colors: es?.colors?.(pal) };
  // KIỂU BỘ theo hạt giống (không phải bộ nào cũng "hero + echo + 1 móng lạ + 1 móng trơn" — 4 kỹ thuật trên 4 móng nhìn
  // như bảng mẫu màu, không phải bộ Pinterest): accent = 2 móng hoạ tiết + còn lại trơn màu nền (bộ tiệm làm nhiều nhất) ·
  // tone = 1 móng trơn màu hoạ tiết (chấm hồng → 1 móng hồng đậm) + còn lại màu nền · thread = có 1 móng kỹ thuật nối bộ
  const rT = h32(seed, 9), c2Tone = TONE_OK.has(pat) && Math.abs(lstar(pal.c1) - lstar(pal.c2)) >= 20;
  const tmpl = rT < 0.28 ? "accent" : rT < 0.45 && c2Tone ? "tone" : "thread";
  for (let i = 0; i < n; i++) {
    const role = roles[i];
    // móng hero GIỮ màu nền của bộ (ren trên nền nude đậm hơn 3 móng kia = 2 lọ sơn khác nhau, nhìn lạc bộ) — ren trên nền
    // rất sáng tự lấy TRẮNG tinh + nét đặc hơn (paintOps "lacework") để vẫn đọc được
    if (role === "hero") nails[i] = { role, pattern: HERO_ART[pat] ?? pat, art: true };
    else if (role === "echo") nails[i] = { ...echoOv, role, art: true };
    else if (role === "thread" && tmpl === "thread") nails[i] = { ...threadFor(pal, seed, variant[i], isFrench(echoOv.pattern), pat), role, art: true };
    else {
      // móng trơn: màu nền (hoạ tiết vẽ) / màu phụ (bộ in lặp, xen kẽ); đồi mồi: thạch hổ phách như thợ làm. q = thứ tự
      // móng trơn tính từ móng gần hero (bộ không có móng nối: cả móng thread cũng thành móng trơn)
      const q = tmpl === "thread" ? variant[i] : role === "thread" ? 2 * variant[i] : 2 * variant[i] + 1;
      // bộ in lặp: xen kẽ c2 / c1; hoạ tiết vẽ: màu nền (móng trơn thứ 2 của bộ 5 móng lấy c2 chỉ khi hoạ tiết vẽ bằng c2)
      const c2First = QUIET_C2.has(pat), alt = q % 2 === 1;
      const qc = tmpl === "tone" ? (q === 0 ? pal.c2 : pal.c1) : c2First ? (alt ? pal.c1 : pal.c2) : alt && C2_SHOWN.has(pat) ? pal.c2 : pal.c1;
      nails[i] = pat === "tortoise" && !alt ? { role: "quiet", pattern: "jelly", colors: [pal.c1, pal.c2, pal.m], art: true } : { role: "quiet", pattern: "solid", colors: [qc, pal.c2, pal.m], art: false };
    }
  }
  return { ...look, nails, hero, echo: echo >= 0 ? echo : undefined };
}

// ---------------------------------------------------------------- hạt (đá / hoạ tiết vẽ) theo vai của móng
type BeadLike = { u: number; t: number; r: number; kind: string; rot?: number };
/** khối 3D GẮN (đá, ngọc trai, chấm, charm nơ): 1 viên lẻ đặt ở CHÂN móng; không được cắt ngang bởi mép móng */
const STONE = new Set(["gem", "pearl", "dot", "bow"]);
const SOLID3D = new Set(["gem", "pearl", "dot", "bow", "drop", "mdrop", "star", "fstar", "blob", "eye"]);
/** cỡ tối thiểu (đơn vị nửa bề ngang móng) để chi tiết nhỏ vẫn đọc được ở ảnh kho mẫu (móng hw 31–56px) */
const FLOOR: Record<string, number> = { gem: 0.11, pearl: 0.11, dot: 0.1, drop: 0.12, mdrop: 0.12, star: 0.16, fstar: 0.16, blob: 0.12, heart: 0.16, bow: 0.4, eye: 0.3, pdot: 0.07, ditsy: 0.15, sparkle: 0.1, mleaf: 0.28 };
const LU = 2.8; // chiều dài móng ≈ 2.8 lần nửa bề ngang → đổi bán kính sang đơn vị dọc móng

/**
 * Áp vai / cỡ / lật / dời của móng (NailOverride) lên bộ hạt của hoạ tiết. ECHO lấy chi tiết NHỎ KHÁC: `rest` = bỏ hạt
 * to nhất (trăng+sao → chỉ sao, dơi to+2 dơi nhỏ → 2 dơi nhỏ), `first` = 1 viên to nhất thu nhỏ (cụm đá → 1 viên lẻ ở
 * chân móng), `second` = hạt to thứ 2 (hoa to → 1 nụ), `twin` = 2 bản nhỏ xếp chéo về góc đầu móng (ma → 2 con ma
 * nhỏ). Mặc định của echo: toàn đá → first; ≥ 2 hạt → rest; 1 hạt → twin.
 */
export function applyBeadOpts<B extends BeadLike>(beads: B[], ov?: NailOverride | null): B[] {
  if (!ov || !beads.length) return beads;
  const echo = ov.role === "echo";
  let pick: BeadPick = ov.pick ?? (echo ? (beads.every((b) => STONE.has(b.kind)) ? "first" : beads.length > 1 ? "rest" : "twin") : "all");
  if (pick === "rest" && beads.length < 2) pick = "twin";
  if (pick === "second" && beads.length < 2) pick = "first";
  const single = pick === "first" || pick === "second" || pick === "twin";
  if (pick === "all" && !ov.scale && !ov.mirror && !ov.uShift && !ov.tShift) return beads;
  const byR = [...beads].sort((a, b) => b.r - a.r);
  const sel = pick === "rest" ? byR.slice(1) : pick === "first" || pick === "twin" ? [byR[0]] : pick === "second" ? [byR[1]] : beads;
  const stone = sel.every((b) => STONE.has(b.kind));
  // 1 viên lẻ ×0.78 (viên to nhất cụm 0.33 → 0.26 hw ≈ 8–15px): ×0.62 cũ chỉ còn 1 chấm sáng ~6px ở ảnh kho mẫu, nhìn
  // như hạt bụi chứ không ra viên đá đính; vẫn nhỏ hơn hẳn cụm của hero
  const sc = ov.scale ?? (pick === "twin" ? 0.6 : single ? (stone ? 0.78 : 0.7) : 1);
  const sg = ov.mirror ? -1 : 1, du = ov.uShift ?? 0, dt = ov.tShift ?? 0;
  const sized = (b: B, k = 1) => Math.max(sc * k < 1 ? FLOOR[b.kind] ?? 0.3 : 0, b.r * sc * k);
  let out: B[];
  if (single) {
    const b = sel[0];
    if (pick === "twin") {
      // 2 bản nhỏ xếp chéo (giữa móng lệch 1 bên → gần đầu móng lệch bên kia), nghiêng khác nhau như vẽ tay
      out = [{ ...b, u: 0.5, t: -0.3 * sg, r: sized(b), rot: (b.rot ?? 0) + 0.35 * sg }, { ...b, u: 0.76, t: 0.32 * sg, r: sized(b, 0.8), rot: (b.rot ?? 0) - 0.3 * sg }];
    } else out = [stone ? { ...b, u: 0.22, t: 0, r: sized(b) } : { ...b, u: 0.64, t: 0.3 * sg, r: sized(b), rot: (b.rot ?? 0) * sg }];
    out = out.map((x) => ({ ...x, u: x.u + du, t: x.t + dt }));
  } else {
    // giữ bố cục nhóm, thu / phóng quanh tâm nhóm, lật ngang qua giữa móng
    const cu = sel.reduce((a, b) => a + b.u, 0) / sel.length, ct = sel.reduce((a, b) => a + b.t, 0) / sel.length;
    out = sel.map((b) => ({ ...b, u: cu + (b.u - cu) * sc + du, t: sg * (ct + (b.t - ct) * sc) + dt, r: sized(b), rot: (b.rot ?? 0) * sg }));
  }
  // khối 3D (đá, giọt, charm) nằm trọn trong móng; hoạ tiết vẽ được tràn mép 1 chút (như vẽ tay)
  return out.map((b) => {
    const lim = SOLID3D.has(b.kind) ? Math.max(0, 0.9 - b.r) : Math.max(0, 1.05 - 0.5 * b.r), ru = b.r / LU;
    const u0 = SOLID3D.has(b.kind) ? 0.1 + ru : 0.12, u1 = SOLID3D.has(b.kind) ? 0.9 - ru : 0.92;
    return { ...b, t: Math.max(-lim, Math.min(lim, b.t)), u: Math.max(u0, Math.min(Math.max(u0, u1), b.u)) };
  });
}

