// Kiểm thử THÔNG BÁO ĐẨY từ đầu tới cuối: dựng máy chủ push giả, đăng ký
// "thiết bị" bằng khoá ECDH thật, kích hoạt sự kiện thật (thích, nhắn tin,
// gọi, việc gấp), rồi GIẢI MÃ gói tin mã hoá để kiểm tra nội dung.
// Cần server local chạy với PUSH_ALLOW_TEST_ENDPOINT=1 + khoá VAPID.
//   node scripts/qa/push_test.mjs
import https from "node:https";
import fs from "node:fs";
import crypto from "node:crypto";
import ece from "http_ece";
import { createClient } from "@libsql/client";
import { chromium } from "playwright";
import { BASE_URL, Client, DEMO_PASSWORD, Results, SEED_OWNER, SEED_TECH } from "./lib.mjs";

const R = new Results("Thông báo đẩy");
const PORT = 4999;
const b64u = (buf) => Buffer.from(buf).toString("base64url");

// ---- Máy chủ push giả ----
const inbox = []; // { device, headers, body }
const goneDevices = new Set();
// HTTPS: thư viện web-push luôn gửi qua TLS. Chứng chỉ tự ký chỉ dùng cho test
// (server Next phải chạy với NODE_TLS_REJECT_UNAUTHORIZED=0 trong lúc test).
const TMP = process.env.TEMP || ".";
const server = https.createServer({ key: fs.readFileSync(TMP + "/pushtest-key.pem"), cert: fs.readFileSync(TMP + "/pushtest-cert.pem") }, (req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const device = req.url.split("/").pop();
    inbox.push({ device, headers: req.headers, body: Buffer.concat(chunks) });
    res.writeHead(goneDevices.has(device) ? 410 : 201).end();
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

// "Thiết bị": cặp khoá ECDH P-256 + auth secret thật, như trình duyệt tạo.
function makeDevice(name) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { name, ecdh, auth, sub: { endpoint: `https://127.0.0.1:${PORT}/push/${name}`, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } } };
}
function decrypt(dev, body) {
  return JSON.parse(ece.decrypt(body, { version: "aes128gcm", privateKey: dev.ecdh, authSecret: b64u(dev.auth) }).toString("utf8"));
}
async function waitPush(dev, pred, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    for (const m of inbox.filter((x) => x.device === dev.name)) {
      try {
        const p = decrypt(dev, m.body);
        if (pred(p)) return { p, headers: m.headers };
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

try {
  const cfg = await new Client().req("/api/push/subscribe");
  R.check("PU1", "Máy chủ đã bật Web Push (có khoá VAPID)", cfg.data?.enabled === true, JSON.stringify(cfg.data));

  const anon = new Client();
  R.check("PU2", "Đăng ký thông báo bắt buộc đăng nhập", (await anon.req("/api/push/subscribe", { method: "POST", json: {} })).status === 401);

  const tech = new Client();
  await tech.login(SEED_TECH);
  const owner = new Client();
  await owner.login(SEED_OWNER);
  const evil = await tech.req("/api/push/subscribe", { method: "POST", json: { endpoint: "https://evil.example.com/steal", keys: { p256dh: "x".repeat(40), auth: "y".repeat(20) } } });
  R.check("PU3", "Từ chối endpoint lạ (chống SSRF)", evil.status === 400, evil.status);

  const phone = makeDevice(`tech-${Date.now()}`);
  const ownerPhone = makeDevice(`owner-${Date.now()}`);
  const s1 = await tech.req("/api/push/subscribe", { method: "POST", json: phone.sub });
  await owner.req("/api/push/subscribe", { method: "POST", json: ownerPhone.sub });
  R.check("PU4", "Thợ đăng ký thiết bị thành công", s1.status === 200, JSON.stringify(s1.data));

  // Thích bài
  const posts = (await owner.req(`/api/posts?authorId=${tech.userId}`)).data.posts || [];
  if (posts[0]) {
    if (posts[0].likedByMe) await owner.req(`/api/posts/${posts[0].id}/like`, { method: "POST" });
    await owner.req(`/api/posts/${posts[0].id}/like`, { method: "POST" });
    const got = await waitPush(phone, (p) => /đã thích bài viết/.test(p.body));
    R.check("PU5", "Có người thích bài → thông báo đẩy (giải mã đúng nội dung + link)", got && got.p.url === "/?tab=feed" && got.p.title === "PawNail", JSON.stringify(got?.p));
    R.check("PU6", "Gói tin chuẩn Web Push: mã hoá aes128gcm + chữ ký VAPID + TTL", got && got.headers["content-encoding"] === "aes128gcm" && /^vapid t=/.test(got.headers.authorization || "") && Number(got.headers.ttl) > 0, JSON.stringify(got?.headers));
  } else {
    R.check("PU5", "Thích bài → push", false, "thợ seed không có bài");
    R.check("PU6", "Chuẩn Web Push", false, "bỏ qua");
  }

  // Tin nhắn
  const text = `QA push tin nhắn ${Date.now()}`;
  inbox.length = 0;
  await owner.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: text } });
  const msg = await waitPush(phone, (p) => p.body === text);
  R.check("PU7", "Tin nhắn mới → push: tiêu đề = tên người gửi, mở đúng hội thoại", msg && msg.p.url === `/messages?to=${owner.userId}` && /^pn-chat-/.test(msg.p.tag), JSON.stringify(msg?.p));
  await new Promise((r) => setTimeout(r, 800));
  R.check("PU8", "Người gửi KHÔNG nhận push tin của chính mình", !inbox.some((m) => m.device === ownerPhone.name), inbox.map((m) => m.device).join());

  // Cuộc gọi
  await owner.req("/api/calls", { method: "POST", json: { targetId: tech.userId, action: "offer", callType: "video", callId: "qapush1" } });
  const call = await waitPush(phone, (p) => p.tag === "pn-call");
  R.check("PU9", "Cuộc gọi đến → push '📹 Cuộc gọi video đến'", call && /Cuộc gọi video/.test(call.p.title), JSON.stringify(call?.p));
  await owner.req("/api/calls", { method: "POST", json: { targetId: tech.userId, action: "reject" } });

  // Việc gấp cùng bang
  const me = (await tech.req("/api/profile")).data;
  const title = `QA push việc gấp ${Date.now() % 1e5}`;
  await owner.req("/api/jobs", { method: "POST", json: { title, salonName: "QA Push Nails", description: "", market: me.market, state: me.state, city: me.city || "LA", salaryType: "Bao lương tuần", salaryAmount: "$1,500/tuần", skills: [], benefits: [], phone: "4085550122", isUrgent: true } });
  const job = await waitPush(phone, (p) => p.body.includes(title));
  R.check("PU10", "Việc gấp cùng bang → push '🔥 Việc gấp gần bạn' mở đúng tin", job && /Việc gấp/.test(job.p.title) && /^\/jobs\//.test(job.p.url), JSON.stringify(job?.p));

  // Thiết bị đã huỷ (410) → tự dọn khỏi DB
  const old = makeDevice(`gone-${Date.now()}`);
  await tech.req("/api/push/subscribe", { method: "POST", json: old.sub });
  goneDevices.add(old.name);
  await owner.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: `QA 410 ${Date.now()}` } });
  await new Promise((r) => setTimeout(r, 2500));
  const db = createClient({ url: "file:prisma/dev.db" });
  const left = await db.execute({ sql: `SELECT COUNT(*) AS n FROM "PushSubscription" WHERE endpoint = ?`, args: [old.sub.endpoint] });
  R.check("PU11", "Thiết bị trả 410 (đã huỷ) → tự xoá khỏi DB", Number(left.rows[0].n) === 0, JSON.stringify(left.rows));

  // Huỷ đăng ký → không nhận nữa; người khác không xoá hộ được
  const steal = await owner.req("/api/push/subscribe", { method: "DELETE", json: { endpoint: phone.sub.endpoint } });
  const still = await db.execute({ sql: `SELECT COUNT(*) AS n FROM "PushSubscription" WHERE endpoint = ?`, args: [phone.sub.endpoint] });
  R.check("PU12", "Không thể huỷ thiết bị của người khác", steal.status === 200 && Number(still.rows[0].n) === 1);
  await tech.req("/api/push/subscribe", { method: "DELETE", json: { endpoint: phone.sub.endpoint } });
  inbox.length = 0;
  await owner.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: `QA sau khi huỷ ${Date.now()}` } });
  await new Promise((r) => setTimeout(r, 2000));
  R.check("PU13", "Đã tắt thông báo → không nhận push nữa", !inbox.some((m) => m.device === phone.name));
  await owner.req("/api/push/subscribe", { method: "DELETE", json: { endpoint: ownerPhone.sub.endpoint } });

  // Service worker đã chứa bộ xử lý push
  const sw = await new Client().req("/sw.js");
  const workerFile = String(sw.data).match(/importScripts\([^)]*?"(worker-[^"]+\.js)"/)?.[1] || String(sw.data).match(/worker-[A-Za-z0-9_-]+\.js/)?.[0];
  const worker = workerFile ? await new Client().req("/" + workerFile) : { status: 0, data: "" };
  R.check("PU14", "Service worker nạp bộ xử lý push + bấm mở đúng trang", sw.status === 200 && worker.status === 200 && /showNotification/.test(worker.data) && /notificationclick/.test(worker.data), `sw ${sw.status} worker ${workerFile} ${worker.status}`);

  // UI: công tắc trong cài đặt + lời mời bật (tua nhanh 25 giây bằng đồng hồ giả)
  const browser = await chromium.launch();
  // Như người dùng thật chưa từng chọn: quyền "default" (trình duyệt test mặc định là "denied").
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "vi-VN", permissions: ["notifications"] });
  await ctx.addInitScript(() => {
    try { Object.defineProperty(Notification, "permission", { get: () => "default" }); } catch {}
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE_URL + "/auth/login");
  await p.locator("#email").fill(SEED_TECH);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  await p.evaluate(() => { localStorage.removeItem("pn_push_dismissed_at"); sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 })); });
  await p.goto(BASE_URL + "/?tab=feed");
  await p.waitForTimeout(28_000); // lời mời hiện sau ~25 giây dùng app
  const prompt = p.getByRole("dialog", { name: "Bật thông báo" });
  const shown = await prompt.waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
  R.check("PU15", "Sau ~25 giây dùng app → lời mời 'Bật thông báo' (không bật hộp xin quyền ngay)", shown);
  await p.screenshot({ path: (process.env.TEMP || ".") + "/push_prompt.png" });
  if (shown) {
    // Nút ✕ phải bấm được (trước đây bị phần chữ đè lên).
    await prompt.getByRole("button", { name: "Đóng" }).click({ timeout: 5000 });
    R.check("PU15b", "Nút ✕ trên lời mời bấm được và đóng lời mời", (await prompt.count()) === 0);
    await p.reload();
    await p.waitForTimeout(28_000);
    R.check("PU16", "'Để sau' → không hỏi lại trong 7 ngày", (await prompt.count()) === 0);
  } else R.check("PU16", "Để sau", false, "lời mời không hiện");
  await p.goto(BASE_URL + "/profile");
  const row = await p.getByRole("switch", { name: "Thông báo đẩy" }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  R.check("PU17", "Hồ sơ → 'Âm thanh & rung' có công tắc 'Thông báo đẩy'", row);
  R.check("PU18", "Không có lỗi JS", errs.length === 0, errs.join(" | "));
  await browser.close();
} finally {
  server.close();
}
const s = R.summary();
process.exit(s.failed ? 1 : 0);
