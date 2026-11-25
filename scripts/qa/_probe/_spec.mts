// probe (không commit): vẽ các mẫu chỉ định "pattern:c1,c2,c3:shape:finish:skill[:hand]" → tờ ảnh
import { createRequire } from "node:module";
import { renderDesignImage, pickHand } from "../../../lib/designRender";
import { COLORS } from "../../../lib/designEngine";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const [out, ...specs] = process.argv.slice(2);
const W = Number(process.env.TILE_W) || 512, tiles: Buffer[] = [];
for (const sp of specs) {
  const [pat, cs, shape = "almond", finish = "glossy", skill = "Gel-X", hand] = sp.split(":");
  const palette = cs.split(",").map((k) => (COLORS as any)[k]?.hex ?? k);
  const rd = { id: `spec-${sp}`, palette, shape, finish, pattern: pat, skills: skill === "-" ? [] : [skill] };
  let v = 0; if (hand) while (v < 400 && pickHand(rd, v).file !== hand) v++;
  const r = await renderDesignImage(rd, v >= 400 ? 0 : v);
  const lab = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="30"><rect width="${W}" height="30" fill="rgba(0,0,0,.6)"/><text x="8" y="20" font-size="15" font-family="sans-serif" fill="#ff0">${sp} · ${r.hand}</text></svg>`);
  tiles.push(await sharp(Buffer.from(r.base64, "base64")).resize(W, W).composite([{ input: lab, top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer());
}
const cols = Math.min(4, tiles.length), rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * (W + 4), height: rows * (W + 4), channels: 3, background: "#111" } }).composite(tiles.map((input, i) => ({ input, left: (i % cols) * (W + 4), top: Math.floor(i / cols) * (W + 4) }))).jpeg({ quality: 88 }).toFile(out);
console.log("ok", tiles.length);
