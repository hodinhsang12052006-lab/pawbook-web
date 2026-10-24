// BỘ DÒ MÓNG TỰ ĐỘNG của PawNail — khách chỉ chụp ảnh tay, không phải chạm từng móng.
// Ảnh nail thường chụp CẬN các ngón (không thấy lòng bàn tay → bộ nhận diện bàn tay thông thường bó tay), nên
// dò theo đúng thứ thợ nhìn: (1) tìm màu DA của bàn tay; (2) móng là những mảng KHÁC màu da, nằm lọt giữa
// da (da ôm chân móng + 2 bên), hình thuôn, lồi, bề ngang đều — không phải nền vải / khe giữa 2 ngón;
// (3) đầu nào nối tiếp cả ngón tay dài là GỐC móng, đầu kia là ĐẦU móng. Ra 2 điểm gốc → đầu cho mỗi móng;
// bộ khớp khuôn (engine.fitNail) tìm đúng viền móng quanh đó và quyết định nhận / bỏ.
// Thuần TypeScript, chạy trong Web Worker (~30ms ở ảnh thu nhỏ 360px).
import { lab, type Img, type Mark, type P } from "./engine";

export interface FoundNail { mark: Mark; score: number; area: number }

const dEw = (a: number[], b: number[]) => Math.hypot(0.45 * (a[0] - b[0]), a[1] - b[1], a[2] - b[2]);

/** Thu nhỏ (trung bình khối) để dò nhanh; trả Lab từng điểm. */
function smallLab(img: Img, maxSide: number) {
  const k = Math.max(1, Math.ceil(Math.max(img.w, img.h) / maxSide));
  const w = Math.floor(img.w / k), h = Math.floor(img.h / k);
  const L = new Float32Array(w * h), A = new Float32Array(w * h), B = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) { const i = ((y * k + dy) * img.w + x * k + dx) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; }
    const n = k * k, c = lab(r / n, g / n, b / n);
    L[y * w + x] = c[0]; A[y * w + x] = c[1]; B[y * w + x] = c[2];
  }
  return { k, w, h, L, A, B };
}

/**
 * Màu da: cụm màu ẤM, đủ đậm sắc (vải kem / be nền ảnh nhạt sắc hơn da), có nhiều ở GIỮA ảnh nhưng ít ở VIỀN ảnh
 * (viền ảnh chủ yếu là nền: khăn, áo len, vải satin). Chấm từng ô màu = mật độ giữa ảnh − 0.8 × mật độ viền.
 */
function skinModel(s: ReturnType<typeof smallLab>): number[] | null {
  const BIN = 3, mid = new Map<string, number>(), edge = new Map<string, number>();
  const bx = Math.round(s.w * 0.08), by = Math.round(s.h * 0.08);
  let nMid = 0, nEdge = 0;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = y * s.w + x, a = s.A[i], b = s.B[i], l = s.L[i];
    const isEdge = x < bx || y < by || x >= s.w - bx || y >= s.h - by;
    const isMid = x > s.w * 0.2 && x < s.w * 0.8 && y > s.h * 0.2 && y < s.h * 0.8;
    if (isEdge) nEdge++; if (isMid) nMid++;
    const ch = Math.hypot(a, b), hue = (Math.atan2(b, a) * 180) / Math.PI;
    if (ch < 9 || hue < 12 || hue > 70 || l < 18 || l > 93) continue;
    const key = `${Math.round(a / BIN)},${Math.round(b / BIN)}`;
    if (isEdge) edge.set(key, (edge.get(key) ?? 0) + 1);
    if (isMid) mid.set(key, (mid.get(key) ?? 0) + 1);
  }
  if (!mid.size) return null;
  let best = "", bv = -Infinity;
  for (const key of mid.keys()) {
    const [ia, ib] = key.split(",").map(Number);
    let m = 0, e = 0;
    for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const k2 = `${ia + da},${ib + db}`; m += mid.get(k2) ?? 0; e += edge.get(k2) ?? 0; }
    const v = m / Math.max(1, nMid) - 0.8 * (e / Math.max(1, nEdge));
    if (v > bv) { bv = v; best = key; }
  }
  if (bv <= 0.02) return null;
  const [ia, ib] = best.split(",").map(Number);
  const Ls: number[] = [];
  for (let i = 0; i < s.w * s.h; i++) if (Math.abs(s.A[i] / BIN - ia) <= 1.5 && Math.abs(s.B[i] / BIN - ib) <= 1.5) Ls.push(s.L[i]);
  Ls.sort((x, y) => x - y);
  return [Ls[Ls.length >> 1] ?? 65, ia * BIN, ib * BIN];
}

/** Tìm móng trong ảnh → tối đa 5 cặp điểm gốc → đầu (toạ độ ảnh gốc), xếp trái → phải. */
export function findNails(img: Img, debug?: (d: { w: number; h: number; k: number; skin: number[]; sk: Uint8Array; lab2: Int32Array; why: Map<number, string>; encl: Uint8Array }) => void): FoundNail[] {
  const s = smallLab(img, 360);
  const { w, h } = s, N = w * h;
  const skin = skinModel(s);
  if (!skin) return [];
  // 1) mặt nạ da theo SẮC MÀU (góc màu + độ đậm sắc gần da) — sáng / tối do ánh đèn không đổi sắc nên da
  //    trong bóng vẫn là da; vải kem / trắng nhạt sắc, móng sơn khác sắc → không phải da
  const sH = Math.atan2(skin[2], skin[1]), sC = Math.hypot(skin[1], skin[2]);
  const isSkin = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const ch = Math.hypot(s.A[i], s.B[i]);
    let dh = Math.abs(Math.atan2(s.B[i], s.A[i]) - sH); if (dh > Math.PI) dh = 2 * Math.PI - dh;
    isSkin[i] = ch > 0.45 * sC && ch < 1.9 * sC && dh < 0.28 && s.L[i] > 0.4 * skin[0] && s.L[i] < Math.min(98, skin[0] + 22) ? 1 : 0;
  }
  // làm sạch: đóng 1px (lấp lỗ li ti trên da) rồi mở 1px (bỏ đốm da lẻ trên nền)
  const morph = (src: Uint8Array, grow: boolean) => {
    const out = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let any = grow ? 0 : 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy, v = X < 0 || Y < 0 || X >= w || Y >= h ? 0 : src[Y * w + X];
        if (grow && v) any = 1; if (!grow && !v) any = 0;
      }
      out[y * w + x] = any;
    }
    return out;
  };
  const sk = morph(morph(morph(morph(isSkin, true), false), false), true);
  const skinArea = sk.reduce((a, v) => a + v, 0);
  if (skinArea < 0.05 * N) return [];
  // 2) phần KHÔNG phải da chia theo CỤM MÀU (k-means 6 cụm) rồi mới tách mảng: móng đen chạm nền trắng ở đầu
  //    móng không bị dính chung 1 mảng với nền (lỗi bản đầu 24/10)
  const ns: number[] = [];
  for (let i = 0; i < N; i++) if (!sk[i]) ns.push(i);
  const col = (i: number) => [s.L[i], s.A[i], s.B[i]];
  const K = Math.min(6, Math.max(1, ns.length));
  const centers: number[][] = [];
  if (ns.length) {
    centers.push(col(ns[Math.floor(ns.length / 2)]));
    const step = Math.max(1, Math.floor(ns.length / 4000));
    while (centers.length < K) {
      let far = -1, fd = -1;
      for (let q = 0; q < ns.length; q += step) { const c = col(ns[q]); const d = Math.min(...centers.map((m) => dEw(c, m))); if (d > fd) { fd = d; far = ns[q]; } }
      if (fd < 6) break;
      centers.push(col(far));
    }
    for (let it = 0; it < 8; it++) {
      const sum = centers.map(() => [0, 0, 0, 0]);
      for (let q = 0; q < ns.length; q += step) {
        const c = col(ns[q]); let bi = 0, bd = Infinity;
        centers.forEach((m, j) => { const d = dEw(c, m); if (d < bd) { bd = d; bi = j; } });
        const t = sum[bi]; t[0] += c[0]; t[1] += c[1]; t[2] += c[2]; t[3]++;
      }
      sum.forEach((t, j) => { if (t[3]) centers[j] = [t[0] / t[3], t[1] / t[3], t[2] / t[3]]; });
    }
  }
  const cl = new Int8Array(N).fill(-1);
  for (const i of ns) { const c = col(i); let bi = 0, bd = Infinity; centers.forEach((m, j) => { const d = dEw(c, m); if (d < bd) { bd = d; bi = j; } }); cl[i] = bi; }
  // lọc nhiễu nhãn: mỗi điểm theo nhãn đông nhất 3×3
  const cl2 = new Int8Array(cl);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (cl[i] < 0) continue;
    const cnt = new Map<number, number>();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = cl[(y + dy) * w + x + dx]; if (v >= 0) cnt.set(v, (cnt.get(v) ?? 0) + 1); }
    let bv = cl[i], bc = 0; for (const [v, c2] of cnt) if (c2 > bc) { bc = c2; bv = v; }
    cl2[i] = bv;
  }
  const lab2 = new Int32Array(N).fill(-1);
  const comps: { pix: number[]; touchesBorder: boolean }[] = [];
  for (let i0 = 0; i0 < N; i0++) {
    if (sk[i0] || lab2[i0] >= 0) continue;
    const id = comps.length, pix: number[] = [], st = [i0], me = cl2[i0];
    lab2[i0] = id;
    let border = false;
    while (st.length) {
      const i = st.pop()!; pix.push(i);
      const x = i % w, y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X; if (!sk[j] && lab2[j] < 0 && cl2[j] === me) { lab2[j] = id; st.push(j); }
      }
    }
    comps.push({ pix, touchesBorder: border });
  }
  // 3) "BỊ NGÓN TAY ÔM": từ mỗi điểm nhìn ra 8 hướng, ≥ 5 hướng gặp da trong tầm 1 cái móng → điểm nằm trong
  //    lòng ngón (móng). Nền / vải chỉ gặp da ở 1–3 hướng. Các mảng màu liền nhau cùng "bị ôm" (thân móng, mép
  //    tối, vệt bóng, đá đính của cùng 1 móng) gộp lại thành 1 móng.
  const R = Math.max(8, Math.round(0.2 * Math.min(w, h)));
  const encl = new Uint8Array(N);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let i = 0; i < N; i++) {
    if (sk[i]) continue;
    const x = i % w, y = (i - x) / w;
    let n = 0;
    for (const [dx, dy] of DIRS) for (let d = 2; d <= R; d += 2) { const X = x + dx * d, Y = y + dy * d; if (X < 0 || Y < 0 || X >= w || Y >= h) break; if (sk[Y * w + X]) { n++; break; } }
    encl[i] = n;
  }
  const enclosed = comps.map((c) => c.pix.length >= 3 && c.pix.filter((i) => encl[i] >= 5).length >= 0.55 * c.pix.length);
  const parent = comps.map((_, i) => i);
  const root = (a: number): number => (parent[a] === a ? a : (parent[a] = root(parent[a])));
  for (let i = 0; i < N; i++) {
    const a = lab2[i]; if (a < 0 || !enclosed[a]) continue;
    const x = i % w;
    for (const j of [x + 1 < w ? i + 1 : -1, i + w < N ? i + w : -1]) { const b = j >= 0 ? lab2[j] : -1; if (b >= 0 && b !== a && enclosed[b]) parent[root(a)] = root(b); }
  }
  const groupsMap = new Map<number, { pix: number[]; touchesBorder: boolean }>();
  comps.forEach((c, i) => { if (!enclosed[i]) return; const r = root(i); const g = groupsMap.get(r) ?? { pix: [], touchesBorder: false }; g.pix.push(...c.pix); g.touchesBorder ||= c.touchesBorder; groupsMap.set(r, g); });
  const groups = [...groupsMap.values()];
  const gid = new Int32Array(N).fill(-1);
  groups.forEach((g, id) => { for (const i of g.pix) gid[i] = id; });
  // TÁCH móng dính nhau (2–3 móng sát nhau nối qua khe tối giữa các ngón): bào mòn dần đến khi vỡ thành ≥ 2
  // lõi, rồi chia lại từng điểm cho lõi gần nhất (loang trong vùng cũ)
  const splitGroup = (pix: number[]): number[][] => {
    const inG = new Uint8Array(N); for (const i of pix) inG[i] = 1;
    let cur = inG, bestCores: number[][] = [];
    for (let e = 1; e <= 14; e++) {
      const nx = new Uint8Array(N);
      for (const i of pix) { if (!cur[i]) continue; const x = i % w; if (x > 0 && x < w - 1 && i >= w && i < N - w && cur[i - 1] && cur[i + 1] && cur[i - w] && cur[i + w]) nx[i] = 1; }
      cur = nx;
      const seen = new Int32Array(N).fill(-1), cores: number[][] = [];
      for (const i0 of pix) {
        if (!cur[i0] || seen[i0] >= 0) continue;
        const st = [i0], part: number[] = []; seen[i0] = cores.length;
        while (st.length) { const i = st.pop()!; part.push(i); for (const j of [i - 1, i + 1, i - w, i + w]) if (j >= 0 && j < N && cur[j] && seen[j] < 0) { seen[j] = cores.length; st.push(j); } }
        cores.push(part);
      }
      // giữ mức bào cho NHIỀU lõi nhất (3 móng dính nhau vỡ thành 2 rồi 3 lõi)
      const big = cores.filter((c) => c.length >= Math.max(3, 0.04 * pix.length));
      if (big.length > bestCores.length) bestCores = big;
      if (!cores.length) break;
    }
    if (bestCores.length < 2) return [pix];
    const own = new Int32Array(N).fill(-1); const q: number[] = [];
    bestCores.forEach((c, k) => { for (const i of c) { own[i] = k; q.push(i); } });
    for (let qi = 0; qi < q.length; qi++) { const i = q[qi]; for (const j of [i - 1, i + 1, i - w, i + w]) if (j >= 0 && j < N && inG[j] && own[j] < 0) { own[j] = own[i]; q.push(j); } }
    const parts: number[][] = bestCores.map(() => []);
    for (const i of pix) if (own[i] >= 0) parts[own[i]].push(i);
    return parts;
  };
  // 4) chấm điểm từng nhóm như thợ nhìn móng (nhóm không ra hình móng → thử tách 1 lần)
  const found: (FoundNail & { cx: number; cy: number; ax: P })[] = [];
  const why = new Map<number, string>();
  const queue = groups.map((g) => ({ ...g, split: false }));
  const trySplit = (id: number, c: (typeof queue)[number], reason: string) => {
    why.set(id, reason);
    if (c.split || c.pix.length < 0.004 * N) return;
    const parts = splitGroup(c.pix);
    if (parts.length < 2) return;
    why.set(id, `${reason} → tách ${parts.length}`);
    for (const p of parts) { const nid = queue.length; for (const i of p) gid[i] = nid; queue.push({ pix: p, touchesBorder: c.touchesBorder, split: true }); }
  };
  for (let id = 0; id < queue.length; id++) {
    const c = queue[id];
    const A = c.pix.length;
    if (A < 0.0015 * N || A > 0.09 * N) { why.set(id, `area ${(A / N).toFixed(4)}`); continue; }
    // da ôm quanh mép (ngay mép hoặc cách ≤ 3px — viền tối / bóng đổ quanh móng chen giữa)
    let edge = 0, edgeSkin = 0;
    for (const i of c.pix) {
      const x = i % w, y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) { edge++; continue; }
        const j = Y * w + X; if (gid[j] === id) continue;
        edge++;
        for (let d = 0; d <= 3; d++) { const X2 = x + dx * (1 + d), Y2 = y + dy * (1 + d); if (X2 < 0 || Y2 < 0 || X2 >= w || Y2 >= h) break; const j2 = Y2 * w + X2; if (sk[j2]) { edgeSkin++; break; } if (gid[j2] === id) break; }
      }
    }
    const fs = edgeSkin / Math.max(1, edge);
    if (fs < 0.3) { why.set(id, `skinEdge ${fs.toFixed(2)}`); continue; }
    // hình: trục chính (PCA), độ thuôn, độ đặc, bề ngang đều
    let mx = 0, my = 0;
    for (const i of c.pix) { mx += i % w; my += Math.floor(i / w); }
    mx /= A; my /= A;
    let sxx = 0, syy = 0, sxy = 0;
    for (const i of c.pix) { const dx = (i % w) - mx, dy = Math.floor(i / w) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const tr = sxx + syy, det = sxx * syy - sxy * sxy, l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l2 = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const elong = Math.sqrt(l1 / Math.max(1e-6, l2));
    if (elong < 1.05 || elong > 4.2) { trySplit(id, c, `elong ${elong.toFixed(2)}`); continue; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
    let sMin = Infinity, sMax = -Infinity;
    const rows = new Map<number, [number, number]>();
    for (const i of c.pix) {
      const dx = (i % w) - mx, dy = Math.floor(i / w) - my;
      const sv = dx * ux + dy * uy, tv = dx * vx + dy * vy;
      sMin = Math.min(sMin, sv); sMax = Math.max(sMax, sv);
      const r = Math.round(sv), e = rows.get(r);
      if (!e) rows.set(r, [tv, tv]); else { e[0] = Math.min(e[0], tv); e[1] = Math.max(e[1], tv); }
    }
    const len = sMax - sMin;
    const widths: number[] = [];
    for (let r = Math.ceil(sMin + 0.2 * len); r <= sMax - 0.2 * len; r++) { const e = rows.get(r); if (e) widths.push(e[1] - e[0] + 1); }
    if (widths.length < 3) { why.set(id, "short"); continue; }
    widths.sort((a, b) => a - b);
    const wMed = widths[widths.length >> 1], even = widths[Math.floor(widths.length * 0.1)] / Math.max(1, widths[Math.floor(widths.length * 0.9)]);
    let filled = 0; for (const e of rows.values()) filled += e[1] - e[0] + 1; // diện tích đã lấp lỗ (đá đính, vệt bóng)
    const rect = filled / Math.max(1, len * wMed);
    if (even < 0.55 || rect < 0.6 || wMed < 4) { trySplit(id, c, `shape even ${even.toFixed(2)} rect ${rect.toFixed(2)} w ${wMed.toFixed(0)}`); continue; }
    // nền / vải lọt vào khe ngón: chạm mép ảnh + ít giáp da → bỏ
    if (c.touchesBorder && fs < 0.6) { why.set(id, `border ${fs.toFixed(2)}`); continue; }
    // 4) gốc hay đầu: đi tiếp ra ngoài 2 đầu theo trục — phía còn DA dài (cả ngón tay) là gốc móng
    const run = (dir: number) => {
      const s0 = dir > 0 ? sMax : sMin;
      let n = 0;
      for (let d = 1; d <= Math.round(1.6 * len); d++) {
        const X = Math.round(mx + ux * (s0 + dir * d)), Y = Math.round(my + uy * (s0 + dir * d));
        if (X < 0 || Y < 0 || X >= w || Y >= h) break;
        if (sk[Y * w + X]) n++; else if (n > 2) break;
      }
      return n;
    };
    const rPlus = run(1), rMinus = run(-1);
    if (Math.max(rPlus, rMinus) < 0.35 * len) { trySplit(id, c, `noFinger ${rPlus}/${rMinus} len ${len.toFixed(0)}`); continue; } // móng phải nối với ngón tay
    why.set(id, `OK fs ${fs.toFixed(2)} even ${even.toFixed(2)} rect ${rect.toFixed(2)}`);
    const baseDir = rPlus > rMinus ? 1 : -1;
    const sBase = baseDir > 0 ? sMax : sMin, sTip = baseDir > 0 ? sMin : sMax;
    const K = s.k;
    const toImg = (sv: number): P => ({ x: (mx + ux * sv + 0.5) * K, y: (my + uy * sv + 0.5) * K });
    const score = fs * 0.5 + Math.min(1, even) * 0.25 + Math.min(1, rect) * 0.25;
    found.push({ mark: { base: toImg(sBase), tip: toImg(sTip) }, score, area: A * K * K, cx: mx, cy: my, ax: { x: ux, y: uy } });
  }
  debug?.({ w, h, k: s.k, skin, sk, lab2: gid, why, encl });
  // 5 móng tốt nhất, xếp theo vị trí ngang (vuông góc với hướng móng trung bình)
  found.sort((a, b) => b.score - a.score);
  const top = found.slice(0, 5);
  const ax = top.reduce((a, f) => ({ x: a.x + f.ax.x * Math.sign(f.ax.x * top[0].ax.x + f.ax.y * top[0].ax.y || 1), y: a.y + f.ax.y * Math.sign(f.ax.x * top[0].ax.x + f.ax.y * top[0].ax.y || 1) }), { x: 0, y: 0 });
  const across = { x: -ax.y, y: ax.x };
  top.sort((a, b) => (a.cx * across.x + a.cy * across.y) - (b.cx * across.x + b.cy * across.y));
  if (across.x < 0) top.reverse();
  return top.map(({ mark, score, area }) => ({ mark, score, area }));
}

/**
 * 1 CHẠM giữa móng → các cặp điểm gốc → đầu (chiều thuận / ngược, trục chính / phụ) để bộ khớp khuôn thử lần lượt
 * và giữ khuôn tốt nhất. Bắn 16 TIA từ chỗ chạm: mỗi tia đi tới khi gặp mép móng (màu đổi hẳn so với đoạn vừa đi —
 * móng ombre đổi màu dần vẫn đi tiếp) hoặc gặp da; vệt bóng / đá nhỏ trên móng thì đi xuyên. Cặp tia đối nhau dài
 * nhất = trục móng. Đầu nào còn da dài phía sau (ngón tay) là gốc móng; móng gần tròn → theo hướng các móng đã nhận.
 */
export function marksFromTap(img: Img, p: P, hint?: P | null): Mark[] {
  const s = smallLab(img, 360);
  const skin = skinModel(s);
  const labAt = (x: number, y: number): number[] | null => {
    const X = Math.round(x), Y = Math.round(y);
    if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) return null;
    const i = (Y * img.w + X) * 4;
    return lab(img.data[i], img.data[i + 1], img.data[i + 2]);
  };
  // màu móng tại chỗ chạm: trung vị 9×9, bỏ điểm quá sáng nhạt màu (vệt bóng, đá)
  const near: number[][] = [];
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const c = labAt(p.x + dx * 2, p.y + dy * 2); if (c) near.push(c); }
  if (!near.length) return [];
  const medL = [...near.map((c) => c[0])].sort((a, b) => a - b)[near.length >> 1];
  const body = near.filter((c) => !(c[0] > medL + 12 && Math.hypot(c[1], c[2]) < 12));
  const seed = [0, 1, 2].map((ch) => { const v = (body.length ? body : near).map((c) => c[ch]).sort((a, b) => a - b); return v[v.length >> 1]; });
  const maxR = 0.35 * Math.min(img.w, img.h);
  const isSpec = (c: number[]) => c[0] > seed[0] + 12 && Math.hypot(c[1], c[2]) < Math.hypot(seed[1], seed[2]) + 6;
  // điểm "giống móng": chiếu màu lên đoạn [màu da → màu móng chỗ chạm] (như bộ khớp khuôn) ≥ 0.45 và không phải
  // màu thứ 3 (nền / vải) cách xa đoạn đó; chưa biết màu da → so với màu chỗ chạm
  const sk = skin;
  const nx = sk ? 0.45 * (seed[0] - sk[0]) : 0, na = sk ? seed[1] - sk[1] : 0, nb = sk ? seed[2] - sk[2] : 0;
  const nn = nx * nx + na * na + nb * nb || 1, segLen = Math.sqrt(nn);
  // màu NỀN (khăn, vải, áo): trung vị viền ảnh — điểm gần màu nền hơn màu móng thì không phải móng
  const border: number[][] = [];
  for (let x = 0; x < s.w; x += 2) for (const y of [0, 1, s.h - 2, s.h - 1]) border.push([s.L[y * s.w + x], s.A[y * s.w + x], s.B[y * s.w + x]]);
  for (let y = 0; y < s.h; y += 2) for (const x of [0, 1, s.w - 2, s.w - 1]) border.push([s.L[y * s.w + x], s.A[y * s.w + x], s.B[y * s.w + x]]);
  const bg = [0, 1, 2].map((ch) => { const v = border.map((c) => c[ch]).sort((a, b) => a - b); return v[v.length >> 1]; });
  const useBg = dEw(bg, seed) > 8 && (!skin || dEw(bg, skin) > 8);
  const nailish = (c: number[]) => {
    if (useBg && dEw(c, bg) < dEw(c, seed) - 2) return false;
    if (isSpec(c)) return true;
    if (!sk || segLen < 8) return dEw(c, seed) < 14;
    const dx = 0.45 * (c[0] - sk[0]), da = c[1] - sk[1], db = c[2] - sk[2];
    const pr = (dx * nx + da * na + db * nb) / nn, q = Math.min(1.3, Math.max(0, pr));
    return pr >= 0.45 && Math.hypot(dx - q * nx, da - q * na, db - q * nb) < 0.75 * segLen + 8;
  };
  const ray = (dx: number, dy: number) => {
    let last = 0, miss = 0;
    for (let r = 1; r <= maxR; r++) {
      const c = labAt(p.x + dx * r, p.y + dy * r);
      if (!c) break;
      if (!nailish(c)) { if (++miss >= 3) break; continue; }
      miss = 0; last = r;
    }
    return last;
  };
  const DIR = 16, rays = Array.from({ length: DIR }, (_, k) => { const a = (k / DIR) * 2 * Math.PI; return { a, r: ray(Math.cos(a), Math.sin(a)) }; });
  const pairs = Array.from({ length: DIR / 2 }, (_, k) => ({ k, len: rays[k].r + rays[k + DIR / 2].r }));
  pairs.sort((a, b) => b.len - a.len);
  const cand: number[] = [pairs[0].k];
  if (pairs[1] && pairs[1].len > 0.85 * pairs[0].len) cand.push(pairs[1].k);
  const perpLen = (k: number) => rays[(k + DIR / 4) % DIR].r + rays[(k + (3 * DIR) / 4) % DIR].r;
  if (hint && pairs[0].len < 1.15 * perpLen(pairs[0].k)) {
    // móng gần vuông / tròn: trục theo hướng các móng đã nhận
    const ka = Math.round((((Math.atan2(hint.y, hint.x) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * DIR) % (DIR / 2);
    cand.unshift(ka);
  }
  const marks: Mark[] = [];
  for (const k of [...new Set(cand)]) {
    const a = rays[k], b = rays[k + DIR / 2];
    const ux = Math.cos(a.a), uy = Math.sin(a.a);
    const P1 = { x: p.x + ux * a.r, y: p.y + uy * a.r }, P2 = { x: p.x - ux * b.r, y: p.y - uy * b.r };
    if (Math.hypot(P1.x - P2.x, P1.y - P2.y) < 10) continue;
    // gốc móng: phía còn da (ngón tay) dài hơn
    const skinRun = (from: P, dx: number, dy: number) => {
      if (!skin) return 0;
      let n = 0;
      for (let r = 3; r <= maxR * 0.6; r += 2) { const c = labAt(from.x + dx * r, from.y + dy * r); if (!c) break; if (dEw(c, skin) < 15) n++; else if (n > 3) break; }
      return n;
    };
    const r1 = skinRun(P1, ux, uy), r2 = skinRun(P2, -ux, -uy);
    let base1 = r1 >= r2;
    if (hint && Math.abs(r1 - r2) < 4) base1 = ux * hint.x + uy * hint.y < 0; // hint = hướng gốc → đầu
    const [B, T] = base1 ? [P1, P2] : [P2, P1];
    marks.push({ base: B, tip: T }, { base: T, tip: B });
  }
  return marks;
}
