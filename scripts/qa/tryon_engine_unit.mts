// Kiểm thử BỘ MÁY THỬ MẪU ẢNH THẬT (lib/tryon) bằng số đo trên 5 ảnh tay có ĐÁP ÁN viền móng vẽ tay
// (scripts/qa/tryon_fixtures.ts): phủ kín móng, không lem ra da, mép trơn + khử răng cưa, chạm lệch vẫn đúng,
// móng gần màu da → khuôn dự phòng, đắp dài, ngoài móng không đổi 1 điểm ảnh, đúng màu, giữ ánh sáng thật,
// xoá đá đính / chỉ bạc cũ, hiệu ứng nhám / chrome / nhũ / mắt mèo, độ trong, hoạ tiết, phiên Worker, tốc độ.
//   npx tsx scripts/qa/tryon_engine_unit.mts
import path from "node:path";
import { createRequire } from "node:module";
import { segmentNail, renderLook, lab, type Img, type LookColors, type NailSeg } from "../../lib/tryon/engine";
import { TryOnSession } from "../../lib/tryon/session";
import { FIXTURES, inPoly, polyDist } from "./tryon_fixtures";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + detail}`);
};
const load = async (file: string): Promise<Img> => {
  const { data, info } = await sharp(path.resolve("scripts/qa/fixtures", file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
};
const mark = (m: [[number, number], [number, number]], d = [0, 0, 0, 0]) => ({ base: { x: m[0][0] + d[0], y: m[0][1] + d[1] }, tip: { x: m[1][0] + d[2], y: m[1][1] + d[3] } });
const A = (seg: NailSeg, x: number, y: number) => { const lx = x - seg.x0, ly = y - seg.y0; return lx >= 0 && ly >= 0 && lx < seg.w && ly < seg.h ? seg.alpha[ly * seg.w + lx] : 0; };
const lumaAt = (im: Img, x: number, y: number) => { const i = (y * im.w + x) * 4; return 0.2126 * im.data[i] + 0.7152 * im.data[i + 1] + 0.0722 * im.data[i + 2]; };
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0; };
const r2 = (x: number) => Math.round(x * 100) / 100;
/** điểm "lõi" của móng: chắc trong mặt nạ, xa mép, giữa chiều dài */
function core(seg: NailSeg, fn: (x: number, y: number) => void) {
  for (let yy = 0; yy < seg.h; yy++) for (let xx = 0; xx < seg.w; xx++) {
    const k = yy * seg.w + xx;
    if (seg.alpha[k] < 1 || !seg.natural[k] || Math.abs(seg.across[k]) > 0.55 || seg.along[k] < 0.2 || seg.along[k] > 0.8) continue;
    fn(seg.x0 + xx, seg.y0 + yy);
  }
}

const imgs: Record<string, Img> = {};
const segsOf: Record<string, NailSeg[]> = {};
let tSeg = 0, nSeg = 0;
for (const fx of FIXTURES) {
  imgs[fx.file] = await load(fx.file);
  const t = performance.now();
  segsOf[fx.file] = fx.marks.map((m) => segmentNail(imgs[fx.file], mark(m)));
  tSeg += performance.now() - t; nSeg += fx.marks.length;
}

// ---------------- 1. tách móng so với đáp án
const covs: number[] = [], spills: number[] = [], bad: string[] = [];
for (const fx of FIXTURES) fx.marks.forEach((_, n) => {
  const seg = segsOf[fx.file][n], poly = fx.outlines[n], img = imgs[fx.file];
  let gt = 0, cov = 0, spill = 0;
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const X0 = Math.min(seg.x0, ...xs) - 6, X1 = Math.max(seg.x0 + seg.w, ...xs) + 6, Y0 = Math.min(seg.y0, ...ys) - 6, Y1 = Math.max(seg.y0 + seg.h, ...ys) + 6;
  for (let y = Math.max(0, Y0); y < Math.min(img.h, Y1); y++) for (let x = Math.max(0, X0); x < Math.min(img.w, X1); x++) {
    const g = inPoly(x, y, poly), d = polyDist(x, y, poly), a = A(seg, x, y);
    if (g && d > 3) { gt++; if (a >= 0.5) cov++; } else if (!g && d > 4 && a >= 0.5) spill++;
  }
  covs.push(cov / gt); spills.push(spill / gt);
  if (cov / gt < 0.85 || spill / gt > 0.05) bad.push(`${fx.file}#${n + 1} phủ ${r2(cov / gt)} lem ${r2(spill / gt)}`);
});
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
ok("E1", `Tách 20 móng / 5 ảnh (đen nhám, hồng bóng có đá, xanh rêu dài, ombre tròn, trắng có chỉ bạc): mỗi móng phủ ≥ 85% & lem ≤ 5%; trung bình phủ ≥ 94%, lem ≤ 1.5%  [phủ TB ${r2(avg(covs) * 100)}% · lem TB ${r2(avg(spills) * 100)}%]`,
  !bad.length && avg(covs) >= 0.94 && avg(spills) <= 0.015, bad.join(" | "));
const all = FIXTURES.flatMap((fx) => segsOf[fx.file]);
ok("E2", "Cả 20 móng nhận theo MÀU (không rơi về khuôn dự phòng); trong khuôn ≥ 75% điểm móng, chênh với ngay ngoài mép ≥ 0.4",
  all.every((s) => s.byColor && s.quality.inside >= 0.75 && s.quality.inside - s.quality.ring >= 0.4), JSON.stringify(all.map((s) => [r2(s.quality.inside), r2(s.quality.ring)])));

// ---------------- 2. mép trơn: 1 mảng liền, không lỗ, không răng cưa / cờ lem; mép khử răng cưa
const shapeIssues: string[] = [];
let soft = 0, edgeN = 0;
for (const fx of FIXTURES) segsOf[fx.file].forEach((seg, n) => {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < seg.w && y < seg.h && seg.alpha[y * seg.w + x] >= 0.5;
  let per = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, area = 0;
  for (let y = 0; y < seg.h; y++) for (let x = 0; x < seg.w; x++) {
    if (!on(x, y)) continue;
    area++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!on(x + dx, y + dy)) {
      per++;
      const a = seg.alpha[y * seg.w + x], b = x + dx >= 0 && y + dy >= 0 && x + dx < seg.w && y + dy < seg.h ? seg.alpha[(y + dy) * seg.w + x + dx] : 0;
      edgeN++; if ((a > 0 && a < 1) || (b > 0 && b < 1)) soft++;
    }
  }
  // hình lồi theo hàng/cột: chu vi "bậc thang" = 2·(rộng + cao) khung bao; răng cưa, khía, cờ lem làm vượt
  const ratio = per / (2 * (maxX - minX + 1 + maxY - minY + 1));
  // 1 mảng liền + không lỗ: loang từ 1 điểm phủ hết; loang nền từ mép khung phủ hết phần ngoài
  const seen = new Uint8Array(seg.w * seg.h); let k0 = -1;
  for (let k = 0; k < seen.length && k0 < 0; k++) if (seg.alpha[k] >= 0.5) k0 = k;
  let reach = 0; const st = [k0]; seen[k0] = 1;
  while (st.length) { const k = st.pop()!; reach++; const x = k % seg.w, y = (k - x) / seg.w; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (on(X, Y) && !seen[Y * seg.w + X]) { seen[Y * seg.w + X] = 1; st.push(Y * seg.w + X); } } }
  const out = new Uint8Array(seg.w * seg.h); const st2: number[] = [];
  for (let x = 0; x < seg.w; x++) for (const y of [0, seg.h - 1]) if (!on(x, y)) { out[y * seg.w + x] = 1; st2.push(y * seg.w + x); }
  for (let y = 0; y < seg.h; y++) for (const x of [0, seg.w - 1]) if (!on(x, y) && !out[y * seg.w + x]) { out[y * seg.w + x] = 1; st2.push(y * seg.w + x); }
  let outside = 0;
  while (st2.length) { const k = st2.pop()!; outside++; const x = k % seg.w, y = (k - x) / seg.w; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < seg.w && Y < seg.h && !on(X, Y) && !out[Y * seg.w + X]) { out[Y * seg.w + X] = 1; st2.push(Y * seg.w + X); } } }
  const holes = seg.w * seg.h - area - outside;
  if (ratio > 1.06 || reach !== area || holes > 0) shapeIssues.push(`${fx.file}#${n + 1} chu vi×${r2(ratio)} mảng ${reach}/${area} lỗ ${holes}`);
});
ok("E3", "Mặt nạ mỗi móng: 1 mảng liền, không lỗ, viền trơn (chu vi bậc thang ≤ 1.06× hình lồi — không răng cưa / khía / cờ lem)", !shapeIssues.length, shapeIssues.join(" | "));
ok("E4", `Mép móng khử răng cưa: ≥ 60% điểm mép có độ phủ trung gian  [${r2((100 * soft) / edgeN)}%]`, soft / edgeN >= 0.6);

// ---------------- 3. chạm lệch tay vẫn ra đúng móng
const jit: string[] = [];
for (const file of ["hand.jpg", "olive.jpg", "pink.jpg"]) {
  const fx = FIXTURES.find((f) => f.file === file)!;
  for (const [n, m] of fx.marks.entries()) for (const d of [[6, 0, -6, 0], [-5, 4, 5, -4], [0, -6, 0, 6], [4, 4, -4, 5]]) {
    const a = segsOf[file][n], b = segmentNail(imgs[file], mark(m, d));
    let i = 0, u = 0;
    const X0 = Math.min(a.x0, b.x0), Y0 = Math.min(a.y0, b.y0), X1 = Math.max(a.x0 + a.w, b.x0 + b.w), Y1 = Math.max(a.y0 + a.h, b.y0 + b.h);
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) { const p = A(a, x, y) >= 0.5, q = A(b, x, y) >= 0.5; if (p && q) i++; if (p || q) u++; }
    if (i / u < 0.9) jit.push(`${file}#${n + 1} lệch ${d} IoU ${r2(i / u)}`);
  }
}
ok("E5", "Chạm lệch 4–6px ở gốc / đầu (48 lần thử, 3 ảnh): mặt nạ trùng ≥ 90% với lần chạm chuẩn", !jit.length, jit.join(" | "));

// ---------------- 4. móng gần màu da → khuôn dự phòng theo 2 điểm chạm
{
  const w = 300, h = 300, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, inNail = ((x - 150) / 34) ** 2 + ((y - 150) / 50) ** 2 < 1;
    data[i] = inNail ? 226 : 224; data[i + 1] = inNail ? 182 : 180; data[i + 2] = inNail ? 166 : 160; data[i + 3] = 255;
  }
  const im = { w, h, data };
  const seg = segmentNail(im, { base: { x: 150, y: 198 }, tip: { x: 150, y: 102 } }, { widthRatio: 0.7 });
  let area = 0, cx = 0, cy = 0;
  for (let k = 0; k < seg.alpha.length; k++) if (seg.alpha[k] >= 0.5) { area++; cx += seg.x0 + (k % seg.w); cy += seg.y0 + Math.floor(k / seg.w); }
  cx /= area; cy /= area;
  ok("E6", "Móng trơn gần màu da (ảnh tổng hợp): không đoán bừa theo màu — dùng khuôn theo 2 điểm chạm, tâm khuôn đúng giữa 2 điểm, bề ngang ≈ 0.7×dài",
    !seg.byColor && Math.abs(cx - 150) < 3 && Math.abs(cy - 150) < 8 && Math.abs(seg.hw * 2 - 0.7 * 96) < 6, JSON.stringify({ byColor: seg.byColor, cx: r2(cx), cy: r2(cy), w: r2(seg.hw * 2) }));
}

// ---------------- 5. đắp dài
{
  const im = imgs["olive.jpg"], m = mark(FIXTURES[2].marks[1]);
  const nat = segmentNail(im, m), ext = segmentNail(im, m, { lengthFactor: 1.5, shape: "almond" });
  const area = (s: NailSeg) => s.alpha.reduce((a, v) => a + v, 0);
  let natInExt = 0, natTot = 0;
  for (let k = 0; k < nat.alpha.length; k++) if (nat.alpha[k] >= 0.99) { natTot++; const x = nat.x0 + (k % nat.w), y = nat.y0 + Math.floor(k / nat.w); if (A(ext, x, y) >= 0.99) natInExt++; }
  const ratio = area(ext) / area(nat);
  let maxAlong = 0; for (let k = 0; k < ext.alpha.length; k++) if (ext.alpha[k] >= 0.5) maxAlong = Math.max(maxAlong, ext.along[k]);
  ok("E7", `Đắp dài ×1.5 dáng hạnh nhân: giữ nguyên móng thật (${r2((100 * natInExt) / natTot)}%), thêm phần đắp tới ~1.5 chiều dài (${r2(maxAlong)}), diện tích ×${r2(ratio)}`,
    natInExt / natTot > 0.995 && maxAlong > 1.4 && maxAlong < 1.6 && ratio > 1.15 && ratio < 1.7);
}

// ---------------- 6. vẽ mẫu
const LOOK = (colors: string[], finish: LookColors["finish"], extra: Partial<LookColors> = {}): LookColors => ({ colors, finish, pattern: "solid", seed: 7, ...extra });
{
  const im = imgs["hand.jpg"], segs = segsOf["hand.jpg"];
  const out = renderLook(im, segs, LOOK(["#e7b7b4"], "glossy"));
  let changedOutside = 0;
  const inAny = (x: number, y: number) => segs.some((s) => A(s, x, y) > 0);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    if (inAny(x, y)) continue;
    const i = (y * im.w + x) * 4;
    if (out.data[i] !== im.data[i] || out.data[i + 1] !== im.data[i + 1] || out.data[i + 2] !== im.data[i + 2]) changedOutside++;
  }
  const crop = { x: 200, y: 260, w: 500, h: 220 };
  const cropped = renderLook(im, segs, LOOK(["#e7b7b4"], "glossy"), null, crop);
  let same = cropped.w === 500 && cropped.h === 220;
  for (let y = 0; y < crop.h && same; y++) for (let x = 0; x < crop.w; x++) { const a = ((crop.y + y) * im.w + crop.x + x) * 4, b = (y * crop.w + x) * 4; if (out.data[a] !== cropped.data[b] || out.data[a + 2] !== cropped.data[b + 2]) { same = false; break; } }
  const again = renderLook(im, segs, LOOK(["#e7b7b4"], "glossy"));
  ok("E8", "Ngoài móng KHÔNG đổi 1 điểm ảnh nào; vẽ trong khung cắt = cắt từ ảnh vẽ đầy đủ; vẽ 2 lần ra y hệt", changedOutside === 0 && same && Buffer.compare(Buffer.from(out.data), Buffer.from(again.data)) === 0, JSON.stringify({ changedOutside, same }));
}

// đúng màu: trung vị Lab lõi móng so với màu đặt (ΔE76)
const colorFails: string[] = [];
const dE: number[] = [];
for (const fx of FIXTURES) for (const [hex, fin] of [["#141416", "glossy"], ["#e7b7b4", "glossy"], ["#6e1426", "glossy"], ["#f4efe6", "glossy"], ["#56633a", "matte"]] as const) {
  const out = renderLook(imgs[fx.file], segsOf[fx.file], LOOK([hex], fin));
  const Ls: number[] = [], as: number[] = [], bs: number[] = [];
  for (const seg of segsOf[fx.file]) core(seg, (x, y) => { const i = (y * out.w + x) * 4; const c = lab(out.data[i], out.data[i + 1], out.data[i + 2]); Ls.push(c[0]); as.push(c[1]); bs.push(c[2]); });
  const t = lab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  const d = Math.hypot(med(Ls) - t[0], med(as) - t[1], med(bs) - t[2]);
  dE.push(d);
  if (d > 10) colorFails.push(`${fx.file} ${hex} ΔE ${r2(d)}`);
}
ok("E9", `Đúng màu sơn: trung vị lõi móng lệch màu đặt ΔE ≤ 10 (25 lần: 5 ảnh × đen / nude / đỏ rượu / trắng sữa / xanh rêu nhám)  [ΔE TB ${r2(avg(dE))}]`, !colorFails.length, colorFails.join(" | "));

// giữ ánh sáng thật: móng hồng #1 có nửa trái khuất sáng → ảnh vẽ nude cũng tối bên trái, sáng bên phải
{
  const im = imgs["pink.jpg"], seg = segsOf["pink.jpg"][0];
  const out = renderLook(im, [seg], LOOK(["#e7b7b4"], "matte"));
  const xs: number[] = [], ys: number[] = [];
  for (let yy = 0; yy < seg.h; yy++) for (let xx = 0; xx < seg.w; xx++) {
    const k = yy * seg.w + xx; if (seg.alpha[k] < 1 || seg.along[k] < 0.2 || seg.along[k] > 0.8) continue;
    xs.push(seg.across[k]); ys.push(lumaAt(out, seg.x0 + xx, seg.y0 + yy));
  }
  const left = med(ys.filter((_, i) => xs[i] < -0.45)), right = med(ys.filter((_, i) => xs[i] > 0.1 && xs[i] < 0.5));
  ok("E10", `Giữ ánh sáng thật của ảnh: móng hồng khuất sáng bên trái → sơn nude mới cũng tối bên trái (${r2(left)}) hơn giữa-phải (${r2(right)}) ≥ 12`, right - left >= 12);
}

// xoá hoạ tiết cũ: đá đính (hồng #2 #3), chỉ bạc (trắng) không còn lốm đốm trên màu mới
{
  const speck = (im: Img, segs: NailSeg[]) => {
    let n = 0, hit = 0;
    for (const seg of segs) core(seg, (x, y) => {
      const v: number[] = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) v.push(lumaAt(im, x + dx, y + dy));
      n++; if (Math.abs(lumaAt(im, x, y) - med(v)) > 30) hit++;
    });
    return hit / n;
  };
  const res: string[] = [];
  let okAll = true;
  for (const [file, idx] of [["pink.jpg", [1, 2, 3]], ["white.jpg", [0, 1, 2, 3]]] as const) {
    const segs = idx.map((i) => segsOf[file][i]);
    const before = speck(imgs[file], segs), after = speck(renderLook(imgs[file], segs, LOOK(["#6e1426"], "glossy")), segs);
    res.push(`${file}: ${r2(before * 100)}% → ${r2(after * 100)}%`);
    if (!(after < 0.004 && before > 3 * after)) okAll = false;
  }
  ok("E11", `Đá đính / chỉ bạc / hoạ tiết của móng cũ không lộ qua màu mới (điểm lốm đốm < 0.4%)  [${res.join(" · ")}]`, okAll);
}

// hiệu ứng
{
  const im = imgs["hand.jpg"], segs = segsOf["hand.jpg"];
  const stats = (look: LookColors) => {
    const out = renderLook(im, segs, look), v: number[] = [];
    for (const seg of segs) core(seg, (x, y) => v.push(lumaAt(out, x, y)));
    v.sort((a, b) => a - b);
    const m = v[v.length >> 1], mean = avg(v), sd = Math.sqrt(avg(v.map((x) => (x - mean) ** 2)));
    return { m, p99: v[Math.floor(v.length * 0.99)], sd, bright: v.filter((x) => x > m + 40).length / v.length };
  };
  const glossy = stats(LOOK(["#141416"], "glossy")), matte = stats(LOOK(["#141416"], "matte"));
  const grey = stats(LOOK(["#b8bcc4"], "glossy")), chrome = stats(LOOK(["#b8bcc4"], "chrome"));
  const glitter = stats(LOOK(["#c9a86a"], "glitter")), cat = stats(LOOK(["#2a1240", "#c4a1ff"], "cateye"));
  ok("E12", "Hiệu ứng: bóng có vệt sáng (nhám thì không); chrome tương phản kim loại (độ lệch sáng ≥ 2× sơn thường); nhũ có hạt sáng (≥ 1.5%); mắt mèo có dải sáng (≥ 4%)",
    glossy.p99 - matte.p99 >= 30 && chrome.sd >= 2 * grey.sd && glitter.bright >= 0.015 && cat.bright >= 0.04,
    JSON.stringify({ glossyP99: r2(glossy.p99), matteP99: r2(matte.p99), chromeSd: r2(chrome.sd), greySd: r2(grey.sd), glitter: r2(glitter.bright), cat: r2(cat.bright) }));
}

// độ trong (thạch / negative space) + mix màu + hoạ tiết
{
  const im = imgs["olive.jpg"], segs = segsOf["olive.jpg"];
  const solid = renderLook(im, segs, LOOK(["#e7b7b4"], "glossy")), jelly = renderLook(im, segs, LOOK(["#e7b7b4"], "glossy", { opacity: 0.6 }));
  let err = 0, n = 0;
  for (const seg of segs) core(seg, (x, y) => { const i = (y * im.w + x) * 4; err += Math.abs(jelly.data[i + 1] - (0.4 * im.data[i + 1] + 0.6 * solid.data[i + 1])); n++; });
  const mix = renderLook(im, segs, LOOK(["#141416", "#e7b7b4"], "glossy", { pattern: "mixmatch" }));
  const medL = (s: NailSeg) => { const v: number[] = []; core(s, (x, y) => v.push(lumaAt(mix, x, y))); return med(v); };
  // hoạ tiết: ô đỏ ở giữa móng 1 + ô đỏ ngoài móng → chỉ phần trên móng hiện
  const motif = { w: im.w, h: im.h, data: new Uint8ClampedArray(im.w * im.h * 4) };
  const paint = (x0: number, y0: number) => { for (let y = y0; y < y0 + 16; y++) for (let x = x0; x < x0 + 16; x++) { const i = (y * im.w + x) * 4; motif.data[i] = 220; motif.data[i + 3] = 255; } };
  paint(214, 392); paint(40, 40);
  const withMotif = renderLook(im, segs, LOOK(["#f4efe6"], "glossy"), motif);
  const ci = (400 * im.w + 222) * 4, oi = (48 * im.w + 48) * 4;
  ok("E13", "Độ trong 60% = trộn đúng 60% màu mới + 40% móng thật; mix màu: ngón 3–4 đổi màu phụ; hoạ tiết hiện trên móng (đỏ), ngoài móng bị bỏ",
    err / n < 2.5 && medL(segs[0]) < 60 && medL(segs[2]) > 150 && withMotif.data[ci] > withMotif.data[ci + 1] + 60 && withMotif.data[oi] === im.data[oi],
    JSON.stringify({ jellyErr: r2(err / n), n1: medL(segs[0]), n3: medL(segs[2]), motif: [withMotif.data[ci], withMotif.data[ci + 1]] }));
}

// mép móng không còn viền tối của sơn cũ: móng ĐEN → sơn trắng sữa, điểm mép (độ phủ trung gian) không tối hơn da
{
  const im = imgs["hand.jpg"], segs = segsOf["hand.jpg"];
  const out = renderLook(im, segs, LOOK(["#f4efe6"], "glossy"));
  let n = 0, dark = 0;
  for (const seg of segs) for (let k = 0; k < seg.alpha.length; k++) {
    const a = seg.alpha[k]; if (a <= 0.15 || a >= 0.85) continue;
    const x = seg.x0 + (k % seg.w), y = seg.y0 + Math.floor(k / seg.w);
    n++; if (lumaAt(out, x, y) < 120) dark++;
  }
  ok("E16", `Mép móng sạch: đổi móng đen sang trắng sữa, điểm mép tối (< 120) chỉ ${r2((100 * dark) / n)}% (≤ 3.5%; không xử lý mép: 5.2%) — phần pha ở mép lấy màu da ngoài mép, không lấy sơn cũ`, dark / n <= 0.035);
}

// ---------------- 7. phiên (Worker) + đường viền
{
  const im = imgs["hand.jpg"], s = new TryOnSession();
  s.handle({ kind: "image", img: { w: im.w, h: im.h, buffer: im.data.slice().buffer } });
  const infos = FIXTURES[0].marks.map((m, i) => s.handle({ kind: "nail", index: i, mark: mark(m) }).reply);
  const styled = s.handle({ kind: "style", lengthFactor: 1.4, shape: "almond" }).reply;
  const crop = { x: 200, y: 200, w: 500, h: 300 };
  const r1 = s.handle({ kind: "render", look: LOOK(["#141416"], "glossy"), motif: null, crop }).reply;
  s.handle({ kind: "remove", from: 2 });
  const r2b = s.handle({ kind: "render", look: LOOK(["#f4efe6"], "glossy"), motif: null, crop }).reply;
  const px = (r: typeof r1, x: number, y: number) => (r.kind === "image" ? new Uint8ClampedArray(r.img.buffer)[((y - crop.y) * crop.w + (x - crop.x)) * 4] : -1);
  // móng 3 (505,370) sau khi bỏ: trở lại màu gốc; móng 1 (272,380): trắng sữa
  const orig3 = im.data[(370 * im.w + 505) * 4];
  const lens = styled.kind === "nails" ? styled.nails.map((n) => Math.hypot(n.geo.tip.x - n.geo.base.x, n.geo.tip.y - n.geo.base.y)) : [];
  const nat = infos.map((r) => (r.kind === "nail" ? Math.hypot(r.nail.geo.tip.x - r.nail.geo.base.x, r.nail.geo.tip.y - r.nail.geo.base.y) : 0));
  // đường viền ≈ mặt nạ
  const seg = segsOf["hand.jpg"][1];
  let polyA = 0; const o = seg.outline;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) polyA += (o[j].x + o[i].x) * (o[j].y - o[i].y);
  polyA = Math.abs(polyA / 2);
  const maskA = seg.alpha.reduce((a, v) => a + v, 0);
  ok("E14", "Phiên Thử mẫu: nạp ảnh → 4 móng → đắp hạnh nhân ×1.4 (đầu móng dài ra ×1.4) → vẽ trong khung cắt; bỏ móng 3–4 thì móng đó về ảnh gốc; đường viền khớp diện tích mặt nạ (±6%)",
    infos.every((r) => r.kind === "nail" && r.nail.byColor) && lens.every((l, i) => Math.abs(l / nat[i] - 1.4) < 0.03) && r1.kind === "image" && r1.img.w === 500 && r1.img.h === 300
    && px(r2b, 505, 370) === orig3 && px(r2b, 272, 380) > 200 && Math.abs(polyA / maskA - 1) < 0.06,
    JSON.stringify({ lens: lens.map((l, i) => r2(l / nat[i])), n3: [px(r2b, 505, 370), orig3], n1: px(r2b, 272, 380), outline: r2(polyA / maskA) }));
}

// ---------------- 8. tốc độ (máy tính; điện thoại chậm hơn ~3–4× → vẫn < 1.5 giây / móng, chạy nền)
{
  const t = performance.now();
  for (let k = 0; k < 3; k++) renderLook(imgs["pink.jpg"], segsOf["pink.jpg"], LOOK(["#6e1426"], "glitter"));
  const tr = (performance.now() - t) / 3;
  ok("E15", `Tốc độ: khớp khuôn TB ${Math.round(tSeg / nSeg)}ms / móng (< 400), vẽ 1 mẫu 4 móng ${Math.round(tr)}ms (< 300)`, tSeg / nSeg < 400 && tr < 300);
}

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
