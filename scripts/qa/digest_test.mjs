// Email tóm tắt hằng tuần + thông báo "tiệm vừa xem hồ sơ" (Resend giả lập :4991).
// CHỈ chạy với server local (scripts/qa/start-launch-server.sh) — có sửa DB local.
//   node scripts/qa/digest_test.mjs
import http from "node:http";
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Results, registerUser } from "./lib.mjs";

const R = new Results("Email tóm tắt");
const db = createClient({ url: "file:prisma/dev.db" });
const mails = [];
const resend = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    mails.push({ auth: req.headers.authorization, ...JSON.parse(b || "{}") });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "mail_" + mails.length }));
  });
});
await new Promise((r) => resend.listen(4991, "127.0.0.1", r));
const cron = (h = { authorization: "Bearer test-cron" }) => fetch(BASE_URL + "/api/cron/digest", { headers: h }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
const digestOf = async (id) => (await db.execute({ sql: `SELECT emailDigest, lastDigestAt FROM "User" WHERE id = ?`, args: [id] })).rows[0];
const errors = [];
let browser;

try {
  const noAuth = await cron({});
  R.check("D1", "Cron từ chối khi không có CRON_SECRET", noAuth.status === 401);

  const stamp = Date.now();
  const tech = await registerUser({ role: "TECHNICIAN", state: "CA", name: "Lan Nguyen" });
  const owner = await registerUser({ role: "OWNER", state: "CA", name: "Kim Salon", salonName: "Kim Nails QA" });
  const fake = await registerUser({ role: "TECHNICIAN", state: "CA" });
  await tech.client.login(tech.body.email, tech.body.password);
  await owner.client.login(owner.body.email, owner.body.password);
  const techId = tech.client.userId, ownerId = owner.client.userId;
  await fake.client.login(fake.body.email, fake.body.password);
  const fakeId = fake.client.userId;

  // Chủ tiệm mở hồ sơ thợ → lượt xem thật (đường API thật, kèm Pusher + push).
  const v = await owner.client.req("/api/profile/views", { method: "POST", json: { profileId: techId } });
  await new Promise((r) => setTimeout(r, 800));
  const notif = await tech.client.req("/api/notifications");
  const viewItem = (notif.data?.items || []).find((i) => i.kind === "view");
  R.check("N1", "Thợ thấy thông báo 'chủ tiệm vừa xem hồ sơ' trong chuông, link về hồ sơ tiệm", v.status === 200 && !!viewItem && viewItem.actor?.id === ownerId && viewItem.href === `/profile/${ownerId}` && /vừa xem hồ sơ/.test(viewItem.text), JSON.stringify(viewItem || notif.data).slice(0, 200));
  const ownerNotif = await owner.client.req("/api/notifications");
  R.check("N2", "Chủ tiệm KHÔNG nhận loại thông báo 'view' của thợ", !(ownerNotif.data?.items || []).some((i) => i.kind === "view"));

  // Chỉ 3 tài khoản test đủ điều kiện; email thật-giả (example.com) cho 2 người, 1 người giữ @qa.test.
  await db.execute(`UPDATE "User" SET emailDigest = 0`);
  const old = Date.now() - 3 * 86_400_000; // Prisma + SQLite lưu DateTime dạng số ms
  for (const [id, email] of [[techId, `lan.${stamp}@example.com`], [ownerId, `kim.${stamp}@example.com`], [fakeId, null]]) {
    await db.execute({ sql: `UPDATE "User" SET emailDigest = 1, lastDigestAt = NULL, createdAt = ?${email ? ", email = ?" : ""} WHERE id = ?`, args: email ? [old, email, id] : [old, id] });
  }

  const r1 = await cron();
  const toTech = mails.find((m) => m.to?.[0] === `lan.${stamp}@example.com`);
  const toOwner = mails.find((m) => m.to?.[0] === `kim.${stamp}@example.com`);
  R.check("D2", "Cron gửi đúng 2 thư (thợ + chủ tiệm), bỏ qua email @qa.test", r1.status === 200 && r1.data.sent === 2 && mails.length === 2 && !!toTech && !!toOwner, JSON.stringify(r1.data));
  R.check("D3", "Thư thợ: tiêu đề nói số tiệm đã xem hồ sơ, có tên, có link /jobs + link hủy nhận", !!toTech && /tiệm đã xem hồ sơ bạn/.test(toTech.subject) && /Chào Lan Nguyen/.test(toTech.html) && toTech.html.includes("/api/email/unsubscribe?u=" + techId) && toTech.text.includes("Hủy nhận"), toTech?.subject);
  R.check("D4", "Thư chủ tiệm: có thợ đang rảnh tại California + link hồ sơ thợ", !!toOwner && /thợ đang rảnh tại California/.test(toOwner.subject) && toOwner.html.includes(`/profile/${techId}`), toOwner?.subject);
  for (const [k, m] of [["tech", toTech], ["owner", toOwner]]) if (m) (await import("node:fs")).writeFileSync(`${process.env.TEMP || "."}/digest_${k}.html`, m.html);
  R.check("D5", "Có header List-Unsubscribe + one-click (Gmail/Apple Mail hiện nút Hủy)", !!toTech?.headers?.["List-Unsubscribe"]?.includes("/api/email/unsubscribe") && toTech.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
  R.check("D6", "Nội dung escape HTML, không có 'undefined'/'null'", !!toTech && !/undefined|>null</.test(toTech.html + toOwner.html));
  const fakeRow = await digestOf(fakeId);
  R.check("D7", "Người bị bỏ qua vẫn được đánh dấu (không xét lại mỗi ngày)", !!fakeRow?.lastDigestAt);

  const r2 = await cron();
  R.check("D8", "Chạy lại cùng ngày: không gửi trùng", r2.data.sent === 0 && mails.length === 2, JSON.stringify(r2.data));

  // Hủy nhận
  const link = toTech.html.match(/href="([^"]*\/api\/email\/unsubscribe[^"]*)"/)[1].replace(/&amp;/g, "&");
  const local = BASE_URL + new URL(link).pathname + new URL(link).search;
  const bad = await fetch(local.replace(/s=[^&]+/, "s=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
  R.check("D9", "Chữ ký sai → 400, vẫn nhận email", bad.status === 400 && Number((await digestOf(techId)).emailDigest) === 1);
  const good = await fetch(local, { method: "POST" });
  R.check("D10", "Link hủy (one-click POST) → tắt email tóm tắt, trang xác nhận tiếng Việt", good.status === 200 && /Đã hủy nhận/.test(await good.text()) && Number((await digestOf(techId)).emailDigest) === 0);

  // API tùy chọn
  const g1 = await tech.client.req("/api/email/prefs");
  const p1 = await tech.client.req("/api/email/prefs", { method: "POST", json: { emailDigest: "yes" } });
  const anon = await fetch(BASE_URL + "/api/email/prefs");
  R.check("D11", "API tùy chọn: đọc đúng trạng thái, chặn dữ liệu sai, chặn khách", g1.data?.emailDigest === false && p1.status === 400 && anon.status === 401);

  // Giao diện: nút gạt trong Hồ sơ
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const u = new URL(BASE_URL);
  await ctx.addCookies(Object.entries(tech.client.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p.goto(BASE_URL + "/profile");
  const sw = p.getByTestId("email-digest-toggle");
  await sw.scrollIntoViewIfNeeded({ timeout: 15000 });
  await p.waitForFunction(() => !document.querySelector('[data-testid="email-digest-toggle"]')?.hasAttribute("disabled"));
  const before = await sw.getAttribute("aria-checked");
  await sw.click();
  await p.waitForTimeout(800);
  const after = await sw.getAttribute("aria-checked");
  R.check("D12", "Hồ sơ có nút gạt 'Email tóm tắt mỗi tuần', bấm là lưu ngay vào DB", before === "false" && after === "true" && Number((await digestOf(techId)).emailDigest) === 1, `${before}→${after}`);
  await p.screenshot({ path: `${process.env.TEMP || "."}/digest_toggle.png` }).catch(() => {});
  R.check("D13", "Không lỗi JS trên trang", errors.length === 0, errors.join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser?.close();
  resend.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
