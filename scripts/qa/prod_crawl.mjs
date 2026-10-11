// Dò lỗi lặt vặt trên web THẬT (chỉ đọc, không đăng nhập): lỗi JS, request 4xx/5xx, ảnh vỡ,
// tràn ngang, link nội bộ hỏng. Điện thoại + máy tính.   node scripts/qa/prod_crawl.mjs
import { chromium, devices } from "playwright";

const SITE = process.env.SITE || "https://www.bitpawos.com";
const jobs = await fetch(`${SITE}/api/jobs?market=US`).then((r) => r.json()).catch(() => []);
const PAGES = [
  "/", "/?tab=feed", "/?tab=jobs", "/?tab=portfolio", "/designs", "/trends", "/supply",
  "/auth/login", "/auth/register", "/auth/register?role=technician", "/auth/register?role=owner", "/auth/forgot",
  "/privacy", "/terms", "/data-deletion", "/profile/cmv261cbf0000kz06racm3k1t",
  ...(jobs[0] ? [`/jobs/${jobs[0].id}`] : []),
  "/tools/income-tracker", "/tools/radar", "/khong-ton-tai-404",
];
const issues = [];
const links = new Set();
const b = await chromium.launch();
for (const [dev, opts] of [["phone", devices["iPhone 13"]], ["desktop", { viewport: { width: 1366, height: 900 } }]]) {
  const ctx = await b.newContext({ ...opts, locale: "vi-VN" });
  for (const path of PAGES) {
    const p = await ctx.newPage();
    const tag = `[${dev} ${path}]`;
    p.on("pageerror", (e) => issues.push(`${tag} JS: ${e.message.slice(0, 140)}`));
    p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 40[134]|Download the React/i.test(m.text())) issues.push(`${tag} console: ${m.text().slice(0, 140)}`); });
    p.on("response", (r) => { const u = r.url(); if (r.status() >= 400 && u.startsWith(SITE) && !/\/api\/(auth\/session|profile|notifications|messages\/unread|onboarding)/.test(u) && !path.includes("khong-ton-tai")) issues.push(`${tag} HTTP ${r.status()} ${u.replace(SITE, "")}`); });
    p.on("requestfailed", (r) => { if (!/google-analytics|sentry|pusher|vercel-insights/i.test(r.url())) issues.push(`${tag} failed: ${r.url().slice(0, 100)} ${r.failure()?.errorText}`); });
    const res = await p.goto(SITE + path, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => { issues.push(`${tag} goto: ${e.message.slice(0, 80)}`); return null; });
    if (path.includes("khong-ton-tai") && res && res.status() !== 404) issues.push(`${tag} trang không tồn tại trả ${res.status()} (nên 404)`);
    await p.waitForTimeout(1500);
    const a = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const over = document.documentElement.scrollWidth > vw + 2;
      const wide = over ? [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 2 && r.width > 0 && getComputedStyle(e).position !== "fixed"; }).slice(0, 2).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 3).join(".")}`) : [];
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:")).map((i) => i.src.slice(0, 90));
      const hrefs = [...document.querySelectorAll("a[href^='/']")].map((x) => x.getAttribute("href"));
      const title = document.title;
      const h1 = document.querySelectorAll("h1").length;
      return { over, wide, broken, hrefs, title, h1 };
    });
    if (a.over) issues.push(`${tag} tràn ngang: ${a.wide.join(", ")}`);
    for (const x of a.broken) issues.push(`${tag} ảnh vỡ: ${x}`);
    if (!a.title || a.title.length < 5) issues.push(`${tag} thiếu tiêu đề trang`);
    a.hrefs.forEach((h) => links.add(h.split("#")[0]));
    await p.close();
  }
  await ctx.close();
}
await b.close();
// Link nội bộ: mở thử từng link (bỏ link cần đăng nhập)
const toCheck = [...links].filter((h) => h && !/^\/(api|messages|admin|profile$|jobs\/create|auth\/complete)/.test(h)).slice(0, 120);
for (const h of toCheck) {
  const r = await fetch(SITE + h, { redirect: "manual" }).catch(() => null);
  if (!r || r.status >= 400) issues.push(`[link] ${h} → ${r ? r.status : "lỗi mạng"}`);
}
console.log(`Đã dò ${PAGES.length} trang × 2 thiết bị, ${toCheck.length} link nội bộ.`);
console.log(issues.length ? [...new Set(issues)].join("\n") : "Không thấy lỗi.");
