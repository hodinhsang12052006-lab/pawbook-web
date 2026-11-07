// Độ tương phản chữ trên MỌI hình nền chat (WCAG AA ≥ 4.5:1) — 16 nền có sẵn + ẢNH TRẮNG của người dùng ở độ tối thấp
// nhất (15%, trường hợp xấu nhất). Với từng nền: mở cuộc trò chuyện thật, chèn 1 khối mẫu dùng ĐÚNG các lớp CSS của
// Messenger (.m-gap, .m-sender, .m-meta-pill, .m-system, .pn-date-pill, bong bóng vào / ra), làm chữ trong suốt rồi chụp
// → lấy điểm ảnh SÁNG NHẤT phía sau chữ (nền thật đã pha) và tính tỉ lệ với màu chữ. CHỈ chạy với server local.
//   BASE_URL=http://localhost:3100 [QA_EMAIL_A=… QA_EMAIL_B=…] [SHOTS_DIR=…] node scripts/qa/chat_wallpaper_aa.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, Results, fakeIp } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(import.meta.url)("sharp");
const R = new Results("Hình nền chat · tương phản AA");
const EMAIL_A = process.env.QA_EMAIL_A || SEED_OWNER;
const EMAIL_B = process.env.QA_EMAIL_B || SEED_TECH;
const SHOTS = process.env.SHOTS_DIR || "";
const PRESETS = ["default", "ink", "mocha", "sage", "nails", "glitter", "marble", "terrazzo", "lattice", "rose", "aurora", "ocean", "champagne", "dusk", "lagoon", "pearl"];

const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const parseRgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "en-US", colorScheme: "dark" });
const h = { "cf-connecting-ip": fakeIp() };
await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
await ctx.route(/sentry\.io|cloudflareinsights\.com/, (r) => r.abort());
const login = async (email) => {
  const c = await browser.newContext();
  const csrf = await (await c.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await c.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
  const me = (await (await c.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  await c.close();
  return me;
};
const partner = await login(EMAIL_B);
const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email: EMAIL_A, password: DEMO_PASSWORD, json: "true" }, headers: h });
const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
if (!me?.id || !partner?.id) throw new Error("login failed");
const page = await ctx.newPage();
await page.addInitScript(() => {
  try {
    localStorage.setItem("pn_push_dismissed_at", String(Date.now()));
    sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
  } catch {}
});
await page.goto(BASE_URL + `/messages?to=${partner.id}`);
await page.locator("[data-chat-input]").waitFor({ timeout: 30000 });

// ảnh TRẮNG của người dùng (fixture) → IndexedDB, độ tối 15% (thấp nhất)
const white = fs.readFileSync(path.join(HERE, "fixtures", "white.jpg")).toString("base64");
await page.evaluate(
  async ({ uid, b64 }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "image/jpeg" });
    await new Promise((res, rej) => {
      const rq = indexedDB.open("pn-local", 1);
      rq.onupgradeneeded = () => rq.result.objectStoreNames.contains("wallpapers") || rq.result.createObjectStore("wallpapers");
      rq.onsuccess = () => {
        const tx = rq.result.transaction("wallpapers", "readwrite");
        tx.objectStore("wallpapers").put(blob, `${uid}:aa-white`);
        tx.oncomplete = res;
        tx.onerror = rej;
      };
      rq.onerror = rej;
    });
  },
  { uid: me.id, b64: white }
);

const PROBE = `
<div data-aa-probe class="flex flex-col gap-2" style="position:absolute;left:12px;right:12px;top:150px;z-index:50;pointer-events:none">
  <div class="m-sep" style="margin:0"><span class="pn-date-pill" data-aa="date">Today</span></div>
  <div class="m-gap" data-aa="gap">3:00 PM</div>
  <div class="m-row m-system"><span data-aa="system">Group created</span></div>
  <div class="m-row flex justify-start"><div class="m-col m-col-group flex flex-col items-start">
    <span class="m-sender" data-aa="sender">Emily Nguyen</span>
    <div class="m-bubble m-in m-bl-tail"><p class="m-text" data-aa="in">Hi! Could I get a gel manicure at 3 today?</p><span class="m-meta" data-aa="inmeta">3:00 PM</span></div>
  </div></div>
  <div class="m-row flex justify-end"><div class="m-col flex flex-col items-end">
    <div class="m-bubble m-out m-br-tail"><p class="m-text" data-aa="out">Sure, see you at 3!</p></div>
  </div></div>
  <div class="m-row flex justify-end"><div class="m-bare"><span style="font-size:40px;line-height:1">💅</span><span class="m-meta-pill" data-aa="pill">3:01 PM</span></div></div>
</div>`;

async function measure(label) {
  // Khung chat "trống": ẩn các tin thật (vùng cuộn) rồi đặt khối mẫu cố định trên CHÍNH nền của khung chat
  // (không nằm trong vùng cuộn → app tự cuộn xuống tin mới nhất cũng không làm lệch toạ độ khi chụp).
  await page.evaluate((html) => {
    document.querySelectorAll("[data-aa-probe]").forEach((n) => n.remove());
    const wall = document.querySelector(".chat-wallpaper[data-wp-tone]");
    const sc = wall.querySelector(".m-scroll");
    if (sc) sc.style.visibility = "hidden";
    wall.insertAdjacentHTML("beforeend", html);
  }, PROBE);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `aa_${label}.png`) });
  const targets = await page.evaluate(() =>
    [...document.querySelectorAll("[data-aa]")].map((el) => {
      // vùng NGAY SAU CHỮ (hộp của các dòng chữ), không phải cả viên — góc bo của viên không tính là "sau chữ"
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { key: el.getAttribute("data-aa"), color: getComputedStyle(el).color, box: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, 412 - Math.max(0, r.x)), height: r.height } };
    })
  );
  // chữ trong suốt → chụp nền thật phía sau
  await page.addStyleTag({ content: "[data-aa], [data-aa] * { color: transparent !important; text-shadow: none !important; } [data-aa] svg { visibility: hidden; }" }).then((t) => t.evaluate((n) => n.setAttribute("data-aa-style", "")));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const out = [];
  for (const t of targets) {
    if (t.box.width < 2 || t.box.height < 2) continue;
    const png = await page.screenshot({ clip: t.box });
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let best = [0, 0, 0];
    let bestL = -1;
    for (let i = 0; i < info.width * info.height; i++) {
      const px = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
      const L = lum(px);
      if (L > bestL) {
        bestL = L;
        best = px;
      }
    }
    const fg = parseRgb(t.color);
    out.push({ key: t.key, fg: fg.join(","), bg: best.join(","), ratio: Math.round(ratio(fg, best) * 100) / 100 });
  }
  await page.evaluate(() => document.querySelectorAll("style[data-aa-style]").forEach((n) => n.remove()));
  return out;
}

const all = {};
for (const id of [...PRESETS, "photo-white-15"]) {
  const state = id === "photo-white-15" ? { all: "photo:aa-white", photos: { "aa-white": { dim: 15, blur: false, w: 1600, h: 1067, at: Date.now() } } } : { all: id };
  await page.evaluate(({ uid, s }) => localStorage.setItem(`pn_wp:v2:${uid}`, JSON.stringify(s)), { uid: me.id, s: state });
  await page.reload();
  await page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  if (id.startsWith("photo")) await page.waitForFunction(() => /blob:/.test(getComputedStyle(document.querySelector(".chat-wallpaper[data-wp-tone]")).backgroundImage), null, { timeout: 10000 });
  const tone = await page.locator(".chat-wallpaper[data-wp-tone]").first().getAttribute("data-wp-tone");
  all[id] = { tone, rows: await measure(id) };
}
for (const [id, { tone, rows }] of Object.entries(all)) {
  const low = rows.filter((r) => r.ratio < 4.5);
  R.check(`AA-${id}`, `${id} (${tone}): mọi chữ ≥ 4.5:1 — ${rows.map((r) => `${r.key} ${r.ratio}`).join(" · ")}`, rows.length >= 8 && !low.length, JSON.stringify(low));
}
// trả lại mặc định cho người test
await page.evaluate((uid) => localStorage.removeItem(`pn_wp:v2:${uid}`), me.id);
await browser.close();
const sum = R.summary();
if (SHOTS) fs.writeFileSync(path.join(SHOTS, "aa_results.json"), JSON.stringify(all, null, 2));
process.exit(sum.failed ? 1 : 0);
