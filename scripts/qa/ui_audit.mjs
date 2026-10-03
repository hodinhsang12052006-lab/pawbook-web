// Quét giao diện bằng Playwright: mọi trang × (khách / thợ / chủ tiệm) ×
// (mobile 390px / desktop 1366px). Bắt lỗi console, lỗi JS, request 5xx/4xx,
// tràn ngang (vỡ layout mobile), ảnh hỏng, payload XSS có chạy không.
// Chạy: node scripts/qa/ui_audit.mjs   (ảnh chụp ở scripts/qa/reports/screens)
import fs from "fs";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, fakeIp } from "./lib.mjs";

const OUT = new URL("./reports/", import.meta.url);
const SHOTS = new URL("./reports/screens/", import.meta.url);
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1366, height: 900 } },
};

// Lỗi bên thứ 3 không thuộc app (không có mạng tới dịch vụ ngoài khi test local…)
// https://localhost: CSP upgrade-insecure-requests nâng prefetch lên https khi
// chạy http local — không xảy ra trên production (đã https).
const IGNORE = [/https:\/\/localhost/, /sentry\.io/, /pusher/i, /sockjs/i, /favicon/, /dicebear/, /zego/i, /giphy/i, /ERR_ABORTED/, /tenor\.com/];

async function apiLogin(context, email) {
  const csrf = await (await context.request.get(BASE_URL + "/api/auth/csrf", { headers: { "cf-connecting-ip": context._qaIp } })).json();
  await context.request.post(BASE_URL + "/api/auth/callback/credentials", {
    form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" },
    headers: { "cf-connecting-ip": context._qaIp },
  });
  const s = await (await context.request.get(BASE_URL + "/api/auth/session")).json();
  return s?.user?.id;
}

async function auditPage(page, role, vp, path, label = path) {
  const issues = [];
  const onConsole = (m) => {
    const where = m.location()?.url || "";
    if (m.type() === "error" && !IGNORE.some((r) => r.test(m.text()) || r.test(where))) issues.push(`console: ${m.text().slice(0, 160)} @ ${where.replace(BASE_URL, "").slice(0, 120)}`);
  };
  const onPageError = (e) => issues.push(`pageerror: ${e.message.slice(0, 200)}`);
  const onResponse = (r) => {
    const u = r.url();
    if (!u.startsWith(BASE_URL)) return;
    if (r.status() >= 500 || (r.status() >= 400 && r.status() !== 401 && !u.includes("/_next/"))) issues.push(`HTTP ${r.status()} ${u.replace(BASE_URL, "")}`);
  };
  const onFailed = (r) => {
    const u = r.url();
    if (u.startsWith(BASE_URL) && !IGNORE.some((x) => x.test(r.failure()?.errorText || ""))) issues.push(`reqfailed ${u.replace(BASE_URL, "")} ${r.failure()?.errorText}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);
  page.on("requestfailed", onFailed);

  let finalUrl = "";
  try {
    const resp = await page.goto(BASE_URL + path, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(800);
    finalUrl = page.url().replace(BASE_URL, "");
    if (resp && resp.status() >= 500) issues.push(`document HTTP ${resp.status()}`);

    const layout = await page.evaluate(() => {
      const vw = window.innerWidth;
      const docOverflow = document.documentElement.scrollWidth - vw;
      const offenders = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" && r.right <= vw + 1) continue;
        if (r.right > vw + 2 && !el.closest("[class*=overflow-x], [class*=snap-x], [style*=overflow]")) {
          let p = el.parentElement, clipped = false;
          while (p) {
            const ps = getComputedStyle(p);
            if (/(hidden|auto|scroll|clip)/.test(ps.overflowX)) { clipped = true; break; }
            p = p.parentElement;
          }
          if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → right=${Math.round(r.right)}`);
        }
        if (offenders.length >= 5) break;
      }
      const brokenImgs = [...document.images]
        .filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:") && i.getBoundingClientRect().width > 0)
        .map((i) => i.src.slice(0, 120));
      const xss = window.__xss === 1;
      const emptyBody = document.body.innerText.trim().length < 20;
      return { docOverflow, offenders, brokenImgs, xss, emptyBody };
    });
    if (layout.docOverflow > 1) issues.push(`TRÀN NGANG ${layout.docOverflow}px: ${layout.offenders.join(" | ")}`);
    for (const b of layout.brokenImgs) issues.push(`ảnh hỏng: ${b}`);
    if (layout.xss) issues.push("‼️ XSS: payload JS đã thực thi");
    if (layout.emptyBody) issues.push("trang gần như trống");

    const name = `${role}_${vp}_${label.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`;
    await page.screenshot({ path: fileURLToPath(new URL(name, SHOTS)), fullPage: false }).catch((e) => issues.push(`screenshot lỗi: ${e.message}`));
  } catch (e) {
    issues.push(`goto lỗi: ${e.message.slice(0, 200)}`);
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
    page.off("requestfailed", onFailed);
  }
  // Phản hồi đúng thiết kế: non-admin bị 403 ở trang admin, trang 404.
  const expected = [];
  if (path === "/admin/leads") expected.push(/403/, /Forbidden/);
  if (path.includes("does-not-exist")) expected.push(/404/, /Not Found/);
  for (let i = issues.length - 1; i >= 0; i--) if (expected.some((r) => r.test(issues[i]))) issues.splice(i, 1);
  const ok = issues.length === 0;
  console.log(`${ok ? "✅" : "❌"} ${role.padEnd(6)} ${vp.padEnd(7)} ${label.padEnd(28)} → ${finalUrl}${ok ? "" : "\n     - " + issues.join("\n     - ")}`);
  return { role, vp, path: label, finalUrl, issues };
}

const browser = await chromium.launch();
// Header IP giả chỉ gắn cho request tới app — gắn cho mọi request (CDN ảnh,
// font, Sentry) sẽ kích hoạt CORS preflight và báo lỗi giả.
async function newCtx(opts) {
  const ctx = await browser.newContext(opts);
  const ip = fakeIp();
  await ctx.route(BASE_URL + "/**", (route) => route.continue({ headers: { ...route.request().headers(), "cf-connecting-ip": ip } }));
  ctx.setExtraHTTPHeaders({});
  ctx._qaIp = ip;
  return ctx;
}
const results = [];

// Lấy id động để test trang chi tiết.
const jobs = await (await fetch(BASE_URL + "/api/jobs")).json();
const techs = await (await fetch(BASE_URL + "/api/technicians")).json();
const jobId = jobs[0]?.id;
const techUid = techs[0]?.user?.id;
const ownerUid = jobs[0]?.owner?.id;

const PUBLIC_PAGES = ["/auth/login", "/auth/register", "/privacy", "/terms", "/offline", `/jobs/${jobId}`, `/profile/${techUid}`, `/profile/${ownerUid}`, "/tools/radar", "/tools/income-tracker", "/supply", "/does-not-exist-404"];
const AUTH_PAGES = ["/", "/?tab=jobs", "/?tab=technicians", "/?tab=feed", "/messages", "/profile", "/jobs/create", "/supply", "/tools/radar", "/tools/income-tracker", `/jobs/${jobId}`, `/profile/${techUid}`, `/profile/${ownerUid}`, "/admin/leads"];

for (const [vp, opts] of Object.entries(VIEWPORTS)) {
  // Khách chưa đăng nhập
  {
    const ctx = await newCtx(opts);
    const page = await ctx.newPage();
    results.push(await auditPage(page, "guest", vp, "/", "/ (phải chuyển sang đăng ký)"));
    for (const p of PUBLIC_PAGES) results.push(await auditPage(page, "guest", vp, p));
    await ctx.close();
  }
  for (const [role, email] of [["tech", SEED_TECH], ["owner", SEED_OWNER]]) {
    const ctx = await newCtx(opts);
    const uid = await apiLogin(ctx, email);
    if (!uid) { console.log(`❌ không đăng nhập được ${email}`); continue; }
    const page = await ctx.newPage();
    for (const p of AUTH_PAGES) results.push(await auditPage(page, role, vp, p));
    await ctx.close();
  }
}

await browser.close();
const failed = results.filter((r) => r.issues.length);
console.log(`\nUI audit: ${results.length - failed.length}/${results.length} trang sạch`);
fs.writeFileSync(new URL("ui_audit.json", OUT), JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
