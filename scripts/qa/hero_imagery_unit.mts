// Hero / auth imagery seam (lib/heroImagery.ts + lib/imageLabel.ts + public/hero) — no server:
//   npx tsx scripts/qa/hero_imagery_unit.mts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HERO_IMAGES, HERO_SETS, HERO_SLOTS, AUTH_BLEED, heroSet, heroImage, heroPickerScript, avifSrcSet, webpSrc } from "../../lib/heroImagery";
import { imageLabel } from "../../lib/imageLabel";
import { SEASON_IDS } from "../../lib/season";

let fail = 0;
let n = 0;
const check = (id: string, desc: string, ok: boolean, detail = "") => {
  n++;
  console.log(`${ok ? "✅" : "❌"} [${id}] ${desc}${ok ? "" : "  → " + detail}`);
  if (!ok) fail++;
};
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// owner QA rejects (scratchpad flow/qa_rejected.json, 2026-11) — never usable on marketing surfaces
const REJECTED = ["D005", "D014", "D036", "D050", "D055", "D062", "D066", "D107", "D108", "D126", "D170"];
const MEDIUM_DEEP = new Set(["medium-tan", "warm-medium-brown", "deep-brown"]);

const missing: string[] = [];
for (const s of SEASON_IDS) for (const slot of HERO_SLOTS) {
  const code = HERO_SETS[s]?.[slot];
  const im = code ? heroImage(code) : undefined;
  if (!im || !im.alt.en || !im.alt.vi || im.source !== "flow" || typeof im.crop?.x0 !== "number" || !["bl", "br", "tl", "tr"].includes(im.chip)) missing.push(`${s}.${slot}=${code}`);
}
check("H1", `Every HERO_SETS slot (${SEASON_IDS.length} seasons × ${HERO_SLOTS.length}) resolves to an entry with EN + VI alt, source "flow", crop and chip`, missing.length === 0, missing.join(", "));

const weak: string[] = [];
for (const s of SEASON_IDS) {
  const imgs = HERO_SLOTS.map((k) => heroSet(s)[k]);
  const deep = imgs.filter((i) => MEDIUM_DEEP.has(i.skin)).length / imgs.length;
  const backdrops = new Set(imgs.map((i) => i.backdrop)).size;
  if (deep < 0.4 || backdrops < 3 || imgs.some((i) => /knit/i.test(i.backdrop))) weak.push(`${s}: ${Math.round(deep * 100)}% medium/deep, ${backdrops} backdrops`);
}
check("H2", "Every set: ≥ 40% medium / deep skin, ≥ 3 distinct backdrops, no knit", weak.length === 0, weak.join(" | "));
check("H3", "No code from the owner's QA rejects", !HERO_IMAGES.some((i) => REJECTED.includes(i.code)), HERO_IMAGES.filter((i) => REJECTED.includes(i.code)).map((i) => i.code).join(","));
const auBad = SEASON_IDS.filter((s) => s.startsWith("au-")).flatMap((s) => HERO_SLOTS.map((k) => heroSet(s)[k])).filter((i) => /snow|wool|knit|plaid|tartan|velvet/i.test(`${i.alt.en} ${i.backdrop}`));
check("H4", "AU sets contain no snow / wool / plaid / velvet entries", auBad.length === 0, auBad.map((i) => i.code).join(","));
check("H5", "imageLabel: flow/gemini_api/ai → AI illustration, render/engine → Try-on preview, photo → Real work · @handle (EN + VI)",
  imageLabel("flow", "en") === "AI illustration" && imageLabel("gemini_api", "vi") === "Ảnh minh hoạ AI" && imageLabel("ai", "en") === "AI illustration" &&
  imageLabel("render", "en") === "Try-on preview" && imageLabel("engine", "vi") === "Minh hoạ thử mẫu" &&
  imageLabel("photo", "en", "lan.nails") === "Real work · @lan.nails" && imageLabel("photo", "vi", "@lan") === "Tác phẩm thật · @lan");

// files
const dir = path.join(root, "public", "hero");
const problems: string[] = [];
for (const i of HERO_IMAGES) {
  for (const f of [`${i.file}-480.avif`, `${i.file}-640.avif`, `${i.file}-800.avif`, `${i.file}-640.webp`]) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) problems.push(`missing ${f}`);
    else if (fs.statSync(p).size > 120 * 1024) problems.push(`${f} ${Math.round(fs.statSync(p).size / 1024)} KB`);
  }
}
check("H6", `public/hero: ${HERO_IMAGES.length} codes × {480,640,800}.avif + 640.webp, each ≤ 120 KB`, HERO_IMAGES.length === 24 && problems.length === 0, problems.slice(0, 6).join(", "));
const im0 = HERO_IMAGES[0];
check("H7", "srcset helpers: AVIF 480/640/800 w descriptors + WebP 640 fallback", avifSrcSet(im0) === `/hero/${im0.file}-480.avif 480w, /hero/${im0.file}-640.avif 640w, /hero/${im0.file}-800.avif 800w` && webpSrc(im0) === `/hero/${im0.file}-640.webp`);

// pre-paint picker
const en = heroPickerScript("en");
const json = en.slice(en.indexOf("M=") + 2);
let depth = 0, end = 0;
for (let k = 0; k < json.length; k++) { if (json[k] === "{") depth++; if (json[k] === "}" && --depth === 0) { end = k + 1; break; } }
const dataBytes = Buffer.byteLength(json.slice(0, end));
const codeBytes = Buffer.byteLength(en) - dataBytes;
let parses = true;
try { new Function(en); new Function(heroPickerScript("vi", false)); } catch { parses = false; }
check("H8", `Pre-paint picker: code ${codeBytes} B ≤ 600, data ${dataBytes} B ≤ 3.5 KB, parses (EN + VI)`, codeBytes <= 600 && dataBytes <= 3584 && parses);
// one chip per cluster (front card, its own corner) → no chip fix-ups left in the picker; the auth plate is lazy +
// display:none on phones and turns eager before its src is set where data-eager matches (desktop starts it at parse)
const H9 = heroPickerScript("en", false);
check("H9", "Picker: no chip fix-ups; data-eager switches a slot to loading=eager before src (desktop auth plate)", !/chipFix/.test(H9) && H9.indexOf('i.loading="eager"') > 0 && H9.indexOf('i.loading="eager"') < H9.indexOf("i.src="));
check("H10", "AUTH_BLEED seam is empty until ≥ 1600×2400 photography exists; heroSet falls back to base", Object.keys(AUTH_BLEED).length === 0 && heroSet("nope").front.code === HERO_SETS.base.front);

console.log(fail ? `\nHero imagery: ${fail}/${n} FAILED` : `\nHero imagery: ${n}/${n} PASS`);
process.exit(fail ? 1 : 0);
