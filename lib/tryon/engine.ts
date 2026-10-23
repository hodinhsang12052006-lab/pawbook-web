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
}

/** Kết quả KHỚP KHUÔN 1 móng (bước tốn thời gian) — đổi dáng / độ dài đắp chỉ cần vẽ lại mặt nạ (rasterNail). */
export interface NailModel {
  fit: NailFit; byColor: boolean; quality: { inside: number; ring: number };
  /** hệ trục của khuôn (gốc O, trục dọc U, trục ngang V) + chiều dài tham chiếu L (2 điểm chạm) */
  O: P; U: P; V: P; L: number;
  /** chấm điểm "giống móng" cho 1 màu Lab ở vị trí s dọc móng (chỉ có khi tách theo màu) */
  classify: ((s: number) => (c: number[]) => number) | null;
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
  return { fit, byColor, quality, O: FO, U: FU, V: FV, L, classify: byColor ? classifier : null };
}

/** Bước 2: vẽ mặt nạ: khuôn móng thật (nở 0.6px phủ viền pha màu) ∪ phần đắp dài theo dáng. */
export function rasterNail(img: Img, model: NailModel, opts: { lengthFactor?: number; shape?: Shape } = {}): NailSeg {
  const lf = Math.max(1, opts.lengthFactor ?? 1), shape = opts.shape ?? "oval";
  const { fit, byColor, quality, O: FO, U: FU, V: FV, L } = model;
  const G = 0.6;
  const atFit = (s: number, t: number): P => ({ x: FO.x + FU.x * s + FV.x * t, y: FO.y + FU.y * s + FV.y * t });
  const fg: NailFit = { ...fit, s0: fit.s0 - G, s1: fit.s1 + G, hw: fit.hw + G };
  const natL = fit.s1 - fit.s0;
  const Ltot = fit.s0 + natL * lf;
  const ext = lf > 1.02;
  const extHalf = (s: number) => (ext && s >= fit.s0 + 0.5 * natL ? halfWidthAt(shape, s - fit.s0, Ltot - fit.s0, fitBody(fit, Math.min(s, fit.s1), L)) : 0);
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
    return fitInside(fg, s, t, L) || Math.abs(t - fitCenter(fit, s, L)) <= extHalf(s);
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
    const c = fitCenter(fit, s, L);
    if (fitInside(fg, s, t, L)) nat[k] = 1;
    along[k] = (s - fit.s0) / Math.max(1, natL);
    across[k] = (t - c) / Math.max(1, Math.max(fitBody(fit, Math.min(Math.max(s, fit.s0), fit.s1), L), halfU(s)));
  }
  // BÁM MÉP: khuôn trơn có thể hụt 1–3px ở góc / mép so với móng thật (màu cũ lộ thành viền / góc nhọn — rõ nhất
  // khi đổi móng đen sang màu sáng). Nở thêm tối đa 3 lượt × 1px vào các điểm CHẮC LÀ MÓNG (p ≥ 0.6) liền kề.
  if (byColor && model.classify) {
    const cls = model.classify;
    for (let pass = 0; pass < 3; pass++) {
      const add: number[] = [];
      for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
        const k = yy * w + xx;
        if (alpha[k] >= 0.99) continue;
        if (Math.max(alpha[k - 1], alpha[k + 1], alpha[k - w], alpha[k + w]) < 0.5) continue;
        const X = x0 + xx, Y = y0 + yy, i = (Y * img.w + X) * 4;
        const pv = cls(local(X, Y).s)(lab(img.data[i], img.data[i + 1], img.data[i + 2]));
        if (pv >= 0.6) add.push(k, smooth(0.6, 0.85, pv));
      }
      if (!add.length) break;
      for (let q = 0; q < add.length; q += 2) { const k = add[q]; if (add[q + 1] > alpha[k]) { alpha[k] = add[q + 1]; nat[k] = 1; } }
    }
  }
  const cB = fitCenter(fit, fit.s0, L), cT = fitCenter(fit, fit.s1, L);
  // đường viền: 96 tia từ tâm móng, dò mép bằng chia đôi (khuôn lồi quanh tâm)
  const sC = (fit.s0 + Math.max(fit.s1, ext ? Ltot : fit.s1)) / 2, C = atFit(sC, fitCenter(fit, sC, L));
  const inShape = (x: number, y: number) => { const { s, t } = local(x, y); return fitInside(fit, s, t, L) || Math.abs(t - fitCenter(fit, s, L)) <= extHalf(s); };
  const outline: P[] = [];
  const rMax = Math.hypot(w, h);
  for (let k = 0; k < 96; k++) {
    const an = (k / 96) * 2 * Math.PI, dx = Math.cos(an), dy = Math.sin(an);
    let lo = 0, hi = rMax;
    for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; if (inShape(C.x + dx * mid, C.y + dy * mid)) lo = mid; else hi = mid; }
    outline.push({ x: Math.round((C.x + dx * lo) * 10) / 10, y: Math.round((C.y + dy * lo) * 10) / 10 });
  }
  return { x0, y0, w, h, alpha, natural: nat, along, across, base: atFit(fit.s0, cB), tip: atFit(fit.s1, cT), L: natL, hw: fit.hw, offset: fit.c0, byColor, fit, quality, outline };
}

// ---------------------------------------------------------------- tô màu theo ánh sáng thật
export interface LookColors {
  colors: string[]; finish: Finish; pattern: string; seed: number;
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
interface LightMap { shade: Float32Array; spec: Float32Array; weight: Float32Array; streak: boolean }
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
  if (idx.length < 40) return { shade, spec, weight, streak: false };
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
  idx.forEach((k, i) => { if (res[i] > thr) hot[k] = res[i]; });
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
    keep.push(...pix);
    if (Math.abs(mx / seg.hw) <= 0.6 && pix.length >= 0.008 * idx.length) main = true;
  }
  if (keep.length) {
    const R = new Float32Array(n);
    for (const k of keep) R[k] = hot[k];
    const Rb = boxBlur(R, w, h, 1);
    for (let k = 0; k < n; k++) spec[k] = smooth(thr * 0.6, thr * 2.6, Rb[k] / 9);
  }
  return { shade, spec, weight, streak: main };
}

/** Màu DA ngay ngoài mép móng cho từng điểm mép (0 < độ phủ < 1): trung bình các điểm ngoài khuôn trong bán kính 2px. */
function edgeUnder(img: Img, seg: NailSeg): Map<number, [number, number, number]> {
  const m = new Map<number, [number, number, number]>();
  const { w, h } = seg;
  for (let k = 0; k < w * h; k++) {
    const a = seg.alpha[k];
    if (a <= 0 || a >= 1) continue;
    const xx = k % w, yy = (k - xx) / w;
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = xx + dx, Y = yy + dy;
      if (X < 0 || Y < 0 || X >= w || Y >= h || seg.alpha[Y * w + X] > 0) continue;
      const i = ((seg.y0 + Y) * img.w + seg.x0 + X) * 4;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
    if (n >= 2) m.set(k, [r / n, g / n, b / n]);
  }
  return m;
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

/**
 * Vẽ 1 mẫu lên ảnh → ảnh mới (cả ảnh, hoặc chỉ khung `crop` cho nhẹ). `motif`: lớp hoạ tiết RGBA (vẽ từ SVG
 * NailArt) CÙNG CỠ ẢNH RA (cả ảnh, hoặc đúng khung crop), có thể null.
 * Mỗi móng: màu nền (mix màu: ngón 3–4 đổi màu phụ) × mặt ánh sáng thật của móng, hoạ tiết phủ lên rồi cũng
 * nhận ánh sáng, bóng gương (vệt bóng thật chạy dọc móng; thiếu thì 1 vệt phản chiếu mảnh, sắc, cong theo
 * móng) phủ trên cùng. Chrome: phản chiếu môi trường kiểu kim loại; nhũ: hạt tròn lấp lánh.
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
  const cols = (look.colors.length ? look.colors : ["#ec4899"]).map(hexToRgb).map((c) => c.map((x) => LIN[x]) as [number, number, number]);
  const c2 = cols[1] ?? cols[0];
  segs.forEach((seg, i) => {
    const base = look.pattern === "mixmatch" && (i === 2 || i === 3) ? c2 : cols[0];
    const lm = lightMap(img, seg);
    const glit = look.finish === "glitter" ? glitterLayer(seg, look.seed + i * 17) : null;
    const gloss = look.finish === "matte" ? 0.06 : look.finish === "chrome" ? 1.0 : 0.9;
    const contrast = look.finish === "matte" ? 0.3 : 0.5;
    // móng gốc không có vệt bóng (móng nhám / móng trơn) → vẽ vệt phản chiếu cho mẫu bóng
    const synth = look.finish !== "matte" && !lm.streak ? (look.finish === "chrome" ? 0.5 : 0.75) : 0;
    const lumBase = 0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2];
    const under = edgeUnder(img, seg);
    for (let k = 0; k < seg.alpha.length; k++) {
      const a = seg.alpha[k] * op; if (a <= 0) continue;
      const xx = k % seg.w, yy = (k - xx) / seg.w;
      const X = seg.x0 + xx, Y = seg.y0 + yy;
      if (X < cx || Y < cy || X >= cx + cw || Y >= cy + ch) continue;
      const idx = (Y * img.w + X) * 4, o = ((Y - cy) * cw + (X - cx)) * 4;
      const s = seg.along[k], t = seg.across[k];
      const at = Math.abs(t);
      const shade = lm.weight[k] * lm.shade[k] + (1 - lm.weight[k]) * (-0.12 * Math.max(0, s - 1) - 0.04 - 0.25 * t * t);
      const edge = 1 - 0.28 * Math.pow(Math.max(0, (at - 0.62) / 0.38), 2); // 2 mép móng cong → tối dần
      const cut = 1 - 0.12 * (1 - smooth(0, 0.1, s)); // chân móng hơi tối
      let r = base[0], g = base[1], b = base[2];
      if (look.finish === "chrome") {
        // kim loại: phản chiếu "phòng chụp" theo bề ngang móng (dải sáng chính, dải tối, dải sáng phụ) + ánh sáng ảnh
        const env = 0.16 + 0.95 * Math.exp(-(((t + 0.4) / 0.2) ** 2)) + 0.45 * Math.exp(-(((t - 0.55) / 0.14) ** 2))
          - 0.1 * Math.exp(-(((t - 0.08) / 0.22) ** 2)) + 0.25 * smooth(-1, 1.2, shade) + 0.06 * Math.sin(5 * s + 2 * t);
        const tint = [0.55 * r + 0.45 * Math.min(1, lumBase * 1.4), 0.55 * g + 0.45 * Math.min(1, lumBase * 1.4), 0.55 * b + 0.45 * Math.min(1, lumBase * 1.4)];
        r = tint[0] * env * edge * cut; g = tint[1] * env * edge * cut; b = tint[2] * env * edge * cut;
      } else {
        const lit = (1 + contrast * shade) * edge * cut;
        r *= lit; g *= lit; b *= lit;
      }
      if (look.finish === "cateye") {
        // dải sáng từ tính chéo qua móng: lõi sáng + quầng mềm + ánh lấp lánh nhỏ
        const d = (s - 0.52) * 0.9 + t * 0.32;
        const band = 0.7 * Math.exp(-(d * d) / (2 * 0.06 ** 2)) + 0.35 * Math.exp(-(d * d) / (2 * 0.16 ** 2));
        const sp = 0.65 + 0.35 * hash2(X, Y, look.seed);
        const glow = c2 === base ? [0.9, 0.85, 0.75] : [c2[0] * 0.6 + 0.4, c2[1] * 0.6 + 0.4, c2[2] * 0.6 + 0.4];
        const lf = edge * (1 + 0.3 * shade);
        r += glow[0] * band * sp * lf; g += glow[1] * band * sp * lf; b += glow[2] * band * sp * lf;
      }
      if (motif) { // hoạ tiết (lớp SVG) phủ lên màu nền, cũng nhận ánh sáng
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
      if (look.finish === "matte") { const nz = (hash2(X, Y, 7) - 0.5) * 0.025; r += nz; g += nz; b += nz; }
      // bóng gương: vệt bóng THẬT (dọc móng, không sát mép = da lộ ra) hoặc vệt phản chiếu tổng hợp
      const inner = (1 - smooth(0.78, 0.98, at)) * smooth(0.02, 0.1, s) * (1 - smooth(0.94, 1.02, s));
      let spec = lm.spec[k] * inner;
      if (synth) {
        // vệt phản chiếu cửa sổ: mảnh, sắc, cong nhẹ theo móng, mờ dần 2 đầu + vệt phụ mảnh ở mép đối diện + ánh
        // sáng rộng RẤT nhẹ (0.05 từng làm đen bóng thành xám L≈25 thay vì L≈7 — kiểm thử E9)
        const tc = -0.44 + 0.12 * (s - 0.5) * (s - 0.5);
        const streak = Math.exp(-(((t - tc) / 0.075) ** 4)) * smooth(0.12, 0.3, s) * (1 - smooth(0.7, 0.9, s));
        const rim = 0.4 * Math.exp(-(((t - 0.64) / 0.045) ** 2)) * smooth(0.3, 0.45, s) * (1 - smooth(0.6, 0.75, s));
        const sheen = 0.006 * Math.exp(-(((t + 0.2) / 0.5) ** 2)) * smooth(0.05, 0.3, s) * (1 - smooth(0.8, 1.0, s));
        spec = Math.max(spec, synth * (streak + rim) + sheen);
      }
      spec = Math.min(1, spec * gloss);
      r = r + (1 - r) * spec; g = g + (1 - g) * spec; b = b + (1 - b) * spec;
      // mép móng: phần "nền" của điểm pha là màu DA ngay ngoài mép (không phải màu sơn cũ — từng lộ viền đen
      // mảnh quanh móng khi đổi móng đen sang màu sáng); sơn trong (thạch) thì vẫn thấy móng thật bên dưới
      const u = op >= 1 && seg.alpha[k] < 1 ? under.get(k) : undefined;
      const R0 = u ? u[0] : img.data[idx], G0 = u ? u[1] : img.data[idx + 1], B0 = u ? u[2] : img.data[idx + 2];
      out[o] = R0 * (1 - a) + linToSrgb(r) * a;
      out[o + 1] = G0 * (1 - a) + linToSrgb(g) * a;
      out[o + 2] = B0 * (1 - a) + linToSrgb(b) * a;
    }
  });
  return { w: cw, h: ch, data: out };
}

/** Hình học để đặt lớp hoạ tiết SVG đúng móng thật (gốc/đầu đã chỉnh tâm, bề ngang đo được, độ dài kể cả đắp). */
export function motifGeometry(seg: NailSeg, lengthFactor = 1): { base: P; tip: P; width: number } {
  const lf = Math.max(1, lengthFactor);
  return { base: seg.base, tip: { x: seg.base.x + (seg.tip.x - seg.base.x) * lf, y: seg.base.y + (seg.tip.y - seg.base.y) * lf }, width: seg.hw * 2 };
}
