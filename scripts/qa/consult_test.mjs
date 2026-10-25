// "Soi tay tư vấn": AI nhìn ảnh (Gemini → dự phòng Cloudflare, cả 2 đều GIẢ), bộ quy tắc tư vấn,
// cảnh báo phải ngừng, so khớp mẫu + menu, quyền truy cập, giao diện trên điện thoại.
// CHỈ chạy với server local (bash scripts/qa/start-launch-server.sh).   node scripts/qa/consult_test.mjs
import http from "node:http";
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, Results, fakeIp } from "./lib.mjs";

if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error("consult_test chỉ chạy với server local");
const R = new Results("Soi tay tư vấn");
const TMP = process.env.TEMP || ".";

// ---------- AI giả ----------
let geminiMode = "ok"; // ok | fail | not_target
let cfMode = "ok";
let answer = {};
const calls = { gemini: [], cf: [] };
const vision = (over = {}) => ({ isTarget: true, skinTone: "light", undertone: "cool", fingerLength: "short", bedWidth: "wide", nailLength: "short", currentShape: "round", hasProduct: false, conditions: [], note: "Móng ngắn, mặt móng mỏng.", ...over });
const gemini = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const body = JSON.parse(b || "{}");
    const parts = body.contents?.[0]?.parts ?? [];
    calls.gemini.push({ hasImage: parts.some((p) => p.inlineData?.data?.length > 100), mime: parts.find((p) => p.inlineData)?.inlineData?.mimeType, prompt: parts.find((p) => p.text)?.text ?? "", schema: !!body.generationConfig?.responseSchema });
    res.setHeader("content-type", "application/json");
    if (geminiMode === "fail") return res.writeHead(429).end(JSON.stringify({ error: { message: "quota" } }));
    const out = geminiMode === "not_target" ? vision({ isTarget: false }) : answer;
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] }));
  });
}).listen(4993);
const cf = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const body = JSON.parse(b || "{}");
    const content = body.messages?.[1]?.content;
    calls.cf.push({ url: req.url, hasImage: Array.isArray(content) && content.some((c) => c.type === "image_url" && /^data:image\/jpeg;base64,/.test(c.image_url?.url || "")) });
    res.setHeader("content-type", "application/json");
    if (cfMode === "fail") return res.writeHead(500).end(JSON.stringify({ success: false, errors: [{ message: "down" }] }));
    res.end(JSON.stringify({ success: true, result: { response: { ...answer, note: "cloudflare" } } }));
  });
}).listen(4992);

// ---------- Dữ liệu mẫu (DB LOCAL) ----------
const db = createClient({ url: "file:prisma/dev.db" });
await db.execute("PRAGMA busy_timeout = 10000");
const IMG = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
const QA = [
  { id: "qa-consult-1", title: "QA Hồng sữa squoval", shape: "squoval", finish: "glossy", palette: ["#F4C2C2", "#F7F3F0"], skills: "Builder gel,Design", difficulty: 1 },
  { id: "qa-consult-2", title: "QA Stiletto đỏ đậm", shape: "stiletto", finish: "chrome", palette: ["#6B0F1A"], skills: "Bột/Acrylic", difficulty: 3 },
  { id: "qa-consult-3", title: "QA Chân vuông đỏ", shape: "square", finish: "glossy", palette: ["#A0322A"], skills: "Chân tay nước", difficulty: 1 },
  { id: "qa-consult-4", title: "QA Almond lavender", shape: "almond", finish: "cateye", palette: ["#C8A2C8"], skills: "Gel-X", difficulty: 2 },
];
for (const d of QA) {
  await db.execute({ sql: `DELETE FROM "NailDesign" WHERE id = ?`, args: [d.id] });
  await db.execute({
    sql: `INSERT INTO "NailDesign" (id, day, market, title, titleEn, description, descriptionEn, skills, difficulty, minutes, priceHint, materials, steps, imageUrl, palette, shape, finish, provider, prompt, status, publishedAt, createdAt)
          VALUES (?, '2026-10-16', 'US', ?, ?, 'Mẫu thử', 'Test', ?, ?, 60, '$45', '[]', '[]', ?, ?, ?, ?, 'sample', 'qa', 'published', ?, ?)`,
    args: [d.id, d.title, d.title, d.skills, d.difficulty, IMG, JSON.stringify(d.palette), d.shape, d.finish, Date.now() + 1000, Date.now()],
  });
}

const browser = await chromium.launch();
async function login(email, device = { viewport: { width: 1280, height: 860 } }) {
  const ctx = await browser.newContext({ ...device, locale: "vi-VN" });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  let me = null;
  if (email) {
    const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
    await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
    me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, me, h, page, errors };
}
const tech = await login(SEED_TECH, devices["iPhone 13"]);
const owner = await login(SEED_OWNER);
const guest = await login(null);
const api = (who, data) => who.ctx.request.post(BASE_URL + "/api/consult", { headers: who.h, data });

// Ảnh JPEG thật (vẽ bằng canvas) để gửi
const jpgB64 = await guest.page.evaluate(() => {
  const c = document.createElement("canvas"); c.width = 640; c.height = 480;
  const g = c.getContext("2d"); g.fillStyle = "#e9c2a6"; g.fillRect(0, 0, 640, 480);
  g.fillStyle = "#f4c2c2"; for (let i = 0; i < 5; i++) g.fillRect(90 + i * 100, 80, 50, 90);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
});
const IMAGE = `data:image/jpeg;base64,${jpgB64}`;
const jpgPath = `${TMP}/qa_hand.jpg`;
fs.writeFileSync(jpgPath, Buffer.from(jpgB64, "base64"));

// Menu của thợ: 1 mẫu builder gel squoval (phải được gợi ý), 1 mẫu chân (không gợi ý cho tay)
for (const it of (await (await tech.ctx.request.get(BASE_URL + `/api/menu?userId=${tech.me.id}`, { headers: tech.h })).json()).items || []) if (/^QA /.test(it.name)) await tech.ctx.request.delete(BASE_URL + `/api/menu/${it.id}`, { headers: tech.h });
const mk = async (data) => (await (await tech.ctx.request.post(BASE_URL + "/api/menu", { headers: tech.h, data })).json()).item?.id;
const menuIds = [await mk({ category: "HAND", name: "QA Builder gel squoval hồng sữa", technique: "Builder gel", priceFrom: 50 }), await mk({ category: "FOOT", name: "QA Pedi đỏ", technique: "Gel", priceFrom: 35 })];

// ---------- API ----------
const g401 = await api(guest, { image: IMAGE });
const bad = await api(tech, { image: "data:text/html;base64,PHNjcmlwdD4=" });
const big = await api(tech, { image: "data:image/jpeg;base64," + "A".repeat(2_900_000) });
const none = await api(tech, {});
R.check("C1", "Chưa đăng nhập → 401; ảnh không phải JPG/PNG/WebP → 400; ảnh quá lớn → 413; thiếu ảnh → 400", g401.status() === 401 && bad.status() === 400 && big.status() === 413 && none.status() === 400, [g401.status(), bad.status(), big.status(), none.status()].join(" "));

answer = vision({ conditions: [{ id: "thin_peeling", confidence: 0.9 }, { id: "dry_cuticles", confidence: 0.8 }, { id: "ridges", confidence: 0.3 }, { id: "khong-co-ma-nay", confidence: 1 }] });
const r1 = await api(tech, { image: IMAGE, part: "HAND", prefs: { vibe: "natural" } });
const d1 = await r1.json();
const g1 = calls.gemini.at(-1);
R.check("C2", "Gemini nhận đúng ảnh JPEG + lời dặn chỉ quan sát + schema JSON", g1?.hasImage && g1.mime === "image/jpeg" && /Do not guess/.test(g1.prompt) && g1.schema, JSON.stringify({ ...g1, prompt: g1?.prompt.slice(0, 40) }));
R.check("C3", "Kết quả: bỏ tình trạng độ tin cậy thấp / mã lạ; móng mỏng → Builder gel, dáng vuông bo góc, có bước gia cố", r1.ok() && d1.provider === "gemini"
  && JSON.stringify(d1.perception.conditions.sort()) === JSON.stringify(["dry_cuticles", "thin_peeling"])
  && d1.advice.technique.id === "Builder gel" && d1.advice.shapes[0].id === "squoval" && d1.advice.steps.some((s) => /builder/i.test(s.title[1])) && !d1.advice.avoidShapes.includes("squoval"),
  JSON.stringify({ s: r1.status(), p: d1.perception?.conditions, t: d1.advice?.technique?.id, sh: d1.advice?.shapes?.map((x) => x.id) }));
const ids1 = (d1.designs || []).map((d) => d.id);
R.check("C4", "Mẫu gợi ý: mẫu squoval hồng (hợp) đứng trước; stiletto bột (móng yếu nên tránh) và mẫu chân KHÔNG được gợi ý", ids1.indexOf("qa-consult-1") === 0 && !ids1.includes("qa-consult-2") && !ids1.includes("qa-consult-3"), ids1.slice(0, 6).join(","));
R.check("C5", "Gợi ý luôn mẫu trong MENU của thợ hợp với tay khách (mẫu chân bị loại)", d1.menu?.length === 1 && d1.menu[0].name === "QA Builder gel squoval hồng sữa" && d1.menuTotal >= 2, JSON.stringify(d1.menu?.map((m) => m.name)));
R.check("C6", "Không trả lại ảnh trong kết quả (ảnh không được lưu / phát tán)", !JSON.stringify(d1).includes(jpgB64.slice(0, 200)));

geminiMode = "fail";
const r2 = await api(tech, { image: IMAGE, part: "HAND" });
const d2 = await r2.json();
R.check("C7", "Gemini lỗi → tự chuyển sang Cloudflare (gửi kèm ảnh), vẫn ra kết quả", r2.ok() && d2.provider === "cloudflare" && calls.cf.at(-1)?.hasImage && /llama-4-scout/.test(calls.cf.at(-1)?.url || ""), `${r2.status()} ${d2.provider} ${JSON.stringify(calls.cf.at(-1))}`);
cfMode = "fail";
const r3 = await api(tech, { image: IMAGE, part: "HAND" });
const d3 = await r3.json();
R.check("C8", "Cả 2 AI lỗi → 503 AI_UNAVAILABLE (giao diện chuyển sang tự chọn)", r3.status() === 503 && d3.code === "AI_UNAVAILABLE", `${r3.status()} ${JSON.stringify(d3)}`);
geminiMode = "not_target"; cfMode = "ok";
const r4 = await api(tech, { image: IMAGE, part: "HAND" });
R.check("C9", "Ảnh không phải bàn tay → 422 kèm hướng dẫn chụp lại", r4.status() === 422 && /chụp/.test((await r4.json()).error), String(r4.status()));
geminiMode = "ok";

answer = vision({ conditions: [{ id: "possible_fungus", confidence: 0.8 }, { id: "cracked_skin", confidence: 0.7 }] });
const d5 = await (await api(owner, { image: IMAGE, part: "HAND" })).json();
R.check("C10", "Nghi nấm móng → cảnh báo DỪNG (bước đầu tiên, khuyên gặp bác sĩ); chủ tiệm cũng dùng được", d5.advice?.redFlags?.includes("possible_fungus") && d5.advice.steps[0].flag === true && /bác sĩ/.test(d5.advice.steps[0].detail[0]), JSON.stringify(d5.advice?.steps?.[0]).slice(0, 120));

const before = calls.gemini.length + calls.cf.length;
const d6 = await (await api(tech, { perception: { ...vision(), conditions: ["bitten", "calluses"] }, part: "FOOT" })).json();
R.check("C11", "Thợ tự chọn / sửa → tính lại KHÔNG gọi AI; móng chân: dáng vuông, bỏ tình trạng chỉ của tay, gợi ý mẫu chân", calls.gemini.length + calls.cf.length === before && d6.provider === "manual"
  && d6.advice.shapes[0].id === "square" && JSON.stringify(d6.perception.conditions) === JSON.stringify(["calluses"]) && d6.designs?.[0]?.id === "qa-consult-3" && d6.menu?.[0]?.name === "QA Pedi đỏ",
  JSON.stringify({ sh: d6.advice?.shapes?.[0]?.id, c: d6.perception?.conditions, d: d6.designs?.[0]?.id, m: d6.menu?.[0]?.name }));

// ---------- Giao diện (iPhone) ----------
answer = vision({ conditions: [{ id: "thin_peeling", confidence: 0.9 }, { id: "dry_cuticles", confidence: 0.8 }] });
const p = tech.page;
await p.goto(BASE_URL + "/consult");
await p.getByRole("button", { name: "Chụp tay khách" }).click({ timeout: 20000 });
const warned = await p.getByText(/Khách đồng ý/).first().isVisible();
const toastShown = await p.getByText(/trước khi chụp/).waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
R.check("C12", "Chưa tích “Khách đồng ý” → không cho chụp, nhắc hỏi ý khách", warned && toastShown, JSON.stringify({ warned, toastShown }));
await p.getByRole("button", { name: "Tự nhiên" }).click();
await p.getByRole("checkbox", { name: /Khách đồng ý/ }).check();
const nGem = calls.gemini.length;
// Ghi lại hễ chữ "Đang soi" từng hiện: AI giả trả lời trong vài ms trên máy rảnh → hỏi lại theo chu kỳ dễ trượt mất
await p.evaluate(() => {
  window.__sawScan = false;
  new MutationObserver(() => { if (document.body.textContent.includes("Đang soi tay khách…")) window.__sawScan = true; }).observe(document.body, { childList: true, subtree: true, characterData: true });
});
await p.locator('input[type=file][capture]').setInputFiles(jpgPath);
const scanning = await p.waitForFunction(() => window.__sawScan, null, { timeout: 5000 }).then(() => true).catch(() => false);
await p.getByText("Hợp với khách").waitFor({ timeout: 20000 }).catch(() => {});
const ui = await p.evaluate(() => document.body.textContent);
const sentSmall = calls.gemini.length === nGem + 1;
R.check("C13", "Chụp → hiệu ứng đang soi → kết quả: tình trạng, Builder gel, dáng hợp nhất, màu, quy trình, menu của thợ, mẫu PawNail, dặn khách",
  scanning && sentSmall && ["Móng mỏng, tách lớp", "Builder gel", "Hợp nhất", "Màu hợp da", "Quy trình đề xuất", "Từ menu của bạn", "QA Builder gel squoval hồng sữa", "Mẫu hợp với tay khách", "Dặn khách"].every((s) => ui.includes(s)),
  JSON.stringify({ scanning, sentSmall, miss: ["Móng mỏng, tách lớp", "Builder gel", "Hợp nhất", "Màu hợp da", "Quy trình đề xuất", "Từ menu của bạn", "QA Builder gel squoval hồng sữa", "Mẫu hợp với tay khách", "Dặn khách"].filter((s) => !ui.includes(s)) }));

const nAll = calls.gemini.length + calls.cf.length;
await p.getByRole("button", { name: "Sửa kết quả" }).click();
await p.getByRole("button", { name: "Nghi nấm móng" }).click();
const stop = await p.getByRole("alert").filter({ hasText: "Cần dừng lại" }).waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
await p.waitForTimeout(1200);
R.check("C14", "Thợ bấm sửa → bật “Nghi nấm móng” → hiện ngay khung “Cần dừng lại”, không gọi lại AI", stop && calls.gemini.length + calls.cf.length === nAll, JSON.stringify({ stop }));

const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await p.screenshot({ path: `${TMP}/consult_result.png`, fullPage: true }).catch(() => {});
await p.getByRole("button", { name: "Soi khách khác" }).click();
const back = await p.getByRole("button", { name: "Chụp tay khách" }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
R.check("C15", "Điện thoại không tràn ngang; “Soi khách khác” quay về màn chụp", ov <= 1 && back, JSON.stringify({ ov, back }));

// AI bận → giao diện chuyển sang tự chọn, vẫn có gợi ý
geminiMode = "fail"; cfMode = "fail";
await p.getByRole("checkbox", { name: /Khách đồng ý/ }).check();
await p.locator('input[type=file][capture]').setInputFiles(jpgPath);
const manualMode = await p.getByText("Thợ tự chọn").waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
const editorOpen = await p.getByText("Tình trạng (bấm để bật / tắt)").isVisible().catch(() => false);
R.check("C16", "Cả 2 AI lỗi → app không bế tắc: mở chế độ thợ tự chọn tình trạng, vẫn có quy trình + mẫu", manualMode && editorOpen && (await p.getByText("Quy trình đề xuất").count()) === 1, JSON.stringify({ manualMode, editorOpen }));
geminiMode = "ok"; cfMode = "ok";

// Khách / người chưa đăng nhập; lối vào từ công cụ trang chủ (điện thoại)
await guest.page.goto(BASE_URL + "/consult");
const gate = await guest.page.getByRole("link", { name: "Đăng nhập" }).last().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
await p.goto(BASE_URL + "/?tab=feed");
const entry = await p.getByRole("navigation", { name: "Công cụ" }).getByRole("link", { name: /Soi tay tư vấn/ }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
R.check("C17", "Người chưa đăng nhập vào /consult → mời đăng nhập; thợ có lối tắt “Soi tay tư vấn” ở trang chủ", gate && entry, JSON.stringify({ gate, entry }));

const errs = [...tech.errors, ...owner.errors, ...guest.errors];
R.check("C18", "Không có lỗi JavaScript", errs.length === 0, errs.join(" | "));

// Dọn
for (const id of menuIds.filter(Boolean)) await tech.ctx.request.delete(BASE_URL + `/api/menu/${id}`, { headers: tech.h });
for (const d of QA) await db.execute({ sql: `DELETE FROM "NailDesign" WHERE id = ?`, args: [d.id] });
fs.rmSync(jpgPath, { force: true });
await browser.close();
gemini.close(); cf.close();
const s = R.summary();
process.exit(s.failed ? 1 : 0);
