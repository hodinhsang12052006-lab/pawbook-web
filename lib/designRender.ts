// ẢNH MẪU NAIL DO MÁY PAWNAIL TỰ VẼ (không gọi AI vẽ ảnh): mỗi mẫu trong kho "Mẫu nail" được vẽ lên 1 ẢNH TAY THẬT
// bằng chính bộ máy Thử mẫu (lib/tryon) — giải phẫu tay đúng (không 6 móng, không ngón mọc lơ lửng như ảnh AI vẽ cả
// bàn tay), da / ánh sáng / phản chiếu thật, và hoạ tiết ĐÚNG mô tả (bàn cờ ra bàn cờ, French đôi ra French đôi).
// Bộ móng đắp (Gel-X / bột) vẽ dài ra theo đúng dáng mẫu (hạnh nhân, coffin…).
// Chỉ dùng cho hoạ tiết bộ máy tự vẽ được (PROCEDURAL); hoạ tiết hình (ma, bí ngô…) vẫn dùng đường vẽ cũ.
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { segmentNail, renderLook, type Img, type Shape } from "@/lib/tryon/engine";
import { PROCEDURAL } from "@/lib/tryon/patterns";
import { lookColors, cropBox } from "@/lib/studio";
import { SITE_URL } from "@/lib/siteUrl";

/** Ảnh tay mẫu (public/hands) + điểm chạm gốc → đầu từng móng (đã soát bằng mắt ở cỡ thật). */
// long: tay có móng thật DÀI sẵn (đắp thêm 1 chút vẫn tự nhiên); tay móng ngắn chỉ dùng cho mẫu sơn gel móng thật —
// móng hướng lên nền phía sau mà đắp dài 1.4× thì nhìn như giấy dán (soi bằng mắt 25/10)
export const HANDS: { file: string; long: boolean; marks: [[number, number], [number, number]][] }[] = [
  { file: "pink.jpg", long: true, marks: [[[315, 458], [313, 302]], [[452, 430], [455, 266]], [[568, 488], [578, 320]], [[683, 616], [690, 480]]] },
  { file: "hand.jpg", long: false, marks: [[[272, 425], [272, 322]], [[385, 430], [380, 312]], [[505, 422], [500, 308]], [[618, 400], [615, 310]]] },
  { file: "olive.jpg", long: true, marks: [[[222, 318], [222, 486]], [[370, 346], [366, 540]], [[494, 392], [482, 588]], [[708, 396], [701, 534]]] },
  { file: "ombre.jpg", long: false, marks: [[[264, 438], [272, 330]], [[402, 420], [412, 292]], [[538, 414], [545, 282]], [[657, 450], [668, 322]]] },
  { file: "white.jpg", long: true, marks: [[[313, 392], [315, 532]], [[430, 375], [430, 518]], [[550, 397], [548, 528]], [[662, 438], [648, 548]]] },
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
/** Bộ đắp (Gel-X / bột) → trên tay móng dài sẵn, đắp thêm vừa phải theo dáng mẫu; sơn gel → giữ móng thật. */
function lengthFor(d: RenderableDesign): { lengthFactor: number; shape?: Shape } {
  if (!isExt(d)) return { lengthFactor: 1 };
  const shape = (["almond", "coffin", "square", "oval", "stiletto"].includes(d.shape) ? d.shape : "almond") as Shape;
  // móng nhọn / hạnh nhân cần đủ dài so với bề ngang (tay mẫu móng rộng): ngắn quá thì thành cái chóp tam giác cụt
  // trên móng vuông — không ai dũa móng nhọn như vậy
  return { lengthFactor: shape === "stiletto" ? 1.5 : shape === "almond" ? 1.26 : 1.14, shape };
}

/**
 * Vẽ 1 mẫu lên ảnh tay mẫu → JPEG vuông 1024px. `variant` đổi tay / lật ngang (nút "Vẽ lại" của admin ra ảnh khác).
 */
export async function renderDesignImage(d: RenderableDesign, variant = 0): Promise<{ mimeType: "image/jpeg"; base64: string; hand: string }> {
  if (!canRenderPattern(d.pattern)) throw new Error(`Hoạ tiết "${d.pattern}" chưa vẽ được bằng máy PawNail.`);
  const h = hashOf(`${d.id}:${variant}`);
  const pool = isExt(d) ? HANDS.filter((x) => x.long) : HANDS;
  const hand = pool[h % pool.length];
  const img = await loadHand(hand.file);
  const opts = lengthFor(d);
  const marks = hand.marks.map(([b, t]) => ({ base: { x: b[0], y: b[1] }, tip: { x: t[0], y: t[1] } }));
  const segs = marks.map((m) => segmentNail(img, m, opts));
  segs.forEach((s, i) => { s.accent = i === 1 || i === 2; });
  const look = lookColors({ id: d.id, title: { vi: "", en: "" }, palette: d.palette, shape: d.shape as never, finish: d.finish as never, pattern: d.pattern, priceHint: "", minutes: 0, skills: d.skills });
  const out = renderLook(img, segs, look);
  // khung vuông quanh các móng (kể cả phần đắp dài) — thấy rõ bộ móng, vẫn còn ngón tay cho tự nhiên
  const tips = marks.map((m) => { const k = opts.lengthFactor; return { base: m.base, tip: { x: m.base.x + (m.tip.x - m.base.x) * k, y: m.base.y + (m.tip.y - m.base.y) * k } }; });
  const box = cropBox(tips, img.w, img.h, 0.42);
  const left = Math.max(0, Math.round(box.x)), top = Math.max(0, Math.round(box.y));
  const size = Math.min(Math.round(box.size), img.w - left, img.h - top);
  let pipe = sharp(Buffer.from(out.data.buffer, out.data.byteOffset, out.data.length), { raw: { width: out.w, height: out.h, channels: 4 } })
    .extract({ left, top, width: size, height: size })
    .resize(1024, 1024, { kernel: "lanczos3" });
  if ((h >> 3) & 1) pipe = pipe.flop(); // lật ngang 1 nửa số ảnh — đỡ lặp bố cục
  const jpg = await pipe.removeAlpha().jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return { mimeType: "image/jpeg", base64: jpg.toString("base64"), hand: hand.file };
}
