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
import { expandSet, nailOrder, setRoles, applyBeadOpts, THEME_SETS } from "../../lib/tryon/sets";
import { ALL_NAIL_PATTERNS } from "../../lib/tryon/patterns";
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
/** vai từng móng mà renderLook sẽ dùng (bộ phối lib/tryon/sets): chỉ số móng hero / echo / thread / quiet */
const roleIdx = (segs: NailSeg[], look: LookColors) => {
  const ex = expandSet(look, segs.length, nailOrder(segs)), ns = ex.nails ?? [];
  const of = (r: string) => ns.map((o, i) => (o?.role === r ? i : -1)).filter((i) => i >= 0);
  return { hero: of("hero")[0] ?? -1, echo: of("echo")[0] ?? -1, thread: of("thread"), quiet: of("quiet"), nails: ns };
};
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
  const withMotif = renderLook(im, segs, LOOK(["#f4efe6"], "glossy", { pattern: "custom-svg" }), motif); // lớp SVG giờ chỉ cho hoạ tiết MỚI chưa tự vẽ (mọi hoạ tiết trong máy tạo mẫu đã tự vẽ)
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
  ok("E20", "10 mẫu gợi ý: đủ 10, không trùng, mỗi mẫu có nhãn + lý do + giá ($ / A$ theo thị trường, đắp móng giá cao hơn); có glazed donut, micro French, 1 mẫu họ mắt mèo (velvet / chấm bi / aurora / đỏ sẫm / 2 tông), aura, baby boomer, ombre; dáng theo tay (móng dài → hạnh nhân); \"Bộ khác\" đổi màu",
    set.length === 10 && new Set(set.map((l) => l.id)).size === 10 && set.every((l) => l.why.vi && l.tag.vi && /^\$\d+–\d+$/.test(l.priceHint))
    && au.every((l) => /^A\$\d+–\d+$/.test(l.priceHint)) && set.some((l) => /Glazed donut/.test(l.title.vi)) && set.some((l) => /Micro French/.test(l.title.vi))
    && ["aura", "babyboomer", "ombre"].every((p) => pats.has(p)) && set.some((l) => l.finish === "cateye") && set.every((l) => l.shape === "almond")
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
  // đá: cụm đủ trên móng HERO, móng ECHO chỉ 1 viên lẻ nhỏ hơn (bộ phối lib/tryon/sets — không còn 2 móng dán y hệt)
  const plainG = renderLook(im, segs, LOOK(["#e8c4a8", "#ffffff", "#c0c0c0"], "glossy"));
  const bright = (out: Img, s2: NailSeg) => { let n = 0, b = 0; for (let k = 0; k < s2.alpha.length; k++) { if (s2.alpha[k] < 1 || s2.along[k] > 0.7) continue; n++; const x = s2.x0 + (k % s2.w), y = s2.y0 + Math.floor(k / s2.w); if (Math.abs(lumaAt(out, x, y) - lumaAt(plainG, x, y)) > 30) b++; } return b / n; }; // khác hẳn bản không đá
  const gR = roleIdx(segs, LOOK(["#e8c4a8", "#ffffff", "#c0c0c0"], "glossy", { pattern: "gemcluster" })), tR = roleIdx(segs, LOOK(["#b45309", "#5b3a29", "#d4af37"], "glossy", { pattern: "tortoise" }));
  const gemH = bright(gm, segs[gR.hero]), gemE = bright(gm, segs[gR.echo]);
  // đốm đo trên móng HERO (đồi mồi cả móng); echo của bộ là đầu French đồi mồi (fr-tortoise) → đốm chỉ ở đầu móng
  let dark = 0, nT = 0, eDark = 0, eN = 0;
  core(segs[tR.hero], (x, y) => { nT++; if (lumaAt(tt, x, y) < 60) dark++; });
  { const sE = segs[tR.echo]; for (let k = 0; k < sE.alpha.length; k++) { if (sE.alpha[k] < 1 || sE.along[k] < 0.75) continue; eN++; if (lumaAt(tt, sE.x0 + (k % sE.w), sE.y0 + Math.floor(k / sE.w)) < 60) eDark++; } }
  ok("E21", "Hoạ tiết tự vẽ bám móng thật: French đen ở ĐẦU móng (chân móng vẫn hồng) · ombre trắng → đỏ rượu đậm dần về đầu móng · aura hồng ở giữa, nude ở mép · cụm đá đủ trên móng hero, móng echo 1 viên lẻ nhỏ hơn · đồi mồi có đốm nâu 10–65% mặt móng hero",
    frTip[0] < 25 && frBase[0] > 70 && omL[0] > omL[1] && omL[1] > omL[2] + 10 && auMid[1] > auEdge[1] + 8
    && gemH > 0.02 && gemE > 0.002 && gemE < 0.6 * gemH && dark / nT > 0.1 && dark / nT < 0.65 && eDark / (eN || 1) > 0.03,
    JSON.stringify({ frTip: frTip.map(Math.round), frBase: frBase.map(Math.round), omL: omL.map(Math.round), auMid: auMid.map(Math.round), auEdge: auEdge.map(Math.round), gemHero: r2(gemH), gemEcho: r2(gemE), tort: r2(dark / nT), tortEchoTip: r2(eDark / (eN || 1)) }));
  ok("E22", "Hoạ tiết bộ máy tự vẽ không cần lớp SVG (french, ombre, aura, velvet, đồi mồi, vân đá, line, ngọc trai, đá); hoạ tiết mới chưa tự vẽ vẫn có lớp SVG trên móng điểm nhấn",
    ["french", "ombre", "aura", "velvet", "tortoise", "marble", "lines", "pearls", "gemcluster", "droplets", "chromefrench", "leopard", "checker", "foil", "stars", "hearts", "charm3d", "chromedrops", "solid"].every((p) => !hasMotif(p, true, 4)) && hasMotif("custom-svg", true, 4) && !hasMotif("custom-svg", false, 4));
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
  // c) ngọc trai: móng HERO có điểm bóng gương (≥ 235) + bóng tiếp xúc tối hơn nền (≥ 20) quanh hạt; móng ECHO 1 hạt lẻ
  //    nhỏ hơn (có điểm bóng, ít điểm đổi hơn hẳn hero); móng QUIET trơn giữ nguyên
  const plainP = renderLook(pi, ps, LOOK(["#f6d5d0"], "glossy"));
  const pLook = LOOK(["#f6d5d0", "#ffffff", "#f5f0e8"], "glossy", { pattern: "pearls" }), pR = roleIdx(ps, pLook);
  const prl = renderLook(pi, ps, pLook);
  const pHiN = ps.map(() => 0), pChN = ps.map(() => 0);
  let pSh = 0;
  ps.forEach((sg, i) => px(sg, (x, y) => {
    const d = lumaAt(prl, x, y) - lumaAt(plainP, x, y);
    if (lumaAt(prl, x, y) >= 235 && d > 8) pHiN[i]++;
    if (Math.abs(d) > 20) pChN[i]++;
    if (i === pR.hero && d <= -20) pSh++;
  }));
  const pOff = pR.quiet.reduce((a, i) => a + pChN[i], 0);
  const pearlOk = pHiN[pR.hero] >= 6 && pSh >= 20 && pHiN[pR.echo] >= 1 && pChN[pR.echo] > 0 && pChN[pR.echo] < 0.6 * pChN[pR.hero] && pOff === 0;
  // d) giọt nước 3D: trên móng HERO + ECHO (echo = các giọt nhỏ, không phải bản sao), mỗi móng có cả điểm sáng (bóng cửa
  //    sổ / ánh hội tụ) lẫn vòng khúc xạ tối; móng thread không trơn
  const dLook = LOOK(["#f2c4c4", "#ffffff", "#c0c0c0"], "glossy", { pattern: "droplets" }), dR = roleIdx(ps, dLook);
  const drp = renderLook(pi, ps, dLook);
  const plainD = renderLook(pi, ps, LOOK(["#f2c4c4"], "glossy"));
  const dropN = ps.map((sg) => { let up = 0, dn = 0; px(sg, (x, y) => { const d = lumaAt(drp, x, y) - lumaAt(plainD, x, y); if (d >= 25) up++; if (d <= -25) dn++; }); return { up, dn }; });
  const dropNails = [dR.hero, dR.echo].map((i) => dropN[i].up >= 5 && dropN[i].dn >= 15).concat(dR.thread.map((i) => dropN[i].up + dropN[i].dn >= 30));
  // e) đồi mồi "viền bạc / vàng": viền chỉ kim loại sáng sát mép CHỈ trên móng hero (echo đồi mồi không viền)
  const oi = imgs["olive.jpg"], os = segsOf["olive.jpg"];
  const tR = roleIdx(os, LOOK(["#b45309", "#5b3a29", "#c0c0c0"], "glossy", { pattern: "tortoise" }));
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
  const rimAcc = rimBright(os[tR.hero]), rimPlain = rimBright(os[tR.echo]);
  // f) bộ 10 mẫu: luôn 1 mẫu chi tiết kim loại + 1 mẫu 3D; "Bộ khác" xoay nhiều kiểu 3D
  const prof = profileFromModels(FIXTURES.find((f) => f.file === "pink.jpg")!.marks.map((m) => fitNail(pi, mark(m))))!;
  const METALS = new Set(["chromeline", "lines", "chromefrench", "marble", "tortoise", "foil", "leopard", "checker", "stripes", "polka", "fawn"]), THREE_D = new Set(["pearls", "droplets", "gemcluster", "chromedrops", "charm3d", "stars", "hearts", "ghost", "bats", "jackolantern", "web", "moonstars", "snow", "candy", "plaid", "floral", "cherry"]);
  const sets = ["x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8"].map((salt) => adviceLooks(prof, "US", salt));
  // (chấm bi cũng có trong ô họ mắt mèo — khi đó là hiệu ứng mắt mèo, không tính là mẫu "chi tiết")
  const wowOk = sets.every((st) => st.filter((l) => METALS.has(l.pattern) && l.finish !== "cateye").length === 1 && st.filter((l) => THREE_D.has(l.pattern)).length === 1);
  const kinds3d = new Set(sets.flatMap((st) => st.filter((l) => THREE_D.has(l.pattern)).map((l) => l.pattern)));
  ok("E23", `Trend bắt mắt ra chất thật: French gương bạc (độ lệch sáng đầu móng ${Math.round(sd(tipL))} ≥ 30, có dải sáng + mảng tối) · velvet giữ màu (độ đậm ${Math.round(chroma(vel))} / sơn thường ${Math.round(chroma(sol))}) + giữa sáng hơn mép · ngọc trai: móng hero điểm bóng + bóng tiếp xúc, echo 1 hạt nhỏ, quiet trơn · giọt nước 3D hero + echo (giọt nhỏ), thread không trơn (${dropNails.filter(Boolean).length}/${dropNails.length}) · đồi mồi viền kim loại móng hero ${Math.round(rimAcc * 100)}% (echo ${Math.round(rimPlain * 100)}%) · mỗi bộ 10 mẫu có 1 mẫu kim loại + 1 mẫu 3D (${[...kinds3d].join(", ")})`,
    tipOk && velOk && pearlOk && dropNails.length >= 3 && dropNails.every(Boolean) && dropN[dR.echo].up + dropN[dR.echo].dn < dropN[dR.hero].up + dropN[dR.hero].dn && rimAcc >= 0.2 && rimPlain < 0.08 && wowOk && kinds3d.size >= 2,
    JSON.stringify({ tip: [Math.round(sd(tipL)), Math.max(...tipL), Math.min(...tipL)], vel: [Math.round(chroma(vel)), Math.round(chroma(sol)), Math.round(med(mid)), Math.round(med(rim))], pearl: [pHiN, pChN, pSh, pOff, pR.hero, pR.echo], drops: [dropNails, dropN], rim: [r2(rimAcc), r2(rimPlain)], wowOk, kinds3d: [...kinds3d] }));
}

{
  // TREND MỚI do bộ máy tự vẽ (không còn lớp SVG phẳng): da báo, bàn cờ, foil, charm sao / nơ kim loại 3D, tim vẽ tay,
  // giọt chrome — BỘ PHỐI: móng hero đổi rõ; móng echo có chi tiết (hoạ tiết hạt: NHỎ HƠN hero, không phải bản sao; hoạ
  // tiết in lặp: lặp lại ở móng KHÔNG kề hero); móng thread không trơn; tối đa 1 móng trơn màu nền
  const pi = imgs["pink.jpg"], ps = segsOf["pink.jpg"];
  const plain = (c: string) => renderLook(pi, ps, LOOK([c], "glossy"));
  const changed = (out: Img, ref: Img, sg: NailSeg) => { let n = 0, d = 0; for (let k = 0; k < sg.alpha.length; k++) { if (sg.alpha[k] < 0.99) continue; n++; const x = sg.x0 + (k % sg.w), y = sg.y0 + Math.floor(k / sg.w); if (Math.abs(lumaAt(out, x, y) - lumaAt(ref, x, y)) > 25) d++; } return d / n; };
  const order = nailOrder(ps), posOf = (i: number) => order.indexOf(i);
  const cases: [string, string[], number, boolean][] = [["leopard", ["#e8c4a8", "#a0522d", "#d4af37"], 0.06, true], ["checker", ["#f2c4c4", "#4b2e2a", "#d4af37"], 0.3, true], ["foil", ["#556b2f", "#ffffff", "#d4af37"], 0.05, true], ["stars", ["#1e2a4a", "#ffffff", "#c0c0c0"], 0.03, false], ["charm3d", ["#f6d5d0", "#ffffff", "#c0c0c0"], 0.03, false], ["hearts", ["#f8f4ee", "#c81e3a", "#d4af37"], 0.02, false], ["chromedrops", ["#e8c4a8", "#ffffff", "#c0c0c0"], 0.03, false]];
  const bad: string[] = [];
  for (const [pat, cols, min, print] of cases) {
    const lk = LOOK(cols, "glossy", { pattern: pat }), R = roleIdx(ps, lk);
    const out = renderLook(pi, ps, lk), ref = plain(cols[0]);
    const ch = ps.map((sg) => changed(out, ref, sg)), H = ch[R.hero], E = ch[R.echo];
    const blank = ch.filter((v) => v < 0.004).length;
    const echoOk = print ? E >= 0.5 * min && Math.abs(posOf(R.hero) - posOf(R.echo)) >= 2 : E > 0.004 && E < H;
    if (H < min || !echoOk || R.thread.some((i) => ch[i] < 0.004) || blank > 1) bad.push(`${pat}: hero ${r2(H)} (≥ ${min}) · echo ${r2(E)} · ${ch.map(r2).join("/")}`);
  }
  ok("E24", "Trend mới tự vẽ (bộ phối): da báo · bàn cờ · foil · charm sao · charm nơ 3D · tim · giọt chrome — móng hero đổi rõ; echo nhỏ hơn hero (hoạ tiết in lặp: lặp ở móng không kề hero); thread không trơn; ≤ 1 móng trơn", !bad.length, bad.join(" | "));
}

{
  // HOẠ TIẾT TREND / MÙA LỄ do bộ máy tự vẽ (thay lớp SVG phẳng) — BỘ PHỐI: hero có hoạ tiết; echo có chi tiết KHÁC (không
  // phải bản sao hero: mẫu khác / chọn hạt / thu nhỏ — trừ hoạ tiết in lặp theo hạt giống từng móng); thread không trơn;
  // ≤ 1 móng trơn. Sọc (in lặp): chỉ 2 móng không kề nhau. Chấm bi mắt mèo, dâu nhúng sô-cô-la, aurora, kẹo bắp: cả 4 móng
  const pi = imgs["pink.jpg"], ps = segsOf["pink.jpg"], order = nailOrder(ps), posOf = (i: number) => order.indexOf(i);
  const diff = (out: Img, ref: Img, sg: NailSeg) => { let n = 0, d = 0; for (let k = 0; k < sg.alpha.length; k++) { if (sg.alpha[k] < 0.99) continue; n++; const x = sg.x0 + (k % sg.w), y = sg.y0 + Math.floor(k / sg.w); if (Math.abs(lumaAt(out, x, y) - lumaAt(ref, x, y)) > 25) d++; } return d / n; };
  const accentOnly: [string, string[]][] = [["ghost", ["#111111", "#ffffff", "#c0c0c0"]], ["jackolantern", ["#e8c4a8", "#ffffff", "#d4af37"]], ["bats", ["#3b1f3a", "#ffffff", "#c0c0c0"]], ["moonstars", ["#1e2a4a", "#ffffff", "#d4af37"]], ["web", ["#111111", "#ffffff", "#c0c0c0"]], ["snow", ["#a9c7e8", "#ffffff", "#c0c0c0"]], ["plaid", ["#9f1239", "#14532d", "#d4af37"]], ["candy", ["#f8fafc", "#b91c1c", "#d4af37"]], ["cherry", ["#f8f4ee", "#ffffff", "#d4af37"]], ["floral", ["#f8f4ee", "#f9a8d4", "#d4af37"]], ["blackcat", ["#c2410c", "#ffffff", "#d4af37"]], ["skull", ["#111111", "#ffffff", "#c0c0c0"]], ["eyeball", ["#111111", "#16a34a", "#c0c0c0"]], ["slimedrip", ["#111111", "#ffffff", "#c0c0c0"]], ["mummy", ["#111111", "#ffffff", "#c0c0c0"]], ["fawn", ["#c68642", "#f3e3cf", "#d4af37"]]];
  const SEEDED = new Set(["plaid", "fawn", "slimedrip"]); // hoạ tiết in lặp / chảy theo hạt giống: lặp đúng 2 móng không kề là chủ ý
  const allNails: [string, string[], LookColors["finish"]][] = [["polka", ["#3e1530", "#f8fafc", "#c0c0c0"], "cateye"], ["chocodip", ["#e0354a", "#4a2a1a", "#d4af37"], "glossy"], ["auroracat", ["#111111", "#ffffff", "#c0c0c0"], "cateye"], ["candycorn", ["#f8fafc", "#ffffff", "#d4af37"], "glossy"]];
  const bad: string[] = [];
  for (const [pat, cols] of accentOnly) {
    const lk = LOOK(cols, "glossy", { pattern: pat }), R = roleIdx(ps, lk);
    const out = renderLook(pi, ps, lk), ref = renderLook(pi, ps, LOOK([cols[0]], "glossy"));
    const ch = ps.map((sg) => diff(out, ref, sg)), eo = R.nails[R.echo];
    const notClone = !!eo && (eo.pattern !== pat || (!!eo.pick && eo.pick !== "all") || (eo.scale ?? 1) < 1 || SEEDED.has(pat));
    if (ch[R.hero] < 0.015 || ch[R.echo] < 0.004 || !notClone || R.thread.some((i) => ch[i] < 0.004) || ch.filter((v) => v < 0.004).length > 1)
      bad.push(`${pat}: hero ${r2(ch[R.hero])} · echo ${r2(ch[R.echo])} ${JSON.stringify(eo)} · ${ch.map(r2).join("/")}`);
  }
  for (const [pat, cols, fin] of allNails) {
    const out = renderLook(pi, ps, LOOK(cols, fin, { pattern: pat })), ref = renderLook(pi, ps, LOOK([cols[0]], fin === "cateye" ? "glossy" : fin));
    const each = ps.map((sg) => diff(out, ref, sg));
    if (each.some((v) => v < 0.02)) bad.push(`${pat}: ${each.map(r2).join("/")}`);
  }
  {
    const lk = LOOK(["#f2c4c4", "#4b2e2a", "#d4af37"], "glossy", { pattern: "stripes" }), R = roleIdx(ps, lk);
    const out = renderLook(pi, ps, lk), ref = renderLook(pi, ps, LOOK(["#f2c4c4"], "glossy")), each = ps.map((sg) => diff(out, ref, sg));
    const striped = R.nails.map((o, i) => (o?.pattern === "stripes" ? i : -1)).filter((i) => i >= 0);
    if (striped.length !== 2 || Math.abs(posOf(striped[0]) - posOf(striped[1])) < 2 || striped.some((i) => each[i] < 0.02)) bad.push(`stripes: ${striped.join(",")} · ${each.map(r2).join("/")}`);
  }
  ok("E25", `Hoạ tiết trend & mùa lễ tự vẽ (${accentOnly.length + allNails.length + 1} mẫu, bộ phối): ma / bí ngô / dơi / trăng / mạng nhện / bông tuyết / caro / kẹo gậy / cherry / hoa / mèo đen / đầu lâu / mắt quỷ / slime / xác ướp / da hươu — hero có hoạ tiết, echo chi tiết khác, thread không trơn, ≤ 1 móng trơn; sọc chỉ 2 móng không kề; chấm bi mắt mèo / dâu nhúng sô-cô-la / mắt mèo aurora / kẹo bắp trên cả 4 móng`, !bad.length, bad.join(" | "));
}

{
  // BỘ PHỐI (lib/tryon/sets): vai theo vị trí ngón khi không biết ngón (Thử mẫu) · theo look.hero / echo khi biết (kho mẫu)
  // · ngón út (móng đầu mút hẹp nhất) luôn cuối · echo lấy chi tiết nhỏ khác · hoạ tiết in lặp ≤ 2 móng không kề · chấm
  // bi mắt mèo đủ 4 móng · bộ chủ đề mix-* mỗi móng 1 kiểu, cùng bảng màu · ổn định theo hạt giống
  const bad: string[] = [];
  const r4 = setRoles(4, {}), r5 = setRoles(5, {}), r3 = setRoles(3, {}), rx = setRoles(4, { hero: 1, echo: 3 });
  if (r4.roles.join() !== "echo,quiet,hero,thread") bad.push(`4 móng: ${r4.roles}`);
  if (r5.hero !== 3 || r5.echo !== 1 || r5.roles.filter((r) => r === "thread").length !== 2 || r5.variant[0] === r5.variant[4]) bad.push(`5 móng: ${r5.roles} ${r5.variant}`);
  if (r3.hero !== 1 || r3.echo !== -1 || r3.roles.includes("echo")) bad.push(`3 móng: ${r3.roles}`);
  if (rx.roles[1] !== "hero" || rx.roles[3] !== "echo") bad.push(`kho mẫu chỉ định: ${rx.roles}`);
  // ngón út hẹp nhất nằm cuối dù đứng đầu mảng (ảnh p067: móng 0 là ngón út)
  const fake = (x: number, hw: number) => ({ base: { x, y: 300 }, tip: { x, y: 200 }, hw });
  if (nailOrder([fake(100, 20), fake(200, 30), fake(300, 32), fake(400, 29)]).join() !== "3,2,1,0") bad.push(`ngón út: ${nailOrder([fake(100, 20), fake(200, 30), fake(300, 32), fake(400, 29)])}`);
  // 2 móng đầu mút rộng bằng nhau → móng NGẮN hơn là ngón út (so diện tích hw × L)
  const fakeL = (x: number, hw: number, L: number) => ({ base: { x, y: 300 }, tip: { x, y: 300 - L }, hw, L });
  const oL = nailOrder([fakeL(100, 30, 80), fakeL(200, 33, 120), fakeL(300, 34, 125), fakeL(400, 30, 110)]);
  if (oL.join() !== "3,2,1,0") bad.push(`ngón út theo bề dài: ${oL}`);
  // echo: bỏ hạt to nhất (trăng → sao) / 2 bản nhỏ / 1 viên lẻ ở chân móng; cỡ / lật / dời
  const bs = [{ u: 0.5, t: 0, r: 0.5, kind: "moon" }, { u: 0.3, t: 0.4, r: 0.2, kind: "star" }, { u: 0.8, t: 0.4, r: 0.14, kind: "star" }];
  const rest = applyBeadOpts(bs, { role: "echo" }), twin = applyBeadOpts([bs[0]], { role: "echo" }), one = applyBeadOpts([{ u: 0.3, t: 0, r: 0.33, kind: "gem" }, { u: 0.5, t: 0.4, r: 0.15, kind: "gem" }], { role: "echo" });
  const mv = applyBeadOpts(bs, { scale: 0.5, mirror: true, uShift: 0.05 });
  if (rest.length !== 2 || rest.some((b) => b.kind === "moon")) bad.push(`echo rest: ${JSON.stringify(rest)}`);
  if (twin.length !== 2 || twin.some((b) => b.r >= 0.5)) bad.push(`echo twin: ${JSON.stringify(twin)}`);
  // 1 viên lẻ ở chân móng: nhỏ hơn viên to nhất của cụm nhưng vẫn đọc được là viên đá (≥ 0.22 hw ≈ 7px), không phải hạt bụi
  if (one.length !== 1 || one[0].r >= 0.33 || one[0].r < 0.22 || one[0].u > 0.3) bad.push(`echo 1 viên: ${JSON.stringify(one)}`);
  // mọi hoạ tiết vẽ / charm (đủ hạt giống): có echo, echo KHÔNG phải bản sao hero (mẫu khác / chọn hạt / thu nhỏ), thread
  // không bao giờ trơn (French / gương / nhũ loang), chỉ móng quiet được trơn
  const MOTIFS = ["ghost", "bats", "jackolantern", "skull", "blackcat", "cherry", "hearts", "floral", "blossom", "leaf", "snow", "stars", "moonstars", "mummy", "eyeball", "web", "gems", "gemcluster", "pearls", "charm3d", "droplets", "chromedrops", "holly", "ornament", "gelflower"];
  for (const p of MOTIFS) for (const seed of [1, 2, 3, 4, 5, 6]) {
    const ex = expandSet(LOOK(["#111111", "#ffffff", "#c0c0c0"], "glossy", { pattern: p, seed }), 4), ns = ex.nails ?? [];
    const e = ns.find((o) => o?.role === "echo"), th = ns.filter((o) => o?.role === "thread");
    const clone = !e || (e.pattern === p && (!e.pick || e.pick === "all") && (e.scale ?? 1) >= 1);
    if (clone || !ns.some((o) => o?.role === "hero" && o.pattern === p) || th.some((o) => !o?.art || (o.pattern === "solid" && o.finish !== "chrome")) || ns.some((o) => o?.role !== "quiet" && !o?.art)) bad.push(`${p}/${seed}: ${JSON.stringify(ns)}`);
  }
  // cherry: đầu French echo lấy màu ĐỎ của bảng màu (đỏ son #b91c1c), bảng màu không có đỏ thì đỏ cherry
  const chE = (cols: string[]) => (expandSet(LOOK(cols, "glossy", { pattern: "cherry" }), 4).nails ?? []).find((o) => o?.role === "echo")?.colors?.[1];
  if (chE(["#f9a8d4", "#b91c1c", "#d4af37"]) !== "#b91c1c" || chE(["#f8f4ee", "#ffffff", "#d4af37"]) !== "#b3122e") bad.push(`cherry echo đỏ: ${chE(["#f9a8d4", "#b91c1c", "#d4af37"])} / ${chE(["#f8f4ee", "#ffffff", "#d4af37"])}`);
  // thu ×0.5 quanh tâm nhóm (u 0.533, t 0.267) rồi lật + dời 0.05; trăng 0.5 → 0.25 nhưng không nhỏ hơn sàn 0.3 (vẽ tay)
  if (Math.abs(mv[0].r - 0.3) > 1e-6 || Math.abs(mv[1].r - 0.16) > 1e-6 || Math.abs(mv[0].u - 0.5667) > 0.005 || Math.abs(mv[0].t + 0.1333) > 0.005 || mv[1].t >= 0) bad.push(`cỡ / lật / dời: ${JSON.stringify(mv)}`);
  // hoạ tiết in lặp: ≤ 2 móng, không kề; không còn trong ALL_NAIL_PATTERNS; chấm bi mắt mèo đủ 4 móng
  for (const p of ["polka", "stripes", "chromedrops", "tortoise", "leopard", "checker"]) {
    const ex = expandSet(LOOK(["#3e1530", "#f8fafc", "#c0c0c0"], "glossy", { pattern: p, seed: 3 }), 4), on = (ex.nails ?? []).map((o, i) => (o?.pattern === p ? i : -1)).filter((i) => i >= 0);
    if (on.length > 2 || (on.length === 2 && Math.abs(on[0] - on[1]) < 2) || ALL_NAIL_PATTERNS.has(p)) bad.push(`${p} in lặp: ${on}`);
  }
  const pc = expandSet(LOOK(["#3e1530", "#f8fafc", "#c0c0c0"], "cateye", { pattern: "polka" }), 4);
  if (!pc.nails || pc.nails.some((o) => !o?.art || o.pattern)) bad.push("chấm bi mắt mèo phải đủ 4 móng");
  // không đụng hoạ tiết phủ mọi móng / sơn trơn / mix màu / đã có nails
  for (const p of ["french", "ombre", "solid", "mixmatch", "jelly"]) if (expandSet(LOOK(["#111111"], "glossy", { pattern: p }), 4).nails) bad.push(`${p} bị chia vai`);
  const own = LOOK(["#111111"], "glossy", { pattern: "ghost", nails: [{ pattern: "solid" }] });
  if (expandSet(own, 4) !== own) bad.push("nails tự ghép bị ghi đè");
  // bộ chủ đề: 4 móng 4 kiểu khác nhau, mọi màu nằm trong bảng màu (+ màu chủ đề), ổn định theo hạt giống
  const PAL = ["#151314", "#c4541f", "#c0c0c0"];
  for (const th of THEME_SETS) for (const seed of [60, 61, 63, 64]) {
    const ex = expandSet(LOOK(PAL, "glossy", { pattern: th, seed }), 4), ns = ex.nails ?? [];
    const keys = ns.map((o) => JSON.stringify([o?.pattern, o?.colors, o?.pick, o?.finish]));
    const cols = new Set(ns.flatMap((o) => o?.colors ?? []).map((c) => c.toLowerCase()));
    if (ns.length !== 4 || new Set(keys).size !== 4 || ns.some((o) => !o?.role || !o.pattern) || [...cols].some((c) => !PAL.includes(c) && c !== "#b3122e")) bad.push(`${th}/${seed}: ${keys.join(" ")}`);
    if (JSON.stringify(ex) !== JSON.stringify(expandSet(LOOK(PAL, "glossy", { pattern: th, seed }), 4))) bad.push(`${th}: không ổn định`);
  }
  // vẽ thật bộ chủ đề trên ảnh: cả 4 móng đổi khác sơn trơn màu nền
  const pi = imgs["pink.jpg"], ps = segsOf["pink.jpg"];
  const lumD = (a: Img, b: Img, sg: NailSeg) => { let n = 0, d = 0; for (let k = 0; k < sg.alpha.length; k++) { if (sg.alpha[k] < 0.99) continue; n++; const x = sg.x0 + (k % sg.w), y = sg.y0 + Math.floor(k / sg.w); if (Math.abs(lumaAt(a, x, y) - lumaAt(b, x, y)) > 25) d++; } return d / n; };
  for (const th of THEME_SETS) {
    const out = renderLook(pi, ps, LOOK(PAL, "glossy", { pattern: th, seed: 61 })), ref = renderLook(pi, ps, LOOK([PAL[0]], "glossy"));
    const each = ps.map((sg) => lumD(out, ref, sg));
    if (each.filter((v) => v < 0.004).length > 1) bad.push(`${th} vẽ: ${each.map(r2).join("/")}`);
  }
  ok("E28", `Bộ phối hero / echo / thread / quiet: 4 móng (trỏ echo · áp út hero · út thread), 5 móng (hero 3 · echo 1), ≤ 3 móng hero giữa; kho mẫu chỉ định ngón; ngón út (nhỏ nhất hw × L) luôn cuối; echo bỏ hạt to / 2 bản nhỏ / 1 viên lẻ đọc được; 25 hoạ tiết vẽ / charm × 6 hạt giống: echo không phải bản sao hero, thread không trơn; cherry echo French đỏ theo bảng màu; in lặp ≤ 2 móng không kề; chấm bi mắt mèo đủ 4 móng; ${THEME_SETS.length} bộ chủ đề mỗi móng 1 kiểu cùng bảng màu`, !bad.length, bad.join(" | "));
}

// ---------------- 7c. dáng móng ĐẮP nhọn + sơn THẠCH trong
{
  // độ "gai": bề ngang theo dọc móng (mỗi 0.04), sau chỗ rộng nhất — chỗ gãy khúc lồi lớn nhất / bề ngang lớn nhất.
  // Đo ở phần đắp NGẮN (×1.25 — dễ ra gai nhất). Bản cũ: đầu móng thật tròn giữ nguyên + mũi nhọn mọc ra = gai hoa
  // hồng (TB 0.06, 6/20 móng > 0.09)
  const thorn = (seg: NailSeg) => {
    const B = 0.04, bins = new Map<number, number>();
    for (let k = 0; k < seg.alpha.length; k++) if (seg.alpha[k] >= 0.5) { const b = Math.floor(seg.along[k] / B); bins.set(b, (bins.get(b) ?? 0) + 1); }
    const ks = [...bins.keys()].sort((a, b) => a - b), w0 = ks.map((k) => bins.get(k)!);
    // làm mượt 3 ô (số hàng điểm ảnh rơi vào mỗi ô lệch nhau → răng cưa giả)
    const w = w0.map((v, i) => (w0[Math.max(0, i - 1)] + v + w0[Math.min(w0.length - 1, i + 1)]) / 3), mx = Math.max(...w), im = w.indexOf(mx);
    let worst = 0;
    for (let i = Math.max(im, 2); i < w.length - 2; i++) if (ks[i] * B > 0.85) worst = Math.max(worst, (w[i - 1] + w[i + 1] - 2 * w[i]) / mx);
    return worst;
  };
  const th = FIXTURES.flatMap((fx) => fx.marks.map((m) => thorn(segmentNail(imgs[fx.file], mark(m), { lengthFactor: 1.25, shape: "stiletto" }))));
  const spiky = th.filter((v) => v > 0.09).length;
  ok("E26", `Móng đắp nhọn (stiletto): 2 cạnh thon đều từ thành móng tới đỉnh như thợ dũa — không phải đầu móng tròn + gai nhọn mọc ra (độ gãy khúc TB ${Math.round(avg(th) * 1000) / 1000} ≤ 0.035 · ${spiky}/20 móng > 0.09, ≤ 3)`,
    avg(th) <= 0.035 && spiky <= 3, th.map(r2).join(" "));

  // THẠCH: gel trong → thấy móng thật (đầu móng trắng đục sáng hơn hẳn sơn đặc), móng cũ sơn đen KHÔNG lộ qua
  const jBad: string[] = [];
  for (const fx of FIXTURES) {
    const im = imgs[fx.file], segs = segsOf[fx.file];
    const zone = (out: Img, a0: number, a1: number) => { let sum = 0, n = 0; for (const seg of segs) for (let k = 0; k < seg.alpha.length; k++) { if (seg.alpha[k] < 1 || Math.abs(seg.across[k]) > 0.5 || seg.along[k] < a0 || seg.along[k] > a1) continue; sum += lumaAt(out, seg.x0 + (k % seg.w), seg.y0 + Math.floor(k / seg.w)); n++; } return sum / Math.max(1, n); };
    const J = renderLook(im, segs, LOOK(["#c2185b"], "glossy", { pattern: "jelly" })), S = renderLook(im, segs, LOOK(["#c2185b"], "glossy"));
    const tipGain = (zone(J, 0.86, 0.95) - zone(J, 0.4, 0.6)) - (zone(S, 0.86, 0.95) - zone(S, 0.4, 0.6)), lift = zone(J, 0.3, 0.7) / zone(S, 0.3, 0.7);
    if (tipGain < 8 || lift < 1.15) jBad.push(`${fx.file}: đầu móng +${r2(tipGain)} · sáng ×${r2(lift)}`);
  }
  ok("E27", "Sơn thạch (jelly) trong thật: đầu móng (mép tự do) sáng hơn sơn đặc ≥ 8, cả móng sáng hơn ≥ 1.15× (thấy giường móng hồng bên dưới) — cả trên tay đang sơn ĐEN (màu cũ không lộ)", !jBad.length, jBad.join(" | "));
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
