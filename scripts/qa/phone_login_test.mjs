// Đăng nhập / đăng ký bằng SĐT + mã SMS (Twilio Verify giả :4997, mã đúng = 123456).
// CHỈ chạy với server local (scripts/qa/start-launch-server.sh).   node scripts/qa/phone_login_test.mjs
import http from "node:http";
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Client, Results, registerUser } from "./lib.mjs";
// IP ngẫu nhiên mỗi lần chạy — log SMS nằm trong DB nên IP cố định sẽ dính hạn mức của lần chạy trước.
const fakeIp = () => `10.${1 + Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

const R = new Results("Đăng nhập bằng SĐT");
const db = createClient({ url: "file:prisma/dev.db" });
const sms = [];
const tw = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const f = Object.fromEntries(new URLSearchParams(b)); sms.push({ path: req.url, ...f });
    res.setHeader("content-type", "application/json");
    if (req.url.endsWith("/Verifications")) return res.writeHead(201).end(JSON.stringify({ status: "pending" }));
    if (req.url.endsWith("/VerificationCheck")) return res.writeHead(200).end(JSON.stringify({ status: f.Code === "123456" ? "approved" : "pending" }));
    res.writeHead(404).end("{}");
  });
});
await new Promise((r) => tw.listen(4997, "127.0.0.1", r));
const mails = [];
const resend = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { mails.push(b); res.writeHead(200, { "content-type": "application/json" }).end('{"id":"x"}'); }); });
await new Promise((r) => resend.listen(4991, "127.0.0.1", r));

const start = (phone, market = "US", ip = fakeIp()) => fetch(BASE_URL + "/api/auth/phone/start", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify({ phone, market }) }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
async function phoneSignIn(c, phone, code, market = "US") {
  const csrf = (await c.req("/api/auth/csrf")).data.csrfToken;
  await c.req("/api/auth/callback/phone-otp", { method: "POST", body: new URLSearchParams({ csrfToken: csrf, phone, market, code, json: "true" }).toString(), headers: { "content-type": "application/x-www-form-urlencoded" } });
  return (await c.req("/api/auth/session")).data?.user || null;
}
const uniq = () => String(Math.floor(2000000 + Math.random() * 7999999));
const errors = [];
let browser;

try {
  const prov = (await new Client().req("/api/auth/providers")).data;
  R.check("P1", "Có cách đăng nhập 'phone-otp' khi đã cấu hình Twilio", !!prov["phone-otp"]);

  const bad = await Promise.all([start("+84 912 345 678"), start("+44 7700 900123"), start("123"), start("+1 011 555 0100")]);
  R.check("P2", "Chống 'bơm SMS': số Việt Nam/Anh/sai định dạng bị từ chối, KHÔNG gửi SMS", bad.every((r) => r.status === 400) && sms.length === 0, bad.map((r) => r.status).join());

  const num = `408${uniq()}`;
  const s1 = await start(num);
  R.check("P3", "Số Mỹ hợp lệ → gửi mã qua Twilio Verify, che số trong phản hồi", s1.status === 200 && sms.at(-1)?.To === `+1${num}` && /•/.test(s1.data.to), JSON.stringify(s1));

  const c = new Client();
  const wrong = await phoneSignIn(c, num, "000000");
  R.check("P4", "Nhập SAI mã → không đăng nhập", !wrong?.id);
  const u1 = await phoneSignIn(c, num, "123456");
  const row = (await db.execute({ sql: `SELECT u.id, u.email, u.phone, u.password, pv.phone pv FROM "User" u LEFT JOIN "PhoneVerification" pv ON pv.userId = u.id WHERE u.id = ?`, args: [u1?.id || ""] })).rows[0];
  R.check("P5", "Mã đúng + số mới → tạo tài khoản, SĐT đã xác minh, phải chọn vai trò/khu vực", !!u1?.id && u1.needsOnboarding === true && row?.pv === `+1${num}` && String(row?.email).endsWith("@phone.invalid") && String(row?.password).startsWith("oauth:"), JSON.stringify({ u1, row }));
  const comp = await c.req("/api/profile/complete", { method: "POST", json: { role: "OWNER", market: "US", state: "CA", city: "San Jose", phone: `+1 ${num}`, name: "Chị Hằng" } });
  const s2 = (await c.req("/api/auth/session")).data?.user;
  R.check("P6", "Hoàn tất (chủ tiệm, CA) → vào app bình thường", comp.status === 200 && s2?.role === "OWNER" && !s2?.needsOnboarding, JSON.stringify(s2));

  const c2 = new Client();
  await start(num);
  const again = await phoneSignIn(c2, num, "123456");
  R.check("P7", "Đăng nhập lại cùng số → ĐÚNG tài khoản cũ, không phải hoàn tất lại", again?.id === u1.id && !again?.needsOnboarding);

  // Tài khoản email có SĐT đã xác minh trong hồ sơ → đăng nhập bằng SĐT vào đúng tài khoản đó
  const enum2 = `713${uniq()}`;
  const e = await registerUser({ name: "Có Email", phone: `+1 ${enum2}`, state: "TX", city: "Houston" });
  await e.client.login(e.body.email, e.body.password);
  await e.client.req("/api/phone/verify", { method: "POST", json: { action: "send" } });
  const chk = await e.client.req("/api/phone/verify", { method: "POST", json: { action: "check", code: "123456" } });
  const c3 = new Client();
  await start(enum2);
  const viaPhone = await phoneSignIn(c3, enum2, "123456");
  R.check("P8", "Tài khoản email đã xác minh SĐT → đăng nhập bằng SĐT vào ĐÚNG tài khoản đó (không tạo trùng)", chk.status === 200 && viaPhone?.id === e.client.userId, `${chk.status} ${viaPhone?.id} vs ${e.client.userId}`);

  // Số chỉ GÕ trong hồ sơ (chưa xác minh) không được dùng để chiếm tài khoản
  const vnum = `214${uniq()}`;
  const victim = await registerUser({ name: "Nạn Nhân", phone: `+1 ${vnum}`, state: "TX", city: "Dallas" });
  await victim.client.login(victim.body.email, victim.body.password);
  const c4 = new Client();
  await start(vnum);
  const hijack = await phoneSignIn(c4, vnum, "123456");
  R.check("P9", "Số chỉ gõ trong hồ sơ người khác (chưa xác minh) → KHÔNG vào được tài khoản họ", !!hijack?.id && hijack.id !== victim.client.userId);

  // Giới hạn gửi
  const qn = `650${uniq()}`;
  const ip = fakeIp();
  const qs = [];
  for (let i = 0; i < 4; i++) qs.push((await start(qn, "US", fakeIp())).status);
  R.check("P10", "Cùng 1 số: tối đa 3 mã/giờ (lần 4 → 429)", qs.slice(0, 3).every((s) => s === 200) && qs[3] === 429, qs.join());
  const ipq = [];
  for (let i = 0; i < 7; i++) ipq.push((await start(`650${uniq()}`, "US", ip)).status);
  R.check("P11", "Cùng 1 IP: bị chặn sau 5 lần/15 phút", ipq.includes(429) && ipq.slice(0, 5).every((s) => s === 200), ipq.join());

  // Số Úc
  const au = await start("0412 345 678", "AU");
  R.check("P12", "Số Úc (04xx) → chuẩn hoá +614…, gửi được", au.status === 200 && sms.some((m) => m.To === "+61412345678"));

  // Quên mật khẩu với tài khoản chỉ có SĐT → không gửi thư tới địa chỉ giữ chỗ
  const n0 = mails.length;
  await fetch(BASE_URL + "/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": fakeIp() }, body: JSON.stringify({ email: row.email }) });
  R.check("P13", "Tài khoản chỉ có SĐT: 'quên mật khẩu' không gửi thư đi đâu cả", mails.length === n0);

  // Giao diện: khách mới đi trọn từ trang đăng nhập
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), "cf-connecting-ip": fakeIp() } }));
  const p = await ctx.newPage();
  p.on("pageerror", (er) => errors.push(er.message.slice(0, 140)));
  await p.goto(BASE_URL + "/auth/register");
  await p.getByRole("button", { name: /Tiếp tục với số điện thoại/ }).first().click({ timeout: 15000 });
  const uiNum = `310${uniq()}`;
  await p.locator("#pl-phone").fill(uiNum);
  await p.getByRole("button", { name: /Gửi mã xác minh/ }).click();
  await p.locator("#pl-code").waitFor({ timeout: 10000 });
  await p.screenshot({ path: `${process.env.TEMP || "."}/phone_code.png` }).catch(() => {});
  await p.locator("#pl-code").fill("123456"); // đủ 6 số → tự gửi
  await p.waitForURL(/\/auth\/complete/, { timeout: 20000 });
  await p.getByText("Chào mừng bạn!").waitFor({ timeout: 15000 });
  const pre = await p.locator("#c-phone").inputValue().catch(() => "");
  const nameVal = await p.locator("#c-name").inputValue();
  R.check("P14", "Giao diện: nhập số → mã → trang Hoàn tất, SĐT điền sẵn, tên để trống cho tự nhập", pre.replace(/\D/g, "") === uiNum && nameVal === "", `phone=${pre} name=${nameVal}`);
  await p.locator("#c-name").fill("Thảo Vy");
  await p.getByRole("radio", { name: /Tôi là Thợ/ }).click();
  await p.getByLabel(/Thành phố/).fill("Los Angeles");
  await p.getByRole("button", { name: /Vào PawNail/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
  const sess = await p.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
  R.check("P15", "Hoàn tất → vào app, đúng tên & vai trò", sess.user?.name === "Thảo Vy" && sess.user?.role === "TECHNICIAN", JSON.stringify(sess.user));
  R.check("P16", "Không lỗi JS", errors.length === 0, errors.join(" | "));
} catch (e2) {
  R.check("FATAL", String(e2?.message || e2).slice(0, 200), false);
} finally {
  await browser?.close();
  tw.close(); resend.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
