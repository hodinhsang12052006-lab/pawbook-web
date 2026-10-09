// Đo độ MƯỢT của chat như người dùng điện thoại thật (Pixel 7, CPU chậm 4 lần
// ≈ máy Android tầm trung): mở chat, gõ phím, gửi, nhận, cuộn lịch sử, đổi
// cuộc trò chuyện. In số liệu + so với ngưỡng "mượt như Zalo/Telegram".
// CHỈ chạy với server local (dev.db).   node scripts/qa/chat_perf.mjs
import { createClient } from "@libsql/client";
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_OWNER_2, SEED_TECH, Results, fakeIp } from "./lib.mjs";

const R = new Results("Chat mượt");
const CPU = Number(process.env.CPU || 4);
const HISTORY = 150;
const db = createClient({ url: "file:prisma/dev.db" });
const browser = await chromium.launch();

async function login(email, device = devices["Pixel 7"]) {
  const ctx = await browser.newContext({ ...device, locale: "vi-VN" });
  const ip = fakeIp();
  const h = { "cf-connecting-ip": ip };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  return { ctx, me, h };
}

const tech = await login(SEED_TECH);
const owner = await login(SEED_OWNER);
const owner2 = await login(SEED_OWNER_2);

// --- Dữ liệu: 1 cuộc trò chuyện dài HISTORY tin + 1 cuộc thứ hai để thử đổi qua lại.
async function convWith(a, b, text) {
  const r = await a.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: b.me.id, content: text }, headers: a.h });
  return (await r.json()).message?.conversationId ?? (await r.json()).conversationId;
}
const convId = await convWith(owner, tech, "Chào em, tiệm đang cần thợ bột");
await convWith(owner2, tech, "Hi em, bên chị cần thợ gel-x");
const base = Date.now() - HISTORY * 60_000;
const lines = ["Dạ em chào anh", "Lương tuần bao nhiêu vậy anh?", "$1,300/tuần, bao chỗ ở", "Em làm bột được 5 năm rồi ạ", "Ok em, mai ghé tiệm thử tay nghề nha", "Dạ mấy giờ anh?", "10h sáng nha em 👍"];
for (let i = 0; i < HISTORY; i++) {
  const from = i % 3 === 0 ? tech.me.id : owner.me.id;
  await db.execute({
    sql: `INSERT INTO "Message" (id, body, type, senderId, conversationId, createdAt) VALUES (?, ?, 'TEXT', ?, ?, ?)`,
    args: [`perf_${Date.now()}_${i}`, `${lines[i % lines.length]} (#${i})`, from, convId, base + i * 60_000],
  });
}

const page = await tech.ctx.newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
await page.addInitScript(() => {
  window.__perf = { long: [], events: [] };
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.long.push(e.duration))).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.events.push({ name: e.name, d: e.duration }))).observe({ type: "event", durationThreshold: 16, buffered: true });
  } catch {}
});
const resetPerf = () => page.evaluate(() => { window.__perf.long = []; window.__perf.events = []; });
const readPerf = () => page.evaluate(() => window.__perf);
const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0);
const box = page.getByPlaceholder(/Viết tin nhắn/);
const out = {};

// 1) Mở chat có lịch sử dài (vào thẳng từ hồ sơ/tin tuyển).
await page.goto(BASE_URL + "/messages");
await page.waitForLoadState("networkidle").catch(() => {});
let t0 = Date.now();
await page.goto(BASE_URL + `/messages?to=${owner.me.id}`);
await page.getByText(`(#${HISTORY - 1})`).last().waitFor({ timeout: 30000 });
out.openMs = Date.now() - t0;
await box.waitFor();
R.check("CP1", `Mở trang chat (tải trang mới hoàn toàn, CPU chậm ${CPU}x) ≤ 3s`, out.openMs <= 3000, out.openMs + "ms");

// 2) Gõ phím: độ trễ từng phím (Event Timing) — Zalo/Tele cảm giác tức thì < 50ms.
await page.waitForTimeout(1500);
await resetPerf();
await box.click();
await page.keyboard.type("Dạ em cảm ơn anh, mai 10h em ghé tiệm thử tay nghề nha", { delay: 35 });
await page.waitForTimeout(400);
let p = await readPerf();
const keyEv = p.events.filter((e) => /key|input|beforeinput/.test(e.name)).map((e) => e.d);
out.typing = { worstMs: Math.round(Math.max(0, ...keyEv)), p95Ms: Math.round(pct(keyEv, 0.95)), slowKeys: keyEv.filter((d) => d > 50).length, longTaskMs: Math.round(p.long.reduce((a, b) => a + b, 0)) };
// 1 lần gõ = 3–4 sự kiện (keydown/beforeinput/input/keyup) → ≤ 8 sự kiện chậm ≈ 2 phím trên ~50 phím.
R.check("CP2", "Gõ phím mượt: phím chậm nhất ≤ 100ms, ≤ 8 sự kiện phím > 50ms (trước khi sửa: 63)", out.typing.worstMs <= 100 && out.typing.slowKeys <= 8, JSON.stringify(out.typing));

// 3) Gửi: bấm Enter → bong bóng hiện (tin hiện ngay, không chờ server).
t0 = await page.evaluate(() => performance.now());
const shown = page.evaluate((txt) => new Promise((res) => {
  const tick = () => ([...document.querySelectorAll("p,div,span")].some((n) => n.childElementCount === 0 && n.textContent?.includes(txt)) ? res(performance.now()) : requestAnimationFrame(tick));
  tick();
}), "thử tay nghề nha");
await page.keyboard.press("Enter");
out.sendMs = Math.round((await shown) - t0);
R.check("CP3", "Gửi tin → hiện bong bóng ≤ 150ms", out.sendMs <= 150, out.sendMs + "ms");
await page.waitForTimeout(1500);

// 4) Nhận: tiệm gửi → hiện trên máy thợ.
const recvTxt = `Ok em ${Date.now() % 10000}`;
const waitRecv = page.getByText(recvTxt).last().waitFor({ timeout: 15000 }).then(() => Date.now());
t0 = Date.now();
await owner.ctx.request.post(BASE_URL + "/api/messages", { data: { conversationId: convId, content: recvTxt }, headers: owner.h });
out.receiveMs = (await waitRecv) - t0;
R.check("CP4", "Nhận tin realtime ≤ 1.5s (gồm cả Pusher qua internet)", out.receiveMs <= 1500, out.receiveMs + "ms");

// 5) Cuộn lịch sử lên trên: đếm khung hình bị rớt.
await resetPerf();
const scroll = await page.evaluate(async () => {
  const el = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY === "auto" && d.querySelector("[class*=rounded-2xl]"));
  if (!el) return null;
  const frames = [];
  let last = performance.now();
  let run = true;
  const loop = (t) => { frames.push(t - last); last = t; if (run) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  for (let i = 0; i < 40; i++) { el.scrollTop -= 120; await new Promise((r) => setTimeout(r, 16)); }
  run = false;
  return { frames: frames.length, janky: frames.filter((d) => d > 50).length, worst: Math.round(Math.max(...frames)) };
});
out.scroll = scroll;
R.check("CP5", "Cuộn lịch sử: ≤ 3 khung hình giật (> 50ms)", scroll && scroll.janky <= 3, JSON.stringify(scroll));

// 5b) Tải thêm lịch sử khi đang đọc giữa chừng → chỗ đang đọc KHÔNG được nhảy.
// Phiên mới (như người dùng vừa mở app), CPU chậm như trên.
const tech2 = await login(SEED_TECH);
const page2 = await tech2.ctx.newPage();
await (await tech2.ctx.newCDPSession(page2)).send("Emulation.setCPUThrottlingRate", { rate: CPU });
page2.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
await page2.goto(BASE_URL + `/messages?to=${owner.me.id}`);
await page2.getByText(`(#${HISTORY - 1})`).last().waitFor({ timeout: 30000 });
await page2.waitForTimeout(2500);
const jump = await page2.evaluate(async () => {
  const el = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY === "auto" && d.querySelector("[class*=rounded-2xl]"));
  const ps = () => [...el.querySelectorAll("p")].filter((p) => /\(#\d+\)/.test(p.textContent || ""));
  el.scrollTop = 500; // đang đọc gần đỉnh → vào vùng tải trước (800px)
  await new Promise((r) => setTimeout(r, 30));
  const box = el.getBoundingClientRect();
  const anchor = ps().find((p) => p.getBoundingClientRect().top > box.top + 40);
  if (!anchor) return { loaded: 0, drift: 999, text: "không thấy tin", n: ps().length };
  const before = anchor.getBoundingClientRect().top;
  const count0 = ps().length;
  const t0 = performance.now();
  while (ps().length === count0 && performance.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 200));
  return { loaded: ps().length - count0, drift: Math.round(anchor.getBoundingClientRect().top - before), text: anchor.textContent };
});
out.historyJump = jump;
R.check("CP5b", "Tải thêm lịch sử khi đang đọc: chỗ đang đọc lệch ≤ 30px", Math.abs(jump.drift) <= 30, JSON.stringify(jump));

// 6) Đổi sang cuộc trò chuyện khác rồi quay lại (đã tải trước → gần như tức thì).
await page.goto(BASE_URL + "/messages");
await page.waitForTimeout(2500);
t0 = Date.now();
await page.getByText("cần thợ gel-x").first().click();
await page.locator("p", { hasText: "cần thợ gel-x" }).last().waitFor({ timeout: 20000 });
await box.waitFor();
out.switchMs = Date.now() - t0;
R.check("CP6", "Bấm 1 cuộc trò chuyện trong hộp thư → mở ≤ 800ms", out.switchMs <= 800, out.switchMs + "ms");
await page.getByRole("button", { name: /Quay lại|Back/ }).first().click().catch(() => page.goto(BASE_URL + "/messages"));
await page.waitForTimeout(800);
t0 = Date.now();
await page.getByText(/Ok em \d+/).first().click();
await page.getByText(`(#${HISTORY - 1})`).last().waitFor({ timeout: 20000 });
out.switchBackMs = Date.now() - t0;
R.check("CP6b", "Quay lại cuộc trò chuyện dài (đã có sẵn) ≤ 800ms", out.switchBackMs <= 800, out.switchBackMs + "ms");

R.check("CP7", "Không có lỗi JS", errors.length === 0, errors.join(" | "));
console.log("\nSố liệu:", JSON.stringify(out));
await browser.close();
R.summary?.() ?? R.print?.();
