// Chụp các màn hình đã sửa theo đánh giá persona (EN-first), tiếng Anh + tiếng Việt, trên iPhone 14, và kiểm tra
// nhanh vài điều kiện (không lỗi hydrate, không chữ tiếng Việt ở trang EN của khách, bản dịch tin nhắn, giờ hẹn…).
// Chạy với DB QA local (scripts/qa/make-qa-db.sh --seed) + server:
//   TURSO_DATABASE_URL="file:<qa.db>" SHOW_DEMO_DATA=1 MT_ALLOW_TEST=1 MT_MOCK=1 npx next start -p 3000
//   OUT=<thư mục ảnh> node scripts/qa/persona_shots.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { BASE_URL, Client } from "./lib.mjs";

const OUT = process.env.OUT || path.resolve("scripts/qa/reports/persona_shots");
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const iphone = devices["iPhone 14"];
let pass = 0, fail = 0;
const check = (ok, label, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  — ${detail}` : ""}`); };
const VI_RE = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

async function ctxFor({ locale = "en-US", timezoneId = "America/Chicago", loginAs, cookie } = {}) {
  const ctx = await browser.newContext({ ...iphone, locale, timezoneId });
  const host = new URL(BASE_URL).hostname;
  if (cookie) await ctx.addCookies([{ name: "bitpaw_locale", value: cookie, domain: host, path: "/" }]);
  if (loginAs) {
    const c = new Client();
    await c.login(loginAs);
    await ctx.addCookies(Object.entries(c.jar).map(([name, value]) => ({ name, value, domain: host, path: "/" })));
  }
  return ctx;
}
async function shot(ctx, url, name, { wait = 1500, act } = {}) {
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e.message)));
  p.on("console", (m) => { if (m.type() === "error" && /hydrat|#418|#425|#423/i.test(m.text())) errors.push(m.text()); });
  await p.goto(BASE_URL + url, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(wait);
  if (act) await act(p);
  await p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  return { p, errors };
}
const visibleText = (p) => p.evaluate(() => {
  const walk = (n) => {
    if (n.nodeType === 3) return n.parentElement && n.parentElement.closest('[lang="vi"],script,style,noscript') ? "" : n.textContent;
    if (n.nodeType !== 1) return "";
    const st = getComputedStyle(n);
    if (st.display === "none" || st.visibility === "hidden") return "";
    return [...n.childNodes].map(walk).join(" ");
  };
  return walk(document.body).replace(/\s+/g, " ");
});

const ava = await (await fetch(`${BASE_URL}/api/salons?market=US&limit=48`)).json().then((d) => d.items.find((i) => i.name === "Ava Vu"));
const avaId = ava?.id;
check(!!avaId, "seed: Ava Vu listed in /api/salons (US)");
const salon = await (await fetch(`${BASE_URL}/api/salons?market=US&limit=48`)).json().then((d) => d.items.find((i) => i.kind === "salon"));

// ---------- US guest (EN) ----------
{
  const ctx = await ctxFor();
  let r = await shot(ctx, "/", "en_us_home");
  check(!r.errors.length, "EN home: no hydration errors", r.errors.join(" | ").slice(0, 200));
  const heroTxt = await r.p.locator("body").innerText();
  check(/open nail jobs in the US/.test(heroTxt) || !/open nail jobs/.test(heroTxt), "EN home: hero counter scoped to the US");
  r = await shot(ctx, `/menu/${avaId}`, "en_us_menu_ava");
  const menuTxt = await visibleText(r.p);
  check(/Caramel tortoiseshell with gold/.test(menuTxt), "EN menu: from-design item shows English name");
  check(/services · Prices are a guide/.test(menuTxt) && / min/.test(menuTxt) && !/′/.test(menuTxt), "EN menu: '4 services · Prices are a guide…' and 'min' durations");
  check(!VI_RE.test(menuTxt), "EN menu: no Vietnamese outside lang=vi", (menuTxt.match(new RegExp(`.{0,30}${VI_RE.source}.{0,30}`, "i")) || [""])[0]);
  r = await shot(ctx, `/profile/${avaId}`, "en_us_profile_ava_guest");
  const profTxt = await visibleText(r.p);
  check(!/SKILL PASSPORT|Skill record|OWNER RATING|Months \/ salon/i.test(profTxt), "EN tech profile (guest): no owner-rating / months-per-salon blocks");
  check(/1 year of experience/.test(profTxt), "EN tech profile: '1 year of experience'");
  if (salon) {
    r = await shot(ctx, `/profile/${salon.id}`, "en_us_profile_salon_guest");
    const t = await visibleText(r.p);
    check(!/SALON HEALTH|FAIR PAY|HOUSING FOR OUT-OF-TOWN/i.test(t.slice(0, 4000)) && /Nail salon/.test(t), "EN salon profile (guest): client layout, salon name headline");
  }
  await shot(ctx, "/salons", "en_us_salons");
  await shot(ctx, "/designs", "en_us_designs");
  r = await shot(ctx, "/trends", "en_us_trends");
  const tt = await visibleText(r.p);
  check(!/MongMuaThu|ViecLamNail|ThoNail|\d+ tin\b/.test(tt), "EN trends: no Vietnamese hashtags / 'tin'");
  r = await shot(ctx, "/support", "en_us_support");
  check(!/Hỗ trợ PawNail|Câu hỏi thường gặp/.test(await r.p.locator("main").innerText()), "EN support: English only");
  r = await shot(ctx, "/this-page-does-not-exist", "en_us_404");
  check(!/Không tìm thấy/.test(await r.p.locator("body").innerText()), "EN 404: English only");
  r = await shot(ctx, "/auth/register", "en_us_register");
  const reg = await r.p.locator("body").innerText();
  check(reg.indexOf("I'm a nail client") < reg.indexOf("I'm a nail technician") && !/Founding member|open jobs right now/.test(reg), "EN register: client first, no founding/jobs stat");
  r = await shot(ctx, "/consult", "en_us_consult_guest", { wait: 2500 });
  check(/\/tryon/.test(r.p.url()), "/consult as guest → /tryon", r.p.url());
  await shot(ctx, "/tryon", "en_us_tryon");
  const jobs = await (await fetch(`${BASE_URL}/api/jobs?market=US&page=1&pageSize=20`)).json();
  const viJob = (Array.isArray(jobs) ? jobs : jobs.jobs || []).find((j) => VI_RE.test(j.description || ""));
  if (viJob) {
    r = await shot(ctx, `/jobs/${viJob.id}`, "en_us_job_detail", { wait: 3000 });
    const jt = await visibleText(r.p);
    check(/Show original \(Tiếng Việt\)/.test(await r.p.locator("main").innerText()), "EN job: translated description with 'Show original (Tiếng Việt)'");
    check(!/482\/EB3/.test(jt), "EN job: no combined 482/EB3 visa label");
  }
  await ctx.close();
}

// ---------- Sydney guest (en-AU) ----------
{
  const ctx = await ctxFor({ locale: "en-AU", timezoneId: "Australia/Sydney" });
  let r = await shot(ctx, "/salons", "en_au_salons", { wait: 2500 });
  const t = await visibleText(r.p);
  check(!/Texas|Dallas|California/.test(t), "AU guest /salons: Australian market by default");
  r = await shot(ctx, "/auth/register?role=client", "en_au_register_client", { wait: 2000 });
  check(/\+61/.test(await r.p.locator("body").innerText()), "AU guest register: +61 prefix preselected");
  r = await shot(ctx, "/designs", "en_au_designs", { wait: 2500 });
  check(!/Thanksgiving|Halloween season|Fall nails/i.test(await visibleText(r.p)), "AU guest /designs: no Thanksgiving / northern fall chips");
  await ctx.close();
}

// ---------- US client Jessica (EN) ----------
{
  const ctx = await ctxFor({ loginAs: "jessica.client@pawnailjobs.demo" });
  let r = await shot(ctx, "/messages", "en_client_messages_list", { wait: 3500 });
  check(!r.errors.length, "/messages: no hydration error #418", r.errors.join(" | ").slice(0, 200));
  const list = await r.p.locator("body").innerText();
  check(!/Dạ chị ơi/.test(list), "/messages list: Vietnamese preview shown translated");
  r = await shot(ctx, `/messages?to=${avaId}`, "en_client_chat_ava", { wait: 4000 });
  const chat = await r.p.locator("body").innerText();
  check(/Show original/.test(chat) && /Translated from Vietnamese/.test(chat), "chat: Vietnamese reply auto-translated with 'Show original'");
  const sc = await r.p.evaluate(() => { const els = [...document.querySelectorAll(".overflow-y-auto")].filter((e) => e.scrollHeight > e.clientHeight + 40); const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; return el ? el.scrollHeight - el.scrollTop - el.clientHeight : -1; });
  check(sc >= 0 && sc < 60, "chat opens scrolled to the latest message", `distance from bottom ${sc}px`);
  const ph = await r.p.locator('input[enterkeyhint="send"]').getAttribute("placeholder");
  const w = await r.p.locator('input[enterkeyhint="send"]').evaluate((e) => e.clientWidth);
  check(ph === "Message" && w > 180, `composer: placeholder "${ph}", input ${w}px wide on iPhone 14`);
  r = await shot(ctx, "/bookings", "en_client_bookings", { wait: 2500 });
  const b = await r.p.locator("body").innerText();
  check(/My bookings/.test(b) && !/Take client bookings/.test(b), "/bookings as client: My bookings, no tech pitch");
  await shot(ctx, "/profile", "en_client_account", { wait: 2500 });
  r = await shot(ctx, "/trends", "en_client_trends", { wait: 2500 });
  check(!/Where salons are hiring|Weekly pay by state|Standout techs/.test(await r.p.locator("body").innerText()), "/trends as client: no hiring / pay sections");
  r = await shot(ctx, "/supply", "en_client_supply", { wait: 2500 });
  check(/\/salons/.test(r.p.url()), "/supply as client → /salons", r.p.url());
  await ctx.close();
}

// ---------- Tech Ava (EN UI) — confirm booking with date/time pickers ----------
{
  const ctx = await ctxFor({ loginAs: "tech7.us@pawnailjobs.demo" });
  const { p } = await shot(ctx, "/bookings", "en_tech_bookings", { wait: 2500 });
  const btn = p.getByRole("button", { name: "Confirm time" }).first();
  if (await btn.count()) {
    await btn.click();
    await p.locator('input[type="time"]').fill("14:30");
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, "en_tech_confirm_sheet.png") });
    const txt = await p.locator('[role="dialog"]').innerText();
    check(/Client sees: (Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]{2} \d{1,2} · 2:30 PM/.test(txt), "confirm sheet: en-US preview 'Sat, Nov 7 · 2:30 PM'", txt.replace(/\s+/g, " ").slice(0, 120));
  } else check(false, "tech bookings: has a new request to confirm");
  await ctx.close();
}

// ---------- Vietnamese ----------
{
  const ctx = await ctxFor({ locale: "vi-VN", timezoneId: "America/Chicago", cookie: "vi", loginAs: "tech7.us@pawnailjobs.demo" });
  let r = await shot(ctx, "/vi/messages", "vi_tech_messages", { wait: 3000 });
  check(!r.errors.length, "/vi/messages: no hydration errors", r.errors.join(" | ").slice(0, 200));
  r = await shot(ctx, `/vi/messages?to=`, "vi_tech_chat", { wait: 1000, act: async (p) => { await p.getByText("Jessica Miller").first().click().catch(() => {}); await p.waitForTimeout(2500); } });
  check(/Xem bản dịch/.test(await r.p.locator("body").innerText()), "VI chat: English client message offers 'Xem bản dịch'");
  await shot(ctx, `/vi/profile/${avaId}`, "vi_profile_ava");
  await shot(ctx, "/vi/tools/income-tracker", "vi_income_tracker", { wait: 2500 });
  await shot(ctx, "/vi/tools/radar", "vi_radar", { wait: 2500 });
  await shot(ctx, "/vi/trends", "vi_trends", { wait: 2500 });
  await shot(ctx, "/vi/tryon", "vi_tryon");
  await ctx.close();
  const g = await ctxFor({ locale: "vi-VN", cookie: "vi" });
  r = await shot(g, "/vi/auth/register?role=technician", "vi_register_tech", { wait: 2000 });
  check(/Tên hoặc tên thường gọi/.test(await r.p.locator("body").innerText()), "VI tech signup: 'Tên hoặc tên thường gọi'");
  r = await shot(g, "/vi/auth/register?role=owner", "vi_register_owner", { wait: 2000 });
  check(!/Thợ Nước|All-around|Housing/.test(await r.p.locator("body").innerText()), "VI owner signup: unified position / housing labels");
  await shot(g, "/vi/support", "vi_support");
  await shot(g, "/vi/designs", "vi_designs");
  await g.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed — screenshots in ${OUT}`);
process.exit(fail ? 1 : 0);
