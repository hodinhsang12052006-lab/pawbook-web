// Kiểm tra ngôn ngữ của HTML MÁY CHỦ (không chạy JS): ma trận Accept-Language ×
// cookie × đường dẫn → <html lang>, <title>, tiêu đề hero, chuyển hướng /en/*.
// Chạy với `next build && next start` LOCAL (DB file:./dev.db) — không bao giờ prod.
//   BASE_URL=http://localhost:3000 node scripts/qa/ssr_locale_check.mjs [--browser]
// --browser: mở thêm Chromium (Playwright) để bắt lỗi hydration và thử nút VI/EN.
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
if (/bitpawos\.com/i.test(BASE_URL)) {
  console.error("❌ BASE_URL trỏ vào production — script này chỉ chạy với server local.");
  process.exit(2);
}

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

async function get(path, { al, cookie } = {}) {
  const headers = {};
  if (al) headers["accept-language"] = al;
  if (cookie) headers.cookie = `bitpaw_locale=${cookie}`;
  const res = await fetch(BASE_URL + path, { headers, redirect: "manual" });
  const html = res.status === 200 && /html/.test(res.headers.get("content-type") || "") ? await res.text() : "";
  return {
    status: res.status,
    location: res.headers.get("location"),
    cache: res.headers.get("x-nextjs-cache") || res.headers.get("x-nextjs-prerender") || "",
    lang: html.match(/<html[^>]*\slang="([^"]+)"/)?.[1] ?? null,
    title: decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
    h1: decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ""),
    ogLocale: html.match(/<meta property="og:locale" content="([^"]+)"/)?.[1] ?? null,
    canonical: html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null,
    html,
  };
}

/** Chữ tiếng Việt còn trong HTML tiếng Anh — bỏ <script> (payload RSC) và vùng lang="vi" có chủ đích. */
function vietnameseLeaks(html) {
  const body = (html.split(/<body[^>]*>/)[1] || "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<(section|div|p|span|option)\b[^>]*\slang="vi"[^>]*>[\s\S]*?<\/\1>/g, "");
  const text = decode(body.replace(/>/g, "> "));
  const out = new Set();
  for (const m of text.matchAll(/[^.!?•·|]{0,40}[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ][^.!?•·|]{0,40}/gi)) out.add(m[0].trim());
  return [...out];
}

let pass = 0;
let fail = 0;
const check = (ok, label, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  — ${detail}` : ""}`);
};

console.log(`SSR locale matrix against ${BASE_URL}\n`);
const MATRIX = [
  // [path, accept-language, cookie, expected lang]
  ["/", null, null, "en"],
  ["/", "en-US,en;q=0.9", null, "en"],
  ["/", "en-AU,en;q=0.9", null, "en"],
  ["/", "es-ES,es;q=0.9", null, "en"],
  ["/", "es-US,es;q=0.9,en;q=0.8", null, "en"],
  ["/", "zh-CN,zh;q=0.9", null, "en"],
  ["/", "ko-KR", null, "en"],
  ["/", "vi-VN,vi;q=0.9,en-US;q=0.8", null, "vi"],
  ["/", "vi", null, "vi"],
  ["/", "en-US,vi;q=0.8", null, "en"],
  ["/", "en-US,en;q=0.9", "vi", "vi"],
  ["/", "vi-VN,vi;q=0.9", "en", "en"],
  ["/vi", "en-US", null, "vi"],
  ["/jobs/create", "es-ES", null, "en"],
  ["/jobs/create", "vi-VN", null, "vi"],
  ["/jobs/create", "en-US", "vi", "vi"],
  ["/vi/jobs/create", "en-US", "en", "vi"],
  ["/designs", "en-AU", null, "en"],
  ["/designs", "vi-VN", null, "vi"],
  ["/auth/login", "en-US", null, "en"],
  ["/auth/login", "en-US", "vi", "vi"],
  ["/privacy", "fr-FR", null, "en"],
  ["/support", "en-US", null, "en"],
  ["/support", "vi-VN", null, "vi"],
];
const seen = {};
for (const [path, al, cookie, want] of MATRIX) {
  const r = await get(path, { al, cookie });
  const label = `${path.padEnd(16)} Accept-Language=${(al ?? "(none)").padEnd(28)} cookie=${(cookie ?? "-").padEnd(2)}`;
  check(r.status === 200 && r.lang === want, `${label} → <html lang="${r.lang}">`, r.status !== 200 ? `HTTP ${r.status}` : r.lang !== want ? `expected ${want}` : `title "${r.title}"${r.cache ? ` · cache ${r.cache}` : ""}`);
  if (r.status === 200) {
    const wantOg = want === "vi" ? "vi_VN" : "en_US";
    if (r.ogLocale !== wantOg) check(false, `${label} og:locale`, `${r.ogLocale} ≠ ${wantOg}`);
  }
  if (path === "/" && r.status === 200) seen[`${al ?? "(none)"} | cookie=${cookie ?? "-"}`] = r;
}

console.log("\nHero heading per request (/):");
for (const [k, r] of Object.entries(seen)) console.log(`   <html lang="${r.lang}">  ${k.padEnd(44)}  h1: ${r.h1 || "(none)"}`);

console.log("\nRedirects, assets and APIs are not rewritten:");
for (const [path, wantStatus, wantLoc] of [
  ["/en", 308, "/"],
  ["/en/jobs/create", 308, "/jobs/create"],
  ["/en/designs?x=1", 308, "/designs?x=1"],
]) {
  const r = await get(path, { al: "en-US" });
  check(r.status === wantStatus && (r.location || "").replace(BASE_URL, "") === wantLoc, `${path} → ${r.status} ${r.location ?? ""}`);
}
for (const [path, type] of [
  ["/manifest.json", /json/],
  ["/robots.txt", /text/],
  ["/sitemap.xml", /xml/],
  ["/api/auth/session", /json/],
  ["/icon.jpg", /image/],
]) {
  const res = await fetch(BASE_URL + path, { headers: { "accept-language": "vi-VN", cookie: "bitpaw_locale=vi" }, redirect: "manual" });
  check(res.status === 200 && type.test(res.headers.get("content-type") || ""), `${path} (cookie vi) → ${res.status} ${res.headers.get("content-type")}`);
}
{
  const r = await get("/khong-co-trang-nay", { al: "en-US" });
  const r2 = await fetch(BASE_URL + "/khong-co-trang-nay", { headers: { "accept-language": "en-US" } });
  check(r2.status === 404, `/khong-co-trang-nay → ${r2.status} (global 404)`, r.title);
}

console.log("\nSEO tags:");
{
  const en = await get("/designs", { al: "en-US" });
  const vi = await get("/vi/designs", { al: "en-US" });
  check(en.canonical?.endsWith("/designs") && !en.canonical.includes("/vi/"), `EN canonical ${en.canonical}`);
  check(!!vi.canonical?.endsWith("/vi/designs"), `VI canonical ${vi.canonical}`);
  for (const r of [en, vi]) {
    const hl = [...r.html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/gi)].map((m) => `${m[1]}=${m[2].replace(/^https?:\/\/[^/]+/, "")}`);
    check(hl.length === 3, `hreflang on ${r.lang} page: ${hl.join(", ")}`);
  }
  // Trang KHÔNG tự khai canonical không được thừa hưởng canonical = trang chủ từ layout gốc.
  for (const path of ["/offline", "/support"]) {
    const r = await get(path, { al: "en-US" });
    const home = r.canonical && /^https?:\/\/[^/]+\/?$/.test(r.canonical);
    check(!home, `${path} canonical is not the homepage (${r.canonical ?? "none"})`);
  }
  const off = await get("/offline", { al: "en-US" });
  check(/<meta name="robots" content="noindex/.test(off.html), "/offline is noindex");
}

// Cổng trước khi lên production: yêu cầu RSC / prefetch theo segment (Next 16) cũng phải đi đúng nhánh ngôn ngữ
// theo cookie — router của Vercel áp has/missing cho cả request ?_rsc và next-router-segment-prefetch. Chạy cả
// với BASE_URL=<preview>.vercel.app để kiểm tra bản preview trước khi promote.
console.log("\nRSC / segment prefetch by cookie:");
for (const cookie of ["vi", "en"]) {
  const headers = { rsc: "1", "next-router-prefetch": "1", "next-router-segment-prefetch": "/_tree", cookie: `bitpaw_locale=${cookie}` };
  const res = await fetch(`${BASE_URL}/designs?_rsc=qa${cookie}`, { headers, redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  // Cây segment chứa giá trị của [lang] ("lang","vi" / "lang","en") — đúng nhánh thì chỉ có ngôn ngữ của cookie.
  const hasVi = /"lang","vi"|\["lang","vi"|lang\|vi/.test(body), hasEn = /"lang","en"|\["lang","en"|lang\|en/.test(body);
  check(res.status === 200 && (cookie === "vi" ? hasVi && !hasEn : hasEn && !hasVi), `/designs prefetch with cookie=${cookie} → ${res.status}, tree lang=${hasVi ? "vi" : hasEn ? "en" : "?"}`);
}

console.log('\nVietnamese text left in English server HTML (scripts + lang="vi" blocks excluded):');
let leakPages = 0;
for (const path of ["/", "/designs", "/trends", "/salons", "/tryon", "/auth/login", "/auth/register", "/privacy", "/terms", "/support", "/data-deletion", "/offline", "/jobs/create"]) {
  const r = await get(path, { al: "en-US" });
  const leaks = r.status === 200 ? vietnameseLeaks(r.html) : [];
  if (leaks.length) leakPages++;
  console.log(`   ${leaks.length ? "⚠️ " : "✅"} ${path.padEnd(16)} ${r.status === 200 ? `${leaks.length} snippet(s)` : `HTTP ${r.status}`}${leaks.length ? `: ${leaks.slice(0, 4).map((s) => JSON.stringify(s)).join(" · ")}` : ""}`);
}
if (process.argv.includes("--strict")) check(leakPages === 0, "no Vietnamese in English SSR HTML");

if (process.argv.includes("--browser")) {
  const { chromium } = await import("playwright");
  console.log("\nBrowser: hydration + VI/EN toggle");
  const browser = await chromium.launch();
  for (const [locale, al] of [["en-US", "en-US,en;q=0.9"], ["vi-VN", "vi-VN,vi;q=0.9"], ["es-ES", "es-ES,es;q=0.9"]]) {
    const ctx = await browser.newContext({ locale, extraHTTPHeaders: { "accept-language": al } });
    await ctx.addInitScript(() => {
      try {
        sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
        localStorage.setItem("pn_push_dismissed_at", String(Date.now()));
      } catch {}
    });
    const page = await ctx.newPage();
    const errors = [];
    const other = new Set();
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      if (/hydrat|#418|#423|#425|did not match|mismatch/i.test(m.text())) errors.push(m.text().slice(0, 200));
      else other.add(m.text().slice(0, 140));
    });
    page.on("pageerror", (e) => {
      if (/hydrat|#418|#423|#425|did not match|mismatch/i.test(e.message)) errors.push(e.message.slice(0, 200));
    });
    for (const path of ["/", "/designs", "/jobs/create", "/auth/login", "/support", "/vi/designs"]) {
      await page.goto(BASE_URL + path, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(600);
    }
    check(errors.length === 0, `${locale}: 6 pages without hydration errors`, errors.slice(0, 2).join(" | "));
    if (other.size) console.log(`   (other console errors, not hydration: ${[...other].slice(0, 3).join(" | ")})`);
    await ctx.close();
  }
  // Toggle: EN browser → bấm VI/EN → trang tải lại bằng tiếng Việt, cookie được ghi, lần tải sau máy chủ vẫn VI.
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(BASE_URL + "/designs", { waitUntil: "networkidle" });
  const before = await page.evaluate(() => document.documentElement.lang);
  await Promise.all([page.waitForEvent("load"), page.locator('button[data-locale-toggle="en"]:visible').first().click()]);
  await page.waitForLoadState("networkidle").catch(() => {});
  const after = await page.evaluate(() => ({ lang: document.documentElement.lang, cookie: document.cookie, ls: localStorage.getItem("bitpaw_locale"), url: location.pathname }));
  check(before === "en" && after.lang === "vi" && /bitpaw_locale=vi/.test(after.cookie) && after.ls === "vi" && after.url === "/designs", `toggle EN→VI on /designs: lang ${before}→${after.lang}, cookie+localStorage=vi, URL stays ${after.url}`);
  await page.goto(BASE_URL + "/auth/login", { waitUntil: "networkidle" });
  check((await page.evaluate(() => document.documentElement.lang)) === "vi", "next page load (/auth/login, server) is Vietnamese");
  // Trang đăng nhập dùng ô chọn ngôn ngữ riêng (app/[lang]/auth/layout.tsx).
  await Promise.all([page.waitForEvent("load"), page.locator("select[data-locale-select]").selectOption("en")]);
  await page.waitForLoadState("networkidle").catch(() => {});
  check((await page.evaluate(() => document.documentElement.lang)) === "en", "auth language select VI→EN reloads /auth/login in English");
  await page.goto(BASE_URL + "/vi/designs", { waitUntil: "networkidle" });
  await Promise.all([page.waitForEvent("load"), page.locator('button[data-locale-toggle="vi"]:visible').first().click()]);
  await page.waitForLoadState("networkidle").catch(() => {});
  const back = await page.evaluate(() => ({ lang: document.documentElement.lang, url: location.pathname, cookie: document.cookie }));
  check(back.lang === "en" && back.url === "/designs" && /bitpaw_locale=en/.test(back.cookie), `toggle VI→EN on /vi/designs → ${back.url} in ${back.lang}, cookie=en`);
  // Người dùng bản cũ: chỉ có localStorage (chưa có cookie) → đồng bộ sang cookie + tải lại 1 lần.
  const legacy = await browser.newContext({ locale: "en-US" });
  await legacy.addInitScript(() => {
    try {
      if (!sessionStorage.getItem("qa_seeded")) {
        localStorage.setItem("bitpaw_locale", "vi");
        sessionStorage.setItem("qa_seeded", "1");
      }
    } catch {}
  });
  const lp = await legacy.newPage();
  await lp.goto(BASE_URL + "/designs", { waitUntil: "networkidle" });
  await lp.waitForTimeout(1500);
  const lr = await lp.evaluate(() => ({ lang: document.documentElement.lang, cookie: document.cookie }));
  check(lr.lang === "vi" && /bitpaw_locale=vi/.test(lr.cookie), `legacy localStorage "vi" → cookie written, page reloaded in ${lr.lang}`);
  // Khách EN mở link /vi/… → gợi ý "View in English".
  const guest = await browser.newContext({ locale: "en-US" });
  const gp = await guest.newPage();
  await gp.goto(BASE_URL + "/vi/designs", { waitUntil: "networkidle" });
  const hint = await gp.getByRole("button", { name: "View in English" }).isVisible().catch(() => false);
  check(hint, "/vi/* in an English-only browser shows “View in English”");
  if (hint) {
    await Promise.all([gp.waitForEvent("load"), gp.getByRole("button", { name: "View in English" }).click()]);
    await gp.waitForLoadState("networkidle").catch(() => {});
    const g = await gp.evaluate(() => ({ lang: document.documentElement.lang, url: location.pathname }));
    check(g.lang === "en" && g.url === "/designs", `“View in English” → ${g.url} in ${g.lang}`);
  }
  await browser.close();
}

console.log(`\nssr_locale_check: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
