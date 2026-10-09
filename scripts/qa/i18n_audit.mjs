// Quét song ngữ: mở mọi trang ở chế độ EN và tìm chữ TIẾNG VIỆT còn sót (và
// ngược lại ở chế độ VI tìm cụm tiếng Anh lạc). Nội dung người dùng tự viết
// (tên, tiêu đề tin, bài đăng…) được lọc bằng danh sách dữ liệu seed + vùng
// đánh dấu. In ra danh sách chuỗi kèm trang để sửa.
//   node scripts/qa/i18n_audit.mjs [en|vi]
import fs from "node:fs";
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, fakeIp } from "./lib.mjs";

const MODE = process.argv[2] || "en";
const db = createClient({ url: "file:prisma/dev.db" });
const VN = /[ạảấầậắằặẹẻếềệịọỏốồộớờợụủứừựỳỵỷỹđĐăâêôơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂƠƯàáãèéìíòóõùúý]/;

// Chữ do NGƯỜI DÙNG/dữ liệu tạo ra (không phải giao diện) → bỏ qua khi quét.
const data = new Set();
for (const sql of [
  `SELECT name AS t FROM "User"`, `SELECT city AS t FROM "User"`, `SELECT title AS t FROM "Job"`, `SELECT salonName AS t FROM "Job"`,
  `SELECT description AS t FROM "Job"`, `SELECT city AS t FROM "Job"`, `SELECT content AS t FROM "Post"`, `SELECT content AS t FROM "PostComment"`,
  `SELECT body AS t FROM "Message"`, `SELECT title AS t FROM "SupplyProduct"`, `SELECT description AS t FROM "SupplyProduct"`, `SELECT bio AS t FROM "TechnicianProfile"`,
  `SELECT comment AS t FROM "Review"`, `SELECT turnSplitPolicy AS t FROM "User"`, `SELECT clientTypePolicy AS t FROM "User"`, `SELECT salaryAmount AS t FROM "Job"`,
]) {
  try {
    for (const r of (await db.execute(sql)).rows) if (r.t) for (const part of String(r.t).split(/\n+/)) data.add(part.trim());
  } catch {}
}
const isData = (s) => [...data].some((d) => d && (d === s || (d.length > 12 && (s.includes(d) || d.includes(s)))));

const browser = await chromium.launch();
async function ctx(locale) {
  const c = await browser.newContext({ ...devices["Pixel 7"], locale: locale === "en" ? "en-US" : "vi-VN" });
  await c.addInitScript((m) => {
    try {
      localStorage.setItem("bitpaw_locale", m);
      sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
      localStorage.setItem("pn_push_dismissed_at", String(Date.now()));
    } catch {}
  }, locale);
  const ip = fakeIp();
  await c.route(BASE_URL + "/**", (route) => route.continue({ headers: { ...route.request().headers(), "cf-connecting-ip": ip } }));
  return c;
}
async function login(c, email) {
  const p = await c.newPage();
  await p.goto(BASE_URL + "/auth/login");
  await p.locator("#email").fill(email);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.locator('button[type="submit"]').click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  return p;
}

// Thu chữ hiển thị + placeholder/aria-label/title của trang hiện tại.
async function harvest(p) {
  await p.waitForTimeout(1800);
  return p.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const el = n.parentElement;
      if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (t) out.push(t);
    }
    for (const el of document.querySelectorAll("[placeholder],[aria-label],[title],img[alt]")) {
      for (const a of ["placeholder", "aria-label", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v && v.trim()) out.push(`[${a}] ${v.trim()}`);
      }
    }
    return out;
  });
}

const found = new Map(); // chuỗi → tập trang
const EN_WORDS = /\b(Loading|Submit|Cancel|Save|Delete|Search|Message|Messages|Profile|Settings|Close|Back|Next|Share|Report|Block|Pinned|Official|Verified|Sign in|Log in|Share card|New|Hot|Urgent|Jobs?|Feed)\b/;
function record(page, strings) {
  for (const raw of strings) {
    const s = raw.replace(/^\[(placeholder|aria-label|title|alt)\] /, "");
    if (MODE === "en") {
      if (!VN.test(s) || isData(s)) continue;
    } else {
      // VI: cụm tiếng Anh thuần (không dấu, ≥2 từ hoặc từ UI phổ biến) — bỏ thương hiệu/tên riêng.
      if (VN.test(s) || isData(s) || !EN_WORDS.test(s) || /PawNail|Nail Radar|Gel-X|Dip\/SNS|Acrylic|Design|Wax|Studio|Portfolio|GIF|POS|Supply|Halloween|TikTok|Facebook|Instagram|iPhone|Android|Google|Apple|App Store|Zalo|Live|Demo|OK|US|AU/.test(s)) continue;
    }
    if (!found.has(raw)) found.set(raw, new Set());
    found.get(raw).add(page);
  }
}

const techId = (await db.execute({ sql: `SELECT id FROM "User" WHERE email = ?`, args: [SEED_TECH] })).rows[0].id;
const ownerId = (await db.execute({ sql: `SELECT id FROM "User" WHERE email = ?`, args: [SEED_OWNER] })).rows[0].id;
const jobId = (await db.execute(`SELECT id FROM "Job" LIMIT 1`)).rows[0].id;

// ----- Khách -----
{
  const c = await ctx(MODE);
  const p = await c.newPage();
  for (const path of ["/auth/register", "/auth/register?role=technician", "/auth/register?role=owner", "/auth/login", "/terms", "/privacy", "/offline", "/khong-ton-tai-404"]) {
    await p.goto(BASE_URL + path).catch(() => {});
    record("khách " + path, await harvest(p));
  }
  // các bước đăng ký thợ
  await p.goto(BASE_URL + "/auth/register?role=technician");
  await p.getByPlaceholder(/Kim Nails/).fill("Audit");
  await p.locator('input[type="tel"], input[placeholder*="555"]').first().fill("7135550100");
  await p.getByPlaceholder(/Los Angeles/).fill("Houston");
  await p.locator('input[type="email"]').fill(`audit.${Date.now()}@qa.test`);
  await p.locator('input[type="password"]').fill("QaPass#2026");
  await p.locator("button").filter({ hasText: /Tiếp tục|Continue|Next/ }).first().click();
  record("khách đăng ký thợ bước 2", await harvest(p));
  await p.locator("button").filter({ hasText: /Tiếp tục|Continue|Next/ }).last().click().catch(() => {});
  record("khách đăng ký thợ bước 3", await harvest(p));
  // khảo sát chủ tiệm + tóm tắt
  const c2 = await ctx(MODE); // ngữ cảnh mới (đăng ký thợ ở trên có thể đã đăng nhập)
  const q = await c2.newPage();
  await q.goto(BASE_URL + "/auth/register?role=owner");
  const inputs = q.locator("input:not([type=checkbox])");
  await q.getByPlaceholder(/Nguyễn Văn A|John|Nguyen/).fill("Audit Owner").catch(() => {});
  await q.getByPlaceholder(/Happy Nails/).fill("Audit Nails");
  await q.getByPlaceholder(/Los Angeles/).fill("Dallas");
  await q.locator('input[placeholder*="555"]').first().fill("2145550100");
  await q.getByPlaceholder(/\$1,200/).fill("$1,300").catch(() => {});
  await q.locator('input[type="email"]').fill(`audit.o.${Date.now()}@qa.test`);
  await q.locator('input[type="password"]').fill("QaPass#2026");
  void inputs;
  await q.locator("button").filter({ hasText: /khảo sát|survey/i }).first().click();
  record("khách khảo sát chủ tiệm", await harvest(q));
  for (let i = 0; i < 5; i++) {
    await q.locator("button.w-full.text-left").first().click().catch(() => {});
    await q.waitForTimeout(700);
  }
  await q.waitForTimeout(4000);
  record("chủ tiệm mới: tóm tắt khảo sát", await harvest(q));
  await q.locator("button").filter({ hasText: /Xem trước|Preview/ }).first().click().catch(() => {});
  record("chủ tiệm mới: xem trước demo", await harvest(q));
  await c.close();
  await c2.close();
}

// ----- Thợ -----
{
  const c = await ctx(MODE);
  const p = await login(c, SEED_TECH);
  const paths = ["/", "/?tab=feed", "/?tab=jobs", "/?tab=portfolio", "/messages", `/messages?to=${ownerId}`, "/profile", `/profile/${techId}`, `/profile/${ownerId}`, `/jobs/${jobId}`, "/trends", "/tools/radar", "/tools/income-tracker", "/supply"];
  for (const path of paths) {
    await p.goto(BASE_URL + path).catch(() => {});
    record("thợ " + path, await harvest(p));
  }
  // trạng thái mở: chuông, menu chat, hình nền, báo việc, thẻ chia sẻ
  await p.goto(BASE_URL + "/?tab=feed");
  await p.waitForTimeout(1500);
  await p.locator("header button").filter({ has: p.locator("svg") }).nth(0).click().catch(() => {});
  record("thợ: chuông thông báo", await harvest(p));
  await p.goto(BASE_URL + `/messages?to=${ownerId}`);
  await p.waitForTimeout(2500);
  await p.locator('button[title]').last().click().catch(() => {});
  record("thợ: menu chat", await harvest(p));
  await p.locator("button").filter({ hasText: /Hình nền|wallpaper/i }).first().click().catch(() => {});
  record("thợ: chọn hình nền", await harvest(p));
  await p.goto(BASE_URL + "/?tab=jobs");
  await p.waitForTimeout(1500);
  await p.locator("button").filter({ hasText: /Báo tôi|Alert me/ }).first().click().catch(() => {});
  record("thợ: hộp báo việc", await harvest(p));
  await p.goto(BASE_URL + "/profile");
  await p.waitForTimeout(1500);
  await p.locator("button").filter({ hasText: /thẻ chia sẻ|share card/i }).first().click().catch(() => {});
  await p.waitForTimeout(4000);
  record("thợ: thẻ chia sẻ", await harvest(p));
  await c.close();
}

// ----- Chủ tiệm -----
{
  const c = await ctx(MODE);
  const p = await login(c, SEED_OWNER);
  for (const path of ["/?tab=feed", "/?tab=portfolio", "/jobs/create", "/profile", `/profile/${techId}`, "/messages"]) {
    await p.goto(BASE_URL + path).catch(() => {});
    record("chủ " + path, await harvest(p));
  }
  await p.goto(BASE_URL + "/jobs/create");
  await p.getByPlaceholder(/Los Angeles/).fill("Dallas").catch(() => {});
  await p.getByPlaceholder(/Happy Nails/).fill("Audit").catch(() => {});
  for (let i = 0; i < 3; i++) {
    await p.locator("button").filter({ hasText: /Tiếp tục|Continue|Bỏ qua|Skip/ }).last().click().catch(() => {});
    record(`chủ: đăng tin bước ${i + 2}`, await harvest(p));
  }
  await c.close();
}

const rows = [...found.entries()].sort((a, b) => b[1].size - a[1].size);
const report = rows.map(([s, pages]) => `${s}    ⟵ ${[...pages].slice(0, 3).join(" | ")}${pages.size > 3 ? ` (+${pages.size - 3})` : ""}`).join("\n");
fs.writeFileSync(`${process.env.TEMP || "."}/i18n_audit_${MODE}.txt`, report);
console.log(report || "(sạch)");
console.log(`\n${MODE.toUpperCase()}: ${rows.length} chuỗi cần xem`);
await browser.close();
