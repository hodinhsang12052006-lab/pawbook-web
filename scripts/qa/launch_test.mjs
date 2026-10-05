// Kiểm thử đợt "chốt": chủ tiệm không bị chặn (bỏ mở khoá/khảo sát), hướng dẫn
// người mới, xác minh SĐT qua SMS, đăng nhập Google/Apple (OAuth), thông báo
// đẩy cho app native (Android FCM + iPhone APNs).
// Server phải chạy bằng:  bash scripts/qa/start-launch-server.sh   (máy chủ giả)
//   node scripts/qa/launch_test.mjs
import http from "node:http";
import http2 from "node:http2";
import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@libsql/client";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, DEMO_PASSWORD, Results, SEED_OWNER, SEED_TECH, registerUser, fakeIp } from "./lib.mjs";

const R = new Results("Chốt: chủ tiệm, người mới, SMS, Google/Apple, push app");
const TMP = process.env.TEMP || ".";
const KEYS = TMP + "/qa-keys";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = createClient({ url: "file:prisma/dev.db" });
await db.execute("PRAGMA busy_timeout = 10000");
const listen = (srv, port) => new Promise((r) => srv.listen(port, "127.0.0.1", r));
const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });

// ---------- Twilio Verify giả (:4997) ----------
const twilio = [];
const twilioSrv = http.createServer(async (req, res) => {
  const form = Object.fromEntries(new URLSearchParams(await readBody(req)));
  twilio.push({ path: req.url, auth: req.headers.authorization, form });
  res.setHeader("content-type", "application/json");
  if (req.url.endsWith("/Verifications")) return res.writeHead(201).end(JSON.stringify({ status: "pending", to: form.To }));
  if (req.url.endsWith("/VerificationCheck")) return res.writeHead(200).end(JSON.stringify({ status: form.Code === "123456" ? "approved" : "pending" }));
  res.writeHead(404).end("{}");
});
await listen(twilioSrv, 4997);

// ---------- OAuth giả (:4996) ----------
let nextIdentity = null;
const codes = new Map();
const oauthSrv = http.createServer(async (req, res) => {
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
await listen(oauthSrv, 4996);

// ---------- FCM giả (:4995) ----------
const fcm = { tokens: [], sends: [] };
const fcmPub = crypto.createPublicKey(fs.readFileSync(KEYS + "/fcm.pem"));
const fcmSrv = http.createServer(async (req, res) => {
  const body = await readBody(req);
  res.setHeader("content-type", "application/json");
  if (req.url === "/token") {
    const assertion = new URLSearchParams(body).get("assertion") || "";
    const [h, p, s] = assertion.split(".");
    const ok = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), fcmPub, Buffer.from(s || "", "base64url"));
    fcm.tokens.push({ ok, claims: JSON.parse(Buffer.from(p || "e30", "base64url").toString()) });
    return res.writeHead(ok ? 200 : 401).end(JSON.stringify(ok ? { access_token: "ya29.test", expires_in: 3600 } : { error: "invalid_grant" }));
  }
  if (req.url.startsWith("/v1/projects/pawnail-test/messages:send")) {
    const m = JSON.parse(body).message;
    fcm.sends.push({ auth: req.headers.authorization, m });
    if (m.token.startsWith("dead")) return res.writeHead(404).end(JSON.stringify({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }));
    return res.writeHead(200).end(JSON.stringify({ name: "projects/pawnail-test/messages/1" }));
  }
  res.writeHead(404).end("{}");
});
await listen(fcmSrv, 4995);

// ---------- APNs giả (:4994, HTTP/2 + TLS) ----------
const apns = [];
const apnsPub = crypto.createPublicKey(fs.readFileSync(KEYS + "/apns.pub"));
const apnsSrv = http2.createSecureServer({ key: fs.readFileSync(TMP + "/pushtest-key.pem"), cert: fs.readFileSync(TMP + "/pushtest-cert.pem") });
apnsSrv.on("stream", (stream, headers) => {
  let body = "";
  stream.on("data", (c) => (body += c));
  stream.on("end", () => {
    const jwt = String(headers.authorization || "").replace(/^bearer /, "");
    const [h, p, s] = jwt.split(".");
    const sigOk = !!s && crypto.verify("sha256", Buffer.from(`${h}.${p}`), { key: apnsPub, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    const token = String(headers[":path"]).split("/").pop();
    apns.push({ path: headers[":path"], topic: headers["apns-topic"], type: headers["apns-push-type"], sigOk, body: JSON.parse(body || "{}") });
    stream.respond({ ":status": token.startsWith("dead") ? 410 : 200 });
    stream.end(token.startsWith("dead") ? JSON.stringify({ reason: "Unregistered" }) : "");
  });
});
await listen(apnsSrv, 4994);

const errors = [];
let browser;
try {
  browser = await chromium.launch();
  const page = async (locale = "vi-VN") => {
    const ctx = await browser.newContext({ ...devices["Pixel 7"], locale });
    const ip = fakeIp();
    await ctx.route(BASE_URL + "/**", (route) => route.continue({ headers: { ...route.request().headers(), "cf-connecting-ip": ip } }));
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    p.on("response", (r) => { if (r.status() >= 500 && r.url().startsWith(BASE_URL)) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
    return p;
  };
  const uiLogin = async (p, email, password = DEMO_PASSWORD) => {
    await p.goto(BASE_URL + "/auth/login");
    await p.locator("#email").fill(email);
    await p.locator("#password").fill(password);
    await p.getByRole("button", { name: /^Đăng nhập$/ }).click();
    await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
    await p.evaluate(() => { sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 })); localStorage.setItem("pn_push_dismissed_at", String(Date.now())); });
  };

  // ================= 1. CHỦ TIỆM KHÔNG BỊ CHẶN =================
  {
    const p = await page();
    const stamp = Date.now();
    await p.goto(BASE_URL + "/auth/register?role=owner");
    await p.getByPlaceholder("Nguyễn Văn A").fill("QA Chủ Bỏ Qua");
    await p.getByPlaceholder("VD: Happy Nails & Spa").fill("QA Skip Nails");
    await p.getByPlaceholder("VD: Los Angeles").fill("Dallas");
    const autoState = await p.getByLabel("Bang").first().inputValue();
    await p.getByPlaceholder("555 123 4567").fill("2145550111");
    await p.getByPlaceholder("ban@email.com").fill(`qa.skip.${stamp}@qa.test`);
    await p.locator('input[type="password"]').fill("QaPass#2026");
    await p.getByRole("button", { name: /Tiếp tục khảo sát nhanh/ }).click();
    const skip = p.getByRole("button", { name: /Bỏ qua khảo sát/ });
    const skipShown = await skip.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    R.check("OW1", "Đăng ký chủ tiệm: gõ Dallas → bang tự chọn Texas; khảo sát có nút 'Bỏ qua'", autoState === "TX" && skipShown, autoState);
    await skip.click();
    const inApp = await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 }).then(() => true).catch(() => false);
    R.check("OW2", "Bỏ qua khảo sát → vào thẳng app (không màn chẩn đoán)", inApp && !(await p.getByText(/Tóm tắt khảo sát|Chẩn Đoán/).count()), p.url());

    // Khảo sát đầy đủ → màn tóm tắt nói thật "sắp ra mắt"
    const q = await page();
    await q.goto(BASE_URL + "/auth/register?role=owner");
    await q.getByPlaceholder("Nguyễn Văn A").fill("QA Chủ Khảo Sát");
    await q.getByPlaceholder("VD: Happy Nails & Spa").fill("QA Survey Nails");
    await q.getByPlaceholder("VD: Los Angeles").fill("Houston");
    await q.getByPlaceholder("555 123 4567").fill("7135550111");
    await q.getByPlaceholder("ban@email.com").fill(`qa.survey.${stamp}@qa.test`);
    await q.locator('input[type="password"]').fill("QaPass#2026");
    await q.getByRole("button", { name: /Tiếp tục khảo sát nhanh/ }).click();
    for (let i = 0; i < 5; i++) {
      await q.locator("button.w-full.text-left").first().click();
      await q.waitForTimeout(700);
    }
    await q.getByText("Tóm tắt khảo sát vận hành").waitFor({ timeout: 20000 });
    const txt = await q.evaluate(() => document.body.innerText);
    R.check("OW3", "Màn tóm tắt: 'sắp ra mắt', không còn 'Kích hoạt' / 'set up trong 24h' / 'Live'", /sắp ra mắt/i.test(txt) && !/Kích hoạt|24h|\bLive\b|điểm nghẽn/.test(txt), txt.match(/Kích hoạt|24h|Live|điểm nghẽn/)?.[0]);
    await q.getByRole("button", { name: "Báo tôi" }).first().click();
    R.check("OW4", "Bấm 'Báo tôi' → ghi nhận, hứa đúng ('báo khi ra mắt')", await q.getByText(/báo khi tính năng này ra mắt/).first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
    await q.screenshot({ path: TMP + "/launch_owner_summary.png" });

    // Chủ tiệm mở hồ sơ thợ → "Nhắn tin" ngay, không paywall
    const techId = (await db.execute({ sql: `SELECT id FROM "User" WHERE email = ?`, args: [SEED_TECH] })).rows[0].id;
    await p.goto(BASE_URL + `/profile/${techId}`);
    const msgBtn = p.getByRole("button", { name: /^Nhắn tin$/ }).first();
    await msgBtn.waitFor({ timeout: 15000 });
    const body = await p.evaluate(() => document.body.innerText);
    R.check("OW5", "Hồ sơ thợ: nút 'Nhắn tin' (không còn 'Mở khóa liên hệ', không giá $4.99)", !/Mở khóa|\$4\.99/.test(body));
    await msgBtn.click();
    const toChat = await p.waitForURL(/\/messages\?to=/, { timeout: 15000 }).then(() => true).catch(() => false);
    await sleep(800);
    const unlocked = await p.evaluate((id) => fetch(`/api/unlock?technicianUserId=${id}`).then((r) => r.json()), techId);
    R.check("OW6", "Bấm Nhắn tin → vào khung chat ngay; bản ghi 'đã kết nối' vẫn được lưu (cho đánh giá)", toChat && unlocked.unlocked === true, JSON.stringify(unlocked));
  }

  // ================= 2. HƯỚNG DẪN NGƯỜI MỚI =================
  {
    const t = await registerUser({ name: "QA Thợ Mới Onb", state: "TX", city: "Houston" });
    await t.client.login(t.body.email, t.body.password);
    const s0 = (await t.client.req("/api/onboarding")).data;
    R.check("ON1", "Người mới: 3 bước, chưa xong bước nào", s0.newUser === true && s0.steps.length === 3 && s0.steps.every((s) => !s.done), JSON.stringify(s0));
    const p = await page();
    await uiLogin(p, t.body.email, t.body.password);
    await p.goto(BASE_URL + "/?tab=feed");
    const card = p.getByRole("region", { name: "Bắt đầu với PawNail" });
    const cardOk = await card.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    R.check("ON2", "Bảng tin: thẻ 'Bắt đầu với PawNail' 0/3 với 3 việc", cardOk && /0\/3/.test(await card.innerText()) && (await card.getByRole("link").count()) === 3);
    await p.screenshot({ path: TMP + "/launch_onboarding.png" });
    await p.goto(BASE_URL + "/?tab=jobs");
    const compact = await p.getByRole("link", { name: "Bắt đầu với PawNail" }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    R.check("ON3", "Tab Việc gấp: bản rút gọn 1 dòng 'Bước tiếp theo'", compact && /Bước tiếp theo/.test(await p.getByRole("link", { name: "Bắt đầu với PawNail" }).innerText()));
    await t.client.req("/api/job-alerts", { method: "POST", json: { market: "US", state: "TX" } });
    const ownerId = (await db.execute({ sql: `SELECT id FROM "User" WHERE email = ?`, args: [SEED_OWNER] })).rows[0].id;
    await t.client.req("/api/messages", { method: "POST", json: { receiverId: ownerId, content: "QA onboarding chào tiệm" } });
    const s1 = (await t.client.req("/api/onboarding")).data;
    R.check("ON4", "Bật báo việc + nhắn tiệm → tự tích 2/3 (đọc từ dữ liệu thật)", s1.steps.filter((s) => s.done).length === 2 && !s1.steps.find((s) => s.key === "portfolio").done, JSON.stringify(s1.steps));
  }

  // ================= 3. XÁC MINH SĐT QUA SMS =================
  {
    const t = await registerUser({ name: "QA SMS", phone: "+1 408 555 0177" });
    await t.client.login(t.body.email, t.body.password);
    const g = (await t.client.req("/api/phone/verify")).data;
    R.check("SM1", "SMS bật, SĐT chuẩn hoá E.164, chưa xác minh", g.enabled === true && g.phone === "+14085550177" && g.verified === false, JSON.stringify(g));
    R.check("SM2", "Chưa đăng nhập → 401", (await new Client().req("/api/phone/verify", { method: "POST", json: { action: "send" } })).status === 401);
    twilio.length = 0;
    const send = await t.client.req("/api/phone/verify", { method: "POST", json: { action: "send" } });
    const call = twilio[0];
    R.check("SM3", "Gửi mã: Twilio nhận đúng số + kênh SMS + xác thực Basic; số bị che khi trả về", send.status === 200 && call?.form.To === "+14085550177" && call.form.Channel === "sms" && /^Basic /.test(call.auth) && /0177$/.test(send.data.to) && /•/.test(send.data.to), JSON.stringify({ s: send.data, call }));
    const wrong = await t.client.req("/api/phone/verify", { method: "POST", json: { action: "check", code: "000000" } });
    const right = await t.client.req("/api/phone/verify", { method: "POST", json: { action: "check", code: "123456" } });
    R.check("SM4", "Sai mã → 400; đúng mã → đã xác minh", wrong.status === 400 && right.status === 200 && right.data.verified === true, `${wrong.status} ${right.status}`);
    const pub = (await new Client().req(`/api/profile?id=${t.client.userId}&badges=1`)).data;
    R.check("SM5", "Hồ sơ công khai có dấu 'SĐT đã xác minh' nhưng KHÔNG lộ số", pub.phoneVerified === true && !JSON.stringify(pub).includes("4085550177"), JSON.stringify({ v: pub.phoneVerified, phone: pub.phone }));
    await t.client.req("/api/profile", { method: "PUT", json: { name: "QA SMS", phone: "+1 408 555 0188", state: "CA", city: "San Jose" } });
    const g2 = (await t.client.req("/api/phone/verify")).data;
    R.check("SM6", "Đổi số điện thoại → mất dấu xác minh (phải xác minh lại)", g2.verified === false && g2.phone === "+14085550188", JSON.stringify(g2));
    const spam = [];
    for (let i = 0; i < 3; i++) spam.push((await t.client.req("/api/phone/verify", { method: "POST", json: { action: "send" } })).status);
    R.check("SM7", "Chống spam SMS: quá 3 lần/giờ → 429", spam.includes(429), spam.join());

    // UI
    const u = await registerUser({ name: "QA SMS UI", phone: "+1 713 555 0166", state: "TX", city: "Houston" });
    const p = await page();
    await uiLogin(p, u.body.email, u.body.password);
    await p.goto(BASE_URL + "/profile");
    await p.getByRole("button", { name: /Xác minh SĐT qua SMS/ }).click();
    const dlg = p.getByRole("dialog", { name: "Nhập mã xác minh" });
    await dlg.waitFor({ timeout: 10000 });
    await dlg.getByLabel("Mã xác minh").fill("123456");
    await dlg.getByRole("button", { name: /^Xác minh$/ }).click();
    const ok = await p.getByText("Số điện thoại đã xác minh").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    R.check("SM8", "Trang Tài khoản: bấm xác minh → nhập mã → hiện 'Số điện thoại đã xác minh'", ok);
    await p.screenshot({ path: TMP + "/launch_sms.png" });
  }

  // ================= 4. ĐĂNG NHẬP GOOGLE/APPLE (OAuth) =================
  {
    const prov = (await new Client().req("/api/auth/providers")).data;
    R.check("OA1", "Máy chủ chỉ bật provider có khoá (local: test-oauth; không Google/Apple khi thiếu khoá)", prov["test-oauth"] && !prov.google && !prov.apple, Object.keys(prov).join());
    const email = `qa.oauth.${Date.now()}@gmail.test`;
    nextIdentity = { sub: "g-" + Date.now(), email, name: "QA Google User", email_verified: true };
    const p = await page();
    await p.goto(BASE_URL + "/auth/login");
    await p.getByRole("button", { name: /Tiếp tục với Test OAuth/ }).click();
    const toComplete = await p.waitForURL(/\/auth\/complete/, { timeout: 30000 }).then(() => true).catch(() => false);
    R.check("OA2", "Đăng nhập OAuth lần đầu → trang 'Hoàn tất' (chọn vai trò, khu vực)", toComplete, p.url());
    await p.getByText("Chào mừng bạn!").waitFor({ timeout: 15000 });
    await p.screenshot({ path: TMP + "/launch_oauth_complete.png" });
    await p.goto(BASE_URL + "/?tab=jobs");
    const forced = await p.waitForURL(/\/auth\/complete/, { timeout: 15000 }).then(() => true).catch(() => false);
    R.check("OA3", "Chưa hoàn tất mà vào trang khác → bị đưa lại trang Hoàn tất", forced);
    await p.getByText("Chào mừng bạn!").waitFor({ timeout: 15000 });
    await p.getByRole("radio", { name: /Tôi là Chủ Tiệm/ }).click();
    await p.getByLabel(/Thành phố/).fill("Dallas");
    const st = await p.getByLabel("Bang").inputValue();
    await p.getByLabel(/Số điện thoại/).fill("2145550155");
    await p.getByRole("button", { name: /Vào PawNail/ }).click();
    const toCreate = await p.waitForURL(/\/jobs\/create/, { timeout: 30000 }).then(() => true).catch(() => false);
    const sess = await p.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
    R.check("OA4", "Chọn Chủ tiệm + Dallas (tự TX) → vào trang đăng tin, phiên là OWNER", st === "TX" && toCreate && sess.user?.role === "OWNER" && !sess.user?.needsOnboarding, JSON.stringify({ st, role: sess.user?.role, onb: sess.user?.needsOnboarding }));
    const again = await p.evaluate(() => fetch("/api/profile/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "TECHNICIAN", market: "US", state: "CA", city: "LA", phone: "2135550100" }) }).then((r) => r.status));
    R.check("OA5", "Không dùng lại được API hoàn tất để đổi vai trò (409)", again === 409, again);
    const row = (await db.execute({ sql: `SELECT role, state, city, password FROM "User" WHERE email = ?`, args: [email] })).rows[0];
    R.check("OA6", "Tài khoản OAuth: lưu đúng vai trò/khu vực; KHÔNG đăng nhập được bằng mật khẩu", row.role === "OWNER" && row.state === "TX" && String(row.password).startsWith("oauth:"), JSON.stringify({ role: row.role, state: row.state }));
    const pw = await new Client().login(email, "oauth:anything");
    R.check("OA7", "Thử đăng nhập email+mật khẩu vào tài khoản OAuth → thất bại", !pw.ok);

    // Liên kết tài khoản cũ cùng email
    nextIdentity = { sub: "g-seed", email: SEED_TECH, name: "Seed Tech", email_verified: true };
    const p2 = await page();
    await p2.goto(BASE_URL + "/auth/login");
    await p2.getByRole("button", { name: /Tiếp tục với Test OAuth/ }).click();
    // Đi hết vòng OAuth: /api/auth/... → /auth/complete → (đã đủ hồ sơ) → trang chủ.
    await p2.waitForURL((u) => u.pathname === "/", { timeout: 30000 }).catch(() => {});
    const s2 = await p2.evaluate(() => fetch("/api/auth/session").then((r) => r.json()));
    const seedId = (await db.execute({ sql: `SELECT id FROM "User" WHERE email = ?`, args: [SEED_TECH] })).rows[0].id;
    R.check("OA8", "Google cùng email với tài khoản cũ (đã xác minh) → vào ĐÚNG tài khoản cũ, không bắt hoàn tất", s2.user?.id === seedId && !s2.user?.needsOnboarding && !p2.url().includes("/auth/complete"), JSON.stringify({ id: s2.user?.id, url: p2.url() }));

    // Email chưa xác minh → từ chối
    nextIdentity = { sub: "g-unv", email: `qa.unverified.${Date.now()}@gmail.test`, name: "Unverified", email_verified: false };
    const p3 = await page();
    await p3.goto(BASE_URL + "/auth/login");
    await p3.getByRole("button", { name: /Tiếp tục với Test OAuth/ }).click();
    await p3.waitForURL(/error=/, { timeout: 30000 }).catch(() => {});
    const errShown = await p3.getByText(/chưa xác minh email/).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    const made = (await db.execute({ sql: `SELECT COUNT(*) n FROM "User" WHERE email = ?`, args: [nextIdentity.email] })).rows[0].n;
    R.check("OA9", "Email chưa xác minh → báo lỗi dễ hiểu, KHÔNG tạo tài khoản", errShown && Number(made) === 0, `${errShown} ${made}`);
    await p3.screenshot({ path: TMP + "/launch_oauth_error.png" });
    const reg = await page();
    await reg.goto(BASE_URL + "/auth/register");
    R.check("OA10", "Trang đăng ký có 'Hoặc đăng ký nhanh bằng' + nút OAuth", await reg.getByText(/Hoặc đăng ký nhanh bằng/i).waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
    await reg.screenshot({ path: TMP + "/launch_register_social.png" });
  }

  // ================= 5. THÔNG BÁO ĐẨY APP NATIVE =================
  {
    // (Máy chủ giả chỉ cấp "ya29.test" khi JWT RS256 ký đúng khoá service account;
    // máy chủ app nhớ access token 1 giờ nên lần chạy lại có thể không xin token mới.)
    const cfg = (await new Client().req("/api/push/subscribe")).data;
    R.check("NP1", "Máy chủ báo bật push app: Android (FCM) + iPhone (APNs)", cfg.nativeEnabled === true && cfg.iosEnabled === true, JSON.stringify(cfg));
    const t = await registerUser({ name: "QA Native Push" });
    await t.client.login(t.body.email, t.body.password);
    const android = "fcm" + crypto.randomBytes(24).toString("hex") + ":APA91b" + crypto.randomBytes(20).toString("hex");
    const ios = crypto.randomBytes(32).toString("hex");
    const deadA = "dead" + crypto.randomBytes(30).toString("hex");
    const deadI = "dead" + crypto.randomBytes(30).toString("hex");
    const regs = await Promise.all([
      t.client.req("/api/push/native", { method: "POST", json: { token: android, platform: "android" } }),
      t.client.req("/api/push/native", { method: "POST", json: { token: ios, platform: "ios" } }),
      t.client.req("/api/push/native", { method: "POST", json: { token: deadA, platform: "android" } }),
      t.client.req("/api/push/native", { method: "POST", json: { token: deadI, platform: "ios" } }),
      new Client().req("/api/push/native", { method: "POST", json: { token: android, platform: "android" } }),
      t.client.req("/api/push/native", { method: "POST", json: { token: "<x>", platform: "android" } }),
    ]);
    R.check("NP2", "Đăng ký token app: OK; khách 401; token rác 400", regs.slice(0, 4).every((r) => r.status === 200) && regs[4].status === 401 && regs[5].status === 400, regs.map((r) => r.status).join());
    const owner = new Client();
    await owner.login(SEED_OWNER);
    const text = `QA push app ${Date.now()}`;
    fcm.sends.length = 0;
    apns.length = 0;
    await owner.req("/api/messages", { method: "POST", json: { receiverId: t.client.userId, content: text } });
    await sleep(3500);
    const a = fcm.sends.find((s) => s.m.token === android);
    R.check("NP3", "Android: FCM nhận đúng token + tiêu đề/nội dung + link mở khung chat; access token ký RS256 hợp lệ", a && a.m.notification.body === text && a.m.data.url.startsWith("/messages") && a.auth === "Bearer ya29.test" && fcm.tokens.every((x) => x.ok && x.claims.scope.includes("firebase.messaging")), JSON.stringify(a?.m).slice(0, 200));
    const i = apns.find((x) => x.path === `/3/device/${ios}`);
    R.check("NP4", "iPhone: APNs nhận đúng token, topic com.bitpawos.app, JWT ES256 hợp lệ, có link", i && i.topic === "com.bitpawos.app" && i.type === "alert" && i.sigOk && i.body.aps.alert.body === text && i.body.url.startsWith("/messages"), JSON.stringify(i).slice(0, 220));
    await sleep(500);
    const left = (await db.execute({ sql: `SELECT endpoint FROM "PushSubscription" WHERE userId = ?`, args: [t.client.userId] })).rows.map((r) => String(r.endpoint));
    R.check("NP5", "Token chết (app đã gỡ) tự được dọn khỏi DB, token sống giữ lại", left.length === 2 && left.includes("fcm:" + android) && left.includes("apns:" + ios), left.join(" | ").slice(0, 160));
    await t.client.req("/api/push/native", { method: "DELETE", json: { token: android } });
    const after = (await db.execute({ sql: `SELECT COUNT(*) n FROM "PushSubscription" WHERE userId = ?`, args: [t.client.userId] })).rows[0].n;
    R.check("NP6", "Tắt thông báo trên máy → xoá token", Number(after) === 1, after);
  }

  R.check("Z1", "Không lỗi JS / 5xx trong suốt các luồng", errors.length === 0, errors.slice(0, 4).join(" | "));
} finally {
  await browser?.close();
  for (const s of [twilioSrv, oauthSrv, fcmSrv, apnsSrv]) s.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
