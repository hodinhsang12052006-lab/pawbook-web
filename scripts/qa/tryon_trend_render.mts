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
  { name: "Da báo nâu nền nude", colors: ["#e8c4a8", "#a0522d", "#d4af37"], finish: "glossy", pattern: "leopard", seed: 22 },
  { name: "Bàn cờ hồng – nâu espresso", colors: ["#f2c4c4", "#4b2e2a", "#d4af37"], finish: "glossy", pattern: "checker", seed: 23 },
  { name: "Foil vàng nền xanh rêu", colors: ["#556b2f", "#ffffff", "#d4af37"], finish: "glossy", pattern: "foil", seed: 24 },
  { name: "Charm sao bạc nền navy", colors: ["#1e2a4a", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "stars", seed: 25 },
  { name: "Charm nơ bạc nền hồng sữa", colors: ["#f6d5d0", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "charm3d", seed: 26 },
  { name: "Tim đỏ nền trắng sữa", colors: ["#f8f4ee", "#c81e3a", "#d4af37"], finish: "glossy", pattern: "hearts", seed: 27 },
  { name: "Giọt chrome bạc nền nude", colors: ["#e8c4a8", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "chromedrops", seed: 28 },
  { name: "Mắt mèo chấm bi (Pinterest +1585%)", colors: ["#3e1530", "#f8fafc", "#c0c0c0"], finish: "cateye", pattern: "polka", seed: 29 },
  { name: "Mắt mèo aurora", colors: ["#111111", "#ffffff", "#c0c0c0"], finish: "cateye", pattern: "auroracat", seed: 30 },
  { name: "Sọc mảnh trắng – vàng nền hồng", colors: ["#f2c4c4", "#f8fafc", "#d4af37"], finish: "glossy", pattern: "stripes", seed: 31 },
  { name: "Dâu nhúng sô-cô-la", colors: ["#e0354a", "#4a2a1a", "#d4af37"], finish: "glossy", pattern: "chocodip", seed: 32 },
  { name: "Da hươu nền caramel", colors: ["#c68642", "#f3e3cf", "#d4af37"], finish: "glossy", pattern: "fawn", seed: 33 },
  { name: "Ma trắng nền đen", colors: ["#111111", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "ghost", seed: 34 },
  { name: "Bí ngô nền nude", colors: ["#e8c4a8", "#ffffff", "#d4af37"], finish: "glossy", pattern: "jackolantern", seed: 35 },
  { name: "Dơi bạc nền tím cà", colors: ["#3b1f3a", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "bats", seed: 36 },
  { name: "Trăng sao vàng nền navy", colors: ["#1e2a4a", "#ffffff", "#d4af37"], finish: "glossy", pattern: "moonstars", seed: 37 },
  { name: "Mạng nhện bạc nền đen", colors: ["#111111", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "web", seed: 38 },
  { name: "Bông tuyết nền xanh băng", colors: ["#a9c7e8", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "snow", seed: 39 },
  { name: "Caro đỏ – xanh thông", colors: ["#9f1239", "#14532d", "#d4af37"], finish: "glossy", pattern: "plaid", seed: 40 },
  { name: "Sọc kẹo gậy", colors: ["#f8fafc", "#b91c1c", "#d4af37"], finish: "glossy", pattern: "candy", seed: 41 },
  { name: "Cherry vẽ tay nền trắng", colors: ["#f8f4ee", "#ffffff", "#d4af37"], finish: "glossy", pattern: "cherry", seed: 42 },
  { name: "Hoa nhí hồng nền trắng sữa", colors: ["#f8f4ee", "#f9a8d4", "#d4af37"], finish: "glossy", pattern: "floral", seed: 43 },
  { name: "Swirl hồng – vàng nền nude", colors: ["#e8c4a8", "#ec4899", "#d4af37"], finish: "glossy", pattern: "swirl", seed: 44 },
  { name: "Slime xanh nền đen", colors: ["#111111", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "slimedrip", seed: 45 },
  { name: "Kẹo bắp", colors: ["#f8fafc", "#ffffff", "#d4af37"], finish: "glossy", pattern: "candycorn", seed: 46 },
  { name: "Mèo đen nền cam cháy", colors: ["#c2410c", "#ffffff", "#d4af37"], finish: "glossy", pattern: "blackcat", seed: 47 },
  { name: "Đầu lâu nền đen", colors: ["#111111", "#ffffff", "#c0c0c0"], finish: "matte", pattern: "skull", seed: 48 },
  { name: "Mắt quỷ 3D nền đen", colors: ["#111111", "#16a34a", "#c0c0c0"], finish: "glossy", pattern: "eyeball", seed: 49 },
  { name: "Đường khâu nền xanh rêu", colors: ["#84a98c", "#ffffff", "#c0c0c0"], finish: "matte", pattern: "stitches", seed: 50 },
  { name: "Đường khâu chỉ trắng nền đen", colors: ["#111111", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "stitches", seed: 57 },
  { name: "Xác ướp nền đen", colors: ["#111111", "#ffffff", "#c0c0c0"], finish: "matte", pattern: "mummy", seed: 51 },
  { name: "Lá phong vàng nền nâu", colors: ["#7c2d12", "#ffffff", "#d4af37"], finish: "glossy", pattern: "leaf", seed: 52 },
  { name: "Sóng biển nền xanh", colors: ["#38bdf8", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "waves", seed: 53 },
  { name: "Negative space đen viền vàng", colors: ["#f3d6c8", "#111111", "#d4af37"], finish: "glossy", pattern: "negative", seed: 54 },
  { name: "Thạch hồng mâm xôi", colors: ["#c2185b", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "jelly", seed: 60 },
  { name: "Thạch hồng phấn", colors: ["#f9a8d4", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "jelly", seed: 61 },
  { name: "Thạch nâu cà phê", colors: ["#8b5a3c", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "jelly", seed: 62 },
  { name: "Milk bath hoa hồng", colors: ["#f8fafc", "#f9a8d4", "#d4af37"], finish: "glossy", pattern: "milkbath", seed: 55 },
  { name: "Phù thuỷ tím viền vàng", colors: ["#3b1f3a", "#ffffff", "#d4af37"], finish: "cateye", pattern: "witchy", seed: 56 },
  { name: "Ren trắng nền hồng", colors: ["#f2c4c4", "#ffffff", "#c0c0c0"], finish: "glossy", pattern: "lace", seed: 57 },
  // hiệu ứng hoàn thiện (A3): chrome màu giữ sắc nền, nhũ loang, mắt mèo dải cong + hạt kim loại, velvet, aurora
  { name: "A3 Chrome mận (giữ màu mận)", colors: ["#4a1d3f", "#4a1d3f", "#c0c0c0"], finish: "chrome", pattern: "solid", seed: 70 },
  { name: "A3 Tím mận đính đá chrome", colors: ["#581c87", "#ffffff", "#c0c0c0"], finish: "chrome", pattern: "gems", seed: 71 },
  { name: "A3 Chrome màu nâu chocolate", colors: ["#3b2418", "#3b2418", "#d4af37"], finish: "chrome", pattern: "colorchrome", seed: 72 },
  { name: "A3 Chrome màu caramel", colors: ["#b45309", "#b45309", "#d4af37"], finish: "chrome", pattern: "colorchrome", seed: 73 },
  { name: "A3 Chrome màu hồng tráng ngọc trai", colors: ["#f4c7cf", "#f5f0e8", "#f5f0e8"], finish: "chrome", pattern: "colorchrome", seed: 74 },
  { name: "A3 Nhũ loang vàng nền nude", colors: ["#f6d5d0", "#d4af37", "#d4af37"], finish: "glitter", pattern: "glitterfade", seed: 75 },
  { name: "A3 Nhũ loang bạc nền đen", colors: ["#151314", "#c0c0c0", "#c0c0c0"], finish: "glitter", pattern: "glitterfade", seed: 78 },
  { name: "A3 Đỏ phủ nhũ vàng", colors: ["#b3122e", "#ffffff", "#d4af37"], finish: "glitter", pattern: "solid", seed: 76 },
  { name: "A3 Baby boomer nhũ", colors: ["#f2c4c4", "#f8fafc", "#c0c0c0"], finish: "glitter", pattern: "babyboomer", seed: 77 },
  { name: "A3 Mắt mèo đỏ rượu", colors: ["#5a1a2a", "#ffffff", "#d4af37"], finish: "cateye", pattern: "solid", seed: 80 },
  { name: "A3 Mắt mèo 9D đen bạc", colors: ["#151314", "#ffffff", "#c0c0c0"], finish: "cateye", pattern: "solid", seed: 81, cat: "9d" },
  { name: "A3 Mắt mèo chấm bi tím mận", colors: ["#3e1530", "#f8fafc", "#c0c0c0"], finish: "cateye", pattern: "polka", seed: 82 },
  { name: "A3 Velvet đỏ nhung", colors: ["#7a0f1f", "#ffffff", "#d4af37"], finish: "cateye", pattern: "velvet", seed: 83 },
  { name: "A3 Velvet navy", colors: ["#1f2a44", "#ffffff", "#c0c0c0"], finish: "cateye", pattern: "velvet", seed: 84 },
  { name: "A3 Mắt mèo aurora", colors: ["#111111", "#ffffff", "#c0c0c0"], finish: "cateye", pattern: "auroracat", seed: 85 },
  { name: "A3 Trắng sữa tráng gương", colors: ["#f2ede6", "#f2ede6", "#c0c0c0"], finish: "chrome", pattern: "solid", seed: 86 },
  { name: "A3 Chrome bạc gương", colors: ["#c0c0c0", "#c0c0c0", "#c0c0c0"], finish: "chrome", pattern: "solid", seed: 87 },
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
