// ĐÓNG VAI KHÁCH HÀNG: đăng ký Google / email, xác minh SĐT, đăng nhập sai, quên mật khẩu,
// rồi dùng thử — mỗi bước chụp màn hình + soi lỗi giao diện (tràn ngang, nút nhỏ, ảnh thiếu alt,
// lỗi JS, lỗi 5xx, chậm). CHỈ chạy với server local (start-launch-server.sh) — có máy chủ giả
// Google (:4996), SMS (:4997), email (:4991).    node scripts/qa/customer_journey.mjs
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { chromium, devices } from "playwright";
import { BASE_URL, Results } from "./lib.mjs";

const R = new Results("Hành trình khách hàng");
const OUT = `${process.env.TEMP || "."}/journey`;
fs.mkdirSync(OUT, { recursive: true });
const listen = (srv, port) => new Promise((r) => srv.listen(port, "127.0.0.1", r));
const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });

// ---- máy chủ giả ----
const sms = [];
const twilio = http.createServer(async (req, res) => {
  const form = Object.fromEntries(new URLSearchParams(await readBody(req)));
  sms.push(form);
  res.setHeader("content-type", "application/json");
  if (req.url.endsWith("/Verifications")) return res.writeHead(201).end(JSON.stringify({ status: "pending", to: form.To }));
  if (req.url.endsWith("/VerificationCheck")) return res.writeHead(200).end(JSON.stringify({ status: form.Code === "123456" ? "approved" : "pending" }));
  res.writeHead(404).end("{}");
});
let nextIdentity = null;
const codes = new Map();
const oauth = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1:4996");
  if (u.pathname === "/authorize") {
    const code = crypto.randomBytes(8).toString("hex");
    codes.set(code, nextIdentity);
    const back = new URL(u.searchParams.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", u.searchParams.get("state") || "");
    return res.writeHead(302, { location: back.toString() }).end();
  }
  if (u.pathname === "/token") {
    const form = Object.fromEntries(new URLSearchParams(await readBody(req)));
    return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ access_token: "at-" + form.code, token_type: "Bearer", expires_in: 3600 }));
  }
  if (u.pathname === "/userinfo") {
    const code = String(req.headers.authorization || "").replace(/^Bearer at-/, "");
    return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(codes.get(code) || {}));
  }
  res.writeHead(404).end();
});
const mails = [];
const resend = http.createServer(async (req, res) => {
  mails.push(JSON.parse((await readBody(req)) || "{}"));
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: "m" + mails.length }));
});
await Promise.all([listen(twilio, 4997), listen(oauth, 4996), listen(resend, 4991)]);

// ---- soi lỗi giao diện ----
const issues = [];
const timings = [];
async function audit(p, label) {
  const a = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth > vw + 2;
    const wide = overflow ? [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 2 && r.width > 0 && getComputedStyle(e).position !== "fixed"; }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 3).join(".")}`) : [];
    const small = [...document.querySelectorAll("a, button, [role=button], input, select")].filter((e) => {
      const r = e.getBoundingClientRect(); const st = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && (r.height < 32 || r.width < 32) && !(e.closest("nav[aria-label='breadcrumb']")) && e.offsetParent !== null && r.top < innerHeight * 3;
    }).map((e) => `${(e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || e.tagName).trim().slice(0, 22)}(${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)})`);
    const noAlt = [...document.images].filter((i) => !i.hasAttribute("alt") && i.getBoundingClientRect().width > 24).length;
    const unlabeled = [...document.querySelectorAll("button, a")].filter((e) => !(e.textContent || "").trim() && !e.getAttribute("aria-label") && !e.getAttribute("title") && !e.querySelector("img[alt]:not([alt=''])") && e.offsetParent !== null).length;
    return { overflow, wide, small: small.slice(0, 6), smallN: small.length, noAlt, unlabeled };
  });
  if (a.overflow) issues.push(`[${label}] tràn ngang: ${a.wide.join(", ")}`);
  if (a.noAlt) issues.push(`[${label}] ${a.noAlt} ảnh thiếu alt`);
  if (a.unlabeled) issues.push(`[${label}] ${a.unlabeled} nút/link không có tên (trình đọc màn hình không đọc được)`);
  if (a.smallN > 3) issues.push(`[${label}] ${a.smallN} chỗ bấm nhỏ hơn 32px: ${a.small.join(", ")}`);
}
let shotN = 0;
async function step(label, p, fn) {
  const t0 = Date.now();
  let note = "";
  try { note = (await fn()) || ""; } catch (e) { issues.push(`[${label}] LỖI: ${String(e.message).split("\n")[0].slice(0, 150)}`); note = "LỖI"; }
  const ms = Date.now() - t0;
  timings.push({ label, ms, note });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${String(++shotN).padStart(2, "0")}_${label.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40)}.png` }).catch(() => {});
  await audit(p, label).catch(() => {});
  console.log(`${note === "LỖI" ? "✗" : "✓"} ${label.padEnd(44)} ${String(ms).padStart(6)}ms ${note}`);
}
const browser = await chromium.launch();
async function phone() {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => issues.push(`[JS] ${e.message.slice(0, 140)}`));
  p.on("response", (r) => { if (r.status() >= 500) issues.push(`[5xx] ${r.status()} ${r.url().replace(BASE_URL, "")}`); });
  p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource.*(404|401)|ERR_CONNECTION|net::|Download the React DevTools|Pusher/i.test(m.text())) issues.push(`[console] ${m.text().slice(0, 140)}`); });
  return p;
}
const settle = (p) => p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
const stamp = Date.now();

try {
  // ===== A. Khách lạ → đăng ký bằng Google =====
  const p = await phone();
  await step("A1 Khách mở trang chủ", p, async () => { await p.goto(BASE_URL + "/"); await settle(p); });
  await step("A2 Bấm Đăng ký", p, async () => { await p.getByRole("button", { name: /^Đăng ký$/ }).first().click(); await p.waitForURL(/\/auth\/register/); await settle(p); });
  await step("A3 Trang đăng nhập (nút Google)", p, async () => { await p.goto(BASE_URL + "/auth/login"); await settle(p); const n = await p.getByRole("button", { name: /Tiếp tục với/ }).count(); return `${n} nút đăng nhập mạng xã hội`; });
  const gEmail = `khach.g.${stamp}@gmail.test`;
  nextIdentity = { sub: "g-" + stamp, email: gEmail, name: "Ngọc Trâm", email_verified: true };
  await step("A4 Tiếp tục với Google → Hoàn tất", p, async () => {
    await p.getByRole("button", { name: /Tiếp tục với Test OAuth/ }).click();
    await p.waitForURL(/\/auth\/complete/, { timeout: 30000 });
    await p.getByText("Chào mừng bạn!").waitFor({ timeout: 15000 });
  });
  await step("A5 Chọn Thợ nail + khu vực", p, async () => {
    await p.getByRole("radio", { name: /Tôi là Thợ/ }).click();
    await p.getByLabel(/Thành phố/).fill("San Jose");
    await p.getByLabel(/Số điện thoại/).fill("4085550123");
    await p.getByRole("button", { name: /Vào PawNail/ }).click();
    await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
    await settle(p);
    return p.url().replace(BASE_URL, "");
  });
  await step("A6 Bảng tin sau khi vào", p, async () => { await p.goto(BASE_URL + "/?tab=feed"); await settle(p); });
  await step("A7 Việc gấp", p, async () => { await p.goto(BASE_URL + "/?tab=jobs"); await settle(p); });
  await step("A8 Mở 1 tin tuyển", p, async () => { await p.locator('a[href^="/jobs/"]').first().click({ timeout: 10000 }); await p.waitForURL(/\/jobs\//); await settle(p); });
  await step("A9 Nhắn tin cho tiệm", p, async () => {
    const b = p.getByRole("button", { name: /Nhắn tin qua App/ }).or(p.getByRole("link", { name: /Nhắn tin qua App/ })).first();
    await b.click({ timeout: 10000 });
    await p.getByPlaceholder(/Viết tin nhắn/).fill("Dạ em chào anh chị, tiệm còn cần thợ không ạ?");
    await p.keyboard.press("Enter"); await p.waitForTimeout(1500);
  });
  await step("A10 Hồ sơ → Xác minh SĐT qua SMS", p, async () => {
    await p.goto(BASE_URL + "/profile"); await settle(p);
    const b = p.getByRole("button", { name: /Xác minh SĐT qua SMS/ });
    if (!(await b.count())) return "KHÔNG thấy nút xác minh";
    await b.click();
    const dlg = p.getByRole("dialog", { name: "Nhập mã xác minh" });
    await dlg.waitFor({ timeout: 10000 });
    await dlg.getByLabel("Mã xác minh").fill("123456");
    await dlg.getByRole("button", { name: /^Xác minh$/ }).click();
    await p.getByText("Số điện thoại đã xác minh").waitFor({ timeout: 10000 });
    return `SMS gửi tới ${sms.find((s) => s.To)?.To}`;
  });
  await step("A11 Mời bạn bè", p, async () => { await p.goto(BASE_URL + "/profile#moi-ban-be"); await p.getByTestId("invite-friends").scrollIntoViewIfNeeded({ timeout: 10000 }); });
  await step("A12 Mẫu nail", p, async () => { await p.goto(BASE_URL + "/designs"); await settle(p); });
  await step("A13 Tin nhắn", p, async () => { await p.goto(BASE_URL + "/messages"); await settle(p); });
  await step("A14 Đăng xuất", p, async () => {
    await p.goto(BASE_URL + "/profile"); await settle(p);
    await p.getByRole("button", { name: /Đăng xuất/ }).click();
    await p.waitForURL(/\/auth\/login/, { timeout: 15000 });
  });
  await step("A15 Đăng nhập lại bằng Google (1 chạm)", p, async () => {
    await p.getByRole("button", { name: /Tiếp tục với Test OAuth/ }).click();
    await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
    return p.url().replace(BASE_URL, "");
  });

  // ===== B. Đăng ký email → quên mật khẩu =====
  const b = await phone();
  const email = `khach.e.${stamp}@qa.test`;
  await step("B1 Đăng ký thợ bằng email", b, async () => {
    await b.goto(BASE_URL + "/auth/register?role=technician"); await settle(b);
    await b.getByPlaceholder("VD: Kim Nails").fill("Bảo Ngọc");
    await b.getByPlaceholder("555 123 4567").fill("7135550142");
    await b.getByPlaceholder("VD: Los Angeles").fill("Houston");
    await b.getByPlaceholder("ban@email.com").fill(email);
    await b.locator('input[type="password"]').fill("QaPass#2026");
    await b.getByRole("button", { name: /Tiếp tục/ }).first().click();
    await b.getByText("Tay nghề & mong muốn").waitFor({ timeout: 20000 });
    await b.getByRole("button", { name: /Gel-X|Bột/ }).first().click();
    await b.getByRole("button", { name: /Tiếp tục/ }).first().click(); await b.waitForTimeout(1200);
    await b.getByRole("button", { name: /Hoàn tất|Bỏ qua|Vào app|Bắt đầu/i }).last().click({ timeout: 10000 });
    await b.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
  });
  await step("B2 Đăng xuất", b, async () => {
    await b.goto(BASE_URL + "/profile"); await settle(b);
    await b.getByRole("button", { name: /Đăng xuất/ }).click();
    await b.waitForURL(/\/auth\/login/, { timeout: 15000 });
  });
  await step("B3 Đăng nhập SAI mật khẩu", b, async () => {
    await b.locator("#email").fill(email); await b.locator("#password").fill("SaiMatKhau#1");
    await b.getByRole("button", { name: /^Đăng nhập$/ }).click(); await b.waitForTimeout(2500);
    const msg = (await b.locator("[role=alert], .text-red-300, .text-red-400, [data-sonner-toast], div[role=status]").allInnerTexts()).join(" | ").slice(0, 120);
    return msg ? `báo: "${msg}"` : "KHÔNG thấy thông báo lỗi rõ ràng";
  });
  await step("B4 Quên mật khẩu → gửi email", b, async () => {
    await b.getByRole("link", { name: /Quên mật khẩu/ }).click(); await b.waitForURL(/\/auth\/forgot/);
    await b.locator("#forgot-email").fill(email);
    await b.getByRole("button", { name: /Gửi link đặt lại/ }).click(); await b.waitForTimeout(2000);
    return `${mails.length} email`;
  });
  const link = (mails.at(-1)?.text || "").match(/https?:\/\/\S+token=[\w-]+/)?.[0];
  await step("B5 Mở link trong email → đặt mật khẩu mới", b, async () => {
    if (!link) return "KHÔNG có link";
    await b.goto(BASE_URL + new URL(link).pathname + new URL(link).search); await settle(b);
    const pw = b.locator('input[type="password"]');
    for (let i = 0; i < (await pw.count()); i++) await pw.nth(i).fill("MoiDoi#2026!");
    await b.getByRole("button", { name: /Đặt mật khẩu|Lưu|Đổi mật khẩu/ }).first().click();
    await b.waitForTimeout(2500);
    return b.url().replace(BASE_URL, "");
  });
  await step("B6 Đăng nhập bằng mật khẩu mới", b, async () => {
    if (!b.url().includes("/auth/login")) await b.goto(BASE_URL + "/auth/login");
    await b.locator("#email").fill(email); await b.locator("#password").fill("MoiDoi#2026!");
    await b.getByRole("button", { name: /^Đăng nhập$/ }).click();
    await b.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  });

  R.check("J1", "Đăng ký Google → vào app; đăng xuất → đăng nhập lại 1 chạm", !timings.some((t) => /^A(4|5|15)/.test(t.label) && t.note === "LỖI"));
  R.check("J2", "Xác minh SĐT qua SMS trong hồ sơ", timings.find((t) => t.label.startsWith("A10"))?.note?.startsWith("SMS"));
  R.check("J3", "Đăng nhập sai có thông báo rõ", !/KHÔNG/.test(timings.find((t) => t.label.startsWith("B3"))?.note || "KHÔNG"));
  R.check("J4", "Quên mật khẩu → email → đặt mới → đăng nhập được", !timings.some((t) => /^B[456]/.test(t.label) && (t.note === "LỖI" || /KHÔNG/.test(t.note))));
} catch (e) {
  issues.push("FATAL " + String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
  [twilio, oauth, resend].forEach((s) => s.close());
}
const slow = timings.filter((t) => t.ms > 4000);
console.log("\nCHẬM (>4s):", slow.map((t) => `${t.label} ${t.ms}ms`).join(" | ") || "không");
console.log("\nVẤN ĐỀ GIAO DIỆN / LỖI:", issues.length ? "\n  " + [...new Set(issues)].join("\n  ") : "không");
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ timings, issues: [...new Set(issues)] }, null, 1));
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
