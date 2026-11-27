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
const db = createClient({ url: process.env.QA_DB_URL?.startsWith("file:") ? process.env.QA_DB_URL : "file:prisma/dev.db" }) /* DB QA local: scripts/qa/make-qa-db.sh */;
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
    // ISO text như Prisma (adapter libsql) tự ghi — số mili-giây làm groupBy của trang /messages lỗi P2023
    args: [`perf_${Date.now()}_${i}`, `${lines[i % lines.length]} (#${i})`, from, convId, new Date(base + i * 60_000).toISOString()],
  });
}

const page = await tech.ctx.newPage();
// Đo A/B: CHAT_PERF_CSS="…" chèn CSS tắt bớt hiệu ứng để tìm đúng thứ gây khựng phím (không cần build lại)
if (process.env.CHAT_PERF_CSS) await page.addInitScript((css) => { document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }); }, process.env.CHAT_PERF_CSS);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
await page.addInitScript(() => {
  window.__perf = { long: [], events: [] };
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.long.push(e.duration))).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.events.push({ name: e.name, d: e.duration, t: Math.round(e.startTime), tgt: e.target ? (e.target.tagName + "." + String(e.target.className || "").split(" ")[0]) : "" }))).observe({ type: "event", durationThreshold: 16, buffered: true });
  } catch {}
});
const resetPerf = () => page.evaluate(() => { window.__perf.long = []; window.__perf.events = []; });
const readPerf = () => page.evaluate(() => window.__perf);
const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0);
const box = page.locator("[data-chat-input]");
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
// Người thật luôn chạm vào cuộc trò chuyện trước khi gõ (lần chạm đó mở khoá âm thanh ~1 lần/phiên);
// bài test mở thẳng bằng link nên chạm 1 lần vào đầu khung chat cho giống, rồi mới đo gõ phím.
{ const vp = page.viewportSize(); await page.mouse.click(Math.round(vp.width / 2), Math.round(vp.height / 2)); }
await page.waitForTimeout(800);
await resetPerf();
await box.click();
await page.keyboard.type("Dạ em cảm ơn anh, mai 10h em ghé tiệm thử tay nghề nha", { delay: 35 });
await page.waitForTimeout(400);
let p = await readPerf();
const keyEv = p.events.filter((e) => /key|input|beforeinput/.test(e.name)).map((e) => e.d);
if (process.env.CHAT_PERF_VERBOSE) { const t0k = Math.min(...p.events.map((e) => e.t)); console.log("   slow typing events:", p.events.filter((e) => /key|input/.test(e.name) && e.d > 50).map((e) => `${e.name}@+${e.t - t0k}ms ${Math.round(e.d)}ms ${e.tgt}`).join(" | ")); }
out.typing = { worstMs: Math.round(Math.max(0, ...keyEv)), p95Ms: Math.round(pct(keyEv, 0.95)), slowKeys: keyEv.filter((d) => d > 50).length, longTaskMs: Math.round(p.long.reduce((a, b) => a + b, 0)) };
// 1 lần gõ = 3–4 sự kiện (keydown/beforeinput/input/keyup) → ≤ 8 sự kiện chậm ≈ 2 phím trên ~50 phím.
R.check("CP2", "Gõ phím mượt: phím chậm nhất ≤ 100ms, ≤ 8 sự kiện phím > 50ms (trước khi sửa: 63)", out.typing.worstMs <= 100 && out.typing.slowKeys <= 8, JSON.stringify(out.typing));

// 3) Gửi: bấm nút Gửi (điện thoại: Enter = xuống dòng) → bong bóng hiện (tin hiện ngay, không chờ server).
// Đo từ lúc CHẠM (thời điểm của sự kiện click trong trang) tới khung hình ĐÃ VẼ có bong bóng mới (2 khung sau khi bong bóng vào
// DOM — cận trên). Trước đây: (1) tìm "thử tay nghề nha" — lịch sử mẫu có sẵn "Ok em, mai ghé tiệm thử tay nghề nha (#n)" nên
// khớp ngay tin CŨ; (2) bộ dò gắn song song với cú bấm (không chờ); (3) tính cả thời gian Playwright chờ nút "ổn định / bấm
// được" trước khi bấm (hàng trăm ms ở CPU chậm 4x — người dùng không chịu). sendHarnessMs giữ số đo kiểu cũ để so.
const SENT = "Dạ em cảm ơn anh, mai 10h em ghé tiệm thử tay nghề nha";
await page.evaluate((txt) => {
  window.__send = { click: 0, shown: 0 };
  document.addEventListener("click", (e) => { if (!window.__send.click) window.__send.click = e.timeStamp; }, { capture: true, once: true });
  const has = () => [...document.querySelectorAll(".m-row")].slice(-3).some((n) => n.textContent?.includes(txt));
  const mo = new MutationObserver(() => {
    if (!has()) return;
    mo.disconnect();
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__send.shown = performance.now(); }));
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  setTimeout(() => mo.disconnect(), 10000); // không hiện trong 10 s → ghi lỗi thay vì treo cả bài đo
}, SENT);
t0 = await page.evaluate(() => performance.now());
await page.getByRole("button", { name: /^(Gửi tin nhắn|Send message)$/ }).filter({ visible: true }).first().click();
const sendT = await page.waitForFunction(() => window.__send.shown && window.__send, null, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => null);
out.sendMs = sendT ? Math.round(sendT.shown - sendT.click) : 99999;
out.sendHarnessMs = sendT ? Math.round(sendT.shown - t0) : 99999;
R.check("CP3", "Chạm Gửi → bong bóng hiện (đã vẽ) ≤ 150ms", out.sendMs <= 150, `${out.sendMs}ms (kể cả Playwright chờ nút: ${out.sendHarnessMs}ms)`);
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
  const el = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY === "auto" && d.querySelectorAll("p").length > 5);
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
  const el = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY === "auto" && d.querySelectorAll("p").length > 5);
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
// Chạm hàng theo TÊN tiệm, không theo xem trước "Ok em …": máy chậm (CPU chậm 4x + máy bận) thì tin thợ gửi ở CP3 có thể được
// máy chủ ghi SAU tin "Ok em" của CP4 → xem trước là tin của thợ → bài đo chờ 30 s rồi văng (gặp 2026-11-27).
await page.locator(".m-conv").filter({ hasText: owner.me.name }).first().click();
await page.getByText(`(#${HISTORY - 1})`).last().waitFor({ timeout: 20000 });
out.switchBackMs = Date.now() - t0;
R.check("CP6b", "Quay lại cuộc trò chuyện dài (đã có sẵn) ≤ 800ms", out.switchBackMs <= 800, out.switchBackMs + "ms");

R.check("CP7", "Không có lỗi JS", errors.length === 0, errors.join(" | "));
console.log("\nSố liệu:", JSON.stringify(out));
await browser.close();
R.summary?.() ?? R.print?.();
