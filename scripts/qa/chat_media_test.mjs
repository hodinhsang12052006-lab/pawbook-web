// Nhãn dán / GIF / hình nền trong Messenger — điện thoại Android 412×915 (cảm ứng, isMobile), tiếng Anh.
// CHỈ chạy với server local (scripts/qa/lib.mjs chặn bitpawos.com). Không cần khoá GIPHY: tab GIF thật phải ở trạng
// thái "chưa dùng được"; phần GIF có kết quả dùng /api/gifs GIẢ LẬP (route intercept) + ảnh giả trên media.giphy.com.
//   BASE_URL=http://localhost:3100 [QA_EMAIL_A=… QA_EMAIL_B=…] node scripts/qa/chat_media_test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, Results, fakeIp } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = new Results("Nhãn dán · GIF · Hình nền");
const EMAIL_A = process.env.QA_EMAIL_A || SEED_OWNER;
const EMAIL_B = process.env.QA_EMAIL_B || SEED_TECH;
const SHOTS = process.env.SHOTS_DIR || "";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

const browser = await chromium.launch();
async function login(email, { phone = true } = {}) {
  const ctx = await browser.newContext(
    phone
      ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, locale: "en-US", colorScheme: "dark" }
      : { viewport: { width: 1280, height: 860 }, locale: "en-US" }
  );
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  await ctx.route(/sentry\.io|cloudflareinsights\.com/, (r) => r.abort());
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("pn_push_dismissed_at", String(Date.now()));
      sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
    } catch {}
  });
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  if (!me?.id) throw new Error(`login failed for ${email}`);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, me, h, errors };
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});
async function longPress(page, x, y, ms = 520) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await page.waitForTimeout(ms);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach().catch(() => {});
}
const panel = (page) => page.getByRole("dialog", { name: "Pick emoji" });
async function openPanel(page) {
  if (!(await panel(page).isVisible().catch(() => false))) await page.getByRole("button", { name: "Emoji", exact: true }).click();
  await panel(page).waitFor({ timeout: 8000 });
}
async function openThread(page, query) {
  await page.goto(BASE_URL + `/messages?${query}`);
  await page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
}

const A = await login(EMAIL_A);
const B = await login(EMAIL_B, { phone: false });
const stamp = Date.now().toString().slice(-6);
const hello = await A.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content: `Sticker test ${stamp}` }, headers: A.h });
const conv1 = (await hello.json()).message?.conversationId;
const grp = await A.ctx.request.post(BASE_URL + "/api/conversations", { data: { isGroup: true, name: `QA media ${stamp}`, participantIds: [B.me.id] }, headers: A.h });
const groupId = (await grp.json().catch(() => ({})))?.id || (await grp.json().catch(() => ({})))?.conversation?.id;
await A.ctx.request.post(BASE_URL + "/api/messages", { data: { conversationId: groupId, isGroup: true, content: `Group hello ${stamp}` }, headers: A.h });

// ---------- Server: chỉ nhận id sticker có trong danh mục ----------
const post = (content, type) => A.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content, type }, headers: A.h });
const [okFl, okNoto, bad] = [await post("fl:nail_polish", "STICKER"), await post("💅", "STICKER"), await post("hello", "STICKER")];
R.check("CM0", "API: sticker 'fl:nail_polish' và '💅' → 201; 'hello' → 400", okFl.status() === 201 && okNoto.status() === 201 && bad.status() === 400, `${okFl.status()} ${okNoto.status()} ${bad.status()}`);

// ---------- Tab Nhãn dán ----------
const p = A.page;
await openThread(p, `to=${B.me.id}`);
await openPanel(p);
// ngân sách tải lần đầu (bộ nhớ đệm trình duyệt trống): ≤ 30 ảnh nhỏ, ≤ 350 KB, chưa tải bản động (512.webp)
const firstLoad = [];
const onResp = async (r) => {
  const u = r.url();
  if (!/fonts\.gstatic\.com\/s\/e\/notoemoji|cdn\.jsdelivr\.net\/gh\/microsoft|\/_next\/image\?url=/.test(u)) return;
  const b = await r.body().catch(() => null);
  firstLoad.push({ u: u.slice(-60), n: b ? b.length : Number(r.headers()["content-length"] || 0) });
};
p.on("response", onResp);
await panel(p).getByRole("tab", { name: "Stickers" }).click();
const search = panel(p).getByRole("textbox", { name: "Search stickers" });
await search.waitFor({ timeout: 8000 });
await p.waitForTimeout(3000);
p.off("response", onResp);
const packIcons = await panel(p).locator("[data-pack]").count();
R.check("CM1", "Mở Nhãn dán: có ô tìm + ≥ 12 icon bộ trên thanh", (await search.isVisible()) && packIcons >= 12, String(packIcons));
const kb = Math.round(firstLoad.reduce((a, x) => a + x.n, 0) / 1024);
const animEarly = firstLoad.filter((x) => /512\.webp/.test(x.u)).length;
R.check("CM1b", `Lần mở đầu: ${firstLoad.length} ảnh nhỏ, ${kb} KB (≤ 30 ảnh, ≤ 350 KB), không tải bản động`, firstLoad.length <= 30 && kb <= 350 && animEarly === 0, JSON.stringify({ n: firstLoad.length, kb, animEarly }));
await shot(p, "t01_stickers");

// cuộn qua mọi mục → ảnh tải được thật (naturalWidth > 0)
const sections = await panel(p).locator("[data-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-section")));
const perSection = {};
for (const key of sections) {
  const sec = panel(p).locator(`[data-section="${key}"]`);
  await sec.scrollIntoViewIfNeeded();
  await p.waitForTimeout(450);
  await p.waitForFunction((k) => [...document.querySelectorAll(`[data-section="${k}"] img`)].every((i) => i.complete), key, { timeout: 15000 }).catch(() => {});
  perSection[key] = await sec.locator("img").evaluateAll((imgs) => `${imgs.filter((i) => i.complete && i.naturalWidth > 0).length}/${imgs.length}`);
}
const broken = Object.entries(perSection).filter(([, v]) => { const [a, b] = v.split("/").map(Number); return a !== b || !b; });
R.check("CM2", `Cuộn qua ${sections.length} mục: mọi ảnh sticker tải được (Noto SVG + Fluent qua /_next/image)`, sections.length >= 12 && !broken.length, JSON.stringify(broken.length ? broken : perSection).slice(0, 280));
const credit = await panel(p).locator(".pn-stk-credit").innerText().catch(() => "");
R.check("CM2b", "Dòng ghi công ở cuối: Noto Emoji Animation · CC BY 4.0 · Microsoft Fluent Emoji · MIT", /Noto Emoji Animation/.test(credit) && /CC BY 4\.0/.test(credit) && /Fluent Emoji/.test(credit) && /MIT/.test(credit), credit);

// tìm "cảm ơn"
await search.fill("cảm ơn");
await p.waitForTimeout(500);
const found = await panel(p).locator('[data-section="results"] [data-sticker]').count();
R.check("CM3", "Tìm 'cảm ơn' → có kết quả", found > 0, String(found));
await shot(p, "t02_search_cam_on");

// nhấn giữ → xem trước → Thêm vào Yêu thích
const firstHit = panel(p).locator('[data-section="results"] [data-sticker]').first();
const favId = await firstHit.getAttribute("data-sticker");
const hb = await firstHit.boundingBox();
await longPress(p, hb.x + hb.width / 2, hb.y + hb.height / 2);
const peek = p.locator("[data-sticker-peek]");
const peekOpen = await peek.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
await shot(p, "t03_peek");
if (peekOpen) await peek.getByRole("button", { name: /Add to Favou?rites/ }).click();
const favNow = peekOpen && (await peek.getByRole("button", { name: /Remove from Favou?rites/ }).isVisible().catch(() => false));
await p.keyboard.press("Escape");
const stored = await p.evaluate((uid) => JSON.parse(localStorage.getItem(`pn_stk:v1:${uid}`) || "{}"), A.me.id);
R.check("CM4", "Nhấn giữ 0,5s → xem trước (bản lớn) → 'Add to Favorites' → lưu theo người (pn_stk:v1:<id>)", peekOpen && favNow && stored.f?.includes(favId), JSON.stringify({ peekOpen, favNow, favId, stored }));
R.check("CM4b", "Esc đóng xem trước nhưng bảng vẫn mở", !(await peek.count()) && (await panel(p).isVisible()));

// gửi 3 sticker liền (1 Fluent 3D) — bảng KHÔNG đóng
await search.fill("");
await p.waitForTimeout(300);
const before = await p.locator(".m-row .m-sticker-img").count();
const picks = ["😂", "👍", "fl:nail_polish"];
let stayed = true;
for (const id of picks) {
  const cell = panel(p).locator(`[data-section]:not([data-section="recent"]):not([data-section="fav"]) [data-sticker="${id}"]`).first();
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await p.waitForTimeout(700);
  stayed = stayed && (await panel(p).isVisible());
}
await p.waitForTimeout(1500);
const after = await p.locator(".m-row .m-sticker-img").count();
R.check("CM5", "Gửi 3 nhãn dán liền nhau (😂 👍 💅 3D) — bảng vẫn mở sau mỗi lần", stayed && after - before >= 3, JSON.stringify({ stayed, before, after }));
await shot(p, "t04_sent_three");

// Fluent 128px trong bong bóng
const fl = p.locator('.m-row img.m-sticker-img[src*="fluentui-emoji"]').last();
await fl.scrollIntoViewIfNeeded().catch(() => {});
await p.waitForFunction(() => { const i = [...document.querySelectorAll('.m-row img.m-sticker-img[src*="fluentui-emoji"]')].pop(); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
const flBox = await fl.boundingBox().catch(() => null);
const flOk = await fl.evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false);
R.check("CM6", "Nhãn dán Fluent 3D hiện 128px trong bong bóng, ảnh tải được (jsDelivr, CSP cho phép)", flOk && flBox && Math.round(flBox.width) === 128, JSON.stringify({ flOk, flBox }));

// tải lại → mở bảng đúng tab cũ + "Gần đây" có đủ
await p.reload();
await p.locator("[data-chat-input]").waitFor({ timeout: 30000 });
await openPanel(p);
const tabSel = await panel(p).getByRole("tab", { name: "Stickers" }).getAttribute("aria-selected");
const recentN = await panel(p).locator('[data-section="recent"] [data-sticker]').count();
R.check("CM7", "Tải lại trang: bảng mở lại đúng tab Nhãn dán (nhớ theo người) + mục Gần đây có ≥ 3 nhãn dán", tabSel === "true" && recentN >= 3, JSON.stringify({ tabSel, recentN }));
await p.keyboard.press("Escape");

// danh sách: "<emoji> Sticker"
await p.goto(BASE_URL + "/messages");
await p.locator(".m-conv").first().waitFor({ timeout: 30000 });
const row = p.locator(".m-conv", { hasText: B.me.name }).first();
const prev = await row.locator(".m-preview").innerText().catch(() => "");
R.check("CM8", "Danh sách chat: tin cuối là nhãn dán → 'You: 💅 Sticker'", /You: 💅 Sticker/.test(prev), prev);

// ---------- GIF: không có khoá → không ô GIF nào ----------
await openThread(p, `to=${B.me.id}`);
await openPanel(p);
await panel(p).getByRole("tab", { name: "GIF" }).click();
const disabled = await panel(p).getByTestId("gif-disabled").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
const gifTiles = await panel(p).locator('img[alt="GIF"]').count();
const disabledCopy = await panel(p).getByTestId("gif-disabled").innerText().catch(() => "");
const apiState = await p.evaluate(async () => (await fetch("/api/gifs?lang=en")).json().catch(() => null));
const live = apiState?.enabled === true;
R.check("CM9", live ? "GIF: máy chủ có khoá GIPHY/Tenor → bỏ qua kiểm trạng thái tắt" : "GIF chưa có khoá: 0 ô GIF, chữ 'GIFs aren't available right now.' + nút 'Send a sticker'", live || (disabled && gifTiles === 0 && /GIFs aren.t available right now/.test(disabledCopy) && /Send a sticker/.test(disabledCopy)), JSON.stringify({ disabled, gifTiles, disabledCopy, apiState }));
await shot(p, "t05_gif_disabled");
await p.keyboard.press("Escape");

// ---------- GIF có kết quả (API GIẢ LẬP + ảnh giả trên media.giphy.com) ----------
const mockSvg = (i, w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="hsl(${(i * 47) % 360} 45% 38%)"/><text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-size="${Math.round(h / 7)}" text-anchor="middle" dominant-baseline="middle">mock GIF ${i}</text></svg>`;
const dims = [[480, 270], [200, 200], [200, 300], [320, 180], [200, 250], [300, 200], [200, 150], [240, 320]];
const mockResults = (q) => dims.map(([w, h], i) => ({ id: `g_mock${q}${i}`, send: `https://media.giphy.com/media/mock${i}/200w.webp#wh=${w}x${h}`, preview: `https://media.giphy.com/media/mock${i}/200w.webp`, w, h, title: `mock ${i}` }));
await A.ctx.route("https://media.giphy.com/media/mock*/**", (r) => {
  const i = Number(/mock(\d+)/.exec(r.request().url())?.[1] || 0);
  const [w, h] = dims[i] || [200, 200];
  r.fulfill({ status: 200, headers: { "content-type": "image/svg+xml", "access-control-allow-origin": "*" }, body: mockSvg(i, w, h) });
});
await A.ctx.route(BASE_URL + "/api/gifs**", (r) => {
  const q = new URL(r.request().url()).searchParams.get("q") || "";
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: true, provider: "giphy", results: mockResults(q.replace(/\W/g, "")), next: null }) });
});
await openPanel(p);
await panel(p).getByRole("tab", { name: "GIF" }).click();
await panel(p).locator('img[alt="GIF"]').first().waitFor({ timeout: 8000 }).catch(() => {});
const powered = await panel(p).getByTestId("gif-attribution").isVisible().catch(() => false);
const tilesN = await panel(p).locator('img[alt="GIF"]').count();
await shot(p, "t06_gif_mock_trending");
await panel(p).locator('img[alt="GIF"]').first().click(); // 480×270
await p.waitForTimeout(1800);
const gifStill = await panel(p).isVisible();
const gifBubble = await p.locator(".m-media.m-gif").last().evaluate((m) => {
  const r = m.getBoundingClientRect();
  const img = m.querySelector("img");
  return { w: r.width, h: r.height, fit: img ? getComputedStyle(img).objectFit : null, chip: !!m.querySelector(".m-gif-chip") };
}).catch(() => null);
const ratioOk = gifBubble && Math.abs(gifBubble.w / gifBubble.h - 480 / 270) < 0.03 && gifBubble.w <= 241;
R.check("CM10", "GIF (API giả lập): 'Powered by GIPHY' hiện, có ô GIF; gửi → bong bóng giữ đúng tỉ lệ 480×270 (≤ 240px, contain, nhãn GIF), bảng vẫn mở", powered && tilesN >= 4 && ratioOk && gifBubble.fit === "contain" && gifBubble.chip && gifStill, JSON.stringify({ powered, tilesN, gifBubble, gifStill }));
await shot(p, "t07_gif_sent");
await p.keyboard.press("Escape");
await p.goto(BASE_URL + "/messages");
await p.locator(".m-conv").first().waitFor({ timeout: 30000 });
const prevGif = await p.locator(".m-conv", { hasText: B.me.name }).first().locator(".m-preview").innerText().catch(() => "");
R.check("CM11", "Danh sách chat: tin cuối là GIF → 'You: GIF' (không còn '📷 Photo')", /You: GIF/.test(prevGif), prevGif);
await A.ctx.unroute(BASE_URL + "/api/gifs**");

// ---------- Hình nền ----------
const wpEl = p.locator(".pn-msgr > div > .chat-wallpaper, .pn-msgr .chat-wallpaper:not(.pn-wp-preview)").first();
const wpAttr = () => wpEl.evaluate((el) => ({ id: el.getAttribute("data-wallpaper"), tone: el.getAttribute("data-wp-tone") }));
async function openSheet() {
  await p.getByRole("button", { name: "More options" }).click();
  await p.getByRole("menuitem", { name: /Chat wallpaper/ }).click();
  const d = p.getByRole("dialog", { name: "Choose chat wallpaper" });
  await d.waitFor({ timeout: 8000 });
  return d;
}
await openThread(p, `to=${B.me.id}`);
let sheet = await openSheet();
const presets = await sheet.locator("button[data-wp]").count();
const photoTile = await sheet.getByTestId("wp-photo-tile").count();
R.check("CM12", "Chat 1-1: menu ⋮ → 'Chat wallpaper' → 16 nền + ô 'Your photo'", presets === 16 && photoTile === 1, JSON.stringify({ presets, photoTile }));
await sheet.locator('button[data-wp="marble"]').click();
await p.waitForTimeout(250);
const prevCard = await sheet.getByTestId("wp-preview").getAttribute("data-wallpaper");
const liveBehind = (await wpAttr()).id;
await shot(p, "t08_wallpaper_sheet");
await sheet.getByRole("button", { name: "Cancel" }).click();
const reverted = (await wpAttr()).id;
R.check("CM13", "Chạm 'Marble' → thẻ xem trước + khung chat phía sau đổi ngay; Huỷ → trả lại như cũ", prevCard === "marble" && liveBehind === "marble" && reverted !== "marble", JSON.stringify({ prevCard, liveBehind, reverted }));
sheet = await openSheet();
await sheet.locator('button[data-wp="marble"]').click();
await sheet.getByRole("button", { name: "Apply" }).click();
await p.reload();
await p.locator("[data-chat-input]").waitFor({ timeout: 30000 });
const persisted = await wpAttr();
const stateKey = await p.evaluate((uid) => JSON.parse(localStorage.getItem(`pn_wp:v2:${uid}`) || "{}"), A.me.id);
R.check("CM14", "Áp dụng → tải lại vẫn là Marble cho đúng chat này (khoá u:<người kia>, lưu theo người)", persisted.id === "marble" && stateKey.byChat?.[`u:${B.me.id}`] === "marble", JSON.stringify({ persisted, stateKey }));

// nhóm: có ⋮, "Mọi đoạn chat" + hỏi lại vì đã có nền riêng
await openThread(p, `c=${groupId}`);
const groupDefault = (await wpAttr()).id;
sheet = await openSheet();
await sheet.getByRole("radio", { name: "All chats" }).click();
await sheet.locator('button[data-wp="ocean"]').click();
await sheet.getByRole("button", { name: "Apply" }).click();
const confirmDlg = p.getByRole("alertdialog");
const asked = await confirmDlg.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
const askText = asked ? await confirmDlg.innerText() : "";
await shot(p, "t09_all_chats_confirm");
if (asked) await confirmDlg.getByRole("button", { name: "Keep them" }).click();
await p.waitForTimeout(400);
const groupNow = (await wpAttr()).id;
await openThread(p, `to=${B.me.id}`);
const oneToOneKept = (await wpAttr()).id;
R.check("CM15", "Nhóm có menu ⋮ → 'Mọi đoạn chat' + Ocean → hỏi 'Also replace … on 1 chat?' → 'Keep them': nhóm = Ocean, chat 1-1 vẫn Marble",
  groupDefault !== "ocean" && asked && /Also replace the custom wallpaper on 1 chat/.test(askText) && groupNow === "ocean" && oneToOneKept === "marble", JSON.stringify({ groupDefault, asked, askText, groupNow, oneToOneKept }));

// ảnh của bạn: lưu IndexedDB, KHÔNG có request mạng nào gửi ảnh
sheet = await openSheet();
const reqs = [];
const onReq = (r) => {
  const u = r.url();
  if (u.startsWith("data:") || u.startsWith("blob:")) return;
  // Sentry (đo lỗi của app, đã chặn trong test) không liên quan tới ảnh — bỏ qua
  if (/sentry\.io|cloudflareinsights\.com/.test(u)) return;
  reqs.push({ m: r.method(), u: u.slice(0, 120), n: (r.postDataBuffer() || Buffer.alloc(0)).length });
};
p.on("request", onReq);
await sheet.getByTestId("wp-file").setInputFiles(path.join(HERE, "fixtures", "hand.jpg"));
await sheet.locator("[data-wp-photo]").first().waitFor({ timeout: 10000 });
await p.waitForTimeout(400);
await shot(p, "t10_photo_preview");
await sheet.getByRole("button", { name: "Apply" }).click();
await p.waitForTimeout(600);
p.off("request", onReq);
const idb = await p.evaluate(
  (uid) =>
    new Promise((res) => {
      const rq = indexedDB.open("pn-local", 1);
      rq.onsuccess = () => {
        const tx = rq.result.transaction("wallpapers", "readonly");
        const st = tx.objectStore("wallpapers");
        const keys = st.getAllKeys();
        keys.onsuccess = () => {
          const mine = keys.result.map(String).filter((k) => k.startsWith(uid + ":"));
          if (!mine.length) return res({ keys: [] });
          const g = st.get(mine[0]);
          g.onsuccess = () => res({ keys: mine, size: g.result?.size, type: g.result?.type });
        };
      };
      rq.onerror = () => res({ error: String(rq.error) });
    }),
  A.me.id
);
const photoAttr = await wpAttr();
const uploads = reqs.filter((r) => r.m !== "GET" || /upload|cloudinary/i.test(r.u) || r.n > 0);
R.check("CM16", "Ảnh của bạn: xử lý trên máy, lưu IndexedDB (pn-local/wallpapers, ≤ 400 KB), không request mạng nào gửi dữ liệu; nền = ảnh (data-wp-tone=photo)",
  idb.keys?.length >= 1 && idb.size > 0 && idb.size <= 400 * 1024 && !uploads.length && photoAttr.tone === "photo",
  JSON.stringify({ idb, photoAttr, uploads: uploads.slice(0, 5), reqs: reqs.length }));
await shot(p, "t11_photo_applied");

R.check("CM17", "Không có lỗi JS", !A.errors.length && !B.errors.length, JSON.stringify([...A.errors, ...B.errors]).slice(0, 300));
await browser.close();
const sum = R.summary();
if (SHOTS) fs.writeFileSync(path.join(SHOTS, "chat_media_results.json"), JSON.stringify(sum, null, 2));
process.exit(sum.failed ? 1 : 0);
