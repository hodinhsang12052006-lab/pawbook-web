// Phần bổ sung của persona_shots.mjs: các màn hình còn lại đã sửa theo đánh giá persona (hồ sơ tiệm với khách,
// thu nhập & tip, xu hướng / mẫu của khách Úc, chợ vật tư, tin tuyển Úc ở tiếng Việt, bảng tin, radar, tư vấn).
// Cùng điều kiện chạy với persona_shots.mjs (DB QA local + server local):
//   OUT=<thư mục ảnh> node scripts/qa/persona_shots_extra.mjs
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
  // Ẩn lời mời cài app (che nửa màn hình trong ảnh chụp) — chỉ là trạng thái "Để sau" của người dùng.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("pn_install", JSON.stringify({ snoozeUntil: Date.now() + 86_400_000 }));
      localStorage.setItem("pn_push_dismissed_at", String(Date.now()));
      sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
    } catch {}
  });
  if (loginAs) {
    const c = new Client();
    await c.login(loginAs);
    await ctx.addCookies(Object.entries(c.jar).map(([name, value]) => ({ name, value, domain: host, path: "/" })));
  }
  return ctx;
}
const lastPage = new WeakMap();
async function shot(ctx, url, name, { wait = 2500, act } = {}) {
  await lastPage.get(ctx)?.close().catch(() => {});
  const p = await ctx.newPage();
  lastPage.set(ctx, p);
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e.message)));
  p.on("console", (m) => { if (m.type() === "error" && /hydrat|#418|#425|#423/i.test(m.text())) errors.push(m.text()); });
  // "load" + chờ cố định: trang có kết nối thời gian thực nên "networkidle" luôn hết giờ (30 giây / trang).
  await p.goto(BASE_URL + url, { waitUntil: "load" }).catch(() => {});
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
  return walk(document.body).replace(/\s+/g, " ").replace(/Tiếng Việt/g, "Vietnamese");
});
// Chữ gốc (không qua text-transform: uppercase của CSS — innerText trả "HÌNH THỨC TRẢ LƯƠNG").
const rawText = (p) => p.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
const viSnippet = (t) => (t.match(new RegExp(`.{0,40}${VI_RE.source}.{0,40}`, "i")) || [""])[0];

const LUXE = "cmus1f9g40000u2p8kvdxoh8t"; // Kim Nguyen · Luxe Nails & Spa (seed)
const AU_JOB = "cmus1f9j5000zu2p88udjpayh"; // "Theo tuần AUD" (seed)

// ---------- Salon profile as guest (EN) + as client ----------
{
  const ctx = await ctxFor();
  let r = await shot(ctx, `/profile/${LUXE}`, "en_us_profile_salon_guest");
  let t = await visibleText(r.p);
  check(!r.errors.length, "EN salon profile: no hydration errors", r.errors.join(" | ").slice(0, 160));
  check(/Luxe Nails & Spa/.test(t) && /Nail salon/.test(t), "EN salon profile (guest): salon name headline + 'Nail salon'");
  check(!/SALON HEALTH|FAIR PAY|HOUSING FOR OUT-OF-TOWN|open jobs ·/i.test(t), "EN salon profile (guest): no work-culture / hiring blocks on overview");
  check(!/CHIA TURN|Chia turn/.test(t) && !/1 ratings|1 open jobs/.test(t), "EN salon profile: no 'Chia turn', proper plurals");
  r = await shot(ctx, `/profile/${LUXE}?tab=pros`, "en_us_profile_salon_pros");
  t = await visibleText(r.p);
  check(!/Chia turn/.test(t) && (/Turn sharing/i.test(t) || !/turn/i.test(t)), "EN salon 'For nail techs' tab: 'Turn sharing' label");
  const tile = await r.p.evaluate(() => {
    const el = [...document.querySelectorAll("p")].find((p) => /^environment$/i.test(p.textContent.trim()));
    if (!el) return null;
    const box = el.parentElement.getBoundingClientRect(), b = el.getBoundingClientRect();
    return { overflow: b.right > box.right + 0.5 || b.left < box.left - 0.5 || el.scrollWidth > el.clientWidth + 1 };
  });
  check(!tile || !tile.overflow, "EN salon: 'ENVIRONMENT' fits its score tile on iPhone 14", JSON.stringify(tile));
  await shot(ctx, "/tools/income-tracker", "en_us_income_tracker_guest");
  await ctx.close();
}

// ---------- US tech (EN): income tracker week label, supply currency ----------
{
  const ctx = await ctxFor({ loginAs: "tech1.us@pawnailjobs.demo" });
  let r = await shot(ctx, "/tools/income-tracker", "en_us_income_tracker");
  let t = await visibleText(r.p);
  check(!/\b\d{2}-\d{2} – \d{2}-\d{2}\b/.test(t), "EN income tracker: no '02-11 – 08-11' week label", (t.match(/WEEKLY SUMMARY.{0,30}|Weekly summary.{0,30}/i) || [""])[0]);
  check(!/colour|centre|favourite/i.test(t), "EN-US income tracker: US spelling");
  r = await shot(ctx, "/supply", "en_us_supply_tech", { wait: 3500 });
  t = await visibleText(r.p);
  const alts = await r.p.evaluate(() => [...document.querySelectorAll("img[alt]")].map((i) => i.alt).filter(Boolean));
  check(!alts.some((a) => /[ăâđêôơưạảấầậắằặẹẻếềệịọỏốồộớờợụủứừựỳỵỷỹ]/i.test(a) && !/^Ava|^Lily/.test(a)), "EN supply: image alts in English", alts.find((a) => VI_RE.test(a)) || "");
  check(!/\bVIC\b|Victoria/.test(t.slice(0, 2500)) || /A\$/.test(t), "EN supply (US tech): US listings first or AU prices labelled A$");
  await ctx.close();
}

// ---------- Sydney client Olivia (en-AU) ----------
{
  const ctx = await ctxFor({ locale: "en-AU", timezoneId: "Australia/Sydney", loginAs: "olivia.client@pawnailjobs.demo" });
  let r = await shot(ctx, "/trends", "en_au_client_trends");
  let t = await visibleText(r.p);
  check(!/Where salons are hiring|Weekly pay|Standout techs/.test(t), "AU client /trends: no hiring / pay sections");
  check(!/Fall nails|MongMuaThu|PawNailFall/.test(t), "AU client /trends (November): no northern-hemisphere fall challenge");
  r = await shot(ctx, "/designs", "en_au_client_designs");
  t = await visibleText(r.p);
  check(!/Thanksgiving|Halloween season|Fall nails/i.test(t), "AU client /designs: no Thanksgiving / fall chips");
  check(!/Post your work|Show off your real work|labeled illustrations/i.test(t), "AU client /designs: client hero, no 'Post your work'");
  r = await shot(ctx, "/designs?saved=1", "en_au_client_designs_saved");
  r = await shot(ctx, "/", "en_au_client_home");
  t = await visibleText(r.p);
  check(!/\bcolor\b|favorite|center\b/i.test(t), "en-AU client home: AU spelling", (t.match(/.{0,30}\b(color|favorite|center)\b.{0,30}/i) || [""])[0]);
  r = await shot(ctx, "/salons", "en_au_client_bell", {
    act: async (p) => { await p.getByRole("button", { name: /^Notifications/ }).first().click().catch(() => {}); await p.waitForTimeout(1500); },
  });
  t = await r.p.locator("body").innerText();
  check(!/When someone likes, comments on or reviews you/.test(t), "AU client bell: client-worded empty state / booking updates");
  await ctx.close();
}

// ---------- Vietnamese tech / owner ----------
{
  const ctx = await ctxFor({ locale: "vi-VN", cookie: "vi", loginAs: "tech11.au@pawnailjobs.demo" });
  let r = await shot(ctx, `/vi/jobs/${AU_JOB}`, "vi_au_job_detail");
  let t = await rawText(r.p);
  check(/Hình thức trả lương/.test(t) && /Lương tuần \(AUD\)/.test(t) && !/Theo tuần AUD/.test(t), "VI AU job: 'Hình thức trả lương: Lương tuần (AUD)'");
  r = await shot(ctx, "/vi?tab=feed", "vi_home_feed", { wait: 3500 });
  t = await rawText(r.p);
  check(!/Nhịp đau/.test(t), "VI feed: no 'Nhịp đau' wording");
  r = await shot(ctx, "/vi/tools/radar", "vi_radar_checklist");
  t = await rawText(r.p);
  check(!/Checklist|bao supply|TUẦN/.test(t), "VI radar: no 'Checklist' / 'bao supply' / shouted TUẦN", (t.match(/.{0,40}(Checklist|bao supply|TUẦN).{0,40}/) || [""])[0]);
  r = await shot(ctx, "/vi/consult", "vi_consult_tech");
  t = await rawText(r.p);
  check(!/chốt đơn|như thợ lâu năm/.test(t), "VI consult: professional copy");
  r = await shot(ctx, "/vi/tools/income-tracker", "vi_income_tracker_tech");
  t = await rawText(r.p);
  check(!/Số lượt làm \(Turn\)|Tổng Tip|\d{2}-\d{2} – \d{2}-\d{2}/.test(t), "VI income tracker: 'Số turn', 'Tổng tip', dd/mm week");
  r = await shot(ctx, "/vi/profile", "vi_my_profile_tech", { wait: 3500 });
  t = await rawText(r.p);
  check(!/Thẻ portfolio|Còn \d+ người/.test(t), "VI my profile: share card + invite copy");
  await ctx.close();
  const o = await ctxFor({ locale: "vi-VN", cookie: "vi", loginAs: "owner1.us@pawnailjobs.demo" });
  r = await shot(o, "/vi/jobs/create", "vi_owner_job_create", { wait: 3000 });
  t = await rawText(r.p);
  check(!/482\/EB3|Hỗ trợ dời bang|\(Housing\)/.test(t), "VI owner job create: market visa label, unified benefits");
  r = await shot(o, "/vi/profile", "vi_my_profile_owner", { wait: 3500 });
  t = await rawText(r.p);
  check(!/Thẻ portfolio/.test(t), "VI owner profile: 'Thẻ giới thiệu tiệm'");
  await o.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed — screenshots in ${OUT}`);
process.exit(fail ? 1 : 0);
