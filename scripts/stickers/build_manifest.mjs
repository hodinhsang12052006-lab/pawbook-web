// Sinh dữ liệu sticker cho Messenger từ các nguồn có giấy phép mở (xem NOTICE):
//   - Noto Emoji Animation (Google, CC BY 4.0)   → fonts.gstatic.com/s/e/notoemoji/<NOTO_VERSION>/<cp>/{emoji.svg,lottie.json}
//   - Microsoft Fluent Emoji 3D (MIT)            → cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@<SHA>/assets/…
//   - Unicode CLDR annotations EN + VI (Unicode License v3) → tên + từ khoá tìm kiếm (npm cldr-annotations-*-full@<CLDR>)
// Chạy tay khi đổi lib/stickers/packs.ts (cần mạng; tải về được cache trong %TEMP%/pn-sticker-cache), commit kết quả:
//   node scripts/stickers/build_manifest.mjs
// Kết quả xác định (sắp xếp khoá, phiên bản / commit cố định) và DỪNG (exit 1) khi có bất kỳ lỗi nào / URL nào không 200.
// Ra:  lib/stickers/catalog.generated.ts      (phần nối thêm vào các bộ hoạt hình — mọi emoji động Noto đều có chỗ)
//      lib/stickers/ids.generated.ts          (id → ký tự; máy chủ + bong bóng tin + danh sách chat — nằm trong bundle chung)
//      lib/stickers/paths.generated.ts        (id Fluent TRONG BỘ → đường dẫn PNG — bong bóng tin vẽ được không cần manifest)
//      lib/stickers/manifest.generated.ts     (tên + từ khoá EN/VI của mọi sticker trong bộ — tải động khi mở bảng)
//      lib/stickers/manifestExt.generated.ts  (mọi thư mục Fluent 3D còn lại — tải động khi bắt đầu TÌM; máy chủ nhận các id này)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "lib", "stickers");
const FLUENT_SHA = "1ffb34c752ecf5d402f04cfb4b392c77f57c54bc";
// Ghim phiên bản Noto: "latest" đổi theo thời gian (byte khác /15.0/). 17.0 có đủ emoji.svg + lottie.json cho mọi id.
const NOTO_VERSION = "17.0";
const NOTO = `https://fonts.gstatic.com/s/e/notoemoji/${NOTO_VERSION}/`;
const FLUENT = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@${FLUENT_SHA}/assets/`;
const CLDR_VERSION = "49.0.0";
const CACHE_ROOT = path.join(os.tmpdir(), "pn-sticker-cache");
const CACHE = path.join(CACHE_ROOT, FLUENT_SHA.slice(0, 8));
const CLDR_CACHE = path.join(CACHE_ROOT, `cldr-${CLDR_VERSION}`);
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(CLDR_CACHE, { recursive: true });
const UA = { "user-agent": "pawnail-sticker-manifest (github.com/hodinhsang12052006-lab/pawbook-web)" };

const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

const P = await import(pathToFileURL(path.join(OUT, "packs.ts")).href);
const { HAND_PACKS, HAND_ANIM_PACKS, NOTO_FILL, TET_ZODIAC, LEGACY_IDS, handStickerIds, flId, MAX_STICKER_ID_LENGTH } = P;

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
async function cachedJson(dir, name, url) {
  const f = path.join(dir, name.replace(/[^a-z0-9._-]+/gi, "_"));
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

// Tên thư mục Noto: mã điểm hex viết thường, đệm tối thiểu 4 chữ số (©️ → 00a9_fe0f), GIỮ FE0F
const cpOf = (glyph) => [...glyph].map((c) => c.codePointAt(0).toString(16).padStart(4, "0")).join("_");
const glyphOfCp = (cp) => String.fromCodePoint(...cp.split("_").map((h) => parseInt(h, 16)));
const bare = (glyph) => glyph.replace(/️/g, "");
const clean = (s) => String(s).toLowerCase().replace(/^:|:$/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
const uniq = (arr) => [...new Set(arr.map(clean).filter(Boolean))];
// Bỏ từ khoá thừa: cụm mà MỌI từ đã có trong các cụm đứng trước (tìm theo từ / đầu từ nên kết quả không đổi) + cụm 1 ký tự.
// Tên (cụm đầu) luôn giữ.
function lean(terms) {
  const seen = new Set();
  const out = [];
  for (const t of terms) {
    const ws = t.split(" ");
    if (out.length && (t.length < 2 || ws.every((w) => seen.has(w)))) continue;
    out.push(t);
    ws.forEach((w) => seen.add(w));
  }
  return out;
}
const SKIN = /(^|_)1f3f[b-f](_|$)/;
const MAX_WORDS = 8;
// Chuỗi trong dữ liệu sinh ra không được chứa ký tự phân tách
const safe = (s) => {
  if (/[\t\n|]/.test(s)) fail(`separator inside data: ${JSON.stringify(s)}`);
  return s;
};

// ---------- 1. Fluent: cây thư mục ở commit cố định ----------
console.log("Fluent tree @", FLUENT_SHA.slice(0, 8));
const rootTree = await cachedJson(CACHE, `tree-root-${FLUENT_SHA}.json`, `https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/${FLUENT_SHA}`);
const assetsSha = rootTree.tree?.find((x) => x.path === "assets" && x.type === "tree")?.sha;
if (!assetsSha) fail("assets tree not found");
const tree = await cachedJson(CACHE, `tree-assets-${assetsSha}.json`, `https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/${assetsSha}?recursive=1`);
if (tree.truncated) fail("GitHub tree is truncated");
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
/** Đường dẫn PNG 3D suy ra từ tên thư mục — lib/stickers/manifest.ts dùng ĐÚNG quy tắc này (không cần bảng đường dẫn). */
const snake = (folder) => folder.toLowerCase().replace(/ /g, "_");
const derivePath = (folder, def) => (def ? `${folder}/Default/3D/${snake(folder)}_3d_default.png` : `${folder}/3D/${snake(folder)}_3d.png`);
const folders = new Map(); // id → { folder, path, def, derived }
for (const [folder, rec] of [...byFolder].sort(([a], [b]) => (a < b ? -1 : 1))) {
  const p = rec.direct || rec.def;
  if (!p) continue;
  const id = flId(folder);
  if (folders.has(id)) fail(`Fluent id collision: ${id} ← "${folders.get(id).folder}" and "${folder}"`);
  if (id.length > MAX_STICKER_ID_LENGTH) continue;
  const def = !rec.direct;
  folders.set(id, { folder: safe(folder), path: p, def, derived: derivePath(folder, def) === p });
}
console.log("  3D folders:", folders.size, "· path exceptions:", [...folders.values()].filter((f) => !f.derived).map((f) => f.folder).join(", ") || "none");

// ---------- 2. Fluent metadata (glyph, nhóm Unicode, từ khoá) cho MỌI thư mục ----------
const allFolders = [...folders.entries()];
const metas = await pool(allFolders, 8, async ([, { folder }]) => {
  try {
    return await cachedJson(CACHE, `meta-${folder}.json`, `${FLUENT}${encodeURIComponent(folder)}/metadata.json`);
  } catch (e) {
    return { __err: String(e.message || e) };
  }
});
const metaById = new Map();
const metaByGlyph = new Map();
allFolders.forEach(([id, { folder }], i) => {
  const m = metas[i];
  if (m.__err || !m.glyph) fail(`metadata for ${folder}: ${m.__err || "no glyph"}`);
  metaById.set(id, m);
  const k = bare(m.glyph);
  if (!metaByGlyph.has(k)) metaByGlyph.set(k, m);
});

// ---------- 3. Noto: danh mục (api.json) — chỉ emoji gốc (bỏ biến thể màu da) ----------
const api = await cachedJson(CACHE, "noto-api.json", "https://googlefonts.github.io/noto-emoji-animation/data/api.json");
const notoBase = (api.icons || [])
  .filter((ic) => !SKIN.test(String(ic.codepoint)))
  .map((ic) => ({ glyph: glyphOfCp(String(ic.codepoint).toLowerCase()), cat: (ic.categories || [])[0] || "", p: Number(ic.popularity) || 0, tags: ic.tags || [] }))
  .sort((a, b) => b.p - a.p || (a.glyph < b.glyph ? -1 : 1));
const notoByBare = new Map(notoBase.map((n) => [bare(n.glyph), n]));
console.log("Noto catalogue (base, no skin tones):", notoBase.length);

// ---------- 4. CLDR annotations EN + VI (tên + từ khoá) ----------
const cldr = {};
for (const lang of ["en", "vi"]) {
  const base = await cachedJson(CLDR_CACHE, `ann-${lang}.json`, `https://cdn.jsdelivr.net/npm/cldr-annotations-full@${CLDR_VERSION}/annotations/${lang}/annotations.json`);
  const der = await cachedJson(CLDR_CACHE, `der-${lang}.json`, `https://cdn.jsdelivr.net/npm/cldr-annotations-derived-full@${CLDR_VERSION}/annotationsDerived/${lang}/annotations.json`);
  cldr[lang] = { ...der.annotationsDerived.annotations, ...base.annotations.annotations };
}
const cldrOf = (lang, glyph) => cldr[lang][glyph] || cldr[lang][bare(glyph)] || null;
const enName = (glyph) => cldrOf("en", glyph)?.tts?.[0] || metaByGlyph.get(bare(glyph))?.cldr || "";

// ---------- 5. Bộ viết tay: kiểm + nối phần còn lại của danh mục Noto ----------
const handIds = handStickerIds();
for (const id of handIds) {
  if (!id || id.length > MAX_STICKER_ID_LENGTH) fail(`bad id length: ${JSON.stringify(id)}`);
  if (id.startsWith("fl:") && !folders.has(id)) fail(`Fluent folder missing for ${id}`);
}
const animBare = new Set();
for (const p of HAND_ANIM_PACKS) {
  for (const it of p.items) {
    if (it.startsWith("fl:")) fail(`anim pack ${p.id} has a Fluent item ${it}`);
    animBare.add(bare(it));
  }
}
const fill = Object.fromEntries(HAND_ANIM_PACKS.map((p) => [p.id, []]));
const unplaced = [];
for (const n of notoBase) {
  if (animBare.has(bare(n.glyph))) continue;
  const name = enName(n.glyph).toLowerCase();
  const group = metaByGlyph.get(bare(n.glyph))?.group;
  const rule = NOTO_FILL.find((r) => r.cat.includes(n.cat) && (!r.group || r.group === group) && (!r.name || r.name.test(name)));
  if (!rule || !fill[rule.pack]) {
    unplaced.push(`${n.glyph} (${n.cat})`);
    continue;
  }
  fill[rule.pack].push(n.glyph);
  animBare.add(bare(n.glyph));
}
if (unplaced.length) fail(`Noto glyphs with no pack: ${unplaced.join(" ")}`);
const notoIds = [...new Set([...handIds.filter((i) => !i.startsWith("fl:")), ...Object.values(fill).flat()])].sort();
const packFlIds = handIds.filter((i) => i.startsWith("fl:")).sort();
const extFlIds = [...folders.keys()].filter((id) => !packFlIds.includes(id)).sort();
for (const p of HAND_PACKS) if (!handIds.includes(p.icon)) fail(`pack ${p.id}: icon ${p.icon} is not an item`);
console.log(
  `ids: noto ${notoIds.length} · fluent in packs ${packFlIds.length} · fluent search-only ${extFlIds.length} · hand packs ${HAND_PACKS.length} · zodiac ${Object.keys(TET_ZODIAC).length} · legacy ${LEGACY_IDS.length}`
);
console.log("  fill:", Object.entries(fill).map(([k, v]) => `${k}+${v.length}`).join(" "));

// ---------- 6. HEAD từng URL (8 luồng; URL đã 200 lần trước được nhớ trong cache) ----------
const okFile = path.join(CACHE_ROOT, `head-ok-${NOTO_VERSION}-${FLUENT_SHA.slice(0, 8)}.txt`);
const okSet = new Set(fs.existsSync(okFile) ? fs.readFileSync(okFile, "utf8").split("\n").filter(Boolean) : []);
const urls = [];
for (const id of notoIds) {
  const cp = cpOf(id);
  urls.push(`${NOTO}${cp}/emoji.svg`, `${NOTO}${cp}/lottie.json`);
}
const fluentUrl = (p) => FLUENT + p.split("/").map(encodeURIComponent).join("/");
for (const id of [...packFlIds, ...extFlIds]) urls.push(fluentUrl(folders.get(id).path));
const todo = urls.filter((u) => !okSet.has(u));
console.log(`HEAD ${todo.length} URLs (${urls.length - todo.length} already verified) …`);
const bad = [];
await pool(todo, 8, async (u) => {
  const r = await fetchRetry(u, { method: "HEAD" });
  if (r.status !== 200) bad.push(`${r.status} ${u}`);
  else okSet.add(u);
});
fs.writeFileSync(okFile, [...okSet].sort().join("\n"));
if (bad.length) fail(`${bad.length} URL(s) not 200:\n  ${bad.join("\n  ")}`);
console.log("  all 200 ✓");

// ---------- 7. Tên + từ khoá theo KÝ TỰ (dùng chung cho Noto + Fluent cùng ký tự) ----------
function wordsFor(glyph, extra = []) {
  const en = cldrOf("en", glyph);
  const vi = cldrOf("vi", glyph);
  const fm = metaByGlyph.get(bare(glyph));
  const nm = notoByBare.get(bare(glyph));
  const enW = lean(uniq([en?.tts?.[0] || fm?.cldr || fm?.tts || "", ...(en?.default || []), ...((nm?.tags || []).map(clean)), ...(fm?.keywords || []), ...extra])).slice(0, MAX_WORDS);
  const viW = lean(uniq([vi?.tts?.[0] || "", ...(vi?.default || [])])).slice(0, MAX_WORDS);
  if (!enW.length) fail(`no English name for ${glyph} (${cpOf(glyph)})`);
  return [enW.map(safe), viW.map(safe)];
}
const wordLine = (g, [en, vi]) => `${safe(bare(g))}\t${en.join("|")}\t${vi.join("|")}`;

// Lõi: mọi id trong bộ (Noto + Fluent trong bộ)
const coreWords = new Map();
for (const id of notoIds) if (!coreWords.has(bare(id))) coreWords.set(bare(id), wordsFor(id));
const FLUENT_GLYPH = {};
const FLUENT_PATH = {};
for (const id of packFlIds) {
  const m = metaById.get(id);
  FLUENT_GLYPH[id] = m.glyph;
  FLUENT_PATH[id] = folders.get(id).path;
  // Fluent không có trong Noto: lấy tên CLDR; tên thư mục Fluent làm từ khoá phụ ("Mx claus", "Twelve oclock")
  if (!coreWords.has(bare(m.glyph))) coreWords.set(bare(m.glyph), wordsFor(m.glyph, [m.cldr || "", folders.get(id).folder]));
}
const notoLines = notoIds.map((id) => {
  const n = notoByBare.get(bare(id));
  return n?.p ? `${id}\t${n.p}` : id;
});

// Mở rộng: mọi thư mục Fluent 3D còn lại (chỉ tải khi tìm)
const extWords = new Map();
const extLines = [];
for (const id of extFlIds) {
  const f = folders.get(id);
  const m = metaById.get(id);
  if (flId(f.folder) !== id) fail(`folder → id mismatch for ${f.folder}`);
  if (!coreWords.has(bare(m.glyph)) && !extWords.has(bare(m.glyph))) extWords.set(bare(m.glyph), wordsFor(m.glyph, [m.cldr || "", f.folder]));
  // cột 3: "" = <Folder>/3D/<snake>_3d.png · "d" = <Folder>/Default/3D/<snake>_3d_default.png · khác = đường dẫn đầy đủ (ngoại lệ)
  extLines.push(`${f.folder}\t${safe(m.glyph)}\t${f.derived ? (f.def ? "d" : "") : safe(f.path)}`);
}

// ---------- 8. Ghi file ----------
const header = (what) =>
  `// ĐỪNG SỬA TAY — sinh bởi scripts/stickers/build_manifest.mjs (${what}).\n` +
  `// Noto Emoji Animation (Google) · CC BY 4.0 · Microsoft Fluent Emoji (3D) · MIT · Unicode CLDR ${CLDR_VERSION} · Unicode License v3 — xem NOTICE.\n`;
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const lines = (o) => Object.entries(o).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
const str = (s) => JSON.stringify(s);

const catalogTs =
  header("mọi emoji động Noto còn lại, nối vào cuối từng bộ hoạt hình, xếp theo độ phổ biến") +
  `export const NOTO_VERSION = ${str(NOTO_VERSION)};\n\n` +
  `/** id bộ → các id nối thêm (cách nhau 1 dấu cách) */\n` +
  `export const NOTO_FILL_ITEMS: Record<string, string> = {\n${lines(Object.fromEntries(Object.entries(fill).filter(([, v]) => v.length).map(([k, v]) => [k, v.join(" ")])))}\n};\n`;

const idsTs =
  header("id → ký tự emoji; máy chủ nhận tin STICKER có id ở đây (hoặc Fluent trong manifestExt)") +
  `/** Mọi id Noto (id = chính ký tự emoji), cách nhau 1 dấu cách */\n` +
  `export const NOTO_IDS = ${str(notoIds.join(" "))};\n\n` +
  `/** id Fluent trong bộ → ký tự */\n` +
  `export const FLUENT_GLYPH: Record<string, string> = {\n${lines(sortObj(FLUENT_GLYPH))}\n};\n\n` +
  `export const STICKER_GLYPH: Record<string, string> = (() => {\n` +
  `  const o: Record<string, string> = {};\n` +
  `  for (const g of NOTO_IDS.split(" ")) o[g] = g;\n` +
  `  return Object.assign(o, FLUENT_GLYPH);\n` +
  `})();\n`;

const pathsTs =
  header("id Fluent TRONG BỘ → đường dẫn PNG 3D trong repo microsoft/fluentui-emoji") +
  `export const FLUENT_SHA = ${str(FLUENT_SHA)};\n\n` +
  `export const FLUENT_PATH: Record<string, string> = {\n${lines(sortObj(FLUENT_PATH))}\n};\n`;

const sortedWordLines = (m) => [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([g, w]) => wordLine(g, w));
const manifestTs =
  header("tên + từ khoá EN/VI của mọi sticker trong bộ — chỉ tải động khi mở bảng sticker") +
  `/** Mỗi dòng: ký tự (không FE0F) \\t từ EN (|) \\t từ VI (|) — từ đầu tiên là tên hiển thị */\n` +
  `export const WORDS = ${str(sortedWordLines(coreWords).join("\n"))};\n\n` +
  `/** Mỗi dòng: id Noto [\\t độ phổ biến] */\n` +
  `export const NOTO = ${str(notoLines.join("\n"))};\n`;

const manifestExtTs =
  header("mọi thư mục Fluent 3D ngoài bộ — tải động khi bắt đầu tìm; máy chủ nhận các id này") +
  `/** Mỗi dòng: ký tự (không FE0F) \\t từ EN (|) \\t từ VI (|) — chỉ ký tự chưa có trong manifest.generated.ts */\n` +
  `export const WORDS_EXT = ${str(sortedWordLines(extWords).join("\n"))};\n\n` +
  `/** Mỗi dòng: tên thư mục \\t ký tự \\t "" (<Folder>/3D/<snake>_3d.png) | "d" (<Folder>/Default/3D/<snake>_3d_default.png) | đường dẫn đầy đủ */\n` +
  `export const FLUENT_EXT = ${str(extLines.join("\n"))};\n`;

const write = (name, text) => {
  fs.writeFileSync(path.join(OUT, name), text);
  const gz = zlib.gzipSync(Buffer.from(text), { level: 9 }).length;
  console.log(`  ${name}: ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB raw, ${(gz / 1024).toFixed(1)} KB gzip`);
  return gz;
};
console.log("write:");
write("catalog.generated.ts", catalogTs);
const gzIds = write("ids.generated.ts", idsTs);
write("paths.generated.ts", pathsTs);
const gzCore = write("manifest.generated.ts", manifestTs);
const gzExt = write("manifestExt.generated.ts", manifestExtTs);
// Ngân sách: ids nằm trong bundle chung (danh sách chat) · lõi tải khi mở bảng · phần mở rộng tải khi bắt đầu tìm
if (gzIds > 6 * 1024) fail(`ids is ${gzIds} bytes gzip (> 6 KB budget)`);
if (gzCore > 32 * 1024) fail(`manifest core is ${gzCore} bytes gzip (> 32 KB budget)`);
if (gzExt > 48 * 1024) fail(`manifest ext is ${gzExt} bytes gzip (> 48 KB budget)`);
console.log(`done: ${notoIds.length + packFlIds.length} stickers in packs + ${extFlIds.length} searchable Fluent 3D`);
