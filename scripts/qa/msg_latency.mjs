// Đo độ trễ nhắn tin THẬT giữa 2 máy: bấm Enter ở máy A → chữ hiện ở máy B. In từng tin + trung vị.
//   node scripts/qa/msg_latency.mjs   (server local; N=10 mặc định)
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, fakeIp } from "./lib.mjs";
const N = Number(process.env.N || 10);
const browser = await chromium.launch();
async function login(email, device) {
  const ctx = await browser.newContext({ ...device, locale: "vi-VN" }); const ip = fakeIp(); const h = { "cf-connecting-ip": ip };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  return { ctx, me, h, page: await ctx.newPage() };
}
const a = await login(SEED_OWNER, devices["Pixel 7"]); const b = await login(SEED_TECH, devices["iPhone 13"]);
await a.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: b.me.id, content: "warmup" }, headers: a.h });
await a.page.goto(BASE_URL + `/messages?to=${b.me.id}`); await b.page.goto(BASE_URL + `/messages?to=${a.me.id}`);
const box = a.page.getByPlaceholder(/Viết tin nhắn/).first(); await box.waitFor(); await b.page.getByPlaceholder(/Viết tin nhắn/).first().waitFor();
await a.page.waitForTimeout(2500);
const recv = [];
for (let i = 0; i < N; i++) {
  const txt = `lat${i}-${Date.now()}`;
  // Mốc chính xác trong trình duyệt B: thời điểm chữ xuất hiện (MutationObserver), so với lúc A bấm gửi.
  await b.page.evaluate((t) => { window.__seen = null; new MutationObserver((_, o) => { if (document.body.innerText.includes(t)) { window.__seen = performance.timeOrigin + performance.now(); o.disconnect(); } }).observe(document.body, { childList: true, subtree: true, characterData: true }); }, txt);
  await box.fill(txt);
  const t0 = await a.page.evaluate(() => performance.timeOrigin + performance.now());
  await box.press("Enter");
  await b.page.waitForFunction(() => window.__seen, null, { timeout: 15000 });
  const seenAt = await b.page.evaluate(() => window.__seen);
  recv.push(Math.round(seenAt - t0));
  await a.page.waitForTimeout(700);
}
const sorted = [...recv].sort((x, y) => x - y);
console.log("từng tin (ms):", recv.join(", "));
console.log(`trung vị: ${sorted[Math.floor(N / 2)]}ms · nhanh nhất: ${sorted[0]}ms · chậm nhất: ${sorted[N - 1]}ms`);
await browser.close();
