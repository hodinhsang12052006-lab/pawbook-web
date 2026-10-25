// Công cụ soi (không phải test): 1 móng phóng to ×3 — ảnh gốc cạnh các mẫu, để soi chi tiết nhỏ (vệt bóng, mép,
// chân móng, chất sơn) như mắt thợ nhìn.
//   npx tsx scripts/qa/tryon_closeup.mts <ra.jpg> <ảnh> <số móng> <mẫu JSON…>
import path from "node:path";
import { createRequire } from "node:module";
import { segmentNail, renderLook, type Img, type LookColors } from "../../lib/tryon/engine";
import { FIXTURES } from "./tryon_fixtures";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const [out, file, nStr, ...lookArgs] = process.argv.slice(2);
const fx = FIXTURES.find((f) => f.file === file)!;
const { data, info } = await sharp(path.resolve("scripts/qa/fixtures", file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const img: Img = { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
const segs = fx.marks.map(([b, t]) => segmentNail(img, { base: { x: b[0], y: b[1] }, tip: { x: t[0], y: t[1] } }));
segs.forEach((s, i) => { s.accent = segs.length >= 4 ? i === 1 || i === segs.length - 2 : i === 1; });
const seg = segs[+nStr];
const pad = 14, L = Math.max(0, seg.x0 - pad), T = Math.max(0, seg.y0 - pad), W = Math.min(img.w - L, seg.w + 2 * pad), H = Math.min(img.h - T, seg.h + 2 * pad), S = 3;
const looks: LookColors[] = lookArgs.map((a) => JSON.parse(a));
const tile = (im: Img) => sharp(Buffer.from(im.data.buffer, im.data.byteOffset, im.data.length), { raw: { width: im.w, height: im.h, channels: 4 } }).extract({ left: L, top: T, width: W, height: H }).resize(W * S, H * S, { kernel: "lanczos3" }).png().toBuffer();
const tiles = [await tile(img), ...(await Promise.all(looks.map((lk) => tile(renderLook(img, segs, lk)))))];
await sharp({ create: { width: tiles.length * (W * S + 6), height: H * S, channels: 3, background: "#111" } }).composite(tiles.map((input, i) => ({ input, left: i * (W * S + 6), top: 0 }))).jpeg({ quality: 92 }).toFile(out);
console.log("ok");
