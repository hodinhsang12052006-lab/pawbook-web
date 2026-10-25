// ẢNH MẪU NAIL DO MÁY PAWNAIL TỰ VẼ (không gọi AI vẽ ảnh): mỗi mẫu trong kho "Mẫu nail" được vẽ lên 1 ẢNH TAY THẬT
// bằng chính bộ máy Thử mẫu (lib/tryon) — giải phẫu tay đúng (không 6 móng, không ngón mọc lơ lửng như ảnh AI vẽ cả
// bàn tay), da / ánh sáng / phản chiếu thật, và hoạ tiết ĐÚNG mô tả (bàn cờ ra bàn cờ, French đôi ra French đôi).
// Bộ móng đắp (Gel-X / bột) vẽ dài ra theo đúng dáng mẫu (hạnh nhân, coffin…).
// Chỉ dùng cho hoạ tiết bộ máy tự vẽ được (PROCEDURAL); hoạ tiết hình (ma, bí ngô…) vẫn dùng đường vẽ cũ.
// VẼ Ở ĐÚNG CỠ ẢNH RA (26/10): cắt khung + phóng ảnh tay lên 1024 TRƯỚC, rồi mới vẽ móng lên ảnh 1024 đó. Trước đây vẽ
// trên ảnh gốc (móng chỉ rộng 31–56px) rồi phóng cả ảnh ×1.15–1.6 → mọi nét mảnh / hạt nhũ / mép hoạ tiết bị nhoè.
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fitNail, rasterNail, renderLook, type Img, type Shape, type NailModel, type NailSeg, type LookColors } from "@/lib/tryon/engine";
import { PROCEDURAL } from "@/lib/tryon/patterns";
import { lookColors } from "@/lib/studio";
import { SITE_URL } from "@/lib/siteUrl";

/** Ảnh tay mẫu (public/hands) + điểm chạm gốc → đầu từng móng (đã soát bằng mắt ở cỡ thật). */
// long: tay có móng thật DÀI sẵn (đắp thêm 1 chút vẫn tự nhiên); tay móng ngắn chỉ dùng cho mẫu sơn gel móng thật —
// móng hướng lên nền phía sau mà đắp dài 1.4× thì nhìn như giấy dán (soi bằng mắt 25/10)
// box: vùng vuông [x, y, cạnh] mà khung cắt KHÔNG ĐƯỢC ra ngoài (né móng ngón khác / ngón cái lấp ló ở mép ảnh);
// phần đắp dài lọt ra ngoài vùng đó thì bỏ qua (như cũ).
// p*.jpg: ảnh minh hoạ PawNail cũ (bàn tay đúng giải phẫu, nền / tư thế đa dạng) làm TAY MẪU — máy vẽ lại toàn bộ móng
// lên đó; chỉ giữ tay mà mọi móng trong khung đều sơn lại được (đầu French đen, đá 3D, móng nude sát màu da → loại).
// Chỉ 5 tay thì kho mẫu lặp bố cục liên tục (3/6 ô liền nhau cùng 1 bàn tay — soi trang /designs 25/10).
// deco: móng trong ảnh gốc có hoạ tiết (lá, sao, chỉ khâu) — sơn đặc che kín, nhưng sơn THẠCH trong để lộ mờ → bỏ qua
// hero / echo: thứ tự móng (trong marks) của ngón ÁP ÚT / ngón TRỎ — xác định bằng mắt từng ảnh (ngón út = móng nhỏ nhất,
// thụt sau nhất ở 1 đầu; ngón cái lấp ló ở mép cho biết tay trái / phải). marks xếp trái → phải theo ẢNH, nên số thứ tự
// KHÔNG phải ngón: p067 / ombre / p027 / p063 có ngón út ở đầu 0. Bố cục bộ móng (lib/tryon/sets) đặt móng chính (hero)
// lên ngón áp út như salon thật, móng nhắc lại (echo) lên ngón trỏ — không kề móng chính.
// up: đầu ngón hướng LÊN trong ảnh (tip.y < base.y) — hoạ tiết chảy giọt chỉ vẽ trên tay này (tay chúc xuống thì dải
// nguồn giọt rơi vào chân móng, nhìn như vết bẩn dưới da).
export const HANDS: { file: string; long: boolean; marks: [[number, number], [number, number]][]; box?: [number, number, number]; deco?: boolean; hero: number; echo: number; up: boolean }[] = [
  // trỏ · giữa · áp út · út (ngón út bên phải, nhỏ nhất)
  { file: "pink.jpg", long: true, hero: 2, echo: 0, up: true, marks: [[[315, 458], [313, 302]], [[452, 430], [455, 266]], [[568, 488], [578, 320]], [[683, 616], [690, 480]]] },
  // trỏ · giữa · áp út · út (nắm tay trong tay áo, ngón út bên phải ngắn nhất)
  { file: "hand.jpg", long: false, hero: 2, echo: 0, up: true, marks: [[[272, 425], [272, 322]], [[385, 430], [380, 312]], [[505, 422], [500, 308]], [[618, 400], [615, 310]]] },
  // trỏ · giữa · áp út · út (tay chúc xuống, ngón út tách riêng bên phải, móng hẹp nhất)
  { file: "olive.jpg", long: true, hero: 2, echo: 0, up: false, marks: [[[222, 318], [222, 486]], [[370, 346], [366, 540]], [[494, 392], [482, 588]], [[708, 396], [701, 534]]] },
  // út · áp út · giữa · trỏ (tay trái: ngón cái lấp ló góc dưới phải; ngón út bên trái ngắn nhất)
  { file: "ombre.jpg", long: false, hero: 1, echo: 3, up: true, marks: [[[264, 438], [272, 330]], [[402, 420], [412, 292]], [[538, 414], [545, 282]], [[657, 450], [668, 322]]] },
  // trỏ · giữa · áp út · út (nắm tay úp, ngón út bên phải thấp + nhỏ nhất)
  { file: "white.jpg", long: true, hero: 2, echo: 0, up: false, marks: [[[313, 392], [315, 532]], [[430, 375], [430, 518]], [[550, 397], [548, 528]], [[662, 438], [648, 548]]] },
  // = olive.jpg cỡ 1024: trỏ · giữa · áp út · út; móng lấp ló góc trên trái → vùng cắt né góc đó
  { file: "p021.jpg", long: false, deco: true, hero: 2, echo: 0, up: false, marks: [[[252, 366], [246, 550]], [[421, 395], [413, 592]], [[563, 446], [541, 661]], [[805, 443], [790, 603]]], box: [130, 130, 800] },
  // = hand.jpg cỡ 1024: trỏ · giữa · áp út · út
  { file: "p025.jpg", long: false, hero: 2, echo: 0, up: true, marks: [[[316, 480], [316, 369]], [[440, 487], [440, 363]], [[579, 487], [579, 363]], [[702, 465], [702, 369]]] },
  // = ombre.jpg cỡ 1024: út · áp út · giữa · trỏ (ngón cái góc dưới phải)
  { file: "p027.jpg", long: false, hero: 1, echo: 3, up: true, marks: [[[310, 500], [318, 372]], [[468, 478], [472, 328]], [[612, 468], [612, 318]], [[750, 512], [762, 366]]] },
  // út · áp út · giữa · trỏ (tay phải úp trên khăn, ngón chỉ xuống trái: đầu ngón út thụt sau hẳn, ngón giữa vươn xa nhất)
  { file: "p063.jpg", long: true, hero: 1, echo: 3, up: false, marks: [[[177, 382], [89, 550]], [[309, 524], [192, 704]], [[426, 645], [309, 806]], [[543, 714], [433, 865]]] },
  // út · áp út · giữa · trỏ (tay trái: ngón cái góc dưới phải → vùng cắt né góc đó; móng út ngắn nhất)
  { file: "p067.jpg", long: true, hero: 1, echo: 3, up: true, marks: [[[212, 568], [208, 398]], [[398, 515], [392, 300]], [[578, 509], [571, 263]], [[724, 639], [749, 424]]], box: [100, 110, 760] },
];
type Hand = (typeof HANDS)[number];

export const canRenderPattern = (pattern: string) => PROCEDURAL.has(pattern);

const hashOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/** Cỡ ảnh ra (vuông) — móng được vẽ thẳng ở cỡ này, không phóng sau khi vẽ. */
export const OUT_SIZE = 1024;

/** Ảnh tay gốc + khuôn 4 móng khớp trên ẢNH GỐC (bước nặng nhất — 1 lần / tay, mọi mẫu dùng lại). */
interface HandFit { img: Img; models: NailModel[] }
const handCache = new Map<string, Promise<HandFit>>();
function loadHand(hand: Hand): Promise<HandFit> {
  let hit = handCache.get(hand.file);
  if (!hit) {
    hit = (async () => {
      let buf: Buffer;
      try {
        buf = await readFile(path.join(process.cwd(), "public", "hands", hand.file));
      } catch {
        // máy chủ serverless không kèm thư mục public → tải từ chính trang
        const r = await fetch(`${SITE_URL}/hands/${hand.file}`);
        if (!r.ok) throw new Error(`Không tải được ảnh tay mẫu ${hand.file} (${r.status})`);
        buf = Buffer.from(await r.arrayBuffer());
      }
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const img: Img = { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
      // khớp khuôn trên ảnh GỐC: đúng cỡ ảnh bộ máy được chỉnh (ảnh điện thoại ≤ 1400px) và đúng ảnh đã soát điểm chạm.
      // Khớp lại trên ảnh đã phóng thì chậm gấp 1.5–2.5× mà còn lệch (p027 móng trỏ hụt 1 dải mép phải — soi 26/10).
      const models = hand.marks.map(([b, t]) => fitNail(img, { base: { x: b[0], y: b[1] }, tip: { x: t[0], y: t[1] } }));
      return { img, models };
    })();
    handCache.set(hand.file, hit);
    hit.catch(() => handCache.delete(hand.file));
  }
  return hit;
}

export interface RenderableDesign { id: string; palette: string[]; shape: string; finish: string; pattern: string; skills: string[] }

const isExt = (d: RenderableDesign) => d.skills.some((s) => /gel-?x|bột|acrylic/i.test(s));
/** Dáng móng đắp → tỉ lệ DÀI / RỘNG của cả bộ móng sau khi đắp (đo trên ảnh bộ móng đắp thật). */
const EXT_ASPECT: Record<Shape, number> = { stiletto: 2.6, almond: 2.15, coffin: 2.2, square: 1.75, oval: 1.85 };
/**
 * Bộ đắp (Gel-X / bột) → trên tay móng dài sẵn, đắp tới đúng tỉ lệ của dáng; sơn gel → giữ móng thật.
 * Hệ số đắp tính theo móng THẬT của tay mẫu: móng ngắn rộng cần đắp nhiều (×1.45 mới ra móng nhọn — ngắn quá thành
 * cái chóp tam giác cụt trên móng vuông), móng đã dài sẵn chỉ đắp chút (đắp ×1.5 lên móng coffin dài = móng vuốt).
 * Trần ×1.45: phần đắp phẳng (chưa có bề dày mép / bóng đổ thật) dài hơn thế nhìn như giấy dán (soi 25/10).
 */
function lengthFor(d: RenderableDesign, models: NailModel[]): { lengthFactor: number; shape?: Shape } {
  if (!isExt(d)) return { lengthFactor: 1 };
  const shape = (["almond", "coffin", "square", "oval", "stiletto"].includes(d.shape) ? d.shape : "almond") as Shape;
  const asp = models.map((m) => (m.fit.s1 - m.fit.s0) / Math.max(1, 2 * m.fit.hw)).sort((a, b) => a - b)[models.length >> 1] || 1.6;
  return { lengthFactor: Math.min(1.45, Math.max(1.08, EXT_ASPECT[shape] / asp)), shape };
}

/** Hoạ tiết chảy giọt: dải nguồn ở đầu móng, giọt chảy XUỐNG → chỉ hợp tay đầu ngón hướng lên. */
const DRIP = new Set(["slimedrip", "blooddrip", "chocodip"]);
/** Sơn trong / thạch: lộ mờ hoạ tiết cũ của móng gốc → né tay `deco`. */
const SHEER = new Set(["jelly", "milkbath", "syrup", "blush", "cleanmilky"]);

/** Tay mẫu cho 1 mẫu + biến thể (ổn định: cùng mẫu, cùng biến thể → cùng tay). Bộ đắp chỉ trên tay móng dài. */
export function pickHand(d: RenderableDesign, variant = 0): Hand {
  const sheer = SHEER.has(d.pattern), drip = DRIP.has(d.pattern);
  const pool = HANDS.filter((x) => (!isExt(d) || x.long) && !(sheer && x.deco) && (!drip || x.up));
  return pool[hashOf(`${d.id}:${variant}`) % pool.length];
}

/** Biến thể đầu tiên (từ `from`) cho ra tay CHƯA dùng trong lượt — 6 mẫu 1 lượt không lặp cùng 1 bàn tay. */
export function spreadVariant(d: RenderableDesign, used: Set<string>, from = 0): number {
  for (let v = from; v < from + 12; v++) if (!used.has(pickHand(d, v).file)) return v;
  return from;
}

// ---------------------------------------------------------------- khung ảnh
/**
 * Bộ móng (kể cả phần đắp) chiếm ~78% bề NGANG ô ảnh (≤ 68% bề cao — lề ~0.14 mỗi bên): móng to rõ trong ô kho mẫu
 * 2 cột trên điện thoại, vẫn còn đốt ngón + chút nền cho tự nhiên. Khung cũ (lề 0.42 quanh điểm chạm) để cả bàn tay +
 * áo len → 4 móng chỉ chiếm 7–14% diện tích ô, hoạ tiết thành chấm li ti (hội đồng chấm 25/10). Chặt hơn nữa (86%)
 * thì móng ngoài cùng sát mép ô, nhìn như ảnh bị cắt cụt, và ảnh tay phải phóng > ×2 (da / len mờ hẳn — soi 26/10).
 */
const FILL_W = 0.78, FILL_H = 0.68;
/** Dời khung 1 chút về phía CHÂN móng: thấy ngón tay nhiều hơn khoảng nền trống sau đầu móng. */
const TOWARD_FINGER = 0.05;
/** Lề tối thiểu quanh mép móng (theo cạnh khung) — đầu móng đắp không bao giờ chạm / bị cắt ở mép ảnh. */
const MIN_PAD = 0.045;

interface Box { x: number; y: number; size: number }
/** Hộp bao các móng (theo viền thật, kể cả phần đắp) trên ảnh gốc — theo tay + độ dài đắp + dáng. */
const extentCache = new Map<string, { x0: number; x1: number; y0: number; y1: number }>();
function nailExtent(hand: Hand, fit: HandFit, opts: { lengthFactor: number; shape?: Shape }) {
  const key = `${hand.file}:${opts.lengthFactor.toFixed(4)}:${opts.shape ?? ""}`;
  let e = extentCache.get(key);
  if (!e) {
    e = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const m of fit.models) for (const p of rasterNail(fit.img, m, opts).outline) {
      e.x0 = Math.min(e.x0, p.x); e.x1 = Math.max(e.x1, p.x); e.y0 = Math.min(e.y0, p.y); e.y1 = Math.max(e.y1, p.y);
    }
    extentCache.set(key, e);
  }
  return e;
}

/** Khung vuông cắt từ ảnh gốc (toạ độ nguyên) — tính TRƯỚC khi vẽ, từ viền móng thật kể cả phần đắp. */
function frameFor(hand: Hand, fit: HandFit, opts: { lengthFactor: number; shape?: Shape }): Box {
  const { img } = fit, e = nailExtent(hand, fit, opts);
  const ex = e.x1 - e.x0, ey = e.y1 - e.y0;
  // hướng gốc móng → ngón tay (trung bình 4 móng)
  let dx = 0, dy = 0;
  for (const [b, t] of hand.marks) { const l = Math.hypot(b[0] - t[0], b[1] - t[1]) || 1; dx += (b[0] - t[0]) / l; dy += (b[1] - t[1]) / l; }
  const dl = Math.hypot(dx, dy) || 1;
  // vùng được phép: khung riêng của tay (né móng lấp ló); phần đắp dài lọt ra ngoài thì nới vùng VỪA ĐỦ chứa bộ móng
  // (nới cả ảnh như trước thì khung dời về phía móng lấp ló đúng lúc ảnh cần né nó nhất)
  const pad0 = 12;
  const [bx, by, bs] = hand.box ?? [0, 0, Math.max(img.w, img.h)];
  const rx = Math.max(0, Math.min(bx, e.x0 - pad0)), ry = Math.max(0, Math.min(by, e.y0 - pad0));
  const rw = Math.min(img.w, Math.max(bx + bs, e.x1 + pad0)) - rx, rh = Math.min(img.h, Math.max(by + bs, e.y1 + pad0)) - ry;
  // cạnh khung theo tỉ lệ lấp đầy; vùng hẹp hơn thì thu về vùng — nhưng không bao giờ nhỏ hơn bộ móng + lề (đầu móng
  // đắp không bị cắt) và không vượt ảnh
  const full = Math.min(img.w, img.h), need = Math.min(full, Math.max(ex, ey) / (1 - 2 * MIN_PAD));
  let size = Math.min(full, Math.max(ex / FILL_W, ey / FILL_H, 64));
  if (size > Math.min(rw, rh)) size = Math.max(Math.min(rw, rh), need);
  size = Math.round(size);
  const pad = MIN_PAD * size;
  // tâm: giữa bộ móng, dời về phía ngón tay — giữ đủ lề quanh mọi mép móng, nằm trong vùng (nếu vừa), rồi trong ảnh
  const place = (lo: number, hi: number, shift: number, r0: number, rl: number, n: number) => {
    let c = (lo + hi) / 2 + shift * TOWARD_FINGER * size;
    const cMin = hi + pad - size / 2, cMax = lo - pad + size / 2;
    c = cMin <= cMax ? Math.min(cMax, Math.max(cMin, c)) : (lo + hi) / 2;
    let v = c - size / 2;
    if (rl >= size) v = Math.min(r0 + rl - size, Math.max(r0, v));
    return Math.round(Math.min(n - size, Math.max(0, v)));
  };
  return { x: place(e.x0, e.x1, dx / dl, rx, rw, img.w), y: place(e.y0, e.y1, dy / dl, ry, rh, img.h), size };
}

/** Khung đã cắt + phóng lên OUT_SIZE (giữ vài khung gần nhất — mỗi khung 4MB). */
const cropCache = new Map<string, Promise<Img>>();
const CROP_KEEP = 8;
function cropHand(hand: Hand, img: Img, box: Box): Promise<Img> {
  const key = `${hand.file}:${box.x},${box.y},${box.size}`;
  let hit = cropCache.get(key);
  if (hit) { cropCache.delete(key); cropCache.set(key, hit); return hit; }
  hit = sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), { raw: { width: img.w, height: img.h, channels: 4 } })
    .extract({ left: box.x, top: box.y, width: box.size, height: box.size })
    .resize(OUT_SIZE, OUT_SIZE, { kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({ w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) }));
  cropCache.set(key, hit);
  hit.catch(() => cropCache.delete(key));
  while (cropCache.size > CROP_KEEP) cropCache.delete(cropCache.keys().next().value!);
  return hit;
}

/**
 * Khuôn móng khớp trên ảnh gốc → đúng khuôn đó trong khung đã cắt + phóng ×k (phép đồng dạng: dời gốc, nhân k mọi độ
 * dài; độ dốc / độ cong / tỉ lệ bo là tỉ số nên giữ nguyên). Điểm chấm màu móng (classify) nhận s theo px ảnh gốc.
 * Toạ độ điểm ảnh = TÂM điểm ảnh: tâm điểm i của khung phóng ứng với x = box.x + (i + ½)/k − ½ trên ảnh gốc (thiếu
 * ½ thì mặt nạ lệch ½px so với mép móng thật ở ×2 — đúng chỗ mép khử răng cưa 1px).
 */
function toCrop(m: NailModel, box: Box, k: number): NailModel {
  const f = m.fit, cls = m.classify;
  return {
    ...m,
    O: { x: (m.O.x - box.x + 0.5) * k - 0.5, y: (m.O.y - box.y + 0.5) * k - 0.5 },
    L: m.L * k,
    fit: { ...f, c0: f.c0 * k, hw: f.hw * k, s0: f.s0 * k, s1: f.s1 * k },
    classify: cls ? (s: number) => cls(s / k) : null,
  };
}

/** Mọi thứ để vẽ 1 mẫu, đã ở cỡ ảnh ra: ảnh tay 1024 đã cắt, mặt nạ từng móng (vẽ ở 1024), thông số tô. */
export interface PreparedDesign {
  hand: Hand; box: Box; scale: number; img: Img; segs: NailSeg[]; look: LookColors;
  opts: { lengthFactor: number; shape?: Shape }; flop: boolean;
}
export async function prepareDesign(d: RenderableDesign, variant = 0): Promise<PreparedDesign> {
  if (!canRenderPattern(d.pattern)) throw new Error(`Hoạ tiết "${d.pattern}" chưa vẽ được bằng máy PawNail.`);
  const h = hashOf(`${d.id}:${variant}`);
  const hand = pickHand(d, variant);
  const fit = await loadHand(hand);
  const opts = lengthFor(d, fit.models);
  const box = frameFor(hand, fit, opts);
  const img = await cropHand(hand, fit.img, box);
  const k = OUT_SIZE / box.size;
  const segs = fit.models.map((m) => rasterNail(img, toCrop(m, box, k), opts));
  // điểm nhấn mặc định: 2 móng giữa (trên cả 10 tay mẫu luôn là ngón giữa + áp út)
  segs.forEach((s, i) => { s.accent = i === 1 || i === 2; });
  const look = lookColors({ id: d.id, title: { vi: "", en: "" }, palette: d.palette, shape: d.shape as never, finish: d.finish as never, pattern: d.pattern, priceHint: "", minutes: 0, skills: d.skills });
  // vai trò từng móng theo NGÓN thật (không theo thứ tự trong ảnh): móng chính = áp út, móng nhắc lại = trỏ
  Object.assign(look, { hero: hand.hero, echo: hand.echo });
  return { hand, box, scale: k, img, segs, look, opts, flop: ((h >> 3) & 1) === 1 };
}

/**
 * Vẽ 1 mẫu lên ảnh tay mẫu → JPEG vuông 1024px. `variant` đổi tay / lật ngang (nút "Vẽ lại" của admin ra ảnh khác).
 * Móng vẽ thẳng ở 1024 trên khung đã phóng — sau khi vẽ không phóng / thu gì nữa (chỉ lật ngang + nén JPEG).
 */
export async function renderDesignImage(d: RenderableDesign, variant = 0): Promise<{ mimeType: "image/jpeg"; base64: string; hand: string }> {
  const p = await prepareDesign(d, variant);
  const out = renderLook(p.img, p.segs, p.look);
  let pipe = sharp(Buffer.from(out.data.buffer, out.data.byteOffset, out.data.length), { raw: { width: out.w, height: out.h, channels: 4 } });
  if (p.flop) pipe = pipe.flop(); // lật ngang 1 nửa số ảnh — đỡ lặp bố cục
  const jpg = await pipe.removeAlpha().jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return { mimeType: "image/jpeg", base64: jpg.toString("base64"), hand: p.hand.file };
}
