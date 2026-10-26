// Công cụ soi (không phải test): 1 mẫu THẬT cho MỖI hoạ tiết của máy tạo mẫu (lấy từ generateEngineDesigns qua nhiều
// ngày / dịp), vẽ bằng đúng đường cron (renderDesignImage) → các tờ 12 ô + catalog_index.json. Dùng để soi trước / sau
// khi sửa hoạ tiết.   npx tsx scripts/qa/design_catalog.mts <thư-mục-ra> [lọc-regex-hoạ-tiết]   (TILE_W=1024: ô cỡ thật để soi)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { generateEngineDesigns, PATTERN_IDS } from "../../lib/designEngine";
import { renderDesignImage, canRenderPattern } from "../../lib/designRender";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const OUT = process.argv[2] || ".";
const ONLY = process.argv[3] ? new RegExp(process.argv[3]) : null;
fs.mkdirSync(OUT, { recursive: true });
const byPat = new Map<string, any>();
const dates = ["2026-02-10", "2026-04-15", "2026-06-20", "2026-09-05", "2026-10-25", "2026-12-10"], occs = [null, "halloween", "christmas", "valentine", "fall", "newyear", "summer", "spring"];
for (let s = 0; s < 40 && byPat.size < PATTERN_IDS.length; s++) for (const date of dates) for (const occ of occs) {
  const l = generateEngineDesigns(6, { market: "US", date, occasions: occ ? [{ id: occ, title: occ, startsIn: 0 }] : [], risingTags: [], usedTitles: new Set(), salt: `c${s}` });
  for (const d of l) if (!byPat.has(d.pattern)) byPat.set(d.pattern, d);
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const label = (W: number, a: string, b: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="40"><rect width="${W}" height="40" fill="rgba(0,0,0,.72)"/><text x="6" y="16" font-size="14" fill="#ff0" font-family="sans-serif">${esc(a)}</text><text x="6" y="33" font-size="13" fill="#fff" font-family="sans-serif">${esc(b).slice(0, 52)}</text></svg>`);
const W = Number(process.env.TILE_W) || 400, tiles: Buffer[] = [], index: any[] = [];
const pats = PATTERN_IDS.filter((p) => byPat.has(p) && canRenderPattern(p) && (!ONLY || ONLY.test(p)));
for (const [i, p] of pats.entries()) {
  const d = byPat.get(p);
  const r = await renderDesignImage({ id: `cat-${p}`, palette: d.palette, shape: d.shape, finish: d.finish, pattern: d.pattern, skills: d.skills });
  tiles.push(await sharp(Buffer.from(r.base64, "base64")).resize(W, W).composite([{ input: label(W, `${i + 1}. ${p} · ${d.finish} · ${d.shape}`, d.title.vi), top: 0, left: 0 }]).jpeg({ quality: 86 }).toBuffer());
  index.push({ n: i + 1, pattern: p, finish: d.finish, shape: d.shape, palette: d.palette, title: d.title.vi, titleEn: d.title.en, hand: r.hand });
}
const PER = 12;
for (let k = 0; k < tiles.length; k += PER) {
  const part = tiles.slice(k, k + PER);
  await sharp({ create: { width: 4 * (W + 4), height: Math.ceil(part.length / 4) * (W + 4), channels: 3, background: "#111" } }).composite(part.map((input, i) => ({ input, left: (i % 4) * (W + 4), top: Math.floor(i / 4) * (W + 4) }))).jpeg({ quality: 85 }).toFile(path.join(OUT, `catalog_${String(k / PER + 1).padStart(2, "0")}.jpg`));
}
fs.writeFileSync(path.join(OUT, "catalog_index.json"), JSON.stringify(index, null, 1));
console.log("patterns", pats.length, "missing", PATTERN_IDS.filter((p) => !byPat.has(p)).join(","));
