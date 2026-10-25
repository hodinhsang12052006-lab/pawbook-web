// ẢNH MẪU NAIL DO MÁY PAWNAIL TỰ VẼ (không gọi AI vẽ ảnh): mỗi mẫu trong kho "Mẫu nail" được vẽ lên 1 ẢNH TAY THẬT
// bằng chính bộ máy Thử mẫu (lib/tryon) — giải phẫu tay đúng (không 6 móng, không ngón mọc lơ lửng như ảnh AI vẽ cả
// bàn tay), da / ánh sáng / phản chiếu thật, và hoạ tiết ĐÚNG mô tả (bàn cờ ra bàn cờ, French đôi ra French đôi).
// Bộ móng đắp (Gel-X / bột) vẽ dài ra theo đúng dáng mẫu (hạnh nhân, coffin…).
// Chỉ dùng cho hoạ tiết bộ máy tự vẽ được (PROCEDURAL); hoạ tiết hình (ma, bí ngô…) vẫn dùng đường vẽ cũ.
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fitNail, rasterNail, renderLook, type Img, type Shape, type NailModel } from "@/lib/tryon/engine";
import { PROCEDURAL } from "@/lib/tryon/patterns";
import { lookColors, cropBox } from "@/lib/studio";
import { SITE_URL } from "@/lib/siteUrl";

/** Ảnh tay mẫu (public/hands) + điểm chạm gốc → đầu từng móng (đã soát bằng mắt ở cỡ thật). */
// long: tay có móng thật DÀI sẵn (đắp thêm 1 chút vẫn tự nhiên); tay móng ngắn chỉ dùng cho mẫu sơn gel móng thật —
// móng hướng lên nền phía sau mà đắp dài 1.4× thì nhìn như giấy dán (soi bằng mắt 25/10)
// box: khung vuông [x, y, cạnh] cắt riêng cho tay đó (né móng ngón khác lấp ló ở mép);
// phần đắp dài lọt ra ngoài khung thì tự tính khung như cũ.
// p*.jpg: ảnh minh hoạ PawNail cũ (bàn tay đúng giải phẫu, nền / tư thế đa dạng) làm TAY MẪU — máy vẽ lại toàn bộ móng
// lên đó; chỉ giữ tay mà mọi móng trong khung đều sơn lại được (đầu French đen, đá 3D, móng nude sát màu da → loại).
// Chỉ 5 tay thì kho mẫu lặp bố cục liên tục (3/6 ô liền nhau cùng 1 bàn tay — soi trang /designs 25/10).
// deco: móng trong ảnh gốc có hoạ tiết (lá, sao, chỉ khâu) — sơn đặc che kín, nhưng sơn THẠCH trong để lộ mờ → bỏ qua
export const HANDS: { file: string; long: boolean; marks: [[number, number], [number, number]][]; box?: [number, number, number]; deco?: boolean }[] = [
  { file: "pink.jpg", long: true, marks: [[[315, 458], [313, 302]], [[452, 430], [455, 266]], [[568, 488], [578, 320]], [[683, 616], [690, 480]]] },
  { file: "hand.jpg", long: false, marks: [[[272, 425], [272, 322]], [[385, 430], [380, 312]], [[505, 422], [500, 308]], [[618, 400], [615, 310]]] },
  { file: "olive.jpg", long: true, marks: [[[222, 318], [222, 486]], [[370, 346], [366, 540]], [[494, 392], [482, 588]], [[708, 396], [701, 534]]] },
  { file: "ombre.jpg", long: false, marks: [[[264, 438], [272, 330]], [[402, 420], [412, 292]], [[538, 414], [545, 282]], [[657, 450], [668, 322]]] },
  { file: "white.jpg", long: true, marks: [[[313, 392], [315, 532]], [[430, 375], [430, 518]], [[550, 397], [548, 528]], [[662, 438], [648, 548]]] },
  { file: "p021.jpg", long: false, deco: true, marks: [[[252, 366], [246, 550]], [[421, 395], [413, 592]], [[563, 446], [541, 661]], [[805, 443], [790, 603]]], box: [130, 130, 800] },
  { file: "p025.jpg", long: false, marks: [[[316, 480], [316, 369]], [[440, 487], [440, 363]], [[579, 487], [579, 363]], [[702, 465], [702, 369]]] },
  { file: "p027.jpg", long: false, marks: [[[310, 500], [318, 372]], [[468, 478], [472, 328]], [[612, 468], [612, 318]], [[750, 512], [762, 366]]] },
  { file: "p063.jpg", long: true, marks: [[[177, 382], [89, 550]], [[309, 524], [192, 704]], [[426, 645], [309, 806]], [[543, 714], [433, 865]]] },
  { file: "p067.jpg", long: true, marks: [[[212, 568], [208, 398]], [[398, 515], [392, 300]], [[578, 509], [571, 263]], [[724, 639], [749, 424]]], box: [100, 110, 760] },
];

export const canRenderPattern = (pattern: string) => PROCEDURAL.has(pattern);

const hashOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

const handCache = new Map<string, Img>();
async function loadHand(file: string): Promise<Img> {
  const hit = handCache.get(file);
  if (hit) return hit;
  let buf: Buffer;
  try {
    buf = await readFile(path.join(process.cwd(), "public", "hands", file));
  } catch {
    // máy chủ serverless không kèm thư mục public → tải từ chính trang
    const r = await fetch(`${SITE_URL}/hands/${file}`);
    if (!r.ok) throw new Error(`Không tải được ảnh tay mẫu ${file} (${r.status})`);
    buf = Buffer.from(await r.arrayBuffer());
  }
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img: Img = { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
  handCache.set(file, img);
  return img;
}

export interface RenderableDesign { id: string; palette: string[]; shape: string; finish: string; pattern: string; skills: string[] }

const isExt = (d: RenderableDesign) => d.skills.some((s) => /gel-?x|bột|acrylic/i.test(s));
/** Dáng móng đắp → tỉ lệ DÀI / RỘNG của cả bộ móng sau khi đắp (đo trên ảnh bộ móng đắp thật). */
const EXT_ASPECT: Record<Shape, number> = { stiletto: 2.6, almond: 2.15, coffin: 2.2, square: 1.75, oval: 1.85 };
/**
 * Bộ đắp (Gel-X / bột) → trên tay móng dài sẵn, đắp tới đúng tỉ lệ của dáng; sơn gel → giữ móng thật.
 * Hệ số đắp tính theo móng THẬT của tay mẫu: móng ngắn rộng cần đắp nhiều (×1.5 mới ra móng nhọn — ngắn quá thành
 * cái chóp tam giác cụt trên móng vuông), móng đã dài sẵn chỉ đắp chút (đắp ×1.5 lên móng coffin dài = móng vuốt).
 */
function lengthFor(d: RenderableDesign, models: NailModel[]): { lengthFactor: number; shape?: Shape } {
  if (!isExt(d)) return { lengthFactor: 1 };
  const shape = (["almond", "coffin", "square", "oval", "stiletto"].includes(d.shape) ? d.shape : "almond") as Shape;
  const asp = models.map((m) => (m.fit.s1 - m.fit.s0) / Math.max(1, 2 * m.fit.hw)).sort((a, b) => a - b)[models.length >> 1] || 1.6;
  return { lengthFactor: Math.min(1.6, Math.max(1.08, EXT_ASPECT[shape] / asp)), shape };
}

/** Tay mẫu cho 1 mẫu + biến thể (ổn định: cùng mẫu, cùng biến thể → cùng tay). Bộ đắp chỉ trên tay móng dài. */
export function pickHand(d: RenderableDesign, variant = 0): (typeof HANDS)[number] {
  const sheer = d.pattern === "jelly" || d.pattern === "milkbath";
  const pool = HANDS.filter((x) => (!isExt(d) || x.long) && !(sheer && x.deco));
  return pool[hashOf(`${d.id}:${variant}`) % pool.length];
}

/** Biến thể đầu tiên (từ `from`) cho ra tay CHƯA dùng trong lượt — 6 mẫu 1 lượt không lặp cùng 1 bàn tay. */
export function spreadVariant(d: RenderableDesign, used: Set<string>, from = 0): number {
  for (let v = from; v < from + 12; v++) if (!used.has(pickHand(d, v).file)) return v;
  return from;
}

/**
 * Vẽ 1 mẫu lên ảnh tay mẫu → JPEG vuông 1024px. `variant` đổi tay / lật ngang (nút "Vẽ lại" của admin ra ảnh khác).
 */
export async function renderDesignImage(d: RenderableDesign, variant = 0): Promise<{ mimeType: "image/jpeg"; base64: string; hand: string }> {
  if (!canRenderPattern(d.pattern)) throw new Error(`Hoạ tiết "${d.pattern}" chưa vẽ được bằng máy PawNail.`);
  const h = hashOf(`${d.id}:${variant}`);
  const hand = pickHand(d, variant);
  const img = await loadHand(hand.file);
  const marks = hand.marks.map(([b, t]) => ({ base: { x: b[0], y: b[1] }, tip: { x: t[0], y: t[1] } }));
  const models = marks.map((m) => fitNail(img, m));
  const opts = lengthFor(d, models);
  const segs = models.map((m) => rasterNail(img, m, opts));
  segs.forEach((s, i) => { s.accent = i === 1 || i === 2; });
  const look = lookColors({ id: d.id, title: { vi: "", en: "" }, palette: d.palette, shape: d.shape as never, finish: d.finish as never, pattern: d.pattern, priceHint: "", minutes: 0, skills: d.skills });
  const out = renderLook(img, segs, look);
  // khung vuông quanh các móng (kể cả phần đắp dài) — thấy rõ bộ móng, vẫn còn ngón tay cho tự nhiên
  const tips = marks.map((m) => { const k = opts.lengthFactor; return { base: m.base, tip: { x: m.base.x + (m.tip.x - m.base.x) * k, y: m.base.y + (m.tip.y - m.base.y) * k } }; });
  const inBox = (b: [number, number, number]) => tips.every((m) => m.tip.x >= b[0] + 12 && m.tip.x <= b[0] + b[2] - 12 && m.tip.y >= b[1] + 12 && m.tip.y <= b[1] + b[2] - 12);
  const box = hand.box && inBox(hand.box) ? { x: hand.box[0], y: hand.box[1], size: hand.box[2] } : cropBox(tips, img.w, img.h, 0.42);
  const left = Math.max(0, Math.round(box.x)), top = Math.max(0, Math.round(box.y));
  const size = Math.min(Math.round(box.size), img.w - left, img.h - top);
  let pipe = sharp(Buffer.from(out.data.buffer, out.data.byteOffset, out.data.length), { raw: { width: out.w, height: out.h, channels: 4 } })
    .extract({ left, top, width: size, height: size })
    .resize(1024, 1024, { kernel: "lanczos3" });
  if ((h >> 3) & 1) pipe = pipe.flop(); // lật ngang 1 nửa số ảnh — đỡ lặp bố cục
  const jpg = await pipe.removeAlpha().jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return { mimeType: "image/jpeg", base64: jpg.toString("base64"), hand: hand.file };
}
