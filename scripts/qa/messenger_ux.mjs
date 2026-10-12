// Trải nghiệm nhắn tin như 2 người thật trên 2 điện thoại (iPhone ↔ Android):
// đang soạn tin, đã xem, báo tin mới khi đang ở trang khác, số chưa đọc, mất mạng → gửi lại,
// cỡ chữ ô nhập. CHỈ chạy với server local (dev.db).   node scripts/qa/messenger_ux.mjs
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, Results, fakeIp } from "./lib.mjs";

const R = new Results("Nhắn tin mượt (2 người)");
const browser = await chromium.launch();

async function login(email, device) {
  const ctx = await browser.newContext({ ...device, locale: "vi-VN" });
  const ip = fakeIp();
  const h = { "cf-connecting-ip": ip };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, me, h, page, errors };
}

const tech = await login(SEED_TECH, devices["iPhone 13"]);
const owner = await login(SEED_OWNER, devices["Pixel 7"]);
const stamp = Date.now().toString().slice(-6);

// Mở cùng 1 cuộc trò chuyện ở 2 máy
await owner.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: tech.me.id, content: `Chào em ${stamp}` }, headers: owner.h });
await owner.page.goto(BASE_URL + `/messages?to=${tech.me.id}`);
await tech.page.goto(BASE_URL + `/messages?to=${owner.me.id}`);
const oBox = owner.page.getByPlaceholder(/Viết tin nhắn|Aa|Nhập tin/).first();
const tBox = tech.page.getByPlaceholder(/Viết tin nhắn|Aa|Nhập tin/).first();
await oBox.waitFor({ timeout: 20000 });
await tBox.waitFor({ timeout: 20000 });
await tech.page.getByText(`Chào em ${stamp}`).last().waitFor({ timeout: 15000 });

// M1: cỡ chữ ô nhập trên iPhone (≥ 16px: dễ đọc khi gõ, iOS không tự phóng to)
const fs = await tBox.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
R.check("M1", "Ô nhập tin trên điện thoại chữ ≥ 16px (dễ gõ, không bị phóng to màn hình)", fs >= 16, fs + "px");

// M2: chủ tiệm gõ → thợ thấy "Đang soạn tin" (chờ kết nối realtime ~1,5s như người thật mở chat rồi mới gõ)
await owner.page.waitForTimeout(1500);
let t0 = Date.now();
await oBox.click();
await oBox.pressSequentially("Mai em ghé", { delay: 60 });
const typingSeen = await tech.page.getByText(/Đang soạn tin/).locator("visible=true").first().waitFor({ timeout: 6000 }).then(() => Date.now() - t0).catch(() => -1);
R.check("M2", "Bên kia gõ → hiện 'Đang soạn tin' ≤ 3s", typingSeen >= 0 && typingSeen <= 3000, typingSeen + "ms");

// M3: gửi → thợ nhận; thợ đang mở chat → chủ tiệm thấy 'Đã xem'
t0 = Date.now();
await oBox.press("Enter");
const got = await tech.page.getByText("Mai em ghé").last().waitFor({ timeout: 8000 }).then(() => Date.now() - t0).catch(() => -1);
R.check("M3", "Tin tới máy bên kia ≤ 2s", got >= 0 && got <= 2000, got + "ms");
const seen = await owner.page.getByText(/Đã xem/).last().waitFor({ timeout: 8000 }).then(() => Date.now() - t0).catch(() => -1);
R.check("M4", "Người gửi thấy 'Đã xem' khi bên kia đang mở chat ≤ 4s", seen >= 0 && seen <= 4000, seen + "ms");
const typingGone = await tech.page.getByText(/Đang soạn tin/).locator("visible=true").count();
R.check("M5", "Gửi xong → tắt 'Đang soạn tin' ngay", typingGone === 0, String(typingGone));

// M6: thợ sang trang khác → có tin mới thì biết ngay (số chưa đọc / thông báo)
await tech.page.goto(BASE_URL + "/?tab=jobs");
await tech.page.waitForLoadState("networkidle").catch(() => {});
await owner.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: tech.me.id, content: `Em xem tin nhắn nha ${stamp}` }, headers: owner.h });
t0 = Date.now();
const badge = await tech.page.waitForFunction(() => {
  const txt = document.body.innerText;
  const nums = [...document.querySelectorAll("a[href^='/messages'] span, a[href^='/messages'] [class*='badge']")].map((e) => e.textContent?.trim()).filter((x) => /^\d+\+?$/.test(x || ""));
  return nums.length > 0 || /Em xem tin nhắn nha/.test(txt);
}, null, { timeout: 8000 }).then(() => Date.now() - t0).catch(() => -1);
R.check("M6", "Đang ở trang khác: tin mới hiện số chưa đọc / thông báo ≤ 5s", badge >= 0 && badge <= 5000, badge + "ms");

// M7: hộp thư — cuộc trò chuyện có tin mới lên đầu, có xem trước nội dung
await tech.page.goto(BASE_URL + "/messages");
const first = await tech.page.getByText(new RegExp(`Em xem tin nhắn nha ${stamp}`)).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
R.check("M7", "Hộp thư: hiện xem trước tin mới nhất", first);

// M8: mất mạng → tin báo 'Gửi thất bại · Thử lại', có mạng lại bấm thử lại → gửi được
await tech.page.goto(BASE_URL + `/messages?to=${owner.me.id}`);
await tBox.waitFor({ timeout: 15000 });
await tech.ctx.setOffline(true);
await tBox.fill(`Mất mạng ${stamp}`);
await tBox.press("Enter");
const failed = await tech.page.getByText(/Gửi thất bại/).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
await tech.ctx.setOffline(false);
let retried = false;
if (failed) {
  await tech.page.getByText(/Thử lại/).first().click();
  retried = await owner.page.getByText(`Mất mạng ${stamp}`).last().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
}
R.check("M8", "Mất mạng: tin báo 'Gửi thất bại · Thử lại' (không mất chữ); có mạng bấm thử lại → tới nơi", failed && retried, JSON.stringify({ failed, retried }));

R.check("M9", "Không có lỗi JS ở cả 2 máy", !tech.errors.length && !owner.errors.length, JSON.stringify([...tech.errors, ...owner.errors]).slice(0, 300));
await browser.close();
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
