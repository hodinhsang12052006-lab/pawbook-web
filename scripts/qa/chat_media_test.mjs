// Nhãn dán / GIF / hình nền trong Messenger — điện thoại Android 412×915 (cảm ứng, isMobile), tiếng Anh.
// CHỈ chạy với server local (scripts/qa/lib.mjs chặn bitpawos.com). Không cần khoá GIPHY: máy chủ không có khoá → MỌI lối
// vào GIF bị ẩn (tab GIF, mục GIF ở menu "+", nút "Search GIFs for …"); phần GIF có kết quả dùng /api/gifs GIẢ LẬP (route
// intercept, kể cả ?probe=1) + ảnh giả trên media.giphy.com.
// Bảng mở trên điện thoại nằm TRONG khung soạn tin: tin vừa gửi (bảng vẫn mở) phải thấy được, không bị bảng che.
// 11/2026 (TG1–TG12): GIF gửi bằng MP4 của GIPHY (video giả tự vẽ scripts/qa/fixtures/gif_mock.webm) — chạy, giữ tỉ lệ,
// dừng khi khuất, trình xem toàn màn hình, tin .gif cũ, giảm chuyển động; ô tìm trong tab Emoji ('cam on' → 🙏); thanh gợi ý
// nhãn dán khi gõ 1 emoji; tin '😂' vẽ to + chạy 1 lượt; danh sách vẫn là chữ; tiếng Việt; bong bóng chat Android.
// Ảnh chụp (SHOTS_DIR): t06–t20 (EN + VI, 412px).
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
      ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, locale: "en-US", colorScheme: "dark", serviceWorkers: "block" }
      : { viewport: { width: 1280, height: 860 }, locale: "en-US", serviceWorkers: "block" }
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
// Menu "+" (đính kèm): có mục "Insert GIF" không — mở rồi đóng lại
async function attachMenuHasGif(page) {
  await page.getByRole("button", { name: /^(Attach|Đính kèm)/ }).first().click();
  const menu = page.locator(".m-attach-sheet[role=menu]");
  await menu.waitFor({ timeout: 4000 });
  const n = await menu.getByRole("menuitem", { name: /Insert GIF/ }).count();
  const label = await page.getByRole("button", { name: /^(Attach|Đính kèm)/ }).first().getAttribute("aria-label");
  // đóng: chạm lớp phủ phía trên (cả màn hình, ngoài menu)
  await page.mouse.click(206, 140);
  await menu.waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
  return n + (n && !/GIF/.test(label || "") ? 100 : 0) + (!n && /GIF/.test(label || "") ? 1000 : 0);
}
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
const mockSvg = (i, w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="hsl(${(i * 47) % 360} 45% 38%)"/><text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-size="${Math.round(h / 7)}" text-anchor="middle" dominant-baseline="middle">mock GIF ${i}</text></svg>`;
const dims = [[480, 270], [200, 200], [200, 300], [320, 180], [200, 250], [300, 200], [200, 150], [240, 320]];
// Như /api/gifs thật từ 11/2026 (lib/chat/giphy.ts): gửi = MP4 + #wh + &still=<poster>, ô = MP4 nhỏ + ảnh tĩnh; mỗi ô thứ 4 là
// WebP kiểu cũ (mục Gần đây lưu trước 11/2026 / Tenor) — vẫn phải vẽ bằng <img>.
const GM = "https://media.giphy.com/media";
const mockResults = (q) =>
  dims.map(([w, h], i) =>
    i % 4 === 3
      ? { id: `g_mock${q}${i}`, send: `${GM}/mock${i}/200w.webp#wh=${w}x${h}`, preview: `${GM}/mock${i}/200w.webp`, w, h, title: `mock ${i}` }
      : { id: `g_mock${q}${i}`, send: `${GM}/mock${i}/200.mp4#wh=${w}x${h}&still=${encodeURIComponent(`${GM}/mock${i}/200_s.gif`)}`, preview: `${GM}/mock${i}/200w.mp4`, still: `${GM}/mock${i}/200w_s.gif`, w, h, title: `mock ${i}` }
  );
// "MP4" giả: video nhỏ tự vẽ (scripts/qa/fixtures/gif_mock.webm — Chromium của Playwright không có H.264; trình duyệt dò định
// dạng theo nội dung, không theo đuôi .mp4). GIPHY thật trả H.264 MP4.
const MOCK_VIDEO = fs.readFileSync(path.join(HERE, "fixtures", "gif_mock.webm"));
// Ảnh GIF giả + /api/gifs giả: đăng ký NGAY khi tạo phiên (trước mọi request); /api/gifs chỉ giả khi mockGifs = true.
let mockGifs = false;
const mockMedia = (r) => {
  const u = r.request().url();
  if (/\.mp4(?:[?#]|$)/.test(u)) return r.fulfill({ status: 200, headers: { "content-type": "video/mp4", "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" }, body: MOCK_VIDEO });
  const i = Number(/mock(\d+)/.exec(u)?.[1] || 0);
  const [w, h] = dims[i] || [200, 200];
  r.fulfill({ status: 200, headers: { "content-type": "image/svg+xml", "access-control-allow-origin": "*" }, body: mockSvg(i, w, h) });
};
await A.ctx.route(/^https:\/\/media\.giphy\.com\/media\/mock\d+\//, mockMedia);
await A.ctx.route(/\/api\/gifs(\?|$)/, (r) => {
  if (!mockGifs) return r.fallback();
  if (new URL(r.request().url()).searchParams.get("probe") === "1") return r.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify({ enabled: true, provider: "giphy" }) });
  const q = new URL(r.request().url()).searchParams.get("q") || "";
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: true, provider: "giphy", results: mockResults(q.replace(/\W/g, "")), next: null }) });
});
const B = await login(EMAIL_B, { phone: false });
const stamp = Date.now().toString().slice(-6);
const hello = await A.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content: `Sticker test ${stamp}` }, headers: A.h });
const conv1 = (await hello.json()).message?.conversationId;
const grp = await A.ctx.request.post(BASE_URL + "/api/conversations", { data: { isGroup: true, name: `QA media ${stamp}`, participantIds: [B.me.id] }, headers: A.h });
const grpBody = await grp.json().catch(() => ({}));
let groupId = grpBody?.id || grpBody?.conversation?.id;
if (!groupId) {
  // giới hạn chống spam 5 nhóm / ngày (lib/abuseGuard) → dùng lại 1 nhóm QA đã có của 2 người này
  const list = await (await A.ctx.request.get(BASE_URL + "/api/messages", { headers: A.h })).json();
  groupId = (list.conversations || []).find((c) => c.isGroup && c.participants?.some((u) => u.id === B.me.id))?.id;
}
if (!groupId) throw new Error(`no group chat available (create → ${grp.status()})`);
await A.ctx.request.post(BASE_URL + "/api/messages", { data: { conversationId: groupId, isGroup: true, content: `Group hello ${stamp}` }, headers: A.h });

// ---------- Server: chỉ nhận id sticker có trong danh mục ----------
const post = (content, type) => A.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: B.me.id, content, type }, headers: A.h });
const [okFl, okNoto, bad] = [await post("fl:nail_polish", "STICKER"), await post("💅", "STICKER"), await post("hello", "STICKER")];
R.check("CM0", "API: sticker 'fl:nail_polish' và '💅' → 201; 'hello' → 400", okFl.status() === 201 && okNoto.status() === 201 && bad.status() === 400, `${okFl.status()} ${okNoto.status()} ${bad.status()}`);

// ---------- Tab Nhãn dán ----------
const p = A.page;
await openThread(p, `to=${B.me.id}`);
await openPanel(p);
// ngân sách tải lần đầu (bộ nhớ đệm trình duyệt trống): ≤ 30 ảnh nhỏ, ≤ 350 KB; hình động = lottie.json của Noto (ghim
// /17.0/), tối đa 12 file cho mục đang xem; không còn 512.webp nặng
const firstLoad = [];
const onResp = async (r) => {
  const u = r.url();
  if (!/fonts\.gstatic\.com\/s\/e\/notoemoji|cdn\.jsdelivr\.net\/gh\/microsoft|\/_next\/image\?url=/.test(u)) return;
  const b = await r.body().catch(() => null);
  firstLoad.push({ u: u.slice(-60), full: u, n: b ? b.length : Number(r.headers()["content-length"] || 0) });
};
p.on("response", onResp);
// Event Timing: thời lượng tương tác (≈ INP) khi đổi tab / đổi bộ
await p.evaluate(() => {
  window.__evt = [];
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__evt.push({ n: e.name, d: Math.round(e.duration) }))).observe({ type: "event", durationThreshold: 16, buffered: false });
  } catch {}
});
await panel(p).getByRole("tab", { name: "Stickers" }).click();
const search = panel(p).getByRole("textbox", { name: "Search stickers" });
await search.waitFor({ timeout: 8000 });
await p.waitForTimeout(3000);
// lúc mở: chỉ các bộ đầu dựng ô thật, bộ xa là ô giữ chỗ cùng cỡ
const mountedAtOpen = await panel(p).locator("[data-section] [data-sticker]").count();
const lazyAtStart = await panel(p).locator(".pn-stk-ph").count();
p.off("response", onResp);
for (const k of ["hearts", "beauty", "feelings"]) {
  await panel(p).locator(`[data-pack="${k}"]`).click();
  await p.waitForTimeout(500);
}
const evts = await p.evaluate(() => window.__evt || []);
const worstEvt = evts.filter((e) => /pointer|click|key/.test(e.n)).reduce((m, e) => Math.max(m, e.d), 0);
R.check("CM1c", `Đổi tab Nhãn dán + đổi bộ 3 lần: tương tác chậm nhất ${worstEvt}ms (mục tiêu < 100ms trên máy này)`, worstEvt < 100 || evts.length === 0, JSON.stringify(evts.slice(0, 12)));
await panel(p).getByTestId("sticker-scroll").evaluate((el) => (el.scrollTop = 0));
const packIcons = await panel(p).locator("[data-pack]").count();
R.check("CM1", "Mở Nhãn dán: có ô tìm + ≥ 12 icon bộ trên thanh", (await search.isVisible()) && packIcons >= 12, String(packIcons));
const stills = firstLoad.filter((x) => !/lottie\.json/.test(x.u));
const lotties = firstLoad.filter((x) => /lottie\.json/.test(x.u));
const kb = Math.round(stills.reduce((a, x) => a + x.n, 0) / 1024);
const animKb = Math.round(lotties.reduce((a, x) => a + x.n, 0) / 1024);
const heavy = firstLoad.filter((x) => /512\.webp|\/latest\//.test(x.full)).length;
const unpinned = firstLoad.filter((x) => /fonts\.gstatic\.com/.test(x.full) && !/\/notoemoji\/17\.0\//.test(x.full)).length;
R.check("CM1b", `Lần mở đầu: ${stills.length} ảnh nhỏ, ${kb} KB (≤ 30 ảnh, ≤ 350 KB) + ${lotties.length} hình động lottie (${animKb} KB giải nén, ≤ 12 file); không 512.webp, Noto ghim /17.0/`,
  stills.length <= 30 && kb <= 350 && lotties.length <= 12 && heavy === 0 && unpinned === 0, JSON.stringify({ n: stills.length, kb, lotties: lotties.length, animKb, heavy, unpinned }));
await shot(p, "t01_stickers");
// hình động thật sự chạy trong lưới (lottie SVG), không quá 12 ô cùng lúc
const playing = [];
for (let i = 0; i < 6; i++) {
  playing.push(await panel(p).locator(".pn-stk-cell .pn-lottie svg").count());
  await p.waitForTimeout(250);
}
R.check("CM1d", `Nhãn dán động trong lưới (lottie): số ô đang chạy ${JSON.stringify(playing)} — có chạy, tối đa 12`, Math.max(...playing) >= 1 && Math.max(...playing) <= 12, JSON.stringify(playing));

// cuộn hết vùng cuộn (từng đoạn ~ 0,9 khung; ~770 sticker) → mục xa được dựng khi tới gần, ảnh của MỌI mục tải được thật
const sections = await panel(p).locator("[data-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-section")));
const scroller = panel(p).getByTestId("sticker-scroll");
for (let i = 0; i < 400; i++) {
  const done = await scroller.evaluate((el) => {
    el.scrollTop += Math.round(el.clientHeight * 0.9);
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  });
  await p.waitForTimeout(120);
  if (done) break;
}
await p.waitForTimeout(600);
const lazyLeft = await panel(p).locator(".pn-stk-ph").count();
const cellsNow = await panel(p).locator("[data-section] [data-sticker]").count();
R.check("CM2c", `Mục xa dựng khi tới gần: lúc mở ${mountedAtOpen} ô thật + ${lazyAtStart} ô giữ chỗ → cuộn hết còn ${lazyLeft} ô giữ chỗ, ${cellsNow} ô thật`, mountedAtOpen <= 120 && lazyAtStart > 600 && lazyLeft === 0 && cellsNow >= 700, JSON.stringify({ mountedAtOpen, lazyAtStart, lazyLeft, cellsNow }));
await p.waitForFunction(() => [...document.querySelectorAll("[data-testid=sticker-scroll] img")].every((i) => i.getAttribute("src") && i.complete), null, { timeout: 20000 }).catch(() => {});
const perSection = {};
for (const key of sections) {
  perSection[key] = await panel(p).locator(`[data-section="${key}"] img`).evaluateAll((imgs) => `${imgs.filter((i) => i.complete && i.naturalWidth > 0).length}/${imgs.length}`);
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
await panel(p).locator('[data-pack="beauty"]').scrollIntoViewIfNeeded();
await p.waitForTimeout(1200);
const barImgs = await panel(p).locator("[data-pack] img").evaluateAll((imgs) => imgs.filter((i) => { const r = i.getBoundingClientRect(); const b = i.closest("[role=tablist]").getBoundingClientRect(); return r.right > b.left && r.left < b.right; }).map((i) => i.complete && i.naturalWidth > 0));
R.check("CM3b", "Xoá ô tìm → thanh bộ hiện lại, icon trong tầm nhìn đều tải được (kể cả bộ 3D cuối thanh)", barImgs.length >= 6 && barImgs.every(Boolean), JSON.stringify(barImgs));
const before = await p.locator(".m-row .m-sticker-img").count();
const picks = [["😂", "feelings"], ["👍", "hands"], ["fl:nail_polish", "beauty"]];
let stayed = true;
for (const [id, pack] of picks) {
  await panel(p).locator(`[data-pack="${pack}"]`).click();
  await p.waitForTimeout(900);
  const cell = panel(p).locator(`[data-section]:not([data-section="recent"]):not([data-section="fav"]) [data-sticker="${id}"]`).first();
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await p.waitForTimeout(700);
  stayed = stayed && (await panel(p).isVisible());
}
await p.waitForTimeout(1500);
const after = await p.locator(".m-row .m-sticker-img").count();
R.check("CM5", "Gửi 3 nhãn dán liền nhau (😂 👍 💅 3D) — bảng vẫn mở sau mỗi lần", stayed && after - before >= 3, JSON.stringify({ stayed, before, after }));
// tin vừa gửi nằm TRỌN phía trên bảng (bảng trong khung soạn tin, khung tin co lại + dính đáy); không còn hàng gợi ý chen giữa
const layout = await p.evaluate(() => {
  const pnl = document.querySelector(".pn-media-panel")?.getBoundingClientRect();
  const sc = document.querySelector(".m-scroll")?.getBoundingClientRect();
  const rows = [...document.querySelectorAll(".m-row .m-sticker-img")];
  const last = rows.pop()?.getBoundingClientRect();
  const suggest = [...document.querySelectorAll(".pn-composer button")].some((b) => /^(Suggest|Gợi ý)$/.test((b.textContent || "").trim()) && b.getBoundingClientRect().height > 0);
  return { pnlTop: pnl && Math.round(pnl.top), scBottom: sc && Math.round(sc.bottom), lastTop: last && Math.round(last.top), lastBottom: last && Math.round(last.bottom), suggest };
});
R.check("CM5b", "Bảng mở: nhãn dán vừa gửi thấy trọn phía trên bảng (không bị che), không có nút 'Suggest' chen giữa bảng và ô nhập",
  layout.pnlTop != null && layout.lastBottom != null && layout.lastBottom <= layout.pnlTop && layout.lastBottom <= layout.scBottom + 1 && layout.lastTop >= 0 && !layout.suggest, JSON.stringify(layout));
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

// ---------- GIF: không có khoá → MỌI lối vào GIF bị ẩn ----------
// tab nhớ lần trước là GIF → vẫn mở Nhãn dán
await p.evaluate((uid) => localStorage.setItem(`pn_media_tab:${uid}`, "gif"), A.me.id);
await openThread(p, `to=${B.me.id}`);
const probe = await p.evaluate(async () => {
  const r = await fetch("/api/gifs?probe=1");
  return { status: r.status, cc: r.headers.get("cache-control"), body: await r.json().catch(() => null) };
});
const live = probe.body?.enabled === true;
await openPanel(p);
const gifTab = await panel(p).getByRole("tab", { name: "GIF" }).count();
const openedOn = (await panel(p).getByRole("tab", { name: "Stickers", exact: true }).getAttribute("aria-selected").catch(() => null)) === "true" ? "Stickers" : "other";
await panel(p).getByRole("tab", { name: "Stickers" }).click().catch(() => {});
await panel(p).getByRole("textbox", { name: "Search stickers" }).fill("zzqxv");
await p.waitForTimeout(500);
const gifHandoff = await panel(p).getByRole("button", { name: /Search GIFs for/ }).count();
await shot(p, "t05_gif_disabled");
await panel(p).getByRole("textbox", { name: "Search stickers" }).fill("");
await p.keyboard.press("Escape");
const attachGif = await attachMenuHasGif(p);
R.check("CM9", live ? "GIF: máy chủ có khoá GIPHY/Tenor → bỏ qua kiểm trạng thái tắt" : "GIF chưa có khoá: /api/gifs?probe=1 → enabled:false + no-store; không có tab GIF, không có 'Insert GIF' ở menu '+', không có nút 'Search GIFs for …'; tab nhớ là GIF → mở Nhãn dán",
  live || (probe.status === 200 && probe.body?.enabled === false && /no-store/.test(probe.cc || "") && gifTab === 0 && attachGif === 0 && gifHandoff === 0 && /Stickers/.test(openedOn)),
  JSON.stringify({ probe, gifTab, attachGif, gifHandoff, openedOn }));

// ---------- GIF có kết quả (API GIẢ LẬP + ảnh giả trên media.giphy.com) ----------
mockGifs = true;
// khoá vừa được thêm (giả lập): phiên mới hỏi lại probe → tab GIF + mục 'Insert GIF' hiện
await p.evaluate(() => sessionStorage.removeItem("pn_gif_on"));
await openThread(p, `to=${B.me.id}`);
const attachGifOn = await attachMenuHasGif(p);
const gifFails = [];
const onFail = (r) => /giphy/.test(r.url()) && gifFails.push(`${r.url().slice(-40)} ${r.failure()?.errorText}`);
const onGifResp = (r) => /media\.giphy/.test(r.url()) && r.status() !== 200 && gifFails.push(`${r.status()} ${r.url().slice(-40)}`);
p.on("requestfailed", onFail);
p.on("response", onGifResp);
await openPanel(p);
await panel(p).getByRole("tab", { name: "GIF" }).click();
await panel(p).locator("[data-gif-tile]").first().waitFor({ timeout: 8000 }).catch(() => {});
await p.waitForTimeout(1500);
const powered = await panel(p).getByTestId("gif-attribution").isVisible().catch(() => false);
const tilesN = await panel(p).locator("[data-gif-tile]").count();
const cols = await panel(p).locator(".pn-gif-cols").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length).catch(() => 0);
R.check("CM9b", `GIF có khoá (giả lập): mục 'Insert GIF' ở menu '+' hiện lại; lưới ${cols} cột ở màn 412px (3 khi bảng ≥ 340px)`, attachGifOn === 1 && cols === 3, JSON.stringify({ attachGifOn, cols }));
// ô lưới: MP4 nhỏ chạy (ô đang thấy), ô WebP kiểu cũ vẫn là <img>
const gridState = () =>
  panel(p).locator("[data-gif-tile]").evaluateAll((tiles) =>
    tiles.map((t) => {
      const v = t.querySelector("video");
      return { v: !!v, playing: !!v && !v.paused && v.readyState >= 2 && v.currentTime > 0, still: !!t.querySelector('img[src$="_s.gif"]'), webp: !!t.querySelector('img[src$=".webp"]') };
    })
  );
const grid = await gridState();
const playingTiles = grid.filter((x) => x.playing).length;
R.check("TG1", `Lưới GIF: ô GIPHY là MP4 nhỏ (fixed_width) ĐANG CHẠY (${playingTiles}/${grid.length} ô), ô WebP cũ vẫn là <img>, 'Powered by GIPHY' vẫn hiện`,
  playingTiles >= 2 && grid.some((x) => x.webp && !x.v) && powered, JSON.stringify(grid));
await shot(p, "t06_gif_mock_trending");
await panel(p).locator("[data-gif-tile]").first().click(); // 480×270, MP4
await p.waitForTimeout(2200);
const gifStill = await panel(p).isVisible();
const bubbleState = () =>
  p.locator(".m-media.m-gif").last().evaluate((m) => {
    const r = m.getBoundingClientRect();
    const v = m.querySelector("video");
    const media = v || m.querySelector("img");
    return {
      w: r.width, h: r.height, fit: media ? getComputedStyle(media).objectFit : null, chip: !!m.querySelector(".m-gif-chip"),
      playingAttr: m.querySelector("[data-gif-video]")?.getAttribute("data-playing") ?? null,
      poster: !!m.querySelector('img[src$="_s.gif"]'),
      video: v && { src: v.getAttribute("src"), poster: v.getAttribute("poster"), autoplay: v.hasAttribute("autoplay"), muted: v.muted && v.hasAttribute("muted"), loop: v.loop, inline: v.hasAttribute("playsinline"), preload: v.getAttribute("preload"), paused: v.paused, t: v.currentTime, rs: v.readyState },
    };
  }).catch(() => null);
const gifBubble = await bubbleState();
const ratioOk = gifBubble && Math.abs(gifBubble.w / gifBubble.h - 480 / 270) < 0.03 && gifBubble.w <= 241;
R.check("CM10", "GIF (API giả lập): 'Powered by GIPHY' hiện, có ô GIF; gửi → bong bóng giữ đúng tỉ lệ 480×270 (≤ 240px, contain, nhãn GIF), bảng vẫn mở", powered && tilesN >= 4 && ratioOk && gifBubble.fit === "contain" && gifBubble.chip && gifStill, JSON.stringify({ powered, tilesN, gifBubble, gifStill, gifFails }));
const gv = gifBubble?.video;
R.check("TG2", "GIF gửi đi là MP4: bong bóng <video autoplay muted loop playsinline preload=metadata poster=…> ĐANG CHẠY (src bỏ phần #, poster = ảnh tĩnh 200_s), đúng tỉ lệ 480×270, nhãn GIF",
  !!gv && /\/mock0\/200\.mp4$/.test(gv.src) && /\/mock0\/200_s\.gif$/.test(gv.poster || "") && gv.autoplay && gv.muted && gv.loop && gv.inline && gv.preload === "metadata" && !gv.paused && gv.t > 0 && gv.rs >= 2 && ratioOk && gifBubble.chip,
  JSON.stringify(gifBubble));
const thread = async () => (await (await A.ctx.request.get(BASE_URL + `/api/messages?partnerId=${B.me.id}`, { headers: A.h })).json()).messages || [];
const savedGif = (await thread()).filter((m) => /\/mock0\/200\.mp4/.test(m.content || "")).pop();
const evil = await post(`${GM}/mock1/200.mp4#wh=200x200&still=${encodeURIComponent("https://evil.example/pixel.gif")}`, "IMAGE");
const asVideo = await post(`${GM}/mock2/200.mp4#wh=200x300&still=${encodeURIComponent(`${GM}/mock2/200_s.gif`)}`, "VIDEO");
const asVideoBody = await asVideo.json().catch(() => ({}));
R.check("TG2b", "Máy chủ: lưu tin IMAGE = 'mp4#wh=480x270&still=<URI ảnh tĩnh>'; poster trỏ host lạ → 400; gửi GIF MP4 với type VIDEO → lưu IMAGE (xem trước luôn là 'GIF')",
  savedGif?.type === "IMAGE" && savedGif.content === `${GM}/mock0/200.mp4#wh=480x270&still=${encodeURIComponent(`${GM}/mock0/200_s.gif`)}` && evil.status() === 400 && asVideo.status() === 201 && asVideoBody.message?.type === "IMAGE",
  JSON.stringify({ saved: savedGif?.content, type: savedGif?.type, evil: evil.status(), asVideo: asVideo.status(), asVideoType: asVideoBody.message?.type }));
const gifVis = await p.evaluate(() => {
  const pnl = document.querySelector(".pn-media-panel")?.getBoundingClientRect();
  const g = [...document.querySelectorAll(".m-media.m-gif")].pop()?.getBoundingClientRect();
  return { pnlTop: pnl && Math.round(pnl.top), top: g && Math.round(g.top), bottom: g && Math.round(g.bottom) };
});
R.check("CM10b", "GIF vừa gửi (bảng vẫn mở) thấy trọn phía trên bảng", gifVis.pnlTop != null && gifVis.bottom != null && gifVis.bottom <= gifVis.pnlTop && gifVis.top >= 0, JSON.stringify(gifVis));
await shot(p, "t07_gif_sent");
await p.keyboard.press("Escape");
await p.goto(BASE_URL + "/messages");
await p.locator(".m-conv").first().waitFor({ timeout: 30000 });
const prevGif = await p.locator(".m-conv", { hasText: B.me.name }).first().locator(".m-preview").innerText().catch(() => "");
R.check("CM11", "Danh sách chat: tin cuối là GIF (MP4) → 'You: GIF' (không phải '🎬 Video' / '📷 Photo')", /You: GIF/.test(prevGif), prevGif);

// GIF khuất khỏi khung → không chạy (trình phát gỡ / dừng); cuộn tới → chạy lại
for (let i = 0; i < 14; i++) await post(`QA filler ${stamp} #${i + 1}`, "TEXT");
await openThread(p, `to=${B.me.id}`);
await p.waitForTimeout(1200);
const offscreen = await p.evaluate(() => {
  const all = [...document.querySelectorAll(".m-gif [data-gif-video]")];
  const sc = document.querySelector(".m-scroll").getBoundingClientRect();
  return all.map((el) => {
    const r = el.getBoundingClientRect();
    const v = el.querySelector("video");
    return { visible: r.bottom > sc.top && r.top < sc.bottom, attr: el.getAttribute("data-playing"), playing: !!v && !v.paused };
  });
});
const hiddenOnes = offscreen.filter((x) => !x.visible);
const lastGif = p.locator(".m-media.m-gif:has(video), .m-media.m-gif:has([data-gif-video])").last();
await lastGif.scrollIntoViewIfNeeded();
await p.waitForTimeout(1500);
const back = await bubbleState();
R.check("TG3", `GIF khuất khỏi khung tin (${hiddenOnes.length} cái) → không chạy (data-playing=0, không trình phát chạy); cuộn tới → chạy lại`,
  hiddenOnes.length >= 1 && hiddenOnes.every((x) => x.attr === "0" && !x.playing) && back?.playingAttr === "1" && back?.video && !back.video.paused,
  JSON.stringify({ offscreen, back: back?.video }));
// chạm GIF → xem toàn màn hình: video lặp, tắt tiếng, đang chạy
await lastGif.click();
const viewer = p.getByRole("dialog", { name: "Photo / video viewer" });
await viewer.waitFor({ timeout: 6000 }).catch(() => {});
await p.waitForTimeout(1200);
const lb = await viewer.locator("video").evaluate((v) => ({ loop: v.loop, muted: v.muted, controls: v.controls, paused: v.paused, t: v.currentTime, src: v.getAttribute("src") })).catch(() => null);
await shot(p, "t07b_gif_lightbox");
await p.keyboard.press("Escape");
R.check("TG4", "Chạm GIF MP4 → trình xem toàn màn hình phát video lặp, tắt tiếng, không thanh điều khiển (như GIF)", !!lb && lb.loop && lb.muted && !lb.controls && !lb.paused && lb.t > 0 && !/#/.test(lb.src || "#"), JSON.stringify(lb));

// tin GIF cũ (.gif, trước 11/2026) vẫn vẽ bằng <img>
await post(`${GM}/mock3/200.gif#wh=320x180`, "IMAGE");
await openThread(p, `to=${B.me.id}`);
await p.waitForTimeout(1200);
const legacy = await p.locator(".m-media.m-gif").last().evaluate((m) => {
  const r = m.getBoundingClientRect();
  const img = m.querySelector("img");
  return { img: !!img && img.complete && img.naturalWidth > 0, src: img?.getAttribute("src"), video: !!m.querySelector("video, [data-gif-video]"), ratio: r.width / r.height, chip: !!m.querySelector(".m-gif-chip") };
}).catch(() => null);
R.check("TG5", "Tin GIF cũ ('….gif#wh=320x180') vẫn hiện bằng <img> (không thành video), đúng tỉ lệ 16:9, có nhãn GIF",
  !!legacy && legacy.img && !legacy.video && Math.abs(legacy.ratio - 320 / 180) < 0.03 && legacy.chip, JSON.stringify(legacy));

// giảm chuyển động: chỉ ảnh tĩnh (không tải video) — trong tin và trong lưới
await p.emulateMedia({ reducedMotion: "reduce" });
await openThread(p, `to=${B.me.id}`);
const mp4Gif = p.locator(".m-media.m-gif:has([data-gif-video])").last();
await mp4Gif.scrollIntoViewIfNeeded().catch(() => {});
await p.waitForTimeout(1200);
const calm = await mp4Gif.evaluate((m) => { const img = m.querySelector("img"); return { video: !!m.querySelector("video"), poster: !!img && img.complete && img.naturalWidth > 0 && /_s\.gif$/.test(img.getAttribute("src") || "") }; }).catch(() => null);
await openPanel(p);
await panel(p).getByRole("tab", { name: "GIF" }).click();
await panel(p).locator("[data-gif-tile]").first().waitFor({ timeout: 8000 }).catch(() => {});
await p.waitForTimeout(1200);
const calmGrid = await gridState();
await p.keyboard.press("Escape");
await p.emulateMedia({ reducedMotion: "no-preference" });
R.check("TG6", "Giảm chuyển động: GIF MP4 trong tin chỉ hiện ảnh tĩnh (không <video>); ô lưới MP4 hiện ảnh tĩnh của ô", !!calm && !calm.video && calm.poster && calmGrid.length >= 4 && !calmGrid.some((x) => x.v) && calmGrid.filter((x) => x.still).length >= 3,
  JSON.stringify({ calm, calmGrid }));
mockGifs = false;
await p.evaluate(() => sessionStorage.removeItem("pn_gif_on"));

// ---------- Tab Emoji: ô tìm (EN + VI, không dấu) ----------
await openThread(p, `to=${B.me.id}`);
await openPanel(p);
await panel(p).getByRole("tab", { name: "Emoji", exact: true }).click();
const emojiSearch = panel(p).getByRole("textbox", { name: "Search emoji" });
await emojiSearch.waitFor({ timeout: 8000 });
const geo = () => p.evaluate(() => {
  const g = document.querySelector("[data-emoji-grid]")?.getBoundingClientRect();
  const pn = document.querySelector(".pn-media-panel")?.getBoundingClientRect();
  return { gridTop: g && Math.round(g.top), panelH: pn && Math.round(pn.height), panelTop: pn && Math.round(pn.top) };
});
const before0 = await geo();
await p.evaluate(() => {
  window.__evt2 = [];
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__evt2.push({ n: e.name, d: Math.round(e.duration) }))).observe({ type: "event", durationThreshold: 16, buffered: false });
  } catch {}
});
await emojiSearch.click();
// từ khoá CLDR tải động khi chạm ô tìm — chờ nạp xong rồi mới đo từng phím
await p.waitForTimeout(1500);
await p.evaluate(() => (window.__evt2 = []));
await p.keyboard.type("cam on", { delay: 90 });
await p.waitForTimeout(500);
const camOn = await panel(p).locator('[data-emoji-grid="results"] [data-emoji]').evaluateAll((b) => b.map((x) => x.getAttribute("data-emoji")));
const after0 = await geo();
const typeEvts = await p.evaluate(() => window.__evt2 || []);
const keyEvts = typeEvts.filter((e) => /^(keydown|keyup|keypress|beforeinput|input)$/.test(e.n));
const worstKey = keyEvts.reduce((m, e) => Math.max(m, e.d), 0);
await shot(p, "t12_emoji_search_en");
R.check("TG7", `Tab Emoji có ô tìm; gõ 'cam on' (không dấu) → 🙏 đầu (${camOn.slice(0, 6).join(" ")}); lưới không nhảy (đỉnh lưới ${before0.gridTop}→${after0.gridTop}, cao bảng ${before0.panelH}→${after0.panelH}); phím chậm nhất ${worstKey}ms (< 100ms trên máy này)`,
  camOn[0] === "🙏" && before0.gridTop === after0.gridTop && before0.panelH === after0.panelH && worstKey < 100, JSON.stringify({ camOn: camOn.slice(0, 8), before0, after0, keyEvts }));
await panel(p).locator('[data-emoji-grid="results"] [data-emoji="🙏"]').first().click();
const composerVal = await p.locator("[data-chat-input]").inputValue();
const recentStore = await p.evaluate((uid) => JSON.parse(localStorage.getItem(`pn_emoji_recent:v1:${uid}`) || "[]"), A.me.id);
await panel(p).getByRole("button", { name: "Clear" }).click();
await p.waitForTimeout(200);
const recentTab = await panel(p).getByRole("button", { name: "Recent", exact: true }).count();
const afterClear = await geo();
R.check("TG7b", "Chọn 🙏 từ kết quả → chèn vào ô soạn tin + vào 'Gần đây' (lưu theo người); xoá ô tìm → lưới nhóm + nút 'Recent' vẫn còn, không nhảy",
  composerVal.endsWith("🙏") && recentStore[0] === "🙏" && recentTab === 1 && afterClear.gridTop === before0.gridTop, JSON.stringify({ composerVal, recentStore: recentStore.slice(0, 4), recentTab, afterClear }));
await emojiSearch.fill("tim");
await p.waitForTimeout(300);
const timRes = await panel(p).locator('[data-emoji-grid="results"] [data-emoji]').evaluateAll((b) => b.map((x) => x.getAttribute("data-emoji")));
await emojiSearch.fill("zzqxv");
await p.waitForTimeout(200);
const noneMsg = await panel(p).getByText("No emoji found").isVisible().catch(() => false);
R.check("TG7c", "'tim' → ❤️ đầu + các tim; chuỗi lạ → 'No emoji found'", timRes[0] === "❤️" && timRes.filter((e) => /[❤🧡💛💚💙💜🖤🤍💕💞💓💗💖]/u.test(e)).length >= 8 && noneMsg, JSON.stringify({ tim: timRes.slice(0, 10), noneMsg }));
await emojiSearch.fill("");
await p.keyboard.press("Escape"); // ô tìm rỗng → Esc đóng bảng
await panel(p).waitFor({ state: "detached", timeout: 4000 }).catch(() => {});

// ---------- Gợi ý nhãn dán khi ô soạn tin là 1 emoji ----------
const input = p.locator("[data-chat-input]");
const strip = p.locator("[data-sticker-suggest]");
await input.fill("");
const stripReqs = [];
const onStripReq = (r) => {
  const u = r.url();
  if (u.startsWith("data:") || u.startsWith("blob:") || /sentry\.io|cloudflareinsights|\/_next\/static\//.test(u) || /\/api\/messages\/typing/.test(u)) return;
  stripReqs.push(u.slice(0, 140));
};
p.on("request", onStripReq);
await input.fill("😂");
await strip.waitFor({ timeout: 6000 }).catch(() => {});
await p.waitForTimeout(1500);
p.off("request", onStripReq);
const stripIds = await strip.locator("[data-sticker]").evaluateAll((b) => b.map((x) => x.getAttribute("data-sticker")));
const stripLayout = await p.evaluate(() => {
  const s = document.querySelector("[data-sticker-suggest]")?.getBoundingClientRect();
  const inp = document.querySelector("[data-chat-input]")?.getBoundingClientRect();
  const sc = document.querySelector(".m-scroll")?.getBoundingClientRect();
  const rows = [...document.querySelectorAll(".m-scroll .m-row")];
  const last = rows.pop()?.getBoundingClientRect();
  return { stripTop: s && Math.round(s.top), stripBottom: s && Math.round(s.bottom), stripH: s && Math.round(s.height), inputTop: inp && Math.round(inp.top), scBottom: sc && Math.round(sc.bottom), lastBottom: last && Math.round(last.bottom), lastTop: last && Math.round(last.top) };
});
// ảnh nhỏ của nhãn = được phép; GIF giả của các tin GIF có sẵn trong khung (dựng lại khi khung tin co) không do thanh gây ra
const badReqs = stripReqs.filter((u) => !/fonts\.gstatic\.com\/s\/e\/notoemoji\/17\.0\/[0-9a-f_]+\/emoji\.svg$|\/_next\/image\?url=|^https:\/\/media\.giphy\.com\/media\/mock\d+\//.test(u));
await shot(p, "t13_sticker_strip_en");
R.check("TG8", `Gõ '😂' → thanh nhãn dán phía trên ô soạn tin: ${stripIds.slice(0, 6).join(" ")} (😂 động đầu, có 🤣); không che tin cuối (thanh trong khung soạn tin); mạng chỉ ảnh nhỏ (${stripReqs.length} request)`,
  stripIds[0] === "😂" && stripIds.includes("🤣") && stripIds.length <= 12 && stripLayout.stripBottom <= stripLayout.inputTop && stripLayout.lastBottom <= stripLayout.stripTop && stripLayout.lastBottom <= stripLayout.scBottom + 1 && stripLayout.lastTop >= 0 && badReqs.length === 0,
  JSON.stringify({ stripIds, stripLayout, badReqs, stripReqs: stripReqs.slice(0, 8) }));
const lastBefore = (await thread()).pop()?.id;
await strip.locator('[data-sticker="😂"]').click();
await p.waitForTimeout(1800);
const newest = (await thread()).pop();
const valAfter = await input.inputValue();
const stripGone = (await strip.count()) === 0;
const lastStkRow = await p.locator(".m-row").last().locator('.pn-stk-box img[alt="😂"]').count();
R.check("TG8b", "Chạm nhãn 😂 trên thanh → gửi tin STICKER '😂' (hiện trong khung tin), ô soạn tin trống, thanh ẩn",
  newest?.id !== lastBefore && newest?.type === "STICKER" && newest?.content === "😂" && valAfter === "" && stripGone && lastStkRow === 1, JSON.stringify({ newest: newest && [newest.type, newest.content], valAfter, stripGone, lastStkRow }));
await input.fill("hehe 👍");
await strip.waitFor({ timeout: 4000 }).catch(() => {});
const thumbFirst = await strip.locator("[data-sticker]").first().getAttribute("data-sticker").catch(() => null);
await p.getByRole("button", { name: "Hide sticker suggestions" }).click();
await p.waitForTimeout(250);
const dismissed = (await strip.count()) === 0 && (await input.inputValue()) === "hehe 👍";
await input.fill("hehe 👍 ");
await p.waitForTimeout(250);
const stillHidden = (await strip.count()) === 0;
await input.fill("🙏");
await p.waitForTimeout(400);
const backAgain = (await strip.count()) === 1 && (await strip.locator("[data-sticker]").first().getAttribute("data-sticker")) === "🙏";
await input.fill("cảm ơn chị 🙏");
await p.waitForTimeout(300);
await strip.locator('[data-sticker="🙏"]').click();
await p.waitForTimeout(1200);
const keptText = await input.inputValue();
await input.fill("");
R.check("TG8c", "'hehe 👍' (từ cuối là 1 emoji) → thanh 👍; × ẩn (giữ chữ), gõ tiếp cùng emoji vẫn ẩn; emoji khác → hiện lại; chạm nhãn khi có chữ trước → chỉ bỏ emoji, giữ 'cảm ơn chị'",
  thumbFirst === "👍" && dismissed && stillHidden && backAgain && keptText === "cảm ơn chị", JSON.stringify({ thumbFirst, dismissed, stillHidden, backAgain, keptText }));

// ---------- Tin chỉ 1–3 emoji → hiện TO (1 emoji = nhãn động Noto chạy 1 lượt khi hiện rồi đứng) ----------
const sendText = async (t) => {
  await input.fill(t);
  await p.getByRole("button", { name: "Send message" }).click();
  await p.waitForTimeout(900);
};
await sendText("😂❤️");
await sendText("👍🏽");
const lottieSeen = [];
await input.fill("😂");
await p.getByRole("button", { name: "Send message" }).click();
for (let i = 0; i < 40; i++) {
  lottieSeen.push(await p.locator('.m-row [data-big-emoji="1"] .pn-lottie svg').count().catch(() => 0));
  if (i === 6) await shot(p, "t14_big_emoji_en");
  await p.waitForTimeout(250);
}
const big = await p.evaluate(() => {
  const rows = [...document.querySelectorAll(".m-row")];
  const info = (row) => {
    const b = row?.querySelector("[data-big-emoji]");
    if (!b) return null;
    const box = b.querySelector(".pn-stk-box")?.getBoundingClientRect();
    const txt = b.querySelector(".m-emoji-big");
    return { n: b.getAttribute("data-big-emoji"), box: box && [Math.round(box.width), Math.round(box.height)], still: !!b.querySelector('img.m-sticker-img[src*="/notoemoji/17.0/1f602/emoji.svg"]'), font: txt ? getComputedStyle(txt).fontSize : null, bubble: !!row.querySelector(".m-bubble") };
  };
  return { last: info(rows[rows.length - 1]), tone: info(rows[rows.length - 2]), two: info(rows[rows.length - 3]) };
});
const animated = Math.max(...lottieSeen) >= 1;
const endedStill = lottieSeen[lottieSeen.length - 1] === 0;
R.check("TG9", `Tin '😂' → nhãn động Noto 112px, không bong bóng, CHẠY 1 lượt khi hiện (lottie ${JSON.stringify(lottieSeen.filter((_, i) => i % 4 === 0))}) rồi đứng ở ảnh tĩnh`,
  big.last?.n === "1" && big.last.box?.join() === "112,112" && big.last.still && !big.last.bubble && animated && endedStill, JSON.stringify({ big, lottieSeen }));
R.check("TG9b", "'😂❤️' → 2 emoji to tĩnh (60px), '👍🏽' (màu da, Noto không có bản này) → emoji chữ to 92px giữ màu da; không bong bóng",
  big.two?.n === "2" && big.two.font === "60px" && !big.two.bubble && big.tone?.n === "1" && big.tone.font === "92px" && !big.tone.box && !big.tone.bubble, JSON.stringify(big));
await p.goto(BASE_URL + "/messages");
await p.locator(".m-conv").first().waitFor({ timeout: 30000 });
const prevBig = await p.locator(".m-conv", { hasText: B.me.name }).first().locator(".m-preview").innerText().catch(() => "");
R.check("TG10", "Danh sách chat: tin cuối là '😂' (chữ) → 'You: 😂' (không thành 'Sticker')", /You: 😂$/.test(prevBig.trim()), prevBig);

// ---------- Tiếng Việt (412px) + bong bóng chat Android ----------
// 1 GIF MP4 + 1 tin '😂' mới nhất (trang đầu của khung tin chỉ có 20 tin)
await post(`${GM}/mock5/200.mp4#wh=300x200&still=${encodeURIComponent(`${GM}/mock5/200_s.gif`)}`, "IMAGE");
await post("😂", "TEXT");
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, locale: "vi-VN", colorScheme: "dark", serviceWorkers: "block" });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  await ctx.route(/sentry\.io|cloudflareinsights\.com/, (r) => r.abort());
  await ctx.route(/^https:\/\/media\.giphy\.com\/media\/mock\d+\//, mockMedia);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("pn_push_dismissed_at", String(Date.now()));
      sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
    } catch {}
  });
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email: EMAIL_A, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const vp = await ctx.newPage();
  vp.on("pageerror", (e) => A.errors.push(`[vi] ${e.message.slice(0, 160)}`));
  await vp.goto(BASE_URL + `/vi/messages?to=${B.me.id}`);
  await vp.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await vp.waitForTimeout(1500);
  await shot(vp, "t15_big_emoji_vi");
  const vpanel = vp.getByRole("dialog", { name: "Chọn biểu tượng" });
  await vp.getByRole("button", { name: "Biểu tượng cảm xúc", exact: true }).click();
  await vpanel.waitFor({ timeout: 8000 });
  await vpanel.getByRole("tab", { name: "Emoji", exact: true }).click();
  const vSearch = vpanel.getByRole("textbox", { name: "Tìm emoji" });
  await vSearch.fill("tim");
  await vp.waitForTimeout(700);
  const vTim = await vpanel.locator('[data-emoji-grid="results"] [data-emoji]').evaluateAll((b) => b.map((x) => x.getAttribute("data-emoji")));
  const vLabel = await vpanel.locator("[aria-live=polite]").innerText().catch(() => "");
  await shot(vp, "t16_emoji_search_vi");
  await vSearch.fill("");
  await vp.keyboard.press("Escape");
  await vpanel.waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
  await vp.locator("[data-chat-input]").fill("😂");
  const vStrip = vp.getByRole("group", { name: "Gợi ý nhãn dán" });
  const vStripOn = await vStrip.waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
  await vp.waitForTimeout(800);
  const vSendLabel = await vStrip.locator("[data-sticker]").first().getAttribute("aria-label").catch(() => "");
  await shot(vp, "t17_sticker_strip_vi");
  await vp.locator("[data-chat-input]").fill("");
  const vGif = vp.locator(".m-media.m-gif:has([data-gif-video])").last();
  await vGif.scrollIntoViewIfNeeded().catch(() => {});
  await vp.waitForTimeout(1500);
  const vGifPlaying = await vGif.evaluate((m) => { const v = m.querySelector("video"); return !!v && !v.paused && v.currentTime > 0; }).catch(() => false);
  const vGifLabel = await vGif.locator("button").first().getAttribute("aria-label").catch(() => "");
  await shot(vp, "t18_gif_mp4_vi");
  await vp.goto(BASE_URL + "/vi/messages");
  await vp.locator(".m-conv").first().waitFor({ timeout: 30000 });
  const vPrev = await vp.locator(".m-conv", { hasText: B.me.name }).first().locator(".m-preview").innerText().catch(() => "");
  await shot(vp, "t19_list_vi");
  R.check("TG11", "Tiếng Việt: ô 'Tìm emoji' + 'tim' → ❤️ đầu, nhãn 'Kết quả'; thanh 'Gợi ý nhãn dán' với nút 'Gửi nhãn dán 😂'; GIF MP4 chạy, nút 'Mở GIF'; danh sách 'Bạn: 😂'",
    vTim[0] === "❤️" && /Kết quả/i.test(vLabel) && vStripOn && vSendLabel === "Gửi nhãn dán 😂" && vGifPlaying && vGifLabel === "Mở GIF" && /Bạn: 😂$/.test(vPrev.trim()),
    JSON.stringify({ vTim: vTim.slice(0, 6), vLabel, vStripOn, vSendLabel, vGifPlaying, vGifLabel, vPrev }));

  // bong bóng chat Android (UA PawNailBubble): emoji to + GIF MP4 vẫn đúng
  const bctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA + " PawNailApp PawNailBubble", locale: "en-US", colorScheme: "dark", serviceWorkers: "block" });
  const bh = { "cf-connecting-ip": fakeIp() };
  await bctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...bh } }));
  await bctx.route(/sentry\.io|cloudflareinsights\.com/, (r) => r.abort());
  await bctx.route(/^https:\/\/media\.giphy\.com\/media\/mock\d+\//, mockMedia);
  const bcsrf = await (await bctx.request.get(BASE_URL + "/api/auth/csrf", { headers: bh })).json();
  await bctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: bcsrf.csrfToken, email: EMAIL_A, password: DEMO_PASSWORD, json: "true" }, headers: bh });
  const bp = await bctx.newPage();
  bp.on("pageerror", (e) => A.errors.push(`[bubble] ${e.message.slice(0, 160)}`));
  await bp.goto(BASE_URL + `/messages?c=${conv1}&bubble=1`);
  await bp.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await bp.waitForTimeout(2000);
  const bState = await bp.evaluate(() => {
    const rows = [...document.querySelectorAll(".m-row")];
    const b = rows[rows.length - 1]?.querySelector('[data-big-emoji="1"] .pn-stk-box')?.getBoundingClientRect();
    return { bubbleAttr: document.documentElement.hasAttribute("data-bubble"), big: b && [Math.round(b.width), Math.round(b.height)] };
  });
  await shot(bp, "t20_bubble_mode");
  const bGif = bp.locator(".m-media.m-gif:has([data-gif-video])").last();
  await bGif.scrollIntoViewIfNeeded().catch(() => {});
  await bp.waitForTimeout(1500);
  const bGifPlaying = await bGif.evaluate((m) => { const v = m.querySelector("video"); return !!v && !v.paused && v.currentTime > 0; }).catch(() => false);
  R.check("TG12", "Bong bóng chat Android (UA PawNailBubble): emoji to 112px + GIF MP4 chạy như trong app", bState.bubbleAttr && bState.big?.join() === "112,112" && bGifPlaying, JSON.stringify({ bState, bGifPlaying }));
  await bctx.close();
  await ctx.close();
}

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
const tileSize = await sheet.evaluate((d) => {
  const add = d.querySelector("[data-testid=wp-photo-tile] .pn-wp-swatch")?.getBoundingClientRect();
  const first = d.querySelector("button[data-wp] .pn-wp-swatch")?.getBoundingClientRect();
  return { add: add && [Math.round(add.width), Math.round(add.height)], preset: first && [Math.round(first.width), Math.round(first.height)], sameRow: !!add && !!first && Math.abs(add.top - first.top) < 2 };
});
R.check("CM12", "Chat 1-1: menu ⋮ → 'Chat wallpaper' → 16 nền + ô 'Add photo' cùng cỡ, cùng hàng đầu với các ô nền", presets === 16 && photoTile === 1 && tileSize.sameRow && tileSize.add?.join() === tileSize.preset?.join(), JSON.stringify({ presets, photoTile, tileSize }));
// chọn nền ở nhóm cuối (Gradients) → thẻ xem trước vẫn nằm trọn trong màn hình (chỉ các ô nền cuộn)
const dusk = sheet.locator('button[data-wp="dusk"]');
await dusk.scrollIntoViewIfNeeded();
await dusk.click();
await p.waitForTimeout(250);
const pv = await sheet.getByTestId("wp-preview").evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, id: el.getAttribute("data-wallpaper"), scrolled: document.querySelector("[data-testid=wp-scroll]")?.scrollTop ?? -1 };
});
R.check("CM12b", "Chọn 'Dusk' (nhóm Gradients, phải cuộn) → thẻ xem trước vẫn thấy trọn + đổi sang Dusk", pv.id === "dusk" && pv.top >= 0 && pv.bottom <= pv.vh && pv.scrolled > 0, JSON.stringify(pv));
await shot(p, "t08b_wallpaper_dusk_preview");
await sheet.getByRole("button", { name: "Cancel" }).click();
sheet = await openSheet();
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

// xoá ảnh đã lưu (nút ×): khỏi IndexedDB + nền về như trước
sheet = await openSheet();
await sheet.getByTestId("wp-photo-delete").first().click();
await p.waitForTimeout(400);
const tilesLeft = await sheet.locator("[data-wp-photo]").count();
await sheet.getByRole("button", { name: "Cancel" }).click();
await p.waitForTimeout(400);
const idbAfter = await p.evaluate(
  (uid) =>
    new Promise((res) => {
      const rq = indexedDB.open("pn-local", 1);
      rq.onsuccess = () => {
        const k = rq.result.transaction("wallpapers", "readonly").objectStore("wallpapers").getAllKeys();
        k.onsuccess = () => res(k.result.map(String).filter((x) => x.startsWith(uid + ":")).length);
      };
      rq.onerror = () => res(-1);
    }),
  A.me.id
);
const afterDel = await wpAttr();
R.check("CM18", "Nút × trên ảnh đã lưu: xoá khỏi máy (IndexedDB) + bỏ khỏi bảng; nền không còn là ảnh", tilesLeft === 0 && idbAfter === 0 && afterDel.tone !== "photo", JSON.stringify({ tilesLeft, idbAfter, afterDel }));

R.check("CM17", "Không có lỗi JS", !A.errors.length && !B.errors.length, JSON.stringify([...A.errors, ...B.errors]).slice(0, 300));
await browser.close();
const sum = R.summary();
if (SHOTS) fs.writeFileSync(path.join(SHOTS, "chat_media_results.json"), JSON.stringify(sum, null, 2));
process.exit(sum.failed ? 1 : 0);
