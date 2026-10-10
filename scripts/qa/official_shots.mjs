// Chụp hồ sơ chính thức + trang chủ khi ĐĂNG NHẬP bằng tài khoản admin chính thức
// (iPhone + màn 1920px) — dùng để soát bố cục. CHỈ chạy với server local.
import fs from "node:fs";
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, registerUser } from "./lib.mjs";
const OUT = (process.env.TEMP || ".") + "/offshots";
fs.mkdirSync(OUT, { recursive: true });
const db = createClient({ url: "file:prisma/dev.db" });
let adm = (await db.execute(`SELECT id, email FROM "User" WHERE email LIKE 'official.shot.%' LIMIT 1`)).rows[0];
let pass = "QaPass#2026x";
if (!adm) {
  const a = await registerUser({ role: "OWNER", email: `official.shot.${Date.now()}@qa.test`, password: pass, name: "PawNail Jobs" });
  await db.execute({ sql: `UPDATE "User" SET role='ADMIN', name='PawNail Jobs', avatarUrl='/brand/pawnail-official.jpg' WHERE email=?`, args: [a.body.email] });
  adm = (await db.execute({ sql: `SELECT id, email FROM "User" WHERE email=?`, args: [a.body.email] })).rows[0];
  fs.writeFileSync(OUT + "/cred.json", JSON.stringify({ email: a.body.email, password: a.body.password }));
}
const cred = JSON.parse(fs.readFileSync(OUT + "/cred.json", "utf8"));
const b = await chromium.launch();
const tag = process.argv[2] || "before";
for (const [name, opt] of [["iphone", devices["iPhone 13"]], ["desktop", { viewport: { width: 1920, height: 1080 } }]]) {
  const c = await b.newContext({ ...opt, locale: "vi-VN" });
  await c.addInitScript(() => { try { sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 })); localStorage.setItem("pn_push_dismissed_at", String(Date.now())); } catch {} });
  const p = await c.newPage();
  await p.goto(BASE_URL + "/auth/login"); await p.locator("#email").fill(cred.email); await p.locator("#password").fill(cred.password);
  await p.locator('button[type="submit"]').click(); await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  await p.goto(BASE_URL + "/profile/" + adm.id); await p.waitForTimeout(3000);
  await p.screenshot({ path: `${OUT}/${tag}_${name}_profile.png`, fullPage: name === "iphone" });
  if (name === "iphone") { await p.goto(BASE_URL + "/?tab=feed"); await p.waitForTimeout(3000); await p.screenshot({ path: `${OUT}/${tag}_${name}_home.png`, fullPage: false }); }
  await c.close();
}
await b.close();
console.log("ok", OUT);
