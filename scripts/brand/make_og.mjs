// Dev-only: per-locale 1200x630 social share cards (Open Graph + Twitter summary_large_image).
//
//   node scripts/brand/make_og.mjs --next <a built copy's .next dir>     (fonts come from its next/font output)
//
// Writes public/brand/og-en.jpg + og-vi.jpg: the B logo lockup + "PawNail" + the landing headline / tagline on the
// plum stage, with ONE hero photo (Google Flow, labelled "AI illustration" on the card). Fonts = the app's own
// Fraunces (display) + Be Vietnam Pro (UI) files, so Vietnamese renders exactly like the site. Nothing is fetched
// from the network; the logo (public/logo_b.jpg derivative) is never altered.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const NEXT = argv[argv.indexOf("--next") + 1];
if (!NEXT || !fs.existsSync(path.join(NEXT, "static", "css"))) throw new Error("--next <built .next dir> required");

// @font-face rules for the two families, urls rewritten to local files
const faces = [];
for (const f of fs.readdirSync(path.join(NEXT, "static", "css"))) {
  const css = fs.readFileSync(path.join(NEXT, "static", "css", f), "utf8");
  for (const m of css.matchAll(/@font-face\{[^}]*\}/g)) {
    if (!/font-family:(Fraunces|Be Vietnam Pro)[;"]/.test(m[0])) continue;
    faces.push(m[0].replace(/url\(\/_next\/static\/media\/([^)]+)\)/g, (_, file) => `url(${pathToFileURL(path.join(NEXT, "static", "media", file)).href})`));
  }
}
if (!faces.some((r) => r.includes("Fraunces")) || !faces.some((r) => r.includes("Be Vietnam Pro"))) throw new Error("font faces not found in " + NEXT);

const file = (p) => pathToFileURL(path.join(ROOT, "public", p)).href;
const COPY = {
  en: { h1: "The platform for", foil: "the nail industry", sub: "Try-On · Salons · Nail tech jobs", where: "United States & Australia", chip: "AI illustrations" },
  vi: { h1: "Nền tảng cho", foil: "ngành nail", sub: "Thử mẫu · Tìm tiệm · Việc làm nail", where: "Mỹ & Úc", chip: "Ảnh minh hoạ AI" },
};

const html = (lang) => {
  const c = COPY[lang];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
${faces.join("\n")}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;background:#1c1521;color:#f6f0f5;font-family:"Be Vietnam Pro",system-ui,sans-serif}
.stage{position:absolute;inset:0;background:
  radial-gradient(900px 620px at 92% -18%, rgb(219 39 119 / .26), transparent 62%),
  radial-gradient(700px 460px at -8% 112%, rgb(230 199 154 / .14), transparent 60%),
  linear-gradient(180deg,#241b29 0,#1c1521 520px)}
.vig{position:absolute;inset:0;background:radial-gradient(120% 95% at 45% 35%, transparent 60%, rgb(12 7 14 / .45) 100%)}
.brand{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:16px}
.logo{width:64px;height:64px;border-radius:16px;overflow:hidden;box-shadow:0 0 0 1px rgb(255 240 246 / .18),0 12px 30px -12px rgb(8 4 10 / .9)}
.logo img{display:block;width:100%;height:100%}
.word{font-weight:600;font-size:38px;letter-spacing:-.01em}
h1{position:absolute;left:72px;top:190px;width:640px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:${lang === "vi" ? 72 : 74}px;line-height:${lang === "vi" ? 1.16 : 1.04};letter-spacing:-.02em;font-optical-sizing:auto}
.foil{background:linear-gradient(100deg,#f7b0cc 0%,#f3d4c6 48%,#e6c79a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{position:absolute;left:72px;bottom:118px;font-size:27px;line-height:36px;color:#e8e0e6}
.where{position:absolute;left:72px;bottom:72px;font-size:21px;line-height:28px;color:#c2b7bf;display:flex;align-items:center;gap:10px}
.where::before{content:"";width:6px;height:6px;border-radius:9px;background:#f59bbe}
.halo{position:absolute;left:740px;top:40px;width:520px;height:560px;background:radial-gradient(closest-side, rgb(219 39 119 / .30), rgb(219 39 119 / .10) 58%, transparent)}
.card{position:absolute;left:790px;top:78px;width:336px;height:420px;border-radius:28px;overflow:hidden;transform:rotate(3deg);
  box-shadow:0 40px 70px -30px rgb(8 4 10 / .95),0 0 0 1px rgb(255 240 246 / .12)}
.card img{display:block;width:100%;height:100%;object-fit:cover}
.chip{position:absolute;left:14px;bottom:14px;height:28px;padding:0 11px;border-radius:999px;display:flex;align-items:center;
  background:rgb(12 7 14 / .74);box-shadow:inset 0 0 0 1px rgb(255 240 246 / .14);font-size:15px;font-weight:600;color:#f6f0f5}
.back{position:absolute;left:740px;top:300px;width:200px;height:250px;border-radius:22px;overflow:hidden;transform:rotate(-7deg);opacity:.9;
  box-shadow:0 30px 60px -30px rgb(8 4 10 / .9),0 0 0 1px rgb(255 240 246 / .10)}
.back img{display:block;width:100%;height:100%;object-fit:cover;filter:brightness(.86)}
</style></head><body>
<div class="stage"></div><div class="vig"></div>
<div class="halo"></div>
<div class="back"><img src="${file("hero/d149-480.avif")}" alt=""></div>
<div class="card"><img src="${file("hero/d130-800.avif")}" alt=""><span class="chip">${c.chip}</span></div>
<div class="brand"><div class="logo"><img src="${file("brand/logo-b-256.webp")}" alt=""></div><div class="word">PawNail</div></div>
<h1>${c.h1}<br><span class="foil">${c.foil}</span></h1>
<div class="sub">${c.sub}</div>
<div class="where">${c.where}</div>
</body></html>`;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const lang of ["en", "vi"]) {
  const tmp = path.join(ROOT, "scripts", "brand", `.og-${lang}.html`);
  fs.writeFileSync(tmp, html(lang));
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
  if (!fonts.some((f) => /Fraunces/.test(f)) || !fonts.some((f) => /Be Vietnam Pro/.test(f))) throw new Error("fonts did not load: " + fonts.join(","));
  const out = path.join(ROOT, "public", "brand", `og-${lang}.jpg`);
  await page.screenshot({ path: out, type: "jpeg", quality: 86 });
  fs.unlinkSync(tmp);
  console.log(out, fs.statSync(out).size);
}
await browser.close();
