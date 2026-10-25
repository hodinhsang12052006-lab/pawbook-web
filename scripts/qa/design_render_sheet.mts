// Công cụ soi (không phải test): ảnh mẫu kho "Mẫu nail" do máy PawNail tự vẽ trên tay mẫu — lấy N mẫu thật từ máy
// tạo mẫu (cùng đường cron dùng) → tờ so sánh, để soi bằng mắt như khách lướt kho mẫu.
//   npx tsx scripts/qa/design_render_sheet.mts <ra.jpg> [số mẫu] [salt]
import { createRequire } from "node:module";
import { generateEngineDesigns } from "../../lib/designEngine";
import { renderDesignImage, canRenderPattern, spreadVariant, pickHand } from "../../lib/designRender";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const [out, nStr = "12", salt = "s1"] = process.argv.slice(2);
// đúng như cron chạy ngầm: 3 lượt × 6 mẫu / ngày, có dịp lễ đang diễn ra (DATE / OCC đổi được)
const date = process.env.DATE || "2026-10-25", occ = process.env.OCC ?? "halloween";
const used = new Set<string>();
const list = ["0", "6", "12"].flatMap((sl) => { const l = generateEngineDesigns(6, { market: "US", date, occasions: occ ? [{ id: occ, title: occ, startsIn: 0 }] : [], risingTags: [], usedTitles: used, salt: `${salt}${sl}` }); l.forEach((d) => used.add(d.title.vi)); return l; }).filter((d) => canRenderPattern(d.pattern)).slice(0, +nStr);
const W = 420, tiles: Buffer[] = [];
const label = (txt: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="30"><rect width="${W}" height="30" fill="rgba(0,0,0,.6)"/><text x="8" y="20" font-size="14" font-family="sans-serif" fill="#fff">${txt.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`);
// rải tay mẫu như cron (mỗi lượt 6 mẫu không lặp 1 bàn tay)
let usedHands = new Set<string>();
for (const [i, d] of list.entries()) {
  if (i % 6 === 0) usedHands = new Set();
  const rd = { id: `${salt}-${i}`, palette: d.palette, shape: d.shape, finish: d.finish, pattern: d.pattern, skills: d.skills };
  const v = spreadVariant(rd, usedHands); usedHands.add(pickHand(rd, v).file);
  const r = await renderDesignImage(rd, v);
  tiles.push(await sharp(Buffer.from(r.base64, "base64")).resize(W, W).composite([{ input: label(`${d.title.vi} · ${d.skills.join("/")}`), top: 0, left: 0 }]).jpeg({ quality: 86 }).toBuffer());
}
const cols = 4, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * (W + 4), height: rows * (W + 4), channels: 3, background: "#111" } }).composite(tiles.map((input, i) => ({ input, left: (i % cols) * (W + 4), top: Math.floor(i / cols) * (W + 4) }))).jpeg({ quality: 86 }).toFile(out);
console.log(`ok ${list.length}`);
