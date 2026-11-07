// Service worker THẬT (next-pwa, bản build production) + GIF trong chat. Mọi bộ test khác chặn service worker, nên các quy tắc
// GIF của next.config.ts chưa từng chạy:
//   - GIF MP4 của GIPHY (tin GIF từ 11/2026): NetworkOnly — <video> xin theo đoạn (Range → 206) phải phát được qua SW, và KHÔNG
//     có tệp .mp4 nào bị ghi vào Cache Storage;
//   - ảnh poster (crossorigin trên host GIPHY) + GIF cũ (.webp): CacheFirst kho "pn-gifs" — vào kho, lần mở sau lấy từ kho.
// Media GIPHY là bản GIẢ (context.route, áp cả cho request do SW gửi trong Chromium); không gọi GIPHY thật, không dùng khoá.
// CHỈ chạy với server local đã build production (`next build` + `next start`, có public/sw.js); lib.mjs chặn bitpawos.com.
//   BASE_URL=http://localhost:3167 [SHOTS_DIR=…] node scripts/qa/chat_sw_gif_test.mjs
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1"; // Playwright cũ: mới thấy / route được request của SW
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_OWNER_2, Results, fakeIp } from "./lib.mjs";

const R = new Results("Service worker + GIF (MP4 qua mạng, poster / GIF cũ vào kho)");
const SHOTS = process.env.SHOTS_DIR || "";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const VIDEO = fs.readFileSync(new URL("./fixtures/gif_mock.webm", import.meta.url));
const tag = Date.now().toString(36);
const GM = "https://media.giphy.com/media";
const MP4 = `${GM}/sw${tag}/200.mp4`;
const STILL = `${GM}/sw${tag}/200_s.gif`;
const WEBP = `${GM}/sw${tag}b/200.webp`;
const svg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="${c}"/></svg>`;

const browser = await chromium.launch();
async function login(email, phone) {
  const ctx = await browser.newContext(
    phone
      ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, locale: "en-US", colorScheme: "dark", serviceWorkers: "allow" }
      : { viewport: { width: 1280, height: 860 }, locale: "en-US", serviceWorkers: "block" }
  );
  const hd = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/api/**", (r) => r.continue({ headers: { ...r.request().headers(), ...hd } }));
  await ctx.route(/sentry\.io|cloudflareinsights\.com/, (r) => r.abort());
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: hd })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: hd });
  const me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: hd })).json()).user;
  if (!me?.id) throw new Error(`login failed for ${email}`);
  return { ctx, me, hd };
}

const B = await login(SEED_OWNER, false);
// cặp owner1 → owner2 (không phải owner1 ↔ tech1 mà nhiều bộ test khác dùng — tin GIF thử không lẫn vào đó)
const A = await login(SEED_OWNER_2, true);
// media GIPHY giả: MP4 trả đúng 206 cho Range (như CDN thật), ảnh tĩnh / WebP có ACAO: *
const media = [];
await A.ctx.route(/^https:\/\/media\d*\.giphy\.com\//, (r) => {
  const req = r.request();
  const u = req.url();
  const range = req.headers()["range"];
  const fromSw = !!req.serviceWorker?.();
  const mine = u.includes(`/sw${tag}`); // chỉ đếm media của lượt chạy này
  if (/\.mp4(?:[?#]|$)/.test(u)) {
    const total = VIDEO.length;
    const m = /bytes=(\d+)-(\d*)/.exec(range || "");
    if (m) {
      const start = Number(m[1]);
      const end = Math.min(m[2] ? Number(m[2]) : total - 1, total - 1);
      if (mine) media.push({ kind: "mp4", status: 206, range, fromSw });
      return r.fulfill({ status: 206, headers: { "content-type": "video/mp4", "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${total}`, "access-control-allow-origin": "*", "cache-control": "public, max-age=86400" }, body: VIDEO.subarray(start, end + 1) });
    }
    if (mine) media.push({ kind: "mp4", status: 200, range: null, fromSw });
    return r.fulfill({ status: 200, headers: { "content-type": "video/mp4", "accept-ranges": "bytes", "access-control-allow-origin": "*", "cache-control": "public, max-age=86400" }, body: VIDEO });
  }
  if (mine) media.push({ kind: /_s\.gif/.test(u) ? "still" : "webp", status: 200, fromSw, mode: req.headers()["sec-fetch-mode"] || "" });
  return r.fulfill({ status: 200, headers: { "content-type": "image/svg+xml", "access-control-allow-origin": "*", "cache-control": "public, max-age=86400" }, body: svg(/_s\.gif/.test(u) ? "#7a3e66" : "#3e667a") });
});

// tin: GIF MP4 (poster) + GIF cũ .webp, rồi 1 dòng chữ
const post = (content, type) => B.ctx.request.post(BASE_URL + "/api/messages", { data: { receiverId: A.me.id, content, ...(type ? { type } : {}) }, headers: B.hd });
const s1 = await post(`${MP4}#wh=356x200&still=${encodeURIComponent(STILL)}`, "IMAGE");
const s2 = await post(`${WEBP}#wh=200x200`, "IMAGE");
const s3 = await post(`sw gif test ${tag}`);
R.check("SW0", "Gửi tin GIF MP4 (+poster) và GIF cũ .webp", s1.status() === 201 && s2.status() === 201 && s3.status() === 201, `${s1.status()} ${s2.status()} ${s3.status()}`);

const page = await A.ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" && /giphy|Refused to|ERR_FAILED|no-response|workbox/i.test(t)) errors.push(t.slice(0, 200));
});
await page.goto(BASE_URL + "/messages");
// SW cài + kích hoạt, rồi tải lại để trang do SW điều khiển
const swOk = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return { ok: false, why: "no serviceWorker" };
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 20000))]);
  return { ok: !!reg?.active, script: reg?.active?.scriptURL || null };
});
await page.reload();
const controlled = await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).then(() => true).catch(() => false);
R.check("SW1", `Service worker production đang điều khiển trang (${swOk.script || swOk.why})`, swOk.ok && controlled, JSON.stringify({ swOk, controlled }));

async function openThread() {
  await page.goto(BASE_URL + `/messages?to=${B.me.id}`);
  await page.locator("[data-chat-input]").waitFor({ timeout: 30000 });
  await page.getByText(`sw gif test ${tag}`).last().waitFor({ timeout: 20000 });
  const gif = page.locator(`.m-gif:has(video[src="${MP4}"]), .m-gif:has(img[src="${STILL}"])`).last();
  await gif.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(2500);
  return page.evaluate(({ MP4, STILL, WEBP }) => {
    const v = document.querySelector(`video[src="${MP4}"]`);
    const still = document.querySelector(`img[src="${STILL}"]`);
    const webp = document.querySelector(`img[src^="${WEBP}"]`);
    return {
      video: v ? { readyState: v.readyState, paused: v.paused, t: Math.round(v.currentTime * 100) / 100, err: v.error?.code ?? null } : null,
      still: still ? { ok: still.complete && still.naturalWidth > 0, cors: still.crossOrigin } : null,
      webp: webp ? { ok: webp.complete && webp.naturalWidth > 0 } : null,
    };
  }, { MP4, STILL, WEBP });
}
const first = await openThread();
await shot("sw_gif_thread");
const cache1 = await page.evaluate(async () => {
  const out = {};
  for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map((r) => r.url).filter((u) => /giphy/.test(u));
  return out;
});
const allCached = Object.values(cache1).flat();
const mp4Reqs = media.filter((m) => m.kind === "mp4");
R.check("SW2", `GIF MP4 phát qua service worker (readyState ${first.video?.readyState}, t=${first.video?.t}s, đang chạy: ${first.video ? !first.video.paused : "-"}); ${mp4Reqs.length} request MP4 (${mp4Reqs.filter((m) => m.status === 206).length} Range → 206, ${mp4Reqs.filter((m) => m.fromSw).length} do SW gửi)`,
  !!first.video && first.video.readyState >= 2 && !first.video.paused && first.video.t > 0 && first.video.err === null && mp4Reqs.length > 0,
  JSON.stringify({ first, mp4Reqs: mp4Reqs.slice(0, 6) }));
R.check("SW3", `Không có tệp .mp4 nào trong Cache Storage (NetworkOnly); poster (crossorigin=${first.still?.cors}) + GIF cũ .webp hiện và nằm trong kho pn-gifs`,
  !allCached.some((u) => /\.mp4/.test(u)) && !!first.still?.ok && !!first.webp?.ok && (cache1["pn-gifs"] || []).some((u) => u.startsWith(STILL)) && (cache1["pn-gifs"] || []).some((u) => u.startsWith(WEBP)),
  JSON.stringify({ cache1, still: first.still, webp: first.webp }));

// mở lại: poster + webp lấy từ kho (không xin mạng lần nữa), MP4 vẫn phát
const before = { still: media.filter((m) => m.kind === "still").length, webp: media.filter((m) => m.kind === "webp").length, mp4: mp4Reqs.length };
const second = await openThread();
const after = { still: media.filter((m) => m.kind === "still").length, webp: media.filter((m) => m.kind === "webp").length, mp4: media.filter((m) => m.kind === "mp4").length };
R.check("SW4", `Mở lại cuộc trò chuyện: poster / GIF cũ lấy từ kho (request mạng mới: poster ${after.still - before.still}, webp ${after.webp - before.webp}), MP4 vẫn phát (t=${second.video?.t}s)`,
  after.still === before.still && after.webp === before.webp && !!second.video && second.video.readyState >= 2 && !second.video.paused && !!second.still?.ok && !!second.webp?.ok,
  JSON.stringify({ before, after, second }));
R.check("SW5", "Không có lỗi JS / CSP / SW liên quan GIF", !errors.length, errors.join(" | "));

async function shot(name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});
}
await browser.close();
const sum = R.summary();
if (SHOTS) fs.writeFileSync(path.join(SHOTS, "chat_sw_gif_results.json"), JSON.stringify({ ...sum, media: media.slice(0, 40) }, null, 2));
process.exit(sum.failed ? 1 : 0);
