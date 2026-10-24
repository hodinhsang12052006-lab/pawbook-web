// Công cụ soi (không phải test): TỰ DÒ MÓNG trên cả thư mục ảnh → vẽ điểm gốc (trắng) → đầu (vàng) + viền khuôn đã
// khớp (hồng: nhận; xám: bỏ) → tờ so sánh. Ảnh có đáp án (scripts/qa/tryon_fixtures.ts) in thêm IoU từng móng.
//   npx tsx scripts/qa/tryon_auto_explore.mts <thư-mục-ảnh> <thư-mục-ra>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { rasterNail, type Img } from "../../lib/tryon/engine";
import { autoNails } from "../../lib/tryon/session";
import { FIXTURES, inPoly } from "./tryon_fixtures";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const [dir, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const tiles: Buffer[] = [];
for (const f of fs.readdirSync(dir).filter((x) => /\.jpe?g$/i.test(x)).sort()) {
  const { data, info } = await sharp(path.join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img: Img = { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
  const t = performance.now();
  const res = autoNails(img);
  const ms = Math.round(performance.now() - t);
  const fx = FIXTURES.find((x) => x.file === f);
  const svg: string[] = [];
  const ious: string[] = [];
  for (const n of res.all) {
    const seg = rasterNail(img, n.model);
    const pts = seg.outline.map((p) => `${p.x},${p.y}`).join(" ");
    svg.push(`<polygon points="${pts}" fill="none" stroke="${n.ok ? "#ff3ea5" : "#9ca3af"}" stroke-width="3"/>`);
    svg.push(`<line x1="${n.mark.base.x}" y1="${n.mark.base.y}" x2="${n.mark.tip.x}" y2="${n.mark.tip.y}" stroke="#22d3ee" stroke-width="2"/><circle cx="${n.mark.base.x}" cy="${n.mark.base.y}" r="5" fill="#fff"/><circle cx="${n.mark.tip.x}" cy="${n.mark.tip.y}" r="5" fill="#facc15"/>`);
    if (fx && n.ok) {
      let best = 0;
      for (const poly of fx.outlines) {
        let i = 0, u = 0;
        const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
        const X0 = Math.min(seg.x0, ...xs), X1 = Math.max(seg.x0 + seg.w, ...xs), Y0 = Math.min(seg.y0, ...ys), Y1 = Math.max(seg.y0 + seg.h, ...ys);
        for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
          const lx = x - seg.x0, ly = y - seg.y0;
          const a = lx >= 0 && ly >= 0 && lx < seg.w && ly < seg.h && seg.alpha[ly * seg.w + lx] >= 0.5, g = inPoly(x, y, poly);
          if (a && g) i++; if (a || g) u++;
        }
        best = Math.max(best, u ? i / u : 0);
      }
      ious.push(best.toFixed(2));
    }
  }
  console.log(`${f}: ${res.nails.length} móng nhận / ${res.all.length} ứng viên · ${ms}ms${fx ? ` · IoU ${ious.join(" ")} (đáp án ${fx.outlines.length} móng)` : ""}`);
  const W = info.width, H = info.height;
  const over = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg.join("")}<rect width="${W}" height="56" fill="rgba(0,0,0,.6)"/><text x="12" y="40" font-size="34" fill="#fff">${f} · ${res.nails.length} móng · ${ms}ms</text></svg>`);
  const full = await sharp(path.join(dir, f)).composite([{ input: over }]).png().toBuffer();
  tiles.push(await sharp(full).resize(420, 420, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer());
}
const cols = 4;
for (let s = 0; s < tiles.length; s += 12) {
  const part = tiles.slice(s, s + 12), rows = Math.ceil(part.length / cols);
  await sharp({ create: { width: cols * 424, height: rows * 424, channels: 3, background: "#111" } })
    .composite(part.map((input, i) => ({ input, left: (i % cols) * 424, top: Math.floor(i / cols) * 424 })))
    .jpeg({ quality: 85 }).toFile(path.join(out, `auto_${s / 12}.jpg`));
}
