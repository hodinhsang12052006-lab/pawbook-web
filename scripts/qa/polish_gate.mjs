// Polish gate for the guest landing "/" + /auth/* shell + season system (phase 1, 2026-11-07). GET-only.
//
//   node scripts/qa/polish_gate.mjs --base http://localhost:3212 --out <dir> [--label branch]
//        [--baseline]            record only, never fail (e.g. a run against current main)
//        [--quick]               2 dates (base + us-holiday), no reduced-motion pass, no perf pass
//        [--no-perf]             skip the throttled CLS/LCP pass
//        [--compare <report.json>]  baseline report for JS growth + the before/after contact sheet
//        [--dates US:2026-06-15,AU:2026-12-02]  override the forced-date matrix
//
// Works against a local `next start` (throwaway build copy on a local SQLite DB), a preview or production — it
// only loads pages and reads the DOM. Writes <out>/report.json, PNGs and contact sheets; exit 1 on any breach of
// scripts/qa/polish_budget.json (unless --baseline).
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUDGET = JSON.parse(fs.readFileSync(path.join(HERE, "polish_budget.json"), "utf8"));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(k);
const BASE = (arg("--base", "http://localhost:3212")).replace(/\/$/, "");
const LABEL = arg("--label", "branch");
const OUT = arg("--out", path.join(process.env.TEMP || ".", "polish-gate", new Date().toISOString().replace(/[:.]/g, "-")));
const BASELINE = flag("--baseline");
const QUICK = flag("--quick");
const PERF = !flag("--no-perf") && !QUICK;
const COMPARE = arg("--compare", null);
fs.mkdirSync(path.join(OUT, "png"), { recursive: true });

const TZ = { US: "America/New_York", AU: "Australia/Sydney" };
const ALL_DATES = [
  ["US", "2026-06-15", "base"], ["US", "2026-11-06", "us-harvest"], ["US", "2026-11-27", "us-holiday"], ["US", "2026-12-28", "nye"],
  ["US", "2027-01-05", "us-winter"], ["AU", "2026-11-06", "au-jacaranda"], ["AU", "2026-12-02", "au-summer-festive"], ["AU", "2027-01-10", "au-summer"],
];
let DATES = ALL_DATES;
if (arg("--dates")) DATES = arg("--dates").split(",").map((s) => { const [m, d] = s.split(":"); return [m, d, null]; });
else if (QUICK) DATES = ALL_DATES.filter((d) => d[2] === "base" || d[2] === "us-holiday");
if (BASELINE && !arg("--dates")) DATES = [ALL_DATES[0]];
const REVIEW_SEASONS = new Set(["base", "us-harvest", "us-holiday", "au-jacaranda", "au-summer-festive"]);

const PAGES = [
  ["landing", "/"], ["register", "/auth/register"], ["reg-client", "/auth/register?role=client"], ["reg-tech", "/auth/register?role=technician"],
  ["reg-owner", "/auth/register?role=owner"], ["login", "/auth/login"], ["forgot", "/auth/forgot"],
];
const REVIEW_PAGES = new Set(["landing", "register", "reg-client", "login"]);
const VIEWPORTS = {
  m: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  d: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const urlFor = (p, lang) => BASE + (lang === "vi" ? (p === "/" ? "/vi" : "/vi" + p) : p);

// Date shift (runs before every page script, incl. the SEASON_BOOT head script) — local noon in the market.
const shiftScript = (iso, market) => {
  const off = market === "AU" ? "+11:00" : "-05:00";
  const target = Date.parse(`${iso}T12:00:00${off}`);
  return `{const T=${target}-Date.now(),R=Date;class D extends R{constructor(...a){a.length?super(...a):super(R.now()+T)}static now(){return R.now()+T}};D.UTC=R.UTC;D.parse=R.parse;globalThis.Date=D;}`;
};

const breaches = [];
const info = [];
const results = [];
const breach = (key, msg, extra) => { breaches.push({ key, msg, ...(extra ? { extra } : {}) }); };

// ---------------------------------------------------------------------------------------------------------------
// In-page probe (serialised into the page).
function probe(ctx) {
  const vw = innerWidth, vh = innerHeight;
  const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
    for (let p = el.parentElement; p; p = p.parentElement) { const ps = getComputedStyle(p); if (ps.display === "none" || +ps.opacity === 0 || ps.visibility === "hidden") return false; }
    return true;
  };
  const parseColors = (str) => [...String(str).matchAll(/rgba?\(([^)]+)\)/g)].map((m) => {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  });
  const chromatic = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) >= 40;
  const isPink = (c) => {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.25 || c.a < 0.5) return false;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360;
    const s = d / (1 - Math.abs(2 * l - 1));
    return h >= 310 && h <= 352 && s > 0.45 && l > 0.3 && l < 0.7;
  };
  const sel = (el) => (el.id ? "#" + el.id : el.tagName.toLowerCase()) + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "");
  const all = [...document.querySelectorAll("body *")];
  const h = document.documentElement;
  const out = {
    season: h.getAttribute("data-season"), mkt: h.getAttribute("data-mkt"), surface: h.getAttribute("data-surface"),
    classic: h.hasAttribute("data-ui-classic"), lang: h.lang,
  };

  // animations
  const anims = document.getAnimations();
  const inf = anims.filter((a) => { try { return a.effect.getTiming().iterations === Infinity; } catch { return false; } });
  out.infinite = inf.length;
  out.infiniteOutsideSeason = inf.filter((a) => !a.effect?.target?.closest?.(".pn-season")).map((a) => (a.animationName || "anim") + " <" + (a.effect?.target ? sel(a.effect.target) : "?") + ">");
  const props = new Set();
  for (const a of anims) { try { for (const k of a.effect.getKeyframes()) for (const p of Object.keys(k)) if (!["offset", "computedOffset", "easing", "composite"].includes(p)) props.add(p); } catch {} }
  out.animatedProps = [...props];

  // per-element style scans (elements + ::before/::after) in the first viewport
  let blur = [], glow = [], gradText = [], pink = [], tiles = [], radial = [];
  const heroEl = document.querySelector("[data-hero]") || document.querySelector(".pn-auth-panel");
  const heroRect = heroEl && visible(heroEl) ? heroEl.getBoundingClientRect() : null;
  const bd = document.querySelector(".app-backdrop");
  const scan = [...all, ...(bd ? [] : [])];
  for (const el of scan) {
    const r = el.getBoundingClientRect();
    const fixed = getComputedStyle(el).position === "fixed";
    if (!inView(r) && !fixed) continue;
    if (!visible(el)) continue;
    for (const pseudo of [null, "::before", "::after"]) {
      const s = getComputedStyle(el, pseudo);
      if (pseudo && (s.content === "none" || s.content === "normal" || s.display === "none")) continue;
      if (pseudo && +s.opacity === 0) continue;
      const tag = sel(el) + (pseudo || "");
      if ((s.filter && s.filter.includes("blur")) || (s.backdropFilter && s.backdropFilter !== "none")) blur.push(tag);
      if (s.boxShadow && s.boxShadow !== "none") {
        const layers = s.boxShadow.split(/,(?![^(]*\))/);
        if (layers.some((L) => { if (/inset/.test(L)) return false; const c = parseColors(L)[0]; const nums = L.replace(/rgba?\([^)]*\)/, "").match(/-?[\d.]+px/g) || []; const blurPx = parseFloat(nums[2] || "0"); return c && chromatic(c) && c.a >= 0.15 && blurPx > 0; })) glow.push(tag);
      }
      const bgi = s.backgroundImage;
      if (!pseudo && /text/.test(s.webkitBackgroundClip || s.backgroundClip || "") && bgi !== "none" && el.textContent.trim()) gradText.push(tag);
      const bgc = parseColors(s.backgroundColor)[0];
      const area = r.width * r.height;
      if (!pseudo && area >= 400 && ((bgc && isPink(bgc)) || (bgi !== "none" && /linear-gradient/.test(bgi) && parseColors(bgi).some(isPink) && !/text/.test(s.webkitBackgroundClip || "")))) pink.push(tag);
      if (bgi !== "none" && s.backgroundRepeat && !/^no-repeat(, no-repeat)*$/.test(s.backgroundRepeat) && /url\(|gradient/.test(bgi)) {
        const deco = ["fixed", "absolute"].includes(s.position) || el.getAttribute("aria-hidden") === "true" || pseudo;
        const sizes = (s.backgroundSize.match(/[\d.]+px/g) || []).map(parseFloat);
        if (deco && sizes.length && Math.min(...sizes) < 401 && !/no-repeat/.test(s.backgroundRepeat)) tiles.push(tag + " " + s.backgroundSize + " " + s.backgroundRepeat);
      }
      if (heroRect && /radial-gradient/.test(bgi) && parseColors(bgi).some((c) => chromatic(c) && c.a > 0)) {
        const rr = el.getBoundingClientRect();
        const hit = fixed || (rr.right > heroRect.left && rr.left < heroRect.right && rr.bottom > heroRect.top && rr.top < heroRect.bottom);
        if (hit) radial.push(tag);
      }
    }
  }
  Object.assign(out, { blur, glow, gradText, pink, tiles, radial });

  // typography
  const h1s = [...document.querySelectorAll("h1")].filter(visible);
  out.h1Count = h1s.length;
  const h1 = h1s[0];
  if (h1) {
    const range = document.createRange(); range.selectNodeContents(h1);
    const tops = new Set([...range.getClientRects()].filter((q) => q.width > 2).map((q) => Math.round(q.top / 4)));
    out.h1Lines = tops.size; out.h1Text = h1.innerText.replace(/\s+/g, " ").trim(); out.h1Font = getComputedStyle(h1).fontFamily; out.h1Size = getComputedStyle(h1).fontSize;
  }
  const tag = document.querySelector(".pn-tagline");
  if (tag && visible(tag)) out.taglineFont = getComputedStyle(tag).fontFamily;
  out.bodyFont = getComputedStyle(document.body).fontFamily;
  let minFont = 99, minAt = "", maxW = 0, maxAt = "";
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode()); ) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "TITLE"].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect(); if (!inView(r) || !visible(el)) continue;
    if (el.closest("[aria-hidden='true'], .sr-only")) continue;
    const s = getComputedStyle(el), fs = parseFloat(s.fontSize), fw = +s.fontWeight;
    if (fs < minFont) { minFont = fs; minAt = sel(el) + " «" + n.textContent.trim().slice(0, 24) + "»"; }
    if (fw > maxW) { maxW = fw; maxAt = sel(el) + " «" + n.textContent.trim().slice(0, 24) + "»"; }
  }
  Object.assign(out, { minFont, minAt, maxWeight: maxW, maxAt });
  out.headingEmoji = [...document.querySelectorAll("h1,h2,h3")].filter((e) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(e.innerText)).map((e) => e.innerText.slice(0, 40));
  out.halloween = (document.body.innerText.match(/halloween|🎃/gi) || []).length;
  out.fonts = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "") + (f.unicodeRange.includes("1EA0") ? ":vi" : ""));
  out.geist = [...document.fonts].some((f) => /geist/i.test(f.family));

  // season layer vs text
  const texts = [...document.querySelectorAll("[data-hero-title], .pn-hero-lede, .pn-hero-ctas, .pn-tagline, .pn-auth-desc, main h1")].filter(visible).map((e) => [sel(e), e.getBoundingClientRect()]);
  out.seasonOverText = [];
  for (const fx of document.querySelectorAll(".pn-season > *")) {
    if (!visible(fx)) continue;
    const r = fx.getBoundingClientRect();
    for (const [n, t] of texts) if (r.right > t.left + 1 && r.left < t.right - 1 && r.bottom > t.top + 1 && r.top < t.bottom - 1) out.seasonOverText.push(sel(fx) + " × " + n);
  }

  // photo cards + label chips
  out.cards = [];
  for (const fig of document.querySelectorAll(".pn-card, .pn-auth-card, [data-hero-slot]")) {
    if (!visible(fig)) continue;
    const img = fig.querySelector("img"); if (!img) continue;
    const r = fig.getBoundingClientRect();
    const chip = fig.querySelector(".pn-img-label");
    const shown = chip && visible(chip);
    const corner = chip?.getAttribute("data-chip") || "";
    let cornerOk = null;
    if (shown) {
      // layout (pre-transform) coordinates: the cards are rotated in 3D, bounding rects are projections
      const left = chip.offsetLeft + chip.offsetWidth / 2 < fig.offsetWidth / 2, top = chip.offsetTop + chip.offsetHeight / 2 < fig.offsetHeight / 2;
      cornerOk = corner === (top ? "t" : "b") + (left ? "l" : "r");
    }
    // decoded pixel width of the chosen candidate (naturalWidth is density-corrected for w-descriptor srcsets)
    const src = (img.currentSrc || "").split("/").pop();
    const px = +(src.match(/-(\d+)\.(?:avif|webp)$/)?.[1] || img.naturalWidth);
    const lw = fig.offsetWidth || r.width;
    out.cards.push({
      cls: sel(fig), w: Math.round(lw), inView: inView(r), top: Math.round(r.top), bottom: Math.round(r.bottom),
      src, nat: px, ratio: px && lw ? +(px / lw).toFixed(2) : 0,
      alt: img.getAttribute("alt"), chip: shown ? { text: chip.innerText.trim(), fs: parseFloat(getComputedStyle(chip).fontSize), h: chip.offsetHeight, corner, cornerOk } : null,
    });
  }

  // auth columns
  out.authCols = [...document.querySelectorAll(".pn-auth-panel, .pn-auth-main, .pn-auth, .pn-auth-grid")].map((e) => { const s = getComputedStyle(e); return { el: sel(e), bg: s.backgroundColor, img: s.backgroundImage }; });

  // contrast (text over solid backgrounds; CTA against both lacquer stops)
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const CANVAS = { r: 28, g: 21, b: 33, a: 1 };
  const bgOf = (el) => {
    const stack = [];
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      const grad = parseColors(s.backgroundImage);
      if (p.classList?.contains("pn-cta")) return [{ r: 219, g: 39, b: 119, a: 1 }, { r: 200, g: 31, b: 108, a: 1 }];
      const c = parseColors(s.backgroundColor)[0];
      if (c && c.a > 0) { stack.push(c); if (c.a >= 0.99) break; }
      if (s.backgroundImage !== "none" && /url\(/.test(s.backgroundImage)) return null; // over a photo: skip
      void grad;
    }
    let base = CANVAS;
    for (const c of stack.reverse()) base = blend(c, base);
    return [base];
  };
  const low = []; let minC = 99;
  const tw2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n; (n = tw2.nextNode()); ) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "OPTION"].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect(); if (!inView(r) || !visible(el)) continue;
    const s = getComputedStyle(el); const fg = parseColors(s.color)[0];
    if (!fg || fg.a === 0 || /text/.test(s.webkitBackgroundClip || "")) continue;
    if (el.closest(".pn-foil")) continue;
    const bgs = bgOf(el); if (!bgs) continue;
    const fs = parseFloat(s.fontSize), large = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 600);
    const c = Math.min(...bgs.map((b) => ratio(blend(fg, b), b)));
    if (c < minC) minC = c;
    if (c < (large ? 3 : 4.5)) low.push(`${sel(el)} «${n.textContent.trim().slice(0, 24)}» ${c.toFixed(2)}`);
  }
  out.contrastMin = +minC.toFixed(2); out.contrastLow = low.slice(0, 12);

  // page-specific facts
  out.ctaTops = [...document.querySelectorAll(".pn-hero-ctas > *")].map((e) => Math.round(e.getBoundingClientRect().top));
  out.faqItems = document.querySelectorAll("section[aria-labelledby='faq'] details").length;
  out.footerLinks = document.querySelectorAll("[data-site-footer] a").length;
  out.heroSelectors = ["[data-hero-title]", "[data-hero-cta='client']", "[data-hero-cta='tech']", "[data-hero-cta='owner']"].map((q) => !!document.querySelector(q));
  out.roleRows = document.querySelectorAll(".pn-list .pn-row[data-role]").length;
  out.inputs = [...document.querySelectorAll("main input:not([type=checkbox]):not([type=radio]):not([type=hidden]), main select")].filter(visible).map((e) => ({ fs: parseFloat(getComputedStyle(e).fontSize), h: Math.round(e.getBoundingClientRect().height) }));
  out.submits = [...document.querySelectorAll("main button[type=submit]")].filter(visible).map((b) => b.classList.contains("pn-cta"));
  out.phoneOptions = [...document.querySelectorAll("main select option")].map((o) => o.textContent.trim()).filter((t) => /^\+\d/.test(t));
  out.themeToggle = !!document.querySelector("[data-theme-toggle], button[aria-label*='light' i], button[aria-label*='sáng' i]");
  out.flagsEmoji = /🇺🇸|🇦🇺/.test(document.body.innerText);
  out.areaFilterInTabs = !!document.querySelector("[data-home-tabs] [data-area-filter], [data-home-tabs] [aria-label*='market' i], [data-home-tabs] button[aria-haspopup]");
  out.scrollW = document.documentElement.scrollWidth;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
const browser = await chromium.launch();
const shots = []; // {page, vp, lang, season, file}

async function runContext({ vp, lang, market, date, expect, reduce }) {
  const ctx = await browser.newContext({
    ...VIEWPORTS[vp], reducedMotion: reduce ? "reduce" : "no-preference", timezoneId: TZ[market],
    locale: lang === "vi" ? "vi-VN" : market === "AU" ? "en-AU" : "en-US",
    extraHTTPHeaders: { "Accept-Language": lang === "vi" ? "vi-VN,vi;q=0.9" : market === "AU" ? "en-AU,en;q=0.9" : "en-US,en;q=0.9" },
  });
  await ctx.addCookies([{ name: "bitpaw_market", value: market, url: BASE }]);
  await ctx.addInitScript(shiftScript(date, market));
  await ctx.addInitScript(() => {
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
  });
  const page = await ctx.newPage();
  const fontBytes = { n: 0 };
  page.on("response", async (r) => { if (r.request().resourceType() === "font") { const b = await r.body().catch(() => null); if (b) fontBytes.n += b.length; } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  for (const [key, p] of PAGES) {
    if (QUICK && !REVIEW_PAGES.has(key) && key !== "forgot") continue;
    fontBytes.n = 0;
    const url = urlFor(p, lang);
    try { await page.goto(url, { waitUntil: "load", timeout: 60000 }); } catch (e) { breach(`${key}/${vp}/${lang}/${date}`, "load failed: " + e.message.slice(0, 120)); continue; }
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(1600);
    const pr = await page.evaluate(probe, {}).catch((e) => ({ error: String(e).slice(0, 200) }));
    pr.cls = await page.evaluate(() => +window.__cls.toFixed(4)).catch(() => null);
    pr.fontBytes = fontBytes.n;
    const id = `${key}/${vp}/${lang}/${market}-${date}${reduce ? "/reduce" : ""}`;
    const rec = { id, key, vp, lang, market, date, expect, reduce, url, ...pr, errors: errors.splice(0) };
    // header glass after scroll (landing only, once per vp/lang on the base date)
    if (key === "landing" && !reduce && date === DATES[0][1]) {
      rec.hdr0 = await page.evaluate(() => { const h = document.querySelector("header.sticky"); return h ? getComputedStyle(h, "::before").opacity : null; });
      await page.mouse.wheel(0, 240); await page.waitForTimeout(500);
      rec.hdr1 = await page.evaluate(() => { const h = document.querySelector("header.sticky"); return h ? getComputedStyle(h, "::before").opacity : null; });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
    }
    const season = expect || pr.season;
    if (!reduce && REVIEW_PAGES.has(key) && (BASELINE || REVIEW_SEASONS.has(season))) {
      const file = `${key}_${vp}_${lang}_${BASELINE ? "main" : season}.png`;
      await page.screenshot({ path: path.join(OUT, "png", file) }).catch(() => {});
      shots.push({ key, vp, lang, season: BASELINE ? "main" : season, file });
      if (key === "landing" && season === "base") {
        await page.screenshot({ path: path.join(OUT, "png", `landing_${vp}_${lang}_full.png`), fullPage: true }).catch(() => {});
      }
    }
    results.push(rec);
    process.stdout.write(".");
  }
  await ctx.close();
}

for (const [market, date, expect] of DATES) {
  for (const vp of ["m", "d"]) for (const lang of ["en", "vi"]) await runContext({ vp, lang, market, date, expect, reduce: false });
}
if (!QUICK) {
  const rd = BASELINE ? [ALL_DATES[0]] : ALL_DATES.filter((d) => d[2] === "base" || d[2] === "us-holiday");
  for (const [market, date, expect] of rd) for (const vp of ["m", "d"]) for (const lang of ["en", "vi"]) await runContext({ vp, lang, market, date, expect, reduce: true });
}
console.log("");

// ---------------------------------------------------------------------------------------------------------------
// Checks
for (const r of results) {
  if (r.error) { breach(r.id, "probe error " + r.error); continue; }
  const landing = r.key === "landing", auth = !landing;
  const b = (cond, msg, extra) => { if (!cond) breach(r.id, msg, extra); };
  if (r.expect) b(r.season === r.expect, `season ${r.season} != ${r.expect}`);
  b(!r.classic, "html[data-ui-classic] present");
  b(r.surface === (landing ? "landing" : "auth"), `data-surface=${r.surface}`);
  // motion
  const maxInf = r.reduce ? BUDGET.infiniteAnimations.reducedMotion : auth ? BUDGET.infiniteAnimations.auth : r.vp === "m" ? BUDGET.infiniteAnimations.landingMobile : r.season === "base" ? BUDGET.infiniteAnimations.landingDesktopBase : BUDGET.infiniteAnimations.landingDesktopSeason;
  b(r.infinite <= maxInf, `infinite animations ${r.infinite} > ${maxInf}`);
  b(r.infiniteOutsideSeason.length === 0, "infinite animations outside .pn-season", r.infiniteOutsideSeason);
  const badProps = r.animatedProps.filter((p) => !BUDGET.animatedProperties.includes(p));
  b(badProps.length === 0, "animated properties beyond transform/opacity", badProps);
  // surfaces
  b(r.blur.length <= BUDGET.blurElementsPerViewport, `blur elements ${r.blur.length}`, r.blur);
  const glowMax = landing ? BUDGET.colouredGlowsPerViewport : r.submits.length ? 1 : 0;
  b(r.glow.length <= glowMax, `coloured glows ${r.glow.length} > ${glowMax}`, r.glow);
  b(r.gradText.length <= BUDGET.gradientTextRunsPerViewport, `gradient-text runs ${r.gradText.length}`, r.gradText);
  b(r.pink.length <= BUDGET.pinkFilledPerViewport, `pink-filled elements ${r.pink.length}`, r.pink);
  b(r.tiles.length === 0, "decorative tile <= 400 px", r.tiles);
  if (landing) b(r.radial.length <= BUDGET.heroRadialBackgrounds, `coloured radial backgrounds on the hero ${r.radial.length}`, r.radial);
  // type
  b(r.bodyFont.replace(/["']/g, "").startsWith(BUDGET.bodyFontPrefix), "body font " + r.bodyFont.slice(0, 40));
  b((r.h1Font || "").replace(/["']/g, "").startsWith(BUDGET.displayFontPrefix), "h1 font " + (r.h1Font || "none").slice(0, 40));
  if (r.taglineFont) b(r.taglineFont.replace(/["']/g, "").startsWith(BUDGET.displayFontPrefix), "tagline font " + r.taglineFont.slice(0, 40));
  b(r.h1Count === 1, `h1 count ${r.h1Count}`);
  if (landing) b(r.h1Lines === BUDGET.h1LinesLanding, `hero H1 lines ${r.h1Lines} («${r.h1Text}» ${r.h1Size})`);
  else b(r.h1Lines <= BUDGET.h1LinesAuthMax, `auth H1 lines ${r.h1Lines} («${r.h1Text}»)`);
  b(r.minFont >= BUDGET.minFontPx, `text under ${BUDGET.minFontPx}px: ${r.minFont} ${r.minAt}`);
  b(r.maxWeight <= BUDGET.maxFontWeight, `font weight ${r.maxWeight} ${r.maxAt}`);
  b(r.headingEmoji.length === 0, "emoji / flag in headings", r.headingEmoji);
  b(r.halloween === 0, "Halloween visible");
  b(!r.geist, "Geist font face present");
  b(r.fonts.some((f) => f.startsWith("Fraunces")), "Fraunces not loaded", r.fonts);
  if (r.lang === "vi") b(r.fonts.some((f) => f.startsWith("Fraunces") && f.endsWith(":vi")), "Fraunces Vietnamese subset not loaded", r.fonts);
  if (landing && r.lang === "en" && !r.reduce) b(r.fontBytes <= BUDGET.fontBytesLandingEn, `font bytes ${r.fontBytes}`);
  // season layer + photos
  b(r.seasonOverText.length === 0, "season layer intersects text", r.seasonOverText);
  for (const c of r.cards.filter((c) => c.inView || (r.vp === "d"))) {
    if (!c.inView && r.vp === "m") continue;
    b(!!c.chip, `photo without label chip ${c.cls}`);
    if (c.chip) {
      b(/^(AI illustration|Ảnh minh hoạ AI)$/.test(c.chip.text), `label text «${c.chip.text}»`);
      b(c.chip.fs === BUDGET.labelChipPx && c.chip.h <= 24, `label chip ${c.chip.fs}px h${c.chip.h}`);
      b(c.chip.cornerOk !== false, `label chip not at its corner (${c.chip.corner}) ${c.cls}`);
    }
    if (r.vp === "d" && c.nat) b(c.ratio >= BUDGET.naturalWidthRatio, `image ${c.src} natural ${c.nat}px / rendered ${c.w}px = ${c.ratio}`);
    if (c.src) b(/\.avif$/.test(c.src), `image not AVIF: ${c.src}`);
  }
  // contrast
  b(r.contrastLow.length === 0, `contrast below AA (min ${r.contrastMin})`, r.contrastLow);
  // layout facts
  b(r.scrollW <= (r.vp === "m" ? 390 : 1440), `horizontal overflow ${r.scrollW}`);
  if (landing) {
    b(r.heroSelectors.every(Boolean), "hero selectors missing", r.heroSelectors);
    if (r.vp === "m") {
      b(new Set(r.ctaTops).size === 1, "hero CTAs not side by side", r.ctaTops);
      const first = r.cards[0];
      b(first && first.top >= 0 && first.bottom <= 844, `first strip card not fully in the first viewport (${first?.top}..${first?.bottom})`);
    }
    if (r.hdr0 != null) { b(+r.hdr0 < 0.2, `header glass at scrollY 0 (opacity ${r.hdr0})`); b(+r.hdr1 > 0.8, `header not glass after scroll (opacity ${r.hdr1})`); }
  } else {
    b(r.authCols.every((c) => /rgba\(0, 0, 0, 0\)|transparent/.test(c.bg) && c.img === "none"), "auth columns not transparent", r.authCols);
    b(!r.themeToggle, "theme toggle present");
    b(!r.flagsEmoji, "emoji flags present");
    if (r.key === "register") b(r.roleRows === 3, `role rows ${r.roleRows}`);
    for (const i of r.inputs) b(i.fs >= 16 && i.h >= 44, `input ${i.fs}px h${i.h}`);
    b(r.submits.every(Boolean), "submit without .pn-cta", r.submits);
    if (r.phoneOptions.length) b(r.phoneOptions.every((t) => /^\+(1|61) \((US|AU|Mỹ|Úc)\)$/.test(t)), "phone options", r.phoneOptions);
  }
  b(r.errors.length === 0, "page errors", r.errors);
}
// below-the-fold landing facts come from the full-page probe on the base date only
const landBase = results.filter((r) => r.key === "landing" && !r.reduce && r.date === DATES[0][1]);
for (const r of landBase) {
  if (r.faqItems !== 4) breach(r.id, `FAQ items ${r.faqItems}`);
  if (r.footerLinks < 7) breach(r.id, `footer links ${r.footerLinks}`);
}

// ---------------------------------------------------------------------------------------------------------------
// Market toggle: US -> AU on "/" swaps html[data-season] + the hero set without a reload; a reload keeps AU (cookie).
const toggle = [];
if (!BASELINE) {
  for (const vp of ["d", "m"]) {
    const ctx = await browser.newContext({ ...VIEWPORTS[vp], timezoneId: TZ.US, locale: "en-US", extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" } });
    await ctx.addCookies([{ name: "bitpaw_market", value: "US", url: BASE }]);
    await ctx.addInitScript(shiftScript("2026-11-27", "US"));
    const page = await ctx.newPage();
    const state = () => page.evaluate(() => ({ season: document.documentElement.dataset.season, mkt: document.documentElement.dataset.mkt, front: (document.querySelector(".pn-card--front img")?.currentSrc || "").split("/").pop() }));
    const rec = { vp };
    try {
      await page.goto(BASE + "/", { waitUntil: "load" });
      await page.waitForTimeout(1200);
      rec.before = await state();
      if (vp === "d") {
        await page.locator("button[aria-pressed]", { hasText: "Australia" }).first().click();
      } else {
        await page.locator("[data-home-tabs] button[aria-haspopup='dialog']").first().click();
        await page.locator("[role='dialog'] [role='group'] button", { hasText: "Australia" }).click();
      }
      await page.waitForTimeout(900);
      rec.after = await state();
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(1200);
      rec.reload = await state();
    } catch (e) { rec.error = e.message.slice(0, 160); }
    toggle.push(rec);
    const ok = !rec.error && rec.before?.season === "us-holiday" && rec.after?.season === "au-jacaranda" && rec.after?.mkt === "AU" && rec.after?.front && rec.after.front !== rec.before.front && rec.reload?.season === "au-jacaranda";
    if (!ok) breach(`toggle/${vp}`, "market toggle did not swap season + hero set (or did not persist)", rec);
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Throttled performance pass (Pixel 7-class CPU 4x, 150 ms RTT, 9 Mbps)
const perf = [];
if (PERF) {
  for (const [key, p] of [["landing", "/"], ["register", "/auth/register"], ["designs", "/designs"]]) {
    for (const vp of ["m", "d"]) {
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const ctx = await browser.newContext({ ...(vp === "m" ? devices["Pixel 7"] : VIEWPORTS.d), locale: "en-US", timezoneId: TZ.US, extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" } });
        await ctx.addCookies([{ name: "bitpaw_market", value: "US", url: BASE }]);
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        const bytes = { js: 0, css: 0, font: 0, img: 0 };
        cdp.on("Network.loadingFinished", () => {});
        page.on("response", async (r) => {
          const t = r.request().resourceType(); const k = t === "script" ? "js" : t === "stylesheet" ? "css" : t === "font" ? "font" : t === "image" ? "img" : null;
          if (!k) return; const b = await r.body().catch(() => null); if (b) bytes[k] += b.length;
        });
        await page.addInitScript(() => {
          window.__lcp = 0; window.__cls = 0; window.__lcpEl = "";
          new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lcp = e.startTime; window.__lcpEl = e.element ? e.element.tagName + "." + String(e.element.className).slice(0, 40) : e.url; } }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
        });
        try { await page.goto(BASE + p, { waitUntil: "load", timeout: 90000 }); } catch {}
        await page.waitForTimeout(3500);
        const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(4), el: window.__lcpEl })).catch(() => ({}));
        runs.push({ ...m, ...bytes });
        await ctx.close();
      }
      const med = (k) => runs.map((x) => x[k]).sort((a, b) => a - b)[1];
      const rec = { key, vp, lcp: med("lcp"), cls: Math.max(...runs.map((x) => x.cls)), js: med("js"), css: med("css"), font: med("font"), img: med("img"), runs };
      perf.push(rec);
      if (rec.lcp > BUDGET.lcpMs) breach(`perf/${key}/${vp}`, `LCP ${rec.lcp} ms > ${BUDGET.lcpMs}`, runs.map((x) => x.el));
      if (key !== "designs" && rec.cls > BUDGET.cls) breach(`perf/${key}/${vp}`, `CLS ${rec.cls} > ${BUDGET.cls}`);
      if (key === "landing" && rec.css > BUDGET.cssBytes) breach(`perf/${key}/${vp}`, `CSS ${rec.css} bytes > ${BUDGET.cssBytes}`);
      process.stdout.write("p");
    }
  }
  console.log("");
  if (COMPARE && fs.existsSync(COMPARE)) {
    const base = JSON.parse(fs.readFileSync(COMPARE, "utf8"));
    for (const vp of ["m", "d"]) {
      const a = base.perf?.find((x) => x.key === "landing" && x.vp === vp), b = perf.find((x) => x.key === "landing" && x.vp === vp);
      if (a && b) { info.push(`JS on '/' ${vp}: ${a.js} -> ${b.js} (${b.js - a.js >= 0 ? "+" : ""}${b.js - a.js} bytes)`); if (b.js - a.js > BUDGET.jsGrowthBytes) breach(`perf/landing/${vp}`, `JS growth ${b.js - a.js} bytes`); }
    }
  }
}
await browser.close();

// ---------------------------------------------------------------------------------------------------------------
// Contact sheets (before = baseline run's PNGs when --compare points at one)
async function sheet(vp) {
  const mine = shots.filter((s) => s.vp === vp);
  if (!mine.length) return;
  const baseDir = COMPARE ? path.join(path.dirname(COMPARE), "png") : null;
  const seasons = [...new Set(mine.map((s) => s.season))];
  const cols = (baseDir ? ["main"] : []).concat(seasons);
  const rows = [...new Set(mine.map((s) => `${s.key}_${s.vp}_${s.lang}`))];
  const w = vp === "d" ? 360 : 150;
  const cell = (row, col) => {
    const f = col === "main" && baseDir ? path.join(baseDir, `${row}_main.png`) : path.join(OUT, "png", `${row}_${col}.png`);
    return fs.existsSync(f) ? `<img src="file:///${f.replace(/\\/g, "/")}" style="width:${w}px;display:block">` : `<div style="width:${w}px;height:40px;color:#888">—</div>`;
  };
  const html = `<html><body style="margin:0;background:#111;color:#ddd;font:12px system-ui"><table cellspacing="6"><tr><td></td>${cols.map((c) => `<td>${c === "main" ? "before (main)" : c}</td>`).join("")}</tr>${rows.map((r) => `<tr><td style="writing-mode:vertical-rl">${r}</td>${cols.map((c) => `<td>${cell(r, c)}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
  const f = path.join(OUT, `contact_${vp}.html`);
  fs.writeFileSync(f, html);
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 200 + cols.length * (w + 8), height: 600 } });
  await pg.goto("file:///" + f.replace(/\\/g, "/"));
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: path.join(OUT, `contact_${vp}.png`), fullPage: true });
  await b.close();
}

const summary = {
  base: BASE, label: LABEL, baseline: BASELINE, when: new Date().toISOString(), pages: results.length, breaches: breaches.length,
  byRule: Object.entries(breaches.reduce((m, x) => ((m[x.msg.replace(/[\d.]+/g, "#").slice(0, 60)] = (m[x.msg.replace(/[\d.]+/g, "#").slice(0, 60)] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]),
};
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ summary, info, breaches, perf, toggle, results }, null, 1));
try { await sheet("d"); await sheet("m"); } catch (e) { console.log("contact sheet failed:", e.message); }
for (const t of toggle) console.log(`toggle ${t.vp}: ${JSON.stringify(t.before)} -> ${JSON.stringify(t.after)} -> reload ${JSON.stringify(t.reload)}${t.error ? " ERROR " + t.error : ""}`);
console.log(JSON.stringify(summary, null, 1));
for (const i of info) console.log("info:", i);
for (const p of perf) console.log(`perf ${p.key}/${p.vp}: LCP ${p.lcp} ms, CLS ${p.cls}, JS ${p.js}, CSS ${p.css}, font ${p.font}`);
for (const x of breaches.slice(0, 40)) console.log("BREACH", x.key, "—", x.msg, x.extra ? JSON.stringify(x.extra).slice(0, 200) : "");
console.log("report:", path.join(OUT, "report.json"));
process.exit(breaches.length && !BASELINE ? 1 : 0);
