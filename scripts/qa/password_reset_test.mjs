// Quên mật khẩu qua email (Resend giả lập :4991) — luồng thật trên trình duyệt + API.
// CHỈ chạy với server local (scripts/qa/start-launch-server.sh).
//   node scripts/qa/password_reset_test.mjs
import http from "node:http";
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Results, fakeIp, registerUser } from "./lib.mjs";

const R = new Results("Quên mật khẩu");
const db = createClient({ url: "file:prisma/dev.db" });
const mails = [];
const resend = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const body = JSON.parse(b || "{}");
    mails.push({ auth: req.headers.authorization, path: req.url, ...body });
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization !== "Bearer test-resend") return res.writeHead(401).end(JSON.stringify({ message: "bad key" }));
    res.end(JSON.stringify({ id: "mail_" + mails.length }));
  });
});
await new Promise((r) => resend.listen(4991, "127.0.0.1", r));

const ip = fakeIp();
const post = async (path, json, ipOverride) => {
  const r = await fetch(BASE_URL + path, { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": ipOverride || ip }, body: JSON.stringify(json) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const tokenOf = (m) => (m?.text?.match(/token=([\w-]+)/) || [])[1];
const OLD = "QaPass#2026";
const NEW = "MoiDoi#2026!";
const errors = [];
let browser;

try {
  const u = await registerUser({ role: "TECHNICIAN", password: OLD });
  const email = u.body.email;

  const unknown = await post("/api/auth/forgot", { email: `khong-co-${Date.now()}@qa.test` });
  const known = await post("/api/auth/forgot", { email: email.toUpperCase() }, fakeIp());
  await new Promise((r) => setTimeout(r, 300));
  R.check("PR1", "Không để lộ email nào có tài khoản: email lạ và email thật nhận CÙNG câu trả lời; email lạ không gửi thư", unknown.status === 200 && known.status === 200 && unknown.data.message === known.data.message && mails.length === 1, JSON.stringify({ unknown, known, n: mails.length }));
  const m = mails[0];
  const token = tokenOf(m);
  R.check("PR2", "Gửi đúng 1 thư tới đúng email (chữ hoa/thường đều nhận), qua khoá Resend, từ PawNail Jobs, có link /auth/reset?token=…, song ngữ", m && m.to?.[0] === email && m.auth === "Bearer test-resend" && m.path === "/emails" && /PawNail Jobs/.test(m.from) && !!token && token.length >= 40 && /Đặt lại mật khẩu/.test(m.subject) && /Reset/.test(m.subject) && m.html.includes(`/auth/reset?token=${token}`), JSON.stringify(m)?.slice(0, 200));
  const stored = (await db.execute(`SELECT tokenHash FROM "PasswordReset" ORDER BY createdAt DESC LIMIT 1`)).rows[0]?.tokenHash;
  R.check("PR3", "Chỉ lưu HASH của mã trong DB (mã thật chỉ nằm trong email)", !!stored && stored !== token && /^[0-9a-f]{64}$/.test(String(stored)));

  // ---- Giao diện ----
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), "cf-connecting-ip": fakeIp() } }));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p.goto(BASE_URL + "/auth/login");
  await p.getByRole("link", { name: /Quên mật khẩu/ }).click();
  await p.waitForURL(/\/auth\/forgot/, { timeout: 10000 });
  await p.locator("#forgot-email").fill(email);
  await p.getByRole("button", { name: /Gửi link đặt lại/ }).click();
  const okMsg = await p.getByRole("status").filter({ hasText: /vừa gửi link đặt lại/ }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  R.check("PR4", "Trang đăng nhập → 'Quên mật khẩu' → nhập email → báo đã gửi (không còn ngõ cụt 'liên hệ support')", okMsg && mails.length === 2);
  const token2 = tokenOf(mails[1]);

  await p.goto(BASE_URL + `/auth/reset?token=${token2}`);
  await p.locator("#new-password").fill(NEW);
  await p.locator("#confirm-password").fill(NEW + "x");
  await p.getByRole("button", { name: /Lưu mật khẩu mới/ }).click();
  const mismatch = await p.getByRole("alert").filter({ hasText: /chưa giống nhau/ }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
  await p.locator("#confirm-password").fill(NEW);
  await p.getByRole("button", { name: /Lưu mật khẩu mới/ }).click();
  const saved = await p.getByRole("status").filter({ hasText: /Đã đổi mật khẩu/ }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  const toLogin = await p.waitForURL(/\/auth\/login/, { timeout: 10000 }).then(() => true).catch(() => false);
  R.check("PR5", "Đặt mật khẩu mới: báo lỗi khi 2 ô không khớp; lưu xong tự chuyển về đăng nhập", mismatch && saved && toLogin);

  const login = async (pw) => {
    const c2 = await browser.newContext();
    const h = { "cf-connecting-ip": fakeIp() };
    const csrf = await (await c2.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
    await c2.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: pw, json: "true" }, headers: h });
    const s = await (await c2.request.get(BASE_URL + "/api/auth/session", { headers: h })).json();
    await c2.close();
    return !!s?.user?.id;
  };
  R.check("PR6", "Đăng nhập bằng mật khẩu MỚI được, mật khẩu CŨ bị từ chối", (await login(NEW)) && !(await login(OLD)));

  const reuse = await post("/api/auth/reset", { token: token2, password: "KhacNua#2026" }, fakeIp());
  const oldTok = await post("/api/auth/reset", { token, password: "KhacNua#2026" }, fakeIp());
  R.check("PR7", "Link đã dùng → từ chối; đặt lại xong thì mọi link cũ khác cũng bị huỷ", reuse.status === 410 && oldTok.status === 410, `${reuse.status} ${oldTok.status}`);

  await post("/api/auth/forgot", { email }, fakeIp());
  await new Promise((r) => setTimeout(r, 200));
  const t3 = tokenOf(mails.at(-1));
  await db.execute(`UPDATE "PasswordReset" SET expiresAt = ${Date.now() - 1000} WHERE usedAt IS NULL`);
  const expired = await post("/api/auth/reset", { token: t3, password: "KhacNua#2026" }, fakeIp());
  const bad = await post("/api/auth/reset", { token: "khong-dung-" + "x".repeat(40), password: "KhacNua#2026" }, fakeIp());
  const shortPw = await post("/api/auth/reset", { token: t3, password: "123" }, fakeIp());
  R.check("PR8", "Link hết hạn (30 phút) / mã bịa → từ chối; mật khẩu < 8 ký tự → báo lỗi", expired.status === 410 && bad.status === 410 && shortPw.status === 400, `${expired.status} ${bad.status} ${shortPw.status}`);

  const before = mails.length;
  for (let k = 0; k < 3; k++) await post("/api/auth/forgot", { email }, fakeIp());
  await new Promise((r) => setTimeout(r, 300));
  R.check("PR9", "Mỗi email tối đa 3 link / giờ (chống spam hộp thư người khác)", mails.length - before <= 1 && mails.length - before >= 0, `${mails.length - before} thư thêm`);

  const sameIp = fakeIp();
  const codes = [];
  for (let k = 0; k < 6; k++) codes.push((await post("/api/auth/forgot", { email: `x${k}@qa.test` }, sameIp)).status);
  R.check("PR10", "Cùng 1 IP gọi quá 5 lần / 15 phút → 429", codes.slice(0, 5).every((c) => c === 200) && codes[5] === 429, codes.join(","));
  const badEmail = await post("/api/auth/forgot", { email: "khong-phai-email" }, fakeIp());
  R.check("PR11", "Email sai định dạng → 400", badEmail.status === 400);
  R.check("PR12", "Không lỗi JS", errors.length === 0, errors.join(" | "));
} finally {
  await browser?.close();
  resend.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
