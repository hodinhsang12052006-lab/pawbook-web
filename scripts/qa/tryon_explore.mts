// Công cụ soi (không phải test): xanh = móng đã phủ · VÀNG = móng bị sót · hồng = tô lem ra ngoài móng.
//   npx tsx scripts/qa/tryon_explore.mts <thư-mục-ra>
import path from "node:path";
import { createRequire } from "node:module";
import { segmentNail, type Img } from "../../lib/tryon/engine";
import { FIXTURES, inPoly, polyDist } from "./tryon_fixtures";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const OUT = process.argv[2] || ".";

async function load(file: string): Promise<Img> {
  const { data, info } = await sharp(path.resolve("scripts/qa/fixtures", file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
}
for (const fx of FIXTURES) {
  const img = await load(fx.file);
  const viz = new Uint8ClampedArray(img.data);
  for (const [n, [bp, tp]] of fx.marks.entries()) {
    const seg = segmentNail(img, { base: { x: bp[0], y: bp[1] }, tip: { x: tp[0], y: tp[1] } });
    const poly = fx.outlines[n];
    let gt = 0, cov = 0, spill = 0;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      const g = inPoly(x, y, poly);
      const d = polyDist(x, y, poly); // khoảng cách tới đường viền đáp án
      const lx = x - seg.x0, ly = y - seg.y0;
      const a = lx >= 0 && ly >= 0 && lx < seg.w && ly < seg.h ? seg.alpha[ly * seg.w + lx] : 0;
      if (g && d > 3) { gt++; if (a >= 0.5) { cov++; viz[i] = 40; viz[i + 1] = 220; viz[i + 2] = 90; } else { viz[i] = 255; viz[i + 1] = 230; viz[i + 2] = 0; } }
      else if (!g && d > 4 && a >= 0.5) { spill++; viz[i] = 255; viz[i + 1] = 40; viz[i + 2] = 170; }
    }
    console.log(`${fx.file} #${n + 1}: byColor=${seg.byColor} L=${seg.L.toFixed(0)} hw=${seg.hw.toFixed(1)} off=${seg.offset.toFixed(1)} ts=${seg.fit.ts.toFixed(2)} tc=${seg.fit.tc.toFixed(2)} bs=${seg.fit.bs.toFixed(2)} rt=${seg.fit.rt.toFixed(2)} rb=${seg.fit.rb.toFixed(2)} q=${seg.quality.inside.toFixed(2)}/${seg.quality.ring.toFixed(2)} | phủ ${(100 * cov / gt).toFixed(1)}% · lem ${(100 * spill / gt).toFixed(1)}%`);
  }
  await sharp(Buffer.from(viz.buffer), { raw: { width: img.w, height: img.h, channels: 4 } }).jpeg().toFile(path.join(OUT, `seg_${fx.file}`));
}
