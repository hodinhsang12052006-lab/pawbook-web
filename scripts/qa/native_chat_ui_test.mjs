// Kiểm thử GIAO DIỆN thông báo chat của app Android + bong bóng chat, chạy trên trình duyệt:
//   - "app Android giả": dựng window.androidBridge + Capacitor.PluginHeaders trước khi trang tải → @capacitor/core coi
//     là nền tảng android, mọi lệnh plugin (App / PushNotifications / PawNailNative) đi vào hàm giả ghi lại lời gọi;
//   - bong bóng chat: User-Agent có "PawNailBubble" (WebView riêng, không Capacitor) / ?bubble=1.
//   NC1  web thường: không dải mời, không hàng "Chat bubbles"
//   NC2  app (chưa bật): dải "Get message notifications" → Bật → xin quyền → register → máy chủ lưu build (native:3)
//   NC3  app (đã bật, Android 13, bong bóng tắt): mẹo 1 lần "Turn on chat bubbles" → mở Cài đặt bong bóng
//   NC4  mở cuộc trò chuyện → setActiveConversation(cid) + clearConversation(cid); ẩn app → null; hiện lại → cid; đóng → null
//   NC5  Hồ sơ → hàng "Chat bubbles" hiện trạng thái + mở Cài đặt bong bóng
//   NC6  bản app cũ (PawNailNative chỉ có getInfo): không lỗi, không mẹo bong bóng, không hàng
//   NC6b đã bật nhưng người dùng tắt riêng kênh "Tin nhắn" → dải "Notifications are off" → mở Cài đặt thông báo
//   NC7  bong bóng: chỉ khung chat (không Navbar / thanh dưới / danh sách / nút quay lại / nút gọi), html[data-bubble], gửi được tin
//   NC8  bong bóng: link hồ sơ → tải trang thật (app native bắt được), không điều hướng phía client
//   NC9  ?c=<id> khi đang mở chat khác → chuyển đúng cuộc trò chuyện
//   NC10 ?c=<id> chưa có trong danh sách đã tải → tải riêng rồi mở
//   NC12 link ?bubble=1 gửi trong tin nhắn KHÔNG bật chế độ bong bóng ở trình duyệt / app chính (chỉ User-Agent)
//   NC13 bong bóng thiếu ?c= → màn "Couldn't open this conversation" + nút "Open PawNail" (không quay mãi)
//   NC14 app: bấm thông báo khi app đang chạy → window.__pawnailOpenUrl chuyển trang mềm (không tải lại), path lạ → false
//   NC15 app: Đăng xuất → gỡ token khỏi tài khoản (DELETE), PawNailNative.clearAll(); đăng nhập lại → tự đăng ký lại
// Server: bash <script giống scripts/qa/start-launch-server.sh> (cần FIREBASE_SERVICE_ACCOUNT + FCM_ALLOW_TEST để máy chủ
// báo nativeEnabled). DB: QA_DB_URL=file:… (cùng DB với server).
//   BASE_URL=http://localhost:3000 QA_DB_URL=file:/path/qa.db node scripts/qa/native_chat_ui_test.mjs
import crypto from "node:crypto";
import { createClient } from "@libsql/client";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, Results, SEED_OWNER, SEED_TECH, registerUser } from "./lib.mjs";

const R = new Results("Thông báo chat app Android + bong bóng chat (UI)");
const TMP = process.env.TEMP || ".";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = createClient({ url: process.env.QA_DB_URL?.startsWith("file:") ? process.env.QA_DB_URL : "file:prisma/dev.db" });
await db.execute("PRAGMA busy_timeout = 10000");

const cfgOk = (await new Client().req("/api/push/subscribe")).data;
if (!cfgOk?.nativeEnabled) {
  console.error("❌ Máy chủ chưa bật FCM (nativeEnabled=false) — chạy server với FIREBASE_SERVICE_ACCOUNT + FCM_ALLOW_TEST như scripts/qa/start-launch-server.sh");
  process.exit(2);
}

// ---------- dữ liệu: chủ tiệm nhắn thợ (1-1) + nhóm mới do 1 tài khoản MỚI tạo (không chạm trần nhóm / ngày) ----------
const owner = new Client();
const tech = new Client();
await owner.login(SEED_OWNER);
await tech.login(SEED_TECH);
const hostReg = await registerUser({ name: "QA Group Host" });
const host = hostReg.client;
await host.login(hostReg.body.email, hostReg.body.password);
const stamp = Date.now() % 1_000_000;
const dm = await owner.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: `QA ui ${stamp}`, type: "TEXT", clientId: crypto.randomUUID() } });
const dmId = dm.data?.message?.conversationId;
const groupName = `QA Bubble ${stamp}`;
const grp = await host.req("/api/conversations", { method: "POST", json: { isGroup: true, name: groupName, participantIds: [tech.userId] } });
const gid = grp.data?.id;
await host.req("/api/messages", { method: "POST", json: { conversationId: gid, content: `QA nhóm ${stamp}`, type: "TEXT", clientId: crypto.randomUUID() } });
if (!dmId || !gid) {
  console.error("❌ Không tạo được dữ liệu", dm.status, grp.status);
  process.exit(1);
}
const techCookies = Object.entries(tech.jar).map(([name, value]) => ({ name, value, url: BASE_URL }));

// ---------- "app Android" giả ----------
function fakeAndroid(cfg) {
  window.androidBridge = { postMessage() {} };
  // Quyền thông báo giữ qua các lần tải lại trang như máy thật.
  let saved = null;
  try {
    saved = localStorage.getItem("__pnFakePerm");
  } catch {}
  const st = (window.__pn = { calls: [], listeners: {}, perm: saved || cfg.perm });
  const H = (name, promises, callbacks = []) => ({ name, methods: [...promises.map((n) => ({ name: n, rtype: "promise" })), ...callbacks.map((n) => ({ name: n, rtype: "callback" }))] });
  const nativeMethods = cfg.legacy ? ["getInfo"] : ["getInfo", "setActiveConversation", "clearConversation", "clearAll", "openBubbleSettings", "openNotificationSettings"];
  const fire = (ev, data) => (st.listeners["PushNotifications:" + ev] || []).forEach((cb) => cb(data));
  window.Capacitor = {
    PluginHeaders: [
      H("App", ["getInfo", "getLaunchUrl", "getState", "minimizeApp", "exitApp", "removeAllListeners"], ["addListener", "removeListener"]),
      H("PushNotifications", ["register", "unregister", "checkPermissions", "requestPermissions", "removeAllListeners", "removeAllDeliveredNotifications"], ["addListener", "removeListener"]),
      H("PawNailNative", nativeMethods),
    ],
    nativePromise(plugin, method, options) {
      st.calls.push({ plugin, method, options: options ?? null });
      switch (plugin + "." + method) {
        case "App.getInfo":
          return Promise.resolve({ name: "PawNail", id: "com.bitpawos.app", build: String(cfg.build), version: "1.2.0" });
        case "App.getLaunchUrl":
          return Promise.resolve({});
        case "PushNotifications.checkPermissions":
          return Promise.resolve({ receive: st.perm });
        case "PushNotifications.requestPermissions":
          st.perm = "granted";
          try {
            localStorage.setItem("__pnFakePerm", "granted");
          } catch {}
          return Promise.resolve({ receive: "granted" });
        case "PushNotifications.register":
          setTimeout(() => fire("registration", { value: cfg.token }), 50);
          return Promise.resolve();
        case "PawNailNative.getInfo":
          return Promise.resolve(
            cfg.legacy
              ? { firebase: true }
              : { firebase: true, sdk: cfg.sdk, bubbles: cfg.sdk >= 30, bubblePref: cfg.bubblePref, notificationsEnabled: true, messagesChannel: cfg.messagesChannel !== false, chat: 1 }
          );
        default:
          return Promise.resolve({});
      }
    },
    nativeCallback(plugin, method, options, cb) {
      st.calls.push({ plugin, method, options: options ?? null });
      if (method === "addListener" && cb) (st.listeners[plugin + ":" + options.eventName] ||= []).push(cb);
      return "cb" + Math.random().toString(36).slice(2);
    },
  };
}
const nativeCalls = (p, method) => p.evaluate((m) => window.__pn.calls.filter((c) => c.plugin === "PawNailNative" && c.method === m).map((c) => c.options), method);
const lastActive = async (p) => (await nativeCalls(p, "setActiveConversation")).at(-1)?.id;
const setVisibility = (p, state) =>
  p.evaluate((s) => {
    Object.defineProperty(document, "visibilityState", { value: s, configurable: true });
    Object.defineProperty(document, "hidden", { value: s === "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

const browser = await chromium.launch();
const errors = [];
async function newPage({ android, ua, viewport = { width: 390, height: 844 }, mobile = true } = {}) {
  const base = mobile ? devices["iPhone 13"] : {};
  const ctx = await browser.newContext({ ...base, viewport, locale: "en-US", ...(ua ? { userAgent: ua } : {}) });
  await ctx.addCookies(techCookies);
  // Không để toast "việc mới" / lời mời chung che giao diện đang kiểm tra.
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
      localStorage.setItem("pn_push_dismissed_at", String(Date.now()));
    } catch {}
  });
  if (android) await ctx.addInitScript(fakeAndroid, android);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${android ? "app" : ua ? "bubble" : "web"}: ${e.message}`));
  return { ctx, p };
}
const visible = (loc, timeout = 8000) => loc.first().waitFor({ state: "visible", timeout }).then(() => true).catch(() => false);

try {
  // ---------------- NC1: web thường ----------------
  {
    const { ctx, p } = await newPage({});
    await p.goto(BASE_URL + "/messages");
    await p.locator(".m-list").first().waitFor({ timeout: 20000 });
    await sleep(2500);
    const banner = await p.locator(".m-notify").count();
    await p.goto(BASE_URL + "/profile");
    await p.getByText("Sound & haptics").first().waitFor({ timeout: 20000 }).catch(() => {});
    await sleep(1500);
    const row = await p.getByText("Chat bubbles").count();
    R.check("NC1", "Web thường: không dải mời trong Tin nhắn, không hàng 'Chat bubbles' ở Hồ sơ", banner === 0 && row === 0, `banner ${banner} row ${row}`);
    await ctx.close();
  }

  // ---------------- NC2–NC5: app Android đủ mới ----------------
  const token = "fcmQA" + crypto.randomBytes(24).toString("hex") + ":APA91b" + crypto.randomBytes(16).toString("hex");
  {
    const { ctx, p } = await newPage({ android: { perm: "prompt", build: 3, sdk: 33, bubblePref: "none", token } });
    await p.goto(BASE_URL + "/messages");
    const banner = p.locator(".m-notify");
    const shown = await visible(banner.filter({ hasText: "Get message notifications" }), 15000);
    await p.screenshot({ path: TMP + "/native_chat_banner_push.png" });
    R.check("NC2a", "App Android chưa bật thông báo → dải 'Get message notifications' ở đầu danh sách", shown);
    if (shown) await banner.getByRole("button", { name: "Turn on" }).click();
    await banner.waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    await sleep(800);
    const row = (await db.execute({ sql: `SELECT userId, p256dh FROM "PushSubscription" WHERE endpoint = ?`, args: ["fcm:" + token] })).rows[0];
    const calls = await p.evaluate(() => window.__pn.calls.map((c) => c.plugin + "." + c.method));
    R.check("NC2b", "Bấm Bật → xin quyền → register → máy chủ lưu token với build (p256dh native:3); dải biến mất",
      row && String(row.userId) === tech.userId && String(row.p256dh) === "native:3" && calls.includes("PushNotifications.requestPermissions") && calls.includes("PushNotifications.register") && (await banner.count()) === 0,
      JSON.stringify({ row, calls: calls.filter((c) => c.startsWith("Push")) }).slice(0, 260));

    // Đã bật → lần sau: mẹo bong bóng (Android 13, cài đặt bong bóng "none")
    await p.reload();
    const tip = banner.filter({ hasText: "Turn on chat bubbles" });
    const tipShown = await visible(tip, 15000);
    await p.screenshot({ path: TMP + "/native_chat_banner_bubbles.png" });
    if (tipShown) await tip.getByRole("button", { name: "Turn on" }).click();
    await sleep(600);
    const opened = (await nativeCalls(p, "openBubbleSettings")).length;
    await p.reload();
    await p.locator(".m-list").first().waitFor({ timeout: 20000 });
    await sleep(3000);
    const again = await banner.count();
    R.check("NC3", "Đã bật + bong bóng chưa bật → mẹo 'Turn on chat bubbles' → mở Cài đặt bong bóng; không hiện lại", tipShown && opened === 1 && again === 0, `shown ${tipShown} opened ${opened} again ${again}`);

    // NC4: mở cuộc trò chuyện nhóm → báo app cuộc đang xem
    await p.locator("button.m-conv", { hasText: groupName }).first().click();
    await p.locator("textarea").first().waitFor({ timeout: 15000 });
    await sleep(800);
    const a1 = await lastActive(p);
    const cleared = (await nativeCalls(p, "clearConversation")).some((o) => o?.id === gid);
    await setVisibility(p, "hidden");
    await sleep(300);
    const a2 = await lastActive(p);
    await setVisibility(p, "visible");
    await sleep(300);
    const a3 = await lastActive(p);
    await p.getByRole("button", { name: "Back to chats" }).click();
    await sleep(800);
    const a4 = await lastActive(p);
    R.check("NC4", "Mở chat → setActiveConversation(cid) + clearConversation(cid); ẩn app → null; hiện lại → cid; quay lại danh sách → null",
      a1 === gid && cleared && a2 === null && a3 === gid && a4 === null, JSON.stringify({ a1, cleared, a2, a3, a4 }));

    // NC5: hàng "Chat bubbles" trong Hồ sơ
    await p.goto(BASE_URL + "/profile");
    const bubbleRow = p.getByRole("button", { name: /Chat bubbles/ });
    const rowShown = await visible(bubbleRow, 20000);
    const rowText = rowShown ? await bubbleRow.first().innerText() : "";
    if (rowShown) {
      await bubbleRow.first().scrollIntoViewIfNeeded();
      await p.screenshot({ path: TMP + "/native_chat_settings_row.png" });
      await bubbleRow.first().click();
    }
    await sleep(500);
    const opened2 = (await nativeCalls(p, "openBubbleSettings")).length;
    R.check("NC5", "Hồ sơ → hàng 'Chat bubbles' (Android 11+) ghi trạng thái 'Off' → bấm mở Cài đặt bong bóng", rowShown && /Off/.test(rowText) && opened2 === 1, `${rowShown} ${JSON.stringify(rowText)} ${opened2}`);
    await ctx.close();
  }

  // ---------------- NC6: bản app cũ ----------------
  {
    const before = errors.length;
    const { ctx, p } = await newPage({ android: { perm: "granted", build: 2, sdk: 33, bubblePref: "none", token: "fcmQAold" + crypto.randomBytes(20).toString("hex"), legacy: true } });
    await p.goto(BASE_URL + "/messages");
    await p.locator(".m-list").first().waitFor({ timeout: 20000 });
    await p.evaluate(() => localStorage.setItem("pn_native_push_token", "x".repeat(30))); // đã bật từ trước
    await p.reload();
    await p.locator(".m-list").first().waitFor({ timeout: 20000 });
    await sleep(2500);
    const tip = await p.locator(".m-notify").count();
    await p.locator("button.m-conv", { hasText: groupName }).first().click();
    await p.locator("textarea").first().waitFor({ timeout: 15000 });
    await sleep(1000);
    await p.goto(BASE_URL + "/profile");
    await p.getByText("Sound & haptics").first().waitFor({ timeout: 20000 }).catch(() => {});
    await sleep(1500);
    const row = await p.getByText("Chat bubbles").count();
    R.check("NC6", "Bản app cũ (PawNailNative chỉ có getInfo): mở chat không lỗi JS, không mẹo bong bóng, không hàng 'Chat bubbles'", tip === 0 && row === 0 && errors.length === before, JSON.stringify({ tip, row, errs: errors.slice(before) }).slice(0, 260));
    await ctx.close();
  }

  // ---------------- NC6b: kênh "Tin nhắn" bị tắt riêng ----------------
  {
    const { ctx, p } = await newPage({ android: { perm: "granted", build: 3, sdk: 34, bubblePref: "all", messagesChannel: false, token: "fcmQAch" + crypto.randomBytes(20).toString("hex") } });
    await p.goto(BASE_URL + "/messages");
    await p.locator(".m-list").first().waitFor({ timeout: 20000 });
    await p.evaluate(() => localStorage.setItem("pn_native_push_token", "x".repeat(30))); // đã bật từ trước
    await p.reload();
    const off = p.locator(".m-notify", { hasText: "Notifications are off" });
    const shown = await visible(off, 15000);
    if (shown) await off.getByRole("button", { name: "Settings" }).click();
    await sleep(500);
    const opened = (await nativeCalls(p, "openNotificationSettings")).length;
    R.check("NC6b", "Đã bật nhưng tắt riêng kênh 'Tin nhắn' → dải 'Notifications are off' → mở Cài đặt thông báo của app", shown && opened === 1, `${shown} ${opened}`);
    await ctx.close();
  }

  // ---------------- NC7–NC8: bong bóng chat ----------------
  {
    const ua = devices["Pixel 7"].userAgent + " PawNailApp PawNailBubble";
    const { ctx, p } = await newPage({ ua, viewport: { width: 360, height: 640 }, mobile: false });
    await p.goto(`${BASE_URL}/messages?c=${dmId}&bubble=1`);
    const composer = p.locator("textarea").first();
    const ready = await visible(composer, 20000);
    await sleep(1200);
    const state = await p.evaluate(() => {
      const shown = (sel) => [...document.querySelectorAll(sel)].some((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden");
      return {
        bubbleAttr: document.documentElement.hasAttribute("data-bubble"),
        header: shown("header"),
        bnav: shown(".pn-bnav"),
        list: shown(".m-list"),
        back: !!document.querySelector('[aria-label="Back to chats"]'),
        call: !!document.querySelector('[title="Secure voice call"], [title="Live video call"]'),
        // Lớp phủ toàn app (lời mời, toast, thanh dưới…) không chỉ bị ẩn mà KHÔNG được mount trong bong bóng.
        overlaysMounted: [...document.querySelectorAll("[data-bubble-hide]")].reduce((n, el) => n + el.childElementCount, 0),
      };
    });
    await p.screenshot({ path: TMP + "/native_chat_bubble.png" });
    const text = `QA từ bong bóng ${stamp}`;
    if (ready) {
      await composer.fill(text);
      await composer.press("Enter");
    }
    await sleep(2500);
    const got = (await db.execute({ sql: `SELECT COUNT(*) n FROM "Message" WHERE conversationId = ? AND body = ? AND senderId = ?`, args: [dmId, text, tech.userId] })).rows[0].n;
    R.check("NC7", "Bong bóng: chỉ khung chat (html[data-bubble], không Navbar / thanh dưới / danh sách / nút quay lại / nút gọi) và gửi được tin",
      ready && state.bubbleAttr && !state.header && !state.bnav && !state.list && !state.back && !state.call && state.overlaysMounted === 0 && Number(got) === 1, JSON.stringify({ ready, ...state, got }));

    // Link hồ sơ trong khung chat → tải trang thật (app native chuyển sang app chính), không router.push
    await p.evaluate(() => (window.__pnMarker = 1));
    const link = p.locator(`h3 a[href*="/profile/"]`).first();
    const hasLink = (await link.count()) > 0;
    if (hasLink) await link.click();
    await p.waitForURL(/\/profile\//, { timeout: 15000 }).catch(() => {});
    await p.waitForLoadState("domcontentloaded").catch(() => {});
    const marker = await p.evaluate(() => window.__pnMarker ?? null).catch(() => "err");
    R.check("NC8", "Bong bóng: bấm link hồ sơ → tải trang thật (không điều hướng phía client) để app chuyển sang app chính", hasLink && /\/profile\//.test(p.url()) && marker === null, `${hasLink} ${p.url()} marker=${marker}`);
    await ctx.close();
  }

  // ---------------- NC9–NC10: ?c= mở đúng cuộc trò chuyện ----------------
  {
    const { ctx, p } = await newPage({ viewport: { width: 1280, height: 860 }, mobile: false });
    await p.goto(`${BASE_URL}/messages?c=${dmId}`);
    await p.locator("textarea").first().waitFor({ timeout: 20000 });
    await p.evaluate((id) => window.history.pushState(null, "", `/messages?c=${id}`), gid);
    const switched = await visible(p.locator("h3", { hasText: groupName }), 10000);
    R.check("NC9", "Đang mở chat 1-1 → link ?c=<nhóm> (bấm thông báo) → chuyển sang đúng nhóm", switched);

    const lateName = `QA Late ${stamp}`;
    const late = await host.req("/api/conversations", { method: "POST", json: { isGroup: true, name: lateName, participantIds: [tech.userId] } });
    const lateId = late.data?.id;
    await p.evaluate((id) => window.history.pushState(null, "", `/messages?c=${id}`), lateId);
    const opened = await visible(p.locator("h3", { hasText: lateName }), 12000);
    R.check("NC10", "?c=<id> chưa có trong danh sách đã tải → tải riêng (/api/conversations?id=) rồi mở", !!lateId && opened, `${late.status} ${opened}`);
    await ctx.close();
  }

  // ---------------- NC12: ?bubble=1 trong link không bật chế độ bong bóng ----------------
  {
    const { ctx, p } = await newPage({});
    await p.goto(`${BASE_URL}/jobs?bubble=1`);
    await p.waitForLoadState("domcontentloaded");
    await sleep(1500);
    const onJobs = await p.evaluate(() => document.documentElement.hasAttribute("data-bubble"));
    await p.goto(`${BASE_URL}/messages?c=${dmId}&bubble=1`);
    await p.locator("textarea").first().waitFor({ timeout: 20000 }).catch(() => {});
    await sleep(800);
    const st = await p.evaluate(() => ({ attr: document.documentElement.hasAttribute("data-bubble"), back: !!document.querySelector('[aria-label="Back to chats"]') }));
    R.check("NC12", "Link ?bubble=1 (ai cũng gửi được trong tin nhắn) KHÔNG bật chế độ bong bóng: /jobs và /messages vẫn đủ giao diện", !onJobs && !st.attr && st.back, JSON.stringify({ onJobs, ...st }));
    await ctx.close();
  }

  // ---------------- NC13: bong bóng thiếu ?c= ----------------
  {
    const ua = devices["Pixel 7"].userAgent + " PawNailApp PawNailBubble";
    const { ctx, p } = await newPage({ ua, viewport: { width: 360, height: 640 }, mobile: false });
    await p.goto(`${BASE_URL}/messages?bubble=1`);
    const err = p.getByText("Couldn't open this conversation");
    const shown = await visible(err, 15000);
    const btn = p.getByRole("button", { name: "Open PawNail" });
    const box = shown ? await btn.boundingBox() : null;
    const busy = await p.locator('[aria-busy="true"]').count();
    await p.screenshot({ path: TMP + "/native_chat_bubble_missing.png" });
    R.check("NC13", "Bong bóng không có ?c= → 'Couldn't open this conversation' + nút 'Open PawNail' (≥ 44 px), không vòng quay mãi",
      shown && !!box && box.height >= 44 && busy === 0, JSON.stringify({ shown, box, busy }));
    await ctx.close();
  }

  // ---------------- NC14: bấm thông báo khi app đang chạy → chuyển trang mềm ----------------
  {
    const { ctx, p } = await newPage({ android: { perm: "granted", build: 3, sdk: 34, bubblePref: "all", token: "fcmQAsoft" + crypto.randomBytes(20).toString("hex") }, viewport: { width: 1280, height: 860 }, mobile: false });
    await p.goto(`${BASE_URL}/messages?c=${dmId}`);
    await p.locator("textarea").first().waitFor({ timeout: 20000 });
    await p.evaluate(() => (window.__pnMarker = 1));
    const r1 = await p.evaluate((id) => window.__pawnailOpenUrl?.(`/messages?c=${id}`), gid);
    const toGroup = await visible(p.locator("h3", { hasText: groupName }), 10000);
    const marker1 = await p.evaluate(() => window.__pnMarker ?? null);
    // Chọn cuộc trò chuyện khác trong danh sách (máy tính: URL vẫn ?c=<nhóm>) rồi bấm lại ĐÚNG thông báo của nhóm → URL
    // không đổi nhưng vẫn mở lại nhóm (trước đây id đã xử lý bị bỏ qua).
    await p.locator("button.m-conv").filter({ hasNotText: groupName }).first().click();
    await sleep(1200);
    const switchedAway = !(await p.locator("h3", { hasText: groupName }).isVisible().catch(() => false));
    const r2 = await p.evaluate((id) => window.__pawnailOpenUrl?.(`/messages?c=${id}`), gid);
    const again = await visible(p.locator("h3", { hasText: groupName }), 10000);
    const r3 = await p.evaluate(() => [window.__pawnailOpenUrl?.("//evil.example/x"), window.__pawnailOpenUrl?.("https://evil.example/"), window.__pawnailOpenUrl?.("/messages x")]);
    const marker2 = await p.evaluate(() => window.__pnMarker ?? null);
    R.check("NC14", "App đang chạy: __pawnailOpenUrl('/messages?c=<nhóm>') → true, chuyển sang nhóm KHÔNG tải lại trang (cả lần bấm lại); '//host', URL tuyệt đối, có khoảng trắng → false",
      r1 === true && toGroup && marker1 === 1 && switchedAway && r2 === true && again && marker2 === 1 && r3.every((x) => x === false), JSON.stringify({ r1, toGroup, marker1, switchedAway, r2, again, marker2, r3 }));
    await ctx.close();
  }

  // ---------------- NC15: đăng xuất trong app Android ----------------
  {
    // Máy thật: Firebase trả lại CÙNG token mỗi lần register → app giả cũng trả đúng token đã đăng ký.
    const tok = "fcmQAout" + crypto.randomBytes(24).toString("hex");
    const reg = await tech.req("/api/push/native", { method: "POST", json: { token: tok, platform: "android", build: 3 } });
    const { ctx, p } = await newPage({ android: { perm: "granted", build: 3, sdk: 34, bubblePref: "all", token: tok } });
    await p.goto(BASE_URL + "/profile");
    await p.evaluate((t) => localStorage.setItem("pn_native_push_token", t), tok);
    await sleep(2500); // initNativePush làm mới token (cùng token) xong rồi mới bấm Đăng xuất
    const signOutBtn = p.getByRole("button", { name: /Sign out/ });
    const hasBtn = await visible(signOutBtn, 20000);
    if (hasBtn) {
      await signOutBtn.first().scrollIntoViewIfNeeded();
      await signOutBtn.first().click();
    }
    await p.waitForURL(/\/auth\/login/, { timeout: 15000 }).catch(() => {});
    await sleep(500);
    const row = (await db.execute({ sql: `SELECT COUNT(*) n FROM "PushSubscription" WHERE endpoint = ?`, args: ["fcm:" + tok] })).rows[0].n;
    const ls = await p.evaluate(() => ({ token: localStorage.getItem("pn_native_push_token"), relogin: localStorage.getItem("pn_native_push_relogin") }));
    const cleared = (await nativeCalls(p, "clearAll")).length;
    const session = await p.evaluate(() => fetch("/api/auth/session").then((r) => r.json()).catch(() => null));
    // Đăng nhập lại (cookie phiên mới) → lần mở app sau tự đăng ký lại token cho tài khoản (không phải bật lại).
    await ctx.addCookies(techCookies);
    await p.goto(BASE_URL + "/messages");
    await p.locator(".m-list").first().waitFor({ timeout: 20000 }).catch(() => {});
    await sleep(2500);
    const back = (await db.execute({ sql: `SELECT userId, p256dh FROM "PushSubscription" WHERE endpoint = ?`, args: ["fcm:" + tok] })).rows[0];
    const ls2 = await p.evaluate(() => ({ token: localStorage.getItem("pn_native_push_token"), relogin: localStorage.getItem("pn_native_push_relogin") }));
    R.check("NC15", "App: Đăng xuất → token máy này bị gỡ khỏi tài khoản (DB), PawNailNative.clearAll() (thông báo / lịch sử / lối tắt), phiên hết; đăng nhập lại → tự đăng ký lại (native:3), cờ được xoá",
      reg.status === 200 && hasBtn && Number(row) === 0 && ls.token === null && ls.relogin === "1" && cleared === 1 && !session?.user &&
        !!back && String(back.userId) === tech.userId && String(back.p256dh) === "native:3" && ls2.token === tok && ls2.relogin === null,
      JSON.stringify({ reg: reg.status, hasBtn, row, ls, cleared, session: !!session?.user, back, ls2 }).slice(0, 320));
    await ctx.close();
  }

  R.check("NC11", "Không lỗi JS trên mọi trang", errors.length === 0, errors.slice(0, 4).join(" | "));
} finally {
  await browser.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
