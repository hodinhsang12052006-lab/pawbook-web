// Kiểm thử "Mẫu nail AI mỗi ngày" với máy chủ Gemini GIẢ (:4993).
// Server: bash scripts/qa/start-launch-server.sh   →   node scripts/qa/designs_test.mjs
import http from "node:http";
import { createClient } from "@libsql/client";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, DEMO_PASSWORD, Results, SEED_TECH, registerUser, fakeIp } from "./lib.mjs";

const R = new Results("Mẫu nail AI mỗi ngày");
const TMP = process.env.TEMP || ".";
const db = createClient({ url: "file:prisma/dev.db" });
await db.execute("PRAGMA busy_timeout = 10000");
await db.execute(`DELETE FROM "NailDesignSave"`);
await db.execute(`DELETE FROM "NailDesign"`);

// PNG 8×8 hồng (đủ để trình duyệt hiển thị)
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFTEMIwkAQJ8Q8Iyx8SoAAAAASUVORK5CYII=";
const calls = [];
let imageFails = false; // giả lập tài khoản Google chưa bật thanh toán
const gemini = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const body = JSON.parse(b || "{}");
    const prompt = body.contents?.[0]?.parts?.[0]?.text ?? "";
    calls.push({ path: req.url, key: req.headers["x-goog-api-key"], prompt, cfg: body.generationConfig });
    res.setHeader("content-type", "application/json");
    if (req.headers["x-goog-api-key"] !== "test-gemini-key") return res.writeHead(403).end(JSON.stringify({ error: { message: "API key not valid" } }));
    if (body.generationConfig?.responseModalities?.includes("IMAGE") && imageFails) {
      return res.writeHead(429).end(JSON.stringify({ error: { message: "Image generation requires billing (free tier quota is 0)" } }));
    }
    if (body.generationConfig?.responseModalities?.includes("IMAGE")) {
      return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG } }] } }] }));
    }
    const n = Number(prompt.match(/ĐÚNG (\d+) mẫu/)?.[1] ?? 3);
    const ideas = Array.from({ length: n }, (_, i) => ({
      title: { vi: `Mắt mèo bí ngô ${Date.now() % 1000}-${i}`, en: `Pumpkin cat eye ${i}` },
      description: { vi: "Cam bí ngô ánh mắt mèo — hot tuần Halloween.", en: "Pumpkin orange cat eye — hot for Halloween week." },
      occasion: i === 0 ? "halloween" : "khong-co-that",
      skills: ["Gel-X", "Design", "BỊA"],
      difficulty: i === 2 ? 9 : 2,
      minutes: 60,
      priceHint: "$55–70",
      materials: [{ vi: "Gel mắt mèo cam", en: "Orange cat-eye gel", qty: "1 lọ" }, { vi: "Nam châm mắt mèo", en: "Cat-eye magnet", qty: "1 cái" }, { vi: "Top coat bóng", en: "Glossy top coat", qty: "1 lọ" }],
      steps: [{ vi: "Sơn base", en: "Apply base" }, { vi: "Sơn 2 lớp gel mắt mèo", en: "Two coats of cat-eye gel" }, { vi: "Hút nam châm", en: "Use the magnet" }, { vi: "Phủ top", en: "Top coat" }],
      imagePrompt: "almond nails, burnt orange cat eye gel with a bright magnetic stripe",
      palette: ["#c2410c", "#f97316", "not-a-color"],
      shape: "almond",
      finish: "cateye",
    }));
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ideas) }] } }] }));
  });
});
await new Promise((r) => gemini.listen(4993, "127.0.0.1", r));

// Cloudflare Workers AI giả lập (FLUX schnell) — trả JPEG base64 như API thật.
const cfCalls = [];
let cfNsfwOnce = true; // bộ lọc NSFW của Cloudflare hay chặn nhầm — lần đầu trả lỗi, app phải thử lại
const cf = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    cfCalls.push({ path: req.url, auth: req.headers.authorization, body: JSON.parse(b || "{}") });
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization !== "Bearer test-cf-token") return res.writeHead(401).end(JSON.stringify({ success: false, errors: [{ message: "Authentication error" }] }));
    if (cfNsfwOnce) {
      cfNsfwOnce = false;
      return res.writeHead(400).end(JSON.stringify({ success: false, errors: [{ code: 8007, message: "AiError: Input prompt contains NSFW content." }] }));
    }
    res.end(JSON.stringify({ success: true, result: { image: PNG }, errors: [] }));
  });
});
await new Promise((r) => cf.listen(4992, "127.0.0.1", r));

let browser;
const errors = [];
try {
  // ---------- API ----------
  const anon = new Client();
  const tech = new Client();
  await tech.login(SEED_TECH);
  R.check("D1", "Khu quản trị mẫu AI: khách 401, thợ 403", (await anon.req("/api/admin/designs")).status === 401 && (await tech.req("/api/admin/designs")).status === 403);

  const a = await registerUser({ name: "QA Designs Admin" });
  await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE email = ?`, args: [a.body.email] });
  const admin = a.client;
  await admin.login(a.body.email, a.body.password);
  const cfg = (await admin.req("/api/admin/designs")).data;
  R.check("D2", "Admin thấy cấu hình: Gemini bật, giới hạn 6 mẫu/ngày", cfg.enabled === true && cfg.dailyLimit === 6 && cfg.madeToday === 0, JSON.stringify(cfg).slice(0, 120));

  calls.length = 0;
  const g = await admin.req("/api/admin/designs", { method: "POST", json: { count: 3 } });
  const textCall = calls.find((c) => c.cfg?.responseMimeType === "application/json");
  const imgCalls = calls.filter((c) => c.cfg?.responseModalities);
  R.check("D3", "Tạo 3 mẫu: Gemini nhận khoá qua header (không nằm trên URL), 1 lần viết + 3 lần vẽ", g.status === 201 && g.data.created.length === 3 && textCall?.key === "test-gemini-key" && !/key=/.test(textCall.path) && imgCalls.length === 3, JSON.stringify(g.data).slice(0, 200));
  R.check("D4", "Prompt dựa trên bối cảnh thật: dịp Halloween + yêu cầu song ngữ + vật tư + cấm thương hiệu", /halloween/i.test(textCall?.prompt ?? "") && /materials/.test(textCall.prompt) && /Chanel/.test(textCall.prompt));
  R.check("D5", "Ảnh vẽ cận cảnh bàn tay, cấm chữ/logo", imgCalls.every((c) => /No text, no watermark, no logos/.test(c.prompt) && /five fingers/.test(c.prompt)));

  const drafts = (await admin.req("/api/admin/designs")).data.drafts;
  const d0 = drafts.find((d) => d.occasion === "halloween");
  R.check("D6", "Bản nháp đủ dữ liệu song ngữ; lọc dữ liệu bịa (kỹ năng lạ, dịp lạ, độ khó 9 → 3)", drafts.length === 3 && d0 && d0.titleEn && d0.materials.length === 3 && d0.steps.length === 4 && drafts.every((d) => !d.skills.includes("BỊA") && d.difficulty <= 3) && drafts.filter((d) => d.occasion === null).length === 2, JSON.stringify(drafts[0]).slice(0, 200));
  R.check("D7", "Bản nháp CHƯA hiện cho người dùng", (await anon.req("/api/designs")).data.designs.length === 0);

  await admin.req("/api/admin/designs", { method: "PATCH", json: { id: drafts[0].id, status: "published" } });
  await admin.req("/api/admin/designs", { method: "PATCH", json: { id: drafts[1].id, status: "published" } });
  await admin.req("/api/admin/designs", { method: "PATCH", json: { id: drafts[2].id, status: "rejected" } });
  const bad = await admin.req("/api/admin/designs", { method: "PATCH", json: { id: drafts[2].id, status: "hacked" } });
  const pub = (await anon.req("/api/designs")).data.designs;
  R.check("D8", "Duyệt 2 / bỏ 1 → công khai đúng 2 mẫu; trạng thái lạ → 400", pub.length === 2 && bad.status === 400, `${pub.length} ${bad.status}`);
  R.check("D9", "Lọc theo dịp lễ (halloween) & kỹ năng (Gel-X)", (await anon.req("/api/designs?occasion=halloween")).data.designs.length === (pub.filter((d) => d.occasion === "halloween").length) && (await anon.req("/api/designs?skill=Gel-X")).data.designs.length === 2);

  imageFails = true;
  const free = (await admin.req("/api/admin/designs", { method: "POST", json: { count: 1 } })).data;
  imageFails = false;
  const freeRow = free.created[0] ? (await admin.req("/api/admin/designs")).data.drafts.find((d) => d.id === free.created[0]) : null;
  R.check("D9b", "Gemini MIỄN PHÍ (vẽ ảnh bị từ chối) → mẫu vẫn lưu, không ảnh, có bảng màu/dáng/hiệu ứng để app tự vẽ; màu rác bị lọc", free.created.length === 1 && freeRow && freeRow.imageUrl === null && freeRow.palette.length === 2 && freeRow.shape === "almond" && freeRow.finish === "cateye" && /Không vẽ được ảnh/.test(free.errors[0] || ""), JSON.stringify({ free, p: freeRow?.palette }));
  const more = (await admin.req("/api/admin/designs", { method: "POST", json: { count: 6 } })).data;
  const over = (await admin.req("/api/admin/designs", { method: "POST", json: { count: 2 } })).data;
  R.check("D10", "Giới hạn 6 mẫu/ngày (chặn chi phí AI): đã có 4 → chỉ tạo thêm 2, lần sau từ chối", more.created.length === 2 && over.created.length === 0 && /Đã đủ 6/.test(over.errors[0]), JSON.stringify({ more: more.created.length, over }));

  const c1 = await anon.req("/api/cron/designs");
  const c2 = await anon.req("/api/cron/designs", { headers: { authorization: "Bearer sai" } });
  const c3 = await anon.req("/api/cron/designs", { headers: { authorization: "Bearer test-cron" } });
  const c4 = await anon.req("/api/cron/designs", { headers: { authorization: "Bearer test-cron" } });
  const cronRows = (await admin.req("/api/admin/designs")).data.drafts.filter((d) => c3.data.created?.includes(d.id));
  R.check("D11b", "Ảnh thật miễn phí (Cloudflare FLUX): khoá qua header, đúng model, mô tả ảnh chân thực; bị chặn nhầm NSFW thì tự thử lại; KHOÁ 3 ảnh/ngày → 3 mẫu có ảnh, mẫu thứ 4 dùng hình minh hoạ",
    cfCalls.length === 4 && cfCalls.every((c) => c.auth === "Bearer test-cf-token" && /\/accounts\/test-acc\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell$/.test(c.path) && /photorealistic/i.test(c.body.prompt) && c.body.steps === 6) &&
    cronRows.filter((d) => d.imageUrl).length === 3 && cronRows.filter((d) => !d.imageUrl).length === 1,
    JSON.stringify({ calls: cfCalls.map((c) => c.path), withImg: cronRows.filter((d) => d.imageUrl).length }));
  R.check("D11", "Cron: không khoá / sai khoá → 401; đúng khoá → máy PawNail tạo 4 mẫu (0đ, không gọi Gemini); chạy lại trong ngày không tạo thêm", c1.status === 401 && c2.status === 401 && c3.status === 200 && c3.data.created?.length === 4 && c4.data.created?.length === 0, `${c1.status} ${c2.status} ${c3.status} ${JSON.stringify(c3.data).slice(0, 120)} | ${JSON.stringify(c4.data).slice(0, 80)}`);

  // Máy tạo mẫu PawNail từ nút trong Phòng nội dung
  const callsBefore = calls.length;
  const eng = await admin.req("/api/admin/designs", { method: "POST", json: { count: 3, mode: "engine" } });
  const allDrafts = (await admin.req("/api/admin/designs")).data.drafts;
  const engRows = allDrafts.filter((d) => eng.data.created?.includes(d.id));
  const pawRows = allDrafts.filter((d) => d.provider === "pawnail");
  R.check("D15", "Máy PawNail: tạo 3 mẫu KHÔNG gọi Gemini, hết lượt ảnh trong ngày thì KHÔNG gọi Cloudflare thêm; đủ song ngữ + vật tư + các bước + giá + hoạ tiết", eng.status === 201 && engRows.length === 3 && calls.length === callsBefore && cfCalls.length === 4 &&
    engRows.every((d) => d.provider === "pawnail" && d.titleEn && d.descriptionEn && d.materials.length >= 3 && d.steps.length >= 4 && /^\$\d+–\d+$/.test(d.priceHint) && d.palette.length >= 2 && d.pattern && d.imageUrl === null),
    JSON.stringify(engRows.map((d) => [d.title, d.pattern, d.priceHint])).slice(0, 300));
  R.check("D16", "Máy PawNail: 7 mẫu (cron + nút) không trùng tên, mẫu đầu lô dễ cho thợ mới", pawRows.length === 7 && new Set(pawRows.map((d) => d.title)).size === 7 && pawRows.some((d) => d.difficulty === 1), pawRows.map((d) => d.title).join(" | "));

  // Vẽ lại ảnh (admin) — tối đa 3 lần/mẫu, người thường không gọi được
  const target = pawRows.find((d) => !d.imageUrl) ?? pawRows[0]; // mẫu đang dùng hình minh hoạ → "Vẽ ảnh"
  const cfBefore = cfCalls.length;
  const rd = [];
  for (let k = 0; k < 4; k++) rd.push(await admin.req("/api/admin/designs", { method: "PATCH", json: { id: target.id, action: "redraw" } }));
  const rdTech = await tech.req("/api/admin/designs", { method: "PATCH", json: { id: target.id, action: "redraw" } });
  const after1 = (await admin.req("/api/admin/designs")).data.drafts.find((d) => d.id === target.id);
  R.check("D17", "Vẽ lại ảnh: 3 lần đầu được (đúng khung ảnh mới), lần 4 bị từ chối; thợ gọi → 403", rd.slice(0, 3).every((r) => r.status === 200 && r.data.imageUrl) && rd[3].status === 422 && /3 lần/.test(rd[3].data.error) && rdTech.status === 403 && cfCalls.length - cfBefore === 3 && !!after1?.imageUrl && /resting naturally/.test(cfCalls.at(-1).body.prompt) && cfCalls.at(-1).body.steps === 6,
    JSON.stringify(rd.map((r) => r.status)) + " tech " + rdTech.status);

  const s1 = await tech.req(`/api/designs/${pub[0].id}/save`, { method: "POST" });
  const list1 = (await tech.req("/api/designs")).data.designs.find((d) => d.id === pub[0].id);
  const s2 = await tech.req(`/api/designs/${pub[0].id}/save`, { method: "POST" });
  const sDraft = await tech.req(`/api/designs/${drafts[2].id}/save`, { method: "POST" });
  const sAnon = await anon.req(`/api/designs/${pub[0].id}/save`, { method: "POST" });
  R.check("D12", "Lưu mẫu: lưu/bỏ lưu đếm đúng; mẫu chưa duyệt 404; khách 401", s1.data.saved === true && s1.data.saves === 1 && list1.saved === true && s2.data.saved === false && sDraft.status === 404 && sAnon.status === 401);

  const smp = (await admin.req("/api/admin/designs", { method: "POST", json: { count: 2, mode: "sample" } })).data;
  const smpRows = (await admin.req("/api/admin/designs")).data.drafts.filter((d) => smp.created.includes(d.id));
  R.check("D13", "Mẫu gợi ý (không dùng AI): tạo được dù đã hết hạn mức AI; ưu tiên dịp Halloween; đủ song ngữ + vật tư + bảng màu", smp.created.length === 2 && smpRows.every((d) => d.provider === "sample" && d.titleEn && d.materials.length >= 3 && d.palette.length >= 2) && smpRows.some((d) => d.occasion === "halloween"), JSON.stringify(smpRows.map((d) => [d.title, d.occasion])));
  const smp2 = (await admin.req("/api/admin/designs", { method: "POST", json: { count: 2, mode: "sample" } })).data;
  const titles = (await admin.req("/api/admin/designs")).data.drafts.filter((d) => d.provider === "sample").map((d) => d.title);
  R.check("D14", "Mẫu gợi ý không bị lặp lại", smp2.created.length === 2 && new Set(titles).size === titles.length, titles.join(" | "));

  // ---------- Giao diện ----------
  browser = await chromium.launch();
  const page = async (locale = "vi-VN") => {
    const ctx = await browser.newContext({ ...devices["Pixel 7"], locale });
    if (locale === "en-US") await ctx.addInitScript(() => { try { localStorage.setItem("bitpaw_locale", "en"); } catch {} });
    const ip = fakeIp();
    await ctx.route(BASE_URL + "/**", (route) => route.continue({ headers: { ...route.request().headers(), "cf-connecting-ip": ip } }));
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    p.on("response", (r) => { if (r.status() >= 500 && r.url().startsWith(BASE_URL)) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
    await p.goto(BASE_URL + "/auth/login");
    await p.locator("#email").fill(SEED_TECH);
    await p.locator("#password").fill(DEMO_PASSWORD);
    await p.locator('button[type="submit"]').click();
    await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
    await p.evaluate(() => { sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 })); localStorage.setItem("pn_push_dismissed_at", String(Date.now())); });
    return p;
  };
  const p = await page();
  await p.goto(BASE_URL + "/?tab=feed");
  const strip = p.getByRole("region", { name: "Mẫu nail mới" });
  R.check("U1", "Bảng tin: dải 'Mẫu nail mới mỗi ngày' với mẫu đã duyệt", await strip.waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
  await p.goto(BASE_URL + "/designs");
  await p.getByRole("heading", { name: "Mẫu nail mới" }).waitFor({ timeout: 15000 });
  await p.waitForTimeout(1200);
  const cards = await p.locator("main button.group").count();
  const badges = await p.getByText("Ảnh minh hoạ AI").count();
  R.check("U2", "Trang /designs: đủ 2 mẫu đã duyệt (nháp không hiện), MỌI ảnh có nhãn 'Ảnh minh hoạ AI'", cards === 2 && badges >= 2, `${cards} thẻ, ${badges} nhãn`);
  await p.screenshot({ path: TMP + "/designs_page.png" });
  await p.locator("main button.group").first().click();
  const sheet = p.getByRole("dialog");
  await sheet.waitFor({ timeout: 5000 });
  const txt = await sheet.innerText();
  R.check("U3", "Chi tiết mẫu: vật tư cần chuẩn bị (có số lượng) + các bước + giá gợi ý", /Vật tư cần chuẩn bị/.test(txt) && /1 lọ/.test(txt) && /Các bước làm/.test(txt) && /\$55–70/.test(txt));
  await p.screenshot({ path: TMP + "/designs_sheet.png" });
  await sheet.getByRole("button", { name: /Lưu mẫu/ }).click();
  R.check("U4", "Bấm 'Lưu mẫu' → thành 'Đã lưu'", await sheet.getByRole("button", { name: /Đã lưu/ }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  const href = await sheet.getByRole("link", { name: "Tìm mua" }).first().getAttribute("href");
  R.check("U5", "Vật tư có link 'Tìm mua' sang Kho hàng (lọc theo tên)", /^\/supply\?q=/.test(href || ""), href);
  await sheet.getByRole("button", { name: /Tôi làm mẫu này/ }).click();
  await p.waitForURL(/tab=feed/, { timeout: 10000 });
  const box = p.getByPlaceholder(/Khoe tác phẩm móng mới/);
  await box.waitFor({ timeout: 15000 });
  await p.waitForTimeout(1200);
  const val = await box.inputValue();
  R.check("U6", "'Tôi làm mẫu này' → ô đăng bài điền sẵn hashtag của mẫu", /#PawNail(Halloween|AI)/.test(val), val);
  await p.goto(BASE_URL + `/supply?q=${encodeURIComponent("Gel mắt mèo cam")}`);
  R.check("U7", "Kho hàng mở với bộ lọc 'Đang tìm: …'", await p.getByText(/Đang tìm:/).waitFor({ timeout: 10000 }).then(() => true).catch(() => false));

  const e = await page("en-US");
  await e.goto(BASE_URL + "/designs");
  const enOk = await e.getByRole("heading", { name: "Fresh nail designs" }).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  await e.waitForTimeout(1000);
  const enText = await e.locator("main").innerText();
  R.check("U8", "Tiếng Anh: tiêu đề trang + tên mẫu tiếng Anh + 'AI illustration'", enOk && /Pumpkin cat eye/.test(enText) && /AI illustration/.test(enText) && !/Mắt mèo bí ngô/.test(enText));
  await e.locator("main button.group").first().click();
  const enSheet = await e.getByRole("dialog").innerText().catch(() => "");
  R.check("U8b", "Tiếng Anh: số lượng vật tư cũng tiếng Anh ('1 bottle', không còn '1 lọ')", /1 bottle/.test(enSheet) && !/1 lọ/.test(enSheet), enSheet.slice(0, 200));

  // Admin UI
  const actx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "vi-VN" });
  const ap = await actx.newPage();
  ap.on("pageerror", (er) => errors.push("admin: " + er.message.slice(0, 160)));
  await ap.goto(BASE_URL + "/auth/login");
  await ap.locator("#email").fill(a.body.email);
  await ap.locator("#password").fill(a.body.password);
  await ap.locator('button[type="submit"]').click();
  await ap.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  await ap.goto(BASE_URL + "/admin/studio");
  const sec = ap.getByRole("region", { name: "Mẫu nail mới" });
  await sec.waitFor({ timeout: 15000 });
  await sec.locator("article").first().waitFor({ timeout: 15000 });
  const draftCount = await sec.locator("article").count();
  const svgPreviews = await sec.getByRole("img", { name: "Minh hoạ mẫu nail" }).count();
  const colorBadges = await sec.getByText("Minh hoạ màu", { exact: false }).count();
  const aiTextBadges = await sec.getByText("Ý tưởng AI · minh hoạ màu").count();
  const pawBadges = await sec.getByText("Mẫu PawNail · hình minh hoạ").count();
  const motifs = await sec.locator("svg g[clip-path]").count();
  R.check("U10", "Nháp không có ảnh AI → minh hoạ tự vẽ + nhãn đúng nguồn (AI chữ / mẫu gợi ý / mẫu PawNail); mẫu có ảnh Cloudflare ghi 'Ảnh minh hoạ AI'", svgPreviews >= 8 && colorBadges >= 5 && aiTextBadges >= 1 && pawBadges === 3, svgPreviews + " svg, " + colorBadges + " nhãn màu, " + aiTextBadges + " AI chữ, " + pawBadges + " PawNail");
  const engBtn = sec.getByRole("button", { name: /Tạo 3 mẫu PawNail \(miễn phí\)/ });
  R.check("U11", "Phòng nội dung: nút 'Tạo 3 mẫu PawNail (miễn phí)' bấm được; mẫu có hoạ tiết được vẽ đúng (không chỉ màu trơn)", (await engBtn.isEnabled()) && motifs >= 4, motifs + " móng có hoạ tiết");
  await ap.screenshot({ path: TMP + "/designs_admin_samples.png", fullPage: true });
  await sec.getByRole("button", { name: /Duyệt & đăng/ }).first().click();
  await ap.waitForTimeout(1500);
  const after = (await anon.req("/api/designs")).data.designs.length;
  R.check("U9", "Phòng nội dung: thấy đủ 14 nháp (3 AI + 4 gợi ý + 7 PawNail), bấm 'Duyệt & đăng' → công khai thêm 1 mẫu", draftCount === 14 && after === 3, `${draftCount} nháp, ${after} công khai`);
  await ap.screenshot({ path: TMP + "/designs_admin.png" });

  R.check("Z1", "Không lỗi JS / 5xx", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser?.close();
  gemini.close();
  cf.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
