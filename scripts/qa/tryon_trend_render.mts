// Công cụ soi (không phải test): SOI TAY → 10 mẫu gợi ý hợp tay (lib/tryon/advice) + bộ hoạ tiết bộ máy tự vẽ, vẽ lên
// 5 ảnh tay → tờ so sánh có tên mẫu, để soi bằng mắt từng vòng sửa.
//   npx tsx scripts/qa/tryon_trend_render.mts <thư-mục-ra> [salt]
// Soi kỹ: ONLY="velvet|Chrome" (lọc tên mẫu), FX="pink" (lọc ảnh tay), TILE_W=900 (ô to), COLS=2.
import path from "node:path";
import { createRequire } from "node:module";
import { segmentNail, renderLook, fitNail, type Img, type LookColors } from "../../lib/tryon/engine";
import { profileFromModels } from "../../lib/tryon/profile";
import { adviceLooks, profileChips } from "../../lib/tryon/advice";
import { lookColors } from "../../lib/studio";
import { FIXTURES } from "./tryon_fixtures";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const OUT = process.argv[2] || ".", SALT = process.argv[3] || "r1";
const crops: Record<string, [number, number, number, number]> = { "hand.jpg": [200, 250, 500, 260], "pink.jpg": [220, 230, 540, 420], "olive.jpg": [150, 280, 620, 340], "ombre.jpg": [200, 250, 560, 240], "white.jpg": [240, 340, 480, 250] };
const EXTRA: (LookColors & { name: string })[] = [
  { name: "Vân đá trắng – vàng", colors: ["#f8fafc", "#94a3b8", "#d4af37"], finish: "glossy", pattern: "marble", seed: 11 },
  { name: "Ngọc trai hồng sữa", colors: ["#f6d5d0", "#ffffff", "#f5f0e8"], finish: "glossy", pattern: "pearls", seed: 12 },
  { name: "Cụm đá nude", colors: ["#e8c4a8", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "gemcluster", seed: 13 },
  { name: "Chrome French bạc", colors: ["#f6d5d0", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "chromefrench", seed: 14 },
  { name: "French đôi đen", colors: ["#f2c4c4", "#111111", "#d4af37"], finish: "glossy", pattern: "doublefrench", seed: 15 },
  { name: "Đồi mồi", colors: ["#b45309", "#5b3a29", "#d4af37"], finish: "glossy", pattern: "tortoise", seed: 16 },
  { name: "Giọt nước 3D nền hồng thạch", colors: ["#f2c4c4", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "droplets", seed: 17 },
  { name: "Chrome bạc gương", colors: ["#c0c0c0", "#c0c0c0", "#c0c0c0"], finish: "chrome", pattern: "solid", seed: 18 },
  { name: "Line vàng nổi nền trắng sữa", colors: ["#f5f0e8", "#e8c4a8", "#d4af37"], finish: "glossy", pattern: "chromeline", seed: 19 },
  { name: "Đá pha lê nền nude", colors: ["#e8c4a8", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "gems", seed: 20 },
  { name: "Velvet đỏ rượu", colors: ["#7f1d1d", "#ffffff", "#d4af37"], finish: "cateye", pattern: "velvet", seed: 21 },
];
const label = (txt: string, w: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="34"><rect width="${w}" height="34" fill="rgba(0,0,0,.62)"/><text x="10" y="23" font-size="17" font-family="sans-serif" fill="#fff">${txt.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`);
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, "i") : null, FXF = process.env.FX ? new RegExp(process.env.FX, "i") : null;
for (const fx of FIXTURES) {
  if (FXF && !FXF.test(fx.file)) continue;
  const { data, info } = await sharp(path.resolve("scripts/qa/fixtures", fx.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img: Img = { w: info.width, h: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
  const marks = fx.marks.map(([b, t]) => ({ base: { x: b[0], y: b[1] }, tip: { x: t[0], y: t[1] } }));
  const segs = marks.map((m) => segmentNail(img, m));
  segs.forEach((s, i) => { s.accent = segs.length >= 4 ? i === 1 || i === segs.length - 2 : i === 1; });
  const prof = profileFromModels(marks.map((m) => fitNail(img, m)))!;
  const looks = [...adviceLooks(prof, "US", SALT).map((l) => ({ ...lookColors(l), name: `${l.tag.vi}: ${l.title.vi}` })), ...EXTRA];
  const c = crops[fx.file], W = Number(process.env.TILE_W) || 420, H = Math.round((c[3] * W) / c[2]);
  const tile = async (im: Img, name: string) => {
    const t = await sharp(Buffer.from(im.data.buffer, im.data.byteOffset, im.data.length), { raw: { width: im.w, height: im.h, channels: 4 } }).extract({ left: c[0], top: c[1], width: c[2], height: c[3] }).resize(W).png().toBuffer();
    return sharp(t).composite([{ input: label(name, W), top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer();
  };
  const tiles = [await tile(img, `Ảnh gốc — ${profileChips(prof).map((x) => x.vi).join(" · ")}`)];
  for (const lk of looks) if (!ONLY || ONLY.test(lk.name)) tiles.push(await tile(renderLook(img, segs, lk), lk.name));
  const cols = Number(process.env.COLS) || 4, rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * (W + 4), height: rows * (H + 4), channels: 3, background: "#111" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * (W + 4), top: Math.floor(i / cols) * (H + 4) })))
    .jpeg({ quality: 88 }).toFile(path.join(OUT, `trend_${fx.file}`));
}
console.log("ok");
