// probe (không commit): before | after cho từng hoạ tiết từ 2 catalog_index.json
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { renderDesignImage, pickHand, HANDS } from "../../../lib/designRender";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const [bIdx, aIdx, outDir, ...pats] = process.argv.slice(2);
const B = JSON.parse(fs.readFileSync(bIdx, "utf8")), A = JSON.parse(fs.readFileSync(aIdx, "utf8"));
const W = Number(process.env.TILE_W) || 700;
fs.mkdirSync(outDir, { recursive: true });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const long = new Set(HANDS.filter((h) => h.long).map((h) => h.file));
async function tile(d: any, tag: string) {
  const rd = { id: `ba-${tag}-${d.pattern}`, palette: d.palette, shape: d.shape, finish: d.finish, pattern: d.pattern, skills: long.has(d.hand) ? ["Gel-X"] : [] };
  let v = 0; while (v < 300 && pickHand(rd, v).file !== d.hand) v++;
  const r = await renderDesignImage(rd, v >= 300 ? 0 : v);
  const lab = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="44"><rect width="${W}" height="44" fill="rgba(0,0,0,.7)"/><text x="8" y="18" font-size="15" fill="#ff0" font-family="sans-serif">${tag} · ${esc(d.pattern)} · ${d.finish} · ${d.shape} · ${r.hand}</text><text x="8" y="37" font-size="15" fill="#fff" font-family="sans-serif">${esc(d.title)}</text></svg>`);
  return sharp(Buffer.from(r.base64, "base64")).resize(W, W).composite([{ input: lab, top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer();
}
for (const p of pats) {
  const b = B.find((x: any) => x.pattern === p), a = A.find((x: any) => x.pattern === p);
  const ts = [b && (await tile(b, "BEFORE")), a && (await tile(a, "AFTER"))].filter(Boolean) as Buffer[];
  await sharp({ create: { width: ts.length * (W + 4), height: W, channels: 3, background: "#111" } }).composite(ts.map((input, i) => ({ input, left: i * (W + 4), top: 0 }))).jpeg({ quality: 88 }).toFile(path.join(outDir, `${p}.jpg`));
  console.log(p, b?.title, "→", a?.title);
}
