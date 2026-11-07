// Khung chat KHÔNG "lệch" khi máy lag (lỗi chủ app báo trên điện thoại Android, 11/2026): khung tin / bong bóng / ô soạn tin /
// thanh trên / bảng biểu tượng không lệch, không chồng nhau, không nhảy, không sai chiều cao — kể cả khi CPU chậm 6×, mạng chậm,
// gõ nhanh, gửi liền nhiều tin, bàn phím mở / đóng (WebView Android adjustResize = cửa sổ co lại + WebView tự cuộn ô nhập vào
// tầm nhìn), mở bảng Nhãn dán / GIF, tin đến khi đang cuộn, xoay máy, quay lại từ nền, chế độ bong bóng chat.
// Mỗi bước: đo hộp (getBoundingClientRect) rồi kiểm các BẤT BIẾN:
//   - thanh trên dính đỉnh (top = 0), ô soạn tin dính đáy (bottom = innerHeight), khung tin nằm khít giữa 2 khung đó;
//   - không khung bao nào bị cuộn (scrollTop / scrollLeft ≠ 0 — "lệch" khi WebView cuộn ô nhập vào tầm nhìn), trang không cuộn;
//   - bong bóng không chồng nhau, mép phải tin mình / mép trái tin bạn thẳng hàng, không tràn ngang;
//   - hết hiệu ứng thì không còn transform sót; đang ở đáy thì tin cuối thấy trọn (không bị khung soạn tin / thanh gợi ý che).
// Tin đến: server local không có Pusher → test bắn sự kiện "online" của trình duyệt (đường đồng bộ lại có sẵn của app: tải lại
// trang tin mới nhất rồi ghép vào) — tin THẬT phải hiện trong khung (kiểm tra, không bỏ qua) và chỗ đang đọc không được nhảy.
// CHỈ chạy với server local (lib.mjs chặn bitpawos.com).
//   BASE_URL=http://localhost:3147 [CPU=6] [WIDTHS=412,360] [SHOTS_DIR=…] node scripts/qa/chat_jank_test.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, Results, fakeIp } from "./lib.mjs";

const R = new Results("Khung chat dưới tải nặng (CPU chậm, mạng chậm)");
const CPU = Number(process.env.CPU || 6);
const WIDTHS = (process.env.WIDTHS || "412,360").split(",").map(Number);
const SHOTS = process.env.SHOTS_DIR || "";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
// Bong bóng chat Android: WebView của BubbleActivity thêm "PawNailBubble" vào User-Agent (lib/bubbleMode.ts)
const BUBBLE_UA = ANDROID_UA + " PawNailBubble/1";
const KB = 0.38; // bàn phím ảo ≈ 38% chiều cao màn hình

const browser = await chromium.launch();
async function login(email, { w = 412, h = 915, ua = ANDROID_UA, phone = true } = {}) {
  const ctx = await browser.newContext(
    phone
      ? { viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ua, locale: "en-US", colorScheme: "dark", serviceWorkers: "block" }
      : { viewport: { width: 1280, height: 860 }, locale: "en-US", serviceWorkers: "block" }
  );
  const hd = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...hd } }));
  await ctx.route(/sentry\.io|cloudflareinsights\.com/, (r) => r.abort());
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
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, me, h: hd, errors };
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});

// ---------- Đo hình học + bất biến (chạy trong trang) ----------
function measure() {
  const H = window.innerHeight;
  const col = document.querySelector(".chat-wallpaper");
  const head = col?.querySelector(":scope > .pn-glass-bar");
  const sc = col?.querySelector(".m-scroll");
  const comp = col?.querySelector(".pn-composer");
  const box = (e) => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const f = (n) => Math.round(n * 10) / 10;
    return { t: f(r.top), b: f(r.bottom), l: f(r.left), r: f(r.right), h: f(r.height) };
  };
  const out = { H, W: window.innerWidth, problems: [] };
  const P = (s) => out.problems.push(s);
  if (!col || !head || !sc || !comp) {
    P(`missing ${!col ? "column " : ""}${!head ? "header " : ""}${!sc ? "scroll " : ""}${!comp ? "composer" : ""}`);
    return out;
  }
  const hb = box(head), sb = box(sc), cb = box(comp);
  Object.assign(out, { head: hb, sc: sb, comp: cb });
  // 1) khung bao bị cuộn (WebView cuộn ô nhập vào tầm nhìn khi bàn phím mở trễ) / trang bị cuộn
  for (let n = comp.parentElement; n; n = n.parentElement) {
    if (n.scrollTop || n.scrollLeft) P(`shell scrolled: ${n.tagName.toLowerCase()}.${String(n.className).split(" ")[0]} ${n.scrollTop}/${n.scrollLeft}`);
  }
  if (window.scrollY || window.scrollX) P(`window scrolled ${window.scrollX},${window.scrollY}`);
  const vv = window.visualViewport;
  if (vv && Math.abs(vv.offsetTop) > 1) P(`visualViewport offsetTop ${vv.offsetTop}`);
  // 2) thanh trên dính đỉnh, ô soạn tin dính đáy, khung tin khít giữa
  if (Math.abs(hb.t) > 1) P(`header top ${hb.t}`);
  if (Math.abs(cb.b - H) > 1.5) P(`composer bottom ${cb.b} ≠ viewport ${H}`);
  if (Math.abs(sb.t - hb.b) > 1.5) P(`thread top ${sb.t} ≠ header bottom ${hb.b}`);
  if (Math.abs(sb.b - cb.t) > 1.5) P(`thread bottom ${sb.b} ≠ composer top ${cb.t}`);
  if (sb.h < 40) P(`thread squashed to ${sb.h}px`);
  // cột chat không rộng hơn màn hình (nội dung rộng — thanh bộ nhãn dán, ảnh, link dài — không được kéo giãn cột rồi bị cắt)
  const cr = col.getBoundingClientRect();
  if (window.innerWidth < 768 && (Math.abs(cr.width - window.innerWidth) > 1 || cr.left < -1)) P(`chat column ${Math.round(cr.left)}..${Math.round(cr.right)} ≠ viewport ${window.innerWidth}`);
  if (cb.r > window.innerWidth + 1 || hb.r > window.innerWidth + 1) P(`header/composer wider than the screen (${hb.r}/${cb.r} > ${window.innerWidth})`);
  if (sc.scrollWidth > sc.clientWidth + 1) P(`thread overflows sideways ${sc.scrollWidth}>${sc.clientWidth}`);
  // 3) bong bóng: chồng nhau / lệch hàng / transform sót
  const cs = getComputedStyle(sc);
  const left = sb.l + parseFloat(cs.paddingLeft);
  const right = sb.r - parseFloat(cs.paddingRight);
  const rows = [...sc.querySelectorAll(":scope > .m-row, :scope > * > .m-row")];
  const items = [];
  for (const row of rows) {
    const bubble = row.querySelector(".m-bubble, .m-media, .m-bare, .m-call, .pn-stk-box, .m-sticker-chip") || null;
    if (!bubble || row.classList.contains("m-system")) continue;
    const b = box(bubble);
    if (b.b < sb.t || b.t > sb.b) continue; // ngoài khung nhìn
    const mine = row.classList.contains("justify-end");
    const failed = !!row.querySelector('[aria-label*="Retry"], [aria-label*="Thử lại"]');
    items.push({ b, mine, failed, txt: (bubble.textContent || "").trim().slice(0, 18) });
    const anim = row.getAnimations ? row.getAnimations({ subtree: false }).filter((a) => a.playState === "running").length : 0;
    const tf = getComputedStyle(row).transform;
    if (!anim && tf && tf !== "none") P(`row transform stuck: ${tf} "${(row.textContent || "").trim().slice(0, 16)}"`);
    if (b.r > sb.r + 0.5 || b.l < sb.l - 0.5) P(`bubble outside thread "${(bubble.textContent || "").trim().slice(0, 16)}" ${b.l}-${b.r}`);
  }
  items.sort((a, b) => a.b.t - b.b.t);
  for (let i = 1; i < items.length; i++) {
    if (items[i].b.t < items[i - 1].b.b - 1) P(`overlap "${items[i - 1].txt}" (${items[i - 1].b.t}-${items[i - 1].b.b}) × "${items[i].txt}" (${items[i].b.t}-${items[i].b.b})`);
  }
  for (const it of items) {
    if (it.mine && !it.failed && Math.abs(it.b.r - right) > 1.5) P(`own bubble not right-aligned "${it.txt}" r=${it.b.r} vs ${right}`);
    if (!it.mine && Math.abs(it.b.l - left) > 1.5 && Math.abs(it.b.l - (left + 36)) > 1.5) P(`incoming bubble not left-aligned "${it.txt}" l=${it.b.l} vs ${left}`);
  }
  // 4) đang ở đáy → tin cuối thấy trọn
  const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 4;
  out.nearBottom = nearBottom;
  out.dist = Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight);
  const last = items[items.length - 1];
  if (nearBottom && last && last.b.b > sb.b + 1) P(`last bubble hidden under composer (${last.b.b} > ${sb.b})`);
  out.lastTxt = last?.txt;
  return out;
}

// Chờ yên: không còn hiệu ứng chạy trên các dòng tin, khung tin không còn cuộn mượt, hình học 2 lần đo liên tiếp giống nhau.
async function settle(page, maxMs = 6000) {
  const t0 = Date.now();
  let prev = "";
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => {
      const sc = document.querySelector(".m-scroll");
      const anims = document.getAnimations ? document.getAnimations().filter((a) => a.playState === "running" && a.effect?.target?.closest?.(".pn-msgr") && !(a.effect.getTiming?.().iterations === Infinity)).length : 0;
      const c = document.querySelector(".pn-composer")?.getBoundingClientRect();
      return JSON.stringify([anims, sc && Math.round(sc.scrollTop), sc && sc.scrollHeight, c && Math.round(c.top), innerHeight]);
    });
    if (s === prev && JSON.parse(s)[0] === 0) return Date.now() - t0;
    prev = s;
    await page.waitForTimeout(160);
  }
  return -1;
}
const check = async (page, label, extra = []) => {
  await settle(page);
  const g = await page.evaluate(measure);
  return { label, problems: [...extra, ...g.problems], g };
};

// Bàn phím ảo kiểu WebView Android (adjustResize): cửa sổ co lại; khi máy lag, WebView cuộn ô nhập vào tầm nhìn theo khung hình CŨ
// (trước khi trang kịp bố cục lại) → cuộn mọi khung bao của ô nhập (kể cả overflow:hidden) đúng bằng phần bị bàn phím che.
async function keyboard(page, open, w, fullH) {
  const h = open ? Math.round(fullH * (1 - KB)) : fullH;
  if (open) {
    await page.locator("[data-chat-input]").focus();
    // phần ô nhập bị che theo bố cục cũ, rồi "cuộn vào tầm nhìn" như WebView (từ ô nhập lên tới gốc)
    await page.evaluate((visibleH) => {
      const input = document.querySelector("[data-chat-input]");
      const hidden = input.getBoundingClientRect().bottom - visibleH;
      if (hidden <= 0) return;
      for (let n = input.parentElement; n; n = n.parentElement) {
        const st = getComputedStyle(n);
        if (n === document.body || n === document.documentElement) break;
        if (/(auto|scroll|hidden)/.test(st.overflowY)) n.scrollTop += hidden; // không có tác dụng với overflow: clip / visible
      }
      window.scrollBy(0, hidden);
    }, h);
  }
  await page.setViewportSize({ width: w, height: h });
  // vài khung hình đầu sau khi đổi cỡ (CPU chậm): thanh trên / ô soạn tin không được nhảy khỏi chỗ
  const mid = [];
  for (const d of [0, 60, 180]) {
    if (d) await page.waitForTimeout(d);
    mid.push(await page.evaluate(() => {
      const hb = document.querySelector(".chat-wallpaper > .pn-glass-bar")?.getBoundingClientRect();
      const cb = document.querySelector(".pn-composer")?.getBoundingClientRect();
      return { ht: Math.round(hb?.top ?? -999), cb: Math.round(cb?.bottom ?? -999), H: innerHeight };
    }));
  }
  return mid.filter((m) => Math.abs(m.ht) > 1 || Math.abs(m.cb - m.H) > 2).map((m) => `mid-resize header ${m.ht} / composer ${m.cb} vs ${m.H}`);
}

async function throttle(page, on) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: on ? CPU : 1 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", on ? { offline: false, latency: 250, downloadThroughput: 200 * 1024, uploadThroughput: 100 * 1024 } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  return cdp;
}

// ---------- Chuẩn bị: 2 người, ~28 tin (dài / ngắn / emoji / nhãn dán) ----------
const B = await login(SEED_TECH, { phone: false });
const stamp = Date.now().toString().slice(-6);
const A0 = await login(SEED_OWNER);
const send = (who, to, content, type) => who.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: to, content, ...(type ? { type } : {}) }, headers: who.h });
const lines = [
  `Jank test ${stamp}`, "Hi! Are you free on Saturday afternoon for a full set?", "Yes 🙂", "What time works?",
  "Around 2pm. I'd like almond shape, medium length, with a soft pink ombré and a little bit of chrome on the ring finger — is that doable in about 90 minutes?",
  "😂", "Sure, that works", "👍🏽❤️", "Great, see you then", "Also can you do a quick gel removal first? My old set is three weeks old.",
  "No problem", "ok", "Perfect 💅", "Thanks!",
];
let seeded = 0;
for (let i = 0; i < 28; i++) {
  const mine = i % 3 !== 1;
  const r = await send(mine ? A0 : B, mine ? B.me.id : A0.me.id, i === 9 ? "💅" : lines[i % lines.length] + (i > 13 ? ` #${i}` : ""), i === 9 ? "STICKER" : undefined);
  if (r.status() === 201) seeded++;
}
R.check("J0", `Chuẩn bị cuộc trò chuyện: ${seeded}/28 tin`, seeded >= 24, String(seeded));
await A0.ctx.close();

const allProblems = [];
for (const W of WIDTHS) {
  const FULL = W === 360 ? 780 : 915;
  const tagW = `${stamp}-${W}`; // tin của từng bề rộng riêng (cùng 1 cuộc trò chuyện cho cả 2 lượt)
  const A = await login(SEED_OWNER, { w: W, h: FULL });
  const p = A.page;
  await p.goto(BASE_URL + `/messages?to=${B.me.id}`);
  await p.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await p.locator(".m-row").last().waitFor({ timeout: 20000 });
  await throttle(p, true);
  const steps = [];
  const add = async (label, extra) => steps.push(await check(p, `${W}px · ${label}`, extra));

  await add("open thread");
  await shot(p, `j${W}_01_open`);
  // Gốc lỗi "lệch": khung bao của ô soạn tin cuộn được (overflow: hidden vẫn là khung cuộn) → WebView lag cuộn nó khi đưa ô nhập
  // lên trên bàn phím. Thử cuộn thẳng từng khung bao: phải đứng yên (overflow: clip) — kể cả khi nội dung tràn (màn ngang thấp).
  const probeShells = () => p.evaluate(() => {
    const moved = [];
    for (let n = document.querySelector(".pn-composer")?.parentElement; n && n !== document.body; n = n.parentElement) {
      n.scrollTop = 120;
      n.scrollLeft = 40;
      if (n.scrollTop || n.scrollLeft) moved.push(`${n.tagName.toLowerCase()}.${String(n.className).split(" ")[0]} scrollable (${n.scrollTop}/${n.scrollLeft}, ${getComputedStyle(n).overflowY})`);
      n.scrollTop = 0;
      n.scrollLeft = 0;
    }
    return moved;
  });
  steps.push(await check(p, `${W}px · shells cannot be scrolled`, await probeShells()));
  // Trang /messages: bàn phím CO trang (Chrome / Firefox Android) thay vì phủ lên rồi kéo cả trang lên
  const vpMeta = await p.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute("content") || "");
  if (!/interactive-widget=resizes-content/.test(vpMeta)) steps.push({ label: `${W}px · viewport meta`, problems: [`viewport meta lacks interactive-widget=resizes-content: ${vpMeta}`] });
  // Tin cuối cao thêm sau khi đã hiện (bản dịch / cảm xúc / ảnh tải chậm) → vẫn thấy trọn, không bị khung soạn tin che
  await p.evaluate(() => {
    const rows = document.querySelectorAll(".m-scroll > .m-row");
    const col = rows[rows.length - 1]?.querySelector(".m-col");
    if (col) col.style.paddingBottom = "56px";
  });
  await settle(p);
  const tailGrow = await p.evaluate(() => {
    const sc = document.querySelector(".m-scroll");
    const rows = sc.querySelectorAll(":scope > .m-row");
    const last = rows[rows.length - 1].getBoundingClientRect();
    const limit = sc.getBoundingClientRect().bottom - parseFloat(getComputedStyle(sc).paddingBottom) + 1;
    rows[rows.length - 1].querySelector(".m-col").style.paddingBottom = "";
    return last.bottom <= limit ? [] : [`last row grew but stayed hidden under the composer (${Math.round(last.bottom)} > ${Math.round(limit)})`];
  });
  steps.push({ label: `${W}px · last message grows after render`, problems: tailGrow });

  // gõ nhanh 1 đoạn dài (ô nhập cao thêm nhiều dòng) rồi xoá
  const input = p.locator("[data-chat-input]");
  await input.click();
  await input.pressSequentially("Typing quickly on a slow phone so the composer grows to several lines while the thread stays pinned ok", { delay: 4 });
  await add("rapid typing (multi-line composer)");
  await input.fill("");
  await add("composer cleared");

  // gửi 5 tin liền (không chờ) — tin tạm → tin thật đổi chỗ không được làm lệch / chồng
  for (let i = 1; i <= 5; i++) {
    await input.fill(`fast ${i} ${tagW}${i === 3 ? " — a longer one that wraps onto a second line for sure" : ""}`);
    await p.getByRole("button", { name: "Send message" }).click(); // điện thoại: Enter = xuống dòng
  }
  await p.getByText(`fast 5 ${tagW}`).last().waitFor({ timeout: 20000 });
  await add("5 messages sent back-to-back");

  // bàn phím mở / đóng (adjustResize + WebView cuộn ô nhập vào tầm nhìn)
  steps.push({ ...(await check(p, `${W}px · keyboard open`, await keyboard(p, true, W, FULL))) });
  await shot(p, `j${W}_02_keyboard`);
  await input.fill("😂");
  await add("keyboard open + sticker strip");
  await input.fill("");
  steps.push({ ...(await check(p, `${W}px · keyboard closed`, await keyboard(p, false, W, FULL))) });

  // bảng Nhãn dán (mở trong khung soạn tin) + bàn phím
  await p.getByRole("button", { name: "Emoji", exact: true }).click();
  await p.getByRole("dialog", { name: "Pick emoji" }).waitFor({ timeout: 15000 });
  await add("emoji panel open");
  // Tab Emoji: tìm khi bàn phím mở (cửa sổ còn 58%) → lưới kết quả ≥ 2 hàng (bỏ dòng nhãn + thanh nhóm khi tìm), khung tin ≥ 40px
  {
    const dlg = p.getByRole("dialog", { name: "Pick emoji" });
    await dlg.getByRole("tab", { name: "Emoji", exact: true }).click();
    const es = dlg.getByRole("textbox", { name: "Search emoji" });
    await es.waitFor({ timeout: 15000 });
    await es.focus();
    await p.setViewportSize({ width: W, height: Math.round(FULL * 0.58) });
    await es.pressSequentially("heart", { delay: 40 });
    const got = await dlg.locator('[data-emoji-set="results"] [data-emoji]').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    const st = await check(p, `${W}px · emoji search with keyboard open`);
    const g = await p.evaluate(() => {
      const grid = document.querySelector("[data-emoji-grid]")?.getBoundingClientRect();
      const cells = [...document.querySelectorAll('[data-emoji-set="results"] [data-emoji]')].map((c) => c.getBoundingClientRect());
      const full = grid ? cells.filter((c) => c.top >= grid.top - 0.5 && c.bottom <= grid.bottom + 0.5 && c.height > 20).length : 0;
      return { gridH: grid ? Math.round(grid.height) : 0, full, first: document.querySelector('[data-emoji-set="results"] [data-emoji]')?.getAttribute("data-emoji") };
    });
    if (!got) st.problems.push("emoji search 'heart' showed no results");
    if (g.gridH < 80) st.problems.push(`emoji results grid only ${g.gridH}px tall with the keyboard open`);
    if (g.full < 8) st.problems.push(`only ${g.full} emoji fully visible with the keyboard open`);
    st.label += ` (grid ${g.gridH}px, ${g.full} visible, thread ${st.g.sc?.h}px)`;
    steps.push(st);
    await shot(p, `j${W}_03b_emoji_search_keyboard`);
    await es.fill("");
    await p.setViewportSize({ width: W, height: FULL });
  }
  await p.getByRole("dialog", { name: "Pick emoji" }).getByRole("tab", { name: "Stickers" }).click();
  await p.getByRole("dialog", { name: "Pick emoji" }).getByRole("textbox", { name: "Search stickers" }).waitFor({ timeout: 15000 });
  await add("stickers tab open (wide pack bar)");
  steps.push({ ...(await check(p, `${W}px · panel open + keyboard`, await keyboard(p, true, W, FULL))) });
  await shot(p, `j${W}_03_panel_keyboard`);
  steps.push({ ...(await check(p, `${W}px · panel open, keyboard closed`, await keyboard(p, false, W, FULL))) });
  await p.keyboard.press("Escape");
  await p.getByRole("dialog", { name: "Pick emoji" }).waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  await add("panel closed");

  // tin đến khi đang cuộn lên đọc tin cũ (giữ chỗ đang đọc, không nhảy)
  await p.evaluate(() => {
    const sc = document.querySelector(".m-scroll");
    sc.scrollTop = Math.max(0, sc.scrollHeight - sc.clientHeight - 700);
  });
  await p.waitForTimeout(300);
  const rowWith = (t) => p.locator(".m-scroll .m-row").filter({ hasText: t });
  const arrive = async (texts) => {
    for (const t of texts) {
      const r = await send(B, A.me.id, t);
      if (r.status() !== 201) return [`could not send "${t}" (${r.status()})`];
    }
    await p.evaluate(() => window.dispatchEvent(new Event("online"))); // = mạng có lại → app tải lại tin mới nhất
    return [];
  };
  // (a) vừa cuộn vừa nhận: 3 tin tới trong lúc ngón tay đang cuộn lên
  const recvA = await arrive([1, 2, 3].map((i) => `incoming ${i} ${tagW}`));
  for (let i = 0; i < 6; i++) {
    await p.mouse.move(W / 2, 400);
    await p.mouse.wheel(0, -40);
    await p.waitForTimeout(80);
  }
  const gotA = await rowWith(`incoming 3 ${tagW}`).last().waitFor({ state: "attached", timeout: 25000 }).then(() => true).catch(() => false);
  const nA = await p.evaluate((s) => [...document.querySelectorAll(".m-scroll .m-row")].filter((r) => /incoming [123] /.test(r.textContent || "") && (r.textContent || "").includes(s)).length, tagW);
  const stA = await check(p, `${W}px · messages arrive while scrolling up`, [...recvA, ...(gotA && nA === 3 ? [] : [`incoming messages not in the thread (${nA}/3)`])]);
  steps.push(stA);
  // (b) đứng yên đọc: 2 tin nữa tới → dòng đang đọc giữ nguyên chỗ trên màn hình, hiện nút "xuống tin mới nhất"
  const anchorBefore = await p.evaluate(() => {
    const sc = document.querySelector(".m-scroll");
    const r = sc.getBoundingClientRect();
    const mid = (r.top + r.bottom) / 2;
    const row = [...sc.querySelectorAll(".m-row")].find((x) => { const b = x.getBoundingClientRect(); return b.top <= mid && b.bottom >= mid; }) || sc.querySelector(".m-row");
    window.__pnAnchor = row;
    return { top: row.getBoundingClientRect().top, st: sc.scrollTop, dist: sc.scrollHeight - sc.scrollTop - sc.clientHeight };
  });
  const recvB = await arrive([4, 5].map((i) => `incoming ${i} ${tagW}`));
  const gotB = await rowWith(`incoming 5 ${tagW}`).last().waitFor({ state: "attached", timeout: 25000 }).then(() => true).catch(() => false);
  const stB = await check(p, `${W}px · messages arrive while reading older ones`, [...recvB, ...(gotB ? [] : ["incoming 4–5 not in the thread"])]);
  const anchorAfter = await p.evaluate(() => ({ top: window.__pnAnchor?.isConnected ? window.__pnAnchor.getBoundingClientRect().top : null }));
  if (anchorAfter.top === null || Math.abs(anchorAfter.top - anchorBefore.top) > 2) stB.problems.push(`reading position moved: row at ${Math.round(anchorBefore.top)} → ${anchorAfter.top === null ? "gone" : Math.round(anchorAfter.top)}`);
  const jumpBtn = await p.getByRole("button", { name: "Jump to latest" }).isVisible().catch(() => false);
  if (!jumpBtn) stB.problems.push("no 'Jump to latest' button after messages arrived below");
  stB.label += ` (dist ${Math.round(anchorBefore.dist)}px)`;
  steps.push(stB);
  // nút "xuống tin mới nhất" → về đáy, thấy tin đến
  if (jumpBtn) await p.getByRole("button", { name: "Jump to latest" }).click();
  else await p.evaluate(() => { const sc = document.querySelector(".m-scroll"); sc.scrollTop = sc.scrollHeight; });
  await settle(p);
  const lastTxt = await p.evaluate(() => [...document.querySelectorAll(".m-scroll .m-row")].pop()?.textContent || "");
  await add("back at bottom with new messages", lastTxt.includes(`incoming 5 ${tagW}`) ? [] : [`last row is not the newest message: "${lastTxt.slice(0, 40)}"`]);

  // xoay máy (ngang rồi dọc) — ô soạn tin + bàn phím ở màn ngang thấp
  await p.setViewportSize({ width: FULL, height: W });
  await add("rotated to landscape");
  steps.push({ ...(await check(p, `${W}px · landscape + keyboard`, await keyboard(p, true, FULL, W))) });
  steps.push(await check(p, `${W}px · landscape + keyboard: shells cannot be scrolled`, await probeShells()));
  await shot(p, `j${W}_04_landscape_keyboard`);
  await keyboard(p, false, FULL, W);
  await p.setViewportSize({ width: W, height: FULL });
  await add("rotated back to portrait");

  // quay lại từ nền (đóng băng trang, có tin mới trong lúc đó)
  const cdp = await p.context().newCDPSession(p);
  await p.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
  await send(B, A.me.id, `while away ${tagW}`);
  await new Promise((r) => setTimeout(r, 1500));
  await cdp.send("Page.setWebLifecycleState", { state: "active" });
  await p.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
  });
  const gotAway = await rowWith(`while away ${tagW}`).last().waitFor({ state: "attached", timeout: 25000 }).then(() => true).catch(() => false);
  await add("returned from background", gotAway ? [] : ["message sent while in the background never appeared"]);
  await shot(p, `j${W}_05_back`);

  for (const s of steps) {
    if (s.problems.length) allProblems.push(`${s.label}: ${s.problems.slice(0, 4).join(" | ")}`);
  }
  const bad = steps.filter((s) => s.problems.length);
  R.check(`J${W}`, `${W}px Android, CPU ×${CPU}, mạng chậm: ${steps.length} bước (gõ nhanh, gửi liền 5 tin, bàn phím mở/đóng, bảng nhãn dán, tin đến khi cuộn, xoay máy, quay lại từ nền) — không lệch / chồng / nhảy`,
    !bad.length, bad.map((s) => `${s.label}: ${s.problems.slice(0, 3).join(" | ")}`).join(" || "));
  R.check(`J${W}e`, `${W}px: không có lỗi JS`, !A.errors.length, A.errors.join(" | "));
  await A.ctx.close();
}

// Bong bóng chat Android (cửa sổ nhỏ ~ 360×640, UA PawNailBubble) + bàn phím
{
  const A = await login(SEED_OWNER, { w: 360, h: 640, ua: BUBBLE_UA });
  const p = A.page;
  const conv = (await (await A.ctx.request.get(BASE_URL + "/api/messages", { headers: A.h })).json()).conversations?.find((c) => !c.isGroup && c.participants?.some((u) => u.id === B.me.id));
  await p.goto(BASE_URL + `/messages?c=${conv?.id}`);
  await p.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await p.locator(".m-row").last().waitFor({ timeout: 20000 });
  await throttle(p, true);
  const steps = [await check(p, "bubble · open")];
  steps.push(await check(p, "bubble · keyboard open", await keyboard(p, true, 360, 640)));
  await p.locator("[data-chat-input]").fill(`bubble ${stamp}`);
  await p.getByRole("button", { name: "Send message" }).click();
  await p.getByText(`bubble ${stamp}`).last().waitFor({ timeout: 20000 }).catch(() => {});
  steps.push(await check(p, "bubble · sent with keyboard open"));
  await shot(p, "j_bubble_keyboard");
  steps.push(await check(p, "bubble · keyboard closed", await keyboard(p, false, 360, 640)));
  const bad = steps.filter((s) => s.problems.length);
  R.check("JB", "Bong bóng chat Android (360×640, CPU chậm): bàn phím mở/đóng + gửi tin — không lệch", !bad.length, bad.map((s) => `${s.label}: ${s.problems.slice(0, 3).join(" | ")}`).join(" || "));
  R.check("JBe", "Bong bóng: không có lỗi JS", !A.errors.length, A.errors.join(" | "));
  await A.ctx.close();
}

await browser.close();
if (allProblems.length) console.log("\n" + allProblems.join("\n"));
const sum = R.summary();
if (SHOTS) fs.writeFileSync(path.join(SHOTS, "chat_jank_results.json"), JSON.stringify({ ...sum, allProblems }, null, 2));
process.exit(sum.failed ? 1 : 0);
