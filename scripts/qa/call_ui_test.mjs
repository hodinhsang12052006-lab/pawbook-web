// Cuộc gọi trên điện thoại, chạy với máy chủ LOCAL không có Pusher thật: Pusher giả lập ngay trong Playwright (routeWebSocket —
// trả lời pusher:subscribe, chuyển tiếp tín hiệu /api/calls tới kênh private-chat-<người nhận> như máy chủ Pusher), còn mọi thứ
// khác là app thật (đổ chuông, nghe máy, VideoCallRoom, /api/zego/token, SDK ZEGOCLOUD thật).
// Cần bản build có NEXT_PUBLIC_PUSHER_APP_KEY / NEXT_PUBLIC_PUSHER_CLUSTER (giá trị bất kỳ, vd. qa-fake / qa — không bao giờ
// ra mạng: socket bị chặn ở trình duyệt). Máy chủ chạy với 1 trong 3 cấu hình ZEGO (SCENARIO):
//   off   — không có ZEGO_* : bấm gọi → báo ngay "chưa gọi được", máy bên kia KHÔNG đổ chuông
//   dummy — ZEGO_APP_ID / ZEGO_SERVER_SECRET giả (test): đổ chuông 360/412px, nghe máy, ZEGOCLOUD từ chối đăng nhập → báo lỗi có
//           mã ngay (không chờ 30s); máy bị chặn micro → câu báo + hướng dẫn bật quyền (VI), không vào phòng câm
//   real  — ZEGO_* thật (truyền riêng 2 biến, không chép .env): token được ZEGOCLOUD chấp nhận → 2 bên thông (hoặc báo mã lỗi
//           thật của ZEGOCLOUD, vd. dự án bị tạm dừng)
//   SCENARIO=dummy BASE_URL=http://localhost:3148 [SHOTS_DIR=…] node scripts/qa/call_ui_test.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, SEED_OWNER_2, Results, fakeIp } from "./lib.mjs";

const SCENARIO = process.env.SCENARIO || "dummy";
const R = new Results(`Cuộc gọi trên điện thoại (${SCENARIO})`);
const SHOTS = process.env.SHOTS_DIR || "";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});

const media = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });

// ---------- Pusher giả ----------
const sockets = new Set(); // { ws, channels:Set }
function deliver(channel, event, data) {
  let n = 0;
  for (const s of sockets) {
    if (!s.channels.has(channel)) continue;
    s.ws.send(JSON.stringify({ event, channel, data: JSON.stringify(data) }));
    n++;
  }
  return n;
}
const ACTION_TO_EVENT = { offer: "incoming-call", "candidate-batch": "call-candidate-batch", accept: "call-accepted", reject: "call-rejected", camera: "camera-status", busy: "call-busy" };

async function login(br, email, { w = 412, h = 915, locale = "en-US", grant = true, denyMedia = false } = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, locale, colorScheme: "dark", serviceWorkers: "block", ...(grant ? { permissions: ["camera", "microphone"] } : {}) });
  const hd = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...hd } }));
  await ctx.route(/sentry\.io|cloudflareinsights\.com/, (r) => r.abort());
  // Máy đã chặn micro / camera: WebView Android (BridgeWebChromeClient của Capacitor → request.deny() khi người dùng từ chối /
  // đã tắt quyền) và Chrome đều trả NotAllowedError. Chromium headless không có hộp hỏi quyền để bấm "Chặn" → giả lập đúng lỗi đó.
  if (denyMedia)
    await ctx.addInitScript(() => {
      const md = navigator.mediaDevices;
      if (md) md.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
    });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("pn_push_dismissed_at", String(Date.now()));
      sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
    } catch {}
  });
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: hd })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: hd });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: hd })).json()).user;
  if (!me?.id) throw new Error(`login failed for ${email}`);
  await ctx.routeWebSocket(/pusher\.com/, (ws) => {
    const s = { ws, channels: new Set() };
    sockets.add(s);
    ws.send(JSON.stringify({ event: "pusher:connection_established", data: JSON.stringify({ socket_id: `${Math.floor(Math.random() * 1e6)}.${Math.floor(Math.random() * 1e6)}`, activity_timeout: 120 }) }));
    ws.onMessage((raw) => {
      let m;
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (m.event === "pusher:ping") ws.send(JSON.stringify({ event: "pusher:pong", data: "{}" }));
      if (m.event === "pusher:subscribe") {
        const ch = m.data?.channel;
        s.channels.add(ch);
        const data = ch.startsWith("presence-") ? { presence: { ids: [me.id], hash: { [me.id]: {} }, count: 1 } } : {};
        ws.send(JSON.stringify({ event: "pusher_internal:subscription_succeeded", channel: ch, data: JSON.stringify(data) }));
      }
      if (m.event === "pusher:unsubscribe") s.channels.delete(m.data?.channel);
    });
    ws.onClose(() => sockets.delete(s));
  });
  await ctx.route(BASE_URL + "/api/pusher/auth", (r) => {
    const ch = new URLSearchParams(r.request().postData() || "").get("channel_name") || "";
    r.fulfill({ json: ch.startsWith("presence-") ? { auth: "qa-fake:sig", channel_data: JSON.stringify({ user_id: me.id, user_info: {} }) } : { auth: "qa-fake:sig" } });
  });
  // /api/calls đi tới máy chủ thật (chặn, push…) — máy chủ không có Pusher nên Playwright chuyển tiếp tín hiệu thay nó
  await ctx.route(BASE_URL + "/api/calls", async (r) => {
    const res = await r.fetch({ headers: { ...r.request().headers(), ...hd } });
    if (res.ok()) {
      const b = JSON.parse(r.request().postData() || "{}");
      const ev = ACTION_TO_EVENT[b.action];
      const payload = b.action === "offer" ? { fromId: me.id, callerId: me.id, callerName: me.name, callerAvatar: null, callType: b.callType === "video" ? "video" : "audio", callId: b.callId || "" } : { fromId: me.id };
      if (ev) deliver(`private-chat-${b.targetId}`, ev, payload);
    }
    await r.fulfill({ response: res });
  });
  const page = await ctx.newPage();
  const errors = [];
  const logs = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  page.on("console", (m) => /ZEGOCLOUD|zego/i.test(m.text()) && logs.push(m.text().slice(0, 200)));
  return { ctx, page, me, h: hd, errors, logs };
}
async function openChat(u, partnerId) {
  await u.page.goto(BASE_URL + `/messages?to=${partnerId}`);
  await u.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  // kênh private-chat-<mình> đã đăng ký (Pusher giả) — trước đó tín hiệu đến sẽ rơi
  for (let i = 0; i < 40 && ![...sockets].some((s) => s.channels.has(`private-chat-${u.me.id}`)); i++) await u.page.waitForTimeout(250);
  await u.page.waitForTimeout(600);
}
const dial = (u, type) => u.page.getByTitle(type === "audio" ? /Secure voice call|Cuộc gọi thoại bảo mật/ : /Live video call|Cuộc gọi video thời gian thực/).first().click();
const phase = (u, ph, timeout = 20000) => u.page.locator(`[data-call-phase="${ph}"]`).waitFor({ timeout }).then(() => true).catch(() => false);
// Màn gọi trên điện thoại: không tràn ngang, các nút chính nằm trọn trong màn hình và đủ lớn để chạm
async function callLayout(u) {
  return u.page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    const btns = [...document.querySelectorAll('[data-call-phase] button')].filter((b) => b.offsetParent).map((b) => {
      const r = b.getBoundingClientRect();
      return { label: b.getAttribute("aria-label") || b.textContent.trim().slice(0, 20), l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height };
    });
    const out = btns.filter((b) => b.l < -0.5 || b.r > W + 0.5 || b.t < -0.5 || b.b > H + 0.5);
    const small = btns.filter((b) => /Answer|Decline|End|Cancel|Trả lời|Từ chối|Huỷ|Try again|Thử lại|messaging|nhắn tin/.test(b.label) && (b.h < 40 || b.w < 40));
    return { W, sw: document.documentElement.scrollWidth, out, small, n: btns.length };
  });
}
const layoutOk = (l) => l.sw <= l.W && !l.out.length && !l.small.length && l.n > 0;

const A = await login(media, SEED_OWNER, { w: 360, h: 780 });
const B = await login(media, SEED_TECH, { w: 412, h: 915 });
await A.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content: `Call UI test ${Date.now() % 1e6}` }, headers: A.h });
const probe = await (await A.ctx.request.get(BASE_URL + "/api/zego/token", { headers: A.h })).json().catch(() => ({}));
const anonProbe = await fetch(BASE_URL + "/api/zego/token").then((r) => r.status).catch(() => 0);
R.check("CL0", `GET /api/zego/token → { enabled: ${probe.enabled} } (khớp cấu hình ${SCENARIO}), không có khoá trong câu trả lời; chưa đăng nhập → 401`,
  probe.enabled === (SCENARIO !== "off") && Object.keys(probe).join() === "enabled" && anonProbe === 401, JSON.stringify({ probe, anonProbe }));

await openChat(A, B.me.id);
await openChat(B, A.me.id);

if (SCENARIO === "off") {
  await dial(A, "audio");
  const toastShown = await A.page.getByText(/Calling isn't available right now/).first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
  await shot(A.page, "call_off_toast_360");
  const aRang = await A.page.locator("[data-call-phase]").count();
  const bRang = await phase(B, "incoming", 3000);
  R.check("CL1", "Máy chủ chưa cấu hình dịch vụ gọi (thiếu ZEGO_APP_ID): bấm gọi → báo ngay 'Calling isn't available right now', không màn đổ chuông, máy bên kia KHÔNG đổ chuông",
    toastShown && aRang === 0 && !bRang, JSON.stringify({ toastShown, aRang, bRang }));
} else {
  // ---- A (360px) gọi video cho B (412px) ----
  await dial(A, "video");
  const aOut = await phase(A, "outgoing", 10000);
  const bIn = await phase(B, "incoming", 15000);
  await A.page.waitForTimeout(700);
  await shot(A.page, "call_outgoing_360");
  await shot(B.page, "call_incoming_412");
  const la = await callLayout(A), lb = await callLayout(B);
  R.check("CL1", "Đổ chuông: người gọi (360px) thấy 'Ringing', người nhận (412px) thấy 'Incoming video call' + Trả lời / Từ chối; không tràn ngang, nút nằm trọn + đủ lớn",
    aOut && bIn && layoutOk(la) && layoutOk(lb), JSON.stringify({ aOut, bIn, la, lb }).slice(0, 300));
  await B.page.getByRole("button", { name: /^(Answer|Trả lời)$/ }).click();
  const aConn = await phase(A, "connecting", 15000);
  const bConn = await phase(B, "connecting", 5000);
  R.check("CL2", "Nghe máy → cả 2 vào phòng (connecting) qua /api/zego/token", aConn && bConn, JSON.stringify({ aConn, bConn }));

  if (SCENARIO === "dummy") {
    // ZEGOCLOUD thật từ chối token giả → báo lỗi có mã NGAY (trước đây: 30s rồi "kiểm tra mạng")
    const t0 = Date.now();
    const errA = await A.page.locator('[data-call-error="other"]').waitFor({ timeout: 25000 }).then(() => Date.now() - t0).catch(() => -1);
    const errText = errA >= 0 ? (await A.page.locator('[data-call-error]').innerText()).replace(/\s+/g, " ") : "";
    await A.page.waitForTimeout(1500); // hộp thoại tiếng Anh của UIKit hiện trễ vài nhịp — phải bị ẩn
    await shot(A.page, "call_zego_rejected_360");
    const lErr = await callLayout(A);
    const zegoDialog = await A.page.getByText(/Login room Failed/).first().isVisible().catch(() => false);
    const stillInCall = await B.page.locator("[data-call-phase]").count();
    R.check("CL3", `ZEGOCLOUD từ chối đăng nhập phòng → báo ngay kèm mã (${errA}ms): "${errText.slice(0, 90)}"; màn gọi KHÔNG tự đóng, hộp thoại tiếng Anh 'Login room Failed' của SDK bị ẩn; nút Thử lại + Nhắn tin ≥ 44px nằm trọn trong 360px`,
      errA >= 0 && errA < 20000 && /code \d{6,}/.test(errText) && /Try again/.test(errText) && layoutOk(lErr) && !zegoDialog && stillInCall === 1,
      JSON.stringify({ errA, errText, zegoDialog, stillInCall, lErr, logs: A.logs.slice(-3) }).slice(0, 300));
    // cúp máy: chuyển sang nhắn tin → hết màn gọi ở cả 2 bên
    await A.page.getByRole("button", { name: /Switch to messaging/ }).click();
    const aGone = await A.page.locator("[data-call-phase]").waitFor({ state: "detached", timeout: 8000 }).then(() => true).catch(() => false);
    const bGone = await B.page.locator("[data-call-phase]").waitFor({ state: "detached", timeout: 8000 }).then(() => true).catch(() => false);
    R.check("CL4", "'Switch to messaging' → kết thúc cuộc gọi ở cả 2 máy", aGone && bGone, JSON.stringify({ aGone, bGone }));

    // ---- Máy bị chặn micro (tiếng Việt, 360px) nghe máy → câu báo + hướng dẫn bật quyền, không vào phòng câm ----
    const C = await login(media, SEED_OWNER_2, { w: 360, h: 780, locale: "vi-VN", grant: false, denyMedia: true });
    await C.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content: "Thử chặn micro" }, headers: C.h });
    await openChat(C, B.me.id);
    await B.page.goto(BASE_URL + `/messages?to=${C.me.id}`);
    await B.page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
    await B.page.waitForTimeout(800);
    await dial(B, "audio");
    const cIn = await phase(C, "incoming", 15000);
    await shot(C.page, "call_incoming_vi_360");
    await C.page.getByRole("button", { name: /^(Answer|Trả lời)$/ }).click();
    const perm = await C.page.locator('[data-call-error="permission"]').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    const permText = perm ? (await C.page.locator('[data-call-error]').innerText()).replace(/\s+/g, " ") : "";
    await shot(C.page, "call_mic_blocked_vi_360");
    const lPerm = await callLayout(C);
    R.check("CL5", `Micro bị chặn (VI, 360px): "${permText.slice(0, 120)}" — có hướng dẫn bật quyền + Thử lại, không tràn`,
      cIn && perm && /micrô/i.test(permText) && /(ổ khoá|Cài đặt)/.test(permText) && /Thử lại/.test(permText) && layoutOk(lPerm), JSON.stringify({ cIn, perm, permText, lPerm }).slice(0, 300));
    R.check("CL6", "Không có lỗi JS (3 máy)", !A.errors.length && !B.errors.length && !C.errors.length, JSON.stringify([...A.errors, ...B.errors, ...C.errors]).slice(0, 300));
    await C.ctx.close();
  } else {
    // real: ZEGOCLOUD thật — 2 bên thông, hoặc mã lỗi thật
    const res = await Promise.race([
      Promise.all([phase(A, "connected", 40000), phase(B, "connected", 40000)]).then(([a, b]) => (a && b ? "connected" : "timeout")),
      A.page.locator("[data-call-error]").waitFor({ timeout: 40000 }).then(async () => "error: " + (await A.page.locator("[data-call-error]").innerText()).replace(/\s+/g, " ")).catch(() => "timeout"),
    ]);
    await shot(A.page, "call_real_360");
    await shot(B.page, "call_real_412");
    let media2 = null;
    if (res === "connected") {
      await A.page.waitForTimeout(4000);
      media2 = await Promise.all([A, B].map((u) => u.page.evaluate(() => [...document.querySelectorAll("[data-call-phase] video, [data-call-phase] audio")].map((v) => ({ tag: v.tagName, w: v.videoWidth || 0, t: Math.round(v.currentTime * 10) / 10, paused: v.paused })))));
    }
    R.check("CL3", `ZEGOCLOUD thật: ${res}${media2 ? " · media " + JSON.stringify(media2).slice(0, 160) : ""}`, res === "connected" && media2.every((l) => l.some((v) => !v.paused && v.t > 0)), JSON.stringify({ res, media2, logs: [...A.logs, ...B.logs].slice(-4) }).slice(0, 300));
    // cúp máy
    if (await A.page.locator("[data-call-phase]").count()) await A.page.keyboard.press("Escape").catch(() => {});
  }
}

R.check("CLe", "Không có lỗi JS", !A.errors.length && !B.errors.length, JSON.stringify([...A.errors, ...B.errors]).slice(0, 300));
await media.close();
const sum = R.summary();
if (SHOTS) fs.writeFileSync(path.join(SHOTS, `call_ui_${SCENARIO}_results.json`), JSON.stringify(sum, null, 2));
process.exit(sum.failed ? 1 : 0);
