// BỘ MÁY THỬ MẪU NAIL CỦA PAWNAIL — phiên bản "ảnh thật" (24/10/2026).
//
// Bản cũ vẽ 1 hình móng phẳng đè lên ảnh → nhìn như sticker ("phèn"). Bản này làm như các app thử móng
// chuyên nghiệp:
//  (1) KHỚP KHUÔN MÓNG vào móng thật trong ảnh: chấm điểm từng điểm ảnh "giống màu móng hay màu da", rồi
//      tìm hình móng (2 cạnh gần song song, chân móng vòng cung, đầu móng vuông → tròn → nhọn) ôm đúng nhiều
//      điểm móng nhất. Kết quả luôn là 1 đường viền trơn, liền, mép khử răng cưa — không lởm chởm, không
//      cờ lem ra da dù móng có vệt bóng, đá đính, bóng đổ hay nằm sát nền cùng màu;
//  (2) GIỮ ÁNH SÁNG THẬT của móng (độ cong, vùng tối, vệt bóng) — lấy ánh sáng đã làm mịn để hoạ tiết / màu
//      sơn cũ không lộ ra, rồi chỉ THAY MÀU lên trên;
//  (3) hiệu ứng bóng / nhám / chrome / mắt mèo / nhũ, hoạ tiết in lên móng cũng nhận ánh sáng;
//  (4) đắp dài (tuỳ chọn) theo dáng móng.
//
// Thuần TypeScript trên mảng điểm ảnh RGBA — chạy trên điện thoại (canvas) và trong Node (kiểm thử đo bằng
// số: phủ kín móng, lem ra da, giữ ánh sáng, đúng màu). Không gọi AI / máy chủ nào, 0đ.

export interface Img { w: number; h: number; data: Uint8ClampedArray }
export interface P { x: number; y: number }
export interface Mark { base: P; tip: P }
export type Finish = "glossy" | "matte" | "chrome" | "cateye" | "glitter";
export type Shape = "almond" | "coffin" | "square" | "oval" | "stiletto";

import { ALL_NAIL_PATTERNS, PROCEDURAL } from "./patterns";

// ---------------------------------------------------------------- màu
const srgbToLin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const LIN = new Float32Array(256).map((_, i) => srgbToLin(i));
const linToSrgb = (v: number) => { const x = v <= 0 ? 0 : v >= 1 ? 1 : v; return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055); };
export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [236, 72, 153];
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** sRGB 0–255 → CIE Lab (D65). */
export function lab(r: number, g: number, b: number): [number, number, number] {
  const R = LIN[r | 0], G = LIN[g | 0], B = LIN[b | 0];
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** Khoảng cách màu giảm trọng số độ sáng — bóng đổ trên CÙNG 1 bề mặt không bị coi là khác màu. */
const dEw = (a: number[], b: number[]) => Math.hypot(0.45 * (a[0] - b[0]), a[1] - b[1], a[2] - b[2]);
const chromaOf = (c: number[]) => Math.hypot(c[1], c[2]);
const luma = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };
function hash2(x: number, y: number, s: number) { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

// ---------------------------------------------------------------- khuôn móng
/**
 * Khuôn 1 móng trong hệ trục theo 2 điểm chạm (s: dọc từ điểm chạm gốc → đầu, t: ngang, px).
 * Tâm móng c(s) = c0 + k·(s − L/2) + kc·(s − L/2)²/L (cạnh móng hơi cong khi chụp nghiêng) · nửa bề ngang thân móng hw·(1 + tp·(s − L/2)/L) · móng từ s0 → s1 ·
 * chân móng / đầu móng bo theo siêu elip sâu rb·hw / rt·hw (rt nhỏ = móng vuông, ~1 = tròn, > 1.4 = hạnh nhân) ·
 * đầu / chân móng có thể XIÊN (ts / bs = độ dốc của mép so với ngang móng — ảnh chụp nghiêng) · mép đầu móng
 * có thể CONG LÕM (tc > 0: 2 góc nhô hơn giữa — mép tự do nhìn từ phía đầu ngón).
 */
export interface NailFit { c0: number; k: number; hw: number; tp: number; s0: number; s1: number; rb: number; rt: number; ts: number; bs: number; tc: number; kc: number }

const CAP_N = 2.3;
const capExact = (q: number) => Math.pow(1 - Math.pow(q, CAP_N), 1 / CAP_N);
const CAP_LUT = Float32Array.from({ length: 2049 }, (_, i) => capExact(i / 2048));
const capScale = (q: number) => (q <= 0 ? 1 : q >= 1 ? 0 : CAP_LUT[Math.round(q * 2048)]);
const fitCenter = (f: NailFit, s: number, L: number) => { const d = s - L / 2; return f.c0 + f.k * d + (f.kc * d * d) / L; };
const fitBody = (f: NailFit, s: number, L: number) => f.hw * (1 + (f.tp * (s - L / 2)) / L);
/** Nửa bề ngang móng tại s (0 = ngoài móng). */
function fitHalf(f: NailFit, s: number, L: number): number {
  if (s <= f.s0 || s >= f.s1) return 0;
  const len = f.s1 - f.s0;
  let db = f.rb * f.hw, dt = f.rt * f.hw;
  if (db + dt > len) { const sc = len / (db + dt); db *= sc; dt *= sc; }
  let w = fitBody(f, s, L);
  if (s < f.s0 + db) w *= capScale((f.s0 + db - s) / db);
  if (s > f.s1 - dt) w *= capScale((s - (f.s1 - dt)) / dt);
  return w;
}
/** Điểm (s, t) có nằm trong khuôn không — đủ cả đầu / chân móng xiên (với ts = bs = 0 trùng fitHalf). */
function fitInside(f: NailFit, s: number, t: number, L: number): boolean {
  const tau = t - fitCenter(f, s, L), W = fitBody(f, s, L), a = Math.abs(tau);
  if (a >= W) return false;
  const len = f.s1 - f.s0;
  let db = f.rb * f.hw, dt = f.rt * f.hw;
  if (db + dt > len) { const sc = len / (db + dt); db *= sc; dt *= sc; }
  const st = s - f.ts * tau - (f.tc * tau * tau) / W;
  if (st >= f.s1 || (st > f.s1 - dt && a > W * capScale((st - (f.s1 - dt)) / dt))) return false;
  const sb = s - f.bs * tau;
  if (sb <= f.s0 || (sb < f.s0 + db && a > W * capScale((f.s0 + db - sb) / db))) return false;
  return true;
}

/** Bề ngang nửa móng ĐẮP DÀI theo dáng ở vị trí s (0 = gốc, Ltot = đầu móng kể cả phần đắp). */
function halfWidthAt(shape: Shape, s: number, Ltot: number, hw: number): number {
  const rem = Ltot - s;
  if (s < 0 || rem < 0) return 0;
  const W = 2 * hw;
  let w = hw;
  switch (shape) {
    case "square": { const r = 0.16 * W; if (rem < r) w = hw - r + Math.sqrt(Math.max(0, r * r - (r - rem) ** 2)); break; }
    case "oval": { const r = 0.5 * W; if (rem < r) w = hw * Math.sqrt(Math.max(0, 1 - ((r - rem) / r) ** 2)); break; }
    case "almond": { const r = 1.0 * W; if (rem < r) w = hw * Math.pow(Math.max(0, 1 - ((r - rem) / r) ** 2), 0.62); break; }
    case "stiletto": { const r = 1.45 * W; if (rem < r) w = hw * Math.pow(rem / r, 0.9); break; }
    case "coffin": { const r = 0.9 * W; if (rem < r) w = hw * (0.58 + 0.42 * (rem / r)); break; }
  }
  return w;
}

// ---------------------------------------------------------------- tách móng
export interface NailSeg {
  /** mặt nạ (0–1, mép khử răng cưa) trong khung [x0, y0, w, h] của ảnh */
  x0: number; y0: number; w: number; h: number; alpha: Float32Array;
  /** 1 = vùng móng thật (có ánh sáng ảnh) · 0 = phần đắp dài (vẽ ánh sáng tổng hợp) */
  natural: Uint8Array;
  /** móng ĐẮP dài (Gel-X / bột) — bật vệt phản chiếu nối dài, bề dày mép, bóng đổ phần đắp */
  ext?: boolean;
  /** toạ độ trên móng của từng điểm: along 0 (chân) → 1 (đầu móng thật), > 1 phần đắp · across −1 → 1 (mép → mép) */
  along: Float32Array; across: Float32Array;
  /** gốc / đầu móng thật (giữa móng); L = dài móng thật; hw = nửa bề ngang; offset = lệch tâm so với chỗ chạm */
  base: P; tip: P; L: number; hw: number; offset: number;
  /** tách theo màu thành công (móng khác màu da rõ) hay phải dùng khuôn hình học */
  byColor: boolean;
  /** khuôn đã khớp (hệ trục theo 2 điểm chạm) + độ tin cậy: điểm móng trung bình trong khuôn / ngoài mép */
  fit: NailFit; quality: { inside: number; ring: number };
  /** đường viền móng (kể cả phần đắp) theo toạ độ ảnh — để vẽ viền "đã nhận móng" lên ảnh */
  outline: P[];
  /** móng điểm nhấn (mix màu: màu phụ) — phiên Thử mẫu đặt theo vị trí trên bàn tay */
  accent?: boolean;
}

/** Kết quả KHỚP KHUÔN 1 móng (bước tốn thời gian) — đổi dáng / độ dài đắp chỉ cần vẽ lại mặt nạ (rasterNail). */
export interface NailModel {
  fit: NailFit; byColor: boolean; quality: { inside: number; ring: number };
  /** hệ trục của khuôn (gốc O, trục dọc U, trục ngang V) + chiều dài tham chiếu L (2 điểm chạm) */
  O: P; U: P; V: P; L: number;
  /** chấm điểm "giống móng" cho 1 màu Lab ở vị trí s dọc móng (chỉ có khi tách theo màu) */
  classify: ((s: number) => (c: number[]) => number) | null;
  /** màu (Lab) da sau chân móng + màu móng (trung vị dọc móng) + độ khác nhau — để tự dò móng loại vùng nhầm */
  skin: number[] | null; nail: number[]; contrast: number;
}

/** Màu (Lab) "giữa" của 1 đoạn: bỏ 25% sáng nhất + 25% tối nhất (vệt bóng, đá đính, bóng đổ) rồi lấy trung bình. */
function robustLab(img: Img, pts: P[]): number[] | null {
  const cs: number[][] = [];
  for (const p of pts) {
    const x = Math.round(p.x), y = Math.round(p.y);
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
    const i = (y * img.w + x) * 4;
    cs.push(lab(img.data[i], img.data[i + 1], img.data[i + 2]));
  }
  if (cs.length < 3) return null;
  cs.sort((a, b) => a[0] - b[0]);
  const mid = cs.slice(Math.floor(cs.length * 0.25), Math.ceil(cs.length * 0.75));
  return [0, 1, 2].map((c) => mid.reduce((s, v) => s + v[c], 0) / mid.length);
}

const FIT_KEYS = ["c0", "hw", "s0", "s1", "k", "tp", "rb", "rt", "kc"] as const;

/**
 * Tách 1 móng từ 2 điểm người dùng chạm (gốc móng sát da → đầu móng). Xem chú thích đầu file.
 * widthRatio: bề ngang dự phòng khi móng cùng màu da (móng trơn). lengthFactor ≥ 1: đắp dài theo `shape`.
 */
export function segmentNail(img: Img, mark: Mark, opts: { widthRatio?: number; lengthFactor?: number; shape?: Shape } = {}): NailSeg {
  return rasterNail(img, fitNail(img, mark, opts), opts);
}

/** Bước 1: khớp khuôn móng vào ảnh. */
export function fitNail(img: Img, mark: Mark, opts: { widthRatio?: number } = {}): NailModel {
  const widthRatio = opts.widthRatio ?? 0.68;
  const B0 = mark.base, T0 = mark.tip;
  const L = Math.max(8, Math.hypot(T0.x - B0.x, T0.y - B0.y));
  const u = { x: (T0.x - B0.x) / L, y: (T0.y - B0.y) / L }, v = { x: -u.y, y: u.x };
  const at = (s: number, t: number): P => ({ x: B0.x + u.x * s + v.x * t, y: B0.y + u.y * s + v.y * t });
  const line = (s: number, t0: number, t1: number) => { const r: P[] = []; for (let t = t0; t <= t1; t += 1) r.push(at(s, t)); return r; };

  // màu da: mảng ngay sau chân móng (trên ngón tay)
  const skinPts: P[] = [];
  for (let s = -0.24 * L; s <= -0.1 * L; s += 2) skinPts.push(...line(s, -0.14 * L, 0.14 * L));
  const skin = robustLab(img, skinPts);
  // màu móng theo từng lát (giữa lát, ±12% chiều dài) — móng ombre đổi màu theo chiều dài vẫn đúng
  const AX = 30;
  const axis: (number[] | null)[] = [];
  for (let k = 0; k <= AX; k++) axis.push(robustLab(img, line(L * (0.12 + 0.76 * (k / AX)), -0.12 * L, 0.12 * L)));
  const okAxis = axis.filter(Boolean) as number[][];
  const meanN = okAxis.length ? [0, 1, 2].map((c) => median(okAxis.map((a) => a[c]))) : [50, 0, 0];
  const axisAt = (s: number) => axis[Math.min(AX, Math.max(0, Math.round(((s / L - 0.12) / 0.76) * AX)))] ?? meanN;
  const contrast = skin ? dEw(meanN, skin) : 0;
  // màu NỀN ngay ngoài đầu móng (nền sau / áo / da đầu ngón) — chặn tô lem ra nền gần màu móng
  const bgPts: P[] = [];
  for (let s = 1.1 * L; s <= 1.24 * L; s += 2) bgPts.push(...line(s, -0.18 * L, 0.18 * L));
  const bgRaw = robustLab(img, bgPts);
  const bg = bgRaw && dEw(bgRaw, meanN) > 6 ? bgRaw : null;

  // khuôn dự phòng (móng trơn cùng màu da): theo đúng 2 điểm chạm, dáng tròn nhẹ
  let fit: NailFit = { c0: 0, k: 0, hw: (L * widthRatio) / 2, tp: 0.06, s0: 0, s1: L, rb: 0.55, rt: 0.85, ts: 0, bs: 0, tc: 0, kc: 0 };
  let byColor = false, quality = { inside: 0, ring: 0 };
  // hệ trục của khuôn: mặc định = 2 điểm chạm; khớp màu có thể XOAY quanh trung điểm (người dùng chạm lệch
  // trục móng vài độ → đầu móng / chân móng xiên so với khuôn, sót viền màu cũ ở 1 góc)
  let FU = u, FV = v, FO = B0;
  let classifier: ((s: number) => (c: number[]) => number) | null = null;

  if (skin && contrast >= 10) {
    // Lab của từng điểm ảnh (nhớ lại) — mỗi góc xoay lấy mẫu lại cùng vùng ảnh
    const mx = (B0.x + T0.x) / 2, my = (B0.y + T0.y) / 2;
    const cx0 = Math.max(0, Math.floor(mx - 1.7 * L)), cy0 = Math.max(0, Math.floor(my - 1.7 * L));
    const cw = Math.max(0, Math.min(img.w, Math.ceil(mx + 1.7 * L)) - cx0), ch = Math.max(0, Math.min(img.h, Math.ceil(my + 1.7 * L)) - cy0);
    const cache = new Float32Array(cw * ch * 3).fill(NaN);
    const labPix = (x: number, y: number): number[] | null => {
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) return null;
      const lx = x - cx0, ly = y - cy0, i = (y * img.w + x) * 4;
      if (lx < 0 || ly < 0 || lx >= cw || ly >= ch) return lab(img.data[i], img.data[i + 1], img.data[i + 2]);
      const k = (ly * cw + lx) * 3;
      if (Number.isNaN(cache[k])) { const c = lab(img.data[i], img.data[i + 1], img.data[i + 2]); cache[k] = c[0]; cache[k + 1] = c[1]; cache[k + 2] = c[2]; }
      return [cache[k], cache[k + 1], cache[k + 2]];
    };
    // ĐIỂM MÓNG của 1 màu ở vị trí s dọc móng: p ∈ [0, 1] — 1 chắc là móng, 0 chắc là da / nền, 0.5 = không biết.
    // CHIẾU màu lên đoạn [màu da → màu móng] (Lab, giảm trọng số độ sáng): bóng đổ / mép móng nhạt do cong vẫn
    // nằm phía "móng"; màu thứ 3 (nền, áo) cách xa đoạn này → không phải móng.
    const sk = skin;
    const classify = (s: number) => {
      const ref = axisAt(Math.min(0.88 * L, Math.max(0.12 * L, s)));
      const nx = 0.45 * (ref[0] - sk[0]), na = ref[1] - sk[1], nb = ref[2] - sk[2];
      const nn = nx * nx + na * na + nb * nb || 1, segLen = Math.sqrt(nn);
      const hiL = Math.max(sk[0], ref[0]) + 8, loC = 0.6 * Math.max(chromaOf(sk), chromaOf(ref)) + 4;
      const nearTip = s > 0.75 * L;
      return (c: number[]) => {
        const dx = 0.45 * (c[0] - sk[0]), da = c[1] - sk[1], db = c[2] - sk[2];
        const pr = (dx * nx + da * na + db * nb) / nn;
        let p = smooth(0.25, 0.65, pr);
        const q = Math.min(1, Math.max(0, pr));
        if (Math.hypot(dx - q * nx, da - q * na, db - q * nb) > 0.75 * segLen + 8) p *= 0.4;
        // vệt bóng gương: sáng hơn cả da lẫn móng, gần như không màu → nghiêng về móng (mép móng bóng phản sáng)
        if (c[0] > hiL && chromaOf(c) < loC) p = Math.max(p, 0.56);
        // viền tối sát mép (thành móng, bóng đổ khe móng) → trung tính, không phạt
        if (c[0] < sk[0] - 10 && pr > 0.15) p = Math.max(p, 0.5);
        // gần đầu móng: gần màu nền hẳn hơn màu móng → là nền (nền trắng / kem sát móng trắng: chỉ khi rõ ràng)
        if (nearTip && bg) { const dB = dEw(c, bg), dN = dEw(c, ref); if (dB < 0.6 * dN) p = Math.min(p, 0.1); else if (dB < dN) p = Math.min(p, 0.4); }
        return p;
      };
    };
    classifier = classify;
    const BND: Record<keyof NailFit, [number, number, number]> = { // [nhỏ nhất, lớn nhất, bước đầu]
      c0: [-0.3 * L, 0.3 * L, 0.05 * L], hw: [0.18 * L, 0.68 * L, 0.05 * L], s0: [-0.25 * L, 0.3 * L, 0.04 * L], s1: [0.75 * L, 1.25 * L, 0.04 * L],
      k: [-0.3, 0.3, 0.04], tp: [-0.4, 0.4, 0.1], rb: [0.15, 1.3, 0.2], rt: [0.1, 2.2, 0.3], ts: [-0.7, 0.7, 0.15], bs: [-0.5, 0.5, 0.12], tc: [-0.3, 0.6, 0.12], kc: [-0.35, 0.35, 0.1],
    };
    const fitFrame = (rot: number, seeds: NailFit[] | null, refine = false) => {
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const U = { x: u.x * cr - u.y * sr, y: u.x * sr + u.y * cr }, V = { x: -U.y, y: U.x };
      const O = { x: mx - (U.x * L) / 2, y: my - (U.y * L) / 2 };
      const atF = (s: number, t: number) => labPix(Math.round(O.x + U.x * s + V.x * t), Math.round(O.y + U.y * s + V.y * t));
      // 1) BẢN ĐỒ ĐIỂM MÓNG trên lưới theo trục móng (tổng cộng dồn từng hàng → chấm 1 khuôn rất nhanh)
      const sMin = Math.floor(-0.3 * L), NS = Math.ceil(1.3 * L) - sMin + 1;
      const tMin = Math.floor(-0.95 * L), NT = Math.ceil(0.95 * L) - tMin + 1, RW = NT + 1;
      const F = new Float32Array(NS * RW), Pm = new Float32Array(NS * NT), Lg = new Float32Array(NS * NT);
      const j0 = -tMin, gapRun = Math.max(3, Math.round(0.035 * L));
      for (let i = 0; i < NS; i++) {
        const s = sMin + i, cls = classify(s);
        for (let j = 0; j < NT; j++) {
          const c = atF(s, tMin + j);
          Lg[i * NT + j] = c ? c[0] : 100;
          Pm[i * NT + j] = c ? cls(c) : 0.2;
        }
      }
      // RÀO DA: từ trục chạm đi ra 2 bên, gặp 1 dải da / khe liền (≥ gapRun điểm chắc không phải móng) là hết
      // móng — mọi điểm sau rào bị phạt nặng, khuôn không thể ôm sang móng ngón bên cạnh (cùng màu). Rào mỗi
      // hàng lấy xa nhất trong ±6% chiều dài quanh nó: đá đính / hoạ tiết tối giữa móng không thành rào giả.
      const bl = new Int32Array(NS), br = new Int32Array(NS), near = Math.round(0.08 * L), maxBand = Math.max(8, Math.round(0.26 * L));
      for (let i = 0; i < NS; i++) {
        let c = -1;
        for (let d = 0; d <= near && c < 0; d++) { if (Pm[i * NT + j0 + d] >= 0.5) c = j0 + d; else if (Pm[i * NT + j0 - d] >= 0.5) c = j0 - d; }
        if (c < 0) { bl[i] = j0; br[i] = j0; continue; }
        // MÉP MÓNG KHUẤT SÁNG: móng sáng màu (hồng, nude, trắng) cong xuống 2 bên → mép tối gần màu da trong
        // bóng. Dải tối liền ngay sau phần móng chắc, kết thúc ở 1 "đáy" tối (rãnh thành móng) rồi sáng lên lại
        // → cả dải là móng (móng hồng 24/10: hụt 13px mép trái + viền phải). Chỉ với móng SÁNG hơn / gần độ sáng
        // da: móng tối (đen, xanh rêu) khuất sáng vẫn nhận đúng theo màu, còn khe tối giữa 2 ngón thì không phải móng.
        if (meanN[0] > skin[0] - 5) for (const dir of [-1, 1]) {
          let last = c, miss = 0;
          for (let j = c + dir; j >= 0 && j < NT; j += dir) { if (Pm[i * NT + j] >= 0.5) { last = j; miss = 0; } else if (++miss > 2) break; }
          let minL = Infinity, minJ = -1, end = -1;
          for (let d = 1; d <= maxBand; d++) {
            const jj = last + dir * d; if (jj < 0 || jj >= NT) break;
            const Lv = Lg[i * NT + jj];
            if (Lv < minL) { minL = Lv; minJ = jj; }
            if (Lv > minL + 8) { end = minJ; break; }
            if (Lv >= skin[0] - 10) break;
          }
          if (end >= 0) for (let jj = last + dir; jj !== end + dir; jj += dir) Pm[i * NT + jj] = Math.max(Pm[i * NT + jj], 0.65);
        }
        const walk = (dir: number) => {
          let run = 0;
          for (let j = c; j >= 0 && j < NT; j += dir) { if (Pm[i * NT + j] < 0.3) { if (++run >= gapRun) return j - dir * (gapRun - 1); } else run = 0; }
          return dir < 0 ? -1 : NT;
        };
        bl[i] = walk(-1); br[i] = walk(1);
      }
      const win = Math.max(2, Math.round(0.06 * L));
      for (let i = 0; i < NS; i++) {
        let lo = bl[i], hi = br[i];
        for (let d = -win; d <= win; d++) { const r = i + d; if (r >= 0 && r < NS) { lo = Math.min(lo, bl[r]); hi = Math.max(hi, br[r]); } }
        let acc = 0;
        for (let j = 0; j < NT; j++) {
          acc += j <= lo || j >= hi ? -1 : Pm[i * NT + j] - 0.5;
          F[i * RW + j + 1] = acc;
        }
      }
      const Fat = (row: number, t: number) => {
        const x = Math.min(NT, Math.max(0, t - tMin + 0.5)), j = Math.min(NT - 1, Math.floor(x)), fr = x - j;
        return F[row * RW + j] * (1 - fr) + F[row * RW + j + 1] * fr;
      };
      // TRỤC CHẠM phải nằm giữa móng: tâm khuôn (gốc, giữa, đầu) cách đường nối 2 điểm chạm ≤ 40% nửa bề ngang.
      // Người dùng chạm giữa móng — khuôn không được trượt / cong sang móng ngón bên cạnh (móng xanh rêu 24/10:
      // chạm lệch 6px, khe giữa 2 ngón tối → khuôn uốn ôm sang móng kế bên).
      const oV = (O.x - B0.x) * v.x + (O.y - B0.y) * v.y, uV = U.x * v.x + U.y * v.y, vV = V.x * v.x + V.y * v.y;
      const centered = (f: NailFit) => {
        const len = f.s1 - f.s0, lim = 0.4 * f.hw + 3;
        for (const s of [f.s0 + 0.1 * len, f.s0 + 0.5 * len, f.s1 - 0.1 * len]) if (Math.abs(oV + uV * s + vV * fitCenter(f, s, L)) > lim) return false;
        return true;
      };
      // 2) điểm 1 khuôn = Σ(p − 0.5) trong khuôn: ôm thêm điểm móng thì tăng, lấn ra da / nền thì giảm
      const energy = (f: NailFit) => {
        if (!centered(f)) return -1e9;
        let e = 0;
        const i0 = Math.max(0, Math.ceil(f.s0 - sMin)), i1 = Math.min(NS - 1, Math.floor(f.s1 - sMin));
        for (let i = i0; i <= i1; i++) {
          const s = sMin + i, hh = fitHalf(f, s, L);
          if (hh <= 0) continue;
          const c = fitCenter(f, s, L);
          e += Fat(i, c + hh) - Fat(i, c - hh);
        }
        return e;
      };
      // 3) tìm khuôn tốt nhất: dò từng tham số (bước lớn → nhỏ dần)
      const descend = (start: NailFit, scale: number, keys: readonly (keyof NailFit)[] = FIT_KEYS, en: (f: NailFit) => number = energy) => {
        let f = { ...start }, e = en(f);
        const step = Object.fromEntries(keys.map((key) => [key, BND[key][2] * scale])) as Record<keyof NailFit, number>;
        for (let it = 0; it < 900; it++) {
          let moved = false;
          for (const key of keys) {
            for (const dir of [1, -1]) {
              const val = Math.min(BND[key][1], Math.max(BND[key][0], f[key] + dir * step[key]));
              if (val === f[key]) continue;
              const g = { ...f, [key]: val }, eg = en(g);
              if (eg > e + 1e-3) { f = g; e = eg; moved = true; break; }
            }
          }
          if (!moved) {
            let tiny = true;
            for (const key of keys) { step[key] /= 2; if (step[key] > BND[key][2] / 40) tiny = false; }
            if (tiny) break;
          }
        }
        return { f, e };
      };
      let starts: NailFit[];
      if (seeds) starts = seeds;
      else {
        // bề ngang ban đầu đo ở giữa móng (đoạn liền các điểm móng quanh trục chạm) + vài bề ngang dự phòng
        const mids: { lo: number; hi: number }[] = [];
        for (let s = Math.round(0.35 * L); s <= 0.65 * L; s += 2) {
          const row = s - sMin, pAt = (t: number) => Pm[row * NT + Math.round(t - tMin)] ?? 0;
          let c = NaN;
          for (let d = 0; d <= 0.2 * L && isNaN(c); d++) { if (pAt(d) >= 0.5) c = d; else if (pAt(-d) >= 0.5) c = -d; }
          if (isNaN(c)) continue;
          const walk = (dir: number) => { let last = c, miss = 0; for (let t = c + dir; Math.abs(t) < 0.9 * L; t += dir) { if (pAt(t) >= 0.5) { last = t; miss = 0; } else if (++miss > 3) break; } return last; };
          mids.push({ lo: walk(-1), hi: walk(1) });
        }
        starts = [];
        const base0 = { k: 0, tp: 0, s0: 0, s1: L, rb: 0.6, rt: 0.9, ts: 0, bs: 0, tc: 0, kc: 0 };
        if (mids.length >= 3) {
          const lo = median(mids.map((m) => m.lo)), hi = median(mids.map((m) => m.hi));
          starts.push({ ...base0, c0: (lo + hi) / 2, hw: Math.min(BND.hw[1], Math.max(BND.hw[0], (hi - lo) / 2)) });
        }
        for (const r of [0.3, 0.45, 0.6]) starts.push({ ...base0, c0: 0, hw: r * L });
      }
      let best = { f: starts[0], e: -Infinity };
      for (const st of starts) { const r = descend(st, seeds ? 0.5 : 1); if (r.e > best.e) best = r; }
      // 3b) 2 đầu móng XIÊN (ảnh chụp nghiêng: mép đầu móng / chân móng chéo so với 2 cạnh móng — từng sót
      //     1 tam giác màu cũ ở góc, 24/10): chấm từng điểm ảnh, dò độ xiên + vị trí + độ bo 2 đầu.
      if (refine) {
        const energyPx = (f: NailFit) => {
          if (!centered(f)) return -1e9;
          let e = 0;
          const sA = f.s0 - Math.abs(f.bs) * f.hw * 1.4 - 1, sB = f.s1 + (Math.abs(f.ts) + Math.max(0, f.tc)) * f.hw * 1.4 + 1;
          for (let i = Math.max(0, Math.ceil(sA - sMin)); i <= Math.min(NS - 1, Math.floor(sB - sMin)); i++) {
            const s = sMin + i, c = fitCenter(f, s, L), W = fitBody(f, s, L), row = i * RW;
            const jA = Math.max(0, Math.ceil(c - W - tMin)), jB = Math.min(NT - 1, Math.floor(c + W - tMin));
            for (let j = jA; j <= jB; j++) if (fitInside(f, s, tMin + j, L)) e += F[row + j + 1] - F[row + j];
          }
          return e;
        };
        best = descend(best.f, 0.5, ["ts", "tc", "bs", "s1", "s0", "rt", "rb"], energyPx);
      }
      // 4) độ tin cậy: trong khuôn phải phần lớn là móng, ngay ngoài 2 mép phải ít móng hơn hẳn
      const f = best.f, len = f.s1 - f.s0;
      let inS = 0, inN = 0, rgS = 0, rgN = 0;
      for (let s = Math.ceil(f.s0 + 0.15 * len); s <= f.s1 - 0.15 * len; s++) {
        const row = s - sMin; if (row < 0 || row >= NS) continue;
        const hh = fitHalf({ ...f, ts: 0, bs: 0, tc: 0 }, s, L), c = fitCenter(f, s, L);
        for (let t = Math.ceil(c - hh); t <= c + hh; t++) { const j = t - tMin; if (j >= 0 && j < NT) { inS += Pm[row * NT + j]; inN++; } }
        for (const side of [-1, 1]) for (let d = 3; d <= 3 + 0.15 * f.hw; d++) {
          const j = Math.round(c + side * (hh + d)) - tMin; if (j >= 0 && j < NT) { rgS += Pm[row * NT + j]; rgN++; }
        }
      }
      return { f, e: best.e, rot, U, V, O, quality: { inside: inN ? inS / inN : 0, ring: rgN ? rgS / rgN : 1 } };
    };
    // thẳng trục chạm (dò kỹ) → xoay ±4°, ±8° (dò tiếp từ khuôn tốt nhất) → giữ khuôn ôm móng tốt nhất
    let best = fitFrame(0, null);
    for (const deg of [-12, -6, 6, 12]) { const r = fitFrame((deg * Math.PI) / 180, [best.f]); if (r.e > best.e * 1.01) best = r; }
    best = fitFrame(best.rot, [best.f], true);
    quality = best.quality;
    if (quality.inside >= 0.6 && quality.inside - quality.ring >= 0.2) { fit = best.f; byColor = true; FU = best.U; FV = best.V; FO = best.O; }
  }
  return { fit, byColor, quality, O: FO, U: FU, V: FV, L, classify: byColor ? classifier : null, skin, nail: meanN, contrast };
}

/** Bước 2: vẽ mặt nạ: khuôn móng thật (nở 0.6px phủ viền pha màu) ∪ phần đắp dài theo dáng. */
/** Bao lồi (chuỗi đơn điệu Andrew) — thứ tự ngược chiều kim đồng hồ trong hệ trục ảnh (y xuống). */
function convexHull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function rasterNail(img: Img, model: NailModel, opts: { lengthFactor?: number; shape?: Shape } = {}): NailSeg {
  const lf = Math.max(1, opts.lengthFactor ?? 1), shape = opts.shape ?? "oval";
  const { fit, byColor, quality, O: FO, U: FU, V: FV, L } = model;
  const G = 0.6;
  const atFit = (s: number, t: number): P => ({ x: FO.x + FU.x * s + FV.x * t, y: FO.y + FU.y * s + FV.y * t });
  const fg: NailFit = { ...fit, s0: fit.s0 - G, s1: fit.s1 + G, hw: fit.hw + G };
  const natL = fit.s1 - fit.s0;
  const Ltot = fit.s0 + natL * lf;
  const ext = lf > 1.02;
  // dáng móng ĐẮP = BAO LỒI của móng thật (cả đầu móng bo tròn) + dáng đầu móng mới: 2 cạnh thon THẲNG tiếp tuyến từ
  // thành móng tới đỉnh — như thợ dũa thật. (Chỉ lấy hợp "móng thật ∪ dáng" thì đầu móng thật tròn vẫn nguyên, đầu
  // nhọn mọc ra thành cái GAI — móng nhọn / hạnh nhân nhìn như gai hoa hồng.)
  // Ảnh chụp nghiêng → đầu móng thật XIÊN (1 bên dài hơn): bao lồi tính RIÊNG từng bên, mỗi cạnh thon từ chính thành
  // móng bên đó tới đỉnh (bao chung 2 bên đối xứng thì bên xiên lòi vai ra → móng nhọn lệch như đầu bút chì).
  // trục phần đắp: đi THẲNG tiếp theo trục móng thật (dây cung chân → đầu móng); không ngoại suy độ cong bậc 2 của
  // khuôn (đầu móng dài bị bẻ lệch sang 1 bên)
  const chord = (fitCenter(fit, fit.s1, L) - fitCenter(fit, fit.s0, L)) / Math.max(1, natL);
  const cExt = (s: number) => (s <= fit.s1 ? fitCenter(fit, s, L) : fitCenter(fit, fit.s1, L) + chord * (s - fit.s1));
  const ES = 0.25, eA = fit.s0 + 0.5 * natL, eN = ext ? Math.max(2, Math.ceil((Ltot - eA) / ES) + 1) : 0;
  const extTabs = [new Float32Array(eN), new Float32Array(eN)]; // [bên t dương, bên t âm]
  if (ext) {
    const W2 = 2 * fit.hw, rT = shape === "stiletto" ? 0.03 * W2 : shape === "almond" ? 0.2 * W2 : shape === "oval" ? 0.42 * W2 : 0;
    const natSide = (sx: number, d: number, body: number) => {
      const c = cExt(sx);
      // dò từ ngoài vào (đầu móng xiên: giữa móng có thể đã ra ngoài mà 1 bên vẫn còn móng), rồi chia đôi cho mịn
      const st = (body + 1) / 24;
      let k = 24;
      while (k >= 0 && !fitInside(fit, sx, c + d * k * st, L)) k--;
      if (k < 0) return 0;
      let lo = k * st, hi = lo + st;
      for (let it = 0; it < 8; it++) { const mid = (lo + hi) / 2; if (fitInside(fit, sx, c + d * mid, L)) lo = mid; else hi = mid; }
      return lo;
    };
    [1, -1].forEach((d, side) => {
      const hx: number[] = [], hy: number[] = [], tab = extTabs[side];
      for (let i = 0; i < eN; i++) {
        const sx = Math.min(Ltot, eA + i * ES), body = fitBody(fit, Math.min(sx, fit.s1), L);
        let v = Math.max(natSide(sx, d, body), halfWidthAt(shape, sx - fit.s0, Ltot - fit.s0, body));
        if (rT > 0) { const dq = sx - (Ltot - rT); v = dq <= 0 ? Math.max(v, Math.min(body, rT)) : Math.max(Math.min(v, rT * Math.sqrt(Math.max(0, 1 - (dq / rT) ** 2))), 0); }
        // bao lồi trên (monotone chain): bỏ điểm làm đường biên lõm vào
        while (hx.length >= 2 && (hx[hx.length - 1] - hx[hx.length - 2]) * (v - hy[hy.length - 2]) - (hy[hy.length - 1] - hy[hy.length - 2]) * (sx - hx[hx.length - 2]) >= 0) { hx.pop(); hy.pop(); }
        hx.push(sx); hy.push(v);
      }
      for (let i = 0, j = 0; i < eN; i++) {
        const sx = Math.min(Ltot, eA + i * ES);
        while (j < hx.length - 2 && hx[j + 1] < sx) j++;
        const q = hx[j + 1] > hx[j] ? Math.min(1, Math.max(0, (sx - hx[j]) / (hx[j + 1] - hx[j]))) : 0;
        tab[i] = hy[j] + (hy[j + 1] - hy[j]) * q;
      }
    });
  }
  /** nửa bề ngang phần đắp tại s, phía d (+1 / −1 theo t) */
  const extHalfD = (s: number, d: number) => { if (!ext || s < eA || s > Ltot) return 0; const tab = extTabs[d > 0 ? 0 : 1], f = (s - eA) / ES, i = Math.floor(f), q = f - i; return i + 1 < eN ? tab[i] + (tab[i + 1] - tab[i]) * q : tab[eN - 1]; };
  const extHalf = (s: number) => Math.max(extHalfD(s, 1), extHalfD(s, -1));
  const inExt = (s: number, t: number) => { const dt = t - cExt(s); return Math.abs(dt) <= extHalfD(s, dt); };
  const halfU = (s: number) => Math.max(fitBody(fg, Math.min(Math.max(s, fit.s0), fit.s1), L), extHalf(s));
  const sLo = fg.s0 - Math.abs(fit.bs) * fg.hw * 1.4, sHi = Math.max(fg.s1 + (Math.abs(fit.ts) + Math.max(0, fit.tc)) * fg.hw * 1.4, ext ? Ltot : 0);
  let maxHalf = 0;
  for (let s = sLo; s <= sHi; s += 1) maxHalf = Math.max(maxHalf, halfU(s));
  const pts: P[] = [];
  for (const s of [sLo, (sLo + sHi) / 2, sHi]) for (const d of [-1, 1]) pts.push(atFit(s, fitCenter(fit, s, L) + d * (maxHalf + 2)));
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x))) - 3), y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y))) - 3);
  const x1 = Math.min(img.w - 1, Math.ceil(Math.max(...pts.map((p) => p.x))) + 3), y1 = Math.min(img.h - 1, Math.ceil(Math.max(...pts.map((p) => p.y))) + 3);
  const w = Math.max(1, x1 - x0 + 1), h = Math.max(1, y1 - y0 + 1);
  const local = (x: number, y: number) => { const dx = x - FO.x, dy = y - FO.y; return { s: dx * FU.x + dy * FU.y, t: dx * FV.x + dy * FV.y }; };
  const inside = (x: number, y: number) => {
    const { s, t } = local(x, y);
    if (s <= sLo || s >= sHi) return false;
    return fitInside(fg, s, t, L) || inExt(s, t);
  };
  // khử răng cưa: góc điểm ảnh cùng trong / cùng ngoài → 1 / 0; điểm nằm trên mép → lấy mẫu 4×4
  const corner = new Uint8Array((w + 1) * (h + 1));
  for (let yy = 0; yy <= h; yy++) for (let xx = 0; xx <= w; xx++) corner[yy * (w + 1) + xx] = inside(x0 + xx - 0.5, y0 + yy - 0.5) ? 1 : 0;
  const alpha = new Float32Array(w * h), nat = new Uint8Array(w * h);
  const along = new Float32Array(w * h), across = new Float32Array(w * h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const k = yy * w + xx, c0 = yy * (w + 1) + xx;
    const n = corner[c0] + corner[c0 + 1] + corner[c0 + w + 1] + corner[c0 + w + 2];
    let a = n === 4 ? 1 : 0;
    if (n > 0 && n < 4) {
      let hit = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x0 + xx - 0.375 + sx * 0.25, y0 + yy - 0.375 + sy * 0.25)) hit++;
      a = hit / 16;
    }
    const { s, t } = local(x0 + xx, y0 + yy);
    alpha[k] = a;
    const c = cExt(s);
    if (fitInside(fg, s, t, L)) nat[k] = 1;
    along[k] = (s - fit.s0) / Math.max(1, natL);
    across[k] = (t - c) / Math.max(1, Math.max(fitBody(fit, Math.min(Math.max(s, fit.s0), fit.s1), L), halfU(s)));
  }
  // BÁM MÉP: khuôn trơn có thể hụt 1–3px ở góc / mép so với móng thật (màu cũ lộ thành viền / góc nhọn — rõ nhất
  // khi đổi móng đen sang màu sáng). Nở thêm tối đa 3 lượt × 1px vào các điểm CHẮC LÀ MÓNG (p ≥ 0.6) liền kề.
  if (byColor && model.classify) {
    const cls = model.classify, sk = model.skin, nl = model.nail;
    const grown = new Uint8Array(w * h);
    // 5 lượt (góc đầu móng vuông có thể hụt 4–5px); chỉ nở vào điểm CHẮC LÀ MÓNG
    for (let pass = 0; pass < 5; pass++) {
      const add: number[] = [];
      for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
        const k = yy * w + xx;
        if (alpha[k] >= 0.99) continue;
        if (Math.max(alpha[k - 1], alpha[k + 1], alpha[k - w], alpha[k + w]) < 0.5) continue;
        const X = x0 + xx, Y = y0 + yy, i = (Y * img.w + X) * 4;
        const c = lab(img.data[i], img.data[i + 1], img.data[i + 2]);
        const pv = cls(local(X, Y).s)(c);
        if (pv >= 0.6) add.push(k, smooth(0.6, 0.85, pv));
        // điểm tối sát mép móng đen / xám sẫm (lượt đầu, 1px) = viền của chính móng — không chừa viền sẫm quanh màu mới
        else if (sk && pass === 0 && pv >= 0.5 && nl[0] < 32 && chromaOf(nl) < 14 && c[0] < sk[0] - 10 && chromaOf(c) < 0.8 * chromaOf(sk) + 6) add.push(k, 0.7); // chỉ móng đen / xám sẫm
      }
      if (!add.length) break;
      for (let q = 0; q < add.length; q += 2) { const k = add[q]; if (add[q + 1] > alpha[k]) { alpha[k] = add[q + 1]; nat[k] = 1; grown[k] = 1; } }
    }
    // tỉa GAI: phần nở có thể bò theo khe da tối (nền ombre nâu sát chân móng) thành sợi mảnh 1–2px → bỏ điểm nở có
    // ít hơn 4/8 hàng xóm trong khuôn (2 lượt); không thì bao lồi bên dưới kéo mặt phẳng giữa các đầu gai ra ngoài da
    for (let it = 0; it < 2; it++) {
      const drop: number[] = [];
      for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
        const k = yy * w + xx;
        if (!grown[k] || alpha[k] < 0.5) continue;
        let nb = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && alpha[k + dy * w + dx] >= 0.5) nb++;
        if (nb < 4) drop.push(k);
      }
      if (!drop.length) break;
      for (const k of drop) { alpha[k] = 0; grown[k] = 0; nat[k] = 0; }
    }
    // phần nở theo từng hàng điểm ảnh ra mép BẬC THANG (thành "vết cắn" răng cưa ở góc móng sau khi tô màu mới) →
    // làm trơn mép quanh phần đã nở: trung bình 3×3 rồi kéo dốc lại thành mép khử răng cưa ~1px
    const near = boxBlur(Float32Array.from(grown), w, h, 2);
    const sm = boxBlur(alpha, w, h, 1);
    const fixed = new Float32Array(alpha);
    for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
      const k = yy * w + xx;
      if (near[k] <= 0) continue;
      const v = smooth(0.32, 0.68, sm[k] / 9); // mép khử răng cưa ~1px (rộng hơn thành viền nhạt quanh móng)
      // không bao giờ "ăn" vào phần chắc chắn trong khuôn trơn ban đầu
      fixed[k] = alpha[k] >= 0.99 && !grown[k] ? 1 : v;
      if (fixed[k] > 0) nat[k] = 1;
    }
    alpha.set(fixed);
    // MÓNG LÀ HÌNH LỒI: chỗ nở được / chỗ không (mép đầu móng sáng loá không giống màu móng) để lại 1 BẬC lõm vài px
    // ở góc đầu móng → sau khi tô màu mới thành "vết cắn". Lấp phần lõm bằng bao lồi của mặt nạ (khử răng cưa 4×4).
    const pts: [number, number][] = [];
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const k = yy * w + xx;
      if (alpha[k] < 0.5) continue;
      // chỉ điểm biên (đủ để dựng bao lồi, nhanh)
      if (xx > 0 && yy > 0 && xx < w - 1 && yy < h - 1 && alpha[k - 1] >= 0.5 && alpha[k + 1] >= 0.5 && alpha[k - w] >= 0.5 && alpha[k + w] >= 0.5) continue;
      pts.push([xx, yy]);
    }
    const hull = convexHull(pts);
    if (hull.length >= 3) {
      const inHull = (x: number, y: number) => {
        for (let q = 0; q < hull.length; q++) {
          const [ax, ay] = hull[q], [bx, by] = hull[(q + 1) % hull.length];
          if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < -1e-9) return false;
        }
        return true;
      };
      // chỉ lấp chỗ lõm NHỎ sát mặt nạ (≤ 3px) — không kéo mặt phẳng dài ra ngoài da
      const inM = new Float32Array(w * h);
      for (let k = 0; k < w * h; k++) inM[k] = alpha[k] >= 0.5 ? 1 : 0;
      const nearM = boxBlur(inM, w, h, 3);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const k = yy * w + xx;
        if (alpha[k] >= 0.99 || nearM[k] <= 0) continue;
        let hit = 0;
        for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inHull(xx - 0.375 + sx * 0.25, yy - 0.375 + sy * 0.25)) hit++;
        const cov = hit / 16;
        if (cov > alpha[k]) { alpha[k] = cov; if (cov >= 0.5) nat[k] = 1; }
      }
    }
  }
  const cB = fitCenter(fit, fit.s0, L), cT = fitCenter(fit, fit.s1, L);
  // đường viền: 96 tia từ tâm móng, dò mép bằng chia đôi (khuôn lồi quanh tâm)
  const sC = (fit.s0 + Math.max(fit.s1, ext ? Ltot : fit.s1)) / 2, C = atFit(sC, fitCenter(fit, sC, L));
  const inShape = (x: number, y: number) => { const { s, t } = local(x, y); return fitInside(fit, s, t, L) || inExt(s, t); };
  const outline: P[] = [];
  const rMax = Math.hypot(w, h);
  for (let k = 0; k < 96; k++) {
    const an = (k / 96) * 2 * Math.PI, dx = Math.cos(an), dy = Math.sin(an);
    let lo = 0, hi = rMax;
    for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; if (inShape(C.x + dx * mid, C.y + dy * mid)) lo = mid; else hi = mid; }
    outline.push({ x: Math.round((C.x + dx * lo) * 10) / 10, y: Math.round((C.y + dy * lo) * 10) / 10 });
  }
  return { x0, y0, w, h, alpha, natural: nat, ext, along, across, base: atFit(fit.s0, cB), tip: atFit(fit.s1, cT), L: natL, hw: fit.hw, offset: fit.c0, byColor, fit, quality, outline };
}

// ---------------------------------------------------------------- tô màu theo ánh sáng thật
/** Ghi đè cho 1 móng trong bộ (bộ móng phối: móng trơn + móng hoạ tiết + móng nhấn — mỗi móng 1 vai, cùng tông). */
export interface NailOverride { pattern?: string; colors?: string[]; finish?: Finish; art?: boolean }
export interface LookColors {
  colors: string[]; finish: Finish; pattern: string; seed: number;
  /** ghi đè theo từng móng (theo thứ tự móng) — không có thì mọi móng theo mẫu chung */
  nails?: (NailOverride | null | undefined)[];
  /** độ phủ lớp sơn (1 = sơn đặc; thạch / negative space ~0.5 — thấy móng thật bên dưới) */
  opacity?: number;
}

/** Làm mờ hộp (cộng dồn, viền = 0) theo 2 chiều. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w; let acc = 0;
    for (let x = 0; x <= Math.min(w - 1, r); x++) acc += src[row + x];
    for (let x = 0; x < w; x++) { tmp[row + x] = acc; if (x + r + 1 < w) acc += src[row + x + r + 1]; if (x - r >= 0) acc -= src[row + x - r]; }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = 0; y <= Math.min(h - 1, r); y++) acc += tmp[y * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = acc; if (y + r + 1 < h) acc += tmp[(y + r + 1) * w + x]; if (y - r >= 0) acc -= tmp[(y - r) * w + x]; }
  }
  return out;
}

/** Giải hệ tuyến tính nhỏ (khử Gauss, chọn trụ). */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-9) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / M[i][i]);
}

/** Các hàm cơ sở của mặt ánh sáng móng: bậc 3 theo bề ngang (độ cong móng, sáng lệch 1 bên), bậc 2 theo chiều dài. */
const basis = (x: number, y: number) => [1, x, x * x, x * x * x, y, y * y, x * y, x * x * y];

/**
 * Ánh sáng của móng gốc:
 *  • shade: MẶT ÁNH SÁNG TRƠN khớp bền vững (bỏ điểm lạc: đá đính, chỉ bạc, hoạ tiết cũ, vệt bóng) theo
 *    bề ngang + chiều dài móng → giữ đúng độ cong / phía sáng–tối của ảnh mà không lộ hoạ tiết cũ qua màu mới;
 *    bỏ 80% phần thay đổi theo chiều dài (đó là màu sơn cũ kiểu ombre, không phải ánh sáng);
 *  • spec: vệt bóng gương THẬT — chỉ nhận vệt chạy DỌC móng (độ cong móng phản chiếu đèn); đốm đá đính, chỉ bạc
 *    chéo, hoạ tiết sáng bị loại (từng hiện thành "hình lượn trắng" trên mọi mẫu, 24/10);
 *  • weight: độ tin của ánh sáng thật tại điểm (0 ở phần đắp dài xa móng thật).
 */
interface LightMap {
  shade: Float32Array; spec: Float32Array; weight: Float32Array; streak: boolean;
  /** phía có đèn theo bề ngang móng: -1 = phía t âm (thường bên trái ảnh), +1 = phía t dương — để vệt bóng tổng hợp,
   *  phản chiếu kim loại, khối 3D (ngọc trai / đá / giọt nước) và bóng đổ cùng hướng đèn của ẢNH THẬT */
  side: number;
  /** phản chiếu mềm của ảnh thật (ánh sáng CỘNG, không gian tuyến tính) — cộng lên màu sơn mới */
  sheen: Float32Array;
}
function lightMap(img: Img, seg: NailSeg): LightMap {
  const { w, h } = seg, n = w * h;
  const shade = new Float32Array(n), spec = new Float32Array(n), weight = new Float32Array(n);
  const M = new Float32Array(n), Yv = new Float32Array(n);
  const idx: number[] = [];
  for (let k = 0; k < n; k++) {
    if (!seg.natural[k] || seg.alpha[k] < 0.99) continue;
    const xx = k % w, yy = (k - xx) / w;
    Yv[k] = luma(img.data, ((seg.y0 + yy) * img.w + seg.x0 + xx) * 4); M[k] = 1; idx.push(k);
  }
  if (idx.length < 40) return { shade, spec, weight, streak: false, side: -1, sheen: new Float32Array(n) };
  const cx = (k: number) => Math.max(-1.1, Math.min(1.1, seg.across[k])), cy = (k: number) => Math.max(0, Math.min(1.05, seg.along[k]));
  // khớp bền vững (IRLS, trọng số Tukey) trên tối đa ~2500 điểm
  const stepI = Math.max(1, Math.floor(idx.length / 2500));
  const sample = idx.filter((_, i) => i % stepI === 0);
  const nb = 8;
  let coef: number[] = [median(sample.map((k) => Yv[k])), 0, 0, 0, 0, 0, 0, 0];
  const wts = new Float64Array(sample.length).fill(1);
  const evalP = (c: number[], x: number, y: number) => { const b = basis(x, y); let v = 0; for (let i = 0; i < nb; i++) v += c[i] * b[i]; return v; };
  for (let it = 0; it < 6; it++) {
    const A = Array.from({ length: nb }, () => new Array(nb).fill(0)), bv = new Array(nb).fill(0);
    sample.forEach((k, i) => {
      const b = basis(cx(k), cy(k)), wt = wts[i];
      for (let r = 0; r < nb; r++) { bv[r] += wt * b[r] * Yv[k]; for (let c = 0; c < nb; c++) A[r][c] += wt * b[r] * b[c]; }
    });
    for (let r = 0; r < nb; r++) A[r][r] += 1e-3 * sample.length * (r === 0 ? 0 : 1); // giữ mặt trơn khi ít điểm
    const sol = solve(A, bv);
    if (!sol) break;
    coef = sol;
    const res = sample.map((k) => Yv[k] - evalP(coef, cx(k), cy(k)));
    const mad = Math.max(2.5, 1.4826 * median(res.map(Math.abs)));
    const cT = 4.685 * mad;
    res.forEach((r, i) => { const u = r / cT; wts[i] = Math.abs(u) < 1 ? (1 - u * u) ** 2 : 0; });
  }
  // bỏ 80% phần chỉ phụ thuộc chiều dài (màu sơn cũ đổi theo chiều dài), giữ phần còn lại
  const yMean = idx.reduce((s, k) => s + cy(k), 0) / idx.length;
  const poly = (k: number) => {
    const x = cx(k), y = cy(k);
    return evalP(coef, x, y) - 0.8 * (coef[4] * (y - yMean) + coef[5] * (y * y - yMean * yMean));
  };
  const pv = idx.map(poly).sort((a, b) => a - b);
  const q = (p: number) => pv[Math.min(pv.length - 1, Math.floor(p * pv.length))];
  const md = q(0.5), range = Math.max(22, q(0.97) - q(0.03));
  for (let k = 0; k < n; k++) shade[k] = Math.max(-1.2, Math.min(1.2, (poly(k) - md) / range));
  // độ tin: tỉ lệ điểm móng thật quanh điểm (phần đắp dài xa móng → 0)
  const r = Math.max(2, Math.round(0.16 * seg.hw));
  const MM = boxBlur(M, w, h, r), full = (2 * r + 1) ** 2;
  for (let k = 0; k < n; k++) weight[k] = smooth(0.04, 0.35, MM[k] / full);
  // vệt bóng thật: điểm sáng vượt mặt ánh sáng rõ rệt…
  const res = idx.map((k) => Yv[k] - evalP(coef, cx(k), cy(k)));
  const sig = Math.max(3, 1.4826 * median(res.map(Math.abs)));
  const thr = Math.max(14, 3 * sig);
  // …gom thành từng mảng liền (8 hướng). Vệt bóng thật = mảng DÀI theo móng (≥ 22% chiều dài), HẸP theo bề
  // ngang (≤ 0.4), đủ lớn. Đốm đá đính (ngắn), nét chỉ bạc chéo / hoạ tiết lượn (rộng ngang) bị loại.
  const hot = new Float32Array(n).fill(-1);

  // ánh đèn là ánh sáng TRẮNG: chỉ kéo màu móng về phía trắng (cùng sắc, nhạt hơn); vật đính có màu (lá vàng, charm
  // vàng hồng…) đổi SẮC hoặc đậm hơn → không phải phản chiếu (lá phong vàng từng hiện thành "lá trắng ma" trên mọi màu)
  const labAt = (k: number) => { const xx = k % w, yy = (k - xx) / w, i = ((seg.y0 + yy) * img.w + seg.x0 + xx) * 4; return lab(img.data[i], img.data[i + 1], img.data[i + 2]); };
  const nailLab = [0, 1, 2].map((ch) => median(sample.map((k) => labAt(k)[ch])));
  const nC = Math.hypot(nailLab[1], nailLab[2]);
  const whiteLight = (pix: number[]) => {
    let A = 0, B = 0, Cm = 0;
    for (const k of pix) { const c = labAt(k); A += c[1]; B += c[2]; Cm += Math.hypot(c[1], c[2]); }
    A /= pix.length; B /= pix.length; Cm /= pix.length;
    const da = A - nailLab[1], db = B - nailLab[2];
    const perp = nC > 4 ? Math.abs(da * nailLab[2] - db * nailLab[1]) / nC : Math.hypot(da, db);
    return Cm <= nC + 4 && perp <= 6;
  };
  // VẬT ĐÍNH CŨ (lá vàng, charm, đá màu…): điểm lệch SẮC / đậm màu hơn hẳn móng → nở rộng ra vài px để nuốt cả điểm
  // loá trắng TRÊN chính vật đó → cả vùng không được coi là ánh đèn của mặt móng
  const obj = new Float32Array(n);
  for (const k of idx) {
    const c = labAt(k), da = c[1] - nailLab[1], db = c[2] - nailLab[2];
    const perp = nC > 4 ? Math.abs(da * nailLab[2] - db * nailLab[1]) / nC : Math.hypot(da, db);
    if (Math.hypot(c[1], c[2]) - nC > 8 || perp > 10) obj[k] = 1;
  }
  const ro = Math.max(3, Math.round(0.1 * seg.hw));
  const objB = boxBlur(obj, w, h, ro);
  const objArea = (2 * ro + 1) ** 2;
  idx.forEach((k, i) => { if (res[i] > thr && objB[k] <= 0.02 * objArea) hot[k] = res[i]; });
  const lab2 = new Int32Array(n).fill(-1);
  const keep: number[] = [];
  // vệt bóng CHÍNH: mảng đủ lớn, không nằm sát mép (mép móng sáng là ánh phản chiếu phụ, vẫn giữ) — thiếu thì vẽ tổng hợp
  let main = false;
  let comps = 0;
  for (const k0 of idx) {
    if (hot[k0] < 0 || lab2[k0] >= 0) continue;
    const stack = [k0], pix: number[] = [];
    lab2[k0] = comps;
    let aMin = Infinity, aMax = -Infinity, tMin = Infinity, tMax = -Infinity;
    while (stack.length) {
      const k = stack.pop()!;
      pix.push(k);
      aMin = Math.min(aMin, cy(k)); aMax = Math.max(aMax, cy(k)); tMin = Math.min(tMin, cx(k)); tMax = Math.max(tMax, cx(k));
      const xx = k % w, yy = (k - xx) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = xx + dx, ny = yy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const kk = ny * w + nx;
        if (hot[kk] >= 0 && lab2[kk] < 0) { lab2[kk] = comps; stack.push(kk); }
      }
    }
    comps++;
    if (aMax - aMin < 0.22 || tMax - tMin > 0.4 || pix.length < 0.004 * idx.length) continue;
    // hướng chính của mảng (theo px thật) phải gần song song trục móng (≤ 14°): khúc chỉ bạc / nét vẽ chéo bị loại
    let mx = 0, my = 0;
    for (const k of pix) { mx += cx(k) * seg.hw; my += cy(k) * seg.L; }
    mx /= pix.length; my /= pix.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const k of pix) { const dx = cx(k) * seg.hw - mx, dy = cy(k) * seg.L - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const ang = Math.abs(0.5 * Math.atan2(2 * sxy, syy - sxx)); // 0 = dọc trục móng
    if (ang > (14 * Math.PI) / 180) continue;
    // vệt bóng thật nằm trên mặt sơn TRƠN; ánh sáng mép của 1 nét chỉ bạc / kim loại cũ (đoạn chạy gần dọc móng) thì
    // luôn có LÕI TỐI của nét sát bên → bỏ (từng hiện thành "vết xước" trắng răng cưa trên mọi màu mới, ảnh white.jpg)
    let darkNb = 0;
    for (const k of pix) {
      const xx = k % w, yy = (k - xx) / w;
      let dk = false;
      for (let dy = -3; dy <= 3 && !dk; dy++) for (let dx = -3; dx <= 3; dx++) {
        const X2 = xx + dx, Y2 = yy + dy;
        if (X2 < 0 || Y2 < 0 || X2 >= w || Y2 >= h) continue;
        const kk = Y2 * w + X2;
        if (M[kk] && Yv[kk] - evalP(coef, cx(kk), cy(kk)) < -thr) { dk = true; break; }
      }
      if (dk) darkNb++;
    }
    if (darkNb > 0.25 * pix.length) continue;
    if (!whiteLight(pix)) continue;
    keep.push(...pix);
    if (Math.abs(mx / seg.hw) <= 0.6 && pix.length >= 0.008 * idx.length) main = true;
  }
  if (keep.length) {
    const R = new Float32Array(n);
    for (const k of keep) R[k] = hot[k];
    // vệt sáng gắt mép răng cưa của ảnh gốc → làm mềm (5×5) và không đẩy hẳn lên trắng (từng thành "vết xước" sắc)
    const rr = Math.max(2, Math.round(0.05 * seg.hw)), area = (2 * rr + 1) ** 2;
    const Rb = boxBlur(R, w, h, rr);
    for (let k = 0; k < n; k++) spec[k] = 0.85 * smooth(thr * 0.4, thr * 2.2, Rb[k] / area);
  }
  // ---- PHẢN CHIẾU MỀM THẬT của ảnh (ánh đèn / cửa sổ loang rộng trên mặt móng bóng): tách khỏi màu sơn cũ rồi CỘNG
  // lên màu mới (ánh phản chiếu là ánh sáng cộng thêm, không nhân theo màu sơn) → móng mới bóng y như ảnh thật, không
  // phải vệt trắng vẽ thêm. Mặt "đáy" = khớp bất đối xứng (điểm sáng hơn mặt bị giảm trọng số) → phần nhô lên = phản chiếu.
  let coefE = coef;
  {
    const we = new Float64Array(sample.length).fill(1);
    for (let it = 0; it < 5; it++) {
      const A = Array.from({ length: nb }, () => new Array(nb).fill(0)), bv = new Array(nb).fill(0);
      sample.forEach((k, i) => { const b = basis(cx(k), cy(k)), wt = we[i]; for (let r = 0; r < nb; r++) { bv[r] += wt * b[r] * Yv[k]; for (let c = 0; c < nb; c++) A[r][c] += wt * b[r] * b[c]; } });
      for (let r = 0; r < nb; r++) A[r][r] += 1e-3 * sample.length * (r === 0 ? 0 : 1);
      const sol = solve(A, bv);
      if (!sol) break;
      coefE = sol;
      const rr = sample.map((k) => Yv[k] - evalP(coefE, cx(k), cy(k)));
      const madE = Math.max(2, 1.4826 * median(rr.map(Math.abs)));
      rr.forEach((v, i) => { if (v > 0) we[i] = 0.08; else { const u = v / (4.685 * madE); we[i] = Math.abs(u) < 1 ? (1 - u * u) ** 2 : 0; } });
    }
  }
  const PE = new Float32Array(n), Rp = new Float32Array(n);
  for (const k of idx) {
    PE[k] = evalP(coefE, cx(k), cy(k));
    // chỉ phần sáng TRẮNG (cùng sắc móng, nhạt hơn) mới là ánh đèn — điểm đổi sắc / đậm màu hơn (lá vàng, charm màu)
    // bị loại TỪNG ĐIỂM trước khi làm mềm (gộp chung mảng với vệt bóng thật thì kiểm cả mảng không bắt được)
    const c = labAt(k), da = c[1] - nailLab[1], db = c[2] - nailLab[2];
    const perp = nC > 4 ? Math.abs(da * nailLab[2] - db * nailLab[1]) / nC : Math.hypot(da, db);
    const wl = 1 - smooth(4, 10, Math.max(Math.hypot(c[1], c[2]) - nC, perp));
    Rp[k] = objB[k] > 0.02 * objArea ? 0 : Math.max(0, Yv[k] - PE[k]) * wl;
  }
  const rb = Math.max(1, Math.round(0.07 * seg.hw));
  const RpB = boxBlur(Rp, w, h, rb), MB = boxBlur(M, w, h, rb);
  const Rlp = new Float32Array(n);
  for (const k of idx) Rlp[k] = MB[k] > 0 ? RpB[k] / MB[k] : 0; // làm mềm (bỏ chi tiết nhỏ: cạnh đá, mép chỉ)
  const sigE = Math.max(2, 1.4826 * median(idx.map((k) => Math.abs(Yv[k] - PE[k]))));
  const thrS = Math.max(5, 1.2 * sigE);
  const sheen = new Float32Array(n);
  const lab3 = new Int32Array(n).fill(-1);
  let sheenSum = 0;
  for (const k0 of idx) {
    if (Rlp[k0] <= thrS || lab3[k0] >= 0) continue;
    const stack = [k0], pix: number[] = [];
    lab3[k0] = 1;
    while (stack.length) {
      const k = stack.pop()!; pix.push(k);
      const xx = k % w, yy = (k - xx) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = xx + dx, ny = yy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const kk = ny * w + nx;
        if (M[kk] && Rlp[kk] > thrS && lab3[kk] < 0) { lab3[kk] = 1; stack.push(kk); }
      }
    }
    if (pix.length < 0.02 * idx.length) continue; // đốm nhỏ (đá, hạt nhũ cũ) — không phải phản chiếu
    let mx = 0, my = 0, ma = 0, aLo = Infinity, aHi = -Infinity;
    for (const k of pix) { mx += cx(k) * seg.hw; my += cy(k) * seg.L; ma += cy(k); aLo = Math.min(aLo, cy(k)); aHi = Math.max(aHi, cy(k)); }
    // phản chiếu đèn trên móng: dải DÀI theo móng hoặc mảng RỘNG; đốm sáng gọn tròn = vật đính cũ (giọt nước, đá)
    if (aHi - aLo < 0.28 && pix.length < 0.1 * idx.length) continue;
    mx /= pix.length; my /= pix.length; ma /= pix.length;
    // vùng sáng ở ĐẦU móng = đầu French trắng / mép tự do trắng của móng thật, không phải ánh đèn
    if (ma > 0.8) continue;
    let sxx = 0, syy = 0, sxy = 0;
    for (const k of pix) { const dx = cx(k) * seg.hw - mx, dy = cy(k) * seg.L - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const ang = Math.abs(0.5 * Math.atan2(2 * sxy, syy - sxx));
    const l1 = (sxx + syy) / 2 + Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy), l2 = Math.max(1e-6, (sxx + syy) / 2 - Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy));
    // dải NGANG móng dài (vạch / đầu French cũ) → bỏ; mảng tròn rộng hay dải dọc móng → phản chiếu thật
    if (ang > (35 * Math.PI) / 180 && l1 / l2 > 6) continue;
    let darkNb = 0;
    for (const k of pix) {
      const xx = k % w, yy = (k - xx) / w;
      let dk = false;
      for (let dy = -3; dy <= 3 && !dk; dy += 3) for (let dx = -3; dx <= 3; dx += 3) {
        const X2 = xx + dx, Y2 = yy + dy;
        if (X2 < 0 || Y2 < 0 || X2 >= w || Y2 >= h) continue;
        const kk = Y2 * w + X2;
        if (M[kk] && Yv[kk] - PE[kk] < -Math.max(14, 3 * sigE)) { dk = true; break; }
      }
      if (dk) darkNb++;
    }
    if (darkNb > 0.25 * pix.length) continue; // ánh của nét kim loại cũ (có lõi tối sát bên)
    if (!whiteLight(pix)) continue;
    // phản chiếu trên mặt gel TRƠN thì mịn; giọt nước / đá / nhũ cũ thì lởm chởm (chênh lớn giữa ảnh gốc và bản làm mềm)
    let rough = 0, lvl = 0;
    for (const k of pix) { rough += Math.abs(Rp[k] - Rlp[k]); lvl += Rlp[k]; }
    if (rough > 0.55 * lvl) continue;
    // dải DÀI dọc móng = ánh cửa sổ / đèn (phản chiếu thật, giữ đủ); mảng loang rộng trên móng màu sáng phần lớn là bóng
    // tối–sáng theo độ cong (đã có trong `shade`) → chỉ mượn 1 phần (mượn hết làm đen / đỏ rượu bạc màu, ΔE > 13)
    const streakLike = ang <= (22 * Math.PI) / 180 && l1 / l2 >= 3;
    const kS = streakLike ? 1 : 0.3;
    for (const k of pix) {
      // phần sáng thêm theo không gian TUYẾN TÍNH, mờ dần ở ngưỡng (không ra mép cứng)
      const add = LIN[Math.min(255, Math.round(PE[k] + Rlp[k]))] - LIN[Math.max(0, Math.min(255, Math.round(PE[k])))];
      sheen[k] = Math.max(0, add) * smooth(thrS, 2 * thrS, Rlp[k]) * kS;
      sheenSum += sheen[k];
    }
  }
  if (sheenSum > 0) { const sb = boxBlur(sheen, w, h, 1); for (let k = 0; k < n; k++) sheen[k] = sb[k] / 9; }
  // phía có đèn: vệt bóng thật nằm phía nào (móng lồi: vệt bóng ở phía hướng về đèn); không có vệt → mặt ánh sáng
  // sáng hơn bên nào; hoà → mặc định bên trái (đèn trần / cửa sổ chụp ảnh tay hay ở trên-trái)
  let side = -1;
  if (keep.length) side = keep.reduce((a, k) => a + cx(k), 0) / keep.length > 0.08 ? 1 : -1;
  else {
    let l = 0, nl = 0, r2 = 0, nr = 0;
    for (const k of idx) { const x = cx(k); if (x < -0.3) { l += shade[k]; nl++; } else if (x > 0.3) { r2 += shade[k]; nr++; } }
    if (nl > 10 && nr > 10 && r2 / nr - l / nl > 0.12) side = 1;
  }
  // có phản chiếu thật đủ rõ → không vẽ vệt bóng tổng hợp (ảnh thật đã có ánh đèn của nó)
  const real = main || sheenSum > 0.012 * idx.length;
  return { shade, spec, weight, streak: real, side, sheen };
}

/**
 * Kim loại tráng gương trên VẬT NHỎ CONG (giọt chrome, nơ, sao 3D): phản chiếu theo pháp tuyến 3D — 1 ô sáng lớn của
 * đèn, vùng tối quanh "đường chân trời", vành sáng (Fresnel). Dùng metalShade (dải softbox theo bề ngang móng) cho vật
 * nhỏ sẽ ra sọc như viên bi sọc (vòng trước).
 */
function sphereMetal(tint: RGB, nx: number, ny: number, nz: number, L: number[], side: number): RGB {
  const mx = Math.max(tint[0], tint[1], tint[2], 1e-3);
  const f0: RGB = [0.25 + (0.75 * tint[0]) / mx, 0.25 + (0.75 * tint[1]) / mx, 0.25 + (0.75 * tint[2]) / mx];
  const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1; // tia phản xạ của hướng nhìn (0,0,1)
  const toL = Math.max(0, rx * L[0] + ry * L[1] + rz * L[2]);
  const env = 0.06 + 1.5 * Math.pow(toL, 10) + 0.32 * smooth(-0.3, 0.9, ry * 0.7 + rx * side * 0.5) + 0.38 * Math.pow(1 - Math.max(0, nz), 2.2);
  const hot = smooth(0.85, 1.45, env) * 0.7;
  const ch = (f: number) => { const c = Math.min(1, f * env); return c + (1 - c) * hot; };
  return [ch(f0[0]), ch(f0[1]), ch(f0[2])];
}

/** Sợi kim loại tròn mảnh (line vàng / bạc nổi): `n` = vị trí ngang trên sợi (-1…1). */
function wireShade(tint: RGB, n: number, shade: number, side: number): RGB {
  const mx = Math.max(tint[0], tint[1], tint[2], 1e-3);
  const f0: RGB = [0.25 + (0.75 * tint[0]) / mx, 0.25 + (0.75 * tint[1]) / mx, 0.25 + (0.75 * tint[2]) / mx];
  const env = 0.2 + 1.15 * Math.exp(-(((n - side * 0.28) / 0.5) ** 2)) - 0.12 * n * n + 0.1 * smooth(-1, 1, shade);
  const hot = smooth(0.95, 1.4, env) * 0.6;
  const ch = (f: number) => { const c = Math.min(1, f * env); return c + (1 - c) * hot; };
  return [ch(f0[0]), ch(f0[1]), ch(f0[2])];
}

/**
 * KIM LOẠI TRÁNG GƯƠNG thật (chrome bạc / vàng / vàng hồng): mặt kim loại phản chiếu "phòng chụp" — 1 dải softbox
 * sáng gắt phía có đèn, 1 dải mảnh phía đối diện, trần sáng mờ, mép phản chiếu mạnh (Fresnel), phần còn lại TỐI.
 * Độ tương phản cao này mới ra chất gương (tô phẳng màu #c0c0c0 chỉ ra màu xám lì). `q`: hướng pháp tuyến theo bề
 * ngang (-1…1; móng cong → q ≈ t; nét kim loại nổi → cộng thêm độ cong của chính nét), `v`: vị trí dọc móng.
 * Màu: bạc trung tính; vàng / vàng hồng — phần tối nhuộm đậm màu kim loại, điểm cháy sáng gần trắng ánh màu.
 */
function metalShade(tint: RGB, q: number, v: number, shade: number, side: number): RGB {
  const mx = Math.max(tint[0], tint[1], tint[2], 1e-3);
  const f0: RGB = [0.25 + (0.75 * tint[0]) / mx, 0.25 + (0.75 * tint[1]) / mx, 0.25 + (0.75 * tint[2]) / mx];
  const qq = q * side; // đổi chiều để softbox chính (qq ≈ +0.42) luôn ở phía có đèn của ảnh
  const env = 0.042
    + 1.25 * Math.exp(-(((qq - 0.42) / 0.15) ** 2))
    + 0.45 * Math.exp(-(((qq + 0.52) / 0.08) ** 2))
    + 0.5 * Math.exp(-(((qq + 0.02) / 0.5) ** 2)) * (0.75 + 0.25 * Math.sin(3.2 * v + 1))
    + 0.28 * smooth(0.62, 1.05, Math.abs(q))
    + 0.1 * smooth(-1, 1, shade);
  const hot = smooth(0.85, 1.45, env) * 0.7;
  const ch = (f: number) => { const c = Math.min(1, f * env); return c + (1 - c) * hot; };
  return [ch(f0[0]), ch(f0[1]), ch(f0[2])];
}

/** Màu DA ngay ngoài mép móng cho từng điểm mép (0 < độ phủ < 1): trung bình các điểm ngoài khuôn trong bán kính 2px. */
function edgeUnder(img: Img, seg: NailSeg): Map<number, [number, number, number]> {
  const m = new Map<number, [number, number, number]>();
  const { w, h } = seg;
  // độ sáng da quanh móng (trung vị vành 3–6px ngoài mép) — điểm sẫm hơn hẳn là viền móng sẫm cũ còn sót, không lấy làm "da"
  const ringL: number[] = [];
  for (let k = 0; k < w * h; k += 2) {
    if (seg.alpha[k] > 0) continue;
    const xx = k % w, yy = (k - xx) / w;
    let near = false;
    for (let dy = -6; dy <= 6 && !near; dy += 3) for (let dx = -6; dx <= 6; dx += 3) { const X = xx + dx, Y = yy + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && seg.alpha[Y * w + X] >= 0.5) { near = true; break; } }
    if (near) ringL.push(luma(img.data, ((seg.y0 + yy) * img.w + seg.x0 + xx) * 4));
  }
  const skinL = ringL.length ? median(ringL) : 0;
  for (let k = 0; k < w * h; k++) {
    const a = seg.alpha[k];
    if (a <= 0 || a >= 1) continue;
    const xx = k % w, yy = (k - xx) / w;
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const X = xx + dx, Y = yy + dy;
      if (X < 0 || Y < 0 || X >= w || Y >= h || seg.alpha[Y * w + X] > 0) continue;
      const i = ((seg.y0 + Y) * img.w + seg.x0 + X) * 4;
      if (skinL && luma(img.data, i) < skinL - 35) continue;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
    if (n >= 2) m.set(k, [r / n, g / n, b / n]);
  }
  return m;
}

/** Khoảng cách (px, xấp xỉ Euclid — chamfer 2 lượt) từ mỗi điểm trong móng tới mép mặt nạ gần nhất. */
function edgeDistance(seg: NailSeg): Float32Array {
  const { w, h, alpha } = seg, d = new Float32Array(w * h), D2 = Math.SQRT2;
  for (let k = 0; k < w * h; k++) d[k] = alpha[k] >= 0.5 ? 1e6 : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; if (!d[k]) continue;
    d[k] = Math.min(d[k], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D2, at(x + 1, y - 1) + D2);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const k = y * w + x; if (!d[k]) continue;
    d[k] = Math.min(d[k], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D2, at(x - 1, y + 1) + D2);
  }
  return d;
}

/** Lớp nhũ: các hạt tròn kích cỡ khác nhau (không còn ô vuông 2×2), mỗi hạt sáng / tối ngẫu nhiên. */
function glitterLayer(seg: NailSeg, seed: number): Float32Array {
  const { w, h } = seg, out = new Float32Array(w * h);
  let area = 0;
  for (let k = 0; k < w * h; k++) if (seg.alpha[k] > 0) area++;
  const count = Math.round(area * 0.045);
  for (let i = 0; i < count; i++) {
    const x = hash2(i, 1, seed) * w, y = hash2(i, 2, seed) * h;
    const rad = 0.55 + 1.1 * hash2(i, 3, seed) ** 2, amp = 0.25 + 0.75 * hash2(i, 4, seed) ** 1.5;
    const R = Math.ceil(rad + 1);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const X = Math.round(x) + dx, Y = Math.round(y) + dy;
      if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const d = Math.hypot(X - x, Y - y);
      const v = amp * Math.max(0, 1 - d / (rad + 0.5)) ** 1.5;
      if (v > out[Y * w + X]) out[Y * w + X] = v;
    }
  }
  return out;
}

function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number, seed: number) => 0.5 * vnoise(x, y, seed) + 0.3 * vnoise(2.1 * x + 7, 2.1 * y, seed + 1) + 0.2 * vnoise(4.3 * x, 4.3 * y + 3, seed + 2);
type RGB = [number, number, number];
const mix3 = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/**
 * Hạt tròn 3D (ngọc trai / đá / chấm) + HOẠ TIẾT VẼ TAY trên móng: vị trí (u dọc từ chân móng, t ngang) + bán kính r theo
 * nửa bề ngang móng. Hoạ tiết vẽ tay: r = NỬA CỠ NHÌN THẤY (mọi hình đã chuẩn hoá vừa khung [-1, 1]²) → đặt r 0.6 là hình
 * rộng đúng ~60% móng (bản cũ hình chỉ lấp ~½ r: ma r 0.82 chỉ rộng ~45% móng, đầu lâu ~30% — sticker tí hon).
 * flip: lật ngang hình (móng "vọng" đối xứng với móng chính).
 */
type PaintedKind = "ghost" | "pumpkin" | "bat" | "moon" | "flake" | "cherry" | "flower" | "cat" | "skull" | "leaf" | "pflower" | "heart" | "holly" | "ornament" | "gelflower" | "bud" | "gleaf" | "pdot";
interface Bead { u: number; t: number; r: number; kind: "pearl" | "gem" | "dot" | "drop" | "mdrop" | "star" | "bow" | "eye" | PaintedKind; rot?: number; tint?: number; flip?: boolean }
const PAINTED = new Set<string>(["ghost", "pumpkin", "bat", "moon", "flake", "cherry", "flower", "cat", "skull", "leaf", "pflower", "heart", "holly", "ornament", "gelflower", "bud", "gleaf", "pdot"]);
/** Hoạ tiết HỮU CƠ (lá, hoa, nụ, bông tuyết, chấm): xoay theo trục móng và được mép móng cắt bớt (thợ vẽ tràn mép). Còn
 *  lại là NHÂN VẬT / ĐỒ VẬT (ma, mèo, đầu lâu, bí ngô, quả châu, hoa gel 3D…): luôn đứng thẳng trong ảnh, KHÔNG bao giờ bị
 *  mép móng cắt (bị cắt nhìn như decal dán lệch). */
const ORGANIC = new Set<string>(["leaf", "flower", "bud", "gleaf", "flake", "pflower", "pdot"]);

/** Ngôi sao 5 cánh (cánh hướng về đầu móng): khoảng cách có dấu tới mép (âm = trong), đơn vị = bán kính ngoài. */
function starSD(x: number, y: number): number {
  const beta = Math.PI / 5;
  let a = Math.atan2(x, y);
  const rho = Math.hypot(x, y);
  a = ((a % (2 * beta)) + 2 * beta) % (2 * beta);
  if (a > beta) a = 2 * beta - a;
  const qx = rho * Math.sin(a), qy = rho * Math.cos(a);
  const p2x = 0.47 * Math.sin(beta), p2y = 0.47 * Math.cos(beta);
  const ex = p2x, ey = p2y - 1, el = Math.hypot(ex, ey);
  let nx = ey / el, ny = -ex / el;
  if (nx * p2x + ny * (1 + p2y) < 0) { nx = -nx; ny = -ny; }
  return qx * nx + (qy - 1) * ny;
}
/** Trái tim (2 thuỳ phía trên): giá trị ẩn chia độ dốc ≈ khoảng cách (âm = trong), chuẩn hoá nửa bề ngang = 1, canh giữa dọc. */
function heartSD(x: number, y: number): number {
  const f = (X: number, Y: number) => { const a = X * X + Y * Y - 1; return a * a * a - X * X * Y * Y * Y; };
  const X = x * 1.14, Y = y * 1.14 + 0.1, e = 0.01;
  const v = f(X, Y), gx = (f(X + e, Y) - f(X - e, Y)) / (2 * e), gy = (f(X, Y + e) - f(X, Y - e)) / (2 * e);
  return v / Math.max(0.05, Math.hypot(gx, gy)) / 1.14;
}
/** khoảng cách từ điểm tới đoạn thẳng (a → b) */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
  return Math.hypot(x - ax - k * dx, y - ay - k * dy);
}
const ellSD = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
const smin = (a: number, b: number, k: number) => { const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k)); return b + (a - b) * h - k * h * (1 - h); };
/** lá nhọn 2 đầu (giao 2 cung tròn — đúng dáng 1 nét cọ dẹt): p dọc trục lá, q ngang, nửa dài a, nửa rộng b */
const vesica = (p: number, q: number, a: number, b: number) => { const R = (a * a + b * b) / (2 * b); return Math.hypot(p, Math.abs(q) + R - b) - R; };
/** nét cọ thon theo đường cong bậc 2 (a → điều khiển b → c): rộng w0 ở đầu → w1 ở cuối */
function qStroke(x: number, y: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, w0: number, w1: number, n: number): number {
  const m = Math.max(w0, w1) + 0.3; // xa hẳn nét → bỏ qua (khoảng cách thật ≥ 0.3: không ảnh hưởng khử răng cưa)
  if (x < Math.min(ax, bx, cx) - m || x > Math.max(ax, bx, cx) + m || y < Math.min(ay, by, cy) - m || y > Math.max(ay, by, cy) + m) return 9;
  let best = 9, x0 = ax, y0 = ay;
  for (let i = 1; i <= n; i++) {
    const q = i / n, iq = 1 - q, x1 = iq * iq * ax + 2 * iq * q * bx + q * q * cx, y1 = iq * iq * ay + 2 * iq * q * by + q * q * cy;
    best = Math.min(best, segDist(x, y, x0, y0, x1, y1) - (w0 + ((w1 - w0) * (i - 0.5)) / n));
    x0 = x1; y0 = y1;
  }
  return best;
}
/**
 * tham số phụ của paintedSD — gán trước mỗi lần gọi (không tạo object trong vòng lặp điểm ảnh): px = 1 điểm ảnh theo đơn
 * vị hoạ tiết (nét mảnh có SÀN theo px — mảnh hơn ~2px là nhoè thành bụi khi thu nhỏ ảnh), lx / ly = hướng đèn trong khung
 * hoạ tiết (đốm bóng, nửa lá tối), v = biến thể (hoa đào, đầu lâu đen trên nền sáng, dây treo quả châu).
 */
const PS = { px: 0.03, lx: -0.6, ly: 0.8, v: 0 };
/** đốm bóng vẽ tay trên vật tròn (cherry, quả châu, quả ô rô): vệt trắng thuôn CONG theo mép phía đèn, không phải chấm tròn */
const glint = (x: number, y: number, cx: number, cy: number, rr: number) => {
  const dx = x - cx - PS.lx * 0.5 * rr, dy = y - cy - PS.ly * 0.5 * rr;
  const ta = -dx * PS.ly + dy * PS.lx, ra = dx * PS.lx + dy * PS.ly + (ta * ta) / rr;
  const b = Math.max(0.12 * rr, 1.1 * PS.px);
  return (Math.hypot(ta / (0.36 * rr), ra / b) - 1) * b;
};
/** lá phong: [góc thuỳ (0 = lên), dài, nửa bề rộng góc] — thuỳ nhọn ĐẦY ĐẶN, khe giữa thuỳ nông vừa */
const MAPLE: [number, number, number][] = [[0, 1, 0.62], [1.08, 0.93, 0.6], [-1.08, 0.93, 0.6], [2.2, 0.6, 0.5], [-2.2, 0.6, 0.5]];
/** ô rô: 2 lá xoè chữ V từ gốc (0, −0.14): [tâm x, tâm y, góc trục lá] + 3 quả chụm ở gốc */
const HOLLY: [number, number, number][] = [[-0.45, 0.17, 2.53], [0.5, 0.13, 0.5]];
const BERRY: [number, number][] = [[-0.15, -0.22], [0.15, -0.2], [0.0, -0.45]];
/**
 * HOẠ TIẾT VẼ TAY — nhiều LỚP khoảng cách có dấu (âm = trong; đơn vị = bán kính hoạ tiết; trục y hướng lên), ghi vào `o`:
 * o[0] thân chính (viền liner, bóng vẽ, đổ bóng vẽ) · o[1..4] các lớp vẽ đè (mắt, cuống, lá, đốm bóng…) · o[5] bóng hình
 * để soát mép móng có cắt vào không · o[6] tông sáng (+) / tối (−) của thân. Mỗi lớp có khoảng cách riêng → mép nào
 * cũng khử răng cưa theo điểm ảnh (bản cũ đổi màu mắt / mặt đột ngột trong thân → răng cưa, chi tiết nhoè).
 */
function paintedSD(kind: string, x: number, y: number, o: Float64Array): void {
  o[0] = o[1] = o[2] = o[3] = o[4] = o[5] = 9; o[6] = 0;
  const px = PS.px;
  switch (kind) {
    case "ghost": {
      // ma dễ thương: đầu tròn, thân hơi loe, vạt dưới 3 đuôi thon như giọt chảy, vạt bay nhẹ 1 bên (đang lướt) · 2 mắt bầu
      // dục đen + miệng tròn "o" + má hồng
      x += 0.05;
      const yb = Math.max(0, 0.27 - y), xb = x - 0.05 * Math.pow(yb, 1.5);
      const tail = Math.pow(0.5 + 0.5 * Math.cos(((xb + 0.02) * 2 * Math.PI) / 0.44), 1.6);
      const body = Math.min(Math.hypot(xb, y - 0.27) - 0.64, Math.max(Math.abs(xb) - 0.64 - 0.06 * yb, y - 0.27, (-0.72 - 0.22 * tail - y) * 0.75));
      o[0] = o[5] = body;
      o[1] = Math.max(Math.min(ellSD(x, y, -0.21, 0.3, 0.09, 0.135), ellSD(x, y, 0.21, 0.3, 0.09, 0.135), ellSD(x, y, 0, 0.05, 0.075, 0.1)), body);
      o[2] = Math.max(Math.min(ellSD(x, y, -0.4, 0.12, 0.11, 0.065), ellSD(x, y, 0.4, 0.12, 0.11, 0.065)), body);
      break;
    }
    case "pumpkin": {
      // bí ngô: 3 múi (múi giữa đè 2 múi bên; mỗi múi tối dần về mép riêng → nếp lõm giữa 2 múi tự hiện, như thợ vẽ 2 tông
      // cam) · cuống cong · dây leo xoắn · mặt cười đen: 2 mắt + mũi tam giác, miệng 2 răng
      y += 0.07;
      const cL = ellSD(x, y, 0, -0.1, 0.46, 0.64), body = Math.min(cL, ellSD(x, y, -0.43, -0.13, 0.52, 0.57), ellSD(x, y, 0.43, -0.13, 0.52, 0.57));
      const tC = -0.38 * smooth(0.4, 1, Math.hypot(x / 0.46, (y + 0.1) / 0.64)), tS = -0.14 - 0.36 * smooth(0.35, 1, Math.hypot((Math.abs(x) - 0.43) / 0.52, (y + 0.13) / 0.57));
      o[0] = body; o[6] = tC + (tS - tC) * smooth(-0.015, 0.015, cL);
      const eye = (cx: number) => Math.max(0.02 - y, y - 0.22 + 1.5 * Math.abs(x - cx)) * 0.55;
      const nose = Math.max(-0.12 - y, y - 0.0 + 1.5 * Math.abs(x)) * 0.55;
      const up = -0.19 + 0.3 * x * x, lo = -0.37 + 0.6 * x * x;
      const mouth = Math.max(y - up, lo - y, Math.abs(x) - 0.34, -Math.max(Math.abs(x + 0.11) - 0.05, y - up, up - 0.08 - y), -Math.max(Math.abs(x - 0.12) - 0.05, lo - y, y - lo - 0.08)) * 0.8;
      o[1] = Math.max(Math.min(eye(-0.2), eye(0.2), nose, mouth), body + 0.03);
      o[2] = qStroke(x, y, 0, 0.45, -0.03, 0.68, 0.09, 0.86, 0.085, 0.055, 4);
      let vine = 9;
      if (Math.hypot(x - 0.3, y - 0.7) < 0.65) {
        let vx0 = 0.04, vy0 = 0.6;
        for (let i = 0; i <= 12; i++) {
          const q = i / 12, th = 3.6 + 7 * q, rr = 0.22 * (1 - 0.62 * q), vx = 0.36 + rr * Math.cos(th), vy = 0.72 + rr * Math.sin(th);
          vine = Math.min(vine, segDist(x, y, vx0, vy0, vx, vy) - Math.max(0.03 - 0.012 * q, 0.85 * px));
          vx0 = vx; vy0 = vy;
        }
      }
      o[3] = vine; o[5] = Math.min(body, o[2], vine);
      break;
    }
    case "bat": {
      // dơi: thân + đầu + 2 tai nhọn; cánh dày, mép trên dốc lên đầu cánh, mép dưới 3 cung lõm (xương cánh) — dáng dễ nhận
      const ax = Math.abs(x);
      const body = Math.min(ellSD(x, y, 0, -0.06, 0.15, 0.27), Math.hypot(x, y - 0.2) - 0.13);
      const ear = Math.max(0.24 - y, y - 0.41 + 2.4 * Math.abs(ax - 0.075)) * 0.6;
      let wing = 9;
      if (ax >= 0.06 && ax <= 1.02) {
        const tn = Math.min(1, (ax - 0.06) / 0.94), upper = 0.1 + 0.4 * tn - 0.14 * tn * tn;
        const lower = upper - 0.62 * Math.pow(1 - tn, 0.7) - 0.05 + 0.15 * Math.abs(Math.sin(Math.PI * 3 * tn));
        wing = Math.max(y - upper, lower - y, ax - 1) * 0.7;
      }
      o[0] = o[5] = Math.min(body, ear, wing);
      break;
    }
    case "moon": { const xm = x - 0.07; o[0] = o[5] = Math.max(Math.hypot(xm, y) - 1, 0.82 - Math.hypot(xm - 0.42, y - 0.18)); break; }
    case "flake": {
      // bông tuyết 6 cánh nét cọ mảnh + nhánh chữ V + chấm đầu cánh + vòng nhỏ giữa; bông nhỏ (< 9px) chỉ còn 6 tia trơn —
      // nhánh ở cỡ đó nhoè thành dấu * lem
      const a = Math.atan2(x, y), rho = Math.hypot(x, y), sec = Math.PI / 3;
      let f = ((a % sec) + sec) % sec; if (f > sec / 2) f = sec - f;
      const qx = rho * Math.sin(f), qy = rho * Math.cos(f), aw = Math.max(0.065, 0.9 * px);
      let arm = segDist(qx, qy, 0, 0, 0, 0.9) - aw;
      if (px < 0.11) arm = Math.min(arm, segDist(qx, qy, 0, 0.45, 0.2, 0.64) - aw * 0.85, segDist(qx, qy, 0, 0.68, 0.13, 0.8) - aw * 0.8, Math.hypot(qx, qy - 0.92) - aw * 1.7, Math.abs(rho - 0.2) - aw * 0.7);
      o[0] = o[5] = arm;
      break;
    }
    case "pdot": o[0] = o[5] = Math.hypot(x, y) - 1; break;
    case "cherry": {
      // cặp cherry: 2 quả đỏ (đổ bóng tròn phía khuất đèn + vệt bóng trắng cong theo mép) · 2 cuống cong chụm 1 gốc · lá
      // nhọn 2 tông (gân giữa là ranh 2 tông)
      x += 0.02;
      o[0] = Math.min(Math.hypot(x + 0.42, y + 0.44) - 0.37, Math.hypot(x - 0.36, y + 0.54) - 0.37);
      const sw = Math.max(0.033, 0.9 * px);
      o[1] = Math.min(qStroke(x, y, -0.4, -0.1, -0.26, 0.4, 0.1, 0.74, sw * 1.15, sw * 0.85, 6), qStroke(x, y, 0.35, -0.2, 0.3, 0.36, 0.1, 0.74, sw * 1.15, sw * 0.85, 6));
      const ca = Math.cos(-1.2), sa = Math.sin(-1.2), lp = (x - 0.36) * -sa + (y - 0.84) * ca, lq = (x - 0.36) * ca + (y - 0.84) * sa;
      const leaf = vesica(lp, lq, 0.28, 0.12);
      o[2] = leaf; o[3] = Math.max(leaf, PS.lx * ca + PS.ly * sa > 0 ? lq : -lq);
      o[4] = Math.min(glint(x, y, -0.42, -0.44, 0.37), glint(x, y, 0.36, -0.54, 0.37));
      o[5] = Math.min(o[0], o[1], leaf);
      break;
    }
    case "cat": {
      // mèo đen NGỒI (dáng quả lê): mông rộng tròn → lưng thon dần → đầu liền thân (không thắt cổ — 2 hình tròn chồng
      // nhau từng nhìn như người tuyết / con bọ), 2 tai nhọn hơi xoè, đuôi to ở gốc cong vòng lên 1 bên, 2 mắt vàng; ngồi
      // trên 1 nét cọ đen thon 2 đầu. Hình gốc cao 1.34 → phóng cho nửa cao = 1
      const k = 0.67, X = x * k + 0.15, Y = y * k + 0.03;
      const hip = ellSD(X, Y, 0, -0.36, 0.4, 0.32), chest = ellSD(X, Y, 0, -0.04, 0.22, 0.3);
      const body = Math.max(smin(hip, chest, 0.16), -(Y + 0.64)); // đáy phẳng (đang ngồi)
      const head = ellSD(X, Y, 0, 0.34, 0.26, 0.22);
      const ear = (sx: number) => { const ax = sx * 0.21, ay = 0.7, bx = sx * 0.04, by = 0.46, cx2 = sx * 0.26, cy2 = 0.36; // tam giác đỉnh (ax, ay)
        const e1 = ((bx - ax) * (Y - ay) - (by - ay) * (X - ax)) * sx, e2 = ((cx2 - bx) * (Y - by) - (cy2 - by) * (X - bx)) * sx, e3 = ((ax - cx2) * (Y - cy2) - (ay - cy2) * (X - cx2)) * sx;
        return -Math.min(e1, e2, e3) * 2.4; };
      const sil = smin(smin(body, head, 0.07), Math.min(ear(-1), ear(1)), 0.03);
      // đuôi: đường cong bậc 2 từ mông phải vòng ra ngoài rồi uốn lên, thon dần về chóp
      let tail = 9, tx0 = 0.3, ty0 = -0.58;
      for (let i = 1; i <= 10; i++) {
        const q = i / 10, iq = 1 - q, tx = iq * iq * 0.3 + 2 * iq * q * 0.78 + q * q * 0.5, ty = iq * iq * -0.58 + 2 * iq * q * -0.6 + q * q * 0.02;
        tail = Math.min(tail, segDist(X, Y, tx0, ty0, tx, ty) - (0.095 - 0.045 * (i - 1) / 10));
        tx0 = tx; ty0 = ty;
      }
      const d = smin(sil, tail, 0.04), gx = Math.abs(X - 0.15);
      o[0] = o[5] = d / k;
      o[1] = Math.max(Math.min(ellSD(X, Y, -0.1, 0.33, 0.06, 0.045), ellSD(X, Y, 0.1, 0.33, 0.06, 0.045)), d) / k;
      o[2] = Math.max(Math.abs(Y + 0.66 + 0.03 * gx * gx) - Math.max(0.032 * (1 - smooth(0.45, 0.95, gx)), 0.6 * px * k), gx - 0.95) / k;
      break;
    }
    case "skull": {
      // đầu lâu: sọ tròn + hàm vuông bo góc · 2 hốc mắt to · mũi tam giác ngược · răng (nét kẻ có sàn ~1.6px). Nền tối → sọ
      // trắng ngà, nét đen; nền sáng (v) → sọ ĐEN, hốc mắt / mũi / răng khoét lộ màu nền (như thợ vẽ trên nude)
      const k = 0.72, X = x * k, Y = y * k + 0.09;
      const sk = smin(Math.hypot(X, Y - 0.18) - 0.62, Math.max(Math.abs(X) - 0.34, Math.abs(Y + 0.36) - 0.24) - 0.05, 0.08);
      const eyes = Math.min(ellSD(X, Y, -0.235, 0.08, 0.165, 0.15), ellSD(X, Y, 0.235, 0.08, 0.165, 0.15));
      const nose = Math.max(Y + 0.1, -0.25 + 2 * Math.abs(X) - Y) * 0.45, lw = Math.max(0.022, 0.8 * px * k);
      const teeth = Math.min(Math.max(Math.min(Math.abs(X + 0.12), Math.abs(X), Math.abs(X - 0.12)) - lw, Math.abs(Y + 0.49) - 0.1), Math.max(Math.abs(Y + 0.49) - lw, Math.abs(X) - 0.25));
      const feat = Math.min(eyes, nose, teeth);
      if (PS.v) o[0] = Math.max(sk, -feat) / k;
      else { o[0] = sk / k; o[1] = Math.max(feat, sk) / k; }
      o[5] = sk / k;
      break;
    }
    case "leaf": {
      // LÁ PHONG vẽ tay: 5 thuỳ nhọn ĐẦY ĐẶN (thuỳ trên + 2 thuỳ bên dài, 2 thuỳ dưới ngắn), mép răng cưa nhỏ ở phần ngoài
      // thuỳ, tông sáng dần ra chóp thuỳ (như lá loang 2 màu); nửa lá phía khuất đèn tông đậm thay cho gân mảnh 1px (nhoè).
      // Gân chỉ còn ở lá to (≥ 22px, nét ≥ 2px). Thuỳ mảnh kiểu cũ ở cỡ móng nhìn như cỏ ba lá tím. Lá nhỏ (< 12px): lá
      // nhọn đơn giản (thuỳ phong ở cỡ đó nhoè)
      const stem = qStroke(x, y, 0, -0.2, 0.03, -0.62, 0.12, -0.98, Math.max(0.05, 1.1 * px), Math.max(0.035, 0.85 * px), 4);
      let leaf: number, vein = 9;
      const rho = Math.hypot(x, y - 0.04);
      if (px > 0.085) leaf = vesica(y - 0.06, x, 0.9, 0.42);
      else {
        const a = Math.atan2(x, y - 0.04);
        let rm = 0.46;
        for (const [ai, li, wi] of MAPLE) { let da = Math.abs(a - ai); if (da > Math.PI) da = 2 * Math.PI - da; const q = Math.max(0, 1 - da / wi); rm = Math.max(rm, 0.46 + (li - 0.46) * q); }
        rm += 0.06 * (Math.abs((((a * 24) / Math.PI) % 2 + 2) % 2 - 1) - 0.5) * smooth(0.55, 0.8, rm); // răng cưa
        leaf = (rho - rm) * 0.6;
        if (px < 0.045) {
          for (const [ai, li] of MAPLE) vein = Math.min(vein, segDist(x, y, 0, 0.04, li * 0.72 * Math.sin(ai), 0.04 + li * 0.72 * Math.cos(ai)));
          vein = Math.max(vein - Math.max(0.022, 1.05 * px), leaf + 0.06);
        }
      }
      o[0] = leaf; o[1] = Math.max(leaf, PS.lx > 0 ? x : -x); o[2] = vein; o[3] = stem; o[5] = Math.min(leaf, stem);
      o[6] = 0.2 * smooth(0.45, 1, rho) - 0.12 * (1 - smooth(0.05, 0.4, rho));
      break;
    }
    case "gleaf": { const lf = vesica(y, x, 1, 0.34); o[0] = o[5] = lf; o[1] = Math.max(lf, PS.lx > 0 ? x : -x); break; }
    case "flower": {
      // hoa 5 cánh tròn vẽ 1 nét cọ: cánh đậm dần vào nhuỵ, sáng ở đầu cánh · nét ngăn mảnh giữa 2 cánh · nhuỵ có chấm.
      // v = hoa đào (Tết): đầu cánh có khía, nhuỵ sẫm + tua nhị mảnh chấm vàng
      const a = Math.atan2(y, x), rho = Math.hypot(x, y), sec = (2 * Math.PI) / 5;
      const f = ((a % sec) + sec) % sec - sec / 2, pa = rho * Math.cos(f), pc = rho * Math.sin(f);
      let petal = (Math.hypot((pa - 0.55) / 0.45, pc / 0.4) - 1) * 0.4;
      if (PS.v) petal = Math.max(petal, 0.13 - Math.hypot(pa - 1.04, pc));
      const body = Math.min(petal, rho - 0.32);
      o[0] = o[5] = body;
      o[6] = 0.3 * smooth(0.5, 1, rho) - 0.22 * (1 - smooth(0.22, 0.6, rho));
      o[1] = Math.max(rho * Math.sin(sec / 2 - Math.abs(f)) - Math.max(0.018, 0.6 * px), body + 0.02, 0.3 - rho);
      o[2] = rho - 0.25;
      if (px < 0.06) {
        if (PS.v) {
          const s8 = Math.PI / 4, g = ((a % s8) + s8) % s8 - s8 / 2, ga = rho * Math.cos(g), gc = rho * Math.sin(g);
          o[3] = Math.max(Math.abs(gc) - Math.max(0.012, 0.5 * px), Math.abs(ga - 0.32) - 0.1);
          o[4] = Math.hypot(ga - 0.43, gc) - Math.max(0.04, px);
        } else { const s6 = Math.PI / 3, g = ((a % s6) + s6) % s6 - s6 / 2; o[3] = Math.hypot(rho * Math.cos(g) - 0.14, rho * Math.sin(g)) - Math.max(0.035, 0.85 * px); }
      }
      break;
    }
    case "bud": {
      // nụ hoa khép: giọt thuôn nhọn đầu (sáng dần lên đầu nụ) + đài xanh răng cưa ôm gốc + cuống
      const body = smin(Math.hypot(x, y + 0.2) - 0.46, vesica(y - 0.12, x, 0.78, 0.4), 0.12);
      o[0] = body; o[6] = 0.22 * smooth(-0.1, 0.8, y) - 0.12 * (1 - smooth(-0.6, -0.1, y));
      o[1] = Math.max(body, y + 0.26 - 0.13 * Math.abs(Math.sin(x * 6.5)));
      o[2] = qStroke(x, y, 0, -0.6, 0.02, -0.82, 0.1, -1, Math.max(0.05, 0.9 * px), Math.max(0.04, 0.8 * px), 3);
      o[5] = Math.min(body, o[2]);
      break;
    }
    case "heart": o[0] = o[5] = heartSD(x, y); break;
    case "holly": {
      // nhành Ô RÔ (holly): 2 lá gai xoè chữ V — mép là chuỗi cung lõm giữa 4 gai nhọn, 2 tông (nửa khuất đèn đậm) + gân
      // giữa sáng — và 3 quả đỏ chụm ở gốc có vệt bóng. Nhành nằm ngang mảnh kiểu cũ nhìn như cọng rau trang trí
      let lv = 9, dk = 9, rib = 9;
      for (const [cx, cy, ang] of HOLLY) {
        const ca = Math.cos(ang), sa = Math.sin(ang), p = ((x - cx) * ca + (y - cy) * sa) / 0.56, q = -(x - cx) * sa + (y - cy) * ca;
        const fn = ((((p + 1) * 2) % 1) + 1) % 1;
        const w = 0.3 * Math.pow(Math.max(0, 1 - p * p), 0.45) * (1 - 0.34 * Math.pow(Math.sin(Math.PI * fn), 0.8));
        const d = Math.max(Math.abs(q) - w, (Math.abs(p) - 1) * 0.56) * 0.85;
        lv = Math.min(lv, d);
        dk = Math.min(dk, Math.max(d, -sa * PS.lx + ca * PS.ly > 0 ? q : -q));
        rib = Math.min(rib, Math.max(Math.abs(q) - Math.max(0.022, 0.75 * px), Math.abs(p) - 0.82, d + 0.03));
      }
      o[0] = lv; o[1] = dk; o[2] = rib;
      let br = 9, gl = 9;
      for (const [bx, by] of BERRY) { br = Math.min(br, Math.hypot(x - bx, y - by) - 0.17); gl = Math.min(gl, glint(x, y, bx, by, 0.17)); }
      o[3] = br; o[4] = gl; o[5] = Math.min(lv, br);
      break;
    }
    case "ornament": {
      // QUẢ CHÂU Giáng sinh: quả cầu bóng (đổ bóng tròn + vệt bóng cong lớn) · dải kim loại lượn ngang · viền kim loại ·
      // nắp + khoen kim loại · dây treo kéo tới mép đầu móng (v: đầu móng ở phía trên ảnh)
      const ball = Math.hypot(x, y + 0.1) - 0.72, nd = (x * PS.lx + (y + 0.1) * PS.ly) / 0.72;
      o[0] = ball; o[6] = 0.2 * smooth(0.2, 0.95, nd) - 0.45 * smooth(-0.15, -0.95, nd);
      o[1] = Math.max(Math.abs(y + 0.15 - 0.07 * Math.sin(x * 7)) - Math.max(0.07, 1.2 * px), ball + 0.01);
      o[2] = Math.min(Math.max(Math.abs(x) - 0.19, Math.abs(y - 0.68) - 0.08) - 0.025, Math.abs(Math.hypot(x, y - 0.86) - 0.075) - Math.max(0.022, 0.8 * px));
      if (PS.v) o[3] = Math.max(Math.abs(x) - Math.max(0.016, 0.7 * px), 0.93 - y);
      o[4] = glint(x, y, 0, -0.1, 0.72);
      o[5] = Math.min(ball, o[2]);
      break;
    }
    case "pflower": { // hoa khô ép trong lớp milk bath: phẳng, cánh mảnh
      const a = Math.atan2(y, x), rho = Math.hypot(x, y);
      o[0] = o[5] = (rho - (0.55 + 0.45 * Math.pow(Math.abs(Math.cos((5 * a) / 2)), 1.4))) * 0.6;
      o[1] = rho - 0.18;
      break;
    }
    case "gelflower": {
      // HOA GEL 3D: 5 cánh, mỗi cánh 1 vòm (dày dần ra mép ngoài, rãnh ấn giữa cánh) — o[1] = ĐỘ CAO (không phải khoảng
      // cách), o[2] = ngọc trai giữa hoa
      const sec = (2 * Math.PI) / 5;
      let sil = 9, hmax = 0;
      for (let i = 0; i < 5; i++) {
        const ca = Math.sin(i * sec), sa = Math.cos(i * sec), pa = (x * ca + y * sa - 0.5) / 0.5, pc = -x * sa + y * ca;
        const e = pa * pa + (pc / 0.37) ** 2;
        sil = Math.min(sil, (Math.sqrt(e) - 1) * 0.37);
        if (e < 1) hmax = Math.max(hmax, Math.sqrt(1 - e) * (0.7 + 0.3 * smooth(-0.6, 0.6, pa)) * (1 - 0.25 * Math.exp(-((pc / 0.05) ** 2)) * smooth(-0.7, 0.3, pa)));
      }
      const rho = Math.hypot(x, y);
      o[0] = o[5] = Math.min(sil, rho - 0.2); o[1] = hmax; o[2] = rho - 0.2;
      break;
    }
  }
}

// ---- bảng màu vẽ tay (sơn gel thật, không phải màu giao diện) + tương phản với nền
const hexLin = (h: string): RGB => hexToRgb(h).map((x) => LIN[x]) as RGB;
const sc3 = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const sameC = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 0.03;
const Lst = (c: RGB) => { const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
/** màu vẽ phải tách khỏi nền ≥ `min` L* (hoa oải hương trên xanh da trời, hoa hồng nhạt trên trắng sữa từng biến mất):
 *  còn chỗ thì sáng thêm, không thì đậm xuống (giữ sắc) */
function contrastOn(c: RGB, bg: RGB, min: number): RGB {
  const lb = Lst(bg), up = Lst(c) > lb ? lb + min <= 100 : lb < min;
  let x = c;
  for (let i = 0; i < 8 && Math.abs(Lst(x) - lb) < min; i++) x = up ? mix3(x, [1, 1, 1], 0.25) : sc3(x, 0.72);
  return x;
}
/** CIELAB từ RGB tuyến tính → ΔE: hoa bơ trên nude khác nhau chủ yếu ở SẮC (b*), đo mỗi L* thì bị coi là "trùng nền" */
const labOf = (c: RGB) => {
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const fx = f((0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.9505), fy = f(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]), fz = f((0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.089);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const dE = (a: RGB, b: RGB) => { const p = labOf(a), q = labOf(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
/** màu vẽ: lấy màu đầu tiên trong danh sách tách khỏi nền ≥ `min` ΔE, không có thì lấy màu tách nhất. KHÔNG làm tối màu
 *  sáng để ép tương phản (hoa bơ bị làm tối thành xám rêu) — đổi hẳn sang màu sơn khác */
function pickPaint(cands: RGB[], base: RGB, min: number): RGB {
  let best = cands[0], bd = -1;
  for (const c of cands) { const d = dE(c, base); if (d >= min) return c; if (d > bd) { bd = d; best = c; } }
  return best;
}
const PK = {
  white: hexLin("#f4f2ed"), black: hexLin("#151314"), liner: hexLin("#1d1b1c"), blush: hexLin("#f29aa8"),
  pumpkin: hexLin("#f07c1b"), pumpkinD: hexLin("#5e2306"), stem: hexLin("#4e3d19"), vine: hexLin("#3f7a26"),
  cherry: hexLin("#c8102e"), cherryD: hexLin("#4d0410"), leaf: hexLin("#3f7d2c"), leafD: hexLin("#23501b"), leafL: hexLin("#163812"),
  catEye: hexLin("#f2c230"), bone: hexLin("#e9e1d3"), vein: hexLin("#f0c66a"), fleaf: hexLin("#5f7f4a"),
  blossom: hexLin("#f4b6c2"), blossomC: hexLin("#8a2346"), blossomS: hexLin("#b0305a"), floralC: hexLin("#e9b949"),
  holly: hexLin("#2f6b3a"), hollyRib: hexLin("#86b273"), berry: hexLin("#b3122e"), milk: hexLin("#f3eee8"), pfC: hexLin("#ecc14f"),
  // cánh hoa dự phòng khi màu mẫu trùng nền: trắng kem, bơ, hồng phấn, tím oải hương, hồng đào đậm
  petals: ["#f7f3ee", "#f1cf5b", "#f29aa8", "#b9a3d9", "#d9607a"].map(hexLin),
  blossoms: ["#f4b6c2", "#e98aa0", "#d9607a", "#f7f3ee"].map(hexLin),
  ice: hexLin("#7fa3cc"), navy: hexLin("#1f2a44"),
};
/** lá thu: gỉ sắt / vàng nghệ / cam cháy / đỏ thẫm / vàng mù tạt / vàng nhạt — chỉ lấy màu tách hẳn khỏi nền (ΔE; lá gỉ
 *  sắt / đỏ thẫm trên nền nâu mocha thì chìm → tự sang tông vàng). Đỏ thẫm xếp sau: lá nhỏ đỏ thẫm dưới vệt bóng lớp top
 *  ngả tím (từng bị chê "cỏ ba lá tím") */
const LEAF_COLS = ["#b5532a", "#c8892b", "#9c3d12", "#7a1f1f", "#e3a33b", "#f0cf8a"].map(hexLin);
function leafCol(tint: number, base: RGB): RGB {
  const ok = LEAF_COLS.filter((c) => Math.abs(Lst(c) - Lst(base)) >= 18 || dE(c, base) >= 40); // lá nhỏ cần tách SÁNG TỐI, khác sắc thôi chưa đủ
  const pool = ok.length ? ok : [...LEAF_COLS].sort((a, b) => dE(b, base) - dE(a, base)).slice(0, 1);
  return pool[tint % pool.length];
}

/** 1 bước vẽ: tô lớp L (màu c hoặc kim loại); line: lớp VIỀN liner (tô kín hình L, đặt TRƯỚC lớp màu); ins: thu lớp này
 *  vào trong viền của lớp `ins` (1 bề liner); tone: tông o[6]; hi: vệt bóng trắng vẽ theo mép phía đèn; sh: đổ bóng vẽ phía
 *  khuất đèn; a: độ phủ */
interface POp { L: number; c?: RGB; a?: number; line?: boolean; ins?: number; metal?: boolean; tone?: boolean; hi?: number; sh?: number }
/** Bề ngang THẬT (px) theo từng đoạn dọc móng + vành điểm sát mép. `across` chuẩn hoá theo bề ngang TẠI CHỖ (móng thon
 *  về chân / đầu, nhọn ở móng đắp) → nhân seg.hw cố định thì hoạ tiết bị bóp méo ở 2 đầu móng. */
interface PGeo { s0: number; ds: number; hw: Float32Array; ring: Int32Array }
interface PFit { seg: NailSeg; geo: PGeo; s0: number; sx: number; R: number; cr: number; sr: number; fl: number; bound2: number; Lx: number; Ly: number; mLx: number; mLy: number; v: number; jit: number; lw: number; bev: number; hiD: number; hiW: number; ops: POp[]; pc: RGB }
const geoCache = new WeakMap<NailSeg, PGeo>(), pfits = new WeakMap<Bead, PFit>();
const PO = new Float64Array(8), PX = new Float64Array(8), PY = new Float64Array(8), PQ = new Float64Array(8);
const DP = new Float64Array(5), NX = new Float64Array(5), NY = new Float64Array(5);
/** mặt móng cong như 1 cung trụ: toạ độ ngang trên MẶT móng → hoạ tiết dồn hẹp dần về 2 mép (bám độ cong), không phẳng như decal */
const WK = 0.92;
const warpT = (t: number) => Math.asin(WK * Math.max(-1, Math.min(1, t))) / WK;
function paintGeo(seg: NailSeg, eDist: Float32Array): PGeo {
  const hit = geoCache.get(seg);
  if (hit) return hit;
  const NB = 40, n = seg.alpha.length;
  let sMin = 1e9, sMax = -1e9;
  for (let k = 0; k < n; k++) if (seg.alpha[k] >= 0.5) { const s = seg.along[k]; if (s < sMin) sMin = s; if (s > sMax) sMax = s; }
  if (sMax <= sMin) { sMin = 0; sMax = 1; }
  const ds = (sMax - sMin) / NB, acc = new Float64Array(NB * 5), ring: number[] = [];
  const aL = Math.hypot(seg.tip.x - seg.base.x, seg.tip.y - seg.base.y) || 1, vx = -(seg.tip.y - seg.base.y) / aL, vy = (seg.tip.x - seg.base.x) / aL;
  for (let k = 0; k < n; k++) {
    const al = seg.alpha[k];
    if (al <= 0.05) continue;
    if (eDist[k] < 2.2) ring.push(k);
    if (al < 0.5) continue;
    const xx = k % seg.w, yy = (k - xx) / seg.w, t = seg.across[k];
    const p = (seg.x0 + xx - seg.base.x) * vx + (seg.y0 + yy - seg.base.y) * vy;
    const b = Math.min(NB - 1, Math.max(0, Math.floor((seg.along[k] - sMin) / ds))) * 5;
    acc[b]++; acc[b + 1] += t; acc[b + 2] += p; acc[b + 3] += t * t; acc[b + 4] += t * p;
  }
  // mỗi đoạn: hồi quy px ngang theo t → số px cho 1 đơn vị t (= nửa bề ngang thật tại chỗ)
  const hw = new Float32Array(NB).fill(-1);
  for (let b = 0; b < NB; b++) {
    const c = acc[b * 5], den = c * acc[b * 5 + 3] - acc[b * 5 + 1] ** 2;
    if (c >= 8 && den > 1e-6 * c * c) { const sl = Math.abs((c * acc[b * 5 + 4] - acc[b * 5 + 1] * acc[b * 5 + 2]) / den); if (sl > 0.5) hw[b] = sl; }
  }
  for (let b = 0; b < NB; b++) if (hw[b] < 0) { let best = seg.hw, bd = 1e9; for (let c = 0; c < NB; c++) if (hw[c] > 0 && Math.abs(c - b) < bd) { bd = Math.abs(c - b); best = hw[c]; } hw[b] = -best; }
  for (let b = 0; b < NB; b++) hw[b] = Math.abs(hw[b]);
  const sm = hw.map((v, b) => (hw[Math.max(0, b - 1)] + 2 * v + hw[Math.min(NB - 1, b + 1)]) / 4);
  const g = { s0: sMin, ds, hw: sm, ring: Int32Array.from(ring) };
  geoCache.set(seg, g);
  return g;
}
const hwAt = (g: PGeo, s: number) => { const f = Math.max(0, Math.min(g.hw.length - 1.001, (s - g.s0) / g.ds - 0.5)), i = Math.floor(f); return g.hw[i] + (g.hw[i + 1] - g.hw[i]) * (f - i); };

/** Các bước vẽ (màu / viền / bóng) của 1 hoạ tiết theo màu nền móng — tính 1 lần mỗi hoạ tiết mỗi móng. */
function paintOps(kind: string, tint: number, base: RGB, c2: RGB, metal: RGB, pat: string, v: number): POp[] {
  const W = PK.white, K = PK.black, light = Lst(base) > 45;
  switch (kind) {
    // thứ tự: liner (tô kín hình) → lớp màu thu vào 1 bề viền (ins) → chi tiết vẽ đè (mắt, cuống, đốm bóng…)
    case "ghost": return [{ L: 0, c: PK.liner, line: true }, { L: 0, c: W, sh: 0.1, ins: 0 }, { L: 1, c: K }, { L: 2, c: PK.blush, a: 0.55 }];
    case "pumpkin": return [{ L: 0, c: PK.pumpkinD, line: true }, { L: 0, c: PK.pumpkin, tone: true, hi: 0.5, sh: 0.12, ins: 0 }, { L: 1, c: K }, { L: 2, c: PK.stem }, { L: 3, c: PK.vine }];
    // dơi đen trên nền sáng / cam; dơi kim loại chỉ trên nền tối (dơi bạc trên nude, dơi vàng trên đen từng gần như tàng hình)
    // (dơi đen KHÔNG có vệt bóng vẽ: cánh mỏng hơn 2 lần khoảng lùi của vệt → vệt chạy giữa cánh thành sọc xám)
    case "bat": return light ? [{ L: 0, c: K }] : [{ L: 0, metal: true }];
    case "moon": return [{ L: 0, metal: true }];
    // bông tuyết trắng; trên nền trắng sữa / sáng thì xanh băng (bạc trên trắng sữa nhạt gần như mất hẳn)
    case "flake": case "pdot": return [{ L: 0, c: pickPaint([sameC(c2, base) ? W : c2, W, PK.ice, PK.navy], base, 25) }];
    case "cherry": return [{ L: 1, c: PK.stem }, { L: 2, c: PK.leafL, line: true }, { L: 2, c: PK.leaf, ins: 2 }, { L: 3, c: PK.leafD, ins: 2 }, { L: 0, c: PK.cherryD, line: true }, { L: 0, c: PK.cherry, sh: 0.42, ins: 0 }, { L: 4, c: W, a: 0.92 }];
    case "cat": return [{ L: 2, c: K }, { L: 0, c: K, hi: 0.14 }, { L: 1, c: PK.catEye }];
    case "skull": return v ? [{ L: 0, c: K, hi: 0.14 }] : [{ L: 0, c: K, line: true }, { L: 0, c: PK.bone, sh: 0.14, ins: 0 }, { L: 1, c: K }];
    case "leaf": { const c = leafCol(tint, base); return [{ L: 3, c: sc3(c, 0.45) }, { L: 0, c: sc3(c, 0.3), line: true }, { L: 0, c, tone: true, ins: 0 }, { L: 1, c: sc3(c, 0.62), ins: 0 }, { L: 2, c: mix3(c, PK.vein, 0.5), a: 0.55, ins: 0 }]; }
    case "gleaf": return [{ L: 0, c: sc3(PK.fleaf, 0.4), line: true }, { L: 0, c: PK.fleaf, ins: 0 }, { L: 1, c: sc3(PK.fleaf, 0.62), ins: 0 }];
    case "flower": case "bud": {
      // cánh hoa: màu mẫu nếu tách khỏi nền (ΔE ≥ 18 — có viền liner đậm đỡ), không thì đổi sang màu sơn khác trong bảng
      const p = pat === "blossom" ? pickPaint(PK.blossoms, base, 18) : pickPaint(sameC(c2, base) ? PK.petals : [c2, ...PK.petals], base, 18);
      if (kind === "bud") return [{ L: 2, c: PK.fleaf }, { L: 0, c: sc3(p, 0.55), line: true }, { L: 0, c: p, tone: true, ins: 0 }, { L: 1, c: PK.fleaf }];
      const ctr = v ? PK.blossomC : PK.floralC;
      return [{ L: 0, c: sc3(p, 0.52), line: true }, { L: 0, c: p, tone: true, ins: 0 }, { L: 1, c: sc3(p, 0.68), a: 0.75, ins: 0 }, { L: 2, c: sc3(ctr, 0.55), line: true }, { L: 2, c: ctr, ins: 2 }, { L: 3, c: v ? PK.blossomS : sc3(PK.floralC, 0.5) }, { L: 4, c: PK.floralC }];
    }
    case "heart": { const h = contrastOn(sameC(c2, base) ? PK.cherry : c2, base, 28); return [{ L: 0, c: sc3(h, 0.42), line: true }, { L: 0, c: h, hi: 0.85, sh: 0.25, ins: 0 }]; }
    case "holly": return [{ L: 0, c: sc3(PK.holly, 0.3), line: true }, { L: 0, c: PK.holly, ins: 0 }, { L: 1, c: sc3(PK.holly, 0.55), ins: 0 }, { L: 2, c: PK.hollyRib, a: 0.6, ins: 0 }, { L: 3, c: sc3(PK.berry, 0.35), line: true }, { L: 3, c: PK.berry, sh: 0.35, ins: 3 }, { L: 4, c: W, a: 0.92 }];
    case "ornament": {
      const b = contrastOn(sameC(c2, metal) || sameC(c2, base) ? PK.berry : c2, base, 25);
      return [{ L: 3, metal: true }, { L: 0, metal: true, line: true }, { L: 0, c: b, tone: true, hi: 0.35, ins: 0 }, { L: 1, metal: true, ins: 0 }, { L: 2, metal: true }, { L: 4, c: W, a: 0.88 }];
    }
    case "pflower": return [{ L: 0, c: sc3(c2, 0.95), a: 0.7 }, { L: 1, c: PK.pfC, a: 0.7 }];
    default: return [{ L: 0, c: c2 }];
  }
}

/**
 * Đặt 1 hoạ tiết vẽ tay lên 1 móng (1 lần mỗi hoạ tiết mỗi móng): toạ độ tâm trên mặt móng, cỡ px, góc xoay, hướng đèn
 * trong khung hoạ tiết, các bước vẽ. Nhân vật / đồ vật chạm mép móng (soát trên vành điểm sát mép) → thu nhỏ dần + dời
 * vào giữa tới khi nằm trọn trong móng. Trăng khuyết tự quay miệng vào giữa móng.
 */
function fitPainted(bd: Bead, seg: NailSeg, eDist: Float32Array, sEnd: number, upRot: number, upS: number, L3: number[], base: RGB, c2: RGB, metal: RGB, pat: string): PFit {
  const geo = paintGeo(seg, eDist), kind = bd.kind;
  const rotA = (ORGANIC.has(kind) ? 0 : upRot) + (bd.rot ?? 0), cr = Math.cos(rotA), sr = Math.sin(rotA);
  const ln = Math.hypot(L3[0], L3[1]) || 1, R0 = bd.r * seg.hw;
  const v = kind === "skull" ? (Lst(base) > 55 ? 1 : 0) : kind === "flower" ? (pat === "blossom" ? 1 : 0) : kind === "ornament" ? (upS > 0 ? 1 : 0) : 0;
  const F: PFit = { seg, geo, s0: 0, sx: 0, R: R0, cr, sr, fl: bd.flip ? -1 : 1, bound2: 0, Lx: L3[0] / ln, Ly: L3[1] / ln, mLx: 0, mLy: 0, v, jit: 0, lw: 0, bev: 0, hiD: 0, hiW: 0, ops: [], pc: base };
  let u0 = bd.u, t0 = bd.t, sc = 1;
  const place = () => {
    F.s0 = u0 * sEnd; F.sx = hwAt(geo, F.s0) * warpT(t0); F.R = Math.max(1.5, R0 * sc);
    const bnd = (kind === "ornament" && v ? 9 : kind === "cat" ? 1.5 : kind === "gelflower" ? 1.25 : 1.12) * F.R + 2.5;
    F.bound2 = bnd * bnd;
    F.mLx = F.fl * (F.Lx * cr + F.Ly * sr); F.mLy = -F.Lx * sr + F.Ly * cr;
    PS.px = 1 / F.R; PS.lx = F.mLx; PS.ly = F.mLy; PS.v = v;
  };
  place();
  if (kind === "moon" && F.fl * -F.sx * cr < 0) { F.fl = -F.fl; place(); }
  if (!ORGANIC.has(kind)) {
    for (let it = 0; it < 12; it++) {
      let hit = false;
      for (let q = 0; q < geo.ring.length && !hit; q++) {
        const k = geo.ring[q], s = seg.along[k];
        const ax = hwAt(geo, s) * warpT(seg.across[k]) - F.sx, ay = (s - F.s0) * seg.L;
        if (ax * ax + ay * ay > F.bound2) continue;
        const lx = ax / F.R, ly = ay / F.R;
        paintedSD(kind, F.fl * (lx * cr + ly * sr), -lx * sr + ly * cr, PO);
        if (PO[5] * F.R < 1.2) hit = true;
      }
      if (!hit || sc < 0.55) break;
      sc *= 0.93; t0 *= 0.8; u0 += (0.56 - u0) * 0.2;
      place();
    }
  }
  F.jit = kind === "gelflower" ? 0 : Math.min(0.02, 0.6 / F.R);
  F.lw = Math.min(Math.max(1.5, Math.min(3, 0.045 * seg.hw)), 0.14 * F.R);
  F.bev = Math.min(0.3 * F.R, 4);
  F.hiD = Math.max(1.8, Math.min(5, 0.14 * F.R)); F.hiW = Math.max(0.9, Math.min(2.2, 0.045 * F.R));
  // liner tối không được sáng hơn nền tối (viền xám quanh ma trên nền đen)
  F.ops = paintOps(kind, bd.tint ?? 0, base, c2, metal, pat, v).map((op) => (op.line && op.c && Lst(op.c) < 30 && Lst(op.c) > Lst(base) ? { ...op, c: base } : op));
  F.pc = Lst(c2) > 62 && !sameC(c2, base) ? c2 : PK.milk;
  pfits.set(bd, F);
  return F;
}

/** Nơ 3D: 2 thuỳ phồng + nút giữa + 2 đuôi — độ cao 0…1 (0 = ngoài) và độ phủ khử răng cưa. */
function bowShape(x: number, y: number): { h: number; cov: number } {
  let h = 0, cov = 0;
  const part = (cx: number, cy: number, rx: number, ry: number, ang: number, k: number) => {
    const c = Math.cos(ang), s = Math.sin(ang), dx = x - cx, dy = y - cy;
    const uu = (dx * c + dy * s) / rx, vv = (-dx * s + dy * c) / ry, e = uu * uu + vv * vv;
    if (e < 1) h = Math.max(h, k * Math.sqrt(1 - e)); // thuỳ phồng tròn
    cov = Math.max(cov, 1 - smooth(0.88, 1.0, e));
  };
  part(-0.47, 0.1, 0.5, 0.31, 0.32, 0.85); part(0.47, 0.1, 0.5, 0.31, -0.32, 0.85);
  part(-0.2, -0.42, 0.13, 0.4, -0.42, 0.55); part(0.2, -0.42, 0.13, 0.4, 0.42, 0.55);
  part(0, 0.04, 0.19, 0.21, 0, 1);
  return { h, cov };
}
function beadsFor(pattern: string, seed: number): Bead[] {
  const j = (k: number) => (hash2(seed, k, 31) - 0.5);
  switch (pattern) {
    // ngọc trai viền chân móng: hạt giữa to nhất, nhỏ dần ra 2 bên (như thợ gắn thật), ôm theo vòng cung chân móng
    case "pearls": return [{ u: 0.2, t: 0, r: 0.27, kind: "pearl" }, { u: 0.24, t: -0.42, r: 0.2, kind: "pearl" }, { u: 0.24, t: 0.42, r: 0.2, kind: "pearl" }, { u: 0.33, t: -0.7, r: 0.13, kind: "pearl" }, { u: 0.33, t: 0.7, r: 0.13, kind: "pearl" }];
    case "gems": return [{ u: 0.24 + 0.03 * j(1), t: 0.04 * j(2), r: 0.34, kind: "gem" }, { u: 0.44, t: -0.3, r: 0.14, kind: "gem" }, { u: 0.47, t: 0.24, r: 0.12, kind: "gem" }, { u: 0.6, t: -0.02, r: 0.09, kind: "gem" }];
    case "gemcluster": return [{ u: 0.3, t: 0.02, r: 0.33, kind: "gem" }, { u: 0.2, t: -0.5, r: 0.17, kind: "gem" }, { u: 0.2, t: 0.52, r: 0.15, kind: "pearl" }, { u: 0.5, t: -0.38, r: 0.14, kind: "pearl" }, { u: 0.52, t: 0.36, r: 0.16, kind: "gem" }, { u: 0.66, t: -0.05, r: 0.1, kind: "gem" }, { u: 0.42, t: 0.66, r: 0.08, kind: "gem" }];
    case "dots": return [0.3, 0.5, 0.7].map((u, k) => ({ u, t: 0.18 * (k % 2 ? 1 : -1), r: 0.13, kind: "dot" as const }));
    // charm sao kim loại: 1 sao to sát chân móng lệch 1 bên + 2 sao nhỏ dần chạy chéo về đầu móng, mỗi sao xoay khác nhau
    case "stars": { const sd = j(6) > 0 ? 1 : -1; return [{ u: 0.3 + 0.03 * j(1), t: 0.34 * sd, r: 0.44, kind: "star", rot: 0.5 * j(3) }, { u: 0.56, t: -0.02 * sd, r: 0.28, kind: "star", rot: 0.8 * j(4) }, { u: 0.76, t: -0.32 * sd, r: 0.18, kind: "star", rot: 0.8 * j(5) }]; }
    // charm nơ kim loại 3D giữa móng, gần chân móng
    case "charm3d": return [{ u: 0.38 + 0.03 * j(1), t: 0.02 * j(2), r: 0.9, kind: "bow", rot: 0.15 * j(3) }];
    // tim vẽ tay: 1 tim TO (≈ 55% bề ngang móng) lệch 1 bên, hơi nghiêng — 2–3 tim tí hon rải rác nhìn như sticker
    case "hearts": { const sd = j(6) > 0 ? 1 : -1; return [{ u: 0.55 + 0.04 * j(1), t: 0.14 * sd, r: 0.6, kind: "heart", rot: 0.5 * j(2) }]; }
    // hoạ tiết vẽ tay (Halloween / Giáng sinh / hoa / cherry): r = nửa cỡ NHÌN THẤY — nhân vật rộng ~55–65% móng, lệch khỏi
    // tâm (u 0.5–0.62, |t| ≤ 0.12; chạm mép thì renderLook tự thu nhỏ / dời vào), hoạ tiết hữu cơ tràn ra mép
    case "ghost": return [{ u: 0.56 + 0.05 * j(1), t: 0.2 * j(2), r: 0.92, kind: "ghost", rot: 0.2 * j(3) }];
    case "jackolantern": return [{ u: 0.58 + 0.05 * j(1), t: 0.2 * j(2), r: 0.76, kind: "pumpkin", rot: 0.15 * j(3) }];
    // dơi: 1 con to giữa móng + 2 con nhỏ dần bay chéo về 1 góc đầu móng
    case "bats": { const sd = j(6) > 0 ? 1 : -1; return [{ u: 0.5 + 0.03 * j(1), t: 0.06 * sd, r: 0.66, kind: "bat", rot: 0.2 * j(2) }, { u: 0.72, t: 0.3 * sd, r: 0.34, kind: "bat", rot: 0.35 * j(3) }, { u: 0.86, t: 0.42 * sd, r: 0.26, kind: "bat", rot: 0.4 * j(4) }]; }
    // trăng khuyết kim loại to (≈ 50% bề ngang) sát 1 bên, miệng quay vào giữa móng + 3 sao nhỏ dần phía bên kia
    case "moonstars": { const sd = j(6) > 0 ? 1 : -1; return [{ u: 0.5 + 0.04 * j(1), t: 0.3 * sd, r: 0.54, kind: "moon", rot: 0.25 * j(2) }, { u: 0.26, t: -0.32 * sd, r: 0.28, kind: "star", rot: 0.6 * j(3) }, { u: 0.68, t: -0.4 * sd, r: 0.22, kind: "star", rot: 0.6 * j(4) }, { u: 0.86, t: -0.04 * sd, r: 0.18, kind: "star", rot: 0.6 * j(5) }]; }
    // bông tuyết: 1 bông to lệch ra mép (mép móng cắt bớt) + 1 bông vừa + chấm tuyết rơi — bỏ bông tí hon (nhoè thành dấu *)
    case "snow": { const sd = j(6) > 0 ? 1 : -1; return [{ u: 0.62 + 0.04 * j(1), t: 0.45 * sd, r: 0.6, kind: "flake", rot: 0.5 * j(2) }, { u: 0.3, t: -0.3 * sd, r: 0.33, kind: "flake", rot: 0.5 * j(3) }, { u: 0.5, t: -0.52 * sd, r: 0.08, kind: "pdot" }, { u: 0.2, t: 0.3 * sd, r: 0.075, kind: "pdot" }, { u: 0.84, t: -0.3 * sd, r: 0.085, kind: "pdot" }, { u: 0.38, t: 0.12 * sd, r: 0.07, kind: "pdot" }]; }
    case "cherry": return [{ u: 0.55 + 0.04 * j(1), t: 0.3 * j(2), r: 0.84, kind: "cherry", rot: 0.2 * j(3) }];
    // NHÀNH Ô RÔ (holly) Giáng sinh: 2 lá gai + 3 quả đỏ, rộng ~60% móng
    case "holly": return [{ u: 0.56 + 0.05 * j(1), t: 0.2 * j(2), r: 0.9, kind: "holly", rot: 0.25 * j(3) }];
    // QUẢ CHÂU Giáng sinh: quả cầu bóng + dải / nắp / khoen kim loại (+ dây treo về mép đầu móng)
    case "ornament": return [{ u: 0.56 + 0.04 * j(1), t: 0.2 * j(2), r: 0.86, kind: "ornament", rot: 0.12 * j(3) }];
    // HOA GEL 3D kiểu Hàn: 1 bông nổi lệch 1 bên nửa chân móng + 2 ngọc trai nhỏ dần chạy chéo về đầu móng
    case "gelflower": { const sd = j(6) > 0 ? 1 : -1; return [{ u: 0.42 + 0.04 * j(1), t: 0.12 * sd, r: 0.7, kind: "gelflower", rot: 6.28 * j(2) }, { u: 0.74, t: -0.3 * sd, r: 0.16, kind: "pearl" }, { u: 0.87, t: -0.12 * sd, r: 0.13, kind: "pearl" }]; }
    case "blackcat": return [{ u: 0.55 + 0.04 * j(1), t: 0.2 * j(2), r: 0.86, kind: "cat", rot: 0.08 * j(3) }];
    case "skull": return [{ u: 0.56 + 0.04 * j(1), t: 0.2 * j(2), r: 0.68, kind: "skull", rot: 0.2 * j(3) }];
    case "eyeball": return [{ u: 0.48 + 0.03 * j(1), t: 0.03 * j(2), r: 0.6, kind: "eye" }];
    // lá thu vẽ tay: 3 lá nhỏ dần "rơi" chéo từ 1 góc đầu móng, lá to bị mép cắt, mỗi lá xoay / màu khác nhau
    // (lá phong thuỳ nhọn nhìn nhỏ hơn khung ~25% → r lớn hơn cỡ nhìn thấy 0.45 / 0.3 / 0.18 của kế hoạch)
    case "leaf": { const sd = j(6) > 0 ? 1 : -1; return [{ u: 0.8, t: 0.5 * sd, r: 0.72, kind: "leaf", rot: -0.6 * sd + 0.4 * j(1), tint: 0 }, { u: 0.44, t: -0.14 * sd, r: 0.46, kind: "leaf", rot: 0.5 * sd + 0.5 * j(2), tint: 1 }, { u: 0.19, t: 0.3 * sd, r: 0.28, kind: "leaf", rot: 1.2 * sd + 0.5 * j(3), tint: 2 }]; }
    case "witchy": return [{ u: 0.18, t: 0.02, r: 0.24, kind: "star", rot: 0.4 * j(1) }];
    case "milkbath": return [{ u: 0.3, t: -0.3, r: 0.3, kind: "pflower", rot: 6.28 * j(1) }, { u: 0.55, t: 0.28, r: 0.26, kind: "pflower", rot: 6.28 * j(2) }, { u: 0.78, t: -0.2, r: 0.2, kind: "pflower", rot: 6.28 * j(3) }, { u: 0.2, t: 0.4, r: 0.16, kind: "pflower", rot: 6.28 * j(4) }];
    // hoa vẽ tay: 1 bông to ở góc đầu móng (mép cắt bớt) + 2 lá xanh lấp ló dưới bông + 1–2 nụ; mỗi móng lật bên khác nhau
    case "floral": case "blossom": {
      // bông chính r 0.72 (mặt móng cong làm bông lệch mép co lại → nhìn ≈ 55% bề ngang, mép cắt 1 bên), lá 0.4 / 0.34, nụ
      // 0.26 / 0.2 — nụ / lá nhỏ hơn thì chỉ còn chấm
      const sd = j(6) > 0 ? 1 : -1, fu = 0.72 + 0.04 * j(1), ft = 0.42 * sd;
      const lf = (du: number, dt: number, r: number, k: number): Bead => ({ u: fu + du, t: ft + dt, r, kind: "gleaf", rot: Math.atan2(-dt, du * 2.7) + 0.25 * j(k) });
      return [lf(-0.22, -0.4 * sd, 0.4, 2), lf(0.08, -0.7 * sd, 0.34, 3), { u: fu, t: ft, r: 0.72, kind: "flower", rot: 6.28 * j(4) }, { u: 0.34, t: -0.3 * sd, r: 0.26, kind: "bud", rot: -0.5 * sd + 0.3 * j(5) }, ...(j(8) > 0 ? [{ u: 0.15, t: 0.24 * sd, r: 0.2, kind: "bud" as const, rot: 0.4 * sd + 0.3 * j(9) }] : [])];
    }
    case "droplets": case "chromedrops": case "droplet": {
      // giọt nước 3D (trend "water drop / bubble nails"): 1 giọt to + 2–3 giọt nhỏ rải tự nhiên, không chồng nhau
      const out: Bead[] = [];
      const sizes = [0.46 + 0.08 * j(1), 0.26 + 0.06 * j(2), 0.17 + 0.04 * j(3), 0.11];
      const want = 3 + (hash2(seed, 9, 31) > 0.5 ? 1 : 0);
      for (let k = 0, tries = 0; out.length < want && tries < 60; tries++, k++) {
        const r = sizes[out.length];
        const b: Bead = { u: 0.28 + 0.5 * hash2(seed, 40 + k, 7), t: (hash2(seed, 80 + k, 7) - 0.5) * 2 * (0.82 - r), r, kind: pattern === "chromedrops" ? "mdrop" : "drop" };
        if (pattern === "droplet") b.r *= 0.9;
        // không chồng nhau: đo theo đơn vị nửa bề ngang móng (chiều dài móng ≈ 2.8 lần nửa bề ngang)
        if (out.every((o) => Math.hypot(o.t - b.t, (o.u - b.u) * 2.8) > (o.r + b.r) * 1.12)) out.push(b);
      }
      return out;
    }
    default: return [];
  }
}

/** Bản đồ ánh sáng / màu da mép / khoảng cách tới mép chỉ phụ thuộc ẢNH + MÓNG (không phụ thuộc mẫu) → tính 1 lần,
 *  dùng lại cho cả 10 mẫu (trước đây tính lại mỗi mẫu). eDist: viền chỉ kim loại (đồi mồi), độ dày gel ở chân / mép. */
const mapCache = new WeakMap<NailSeg, { img: Img; lm: LightMap; under: Map<number, [number, number, number]>; eDist: Float32Array }>();
function segMaps(img: Img, seg: NailSeg) {
  const hit = mapCache.get(seg);
  if (hit && hit.img === img) return hit;
  const v = { img, lm: lightMap(img, seg), under: edgeUnder(img, seg), eDist: edgeDistance(seg) };
  mapCache.set(seg, v);
  return v;
}

/**
 * Vẽ 1 mẫu lên ảnh → ảnh mới (cả ảnh, hoặc chỉ khung `crop` cho nhẹ). `motif`: lớp hoạ tiết RGBA (vẽ từ SVG
 * NailArt) CÙNG CỠ ẢNH RA (cả ảnh, hoặc đúng khung crop), có thể null — chỉ dùng cho hoạ tiết bộ máy không tự vẽ.
 * Mỗi móng: màu nền theo hoạ tiết (ombre, baby boomer, aura, french, đồi mồi, vân đá… tính trên toạ độ móng thật) ×
 * mặt ánh sáng thật của móng → hiệu ứng (bóng / nhám / chrome / glazed ngọc trai / mắt mèo / velvet / nhũ) → nét kim
 * loại, ngọc trai / đá 3D → bóng gương trên cùng.
 */
export function renderLook(img: Img, segs: NailSeg[], look: LookColors, motif?: Img | null, crop?: { x: number; y: number; w: number; h: number }): Img {
  const cx = crop ? Math.max(0, Math.round(crop.x)) : 0, cy = crop ? Math.max(0, Math.round(crop.y)) : 0;
  const cw = crop ? Math.max(1, Math.min(img.w - cx, Math.round(crop.w))) : img.w, ch = crop ? Math.max(1, Math.min(img.h - cy, Math.round(crop.h))) : img.h;
  let out: Uint8ClampedArray;
  if (!crop) out = new Uint8ClampedArray(img.data);
  else {
    out = new Uint8ClampedArray(cw * ch * 4);
    for (let y = 0; y < ch; y++) out.set(img.data.subarray(((cy + y) * img.w + cx) * 4, ((cy + y) * img.w + cx + cw) * 4), y * cw * 4);
  }
  const op = Math.max(0.05, Math.min(1, look.opacity ?? 1));
  const cols = (look.colors.length ? look.colors : ["#ec4899"]).map(hexToRgb).map((c) => c.map((x) => LIN[x]) as RGB);
  const c1L = cols[0], c2L = cols[1] ?? cols[0], metalL = cols[2] ?? (cols.length > 1 ? cols[cols.length - 1] : [0.69, 0.55, 0.2] as RGB);
  const patL = look.pattern;
  const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  segs.forEach((seg, i) => {
    // mỗi móng có thể có hoạ tiết / màu / hiệu ứng riêng (bộ móng phối: móng trơn + móng hoạ tiết + móng nhấn)
    const ov = look.nails?.[i] ?? undefined;
    const pat = ov?.pattern ?? patL;
    const ovCols = ov?.colors?.length ? ov.colors.map(hexToRgb).map((c) => c.map((x) => LIN[x]) as RGB) : null;
    const c1 = ovCols ? ovCols[0] : c1L, c2 = ovCols ? ovCols[1] ?? ovCols[0] : c2L, metal = ovCols ? ovCols[2] ?? metalL : metalL;
    const fin: Finish = ov?.finish ?? look.finish;
    const accent = seg.accent ?? (i === 2 || i === 3);
    const onNail = ov?.art ?? (ALL_NAIL_PATTERNS.has(pat) || accent || segs.length < 3); // hoạ tiết có vẽ trên móng này không
    const base0 = pat === "mixmatch" && accent ? c2 : c1;
    const { lm, under, eDist } = segMaps(img, seg);
    const side = lm.side;
    // trục móng trong ảnh: u = gốc → đầu móng, v = hướng t dương. Móng chúc xuống (tay úp, ảnh white / olive) thì
    // "phía trên ảnh" là phía CHÂN móng → hoạ tiết vẽ tay (mèo, ma, bí ngô…) phải xoay để luôn ĐỨNG THẲNG trong ảnh
    const axL = Math.hypot(seg.tip.x - seg.base.x, seg.tip.y - seg.base.y) || 1;
    const axUx = (seg.tip.x - seg.base.x) / axL, axUy = (seg.tip.y - seg.base.y) / axL;
    let axVx = -axUy, axVy = axUx;
    { let sg2 = 0; for (let k = 0; k < seg.w * seg.h; k += 5) if (seg.alpha[k] > 0.5) sg2 += seg.across[k] * (((k % seg.w) + seg.x0 - seg.base.x) * axVx + (Math.floor(k / seg.w) + seg.y0 - seg.base.y) * axVy); if (sg2 < 0) { axVx = -axVx; axVy = -axVy; } }
    const uprightRot = Math.atan2(axVy, -axUy); // góc xoay để trục "lên" của hoạ tiết trùng phía trên ảnh
    const upS = -axUy >= 0 ? 1 : -1; // đèn chụp ảnh thường từ phía trên ảnh
    // hướng đèn trong toạ độ khối 3D trên móng (x: ngang móng về phía có đèn, y: về phía đầu móng ≈ phía trên ảnh)
    const LxB = side * 0.55, LyB = 0.42 * upS, LzB = 0.72, Ln = Math.hypot(LxB, LyB, LzB);
    const L3 = [LxB / Ln, LyB / Ln, LzB / Ln], H3n = Math.hypot(L3[0], L3[1], L3[2] + 1), H3 = [L3[0] / H3n, L3[1] / H3n, (L3[2] + 1) / H3n];
    const glit = fin === "glitter" ? glitterLayer(seg, look.seed + i * 17) : null;
    // chrome trên nền trắng / ngọc trai / champagne = glazed donut (bạc xám vẫn là gương kim loại); thạch + chrome = thạch
    // tráng ngọc trai (bột chrome mờ trên gel trong) — không phải gương kim loại (từng ra sọc tím xám như inox)
    const glazed = fin === "chrome" && (lum(base0) > 0.62 || pat === "jelly");
    const velvet = pat === "velvet" || (fin === "cateye" && pat === "velvet");
    const gloss = fin === "matte" ? 0.06 : fin === "chrome" ? 1.0 : 0.9;
    const contrast = fin === "matte" ? 0.3 : 0.5;
    const synth = fin !== "matte" && !lm.streak ? (fin === "chrome" && !glazed ? 0.5 : 0.75) : 0;
    // chiều dài thật của mặt nạ (kể cả phần đắp) để hoạ tiết đầu móng (french…) bám đúng đầu móng
    let sEnd = 1;
    for (let k = 0; k < seg.alpha.length; k++) if (seg.alpha[k] >= 0.5 && seg.along[k] > sEnd) sEnd = seg.along[k];
    const aaU = 1.2 / Math.max(8, seg.L * sEnd); // khử răng cưa đường french (~1px)
    const lineW = 1 / Math.max(4, seg.hw); // 1px theo bề ngang (đơn vị t)
    const seedN = look.seed + i * 13;
    const beads = onNail ? beadsFor(pat, seedN) : [];
    const jit = hash2(seedN, 11, 3) - 0.5, jit2 = hash2(seedN, 12, 3) - 0.5; // vệt phản chiếu tổng hợp hơi khác nhau mỗi móng
    // nét kim loại: 1 đường cong mềm dọc móng (mỗi móng lệch pha khác nhau)
    const ph = hash2(seedN, 3, 5) * 6.28, amp = 0.32 + 0.18 * hash2(seedN, 4, 5);
    for (let k = 0; k < seg.alpha.length; k++) {
      const a = seg.alpha[k] * op; if (a <= 0) continue;
      const xx = k % seg.w, yy = (k - xx) / seg.w;
      const X = seg.x0 + xx, Y = seg.y0 + yy;
      if (X < cx || Y < cy || X >= cx + cw || Y >= cy + ch) continue;
      const idx = (Y * img.w + X) * 4, o = ((Y - cy) * cw + (X - cx)) * 4;
      const s = seg.along[k], t = seg.across[k], u = s / sEnd;
      const at = Math.abs(t);
      // phần ĐẮP DÀI (ngoài móng thật): tiếp tục độ cong của móng thật (mặt ánh sáng khớp được), tối dần nhẹ về đầu —
      // không phải mặt phẳng (từng nhìn như giấy cắt dán)
      const shade = lm.weight[k] * lm.shade[k] + (1 - lm.weight[k]) * (0.85 * lm.shade[k] - 0.1 * Math.max(0, s - 1) - 0.03 - 0.12 * t * t);
      const extW = seg.ext ? smooth(0.97, 1.08, s) : 0; // độ "thuộc phần đắp" của điểm (chỉ móng đắp dài thật)
      const edge = 1 - 0.28 * Math.pow(Math.max(0, (at - 0.62) / 0.38), 2); // 2 mép móng cong → tối dần
      const cut = 1 - 0.12 * (1 - smooth(0, 0.1, s)); // chân móng hơi tối
      // ---- 1) màu nền theo hoạ tiết (toạ độ móng thật)
      let base: RGB = base0;
      let tipChrome = 0; // phần đầu móng tráng gương (chrome French)
      let metalMix = 0, metalQ = 0, metalMirror = false; // metalMirror: mảnh foil phẳng → phản chiếu gương; còn lại: sợi / dải KIM LOẠI mảnh (viền vàng French đôi, gân vàng vân đá): vị trí ngang trên sợi, tô sau bước ánh sáng
      if (onNail) {
        switch (pat) {
          case "ombre": base = mix3(c1, c2, smooth(0.25, 0.92, u)); break;
          case "babyboomer": base = mix3(c1, c2, smooth(0.2, 0.88, u)); break;
          case "jelly": {
            // THẠCH (sheer jelly): gel màu TRONG như kính màu — thấy móng thật bên dưới (giường móng hồng, liềm sáng ở
            // chân, mép tự do trắng đục ở đầu) nhuộm màu; 2 mép + đầu móng lớp gel dày hơn → màu đậm hơn. Móng cũ trong
            // ảnh có thể đang sơn tối → dựng lại móng thật (không lấy điểm ảnh cũ). Phần đắp dài là gel trong → thấy
            // mờ nền phía sau.
            // liềm chân móng nhỏ, mờ (phần lớn nằm dưới da) — to / rõ là thành mẫu "half-moon", không phải thạch
            const lunD = Math.hypot(t / 0.5, (s + 0.02) / 0.14);
            const lun = (1 - smooth(0.6, 1.05, lunD)) * 0.3;
            const free = seg.ext ? smooth(0.86, 0.97, s) : 0.55 * smooth(0.82, 0.96, u);
            const ridge = 0.03 * (vnoise(t * 9, 0.4 * u, look.seed + 5) - 0.5); // vân dọc rất nhẹ của móng thật
            let und: RGB = mix3(mix3([0.6, 0.34, 0.31], [0.86, 0.74, 0.7], lun), [0.86, 0.83, 0.79], free);
            und = [und[0] * (1 + ridge), und[1] * (1 + ridge), und[2] * (1 + ridge)];
            if (extW > 0) {
              const bg: RGB = [LIN[img.data[idx]], LIN[img.data[idx + 1]], LIN[img.data[idx + 2]]];
              und = mix3(und, mix3(bg, [0.8, 0.78, 0.75], 0.45), 0.45 * extW);
            }
            const mx = Math.max(c1[0], c1[1], c1[2], 1e-3);
            const dens = 0.55 + 0.3 * smooth(0.55, 1, at) + 0.15 * smooth(0.82, 1, u);
            const filt: RGB = [1 + (c1[0] / mx - 1) * dens, 1 + (c1[1] / mx - 1) * dens, 1 + (c1[2] / mx - 1) * dens];
            const deep = 1 - 0.14 * smooth(0.6, 1, at);
            base = mix3([und[0] * filt[0] * deep, und[1] * filt[1] * deep, und[2] * filt[2] * deep], c1, 0.18 + 0.22 * dens);
            break;
          }
          case "aura": {
            // aura: quầng màu phun mềm (airbrush) giữa móng, màu dịu, lan rộng ~60% mặt móng
            // quầng ngả hồng một chút cho ấm, không xanh lạnh như vệt đèn
            // màu quầng ấm (hồng / cam / tím) mới ngả hồng thêm; quầng xanh / lục giữ nguyên sắc. Quầng gọn hơn trên nền
            // sáng (nền trắng sữa + quầng xanh nhạt từng loang khắp móng, nhìn như sơn xanh trơn)
            const warmG = c2[0] >= c2[2];
            const glowC = mix3(warmG ? mix3(c2, [0.92, 0.45, 0.62], 0.25) : c2, [1, 1, 1], warmG ? 0.15 : 0.04);
            const light = lum(c1) > 0.55;
            const d = Math.hypot((u - 0.5) / (light ? 0.32 : 0.4), t / (light ? 0.5 : 0.66));
            base = mix3(mix3(c1, [1, 1, 1], 0.08), glowC, 0.95 * Math.exp(-d * d * (light ? 1.3 : 0.95)));
            break;
          }
          case "french": case "chromefrench": case "doublefrench": {
            // đường cười: giữa móng mảnh, 2 bên ôm xuống theo mép móng (French hiện đại, mảnh)
            const line = 1 - (0.13 + 0.12 * t * t) * (pat === "doublefrench" ? 1.1 : 1);
            const m = smooth(line - aaU, line + aaU, u);
            // đầu móng bằng màu KIM LOẠI (bạc / vàng / vàng hồng) → vẽ ánh kim, không tô phẳng xám
            if (pat === "chromefrench" || (c2[0] === metal[0] && c2[1] === metal[1] && c2[2] === metal[2])) tipChrome = m;
            else base = mix3(c1, c2, m);
            if (pat === "doublefrench") {
              const l2 = line - 0.075, band = smooth(l2 - 0.022 - aaU, l2 - 0.022 + aaU, u) * (1 - smooth(l2 + 0.022 - aaU, l2 + 0.022 + aaU, u));
              // viền kim loại nổi: pháp tuyến nghiêng theo bề dày viền → lõi sáng, 2 mép tối như dây vàng thật
              metalMix = band; metalQ = Math.max(-1, Math.min(1, (u - l2) / 0.022));
            }
            break;
          }
          case "tortoise": {
            // đồi mồi: nền HỔ PHÁCH trong (mật ong → hổ phách), đốm nâu nhiều cỡ loang mềm, lõi đốm gần đen
            const wx = u * 2.8 + 0.7 * fbm(u * 1.6 + 3, t * 1.6, seedN + 5), wy = t * 2.1 + 0.7 * fbm(u * 1.6, t * 1.6 + 7, seedN + 6);
            // nhiễu MƯỢT (2 tầng, không hạt nhỏ) — đồi mồi thật loang khối lớn, mép mềm
            const n = 0.65 * vnoise(wx + seedN * 0.37, wy, seedN) + 0.35 * vnoise(wx * 1.9 + 4, wy * 1.9, seedN + 1), n2 = vnoise(wx * 2.2, wy * 2.2, seedN + 3);
            const honey: RGB = [0.5, 0.17, 0.02], amber: RGB = [0.27, 0.075, 0.009], brown: RGB = [0.05, 0.016, 0.006], core: RGB = [0.014, 0.006, 0.003];
            base = mix3(honey, amber, smooth(0.3, 0.62, n * 0.8 + n2 * 0.2));
            base = mix3(base, brown, smooth(0.5, 0.66, n) * 0.9);
            base = mix3(base, core, smooth(0.62, 0.76, n) * 0.8);
            if (accent) {
              // đúng bước thợ làm: viền chỉ kim loại mảnh quanh 2 ngón nhấn (sợi nổi, cách mép ~2px)
              const n = (eDist[k] - 2.4) / 1.15;
              const mm = 1 - smooth(0.6, 1.2, Math.abs(n));
              if (mm > 0) { metalMix = mm; metalQ = Math.max(-1, Math.min(1, n)); }
            }
            break;
          }
          case "slimedrip": {
            // SLIME XANH chảy từ đầu móng: viền slime lượn + 2–3 giọt chảy dài ngắn khác nhau (đầu giọt tròn)
            let edge = 0.74 + 0.03 * Math.sin(8 * t + ph);
            for (let q = 0; q < 3; q++) { const tq = -0.5 + 0.5 * q + 0.15 * Math.sin(ph + q * 2), Lq = 0.16 + 0.12 * hash2(seedN, q, 41); edge -= Lq * Math.exp(-(((t - tq) / 0.09) ** 2)); }
            base = mix3(c1, [0.18, 0.55, 0.02], smooth(edge - aaU * 2, edge + aaU * 2, u));
            break;
          }
          case "candycorn": {
            // KẸO BẮP: vàng ở chân móng → cam giữa → trắng đầu móng, ranh giới tán nhẹ
            base = mix3(mix3([0.9, 0.6, 0.02], [0.88, 0.22, 0.01], smooth(0.32, 0.4, u)), [0.93, 0.92, 0.9], smooth(0.66, 0.74, u));
            break;
          }
          case "stitches": {
            // ĐƯỜNG KHÂU Frankenstein: 1 vết khâu dọc + vạch ngang ngắn đều nhau
            const tcS = 0.08 * Math.sin(2 * u + ph);
            const main2 = 1 - smooth(lineW * 0.7, lineW * 1.4, Math.abs(t - tcS));
            const fr2 = ((u * 9) % 1 + 1) % 1;
            const cross = (1 - smooth(0.06, 0.12, Math.abs(fr2 - 0.5))) * (1 - smooth(0.18, 0.22, Math.abs(t - tcS))) * smooth(0.12, 0.2, u) * (1 - smooth(0.85, 0.92, u));
            // chỉ khâu đen trên nền sáng / màu; nền đen → chỉ trắng ngà (chỉ đen trên nền đen thì không thấy gì)
            const thread: RGB = lum(base0) < 0.06 ? [0.78, 0.77, 0.74] : [0.01, 0.01, 0.01];
            base = mix3(base, thread, Math.max(main2 * smooth(0.08, 0.15, u) * (1 - smooth(0.9, 0.96, u)), cross));
            break;
          }
          case "mummy": {
            // XÁC ƯỚP: 7 dải băng GẠC trắng quấn ngang, mỗi dải lệch góc 1 chút, dải sau đè dải trước (bóng đổ mảnh dưới
            // mép), thớ gạc mịn + mép hơi xơ; chừa 1 khe đen giữa móng có 2 con mắt ló ra (lưới trám chấm bi từng nhìn
            // như vải bọc ghế, không ra xác ướp)
            const Lp = seg.L * sEnd, X = t * seg.hw, Y = u * Lp;
            const ye = 0.5 * Lp, gH = Math.max(2.2, 0.075 * Lp), inGap = Math.abs(Y - ye + 0.1 * X);
            let mc: RGB = base;
            for (let q = 0; q < 7; q++) {
              const hq = hash2(seedN, 40 + q, 7), hq2 = hash2(seedN, 50 + q, 7);
              const yc = ((q + 0.5) / 7) * Lp * 1.06 - 0.03 * Lp + (hq - 0.5) * 0.05 * Lp;
              const th = (q % 2 ? 1 : -1) * (0.08 + 0.2 * hq2);
              const wq = Lp * (0.135 + 0.035 * hq);
              const perp = (Y - yc) * Math.cos(th) - X * Math.sin(th), along = (Y - yc) * Math.sin(th) + X * Math.cos(th);
              const half = wq / 2 + 0.55 * (vnoise(along * 0.4, q * 3.1, seedN + 9) - 0.5); // mép gạc hơi xơ
              const gapK = smooth(gH - 0.7, gH + 0.7, inGap);
              const ds = Math.abs(perp) - half;
              // bóng đổ của dải này lên lớp bên dưới (1–2px ngay ngoài mép)
              if (ds > 0 && ds < 2.2) { const sh = 0.32 * (1 - ds / 2.2) * gapK; mc = [mc[0] * (1 - sh), mc[1] * (1 - sh), mc[2] * (1 - sh)]; }
              const cq = (1 - smooth(-0.7, 0.7, ds)) * gapK;
              if (cq <= 0) continue;
              const g0 = 0.74 + 0.1 * hq;
              const round = 1 - 0.13 * Math.min(1, (perp / Math.max(1, half)) ** 2); // dải băng hơi phồng → mép tối nhẹ
              const fib = 0.04 * Math.sin(along * 2.3 + hq * 6) * Math.sin(perp * 2.7 + hq2 * 5) + 0.05 * (vnoise(along * 0.7, perp * 1.1, seedN + q) - 0.5);
              const k2 = round * (1 + fib);
              mc = mix3(mc, [g0 * k2, g0 * 0.985 * k2, g0 * 0.94 * k2], cq);
            }
            base = mc;
            // 2 con mắt trong khe: lòng trắng tròn + con ngươi đen liếc vào giữa
            const re = Math.max(1.6, Math.min(gH * 0.8, 0.15 * seg.hw));
            for (const ex of [-0.3, 0.3]) {
              const exX = ex * seg.hw, exY = ye - 0.1 * exX;
              const dW = Math.hypot(X - exX, Y - exY), dP = Math.hypot(X - exX + Math.sign(ex) * 0.28 * re, Y - exY);
              base = mix3(base, [0.93, 0.93, 0.9], 1 - smooth(re - 0.6, re + 0.6, dW));
              base = mix3(base, [0.01, 0.01, 0.01], 1 - smooth(0.5 * re - 0.5, 0.5 * re + 0.5, dP));
            }
            break;
          }
          case "waves": {
            // SÓNG BIỂN: 2–3 đường sóng trắng uốn lượn ở đầu móng
            let wv = 0;
            for (let q = 0; q < 3; q++) { const uq = 0.6 + 0.11 * q + 0.025 * Math.sin(9 * t + ph + q * 1.7); wv = Math.max(wv, 1 - smooth(lineW * 0.9, lineW * 1.8, Math.abs(u - uq) * seg.L * sEnd / Math.max(1, seg.hw))); }
            base = mix3(base, [0.95, 0.96, 0.97], wv);
            break;
          }
          case "negative": {
            // NEGATIVE SPACE: phần lớn móng để "trần" (lớp base trong → hồng tự nhiên), khối nửa trăng c2 ở chân móng,
            // viền kim loại mảnh chạy theo mép khối
            const moon = 0.36 + 0.07 * Math.cos(1.6 * t);
            base = mix3([0.78, 0.5, 0.45], c2, 1 - smooth(moon - aaU * 2, moon + aaU * 2, u));
            const nl2 = (u - moon) * seg.L * sEnd / Math.max(1, 1.4);
            if (Math.abs(nl2) < 1.6) { metalMix = 1 - smooth(0.7, 1.4, Math.abs(nl2)); metalQ = Math.max(-1, Math.min(1, nl2 / 1.2)); }
            break;
          }
          case "lace": {
            // REN TRẮNG (in stamping): dải ren ngang móng — lưới chấm mịn + mép vỏ sò + hoa nhỏ viền nét
            const inBand = smooth(0.1, 0.14, u) * (1 - smooth(0.52, 0.56, u));
            const X = t * seg.hw, Yp = s * seg.L, P = 0.16 * seg.hw;
            const row = Math.floor(Yp / P), fx = X / P + (row % 2) * 0.5;
            const mesh = 1 - smooth(0.18 * P, 0.26 * P, Math.hypot((fx - Math.round(fx)) * P, (Yp / P - row - 0.5) * P));
            const sc = Math.abs(((t * 3.2 + 10) % 1) - 0.5) * 2, scallopU = 0.52 + 0.04 * Math.sqrt(Math.max(0, 1 - sc * sc));
            const scal = 1 - smooth(0.006, 0.014, Math.abs(u - scallopU));
            const fl = Math.abs(Math.hypot((t - 0.3 * Math.round(t / 0.3)) * seg.hw, (u - 0.32) * seg.L * sEnd) - 0.09 * seg.hw);
            const flower = 1 - smooth(lineW * 0.6 * seg.hw, lineW * 1.2 * seg.hw, fl);
            base = mix3(base, [0.95, 0.95, 0.96], Math.max(mesh * inBand * 0.75, scal, flower * inBand));
            break;
          }
          case "witchy": {
            // PHÙ THUỶ: viền kim loại mảnh quanh mép móng nhấn (+ 1 charm sao nhỏ ở chân móng — trong bước khối 3D)
            const n = (eDist[k] - 2.2) / 1.1;
            const mm = 1 - smooth(0.6, 1.2, Math.abs(n));
            if (mm > 0) { metalMix = mm; metalQ = Math.max(-1, Math.min(1, n)); }
            break;
          }
          case "milkbath": {
            // MILK BATH: lớp thạch trắng sữa hơi trong (thấy nhẹ móng hồng bên dưới) — hoa khô ép nằm dưới lớp sữa
            base = mix3(c1, [0.78, 0.55, 0.5], 0.12);
            break;
          }
          case "web": {
            // MẠNG NHỆN từ góc đầu móng: 6 tia + các vòng võng xuống giữa 2 tia; nét kim loại mảnh
            const ax = (t + 1.05) * seg.hw, ay = (sEnd * 1.02 - s) * seg.L; // gốc ở góc đầu móng
            const rho = Math.hypot(ax, ay), th = Math.atan2(ay, ax);
            const nR = 6, step = Math.PI / 2 / (nR - 1);
            const ki = Math.round(th / step), dRay = Math.abs(th - ki * step) * rho;
            const lw = Math.max(0.6, 0.045 * seg.hw);
            let line = 1 - smooth(lw * 0.5, lw * 1.2, dRay);
            const gap = 0.42 * seg.hw, fr = (th / step) % 1, sag = 0.18 * gap * Math.sin(Math.PI * (fr < 0 ? fr + 1 : fr));
            const ring = Math.abs(((rho + sag) % gap) - gap / 2) - gap / 2;
            line = Math.max(line, (1 - smooth(lw * 0.5, lw * 1.2, Math.abs(ring))) * smooth(gap * 0.6, gap, rho));
            base = mix3(base, mix3(metal, [0.95, 0.95, 0.96], 0.35), line * 0.95);
            break;
          }
          case "plaid": {
            // CARO (tartan): dải ngang + dọc màu c2 chồng nhau (chỗ giao đậm hơn) + kẻ chỉ mảnh màu kim loại / trắng
            const X = t * seg.hw, Yp = s * seg.L, P = 0.9 * seg.hw;
            const band = (v: number) => { const f = ((v / P) % 1 + 1) % 1; return 1 - smooth(0.32, 0.36, Math.abs(f - 0.5)); };
            const thin = (v: number) => { const f = ((v / P + 0.5) % 1 + 1) % 1; return 1 - smooth(0.018, 0.035, Math.abs(f - 0.5)); };
            const hb = band(Yp), vb = band(X);
            base = mix3(c1, c2, 0.55 * hb + 0.55 * vb - 0.15 * hb * vb);
            base = mix3(base, mix3(metal, [1, 1, 1], 0.4), Math.max(thin(X), thin(Yp)) * 0.85);
            // vân chéo của vải dệt (rất nhẹ)
            const tw = 0.03 * Math.sin((X + Yp) * 1.6);
            base = [base[0] * (1 + tw), base[1] * (1 + tw), base[2] * (1 + tw)];
            break;
          }
          case "candy": {
            // SỌC KẸO GẬY chéo c1 / c2, đều nhau, khử răng cưa
            const P = 0.55 * seg.hw, v = (t * seg.hw + s * seg.L * 0.9) / P;
            const tri = Math.abs((((v % 2) + 2) % 2) - 1);
            base = mix3(c1, c2, smooth(0.5 - 0.7 / P, 0.5 + 0.7 / P, tri));
            break;
          }
          case "swirl": {
            // SWIRL: 2 dải lượn mềm c2 + 1 nét kim loại mảnh chạy theo (vẽ tay bằng cọ)
            const tc1 = 0.42 * Math.sin(3.1 * u + ph) - 0.1, tc2 = 0.4 * Math.sin(3.1 * u + ph + 2.2) + 0.25;
            const w1 = 0.13 + 0.05 * Math.sin(5 * u + ph), w2 = 0.09;
            const m1 = 1 - smooth(w1 - 0.03, w1 + 0.03, Math.abs(t - tc1)), m2 = 1 - smooth(w2 - 0.03, w2 + 0.03, Math.abs(t - tc2));
            base = mix3(base, c2, Math.max(m1, m2 * 0.9));
            const ml = 1 - smooth(lineW * 0.6, lineW * 1.3, Math.abs(t - tc1 - w1 - 0.02));
            if (ml > 0) { metalMix = ml; metalQ = 0; }
            break;
          }
          case "polka": {
            // CHẤM BI đều (hàng so le) — chấm tròn mép mịn, hơi nổi; trên nền mắt mèo thì dải sáng vẫn chạy dưới chấm
            const P = 0.5 * seg.hw, X = t * seg.hw, Yp = s * seg.L;
            const row = Math.floor(Yp / P), off = (row % 2) * 0.5;
            const fx = X / P + off, dx = (fx - Math.round(fx)) * P, dy = (Yp / P - row - 0.5) * P;
            const dd = Math.hypot(dx, dy), rr = 0.15 * seg.hw;
            base = mix3(base, c2, 1 - smooth(rr - 0.7, rr + 0.7, dd));
            break;
          }
          case "stripes": {
            // SỌC MẢNH dọc móng (pinstripe): xen kẽ c2 và kim loại, theo độ cong móng
            const P = 0.38, k = (t + 1) / P, f = k - Math.floor(k), id = Math.floor(k);
            const w = (id % 2 ? 1.3 : 1.8) * lineW / P;
            const m = 1 - smooth(w * 0.6, w * 1.2, Math.abs(f - 0.5));
            if (id % 2) { metalMix = m; metalQ = (f - 0.5) / Math.max(1e-3, w); } else base = mix3(base, c2, m);
            break;
          }
          case "chocodip": {
            // DÂU NHÚNG SÔ-CÔ-LA: đầu móng phủ sô-cô-la mép lượn + giọt chảy, vài sợi sô-cô-la trắng rưới chéo
            const edge = 0.68 + 0.04 * Math.sin(7 * t + ph) + 0.09 * Math.max(0, Math.cos(2.6 * t + ph)) ** 6;
            const choc = smooth(edge - aaU * 2, edge + aaU * 2, u);
            base = mix3(c1, c2, choc);
            const dz = Math.abs(Math.sin(9 * (u * 0.9 + t * 0.6) + ph));
            const driz = (1 - smooth(0.05, 0.11, dz)) * smooth(edge + 0.04, edge + 0.1, u) * (0.6 + 0.4 * Math.sin(3 * t));
            base = mix3(base, [0.9, 0.85, 0.8], Math.max(0, driz) * 0.9);
            break;
          }
          case "fawn": {
            // DA HƯƠU (fawn): đốm sáng mềm thuôn dài, mép loang — không viền (khác da báo)
            const cell = 0.62 * seg.hw, gx = (t * seg.hw) / cell, gy = (s * seg.L) / (cell * 1.25);
            const ix = Math.floor(gx), iy = Math.floor(gy);
            let best = 9;
            for (let j2 = -1; j2 <= 1; j2++) for (let i2 = -1; i2 <= 1; i2++) {
              const ci = ix + i2, cj = iy + j2;
              if (hash2(ci, cj, seedN + 21) < 0.25) continue;
              const px = ci + 0.25 + 0.5 * hash2(ci, cj, seedN + 22), py = cj + 0.25 + 0.5 * hash2(ci, cj, seedN + 23);
              const sz = 0.22 + 0.12 * hash2(ci, cj, seedN + 24);
              best = Math.min(best, Math.hypot((gx - px) * 1.3, gy - py) / sz);
            }
            base = mix3(c1, c2, 0.85 * (1 - smooth(0.65, 1.15, best)));
            break;
          }
          case "leopard": {
            // DA BÁO đúng bước thợ làm: đốm màu c2 to nhỏ không đều + viền đen ĐỨT QUÃNG hình chữ C quanh mỗi đốm
            const cell = 0.82 * seg.hw, gx = (t * seg.hw) / cell, gy = (s * seg.L) / cell;
            const ix = Math.floor(gx), iy = Math.floor(gy);
            let best = 9, bi = 0, bj = 0, bang = 0;
            for (let j2 = -1; j2 <= 1; j2++) for (let i2 = -1; i2 <= 1; i2++) {
              const ci = ix + i2, cj = iy + j2;
              const px = ci + 0.2 + 0.6 * hash2(ci, cj, seedN), py = cj + 0.2 + 0.6 * hash2(ci, cj, seedN + 1);
              const sz = 0.2 + 0.14 * hash2(ci, cj, seedN + 2), dx = gx - px, dy = gy - py, an = Math.atan2(dy, dx);
              const wob = 1 + 0.2 * Math.sin(3 * an + 6.28 * hash2(ci, cj, seedN + 3)) + 0.1 * Math.sin(5 * an + 1.7);
              const d = Math.hypot(dx * 1.1, dy) / (sz * wob);
              if (d < best) { best = d; bi = ci; bj = cj; bang = an; }
            }
            if (hash2(bi, bj, seedN + 4) > 0.15) {
              const g1 = 6.28 * hash2(bi, bj, seedN + 5);
              const gap = Math.cos(bang - g1) > 0.5 || Math.cos(bang - g1 - 2.4) > 0.86;
              base = mix3(c1, mix3(c1, c2, 0.88), 1 - smooth(0.6, 0.68, best));
              const ring = smooth(0.62, 0.7, best) * (1 - smooth(1.0, 1.08, best)) * (gap ? 0 : 1);
              base = mix3(base, [0.012, 0.008, 0.006], ring);
            }
            break;
          }
          case "checker": {
            // BÀN CỜ: ô vuông xen kẽ, hơi nén về 2 mép theo độ cong móng, mép ô khử răng cưa
            const cell = (2 * seg.hw) / 4.4, fx = (t * seg.hw * (1 + 0.12 * t * t)) / cell, fy = (s * seg.L) / cell + 0.5 * hash2(seedN, 2, 9);
            const tri = (f: number) => Math.abs((((f % 2) + 2) % 2) - 1);
            const aa = 0.7 / cell;
            const qx = smooth(0.5 - aa, 0.5 + aa, tri(fx)), qy = smooth(0.5 - aa, 0.5 + aa, tri(fy));
            base = mix3(c1, c2, qx + qy - 2 * qx * qy);
            break;
          }
          case "foil": {
            // GIẤY FOIL: mảnh kim loại nhăn rải theo 1 vệt chéo, khe hở mảnh giữa các mảnh, MỖI MẢNH nghiêng khác
            // nhau → bắt sáng khác nhau (tô sau bước ánh sáng, chế độ gương)
            const cell = 0.26 * seg.hw, gx = (t * seg.hw) / cell, gy = (s * seg.L) / cell;
            const ix = Math.floor(gx), iy = Math.floor(gy);
            let f1 = 9, f2 = 9, ci1 = 0, cj1 = 0;
            for (let j2 = -1; j2 <= 1; j2++) for (let i2 = -1; i2 <= 1; i2++) {
              const ci = ix + i2, cj = iy + j2;
              const d = Math.hypot(gx - (ci + hash2(ci, cj, seedN + 7)), gy - (cj + hash2(ci, cj, seedN + 8)));
              if (d < f1) { f2 = f1; f1 = d; ci1 = ci; cj1 = cj; } else if (d < f2) f2 = d;
            }
            const band = Math.exp(-((((u - 0.4) + 0.45 * t) / 0.2) ** 2));
            if (hash2(ci1, cj1, seedN + 9) < 0.03 + 0.72 * band) {
              const gapM = smooth(0.04, 0.1, f2 - f1); // khe giữa 2 mảnh
              metalMix = 0.96 * gapM; metalMirror = true;
              metalQ = (hash2(ci1, cj1, seedN + 10) - 0.5) * 1.7 + 0.25 * (f2 - f1);
            }
            break;
          }
          case "marble": {
            // vân đá: nền trắng sữa, gân xám mảnh uốn lượn + 1 gân kim loại
            // vân đá: gân xám MỀM như khói (đậm nhạt theo nhiễu), thêm 1 gân kim loại mảnh
            const v = fbm(u * 2.2 + seedN, t * 1.8, seedN + 9), v2 = fbm(u * 5 + 2, t * 4, seedN + 4);
            const ln = Math.abs(Math.sin(5.5 * (u * 0.8 + t * 0.55) + 6 * v));
            const vein = Math.exp(-((ln / 0.16) ** 2)) * (0.45 + 0.55 * v2) * smooth(0.3, 0.55, v + 0.15);
            const smoke = smooth(0.55, 0.85, fbm(u * 1.6 + 5, t * 1.4, seedN + 2)) * 0.25;
            const ln2 = Math.abs(Math.sin(4.5 * (u * 0.6 - t * 0.7) + 5 * v + 1.7));
            base = mix3(c1, [c2[0] * 0.75, c2[1] * 0.76, c2[2] * 0.8], Math.min(1, vein * 0.75 + smoke));
            metalMix = Math.exp(-((ln2 / 0.03) ** 2)) * 0.95 * smooth(0.5, 0.68, v);
            metalQ = 0.6 * (v - 0.5);
            break;
          }
        }
      }
      let r = base[0], g = base[1], b = base[2];
      // ---- 2) hiệu ứng + ánh sáng thật
      if (fin === "chrome" && !glazed) {
        [r, g, b] = metalShade(base, t, u, shade, side);
        const endK = cut * (0.84 + 0.16 * (1 - smooth(0.84, 1.02, u))); // đầu móng cong xuống → phản chiếu nền tối hơn
        r *= endK; g *= endK; b *= endK;
      }
      else if (glazed) {
        // glazed donut: nền sáng ánh ngọc trai — đổi sắc nhẹ hồng / xanh / vàng theo độ cong, sáng mềm cả mặt móng
        const k2 = (0.88 + 0.24 * smooth(-1, 1, shade)) * edge * cut;
        // ánh ngọc trai đổi sắc hồng → tím nhạt → vàng kim theo độ cong (như bột chrome trên nền trắng sữa)
        const th = 4.2 * t + 2.6 * u + 1.6 * shade;
        r = r * k2 * (1 + 0.1 * Math.sin(th)); g = g * k2 * (1 + 0.07 * Math.sin(th + 2.3)); b = b * k2 * (1 + 0.12 * Math.sin(th + 4.4));
        const sheen = 0.3 * Math.exp(-(((t + 0.1) / 0.42) ** 2)) * smooth(0.08, 0.35, u) * (1 - smooth(0.78, 1, u));
        r += (1 - r) * sheen; g += (1 - g) * sheen; b += (1 - b) * sheen;
      } else {
        const lit = (1 + contrast * shade) * edge * cut;
        r *= lit; g *= lit; b *= lit;
      }
      if (tipChrome > 0) {
        // đầu French tráng gương: kim loại phản chiếu thật (dải sáng gắt + mảng tối) theo độ cong móng; đầu móng cong
        // xuống nên phản chiếu đổi dần theo dọc móng
        const tc = metalShade(metal, t * 0.92 + 0.1 * (u - 0.9), u * 2.2, shade, side);
        r += (tc[0] - r) * tipChrome; g += (tc[1] - g) * tipChrome; b += (tc[2] - b) * tipChrome;
      }
      if (metalMix > 0) {
        const mc = metalMirror ? metalShade(metal, metalQ, u * 3 + metalQ * 2, shade, side) : wireShade(metal, metalQ, shade, side);
        r += (mc[0] - r) * metalMix; g += (mc[1] - g) * metalMix; b += (mc[2] - b) * metalMix;
      }
      if (velvet) {
        // VELVET (nhung từ tính): nhũ siêu mịn bị nam châm kéo thành 1 QUẦNG SÁNG MỀM rộng giữa móng, 2 mép chìm tối —
        // nhìn như vải nhung; ánh nhũ là màu nền sáng lên (không phải hạt trắng). Hạt rất mịn, biên độ nhỏ — không ra
        // mặt nhám như giấy ráp (lỗi vòng trước).
        const mxC = Math.max(c1[0], c1[1], c1[2], 1e-3);
        // ánh nhung = CHÍNH màu nền sáng lên (đỏ rượu → đỏ ánh, navy → xanh ánh), không pha trắng (pha trắng ra màu bụi)
        const glow: RGB = [0.08 + (0.85 * c1[0]) / mxC, 0.08 + (0.85 * c1[1]) / mxC, 0.08 + (0.85 * c1[2]) / mxC];
        const tcV = side * 0.12 + 0.08 * Math.sin(2.2 * u + look.seed);
        const field = Math.exp(-(((t - tcV) / 0.5) ** 2)) * (0.55 + 0.45 * smooth(0.05, 0.55, u)) * (1 - 0.35 * smooth(0.85, 1.05, u));
        const lightK = 0.5 + 0.5 * smooth(-0.8, 1, shade);
        const fine = (hash2(X, Y, look.seed) - 0.5) * 0.5 + (vnoise(X * 0.45, Y * 0.45, look.seed + 2) - 0.5) * 0.6;
        const spark = hash2(X, Y, look.seed + 9) > 0.975 ? 0.35 + 0.65 * hash2(X, Y, look.seed + 4) : 0;
        const dim = 0.55 + 0.45 * field; // mép chìm như nhung
        r *= dim; g *= dim; b *= dim;
        const amt = (0.24 * field * (1 + 0.25 * fine) * lightK + spark * 0.6 * field * lightK) * edge;
        r += glow[0] * amt; g += glow[1] * amt; b += glow[2] * amt;
      } else if (fin === "cateye") {
        // mắt mèo: dải sáng từ tính chéo qua móng: lõi sáng + quầng mềm + ánh lấp lánh nhỏ
        const d = (s - 0.52) * 0.9 + t * 0.32;
        const band = 0.7 * Math.exp(-(d * d) / (2 * 0.06 ** 2)) + 0.35 * Math.exp(-(d * d) / (2 * 0.16 ** 2));
        const sp = 0.65 + 0.35 * hash2(X, Y, look.seed);
        let glow = c2 === base0 ? [0.9, 0.85, 0.75] : [c2[0] * 0.6 + 0.4, c2[1] * 0.6 + 0.4, c2[2] * 0.6 + 0.4];
        if (pat === "auroracat") {
          // AURORA: dải từ tính đổi sắc hồng → tím → xanh băng → xanh ngọc theo bề ngang (như cực quang)
          const hq = 2.2 * t + 1.4 * s + ph;
          glow = [0.55 + 0.4 * Math.sin(hq), 0.5 + 0.4 * Math.sin(hq + 2.1), 0.62 + 0.38 * Math.sin(hq + 4.2)];
        }
        const lf = edge * (1 + 0.3 * shade) * (pat === "auroracat" ? 1.25 : 1);
        r += glow[0] * band * sp * lf; g += glow[1] * band * sp * lf; b += glow[2] * band * sp * lf;
      }
      if (motif && !PROCEDURAL.has(pat)) { // hoạ tiết (lớp SVG) phủ lên màu nền, cũng nhận ánh sáng
        const ma = motif.data[o + 3] / 255;
        if (ma > 0.01) {
          const ml = (1 + 0.35 * shade) * edge;
          r = r * (1 - ma) + LIN[motif.data[o]] * ml * ma;
          g = g * (1 - ma) + LIN[motif.data[o + 1]] * ml * ma;
          b = b * (1 - ma) + LIN[motif.data[o + 2]] * ml * ma;
        }
      }
      if (glit) {
        // nhũ: hạt sáng màu ánh kim của màu nền, hạt sáng hơn ở phía có ánh sáng
        const gv = glit[k] * (0.75 + 0.5 * smooth(-1, 1, shade)) * edge;
        r += (0.5 * base[0] + 0.55) * gv; g += (0.5 * base[1] + 0.5) * gv; b += (0.5 * base[2] + 0.4) * gv;
        const sh = 0.04 * (hash2(X, Y, look.seed + 3) - 0.5); r += sh; g += sh; b += sh;
      }
      // nhám: vân mịn THEO TỈ LỆ độ sáng (±2.5%) — cộng cố định ±0.0125 từng thành hạt cát lốm đốm trên màu tối
      if (fin === "matte") { const nz = 1 + (hash2(X, Y, 7) - 0.5) * 0.05; r *= nz; g *= nz; b *= nz; }
      // ---- 3) nét kim loại (line / chrome line): đường cong mềm dọc móng, ánh kim theo ánh sáng
      if (onNail && (pat === "lines" || pat === "chromeline")) {
        const tc = amp * Math.sin(2.4 * u + ph) - 0.05;
        const wdt = (pat === "chromeline" ? 2.3 : 1.35) * lineW;
        const span = smooth(0.12, 0.2, u) * (1 - smooth(0.88, 0.97, u));
        // nét NỔI: bóng đổ mềm lên lớp sơn nền phía khuất đèn
        const sd = Math.abs(t - (tc - side * 1.1 * wdt)) / Math.max(1e-3, wdt * 1.4);
        const shd = 0.3 * (1 - smooth(0.4, 1.3, sd)) * span;
        r *= 1 - shd; g *= 1 - shd; b *= 1 - shd;
        const nl = (t - tc) / Math.max(1e-3, wdt);
        const m = (1 - smooth(0.6, 1.2, Math.abs(nl))) * span;
        if (m > 0) {
          // sợi kim loại tròn chỉ rộng vài px: dùng bóng TRƠN của 1 sợi trụ (dải sáng rộng ~1px lệch về phía đèn, 2 mép
          // tối) — phản chiếu gắt kiểu metalShade hẹp hơn 1 điểm ảnh sẽ răng cưa thành "dây xích" dọc nét (vòng trước)
          const mc = wireShade(metal, Math.max(-1, Math.min(1, nl)), shade, side);
          r += (mc[0] - r) * m; g += (mc[1] - g) * m; b += (mc[2] - b) * m;
        }
      }
      // ---- 4) khối 3D trên móng: ngọc trai, đá pha lê, chấm, GIỌT NƯỚC — khối cầu thật (đèn theo hướng ảnh), bóng tiếp
      //      xúc + bóng đổ phía khuất đèn; đá có mặt cắt sáng / tối gắt + tia lấp lánh; giọt nước trong suốt
      let flare = 0;
      for (const bd of beads) {
        const dxp = (t - bd.t) * seg.hw, dyp = (s - bd.u * sEnd) * seg.L, R = bd.r * seg.hw;
        const dist = Math.hypot(dxp, dyp) / R;
        const lx = dxp / R, ly = dyp / R;
        if (PAINTED.has(bd.kind)) {
          // HOẠ TIẾT VẼ TAY: toạ độ theo MẶT móng cong (bề ngang thật từng đoạn + dồn hẹp về 2 mép) · khử răng cưa theo ĐIỂM
          // ẢNH trên khoảng cách đã chuẩn hoá độ dốc (mép to hay nhỏ đều ~1.5px) · mép hơi run tay cọ · viền liner tông đậm ·
          // vệt bóng trắng vẽ theo mép phía đèn thay cho vòm nhựa (gel vẽ PHẲNG dưới lớp top — chỉ hoa gel 3D mới nổi) ·
          // mỗi lớp nhận ánh sáng như lớp sơn nền
          let F = pfits.get(bd);
          if (!F || F.seg !== seg) F = fitPainted(bd, seg, eDist, sEnd, uprightRot, upS, L3, base0, c2, metal, pat);
          const tq = t < -1 ? -1 : t > 1 ? 1 : t, Wd = 1 / Math.sqrt(1 - WK * WK * tq * tq);
          const ax = hwAt(F.geo, s) * warpT(tq) - F.sx, ay = (s - F.s0) * seg.L;
          if (ax * ax + ay * ay > F.bound2) continue;
          const fl = F.fl, crP = F.cr, srP = F.sr, mx0 = ax / F.R, my0 = ay / F.R;
          const X0 = fl * (mx0 * crP + my0 * srP), Y0 = -mx0 * srP + my0 * crP, e = 0.75 / F.R;
          PS.px = 1 / F.R; PS.lx = F.mLx; PS.ly = F.mLy; PS.v = F.v;
          paintedSD(bd.kind, X0, Y0, PO); paintedSD(bd.kind, X0 + e, Y0, PX); paintedSD(bd.kind, X0, Y0 + e, PY);
          if (F.jit > 0) { // mép run nhẹ như nét cọ (nhiễu tần thấp, ≤ ±0.6px)
            const j0 = F.jit * (vnoise(X0 * 2.3, Y0 * 2.3, 71) - 0.5), jx = F.jit * (vnoise((X0 + e) * 2.3, Y0 * 2.3, 71) - 0.5), jy = F.jit * (vnoise(X0 * 2.3, (Y0 + e) * 2.3, 71) - 0.5);
            for (let q = 0; q < 5; q++) { PO[q] += j0; PX[q] += jx; PY[q] += jy; }
          }
          for (let q = 0; q < 5; q++) {
            // độ dốc của lớp q theo điểm ảnh (ngang móng × độ dồn mép, dọc móng) → khoảng cách tới mép tính bằng px
            const gx = (PX[q] - PO[q]) / e, gy = (PY[q] - PO[q]) / e, gl = (fl * gx * crP - gy * srP) * Wd, gu = fl * gx * srP + gy * crP;
            const gh = Math.hypot(gl, gu) || 1;
            DP[q] = (PO[q] * F.R) / Math.max(0.2, Math.min(3, gh)); NX[q] = gl / gh; NY[q] = gu / gh;
          }
          if (bd.kind === "gelflower") {
            // HOA GEL 3D kiểu Hàn: mỗi cánh 1 vòm gel trong mờ (dày → đục, mỏng → thấy màu nền), bóng gương trên từng cánh,
            // ngọc trai giữa, bóng đổ mềm xuống mặt móng phía khuất đèn
            const dp = DP[0];
            if (dp > 0) {
              paintedSD("gelflower", X0 + F.mLx * 0.16, Y0 + F.mLy * 0.16, PQ);
              const sh = Math.min(0.42, 0.3 * (1 - smooth(-0.06, 0.1, PQ[0])) + 0.2 * (1 - smooth(0, 2.5, dp)));
              r *= 1 - sh; g *= 1 - sh; b *= 1 - sh;
              continue;
            }
            const hx = (PX[1] - PO[1]) / e, hy = (PY[1] - PO[1]) / e;
            let nx = -0.3 * (fl * hx * crP - hy * srP), ny = -0.3 * (fl * hx * srP + hy * crP);
            const nl = Math.hypot(nx, ny); if (nl > 2.5) { nx *= 2.5 / nl; ny *= 2.5 / nl; }
            const nn = Math.hypot(nx, ny, 1), nz = 1 / nn; nx /= nn; ny /= nn;
            const ndl = Math.max(0, nx * L3[0] + ny * L3[1] + nz * L3[2]), ndh = Math.max(0, nx * H3[0] + ny * H3[1] + nz * H3[2]);
            const aT = 0.5 + 0.42 * smooth(0, 0.7, PO[1]), dif = (0.62 + 0.48 * ndl) * (0.9 + 0.2 * smooth(-1, 1, shade));
            const sp = 0.9 * Math.pow(ndh, 80) + 0.12 * Math.pow(ndh, 9), P = F.pc;
            let pr = r + (P[0] * dif - r) * aT + sp, pg = g + (P[1] * dif - g) * aT + sp, pb = b + (P[2] * dif - b) * aT + sp;
            const dP = DP[2];
            if (dP < 2.5) {
              if (dP > 0) { const ao = 0.3 * (1 - smooth(0, 2.5, dP)); pr *= 1 - ao; pg *= 1 - ao; pb *= 1 - ao; }
              const cp = 1 - smooth(-0.75, 0.75, dP);
              if (cp > 0) { // ngọc trai: khối cầu, ánh xà cừ nhẹ, điểm bóng sắc
                const mx = X0 / 0.2, my = Y0 / 0.2, mz = Math.sqrt(Math.max(0, 1 - mx * mx - my * my));
                const qx = fl * mx * crP - my * srP, qy = fl * mx * srP + my * crP;
                const pl = Math.max(0, qx * L3[0] + qy * L3[1] + mz * L3[2]), ph2 = Math.max(0, qx * H3[0] + qy * H3[1] + mz * H3[2]);
                const pd = (0.42 + 0.68 * pl) * (0.8 + 0.2 * mz), ps = 1.1 * Math.pow(ph2, 50) + 0.15 * Math.pow(ph2, 8), ir = 0.06 * Math.sin(6 * (qx * 0.7 - qy * 0.6) + 1.3);
                pr += (0.93 * pd * (1 + ir) + ps - pr) * cp; pg += (0.9 * pd + ps - pg) * cp; pb += (0.86 * pd * (1 + 0.8 * ir) + ps - pb) * cp;
              }
            }
            const cov = 1 - smooth(-0.75, 0.75, dp);
            r += (pr - r) * cov; g += (pg - g) * cov; b += (pb - b) * cov;
            continue;
          }
          const litK = (1 + contrast * shade) * edge * cut;
          // liner = tô KÍN cả hình bằng màu viền trước, rồi lớp màu thu vào trong 1 bề viền (ins) — vẽ viền thành 1 dải đè lên
          // mép lớp màu thì điểm ảnh mép (phủ ½) còn lẫn màu thân → vòng xám quanh đầu lâu / ma trên nền đen
          const lwq = F.lw * (0.85 + 0.3 * vnoise(X0 * 3.1, Y0 * 3.1, 73)); // liner run ±15% như nét cọ
          for (const op of F.ops) {
            const q = op.L, dp = DP[q];
            let cv = 1 - smooth(-0.75, 0.75, dp);
            if (op.ins !== undefined) cv = Math.min(cv, 1 - smooth(-0.75, 0.75, DP[op.ins] + lwq));
            cv *= op.a ?? 1;
            if (cv <= 0.003) continue;
            let pr: number, pg: number, pb: number;
            if (op.metal) {
              // bột chrome trên nét gel: phản chiếu theo độ cong móng, mép nét vát nhẹ bắt sáng (không phải khối cầu bóng)
              const bv = 1 - smooth(0, F.bev, -dp);
              const mc = metalShade(metal, Math.max(-1, Math.min(1, t * 0.95 + 0.6 * NX[q] * bv)), u * 2.6 + 0.5 * NY[q] * bv, shade, side);
              pr = (0.7 * mc[0] + 0.45 * metal[0]) * edge; pg = (0.7 * mc[1] + 0.45 * metal[1]) * edge; pb = (0.7 * mc[2] + 0.45 * metal[2]) * edge;
            } else {
              const c = op.c ?? c2;
              pr = c[0]; pg = c[1]; pb = c[2];
              if (op.tone) { const tv = PO[6]; if (tv > 0) { pr += (1 - pr) * tv; pg += (1 - pg) * tv; pb += (1 - pb) * tv; } else { pr *= 1 + tv; pg *= 1 + tv; pb *= 1 + tv; } }
              const facing = NX[q] * F.Lx + NY[q] * F.Ly; // mép này hướng về đèn (1) hay khuất đèn (−1)
              if (op.sh) { const k2 = 1 - op.sh * smooth(0.1, 0.85, -facing) * (1 - smooth(0.05 * F.R, 0.3 * F.R, -dp)); pr *= k2; pg *= k2; pb *= k2; }
              pr *= litK; pg *= litK; pb *= litK;
              if (op.hi) { // vệt bóng vẽ: nét trắng mảnh chạy dọc mép phía đèn, lùi vào trong ~0.14 cỡ hoạ tiết
                const hs = op.hi * (1 - smooth(F.hiW - 0.7, F.hiW + 0.7, Math.abs(-dp - F.hiD))) * smooth(0.45, 0.85, facing);
                pr += (0.97 - pr) * hs; pg += (0.97 - pg) * hs; pb += (0.97 - pb) * hs;
              }
            }
            r += (pr - r) * cv; g += (pg - g) * cv; b += (pb - b) * cv;
          }
          continue;
        }
        if (bd.kind === "star" || bd.kind === "bow") {
          // CHARM KIM LOẠI 3D (sao, nơ): độ phủ + độ cao từ hình, pháp tuyến từ độ dốc độ cao → bóng gương kim loại thật, bóng
          // đổ theo đúng hình về phía khuất đèn. Khử răng cưa ~0.75px và vát mép ≤ 4px theo cỡ thật (sao to không còn nhoè mép)
          if (dist > 1.7) continue;
          const rotA = uprightRot + (bd.rot ?? 0);
          const cr = Math.cos(rotA), sr = Math.sin(rotA), aaS = 0.75 / Math.max(1, R), bevS = Math.min(0.3, 4 / Math.max(1, R));
          const shapeAt = (x0: number, y0: number) => {
            const x = x0 * cr + y0 * sr, y = -x0 * sr + y0 * cr;
            if (bd.kind === "bow") return bowShape(x, y);
            const d = starSD(x, y);
            return { h: d < 0 ? Math.sqrt(Math.min(1, -d / bevS)) : 0, cov: 1 - smooth(-aaS, aaS, d) };
          };
          const here = shapeAt(lx, ly);
          const offx = (0.26 * L3[0]) / Math.max(0.3, L3[2]), offy = (0.26 * L3[1]) / Math.max(0.3, L3[2]);
          if (here.cov < 1) {
            const cast = shapeAt(lx + offx, ly + offy).cov * 0.4;
            const ao = (shapeAt(lx * 0.9, ly * 0.9).cov - here.cov) * 0.25;
            const sh = Math.min(0.55, Math.max(0, cast + ao)) * (1 - here.cov);
            r *= 1 - sh; g *= 1 - sh; b *= 1 - sh;
          }
          if (here.cov <= 0) continue;
          const e = 0.03, hx = (shapeAt(lx + e, ly).h - shapeAt(lx - e, ly).h) / (2 * e), hy = (shapeAt(lx, ly + e).h - shapeAt(lx, ly - e).h) / (2 * e);
          let nx = -hx * 0.55, ny = -hy * 0.55, nz2 = 1;
          const nn = Math.hypot(nx, ny, nz2); nx /= nn; ny /= nn; nz2 /= nn;
          const ndh2 = Math.max(0, nx * H3[0] + ny * H3[1] + nz2 * H3[2]);
          const mc = sphereMetal(metal, nx, ny, nz2, L3, side), sp = 1.2 * Math.pow(ndh2, 120);
          r += (mc[0] + sp - r) * here.cov; g += (mc[1] + sp - g) * here.cov; b += (mc[2] + sp - b) * here.cov;
          continue;
        }
        if (bd.kind === "gem" && bd.r >= 0.2 && dist < 2.2) {
          // tia lấp lánh hình chữ thập từ điểm bóng của viên đá to (vẽ đè trên cùng, loé cả ra ngoài viên đá)
          const hx = dxp - H3[0] * 0.5 * R, hy = dyp - H3[1] * 0.5 * R;
          flare = Math.max(flare, Math.exp(-((hy / 0.9) ** 2)) * Math.exp(-Math.abs(hx) / (0.45 * R)) + Math.exp(-((hx / 0.9) ** 2)) * Math.exp(-Math.abs(hy) / (0.45 * R)));
        }
        if (dist >= 1) {
          // bóng tiếp xúc (sát chân khối) + bóng đổ lệch về phía khuất đèn
          const off = bd.kind === "drop" ? 0.42 : 0.32; // giọt nước cao, đổ bóng xa hơn
          const sdx = lx + off * L3[0] / Math.max(0.3, L3[2]), sdy = ly + off * L3[1] / Math.max(0.3, L3[2]);
          const sdD = Math.hypot(sdx, sdy);
          const ao = 0.35 * (1 - smooth(1, 1.22, dist));
          const cast = (bd.kind === "drop" ? 0.36 : 0.42) * (1 - smooth(0.82, 1.3, sdD));
          const sh = Math.min(0.6, ao + cast);
          r *= 1 - sh; g *= 1 - sh; b *= 1 - sh;
          if (bd.kind === "drop") {
            // ánh sáng hội tụ qua giọt nước rọi xuống móng ở phía khuất đèn (vệt sáng hình liềm trong bóng đổ)
            const cau = 0.3 * Math.exp(-(((sdD - 0.55) / 0.2) ** 2)) * (1 - smooth(1, 1.35, dist)) * Math.max(0, -(lx * L3[0] + ly * L3[1]) / dist);
            r += (1 - r) * cau * 0.5; g += (1 - g) * cau * 0.5; b += (1 - b) * cau * 0.5;
          }
          continue;
        }
        const cov = 1 - smooth(0.9, 1.0, dist);
        const nz = Math.sqrt(Math.max(0, 1 - dist * dist));
        const ndl = Math.max(0, lx * L3[0] + ly * L3[1] + nz * L3[2]);
        const ndh = Math.max(0, lx * H3[0] + ly * H3[1] + nz * H3[2]);
        const lightK = 0.8 + 0.35 * smooth(-1, 1, shade);
        let br: RGB;
        if (bd.kind === "pearl") {
          // ngọc trai: khuếch tán mềm + mép tối dần + ánh xà cừ (hồng / xanh nhạt đổi theo góc) + điểm bóng nhỏ sắc
          const dif = (0.2 + 0.85 * ndl) * (0.72 + 0.28 * nz) * lightK;
          const ir = 0.09 * Math.sin(7 * (lx * 0.7 - ly * 0.6) + 1.3) * (1 - 0.6 * ndl);
          const sp = 1.25 * Math.pow(ndh, 70) + 0.18 * Math.pow(ndh, 9);
          const bounce = 0.1 * (1 - nz) * Math.max(0, -ly); // ánh hắt từ mặt móng lên đáy hạt
          br = [Math.min(1.2, 0.9 * dif * (1 + ir) + sp + bounce * base[0]), Math.min(1.2, 0.86 * dif * (1 - 0.5 * ir) + sp + bounce * base[1]), Math.min(1.2, 0.82 * dif * (1 + 0.8 * ir) + sp + bounce * base[2])];
        } else if (bd.kind === "gem") {
          // đá pha lê: viền chấu tối · mặt bàn (bát giác giữa) phản chiếu êm · vành 16 mặt cắt sáng / tối RẤT tương phản
          // (mặt hướng về đèn sáng hơn) · vài mặt loé màu cầu vồng · thấy chút màu sơn bên dưới qua đá
          const ax = Math.abs(lx), ay = Math.abs(ly), oct = Math.max(ax, ay, (ax + ay) / Math.SQRT2);
          const ang = Math.atan2(ly, lx);
          const fi = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 16);
          const fa = ((fi + 0.5) / 16) * 2 * Math.PI - Math.PI;
          const face = Math.max(0, Math.cos(fa) * 0.62 * L3[0] + Math.sin(fa) * 0.62 * L3[1] + 0.78 * L3[2]);
          const hf = hash2(fi, Math.round(bd.u * 100 + bd.t * 37), seedN);
          let v: number;
          if (oct < 0.42) v = 0.35 + 0.35 * (1 - oct / 0.42) * hash2(fi >> 1, 5, seedN) + 0.25 * face;
          else if (dist < 0.9) v = 0.04 + 1.1 * Math.pow(hf, 1.6) * (0.45 + 0.75 * face);
          else v = 0.08 + 0.1 * face; // viền chấu
          const fire = hf > 0.72 && dist < 0.9 && oct >= 0.42 ? 0.35 : 0;
          const hue = hash2(fi, 3, seedN) * 6.28;
          const sp = 1.4 * Math.pow(ndh, 140);
          const tr = 0.22 * (1 - v);
          br = [
            Math.min(1.3, v * lightK * (1 + fire * Math.sin(hue)) + tr * base[0] + sp),
            Math.min(1.3, v * lightK * (1 + fire * Math.sin(hue + 2.1)) + tr * base[1] + sp),
            Math.min(1.3, v * 1.04 * lightK * (1 + fire * Math.sin(hue + 4.2)) + tr * base[2] + sp),
          ];
        } else if (bd.kind === "eye") {
          // MẮT QUỶ 3D: giọt gel trắng tròn (lòng trắng có gân đỏ mảnh), tròng màu c2 + đồng tử đen, điểm bóng gắt
          const rr = Math.hypot(lx - 0.05, ly - 0.02);
          const vein = (1 - smooth(0.012, 0.03, Math.abs(Math.sin(9 * Math.atan2(ly, lx) + 3 * dist)) * dist)) * smooth(0.55, 0.9, dist);
          let base3: RGB = [0.93 - 0.35 * vein, 0.9 - 0.75 * vein, 0.88 - 0.75 * vein];
          if (rr < 0.44) base3 = mix3(c2[0] + c2[1] + c2[2] > 0.15 ? c2 : [0.05, 0.4, 0.1], [0.01, 0.01, 0.01], 1 - smooth(0.17, 0.2, rr));
          const dif = (0.35 + 0.75 * ndl) * lightK, sp = 1.3 * Math.pow(ndh, 90);
          br = [base3[0] * dif + sp, base3[1] * dif + sp, base3[2] * dif + sp];
        } else if (bd.kind === "mdrop") {
          // GIỌT CHROME (blob kim loại 3D): khối cầu tráng gương — phản chiếu phòng chụp theo pháp tuyến cầu + điểm bóng gắt
          const mc = sphereMetal(metal, lx, ly, nz, L3, side);
          const sp = 1.3 * Math.pow(ndh, 110);
          const kk = 0.75 + 0.25 * nz;
          br = [mc[0] * kk + sp, mc[1] * kk + sp, mc[2] * kk + sp];
        } else if (bd.kind === "drop") {
          // GIỌT NƯỚC (theo ảnh giọt nước thật): thân trong suốt thấy màu sơn bên dưới, SÁNG + nhạt màu dần về phía
          // khuất đèn (ánh hội tụ), hơi tối phía đèn · vòng khúc xạ XÁM nhạt màu sát mép (phản chiếu môi trường tối),
          // dày hơn phía đèn · mép sáng mảnh phía khuất đèn · điểm bóng cửa sổ sắc nét phía đèn + đốm phụ nhỏ đối diện
          const toL = (lx * L3[0] + ly * L3[1]) / Math.max(0.05, dist);
          const Yb = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const lift = 0.1 + 0.62 * Math.exp(-(((dist - 0.5) / 0.32) ** 2)) * Math.max(0, -toL);
          const dark = 1 - 0.2 * Math.max(0, toL) * dist;
          const body: RGB = [(r + (1 - r) * lift) * dark, (g + (1 - g) * lift) * dark, (b + (1 - b) * lift) * dark];
          // vòng khúc xạ RỘNG phía đèn (như ảnh thật: ~1/3 giọt phía đó xám), mảnh phía đối diện
          const ring = smooth(0.45 + 0.3 * Math.max(0, -toL), 0.93, dist) * (0.35 + 0.65 * Math.max(0, toL));
          const ringC: RGB = [Yb * 0.32 + 0.015, Yb * 0.33 + 0.015, Yb * 0.36 + 0.02];
          const col = mix3(body, ringC, 0.78 * ring);
          const edgeHi = 0.65 * Math.exp(-(((dist - 0.88) / 0.06) ** 2)) * Math.max(0, -toL);
          const dW = Math.hypot((lx - H3[0] * 0.55) / 0.2, (ly - H3[1] * 0.55) / 0.13);
          const win = 1 - smooth(0.65, 1.0, dW);
          const dot2 = Math.exp(-(((lx + H3[0] * 0.45) ** 2 + (ly + H3[1] * 0.45) ** 2) / 0.004));
          const add = Math.min(1, edgeHi + 0.95 * win + 0.6 * dot2);
          br = [col[0] + (1 - col[0]) * add, col[1] + (1 - col[1]) * add, col[2] + (1 - col[2]) * add];
        } else {
          const dif = (0.45 + 0.6 * ndl) * lightK;
          const sp = 0.8 * Math.pow(ndh, 40);
          br = [c2[0] * dif + sp, c2[1] * dif + sp, c2[2] * dif + sp];
        }
        r += (br[0] - r) * cov; g += (br[1] - g) * cov; b += (br[2] - b) * cov;
      }
      // ---- 4b) ĐỘ DÀY GEL ở mép (như móng làm thật): chân móng + 2 bên — lớp gel lẩn dưới nếp da, có viền bóng mờ mảnh;
      //      mép tự do (đầu móng) — ánh sáng xuyên qua mép gel thành 1 đường sáng mảnh
      const dE = eDist[k];
      if (op >= 0.99 && dE < 5) {
        const tipZone = smooth(0.82, 0.96, u);
        // rõ nhất ở CHÂN móng (gel lẩn dưới da), 2 bên rất nhẹ — đều khắp mép thì thành nét viền như vẽ
        const shE = (0.06 + 0.1 * (1 - smooth(0.12, 0.35, u))) * Math.exp(-dE / 1.2) * (1 - tipZone);
        r *= 1 - shE; g *= 1 - shE; b *= 1 - shE;
        if (fin !== "matte") {
          const ge = 0.08 * Math.exp(-(((dE - 1.6) / 1.3) ** 2)) * smooth(0.9, 1.0, u);
          r += (1 - r) * ge; g += (1 - g) * ge; b += (1 - b) * ge;
        }
        if (extW > 0) {
          // mép tự do của móng đắp: thấy bề dày gel / bột — 1 viền tối mảnh sát mép
          const shT = 0.16 * Math.exp(-dE / 0.9) * smooth(0.88, 0.98, u) * extW;
          r *= 1 - shT; g *= 1 - shT; b *= 1 - shT;
        }
      }
      // ---- 5) bóng gương: vệt bóng THẬT (dọc móng, không sát mép) hoặc vệt phản chiếu tổng hợp
      const inner = (1 - smooth(0.78, 0.98, at)) * smooth(0.02, 0.1, s) * (1 - smooth(0.94, 1.02, s));
      let spec = lm.spec[k] * inner;
      if (synth) {
        // ảnh không có ánh đèn để mượn → vẽ PHẢN CHIẾU CỬA SỔ MỀM như ảnh chụp thật: mép mờ (gauss, không phải thanh
        // trắng cứng), rộng ở giữa thon 2 đầu, cong theo móng, quầng sáng nhẹ quanh; mỗi móng lệch chút vị trí / độ dài;
        // vệt phụ phía đối diện rất mờ (vệt cứng + vệt phụ đậm từng làm móng nhìn như vẽ máy tính)
        const tc = side * (0.4 + 0.07 * jit - 0.1 * (u - 0.5) * (u - 0.5));
        const wB = 0.075 + 0.035 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.12) / 0.7)));
        const alongK = smooth(0.1 + 0.06 * jit2, 0.34, u) * (1 - smooth(0.66, 0.88 + 0.05 * jit, u));
        const core = Math.exp(-(((t - tc) / wB) ** 2)) * alongK;
        const halo = 0.07 * Math.exp(-(((t - tc) / (wB * 2.2)) ** 2)) * alongK;
        const rim = 0.12 * Math.exp(-(((t + side * 0.66) / 0.07) ** 2)) * smooth(0.3, 0.45, u) * (1 - smooth(0.6, 0.78, u));
        spec = Math.max(spec, synth * (0.82 * core + halo + rim));
      }
      if (extW > 0 && fin !== "matte") {
        // ánh đèn thật của ảnh dừng ở mép móng thật → phần đắp vẽ tiếp vệt phản chiếu mềm (cùng phía đèn), không thì
        // nửa móng bóng nửa móng lì như dán giấy
        const tcE = side * (0.4 + 0.07 * jit - 0.1 * (u - 0.5) * (u - 0.5));
        const coreE = Math.exp(-(((t - tcE) / 0.09) ** 2)), haloE = 0.08 * Math.exp(-(((t - tcE) / 0.2) ** 2));
        spec = Math.max(spec, 0.7 * extW * (1 - smooth(0.86, 0.98, u)) * (0.82 * coreE + haloE));
      }
      spec = Math.min(1, spec * gloss);
      r = r + (1 - r) * spec; g = g + (1 - g) * spec; b = b + (1 - b) * spec;
      // phản chiếu mềm THẬT của ảnh (ánh đèn loang trên mặt móng) cộng lên màu mới — y như móng mới trong cùng tấm ảnh
      const shn = lm.sheen[k] * (fin === "matte" ? 0.05 : fin === "chrome" && !glazed ? 0.45 : 0.92);
      r += shn; g += shn; b += shn;
      if (flare > 0) { const f = Math.min(1, flare * 0.85); r += (1 - r) * f; g += (1 - g) * f; b += (1 - b) * f; }
      // mép móng: phần "nền" của điểm pha là màu DA ngay ngoài mép (không phải màu sơn cũ — từng lộ viền đen
      // mảnh quanh móng khi đổi móng đen sang màu sáng); sơn trong (thạch) thì vẫn thấy móng thật bên dưới
      const uu = op >= 1 && seg.alpha[k] < 1 ? under.get(k) : undefined;
      const R0 = uu ? uu[0] : img.data[idx], G0 = uu ? uu[1] : img.data[idx + 1], B0 = uu ? uu[2] : img.data[idx + 2];
      out[o] = R0 * (1 - a) + linToSrgb(r) * a;
      out[o + 1] = G0 * (1 - a) + linToSrgb(g) * a;
      out[o + 2] = B0 * (1 - a) + linToSrgb(b) * a;
    }
    // ---- 6) BÓNG ĐỔ của phần đắp dài lên da / nền phía khuất đèn (móng đắp nổi khỏi đầu ngón) — không có thì
    //      móng như lơ lửng / dán lên ảnh
    if (seg.ext && op >= 0.99) {
      const { w, h } = seg;
      const ux = axUx, uy = axUy, vx = axVx, vy = axVy;
      let lx2 = side * 0.55 * vx + 0.42 * upS * ux, ly2 = side * 0.55 * vy + 0.42 * upS * uy;
      const ln = Math.hypot(lx2, ly2) || 1; lx2 /= ln; ly2 /= ln;
      const shift = Math.max(2, 0.1 * seg.hw);
      const A = boxBlur(seg.alpha, w, h, 2);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const k = yy * w + xx;
        if (seg.alpha[k] >= 0.99 || seg.along[k] < 0.92) continue;
        const X = seg.x0 + xx, Y = seg.y0 + yy;
        if (X < cx || Y < cy || X >= cx + cw || Y >= cy + ch) continue;
        const sx = Math.round(xx + lx2 * shift), sy = Math.round(yy + ly2 * shift);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const sh = 0.32 * (A[sy * w + sx] / 25) * (1 - seg.alpha[k]) * smooth(0.95, 1.1, seg.along[k]);
        if (sh <= 0.003) continue;
        const o = ((Y - cy) * cw + (X - cx)) * 4;
        out[o] *= 1 - sh; out[o + 1] *= 1 - sh; out[o + 2] *= 1 - sh;
      }
    }
  });
  return { w: cw, h: ch, data: out };
}

/** Hình học để đặt lớp hoạ tiết SVG đúng móng thật (gốc/đầu đã chỉnh tâm, bề ngang đo được, độ dài kể cả đắp). */
export function motifGeometry(seg: NailSeg, lengthFactor = 1): { base: P; tip: P; width: number } {
  const lf = Math.max(1, lengthFactor);
  return { base: seg.base, tip: { x: seg.base.x + (seg.tip.x - seg.base.x) * lf, y: seg.base.y + (seg.tip.y - seg.base.y) * lf }, width: seg.hw * 2 };
}
