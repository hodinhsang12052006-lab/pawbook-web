// Kiểm thử ẢNH MẪU DO MÁY PAWNAIL TỰ VẼ (lib/designRender) cho kho "Mẫu nail": mọi hoạ tiết bộ máy vẽ được ra ảnh JPEG
// vuông 1024px trên tay mẫu thật; bộ đắp (Gel-X / bột) chỉ vẽ trên tay móng dài sẵn; "Vẽ lại" ra ảnh khác; hoạ tiết
// hình (ma, bí ngô…) báo chưa vẽ được (để đường cũ lo); ảnh thật sự khác nhau theo màu / hoạ tiết; móng vẽ thẳng ở
// 1024 (không phóng sau khi vẽ), khung chặt (móng ≥ 50% bề ngang ô, không cắt đầu móng đắp); vai trò ngón (áp út / trỏ).
//   npx tsx scripts/qa/design_render_unit.mts
import { createRequire } from "node:module";
import { renderDesignImage, prepareDesign, canRenderPattern, HANDS, OUT_SIZE, pickHand, spreadVariant } from "../../lib/designRender";
import { renderLook } from "../../lib/tryon/engine";
import { PROCEDURAL } from "../../lib/tryon/patterns";
import { PATTERN_IDS } from "../../lib/designEngine";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + detail}`); };
const D = (id: string, pattern: string, extra: Partial<{ palette: string[]; shape: string; finish: string; skills: string[] }> = {}) => ({ id, pattern, palette: ["#7f1d1d", "#ffffff", "#d4af37"], shape: "almond", finish: "glossy", skills: ["Design"], ...extra });

const t0 = performance.now();
const bad: string[] = [];
for (const p of PROCEDURAL) {
  try {
    const r = await renderDesignImage(D(`u-${p}`, p));
    const meta = await sharp(Buffer.from(r.base64, "base64")).metadata();
    if (meta.format !== "jpeg" || meta.width !== 1024 || meta.height !== 1024) bad.push(`${p}: ${meta.format} ${meta.width}×${meta.height}`);
  } catch (e) { bad.push(`${p}: ${(e as Error).message}`); }
}
const per = (performance.now() - t0) / PROCEDURAL.size;
ok("R1", `Mọi hoạ tiết bộ máy tự vẽ (${PROCEDURAL.size}) ra ảnh JPEG vuông 1024px trên tay mẫu thật (TB ${Math.round(per)}ms / ảnh)`, !bad.length && per < 2500, bad.join(" | "));

const longHands = new Set(HANDS.filter((h) => h.long).map((h) => h.file));
const extHands = await Promise.all(Array.from({ length: 12 }, (_, i) => renderDesignImage(D(`ext-${i}`, "solid", { skills: ["Gel-X", "Design"], shape: "coffin" })).then((r) => r.hand)));
ok("R2", "Bộ đắp (Gel-X / bột) chỉ vẽ trên tay có móng dài sẵn (đắp dài trên móng ngắn hướng lên nền nhìn như giấy dán)", extHands.every((f) => longHands.has(f)), extHands.join(","));

const a = await renderDesignImage(D("same", "chromefrench")), b = await renderDesignImage(D("same", "chromefrench")), c = await renderDesignImage(D("same", "chromefrench"), 1);
ok("R3", "Cùng mẫu → cùng ảnh (ổn định); \"Vẽ lại\" (biến thể khác) → ảnh khác", a.base64 === b.base64 && a.base64 !== c.base64);

let threw = false;
try { await renderDesignImage(D("x", "custom-svg")); } catch { threw = true; }
ok("R4", "MỌI hoạ tiết trong máy tạo mẫu (kể cả Halloween / Giáng sinh) bộ máy tự vẽ được; hoạ tiết lạ chưa có → báo lỗi để đường AI lo",
  threw && !canRenderPattern("custom-svg") && PATTERN_IDS.every(canRenderPattern), PATTERN_IDS.filter((p) => !canRenderPattern(p)).join(","));

// ảnh khác nhau thật theo màu (đỏ rượu vs nude cùng tay) — đo trung bình kênh đỏ / xanh dương vùng giữa ảnh
const stat = async (b64: string) => { const { data } = await sharp(Buffer.from(b64, "base64")).extract({ left: 256, top: 256, width: 512, height: 512 }).raw().toBuffer({ resolveWithObject: true }); let r = 0, bl = 0; for (let i = 0; i < data.length; i += 3) { r += data[i]; bl += data[i + 2]; } return { r: r / (data.length / 3), b: bl / (data.length / 3) }; };
const wine = await stat((await renderDesignImage(D("col", "solid", { palette: ["#7f1d1d"] }))).base64), nude = await stat((await renderDesignImage(D("col", "solid", { palette: ["#e8c4a8"] }))).base64);
ok("R5", "Đổi màu mẫu → ảnh đổi màu thật (đỏ rượu tối hơn rõ nude trên cùng tay)", nude.r - wine.r > 8 && nude.b - wine.b > 8, JSON.stringify({ wine, nude }));

// tay mẫu đa dạng: 6 mẫu 1 lượt (như cron) → 6 bàn tay khác nhau; ≥ 10 tay mẫu (5 tay cũ lặp bố cục liên tục)
const batch = Array.from({ length: 6 }, (_, i) => D(`batch-${i}`, ["solid", "french", "leopard", "marble", "aura", "stars"][i]));
const usedH = new Set<string>(), picked = batch.map((d) => { const v = spreadVariant(d, usedH); const f = pickHand(d, v).file; usedH.add(f); return f; });
ok("R6", `Kho mẫu không lặp bàn tay: ${HANDS.length} tay mẫu (≥ 10, ${HANDS.filter((h) => h.long).length} tay móng dài cho bộ đắp); 1 lượt 6 mẫu dùng ${new Set(picked).size}/6 tay khác nhau`,
  HANDS.length >= 10 && HANDS.filter((h) => h.long).length >= 4 && new Set(picked).size === 6, picked.join(","));

// sơn thạch (trong) không vẽ trên tay mà móng gốc có hoạ tiết (lá / sao lộ mờ qua lớp thạch)
const sheerHands = new Set(Array.from({ length: 60 }, (_, i) => pickHand(D(`sheer-${i}`, "jelly", { palette: ["#e75480", "#ffffff", "#c0c0c0"] })).file));
ok("R7", "Sơn thạch trong chỉ vẽ trên tay mẫu có móng gốc trơn (không lộ hoạ tiết cũ)", [...sheerHands].every((f) => !HANDS.find((h) => h.file === f)!.deco), [...sheerHands].join(","));

// bộ đắp móng nhọn vẽ được trên MỌI tay móng dài (tay mới thêm vào có khuôn móng khớp, không lỗi)
const longFiles = HANDS.filter((h) => h.long).map((h) => h.file), extOk: string[] = [];
for (const file of longFiles) {
  let id = "";
  for (let k = 0; k < 800 && !id; k++) { const d = D(`len-${k}`, "solid", { skills: ["Gel-X"], shape: "stiletto" }); if (pickHand(d).file === file) id = d.id; }
  if (id) { const r = await renderDesignImage(D(id, "solid", { skills: ["Gel-X"], shape: "stiletto" })); if (r.hand === file) extOk.push(file); }
}
ok("R8", `Bộ đắp móng nhọn vẽ được trên mọi tay móng dài (${extOk.length}/${longFiles.length})`, extOk.length === longFiles.length, longFiles.filter((f) => !extOk.includes(f)).join(","));

// 1 mã mẫu rơi đúng vào tay `file`
const idFor = (file: string, mk: (id: string) => ReturnType<typeof D>) => { for (let k = 0; k < 4000; k++) if (pickHand(mk(`f-${k}`)).file === file) return `f-${k}`; return ""; };

// KHUNG CHẶT: khung cũ (lề 0.42 quanh điểm chạm) để cả bàn tay + áo len → 4 móng chỉ 7–14% diện tích ô, hoạ tiết thành
// chấm li ti trong kho mẫu 2 cột trên điện thoại. Mọi tay (sơn gel + mọi dáng đắp trên tay móng dài): bộ móng ≥ 50% bề
// ngang ô, và đầu móng (kể cả phần đắp dài nhất) KHÔNG BAO GIỜ bị cắt / chạm mép ô (cách mép ≥ 2%).
const frameBad: string[] = [];
let minFill = 1, minPad = OUT_SIZE, minHw = Infinity, maxLf = 0, minLf = 9;
for (const h of HANDS) for (const shape of h.long ? ["gel", "almond", "coffin", "square", "oval", "stiletto"] : ["gel"]) {
  const mk = (id: string) => D(id, "solid", shape === "gel" ? {} : { skills: ["Gel-X"], shape });
  const id = idFor(h.file, mk);
  if (!id) { frameBad.push(`${h.file}/${shape}: không có mã`); continue; }
  const p = await prepareDesign(mk(id));
  let x0 = OUT_SIZE, x1 = -1, ax0 = OUT_SIZE, ax1 = -1, ay0 = OUT_SIZE, ay1 = -1;
  for (const s of p.segs) {
    minHw = Math.min(minHw, s.hw);
    for (let k = 0; k < s.alpha.length; k++) {
      if (s.alpha[k] <= 0.02) continue;
      const x = s.x0 + (k % s.w), y = s.y0 + Math.floor(k / s.w);
      ax0 = Math.min(ax0, x); ax1 = Math.max(ax1, x); ay0 = Math.min(ay0, y); ay1 = Math.max(ay1, y);
      if (s.alpha[k] > 0.5) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    }
  }
  const fill = (x1 - x0 + 1) / OUT_SIZE, pad = Math.min(ax0, ay0, OUT_SIZE - 1 - ax1, OUT_SIZE - 1 - ay1);
  minFill = Math.min(minFill, fill); minPad = Math.min(minPad, pad);
  if (shape !== "gel") { maxLf = Math.max(maxLf, p.opts.lengthFactor); minLf = Math.min(minLf, p.opts.lengthFactor); }
  if (fill < 0.5 || pad < 0.02 * OUT_SIZE) frameBad.push(`${h.file}/${shape}: móng ${Math.round(fill * 100)}% bề ngang, cách mép ${pad}px`);
  // vùng riêng của tay (né móng / ngón cái lấp ló ở mép ảnh gốc): khung cắt nằm gọn trong đó với mọi dáng đắp
  if (h.box && (p.box.x < h.box[0] || p.box.y < h.box[1] || p.box.x + p.box.size > h.box[0] + h.box[2] || p.box.y + p.box.size > h.box[1] + h.box[2])) frameBad.push(`${h.file}/${shape}: khung ${JSON.stringify(p.box)} lọt ra ngoài vùng ${h.box}`);
}
ok("R9", `Khung chặt: bộ móng ≥ 50% bề ngang ô trên mọi tay + dáng đắp (thấp nhất ${Math.round(minFill * 100)}%), đầu móng đắp không bị cắt (cách mép ≥ ${minPad}px), không lộ móng lấp ló ngoài vùng riêng của tay`, !frameBad.length, frameBad.join(" | "));
ok("R10", `Đắp dài có trần ×1.45 (phần đắp phẳng dài hơn nhìn như giấy dán): hệ số đắp ${minLf.toFixed(2)}–${maxLf.toFixed(2)}`, maxLf <= 1.45 && minLf >= 1.08, `${minLf}–${maxLf}`);

// VẼ Ở ĐÚNG CỠ ẢNH RA: ảnh tay cắt + phóng lên 1024 TRƯỚC, móng vẽ thẳng trên đó (móng to: nửa bề ngang ≥ 40px), và JPEG
// đăng lên = ĐÚNG ảnh bộ máy vẽ ra, chỉ lật ngang + nén (nén lại đúng ảnh vẽ ra cho ra đúng từng byte) — không phóng /
// thu / làm mịn gì sau khi vẽ (đường cũ vẽ trên ảnh gốc rồi phóng cả ảnh ×1.15–1.6 → nét mảnh, hạt nhũ nhoè).
const dg = D("res-1", "french", { finish: "glitter", palette: ["#9f1239", "#ffffff", "#d4af37"] });
const pg = await prepareDesign(dg);
const drawn = renderLook(pg.img, pg.segs, pg.look);
const pubB64 = (await renderDesignImage(dg)).base64;
const pubMeta = await sharp(Buffer.from(pubB64, "base64")).metadata();
let enc = sharp(Buffer.from(drawn.data.buffer, drawn.data.byteOffset, drawn.data.length), { raw: { width: drawn.w, height: drawn.h, channels: 4 } });
if (pg.flop) enc = enc.flop();
const sameBytes = (await enc.removeAlpha().jpeg({ quality: 86, mozjpeg: true }).toBuffer()).toString("base64") === pubB64;
ok("R11", `Vẽ thẳng ở ${OUT_SIZE}px: ảnh tay phóng ×${pg.scale.toFixed(2)} TRƯỚC khi vẽ (móng nửa bề ngang ≥ ${Math.round(minHw)}px), ảnh đăng = đúng ảnh vẽ ra (không phóng sau khi vẽ)`,
  pg.img.w === OUT_SIZE && pg.img.h === OUT_SIZE && drawn.w === OUT_SIZE && drawn.h === OUT_SIZE && pubMeta.width === OUT_SIZE && pg.scale >= 1 && minHw >= 40 && sameBytes,
  JSON.stringify({ w: pg.img.w, out: drawn.w, pub: pubMeta.width, scale: pg.scale, minHw, sameBytes }));

// VAI TRÒ NGÓN: móng chính (hero) = ngón ÁP ÚT, móng nhắc lại (echo) = ngón TRỎ — theo ngón thật, không theo thứ tự trong
// ảnh (p067 / ombre / p027 / p063 có ngón út ở đầu 0). Kiểm: hero / echo không kề nhau; ngón út (đầu bàn tay kề hero) hẹp
// hơn móng hero; up khớp chiều điểm chạm; look.hero / look.echo được đặt cho bộ máy bố cục.
const roleBad: string[] = [];
for (const h of HANDS) {
  const n = h.marks.length;
  if (!(h.hero >= 0 && h.hero < n && h.echo >= 0 && h.echo < n && Math.abs(h.hero - h.echo) >= 2)) roleBad.push(`${h.file}: hero ${h.hero} / echo ${h.echo}`);
  if (h.up !== h.marks.every(([b, t]) => t[1] < b[1])) roleBad.push(`${h.file}: up=${h.up} ngược chiều điểm chạm`);
  const pinky = h.hero === 1 ? 0 : h.hero === n - 2 ? n - 1 : -1;
  const p = await prepareDesign(D(idFor(h.file, (id) => D(id, "solid")), "solid"));
  if (pinky < 0 || p.segs[pinky].hw >= p.segs[h.hero].hw) roleBad.push(`${h.file}: móng hero ${h.hero} không kề ngón út nhỏ hơn`);
  const lk = p.look as typeof p.look & { hero?: number; echo?: number };
  if (lk.hero !== h.hero || lk.echo !== h.echo) roleBad.push(`${h.file}: look.hero/echo chưa đặt`);
}
ok("R12", `Mọi tay mẫu có móng chính = ngón áp út, móng nhắc lại = ngón trỏ (không kề nhau), chiều đầu ngón (up) đúng; bộ máy nhận look.hero / look.echo`, !roleBad.length, roleBad.join(" | "));

// hoạ tiết chảy giọt: chỉ trên tay đầu ngón hướng LÊN (tay chúc xuống thì dải nguồn giọt nằm ở chân móng — như vết bẩn)
const dripPicked = new Set<string>();
let dripDown = "";
for (const pat of ["slimedrip", "blooddrip", "chocodip"]) for (let i = 0; i < 60; i++) for (const ext of [false, true]) {
  const hd = pickHand(D(`drip-${pat}-${i}`, pat, ext ? { skills: ["Gel-X"] } : {}));
  dripPicked.add(hd.file);
  if (!hd.up) dripDown = `${pat} → ${hd.file}`;
}
ok("R13", `Hoạ tiết chảy giọt (slimedrip / blooddrip / chocodip) chỉ vẽ trên tay đầu ngón hướng lên (${[...dripPicked].join(", ")})`, !dripDown && dripPicked.size >= 4, dripDown);

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
