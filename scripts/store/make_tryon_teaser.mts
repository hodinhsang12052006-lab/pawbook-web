// Ảnh "trước / sau" cho thẻ Thử mẫu trên trang chủ của khách: ảnh tay mẫu (ảnh AI của PawNail, scripts/qa/fixtures)
// → bộ máy Thử mẫu vẽ velvet đỏ rượu (đổi màu rõ nhất, có ánh nhung) lên đúng móng thật. Chạy lại khi bộ máy đổi:
//   npx tsx scripts/store/make_tryon_teaser.mts
import path from "node:path";
import { createRequire } from "node:module";
import { segmentNail, renderLook, type Img } from "../../lib/tryon/engine";
import { FIXTURES } from "../qa/tryon_fixtures";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const fx = FIXTURES.find((f) => f.file === "pink.jpg")!;
const { data, info } = await sharp(path.resolve("scripts/qa/fixtures", fx.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const img: Img = { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
const segs = fx.marks.map(([b, t]) => segmentNail(img, { base: { x: b[0], y: b[1] }, tip: { x: t[0], y: t[1] } }));
segs.forEach((s, i) => { s.accent = i === 1 || i === 2; });
const after = renderLook(img, segs, { colors: ["#7f1d1d", "#ffffff", "#d4af37"], finish: "cateye", pattern: "velvet", seed: 3 });
const crop = { left: 230, top: 240, width: 520, height: 400 };
const out = async (im: Img, file: string) => sharp(Buffer.from(im.data.buffer, im.data.byteOffset, im.data.length), { raw: { width: im.w, height: im.h, channels: 4 } }).extract(crop).resize(416).jpeg({ quality: 80, mozjpeg: true }).toFile(path.resolve("public/tryon", file));
await out(img, "teaser-before.jpg");
await out(after, "teaser-after.jpg");
console.log("ok");
