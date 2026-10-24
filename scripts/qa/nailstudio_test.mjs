// Thử mẫu PawNail (Try-On) — bộ máy ảnh thật (lib/tryon) trên trình duyệt thật: trang /tryon (chụp → chạm móng → máy
// nhận đúng móng thật → 10 mẫu vẽ lên móng → tải ảnh) và trong Messenger (khách gửi ảnh tay → thợ bấm ✨ → chọn
// mẫu → gửi ảnh + giá cho khách). Ảnh tay: scripts/qa/fixtures/hand.jpg (900×900, 4 móng đen) + đáp án viền móng
// vẽ tay (scripts/qa/tryon_fixtures.ts). CHỈ chạy với server local.
//   node scripts/qa/nailstudio_test.mjs [thư-mục-ảnh-chụp]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, Results, SEED_TECH, DEMO_PASSWORD, fakeIp, registerUser } from "./lib.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error("nailstudio_test chỉ chạy với server local");
const OUT = process.argv[2] || process.env.TEMP || ".";
const R = new Results("Thử mẫu PawNail (Try-On)");
const HAND = path.resolve("scripts/qa/fixtures/hand.jpg");
// đáp án viền móng ảnh hand.jpg 900×900 (cùng scripts/qa/tryon_fixtures.ts)
const GT = [
  [[240, 326], [258, 322], [300, 322], [312, 326], [315, 345], [314, 400], [306, 418], [290, 428], [270, 430], [250, 425], [241, 410], [238, 360]],
  [[340, 322], [360, 316], [400, 312], [417, 309], [422, 320], [423, 380], [419, 410], [405, 425], [385, 430], [362, 426], [348, 414], [341, 390], [339, 350]],
  [[460, 322], [480, 314], [520, 309], [532, 307], [538, 318], [541, 370], [537, 405], [525, 420], [507, 426], [487, 423], [472, 413], [462, 390], [459, 350]],
  [[580, 330], [600, 325], [625, 315], [636, 308], [648, 318], [656, 345], [657, 380], [650, 395], [635, 404], [618, 406], [598, 401], [586, 392], [579, 365]],
];
const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const iou = (a, b) => { let i = 0, u = 0; for (let y = 280; y < 460; y++) for (let x = 220; x < 680; x++) { const p = inPoly(x, y, a), q = inPoly(x, y, b); if (p && q) i++; if (p || q) u++; } return u ? i / u : 0; };

const browser = await chromium.launch();
async function ui(email, password) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN", acceptDownloads: true });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password, json: "true" }, headers: h });
  const page = await ctx.newPage();
  const errors = [], workers = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  page.on("worker", (w) => workers.push(w.url()));
  return { ctx, page, errors, workers };
}
const polyCount = (page, scope = "") => page.evaluate((sc) => document.querySelectorAll(`${sc} svg[data-testid="nail-overlay"] polygon[data-nail]`).length, scope);
const readPolys = (page, scope = "") => page.evaluate((sc) => [...document.querySelectorAll(`${sc} svg[data-testid="nail-overlay"] polygon[data-nail]`)].map((e) => ({ byColor: e.getAttribute("data-bycolor"), pts: (e.getAttribute("points") || "").trim().split(/\s+/).map((q) => q.split(",").map(Number)) })), scope);
const centre = (poly) => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
/** Chọn ảnh xong: chờ máy TỰ NHẬN móng; móng nào sót thì chạm 1 lần vào giữa (như khách làm). */
async function autoNails(page, scope = page, sc = "") {
  const img = scope.getByRole("img", { name: "Ảnh tay khách" });
  await img.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !document.body.innerText.includes("Đang tìm móng trên ảnh"), null, { timeout: 30000 }).catch(() => {});
  const auto = await polyCount(page, sc);
  const tapAt = async ([x, y]) => { const box = await img.boundingBox(); await page.mouse.click(box.x + (x / 900) * box.width, box.y + (y / 900) * box.height); };
  const y0 = (await img.boundingBox()).y;
  for (const poly of GT) {
    const have = (await readPolys(page, sc)).some((p) => inPoly(...centre(p.pts), poly));
    if (have) continue;
    const n = await polyCount(page, sc);
    await tapAt(centre(poly));
    await page.waitForFunction(([s2, n0]) => document.querySelectorAll(`${s2} svg[data-testid="nail-overlay"] polygon[data-nail]`).length > n0, [sc, n], { timeout: 15000 }).catch(() => {});
  }
  return { auto, total: await polyCount(page, sc), tapAt, jump: Math.abs((await img.boundingBox()).y - y0) };
}
/** Chờ đủ `n` ảnh mẫu đã vẽ xong trong `scope`. */
async function waitLooks(scope, n, timeout = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await scope.locator("img[data-look]").count()) >= n) return Date.now() - t0;
    await new Promise((r) => setTimeout(r, 250));
  }
  return -1;
}
/** Đọc điểm ảnh 1 ảnh mẫu (blob:) + ảnh tay gốc cùng khung → tỉ lệ điểm đổi màu, có lệch màu ngoài móng không. */
async function diffPreview(page, sel) {
  return page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    const hand = document.querySelector('img[alt="Ảnh tay khách"]');
    const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
    const im = await load(el.src);
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    return { w: im.naturalWidth, h: im.naturalHeight, hasHand: !!hand };
  }, sel);
}

let techUi, clientUi;
try {
  // ---------- /tryon ----------
  techUi = await ui(SEED_TECH, DEMO_PASSWORD);
  const p = techUi.page;
  await p.goto(BASE_URL + "/tryon");
  await p.locator('input[type=file]').setInputFiles(HAND);
  const t0 = Date.now();
  const { auto, total, tapAt, jump } = await autoNails(p);
  const found = Date.now() - t0;
  const shapes = (await readPolys(p)).map((x) => ({ ...x, iou: Math.max(...GT.map((g) => iou(x.pts, g))) }));
  const ious = shapes.map((x) => +x.iou.toFixed(3));
  const profileCard = await p.getByTestId("hand-profile").innerText().catch(() => "");
  await p.screenshot({ path: path.join(OUT, "tryon_marked.png") });
  R.check("S0", "Chụp ảnh → máy TỰ NHẬN móng chắc chắn (Web Worker, không chạm gì) ≥ 2/4; chạm 1 lần vào móng sót → đủ 4; mọi viền trùng đáp án (IoU ≥ 0.75); thẻ \"Soi tay của bạn\" (tông da, độ dài móng, dáng hợp nhất)",
    auto >= 2 && total === 4 && jump < 1 && ious.every((x) => x >= 0.75) && shapes.every((x) => x.byColor === "1") && /Soi tay/.test(profileCard) && /tông/.test(profileCard) && /Dáng hợp nhất/.test(profileCard) && techUi.workers.length >= 1,
    JSON.stringify({ auto, total, found, ious, profileCard: profileCard.replace(/\n/g, " · "), workers: techUi.workers.length }));
  // chạm vào nền (áo len, góc trên trái) → KHÔNG thêm móng; chạm vào viền 1 móng → bỏ; chạm lại giữa móng → nhận lại
  const idle = () => p.waitForFunction(() => document.querySelector("[data-busy]")?.getAttribute("data-busy") === "0", null, { timeout: 20000 }).catch(() => {});
  const t1 = Date.now();
  await tapAt([60, 60]);
  await p.waitForTimeout(150); await idle();
  const bgMs = Date.now() - t1;
  const afterBg = await polyCount(p);
  const bgToast = await p.getByText(/Chưa nhận ra móng ở đó/).count();
  await tapAt(centre(GT[1]));
  await p.waitForTimeout(400); await idle();
  const afterDrop = await polyCount(p);
  await tapAt(centre(GT[1]));
  await p.waitForFunction(() => document.querySelectorAll('svg[data-testid="nail-overlay"] polygon[data-nail]').length >= 4, null, { timeout: 15000 }).catch(() => {});
  const afterReadd = await polyCount(p);
  R.check("S0b", "Chạm vào nền → không thêm móng (báo \"Chưa nhận ra móng ở đó\"); chạm vào viền móng → bỏ móng; chạm lại giữa móng → nhận lại", afterBg === 4 && bgToast >= 1 && afterDrop === 3 && afterReadd === 4, JSON.stringify({ afterBg, bgToast, bgMs, afterDrop, afterReadd }));
  await p.getByRole("button", { name: /Tạo mẫu/ }).click();
  const looks = p.locator("button[aria-pressed]");
  await looks.first().waitFor({ timeout: 15000 });
  const n = await looks.count();
  const took = await waitLooks(p, 10);
  const info = await diffPreview(p, "img[data-look]");
  const why = await looks.locator("span.line-clamp-2").allInnerTexts();
  const tags = await p.locator("button[aria-pressed] > span.absolute.left-2").allInnerTexts();
  R.check("S1", "Tạo mẫu → 10 mẫu HỢP TAY (mỗi mẫu có nhãn: Hợp tông da / Trend 2026 / Làm ngón thon / Cá tính + lý do), cả 10 ảnh vẽ xong (ảnh thật, khung vuông quanh bàn tay) trong < 40 giây",
    n === 10 && took >= 0 && took < 40000 && info.w === info.h && info.w > 300 && why.length === 10 && why.every((x) => x.length > 15) && tags.length === 10 && tags.some((x) => /Trend/.test(x)) && tags.some((x) => /tông da/.test(x)),
    JSON.stringify({ n, took, info, tags: [...new Set(tags)], why: why.slice(0, 2) }));
  await p.screenshot({ path: path.join(OUT, "tryon_looks.png"), fullPage: true });
  const titles = await looks.locator("span.block.truncate").allInnerTexts();
  const prices = await looks.locator("span.text-emerald-300").allInnerTexts();
  const firstSrc = await p.locator("img[data-look]").first().getAttribute("src");
  // Đổi dáng: Hạnh nhân (đắp dài) → bộ máy vẽ lại cả 10 mẫu
  await p.getByRole("button", { name: /^Hạnh nhân/ }).click();
  const slider = await p.getByText("Độ dài đắp").count();
  await p.waitForFunction((src) => { const im = document.querySelector("img[data-look]"); return im && im.getAttribute("src") !== src; }, firstSrc, { timeout: 30000 }).catch(() => {});
  const tookShape = await waitLooks(p, 10);
  const almondSrc = await p.locator("img[data-look]").first().getAttribute("src");
  await p.screenshot({ path: path.join(OUT, "tryon_almond.png"), fullPage: true });
  R.check("S2", "Mỗi mẫu có tên + giá gợi ý; đổi dáng \"Hạnh nhân\" hiện thanh độ dài đắp và vẽ lại cả 10 mẫu", titles.length === 10 && prices.every((x) => /\$\d+/.test(x)) && slider === 1 && tookShape >= 0 && almondSrc !== firstSrc,
    JSON.stringify({ titles: titles.slice(0, 3), prices: prices.slice(0, 3), slider, tookShape }));
  await p.getByRole("button", { name: "Móng thật" }).click();
  const beforeSet = titles.join("|");
  await p.getByRole("button", { name: /Bộ khác/ }).click();
  await p.waitForTimeout(500);
  const newTitles = (await looks.locator("span.block.truncate").allInnerTexts()).join("|");
  const tookNew = await waitLooks(p, 10);
  R.check("S2b", "\"Bộ khác\" ra bộ mẫu mới và vẽ xong cả 10", newTitles !== beforeSet && tookNew >= 0, JSON.stringify({ tookNew }));
  await looks.nth(0).click();
  await looks.nth(3).click();
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.getByRole("button", { name: /Chia sẻ 2/ }).click()]);
  const file = path.join(OUT, "tryon_export.jpg");
  await dl.saveAs(file);
  const meta = await sharp(file).metadata();
  R.check("S3", "Chọn 2 mẫu → \"Chia sẻ 2\" (máy không chia sẻ ảnh được → tải về) xuất ảnh JPEG 1080×1080 (có nhãn PawNail · mẫu thử)", meta.format === "jpeg" && meta.width === 1080 && meta.height === 1080 && fs.statSync(file).size > 40000, JSON.stringify({ format: meta.format, w: meta.width, h: meta.height, size: fs.statSync(file).size }));

  // ---------- Messenger: khách gửi ảnh tay → thợ ✨ → gửi mẫu ----------
  const reg = await registerUser({ name: "QA Khách Studio", role: "CLIENT", specialties: undefined });
  const client = new Client();
  await client.login(reg.body.email, reg.body.password);
  const tech = new Client();
  await tech.login(SEED_TECH);
  const handB64 = "data:image/jpeg;base64," + fs.readFileSync(HAND).toString("base64");
  const first = await client.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: "Hello tiệm, em muốn làm móng" } });
  const convId = first.data?.conversationId || first.data?.message?.conversationId;
  await client.req("/api/messages", { method: "POST", json: { conversationId: convId, content: handB64, type: "IMAGE" } });

  // Khách mở chat → thẻ menu của thợ; thợ mở chat → thẻ "đây là khách làm nail" + ✨
  clientUi = await ui(reg.body.email, reg.body.password);
  await clientUi.page.goto(BASE_URL + `/messages?to=${tech.userId}`);
  const clientCard = await clientUi.page.getByText(/Menu & mẫu của/).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  await p.goto(BASE_URL + `/messages?to=${reg.res.data.user.id}`);
  const proCard = await p.getByText(/Đây là khách làm nail/).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  R.check("S4", "Khách nhắn thợ → đầu chat hiện \"Menu & mẫu của …\" (giá + đặt lịch); thợ thấy \"Đây là khách làm nail\" + Tạo mẫu trên tay / Gửi menu", clientCard && proCard, JSON.stringify({ clientCard, proCard }));

  const before = (await tech.req(`/api/messages?conversationId=${convId}`)).data?.messages?.length ?? 0;
  await p.getByRole("button", { name: "Tạo mẫu" }).first().click();
  const dialog = p.getByRole("dialog", { name: /Thử mẫu PawNail/ });
  await dialog.waitFor({ timeout: 15000 });
  await dialog.locator("button img").first().click(); // ảnh tay khách vừa gửi
  await autoNails(p, dialog, "[role=dialog]");
  await dialog.getByRole("button", { name: /Tạo mẫu/ }).click();
  const dl2 = dialog.locator("button[aria-pressed]");
  await dl2.first().waitFor({ timeout: 15000 });
  await waitLooks(dialog, 3);
  await dl2.nth(1).click();
  await dl2.nth(2).click();
  await dialog.getByRole("button", { name: /Gửi cho khách/ }).click();
  await dialog.waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const after = (await tech.req(`/api/messages?conversationId=${convId}`)).data?.messages ?? [];
  const mine = after.filter((m) => m.senderId === tech.userId);
  const imgs = mine.filter((m) => m.type === "IMAGE").length;
  const summary = mine.find((m) => /mẫu thử trên tay chị\/anh/.test(m.body || m.content || ""));
  R.check("S5", "Thợ bấm ✨ Tạo mẫu trong chat → chọn ảnh tay khách → chạm móng → chọn 2 mẫu → \"Gửi cho khách\": khách nhận 2 ảnh mẫu + 1 tin tên mẫu & giá", after.length - before >= 3 && imgs >= 2 && !!summary,
    JSON.stringify({ before, after: after.length, imgs, summary: (summary?.body || summary?.content || "").slice(0, 120) }));
  R.check("S6", "Không có lỗi JavaScript", techUi.errors.length === 0 && clientUi.errors.length === 0, [...techUi.errors, ...clientUi.errors].join(" | "));
} finally {
  await browser.close();
}
const s = R.summary();
process.exit(s.failed ? 1 : 0);
