// Chụp full-page các màn hình chính (tiếng Việt) để review thiết kế bằng mắt.
// Chạy: node scripts/qa/snapshots.mjs [tên-thư-mục]  → scripts/qa/reports/snap-<tên>/
import fs from "fs";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, fakeIp } from "./lib.mjs";

const tag = process.argv[2] || "now";
const OUT = new URL(`./reports/snap-${tag}/`, import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const VPS = {
  m: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: "vi-VN" },
  d: { viewport: { width: 1440, height: 900 }, locale: "vi-VN" },
};

const browser = await chromium.launch();
async function ctxFor(vp, email) {
  const ctx = await browser.newContext(VPS[vp]);
  const ip = fakeIp();
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), "cf-connecting-ip": ip } }));
  if (email) {
    const h = { "cf-connecting-ip": ip };
    const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
    await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  }
  return ctx;
}

const jobs = await (await fetch(BASE_URL + "/api/jobs")).json();
const techs = await (await fetch(BASE_URL + "/api/technicians")).json();
const plan = [
  ["guest", null, ["/auth/register", "/auth/register?role=technician", "/auth/register?role=owner", "/auth/login", "/privacy", `/jobs/${jobs[0]?.id}`]],
  ["tech", SEED_TECH, ["/", "/?tab=jobs", "/messages", "/profile", `/profile/${jobs[0]?.owner?.id}`, "/supply", "/tools/income-tracker", "/tools/radar"]],
  ["owner", SEED_OWNER, ["/", "/?tab=technicians", `/profile/${techs[0]?.user?.id}`, "/jobs/create", "/profile"]],
];

for (const vp of Object.keys(VPS)) {
  for (const [role, email, paths] of plan) {
    const ctx = await ctxFor(vp, email);
    const page = await ctx.newPage();
    for (const p of paths) {
      try {
        await page.goto(BASE_URL + p, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const name = `${vp}_${role}_${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 40) || "home"}.png`;
        await page.screenshot({ path: fileURLToPath(new URL(name, OUT)), fullPage: true });
        console.log("📸", name);
      } catch (e) {
        console.log("❌", p, e.message.slice(0, 120));
      }
    }
    await ctx.close();
  }
}
await browser.close();
