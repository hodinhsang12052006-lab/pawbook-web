// Nhãn dán / GIF / hình nền trong Messenger — điện thoại Android 412×915 (cảm ứng, isMobile), tiếng Anh.
// CHỈ chạy với server local (scripts/qa/lib.mjs chặn bitpawos.com). Không cần khoá GIPHY: máy chủ không có khoá → MỌI lối
// vào GIF bị ẩn (tab GIF, mục GIF ở menu "+", nút "Search GIFs for …"); phần GIF có kết quả dùng /api/gifs GIẢ LẬP (route
// intercept, kể cả ?probe=1) + ảnh giả trên media.giphy.com.
// Bảng mở trên điện thoại nằm TRONG khung soạn tin: tin vừa gửi (bảng vẫn mở) phải thấy được, không bị bảng che.
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
const mockResults = (q) => dims.map(([w, h], i) => ({ id: `g_mock${q}${i}`, send: `https://media.giphy.com/media/mock${i}/200w.webp#wh=${w}x${h}`, preview: `https://media.giphy.com/media/mock${i}/200w.webp`, w, h, title: `mock ${i}` }));
// Ảnh GIF giả + /api/gifs giả: đăng ký NGAY khi tạo phiên (trước mọi request); /api/gifs chỉ giả khi mockGifs = true.
let mockGifs = false;
await A.ctx.route(/^https:\/\/media\.giphy\.com\/media\/mock\d+\//, (r) => {
  const i = Number(/mock(\d+)/.exec(r.request().url())?.[1] || 0);
  const [w, h] = dims[i] || [200, 200];
  r.fulfill({ status: 200, headers: { "content-type": "image/svg+xml", "access-control-allow-origin": "*" }, body: mockSvg(i, w, h) });
});
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

// cuộn hết vùng cuộn (từng đoạn ~ 2/3 khung) → ảnh của MỌI mục tải được thật (naturalWidth > 0)
const sections = await panel(p).locator("[data-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-section")));
const scroller = panel(p).getByTestId("sticker-scroll");
for (let i = 0; i < 80; i++) {
  const done = await scroller.evaluate((el) => {
    el.scrollTop += Math.round(el.clientHeight * 0.66);
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  });
  await p.waitForTimeout(160);
  if (done) break;
}
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
const openedOn = await panel(p).getByRole("tab", { selected: true }).innerText().catch(() => "");
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
await panel(p).locator('img[alt="GIF"]').first().waitFor({ timeout: 8000 }).catch(() => {});
const powered = await panel(p).getByTestId("gif-attribution").isVisible().catch(() => false);
const tilesN = await panel(p).locator('img[alt="GIF"]').count();
const cols = await panel(p).locator(".pn-gif-cols").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length).catch(() => 0);
R.check("CM9b", `GIF có khoá (giả lập): mục 'Insert GIF' ở menu '+' hiện lại; lưới ${cols} cột ở màn 412px (3 khi bảng ≥ 340px)`, attachGifOn === 1 && cols === 3, JSON.stringify({ attachGifOn, cols }));
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
R.check("CM10", "GIF (API giả lập): 'Powered by GIPHY' hiện, có ô GIF; gửi → bong bóng giữ đúng tỉ lệ 480×270 (≤ 240px, contain, nhãn GIF), bảng vẫn mở", powered && tilesN >= 4 && ratioOk && gifBubble.fit === "contain" && gifBubble.chip && gifStill, JSON.stringify({ powered, tilesN, gifBubble, gifStill, gifFails }));
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
R.check("CM11", "Danh sách chat: tin cuối là GIF → 'You: GIF' (không còn '📷 Photo')", /You: GIF/.test(prevGif), prevGif);
mockGifs = false;
await p.evaluate(() => sessionStorage.removeItem("pn_gif_on"));

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
