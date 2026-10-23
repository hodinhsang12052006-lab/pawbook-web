// Công cụ soi ảnh thành phẩm (không phải test): vẽ 8 mẫu (màu + hiệu ứng) lên 5 ảnh tay → tờ so sánh.
//   npx tsx scripts/qa/tryon_render.mts <thư-mục-ra>
import path from "node:path";
import { createRequire } from "node:module";
import { segmentNail, renderLook, type Img, type LookColors } from "../../lib/tryon/engine";
import { FIXTURES } from "./tryon_fixtures";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const OUT = process.argv[2] || ".";

export const LOOKS: (LookColors & { name: string })[] = [
  { name: "Đen bóng", colors: ["#141416"], finish: "glossy", pattern: "solid", seed: 1 },
  { name: "Hồng nude", colors: ["#e7b7b4"], finish: "glossy", pattern: "solid", seed: 2 },
  { name: "Đỏ rượu vang", colors: ["#6e1426"], finish: "glossy", pattern: "solid", seed: 3 },
  { name: "Trắng sữa", colors: ["#f4efe6"], finish: "glossy", pattern: "solid", seed: 4 },
  { name: "Chrome bạc", colors: ["#b8bcc4"], finish: "chrome", pattern: "solid", seed: 5 },
  { name: "Mắt mèo tím", colors: ["#2a1240", "#c4a1ff"], finish: "cateye", pattern: "solid", seed: 6 },
  { name: "Xanh rêu nhám", colors: ["#56633a"], finish: "matte", pattern: "solid", seed: 7 },
  { name: "Nhũ vàng champagne", colors: ["#c9a86a"], finish: "glitter", pattern: "solid", seed: 8 },
];
const crops: Record<string, [number, number, number, number]> = { "hand.jpg": [200, 250, 500, 260], "pink.jpg": [220, 230, 540, 420], "olive.jpg": [150, 280, 620, 340], "ombre.jpg": [200, 250, 560, 240], "white.jpg": [240, 340, 480, 250] };

async function load(file: string): Promise<Img> {
  const { data, info } = await sharp(path.resolve("scripts/qa/fixtures", file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
}
const toJpg = async (img: Img, c: [number, number, number, number], W: number) =>
  sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), { raw: { width: img.w, height: img.h, channels: 4 } }).extract({ left: c[0], top: c[1], width: c[2], height: c[3] }).resize(W).jpeg({ quality: 90 }).toBuffer();

for (const fx of FIXTURES) {
  const img = await load(fx.file);
  const segs = fx.marks.map(([b, t]) => segmentNail(img, { base: { x: b[0], y: b[1] }, tip: { x: t[0], y: t[1] } }));
  const c = crops[fx.file];
  const W = 480, H = Math.round((c[3] * W) / c[2]);
  const tiles = [await toJpg(img, c, W), ...(await Promise.all(LOOKS.map((lk) => toJpg(renderLook(img, segs, lk), c, W))))];
  const cols = 3, rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * (W + 4), height: rows * (H + 4), channels: 3, background: "#111" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * (W + 4), top: Math.floor(i / cols) * (H + 4) })))
    .jpeg({ quality: 90 }).toFile(path.join(OUT, `render_${fx.file}`));
}
console.log("ok");
