// Công cụ soi (không phải test): viền khuôn (xanh) so với đáp án vẽ tay (hồng), phóng to 5×.
//   npx tsx scripts/qa/tryon_gtview.mts <ảnh.jpg> <số móng 0–3>   → $TEMP/tryon/gt.jpg
import path from "node:path";
import { createRequire } from "node:module";
import { segmentNail, type Img } from "../../lib/tryon/engine";
import { FIXTURES } from "./tryon_fixtures";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const [file, nStr] = process.argv.slice(2); const n = +nStr;
const fx = FIXTURES.find((f) => f.file === file)!;
const { data, info } = await sharp(path.resolve("scripts/qa/fixtures", file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const img: Img = { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
const [b, t] = fx.marks[n];
const seg = segmentNail(img, { base: { x: b[0], y: b[1] }, tip: { x: t[0], y: t[1] } });
const xs = fx.outlines[n].map((p) => p[0]), ys = fx.outlines[n].map((p) => p[1]);
const L = Math.min(...xs) - 25, T = Math.min(...ys) - 25, W = Math.max(...xs) - L + 25, H = Math.max(...ys) - T + 25, S = 5;
const svgMask: string[] = [];
for (let yy = 0; yy < seg.h; yy++) for (let xx = 0; xx < seg.w; xx++) {
  const a = seg.alpha[yy * seg.w + xx]; if (a < 0.5) continue;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = xx + dx, Y = yy + dy; return X < 0 || Y < 0 || X >= seg.w || Y >= seg.h || seg.alpha[Y * seg.w + X] < 0.5; });
  if (nb) svgMask.push(`<rect x="${(seg.x0 + xx - L) * S}" y="${(seg.y0 + yy - T) * S}" width="${S}" height="${S}" fill="#00ff66"/>`);
}
const poly = fx.outlines[n].map(([x, y]) => `${(x - L) * S + S / 2},${(y - T) * S + S / 2}`).join(" ");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${svgMask.join("")}<polygon points="${poly}" fill="none" stroke="#ff00cc" stroke-width="3"/></svg>`;
const base = await sharp(path.resolve("scripts/qa/fixtures", file)).extract({ left: L, top: T, width: W, height: H }).resize(W * S, H * S, { kernel: "nearest" }).toBuffer();
await sharp(base).composite([{ input: Buffer.from(svg) }]).resize(Math.min(900, W * S)).jpeg().toFile(process.env.TEMP + "/tryon/gt.jpg");
console.log("ok");
