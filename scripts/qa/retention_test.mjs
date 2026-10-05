// Kiểm thử 4 tính năng giữ chân: (1) Ai đã xem hồ sơ bạn, (2) Báo việc theo
// tiêu chí, (6) Hình nền khung chat, (9) Thẻ portfolio chia sẻ.
// CHỈ chạy với server local (dev.db). Server phải bật push test như push_test:
//   NODE_TLS_REJECT_UNAUTHORIZED=0 PUSH_ALLOW_TEST_ENDPOINT=1 + khoá VAPID.
//   node scripts/qa/retention_test.mjs
import https from "node:https";
import fs from "node:fs";
import crypto from "node:crypto";
import ece from "http_ece";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, DEMO_PASSWORD, Results, SEED_OWNER, SEED_OWNER_2, SEED_TECH, registerUser } from "./lib.mjs";

const R = new Results("Giữ chân: ai xem hồ sơ, báo việc, hình nền chat, thẻ chia sẻ");
const OUT = process.env.TEMP || ".";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Máy chủ push giả (như push_test) ----
const PORT = 4998;
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const inbox = [];
const server = https.createServer({ key: fs.readFileSync(OUT + "/pushtest-key.pem"), cert: fs.readFileSync(OUT + "/pushtest-cert.pem") }, (req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    inbox.push({ device: req.url.split("/").pop(), body: Buffer.concat(chunks) });
    res.writeHead(201).end();
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
function makeDevice(name) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { name, ecdh, auth, sub: { endpoint: `https://127.0.0.1:${PORT}/push/${name}`, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } } };
}
const pushesFor = (dev) =>
  inbox
    .filter((m) => m.device === dev.name)
    .map((m) => {
      try {
        return JSON.parse(ece.decrypt(m.body, { version: "aes128gcm", privateKey: dev.ecdh, authSecret: b64u(dev.auth) }).toString("utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
async function waitPush(dev, pred, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const hit = pushesFor(dev).find(pred);
    if (hit) return hit;
    await sleep(200);
  }
  return null;
}

const errors = [];
let browser;
try {
  // ================= (1) AI ĐÃ XEM HỒ SƠ =================
  const anon = new Client();
  R.check("PV1", "Xem/ghi lượt xem bắt buộc đăng nhập", (await anon.req("/api/profile/views")).status === 401 && (await anon.req("/api/profile/views", { method: "POST", json: { profileId: "x" } })).status === 401);

  const t = await registerUser({ name: "QA Thợ Được Xem", state: "TX", city: "Houston", specialties: ["Gel-X"] });
  await t.client.login(t.body.email, t.body.password);
  const tech = t.client;
  const phone = makeDevice(`ret-tech-${Date.now()}`);
  R.check("PV0", "Thợ đăng ký thiết bị nhận thông báo", (await tech.req("/api/push/subscribe", { method: "POST", json: phone.sub })).status === 200);
  R.check("PV2", "profileId rác → 400", (await tech.req("/api/profile/views", { method: "POST", json: { profileId: "<script>" } })).status === 400);

  const owner = new Client();
  await owner.login(SEED_OWNER);
  const owner2 = new Client();
  await owner2.login(SEED_OWNER_2);
  const tech2 = new Client();
  await tech2.login(SEED_TECH);

  await owner.req("/api/profile/views", { method: "POST", json: { profileId: tech.userId } });
  await sleep(1500);
  let st = (await tech.req("/api/profile/views")).data;
  R.check("PV3", "Tiệm xem hồ sơ → thợ thấy 1 người xem, 1 tiệm, đúng tên tiệm", st.viewers === 1 && st.salons === 1 && st.recentSalons[0]?.id === owner.userId, JSON.stringify(st).slice(0, 200));
  const pv = await waitPush(phone, (p) => /xem hồ sơ bạn/.test(p.title));
  R.check("PV4", "Thợ nhận thông báo đẩy 'Có tiệm vừa xem hồ sơ bạn' (mở đúng mục)", pv && pv.url === "/profile#ai-da-xem", JSON.stringify(pv));

  await owner.req("/api/profile/views", { method: "POST", json: { profileId: tech.userId } });
  await owner2.req("/api/profile/views", { method: "POST", json: { profileId: tech.userId } });
  await tech2.req("/api/profile/views", { method: "POST", json: { profileId: tech.userId } });
  await tech.req("/api/profile/views", { method: "POST", json: { profileId: tech.userId } }); // tự xem
  await sleep(2000);
  st = (await tech.req("/api/profile/views")).data;
  R.check("PV5", "Cùng tiệm xem lại trong ngày không cộng thêm; tự xem không tính", st.week === 3 && st.viewers === 3, JSON.stringify(st).slice(0, 120));
  R.check("PV6", "Thợ khác xem → chỉ được ĐẾM, không lộ danh tính", st.salons === 2 && !st.recentSalons.some((s) => s.id === tech2.userId), JSON.stringify(st.recentSalons.map((s) => s.id)));
  R.check("PV7", "Tối đa 1 thông báo 'tiệm xem hồ sơ'/ngày (không spam)", pushesFor(phone).filter((p) => /xem hồ sơ bạn/.test(p.title)).length === 1, pushesFor(phone).length);
  R.check("PV8", "Không lộ email/SĐT người xem", !/"(email|phone|password)"/.test(JSON.stringify(st)));

  // ================= (2) BÁO VIỆC THEO TIÊU CHÍ =================
  R.check("JA1", "Thông báo việc bắt buộc đăng nhập", (await anon.req("/api/job-alerts")).status === 401);
  const bad = await Promise.all([
    tech.req("/api/job-alerts", { method: "POST", json: { market: "XX" } }),
    tech.req("/api/job-alerts", { method: "POST", json: { market: "US", state: "ZZ" } }),
    tech.req("/api/job-alerts", { method: "POST", json: { market: "US", skill: "<img>" } }),
  ]);
  R.check("JA2", "Tiêu chí rác (thị trường/bang/kỹ năng lạ) → 400", bad.every((r) => r.status === 400), bad.map((r) => r.status).join());
  const a1 = await tech.req("/api/job-alerts", { method: "POST", json: { market: "US", state: "TX", skill: "Gel-X" } });
  const dup = await tech.req("/api/job-alerts", { method: "POST", json: { market: "US", state: "TX", skill: "Gel-X" } });
  await tech.req("/api/job-alerts", { method: "POST", json: { market: "US", state: "CA" } });
  await tech.req("/api/job-alerts", { method: "POST", json: { market: "US", skill: "Wax" } });
  const over = await tech.req("/api/job-alerts", { method: "POST", json: { market: "AU" } });
  R.check("JA3", "Tạo được; trùng → 409; quá 3 cái → 409", a1.status === 201 && dup.status === 409 && over.status === 409, `${a1.status} ${dup.status} ${over.status}`);

  const job = (title, state, skills, isUrgent = false) =>
    owner.req("/api/jobs", { method: "POST", json: { title, salonName: "QA Alert Nails", description: "", market: "US", state, city: "Austin", salaryType: "Bao lương tuần", salaryAmount: "$1,500/tuần", skills, benefits: [], phone: "5125550100", isUrgent } });
  inbox.length = 0;
  const j1 = await job(`QA alert khớp ${Date.now() % 1e5}`, "TX", ["Gel-X", "Design"]);
  const got = await waitPush(phone, (p) => p.url === `/jobs/${j1.data.id}`);
  R.check("JA4", "Tin mới khớp (TX + Gel-X) → thợ nhận thông báo, mở đúng tin", got && /đúng tiêu chí/.test(got.title), JSON.stringify(got));
  const j2 = await job(`QA alert lệch ${Date.now() % 1e5}`, "FL", ["Dip/SNS"]);
  await sleep(2500);
  R.check("JA5", "Tin KHÔNG khớp (FL + Dip) → không báo", !pushesFor(phone).some((p) => p.url === `/jobs/${j2.data.id}`));
  const j3 = await job(`QA alert gấp ${Date.now() % 1e5}`, "TX", ["Gel-X"], true);
  await waitPush(phone, (p) => p.url === `/jobs/${j3.data.id}`);
  await sleep(2000);
  const n3 = pushesFor(phone).filter((p) => p.url === `/jobs/${j3.data.id}`).length;
  R.check("JA6", "Tin GẤP vừa khớp tiêu chí → chỉ nhận 1 thông báo (không trùng)", n3 === 1, n3);
  const ownerOwn = await owner.req("/api/job-alerts", { method: "POST", json: { market: "US", state: "TX" } });
  const j4 = await job(`QA alert của chính mình ${Date.now() % 1e5}`, "TX", []);
  await sleep(1500);
  R.check("JA7", "Người đăng tin không tự nhận báo tin của mình", ownerOwn.status === 201 && j4.status === 201);
  const list = (await tech.req("/api/job-alerts")).data.alerts;
  const steal = await owner.req(`/api/job-alerts?id=${list[0].id}`, { method: "DELETE" });
  const del = await tech.req(`/api/job-alerts?id=${list[2].id}`, { method: "DELETE" });
  const after = (await tech.req("/api/job-alerts")).data.alerts;
  R.check("JA8", "Không xoá được thông báo của người khác (404); xoá của mình OK", steal.status === 404 && del.status === 200 && after.length === 2, `${steal.status} ${del.status} ${after.length}`);
  await owner.req(`/api/job-alerts?id=${ownerOwn.data.alert.id}`, { method: "DELETE" });

  // ================= GIAO DIỆN =================
  browser = await chromium.launch();
  async function login(email, password = DEMO_PASSWORD, locale = "vi-VN") {
    const ctx = await browser.newContext({ ...devices["Pixel 7"], locale, acceptDownloads: true });
    if (locale === "en-US") await ctx.addInitScript(() => { try { localStorage.setItem("bitpaw_locale", "en"); } catch {} });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
    p.on("console", (m) => { if (m.type() === "error" && /Content Security Policy/i.test(m.text())) errors.push("CSP: " + m.text().slice(0, 140)); });
    await p.goto(BASE_URL + "/auth/login");
    await p.locator("#email").fill(email);
    await p.locator("#password").fill(password);
    await p.getByRole("button", { name: /^(Đăng nhập|Sign in|Log in)$/ }).click();
    await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
    await p.evaluate(() => { sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 })); localStorage.setItem("pn_push_dismissed_at", String(Date.now())); });
    return p;
  }

  const tp = await login(t.body.email, t.body.password);
  await tp.goto(BASE_URL + "/?tab=feed");
  const card = tp.getByRole("region", { name: "Ai đã xem hồ sơ bạn" });
  const cardOk = await card.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  R.check("UI1", "Trang chủ: thẻ 'Ai đã xem hồ sơ bạn' có số người + tên tiệm", cardOk && /3 người/.test(await card.innerText()) && (await card.getByRole("link").count()) >= 2);
  await tp.screenshot({ path: `${OUT}/ret_home_views.png` });

  await tp.goto(BASE_URL + "/profile");
  await tp.getByText("Thông báo việc mới").waitFor({ timeout: 15000 });
  await tp.getByRole("button", { name: "Xoá thông báo này" }).first().waitFor({ timeout: 10000 }).catch(() => {});
  const alertRows = await tp.getByRole("button", { name: "Xoá thông báo này" }).count();
  R.check("UI2", "Trang Tài khoản: mục 'Thông báo việc mới' liệt kê đúng 2 thông báo", alertRows === 2, alertRows);

  await tp.goto(BASE_URL + "/?tab=jobs");
  await tp.getByRole("button", { name: /Báo tôi khi có việc như này/ }).first().click();
  const dlg = tp.getByRole("dialog", { name: "Thông báo việc mới" });
  await dlg.waitFor({ timeout: 5000 });
  await dlg.getByRole("button", { name: "Dip/SNS" }).click();
  await dlg.getByRole("button", { name: /Bật thông báo việc/ }).click();
  await dlg.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  const nowAlerts = (await tech.req("/api/job-alerts")).data.alerts;
  R.check("UI3", "Bảng việc: 'Báo tôi khi có việc như này' → lưu thông báo Dip/SNS", nowAlerts.length === 3 && nowAlerts.some((a) => a.skill === "Dip/SNS"), JSON.stringify(nowAlerts));
  await tp.screenshot({ path: `${OUT}/ret_jobs_alert.png` });

  // (6) Hình nền chat
  await tp.goto(BASE_URL + `/messages?to=${owner.userId}`);
  await tp.getByPlaceholder(/Viết tin nhắn/).waitFor({ timeout: 20000 });
  await tp.getByTitle("Thêm tùy chọn").click();
  await tp.getByRole("button", { name: /Hình nền đoạn chat/ }).click();
  const pick = tp.getByRole("dialog", { name: "Chọn hình nền đoạn chat" });
  await pick.waitFor({ timeout: 5000 });
  await tp.screenshot({ path: `${OUT}/ret_wallpaper_picker.png` });
  await pick.getByRole("button", { name: "Hoa móng" }).click();
  await pick.getByRole("button", { name: "Xong" }).click();
  const wpEl = tp.locator(".chat-wallpaper");
  const bg1 = await wpEl.evaluate((el) => ({ id: el.getAttribute("data-wallpaper"), img: getComputedStyle(el).backgroundImage }));
  R.check("UI4", "Chọn 'Hoa móng' → nền khung chat đổi ngay", bg1.id === "nails" && /svg/.test(bg1.img), JSON.stringify(bg1).slice(0, 120));
  await tp.screenshot({ path: `${OUT}/ret_wallpaper_chat.png` });
  await tp.reload();
  await tp.getByPlaceholder(/Viết tin nhắn/).waitFor({ timeout: 20000 });
  const bg2 = await wpEl.getAttribute("data-wallpaper");
  R.check("UI5", "Tải lại trang → vẫn giữ hình nền đã chọn (riêng cuộc trò chuyện này)", bg2 === "nails", bg2);

  // (9) Thẻ chia sẻ — dùng thợ seed có ảnh portfolio
  const sp = await login(SEED_TECH);
  await sp.goto(BASE_URL + "/profile");
  await sp.getByRole("button", { name: /Tạo thẻ chia sẻ/ }).click();
  const share = sp.getByRole("dialog", { name: "Thẻ chia sẻ" });
  const shareOk = await share.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  const dims = shareOk ? await share.locator("img").evaluate((img) => new Promise((ok) => (img.complete ? ok([img.naturalWidth, img.naturalHeight]) : (img.onload = () => ok([img.naturalWidth, img.naturalHeight]))))) : null;
  R.check("UI6", "Tạo thẻ chia sẻ → ảnh 1080×1350 (khổ bài đăng Facebook/Instagram)", dims && dims[0] === 1080 && dims[1] === 1350, JSON.stringify(dims));
  await sp.screenshot({ path: `${OUT}/ret_share_dialog.png` });
  if (shareOk) {
    const png = await share.locator("img").evaluate((img) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/png");
    });
    fs.writeFileSync(`${OUT}/ret_share_card.png`, Buffer.from(String(png).split(",")[1], "base64"));
    const [dl] = await Promise.all([sp.waitForEvent("download", { timeout: 10000 }).catch(() => null), share.getByRole("button", { name: /Lưu ảnh/ }).click()]);
    R.check("UI7", "Nút 'Lưu ảnh' tải về file PNG", dl && /^pawnail-.+\.png$/.test(dl.suggestedFilename()), dl?.suggestedFilename());
  } else R.check("UI7", "Lưu ảnh", false, "không mở được thẻ");

  // EN
  const ep = await login(SEED_TECH, DEMO_PASSWORD, "en-US");
  await ep.goto(BASE_URL + "/profile");
  const enOk = await ep.getByRole("button", { name: /Create share card/ }).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  await ep.goto(BASE_URL + "/?tab=jobs");
  const enAlert = await ep.getByRole("button", { name: /Alert me for jobs like this/ }).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  R.check("UI8", "Tiếng Anh: nút thẻ chia sẻ + báo việc hiển thị tiếng Anh", enOk && enAlert);

  R.check("UI9", "Không lỗi JS / 5xx / CSP trong suốt luồng", errors.length === 0, errors.slice(0, 4).join(" | "));
} finally {
  await browser?.close();
  server.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
