// Đo dài / rộng móng (ratio) và số móng tự dò được trên ảnh tay mẫu của repo — dùng để chỉnh ngưỡng phân loại
// "móng ngắn / vừa / dài" (lib/tryon/profile.ts) và kiểm tra bộ dò móng tự động.
//   npx tsx scripts/qa/tryon_length_probe.mts
import path from "node:path";
import { createRequire } from "node:module";
import { fitNail, type Img } from "../../lib/tryon/engine";
import { autoNails } from "../../lib/tryon/session";
import { profileFromModels } from "../../lib/tryon/profile";
import { FIXTURES } from "./tryon_fixtures";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const load = async (file: string): Promise<Img> => {
  const { data, info } = await sharp(path.resolve("scripts/qa/fixtures", file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
};
const mark = (m: [[number, number], [number, number]]) => ({ base: { x: m[0][0], y: m[0][1] }, tip: { x: m[1][0], y: m[1][1] } });

for (const fx of FIXTURES) {
  const img = await load(fx.file);
  const truth = fx.marks.map((m) => fitNail(img, mark(m)));
  const ratios = truth.map((m) => Math.round(((m.fit.s1 - m.fit.s0) / Math.max(1, 2 * m.fit.hw)) * 100) / 100);
  const prof = profileFromModels(truth);
  const auto = autoNails(img);
  console.log(`${fx.file.padEnd(10)} ${fx.name.padEnd(42)} truth=${fx.marks.length} auto=${auto.nails.length}/${auto.all.length} ratios=${ratios.join(",")} → ${prof?.length} (${prof?.ratio.toFixed(2)})`);
}
