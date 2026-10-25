// Kiểm thử BỘ MÁY THỬ MẪU ẢNH THẬT (lib/tryon) bằng số đo trên 5 ảnh tay có ĐÁP ÁN viền móng vẽ tay
// (scripts/qa/tryon_fixtures.ts): phủ kín móng, không lem ra da, mép trơn + khử răng cưa, chạm lệch vẫn đúng,
// móng gần màu da → khuôn dự phòng, đắp dài, ngoài móng không đổi 1 điểm ảnh, đúng màu, giữ ánh sáng thật,
// xoá đá đính / chỉ bạc cũ, hiệu ứng nhám / chrome / nhũ / mắt mèo, độ trong, hoạ tiết, phiên Worker, tốc độ.
//   npx tsx scripts/qa/tryon_engine_unit.mts
// + tự dò móng (chỉ chụp ảnh), chạm 1 lần, soi tay (tông da / dáng móng), 10 mẫu gợi ý, hoạ tiết bộ máy tự vẽ.
import path from "node:path";
import { createRequire } from "node:module";
import { segmentNail, renderLook, rasterNail, fitNail, lab, type Img, type LookColors, type NailSeg } from "../../lib/tryon/engine";
import { TryOnSession, autoNails, tapFit } from "../../lib/tryon/session";
import { profileFromModels } from "../../lib/tryon/profile";
import { adviceLooks } from "../../lib/tryon/advice";
import { hasMotif } from "../../lib/studio";
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
  // sơn bóng thường giờ mang cả ánh đèn THẬT của ảnh (độ lệch sáng tăng theo) → so chrome với sơn TRƠN nhám (chỉ có
  // bóng tối–sáng) ≥ 2×, và vẫn phải hơn hẳn sơn bóng thường (≥ 1.8×)
  const greyM = stats(LOOK(["#b8bcc4"], "matte"));
  ok("E12", "Hiệu ứng: bóng có vệt sáng (nhám thì không); chrome tương phản kim loại (độ lệch sáng ≥ 2× sơn trơn, ≥ 1.8× sơn bóng); nhũ có hạt sáng (≥ 1.5%); mắt mèo có dải sáng (≥ 4%)",
    glossy.p99 - matte.p99 >= 30 && chrome.sd >= 2 * greyM.sd && chrome.sd >= 1.8 * grey.sd && glitter.bright >= 0.015 && cat.bright >= 0.04,
    JSON.stringify({ glossyP99: r2(glossy.p99), matteP99: r2(matte.p99), chromeSd: r2(chrome.sd), greySd: r2(grey.sd), greyMatteSd: r2(greyM.sd), glitter: r2(glitter.bright), cat: r2(cat.bright) }));
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
  const withMotif = renderLook(im, segs, LOOK(["#f4efe6"], "glossy", { pattern: "floral" }), motif); // hoạ tiết SVG (hoa) — tim / sao… giờ bộ máy tự vẽ, không dùng lớp SVG
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

// ---------------- 7. tự dò móng / chạm 1 lần / soi tay / gợi ý mẫu / phiên (Worker)
const iouSegPoly = (seg: NailSeg, poly: [number, number][]) => {
  let i = 0, u = 0;
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  for (let y = Math.min(seg.y0, ...ys); y < Math.max(seg.y0 + seg.h, ...ys); y++) for (let x = Math.min(seg.x0, ...xs); x < Math.max(seg.x0 + seg.w, ...xs); x++) {
    const a = A(seg, x, y) >= 0.5, g = inPoly(x, y, poly);
    if (a && g) i++; if (a || g) u++;
  }
  return u ? i / u : 0;
};
{
  // TỰ DÒ: không được nhận nhầm (mọi móng nhận phải trùng 1 móng thật ≥ 0.6), nhận được ≥ 8/20 móng ở 5 ảnh khó
  let found = 0, wrong = 0;
  const notes: string[] = [];
  for (const fx of FIXTURES) {
    const r = autoNails(imgs[fx.file]);
    for (const n of r.nails) {
      const seg = rasterNail(imgs[fx.file], n.model);
      const best = Math.max(...fx.outlines.map((p) => iouSegPoly(seg, p)));
      if (best >= 0.6) found++; else { wrong++; notes.push(`${fx.file} IoU ${r2(best)}`); }
    }
  }
  ok("E17", `Tự dò móng (khách chỉ chụp ảnh): KHÔNG nhận nhầm vùng nào (${wrong}), nhận đúng ${found}/20 móng ở 5 ảnh cận khó (≥ 7) — móng sót thì chạm 1 lần`, wrong === 0 && found >= 7, notes.join(" | "));
}
{
  // CHẠM 1 LẦN giữa móng (đúng tâm + lệch 8px): khuôn trùng móng thật
  const vals: number[] = [];
  for (const fx of FIXTURES) for (const [k, poly] of fx.outlines.entries()) for (const [dx, dy] of [[0, 0], [8, -6]]) {
    const cxp = poly.reduce((a, p) => a + p[0], 0) / poly.length, cyp = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const [mb, mt] = fx.marks[(k + 1) % fx.marks.length], hl = Math.hypot(mt[0] - mb[0], mt[1] - mb[1]);
    const r = tapFit(imgs[fx.file], { x: cxp + dx, y: cyp + dy }, { x: (mt[0] - mb[0]) / hl, y: (mt[1] - mb[1]) / hl });
    vals.push(r ? iouSegPoly(rasterNail(imgs[fx.file], r.model), poly) : 0);
  }
  const mean = avg(vals), good = vals.filter((v) => v >= 0.75).length;
  ok("E18", `Chạm 1 lần giữa móng (40 lần, 5 ảnh, lệch tâm 8px): trùng móng thật TB ${r2(mean)} (≥ 0.75), ${good}/40 lần ≥ 0.75 (≥ 28), không lần nào hỏng hẳn (< 0.3)`, mean >= 0.75 && good >= 28 && Math.min(...vals) >= 0.3, vals.map(r2).join(" "));
}
{
  // SOI TAY: tông da / độ dài móng đúng như mắt thợ nhìn
  const prof = (file: string) => profileFromModels(FIXTURES.find((f) => f.file === file)!.marks.map((m) => fitNail(imgs[file], mark(m))))!;
  const pink = prof("pink.jpg"), white = prof("white.jpg"), hand = prof("hand.jpg"), olive = prof("olive.jpg");
  ok("E19", "Soi tay: tay ảnh hồng = da sáng, tông lạnh (ngả hồng) · tay ảnh trắng = tông ấm (ngả vàng) · móng xanh rêu dài, móng đen vừa · màu đang sơn đúng (đen, xanh rêu)",
    pink.undertone === "cool" && pink.depth === "fair" && white.undertone === "warm" && olive.length === "long" && hand.length === "medium"
    && !!hand.polishHex && lab(...(hand.polishHex.match(/[0-9a-f]{2}/g)!.map((h) => parseInt(h, 16)) as [number, number, number]))[0] < 15
    && !!olive.polishHex && lab(...(olive.polishHex.match(/[0-9a-f]{2}/g)!.map((h) => parseInt(h, 16)) as [number, number, number]))[2] > 10,
    JSON.stringify({ pink, white: white.undertone, olive: olive.length, hand: [hand.length, hand.polishHex], olivePolish: olive.polishHex }));
  const set = adviceLooks(pink, "US", "x1"), set2 = adviceLooks(pink, "US", "x2"), au = adviceLooks(white, "AU", "x1", true);
  const pats = new Set(set.map((l) => l.pattern));
  ok("E20", "10 mẫu gợi ý: đủ 10, không trùng, mỗi mẫu có nhãn + lý do + giá ($ / A$ theo thị trường, đắp móng giá cao hơn); có glazed donut, micro French, velvet, aura, baby boomer, ombre; dáng theo tay (móng dài → hạnh nhân); \"Bộ khác\" đổi màu",
    set.length === 10 && new Set(set.map((l) => l.id)).size === 10 && set.every((l) => l.why.vi && l.tag.vi && /^\$\d+–\d+$/.test(l.priceHint))
    && au.every((l) => /^A\$\d+–\d+$/.test(l.priceHint)) && set.some((l) => /Glazed donut/.test(l.title.vi)) && set.some((l) => /Micro French/.test(l.title.vi))
    && ["velvet", "aura", "babyboomer", "ombre"].every((p) => pats.has(p)) && set.every((l) => l.shape === "almond")
    && JSON.stringify(set.map((l) => l.palette)) !== JSON.stringify(set2.map((l) => l.palette)),
    JSON.stringify(set.map((l) => [l.title.vi, l.priceHint])));
}
{
  // HOẠ TIẾT TỰ VẼ đúng chỗ trên móng thật
  const im = imgs["olive.jpg"], segs = segsOf["olive.jpg"].map((s, i) => Object.assign(Object.create(Object.getPrototypeOf(s)), s, { accent: i === 1 || i === 2 }) as NailSeg);
  const seg = segs[0];
  const colAt = (out: Img, along: number, across = 0) => {
    let best = -1, bd = Infinity;
    for (let k = 0; k < seg.alpha.length; k++) { if (seg.alpha[k] < 1) continue; const d = Math.abs(seg.along[k] - along) + Math.abs(seg.across[k] - across) * 0.5; if (d < bd) { bd = d; best = k; } }
    const x = seg.x0 + (best % seg.w), y = seg.y0 + Math.floor(best / seg.w), i = (y * out.w + x) * 4;
    return lab(out.data[i], out.data[i + 1], out.data[i + 2]);
  };
  const fr = renderLook(im, segs, LOOK(["#f6d5d0", "#111111", "#d4af37"], "matte", { pattern: "french" }));
  const om = renderLook(im, segs, LOOK(["#f8fafc", "#7f1d1d", "#d4af37"], "matte", { pattern: "ombre" }));
  const au = renderLook(im, segs, LOOK(["#e8c4a8", "#ec4899", "#d4af37"], "matte", { pattern: "aura" }));
  const gm = renderLook(im, segs, LOOK(["#e8c4a8", "#ffffff", "#c0c0c0"], "glossy", { pattern: "gemcluster" }));
  const tt = renderLook(im, segs, LOOK(["#b45309", "#5b3a29", "#d4af37"], "glossy", { pattern: "tortoise" }));
  const frTip = colAt(fr, 0.97), frBase = colAt(fr, 0.4);
  const omL = [0.2, 0.5, 0.85].map((a) => colAt(om, a)[0]);
  const auMid = colAt(au, 0.5), auEdge = colAt(au, 0.15, 0.75);
  // đá: chỉ trên móng điểm nhấn (móng 2, 3), móng 1 vẫn nền trơn
  const plainG = renderLook(im, segs, LOOK(["#e8c4a8", "#ffffff", "#c0c0c0"], "glossy"));
  const bright = (out: Img, s2: NailSeg) => { let n = 0, b = 0; for (let k = 0; k < s2.alpha.length; k++) { if (s2.alpha[k] < 1 || s2.along[k] > 0.7) continue; n++; const x = s2.x0 + (k % s2.w), y = s2.y0 + Math.floor(k / s2.w); if (Math.abs(lumaAt(out, x, y) - lumaAt(plainG, x, y)) > 30) b++; } return b / n; }; // khác hẳn bản không đá
  let dark = 0, nT = 0;
  core(seg, (x, y) => { nT++; if (lumaAt(tt, x, y) < 60) dark++; });
  ok("E21", "Hoạ tiết tự vẽ bám móng thật: French đen ở ĐẦU móng (chân móng vẫn hồng) · ombre trắng → đỏ rượu đậm dần về đầu móng · aura hồng ở giữa, nude ở mép · cụm đá chỉ trên móng điểm nhấn · đồi mồi có đốm nâu 10–65% mặt móng",
    frTip[0] < 25 && frBase[0] > 70 && omL[0] > omL[1] && omL[1] > omL[2] + 10 && auMid[1] > auEdge[1] + 8
    && bright(gm, segs[1]) > 0.02 && bright(gm, segs[0]) < 0.005 && dark / nT > 0.1 && dark / nT < 0.65,
    JSON.stringify({ frTip: frTip.map(Math.round), frBase: frBase.map(Math.round), omL: omL.map(Math.round), auMid: auMid.map(Math.round), auEdge: auEdge.map(Math.round), gem1: r2(bright(gm, segs[1])), gem0: r2(bright(gm, segs[0])), tort: r2(dark / nT) }));
  ok("E22", "Hoạ tiết bộ máy tự vẽ không cần lớp SVG (french, ombre, aura, velvet, đồi mồi, vân đá, line, ngọc trai, đá); hoạ tiết còn lại (hoa, ma, bí ngô…) vẫn có lớp SVG trên móng điểm nhấn",
    ["french", "ombre", "aura", "velvet", "tortoise", "marble", "lines", "pearls", "gemcluster", "droplets", "chromefrench", "leopard", "checker", "foil", "stars", "hearts", "charm3d", "chromedrops", "solid"].every((p) => !hasMotif(p, true, 4)) && hasMotif("floral", true, 4) && !hasMotif("floral", false, 4) && hasMotif("swirl", false, 4));
}
{
  const im = imgs["hand.jpg"], s = new TryOnSession();
  s.handle({ kind: "image", img: { w: im.w, h: im.h, buffer: im.data.slice().buffer } });
  const auto = s.handle({ kind: "auto" }).reply;
  const nAuto = auto.kind === "nails" ? auto.nails.length : 0;
  // móng còn thiếu: chạm 1 lần vào giữa (tâm đáp án móng chưa có)
  const have = auto.kind === "nails" ? auto.nails : [];
  const missing = FIXTURES[0].outlines.filter((poly) => !have.some((n) => { const c = n.outline.reduce((a, p) => ({ x: a.x + p.x / n.outline.length, y: a.y + p.y / n.outline.length }), { x: 0, y: 0 }); return inPoly(c.x, c.y, poly); }));
  let last = auto;
  for (const [k, poly] of missing.entries()) last = s.handle({ kind: "tap", id: `t${k}`, point: { x: poly.reduce((a, p) => a + p[0], 0) / poly.length, y: poly.reduce((a, p) => a + p[1], 0) / poly.length } }).reply;
  const n4 = last.kind === "nails" ? last.nails.length : 0;
  const profOk = last.kind === "nails" && !!last.profile && last.profile.nails === n4;
  const accents = last.kind === "nails" ? last.nails.filter((n) => n.accent).length : 0;
  const firstId = last.kind === "nails" ? last.nails[0].id : "";
  const dropped = s.handle({ kind: "drop", id: firstId }).reply;
  const styled = s.handle({ kind: "style", lengthFactor: 1.4, shape: "almond" }).reply;
  const crop = { x: 200, y: 200, w: 500, h: 300 };
  const r1 = s.handle({ kind: "render", look: LOOK(["#141416"], "glossy"), motif: null, crop }).reply;
  const miss = s.handle({ kind: "tap", id: "bg", point: { x: 60, y: 60 } }).reply; // chạm vào nền → không thêm móng
  // đường viền ≈ mặt nạ
  const seg = segsOf["hand.jpg"][1];
  let polyA = 0; const o = seg.outline;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) polyA += (o[j].x + o[i].x) * (o[j].y - o[i].y);
  polyA = Math.abs(polyA / 2);
  const maskA = seg.alpha.reduce((a, v) => a + v, 0);
  ok("E14", "Phiên Thử mẫu: nạp ảnh → TỰ nhận móng → chạm 1 lần thêm móng sót = đủ 4 móng (soi tay theo đủ 4 móng, 2 móng điểm nhấn) → bỏ 1 móng còn 3 → đắp hạnh nhân ×1.4 → vẽ đúng khung cắt; chạm vào nền không thêm móng; đường viền khớp mặt nạ (±6%)",
    nAuto >= 2 && n4 === 4 && profOk && accents === 2 && dropped.kind === "nails" && dropped.nails.length === 3 && styled.kind === "nails"
    && styled.nails.every((n) => n.geo.tip && n.geo.width > 0) && r1.kind === "image" && r1.img.w === 500 && r1.img.h === 300
    && miss.kind === "nails" && !miss.added && miss.nails.length === 3 && Math.abs(polyA / maskA - 1) < 0.06,
    JSON.stringify({ nAuto, n4, profOk, accents, dropped: dropped.kind === "nails" ? dropped.nails.length : -1, miss: miss.kind === "nails" ? [miss.added, miss.nails.length] : null, outline: r2(polyA / maskA) }));
}

{
  // HIỆU ỨNG TREND "BẮT MẮT" phải ra CHẤT THẬT (đo bằng số, không chỉ nhìn): gương kim loại, nhung, ngọc trai 3D,
  // giọt nước 3D, viền chỉ kim loại đồi mồi; bộ 10 mẫu luôn có 1 mẫu kim loại + 1 mẫu 3D
  const px = (seg: NailSeg, fn: (x: number, y: number, k: number) => void) => {
    for (let k = 0; k < seg.alpha.length; k++) if (seg.alpha[k] >= 0.99) fn(seg.x0 + (k % seg.w), seg.y0 + Math.floor(k / seg.w), k);
  };
  const sd = (a: number[]) => { const m = avg(a); return Math.sqrt(avg(a.map((x) => (x - m) ** 2))); };
  // a) French tráng gương bạc: đầu móng có dải sáng gắt + mảng tối (gương), không phải xám phẳng
  const hi = imgs["hand.jpg"], hs = segsOf["hand.jpg"];
  const cf = renderLook(hi, hs, LOOK(["#f6d5d0", "#ffffff", "#c0c0c0"], "glossy", { pattern: "chromefrench" }));
  const tipL: number[] = [];
  for (const sg of hs) px(sg, (x, y, k) => { if (sg.along[k] > 0.94 && Math.abs(sg.across[k]) < 0.8) tipL.push(lumaAt(cf, x, y)); });
  const tipOk = sd(tipL) >= 30 && Math.max(...tipL) >= 215 && Math.min(...tipL) <= 120;
  // b) velvet đỏ rượu: giữ độ đậm màu (không bạc thành nâu bụi), giữa móng sáng hơn mép (quầng từ tính)
  const pi = imgs["pink.jpg"], ps = segsOf["pink.jpg"];
  const vel = renderLook(pi, ps, LOOK(["#7f1d1d", "#ffffff", "#d4af37"], "cateye", { pattern: "velvet" }));
  const sol = renderLook(pi, ps, LOOK(["#7f1d1d"], "glossy"));
  const chroma = (out: Img) => { const c: number[] = []; for (const sg of ps) core(sg, (x, y) => { const i = (y * out.w + x) * 4; const L2 = lab(out.data[i], out.data[i + 1], out.data[i + 2]); c.push(Math.hypot(L2[1], L2[2])); }); return med(c); };
  const mid: number[] = [], rim: number[] = [];
  for (const sg of ps) px(sg, (x, y, k) => { if (sg.along[k] < 0.3 || sg.along[k] > 0.8) return; const a = Math.abs(sg.across[k]); if (a < 0.25) mid.push(lumaAt(vel, x, y)); else if (a > 0.7 && a < 0.9) rim.push(lumaAt(vel, x, y)); });
  const velOk = chroma(vel) >= 0.85 * chroma(sol) && med(mid) > med(rim) + 6;
  // c) ngọc trai: có điểm bóng gương (≥ 235) + bóng tiếp xúc tối hơn nền (≥ 20) quanh hạt, chỉ ở móng điểm nhấn
  const plainP = renderLook(pi, ps, LOOK(["#f6d5d0"], "glossy"));
  const prl = renderLook(pi, ps, LOOK(["#f6d5d0", "#ffffff", "#f5f0e8"], "glossy", { pattern: "pearls" }));
  let pHi = 0, pSh = 0, pOff = 0;
  ps.forEach((sg, i) => px(sg, (x, y) => {
    const d = lumaAt(prl, x, y) - lumaAt(plainP, x, y);
    if (i === 2 || i === 3) { if (lumaAt(prl, x, y) >= 235 && d > 8) pHi++; if (d <= -20) pSh++; } else if (Math.abs(d) > 20) pOff++;
  }));
  const pearlOk = pHi >= 6 && pSh >= 20 && pOff === 0;
  // d) giọt nước 3D: có trên MỌI móng, mỗi móng có cả điểm sáng (bóng cửa sổ / ánh hội tụ) lẫn vòng khúc xạ tối
  const drp = renderLook(pi, ps, LOOK(["#f2c4c4", "#ffffff", "#c0c0c0"], "glossy", { pattern: "droplets" }));
  const plainD = renderLook(pi, ps, LOOK(["#f2c4c4"], "glossy"));
  const dropNails = ps.map((sg) => { let up = 0, dn = 0; px(sg, (x, y) => { const d = lumaAt(drp, x, y) - lumaAt(plainD, x, y); if (d >= 25) up++; if (d <= -25) dn++; }); return up >= 5 && dn >= 15; });
  // e) đồi mồi "viền bạc / vàng": viền chỉ kim loại sáng sát mép CHỈ trên 2 móng điểm nhấn
  const oi = imgs["olive.jpg"], os = segsOf["olive.jpg"].map((s, i) => Object.assign(Object.create(Object.getPrototypeOf(s)), s, { accent: i === 1 || i === 2 }) as NailSeg);
  const tor = renderLook(oi, os, LOOK(["#b45309", "#5b3a29", "#c0c0c0"], "glossy", { pattern: "tortoise" }));
  const rimBright = (sg: NailSeg) => {
    let n = 0, b = 0;
    px(sg, (x, y, k) => {
      const xx = k % sg.w, yy = Math.floor(k / sg.w);
      let edgeNear = false;
      for (let dy = -4; dy <= 4 && !edgeNear; dy++) for (let dx = -4; dx <= 4; dx++) { const X = xx + dx, Y = yy + dy; if (X < 0 || Y < 0 || X >= sg.w || Y >= sg.h || sg.alpha[Y * sg.w + X] < 0.5) { edgeNear = true; break; } }
      if (!edgeNear || sg.along[k] < 0.15 || sg.along[k] > 0.85) return;
      n++; if (lumaAt(tor, x, y) > 150) b++;
    });
    return n ? b / n : 0;
  };
  const rimAcc = rimBright(os[1]), rimPlain = rimBright(os[0]);
  // f) bộ 10 mẫu: luôn 1 mẫu chi tiết kim loại + 1 mẫu 3D; "Bộ khác" xoay nhiều kiểu 3D
  const prof = profileFromModels(FIXTURES.find((f) => f.file === "pink.jpg")!.marks.map((m) => fitNail(pi, mark(m))))!;
  const METALS = new Set(["chromeline", "lines", "chromefrench", "marble", "tortoise", "foil", "leopard", "checker"]), THREE_D = new Set(["pearls", "droplets", "gemcluster", "chromedrops", "charm3d", "stars", "hearts"]);
  const sets = ["x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8"].map((salt) => adviceLooks(prof, "US", salt));
  const wowOk = sets.every((st) => st.filter((l) => METALS.has(l.pattern)).length === 1 && st.filter((l) => THREE_D.has(l.pattern)).length === 1);
  const kinds3d = new Set(sets.flatMap((st) => st.filter((l) => THREE_D.has(l.pattern)).map((l) => l.pattern)));
  ok("E23", `Trend bắt mắt ra chất thật: French gương bạc (độ lệch sáng đầu móng ${Math.round(sd(tipL))} ≥ 30, có dải sáng + mảng tối) · velvet giữ màu (độ đậm ${Math.round(chroma(vel))} / sơn thường ${Math.round(chroma(sol))}) + giữa sáng hơn mép · ngọc trai có điểm bóng + bóng tiếp xúc, chỉ móng nhấn · giọt nước 3D đủ ${dropNails.filter(Boolean).length}/4 móng · đồi mồi viền kim loại móng nhấn ${Math.round(rimAcc * 100)}% (móng thường ${Math.round(rimPlain * 100)}%) · mỗi bộ 10 mẫu có 1 mẫu kim loại + 1 mẫu 3D (${[...kinds3d].join(", ")})`,
    tipOk && velOk && pearlOk && dropNails.every(Boolean) && rimAcc >= 0.2 && rimPlain < 0.08 && wowOk && kinds3d.size >= 2,
    JSON.stringify({ tip: [Math.round(sd(tipL)), Math.max(...tipL), Math.min(...tipL)], vel: [Math.round(chroma(vel)), Math.round(chroma(sol)), Math.round(med(mid)), Math.round(med(rim))], pearl: [pHi, pSh, pOff], drops: dropNails, rim: [r2(rimAcc), r2(rimPlain)], wowOk, kinds3d: [...kinds3d] }));
}

{
  // TREND MỚI do bộ máy tự vẽ (không còn lớp SVG phẳng): da báo, bàn cờ, foil, charm sao / nơ kim loại 3D, tim vẽ tay chỉ
  // trên 2 móng nhấn; giọt chrome trên MỌI móng; mỗi mẫu đổi rõ mặt móng nhấn và có cả điểm sáng (kim loại / bóng gel)
  const pi = imgs["pink.jpg"], ps = segsOf["pink.jpg"];
  const plain = (c: string) => renderLook(pi, ps, LOOK([c], "glossy"));
  const changed = (out: Img, ref: Img, sg: NailSeg) => { let n = 0, d = 0; for (let k = 0; k < sg.alpha.length; k++) { if (sg.alpha[k] < 0.99) continue; n++; const x = sg.x0 + (k % sg.w), y = sg.y0 + Math.floor(k / sg.w); if (Math.abs(lumaAt(out, x, y) - lumaAt(ref, x, y)) > 25) d++; } return d / n; };
  const cases: [string, string[], number][] = [["leopard", ["#e8c4a8", "#a0522d", "#d4af37"], 0.06], ["checker", ["#f2c4c4", "#4b2e2a", "#d4af37"], 0.3], ["foil", ["#556b2f", "#ffffff", "#d4af37"], 0.05], ["stars", ["#1e2a4a", "#ffffff", "#c0c0c0"], 0.03], ["charm3d", ["#f6d5d0", "#ffffff", "#c0c0c0"], 0.03], ["hearts", ["#f8f4ee", "#c81e3a", "#d4af37"], 0.02]];
  const bad: string[] = [];
  for (const [pat, cols, min] of cases) {
    const out = renderLook(pi, ps, LOOK(cols, "glossy", { pattern: pat })), ref = plain(cols[0]);
    const acc = changed(out, ref, ps[2]), other = changed(out, ref, ps[0]);
    if (acc < min || other > 0.005) bad.push(`${pat}: nhấn ${r2(acc)} (≥ ${min}) · thường ${r2(other)}`);
  }
  const cd = renderLook(pi, ps, LOOK(["#e8c4a8", "#ffffff", "#c0c0c0"], "glossy", { pattern: "chromedrops" })), cdRef = plain("#e8c4a8");
  const cdAll = ps.map((sg) => changed(cd, cdRef, sg));
  if (cdAll.some((v) => v < 0.03)) bad.push(`chromedrops: ${cdAll.map(r2).join("/")}`);
  ok("E24", "Trend mới tự vẽ: da báo · bàn cờ · foil · charm sao · charm nơ 3D · tim — đổi rõ 2 móng nhấn, móng thường giữ nguyên; giọt chrome 3D có trên cả 4 móng", !bad.length, bad.join(" | "));
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
