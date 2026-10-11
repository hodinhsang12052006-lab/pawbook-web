// Thẻ "Sức khoẻ tăng trưởng" (admin) + ghi nhận cài app. CHỈ chạy với server local.
//   node scripts/qa/growth_test.mjs
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Results, registerUser } from "./lib.mjs";

const R = new Results("Sức khoẻ tăng trưởng");
const db = createClient({ url: "file:prisma/dev.db" });
const errors = [];
let browser;
const realCount = async (role) => Number((await db.execute({ sql: `SELECT COUNT(*) n FROM "User" WHERE role = ? AND email NOT LIKE '%pawnailjobs.demo'`, args: [role] })).rows[0].n);

try {
  const a = await registerUser({ role: "OWNER", name: "QA Admin", salonName: "Admin QA" });
  await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE email = ?`, args: [a.body.email] });
  await a.client.login(a.body.email, a.body.password);
  const t = await registerUser({ role: "TECHNICIAN", name: "Thu Ha", ref: undefined });
  await t.client.login(t.body.email, t.body.password);

  const anon = await fetch(BASE_URL + "/api/admin/growth");
  const notAdmin = await t.client.req("/api/admin/growth");
  R.check("G1", "Chỉ admin xem được số liệu (khách 401, thợ 403)", anon.status === 401 && notAdmin.status === 403);

  const g = (await a.client.req("/api/admin/growth")).data;
  const demoUsers = Number((await db.execute(`SELECT COUNT(*) n FROM "User" WHERE email LIKE '%pawnailjobs.demo'`)).rows[0].n);
  R.check("G2", "Đếm người dùng THẬT (loại tài khoản mẫu + admin)", g.users.techs === (await realCount("TECHNICIAN")) && g.users.owners === (await realCount("OWNER")) && g.users.total === g.users.techs + g.users.owners, JSON.stringify(g.users));
  R.check("G3", "Báo riêng số dữ liệu mẫu", g.demo.users === demoUsers && demoUsers > 0, JSON.stringify(g.demo));
  R.check("G4", "Không lộ thông tin cá nhân (chỉ số đếm)", !/@|email"|name"/.test(JSON.stringify(g).replace(/"email":\{/, "")));

  // Ghi nhận cài app: thợ mở PawNail từ màn hình chính
  const before = g.install.installed;
  const i1 = await t.client.req("/api/me/installed", { method: "POST" });
  const i2 = await t.client.req("/api/me/installed", { method: "POST" });
  const anonI = await fetch(BASE_URL + "/api/me/installed", { method: "POST" });
  const g2 = (await a.client.req("/api/admin/growth")).data;
  R.check("G5", "Ghi nhận cài app 1 lần / người (gọi lại không cộng thêm), khách bị chặn", i1.status === 200 && i2.status === 200 && anonI.status === 401 && g2.install.installed === before + 1, `${before}→${g2.install.installed}`);

  // Giao diện admin
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "vi-VN" });
  const u = new URL(BASE_URL);
  await ctx.addCookies(Object.entries(a.client.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p.goto(BASE_URL + "/admin/studio");
  const card = p.getByTestId("growth-health");
  await card.waitFor({ timeout: 20000 });
  const txt = await card.innerText();
  R.check("G6", "Studio có thẻ Sức khoẻ tăng trưởng: người dùng thật, email, mời bạn, cài app, dữ liệu nhập sẵn", /Người dùng thật/.test(txt) && /Email tuần/.test(txt) && /Mời bạn bè/.test(txt) && /Đã cài app/.test(txt) && /Dữ liệu nhập sẵn/.test(txt), txt.slice(0, 200));
  await card.screenshot({ path: `${process.env.TEMP || "."}/growth_card.png` }).catch(() => {});

  // Thợ mở app ở chế độ đã cài (standalone) → tự báo
  const ctx2 = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const t2 = await registerUser({ role: "TECHNICIAN", name: "Mai Anh" });
  await t2.client.login(t2.body.email, t2.body.password);
  await ctx2.addCookies(Object.entries(t2.client.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
  await ctx2.addInitScript(() => {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q.includes("display-mode: standalone") ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : mm(q));
  });
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p2.goto(BASE_URL + "/");
  await p2.waitForTimeout(4000);
  const row = (await db.execute({ sql: `SELECT pwaInstalledAt FROM "User" WHERE email = ?`, args: [t2.body.email] })).rows[0];
  R.check("G7", "Mở PawNail từ màn hình chính (đã đăng nhập) → tự ghi nhận đã cài", !!row?.pwaInstalledAt);
  R.check("G8", "Không lỗi JS", errors.length === 0, errors.join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
