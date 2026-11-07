// Sinh dữ liệu sticker cho Messenger từ 2 nguồn có giấy phép mở (xem NOTICE):
//   - Noto Emoji Animation (Google, CC BY 4.0)  → fonts.gstatic.com/s/e/notoemoji/latest/<cp>/{emoji.svg,512.webp}
//   - Microsoft Fluent Emoji 3D (MIT)           → cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@<SHA>/assets/…
// Chạy tay khi đổi lib/stickers/packs.ts (cần mạng), commit kết quả:
//   node scripts/stickers/build_manifest.mjs
// Kết quả xác định (sắp xếp khoá, commit Fluent cố định) và DỪNG (exit 1) khi có bất kỳ lỗi nào / URL nào không 200.
// Ra:  lib/stickers/manifest.generated.ts  (từ khoá EN — tải động khi mở bảng sticker)
//      lib/stickers/ids.generated.ts       (id → ký tự emoji — máy chủ kiểm tin STICKER)
//      lib/stickers/paths.generated.ts     (id Fluent → đường dẫn PNG — bong bóng tin vẽ được không cần manifest)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "lib", "stickers");
const FLUENT_SHA = "1ffb34c752ecf5d402f04cfb4b392c77f57c54bc";
const NOTO = "https://fonts.gstatic.com/s/e/notoemoji/latest/";
const FLUENT = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@${FLUENT_SHA}/assets/`;
const CACHE = path.join(os.tmpdir(), "pn-sticker-cache", FLUENT_SHA.slice(0, 8));
fs.mkdirSync(CACHE, { recursive: true });
const UA = { "user-agent": "pawnail-sticker-manifest (github.com/hodinhsang12052006-lab/pawbook-web)" };

const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

const { ALL_PACKS, TET_ZODIAC, LEGACY_IDS, allStickerIds, flId, MAX_STICKER_ID_LENGTH } = await import(pathToFileURL(path.join(OUT, "packs.ts")).href);

async function fetchRetry(url, init = {}, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...init, headers: { ...UA, ...(init.headers || {}) } });
      if (r.status >= 500 || r.status === 429) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      last = e;
      await new Promise((res) => setTimeout(res, 600 * (i + 1)));
    }
  }
  throw new Error(`${url}: ${last?.message || last}`);
}
async function cachedJson(name, url) {
  const f = path.join(CACHE, name.replace(/[^a-z0-9._-]+/gi, "_"));
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const r = await fetchRetry(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  const j = await r.json();
  fs.writeFileSync(f, JSON.stringify(j));
  return j;
}
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    })
  );
  return out;
}

const cpOf = (glyph) => [...glyph].map((c) => c.codePointAt(0).toString(16)).join("_");
const bare = (glyph) => glyph.replace(/️/g, "");
const clean = (s) => String(s).toLowerCase().replace(/^:|:$/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

// ---------- 1. Fluent: cây thư mục ở commit cố định ----------
console.log("Fluent tree @", FLUENT_SHA.slice(0, 8));
const rootTree = await cachedJson(`tree-root-${FLUENT_SHA}.json`, `https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/${FLUENT_SHA}`);
const assetsSha = rootTree.tree?.find((x) => x.path === "assets" && x.type === "tree")?.sha;
if (!assetsSha) fail("assets tree not found");
const tree = await cachedJson(`tree-assets-${assetsSha}.json`, `https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/${assetsSha}?recursive=1`);
if (tree.truncated) fail("GitHub tree is truncated");
console.log("  entries:", tree.tree.length);
const folders = new Map(); // slug id → { folder, path }
const byFolder = new Map();
for (const e of tree.tree) {
  if (e.type !== "blob") continue;
  const parts = e.path.split("/");
  const folder = parts[0];
  if (!byFolder.has(folder)) byFolder.set(folder, { direct: null, def: null });
  const rec = byFolder.get(folder);
  if (parts.length === 3 && parts[1] === "3D" && /\.png$/i.test(parts[2])) rec.direct = e.path;
  if (parts.length === 4 && parts[1] === "Default" && parts[2] === "3D" && /\.png$/i.test(parts[3])) rec.def = e.path;
}
for (const [folder, rec] of [...byFolder].sort(([a], [b]) => (a < b ? -1 : 1))) {
  const p = rec.direct || rec.def;
  if (!p) continue;
  const id = flId(folder);
  if (folders.has(id)) fail(`Fluent id collision: ${id} ← "${folders.get(id).folder}" and "${folder}"`);
  if (id.length > MAX_STICKER_ID_LENGTH) continue; // không dùng được làm id → bỏ qua (không bộ nào dùng)
  folders.set(id, { folder, path: p });
}
console.log("  3D folders:", folders.size);

// ---------- 2. Noto: danh mục (tags, độ phổ biến) ----------
const api = await cachedJson("noto-api.json", "https://googlefonts.github.io/noto-emoji-animation/data/api.json");
const notoByCp = new Map();
for (const ic of api.icons || []) notoByCp.set(String(ic.codepoint).toLowerCase(), ic);
console.log("Noto catalogue:", notoByCp.size);

// ---------- 3. Danh sách id cần dùng ----------
const ids = allStickerIds();
for (const id of ids) {
  if (!id || id.length > MAX_STICKER_ID_LENGTH) fail(`bad id length: ${JSON.stringify(id)}`);
  if (id.startsWith("fl:") && !folders.has(id)) fail(`Fluent folder missing for ${id}`);
}
const flIds = ids.filter((i) => i.startsWith("fl:")).sort();
const notoIds = ids.filter((i) => !i.startsWith("fl:")).sort();
console.log(`ids: ${ids.length} (noto ${notoIds.length}, fluent ${flIds.length}) · packs ${ALL_PACKS.length} · zodiac ${Object.keys(TET_ZODIAC).length} · legacy ${LEGACY_IDS.length}`);

// ---------- 4. Fluent metadata (glyph, cldr, keywords) — cho MỌI thư mục: dùng làm tên + từ khoá cho cả Noto ----------
const allFolders = [...folders.values()];
const metas = await pool(allFolders, 8, async ({ folder }) => {
  try {
    return await cachedJson(`meta-${folder}.json`, `${FLUENT}${encodeURIComponent(folder)}/metadata.json`);
  } catch (e) {
    return { __err: String(e.message || e) };
  }
});
const metaById = new Map();
const metaByGlyph = new Map();
allFolders.forEach(({ folder }, i) => {
  const m = metas[i];
  const id = flId(folder);
  if (m.__err) {
    if (flIds.includes(id)) fail(`metadata for ${folder}: ${m.__err}`);
    return;
  }
  metaById.set(id, m);
  if (m.glyph) {
    const k = bare(m.glyph);
    if (!metaByGlyph.has(k)) metaByGlyph.set(k, m);
  }
});

// ---------- 5. HEAD từng URL cuối cùng (8 luồng). Noto: CẢ emoji.svg lẫn 512.webp (api.json thiếu vài emoji có thật, VD 1f383) ----------
const urls = [];
for (const id of notoIds) {
  const cp = cpOf(id);
  urls.push(`${NOTO}${cp}/emoji.svg`, `${NOTO}${cp}/512.webp`);
}
const fluentPath = {};
for (const id of flIds) {
  const { path: p } = folders.get(id);
  fluentPath[id] = p;
  urls.push(FLUENT + p.split("/").map(encodeURIComponent).join("/"));
}
console.log("HEAD", urls.length, "URLs …");
const bad = [];
await pool(urls, 8, async (u) => {
  const r = await fetchRetry(u, { method: "HEAD" });
  if (r.status !== 200) bad.push(`${r.status} ${u}`);
});
if (bad.length) fail(`${bad.length} URL(s) not 200:\n  ${bad.join("\n  ")}`);
console.log("  all 200 ✓");

// ---------- 6. Ghép manifest ----------
const uniq = (arr) => [...new Set(arr.map(clean).filter(Boolean))];
const STICKERS = {};
const GLYPH = {};
for (const id of [...notoIds, ...flIds].sort()) {
  if (id.startsWith("fl:")) {
    const m = metaById.get(id);
    if (!m?.glyph) fail(`no glyph for ${id}`);
    const en = uniq([m.cldr || m.tts || folders.get(id).folder, ...(m.keywords || [])]).slice(0, 10);
    STICKERS[id] = { src: "fl", glyph: m.glyph, en };
    GLYPH[id] = m.glyph;
  } else {
    const cp = cpOf(id);
    const ic = notoByCp.get(cp) || notoByCp.get(cp.replace(/_fe0f/g, ""));
    const fm = metaByGlyph.get(bare(id));
    const en = uniq([...(fm?.cldr ? [fm.cldr] : []), ...((ic?.tags || []).map(clean)), ...(fm?.keywords || [])]).slice(0, 10);
    if (!en.length) fail(`no English name for ${id} (${cp})`);
    STICKERS[id] = { src: "noto", glyph: id, en, ...(ic?.popularity ? { p: ic.popularity } : {}) };
    GLYPH[id] = id;
  }
}
// Kiểm bộ: mọi mục có trong manifest (allStickerIds đã gồm mọi mục) + icon của bộ
for (const p of ALL_PACKS) {
  if (!STICKERS[p.icon]) fail(`pack ${p.id}: icon ${p.icon} missing`);
  for (const it of p.items) if (!STICKERS[it]) fail(`pack ${p.id}: item ${it} missing`);
}

const header = (what) =>
  `// ĐỪNG SỬA TAY — sinh bởi scripts/stickers/build_manifest.mjs (${what}).\n` +
  `// Noto Emoji Animation (Google) · CC BY 4.0 · Microsoft Fluent Emoji (3D) · MIT — xem NOTICE.\n`;
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const lines = (o) => Object.entries(o).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");

const manifestTs =
  header("từ khoá tìm kiếm — chỉ tải động khi mở bảng sticker") +
  `import type { StickerId } from "./packs";\n` +
  `export { FLUENT_SHA } from "./paths.generated";\n\n` +
  `export interface StickerMeta {\n  src: "noto" | "fl";\n  glyph: string;\n  /** Tên + từ khoá tiếng Anh (chữ thường); en[0] là tên hiển thị cho trình đọc màn hình */\n  en: string[];\n  /** Độ phổ biến trong danh mục Noto (cao = phổ biến) */\n  p?: number;\n}\n\n` +
  `export const STICKERS: Record<StickerId, StickerMeta> = {\n${lines(sortObj(STICKERS))}\n};\n`;
const idsTs =
  header("id → ký tự emoji; máy chủ chỉ nhận tin STICKER có id trong bảng này") +
  `export const STICKER_GLYPH: Record<string, string> = {\n${lines(sortObj(GLYPH))}\n};\n`;
const pathsTs =
  header("id Fluent → đường dẫn PNG 3D trong repo microsoft/fluentui-emoji") +
  `export const FLUENT_SHA = ${JSON.stringify(FLUENT_SHA)};\n\n` +
  `export const FLUENT_PATH: Record<string, string> = {\n${lines(sortObj(fluentPath))}\n};\n`;

const write = (name, text) => {
  fs.writeFileSync(path.join(OUT, name), text);
  const gz = zlib.gzipSync(Buffer.from(text), { level: 9 }).length;
  console.log(`  ${name}: ${(text.length / 1024).toFixed(1)} KB raw, ${(gz / 1024).toFixed(1)} KB gzip`);
  return gz;
};
console.log("write:");
const gzManifest = write("manifest.generated.ts", manifestTs);
const gzIds = write("ids.generated.ts", idsTs);
write("paths.generated.ts", pathsTs);
if (gzManifest > 15 * 1024) fail(`manifest is ${gzManifest} bytes gzip (> 15 KB budget)`);
if (gzIds > 6 * 1024) fail(`ids is ${gzIds} bytes gzip (> 6 KB budget)`);
console.log(`done: ${Object.keys(STICKERS).length} stickers`);
