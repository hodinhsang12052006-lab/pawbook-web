// Kiểm thử đầu-cuối "Ảnh từ Google Flow" (components/designs/FlowImport + /api/admin/designs/flow/*) trên server LOCAL.
// Cloudinary GIẢ ngay trong trình duyệt (page.route): kiểm tra chữ ký thật bằng secret giả của server, đọc kích thước
// JPEG đã thu nhỏ, trả kết quả kiểu Cloudinary và phục vụ lại ảnh — không ảnh nào rời máy, không gọi Cloudinary thật.
//   Server: next start với CLOUDINARY_CLOUD_NAME=<cloud> CLOUDINARY_API_KEY=<số> CLOUDINARY_API_SECRET=<secret giả>
//           và DB là MỘT BẢN SAO SQLite local (TURSO_DATABASE_URL=file:<bản sao>.db).
//   Chạy:   BASE_URL=http://localhost:3217 FLOW_E2E_DB=<cùng file .db> FLOW_E2E_SECRET=<secret giả> node scripts/qa/flow_import_test.mjs
//   Tuỳ chọn: FLOW_E2E_CLOUD (mặc định pawnail-qa) · FLOW_E2E_SAMPLES=a.jpg,b.jpg (ảnh vuông mẫu để làm "ảnh Flow")
//             FLOW_E2E_SHOTS=<thư mục ảnh chụp màn hình>
//             FLOW_E2E_FLOW_DIR=<thư mục ảnh Flow thật đặt tên D001.jpg…> (dùng cho đúng mã đó)
//             FLOW_E2E_CATALOG=<JSON [{id,title,titleEn,pattern,shape,finish,imageUrl}]> tên/ảnh cũ thật cho mẫu lô 2026-11
//             FLOW_E2E_PUBLIC_CDN=1 cho trình duyệt TẢI (GET, chỉ đọc) ảnh cũ công khai trên CDN Cloudinary thật
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) { console.error("❌ Chỉ chạy với server local (BASE_URL=http://localhost:…)"); process.exit(1); }
const DB_FILE = process.env.FLOW_E2E_DB;
const SECRET = process.env.FLOW_E2E_SECRET;
const CLOUD = process.env.FLOW_E2E_CLOUD || "pawnail-qa";
if (!DB_FILE || !/\.db$/i.test(DB_FILE) || !fs.existsSync(DB_FILE) || !SECRET) { console.error("❌ Cần FLOW_E2E_DB (bản sao .db mà server đang dùng) và FLOW_E2E_SECRET"); process.exit(1); }
if (process.env.TURSO_DATABASE_URL) { console.error("❌ Bỏ TURSO_DATABASE_URL (env -u TURSO_DATABASE_URL …) — bài test chỉ ghi vào bản sao DB local"); process.exit(1); }
const SHOTS = process.env.FLOW_E2E_SHOTS || path.join(os.tmpdir(), "flow_import_shots");
fs.mkdirSync(SHOTS, { recursive: true });
const DB_URL = `file:${path.resolve(DB_FILE).replace(/\\/g, "/")}`;
// @prisma/client nạp .env cạnh schema của bản cài (có thể trỏ DB production) nhưng không ghi đè biến đã đặt
Object.assign(process.env, { TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", DATABASE_URL: DB_URL });

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } });
const { chromium } = await import("playwright");
const sharp = (await import("sharp")).default;
const bcrypt = (await import("bcryptjs")).default;
const manifest = JSON.parse(fs.readFileSync("lib/data/flow-briefs-2026-11.json", "utf8"));

let pass = 0, fail = 0;
const ok = (id, d, c, x = "") => { if (c) pass++; else fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + (typeof x === "string" ? x : JSON.stringify(x)).slice(0, 400)}`); };

// ---------------- dữ liệu mẫu trên bản sao DB ----------------
const PASSWORD = "Demo@12345"; // mật khẩu tài khoản mẫu của bộ QA (scripts/qa/lib.mjs)
const ADMIN = "flow.admin@pawnailjobs.demo";
const TECH = "flow.tech@pawnailjobs.demo";
const hash = await bcrypt.hash(PASSWORD, 10);
for (const [email, role] of [[ADMIN, "ADMIN"], [TECH, "TECHNICIAN"]]) {
  await db.user.upsert({ where: { email }, update: { role, password: hash }, create: { email, role, password: hash, name: role === "ADMIN" ? "Flow QA Admin" : "Flow QA Tech", market: "US", state: "CA", city: "San Jose" } });
}
const seedUrl = (name) => `https://res.cloudinary.com/${CLOUD}/image/upload/v1790000000/pawbook/designs/${name}.jpg`;
const PATTERNS = ["solid", "doublefrench", "chromedrops", "lace", "aura", "ombre", "velvet", "marble", "french", "jelly", "stripes", "gemcluster"];
const SHAPES = ["almond", "coffin", "square", "oval"];
const base = (i) => ({ day: "2026-11-01", market: "US", description: "", descriptionEn: "", skills: "Gel-X", difficulty: 2, minutes: 60, priceHint: "$55–70", materials: "[]", steps: "[]", palette: '["#c2185b","#f5f0e8"]', shape: SHAPES[i % 4], finish: i % 3 ? "glossy" : "chrome", pattern: PATTERNS[i % PATTERNS.length], provider: "pawnail", status: "published", publishedAt: new Date(Date.now() - i * 3600e3) });
const seedPrompt = (title) => `${title} nails\n\nProfessional nail salon portfolio photograph[q:8][img:2026-10-20]`;
const d = manifest.slice(0, 12);
const idC = "cflowqa0e2e0outside00000x"; // mẫu ngoài lô 2026-11 → mã = id mẫu
const catalog = new Map((process.env.FLOW_E2E_CATALOG && fs.existsSync(process.env.FLOW_E2E_CATALOG) ? JSON.parse(fs.readFileSync(process.env.FLOW_E2E_CATALOG, "utf8")) : []).map((c) => [c.id, c]));
const real = (id) => { const c = catalog.get(id); return c && String(c.imageUrl ?? "").startsWith("https://res.cloudinary.com/") ? c : null; };
const rows = d.map((b, i) => { const c = real(b.designId); return { ...base(i), ...(c ? { title: c.title, pattern: c.pattern, shape: c.shape, finish: c.finish } : { title: b.title }), id: b.designId, titleEn: b.title, imageUrl: c ? c.imageUrl : seedUrl(`seed_${b.code}`), prompt: seedPrompt(b.title) }; });
// D007 đã có ảnh Flow từ trước (hiện ghi chú "đăng sẽ thay ảnh đó")
const flow7 = `https://res.cloudinary.com/${CLOUD}/image/upload/v1793900000/pawbook/designs-flow/D007_${d[6].designId}.jpg`;
rows[6] = { ...rows[6], imageUrl: flow7, prompt: `${d[6].title} nails\n\nstyle[was:${seedUrl("seed_D007")}][flow:D007:2026-11-05]` };
rows.push({ ...base(12), id: idC, title: "Hồng đào ombre", titleEn: "Peach ombre glaze", imageUrl: seedUrl("seed_outside"), prompt: seedPrompt("Peach ombre glaze") });
for (let i = 0; i < 20; i++) rows.push({ ...base(13 + i), id: `cflowqa0e2e0export${String(i).padStart(2, "0")}0000x`, title: `Mẫu xuất brief ${i + 1}`, titleEn: `Export brief design ${i + 1}`, imageUrl: seedUrl(`seed_x${i}`), prompt: seedPrompt(`Export brief design ${i + 1}`) });
await db.nailDesign.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
await db.nailDesign.createMany({ data: rows });
const seeded = new Map(rows.map((r) => [r.id, r]));
console.log(`seeded ${rows.length} designs + 2 users on ${path.basename(DB_FILE)}`);

// ---------------- ảnh "Flow" thử ----------------
const IMG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "flow_imgs_"));
const samples = (process.env.FLOW_E2E_SAMPLES || "").split(",").filter((f) => f && fs.existsSync(f));
const FLOW_DIR = process.env.FLOW_E2E_FLOW_DIR || "";
async function makeImage(file, w, h, k, fmt) {
  let img;
  const code = file.match(/^D\d{3}/)?.[0];
  const realFlow = code && FLOW_DIR ? path.join(FLOW_DIR, `${code}.jpg`) : "";
  if (realFlow && fs.existsSync(realFlow)) {
    img = sharp(realFlow).resize(w, h, { fit: "cover" });
  } else if (samples.length) {
    img = sharp(samples[k % samples.length]).resize(w, h, { fit: "cover" });
    if (k % 2) img = img.flop();
  } else {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${k * 47},45%,72%)"/><stop offset="1" stop-color="hsl(${k * 47 + 40},40%,48%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="52%" font-size="${Math.round(w / 9)}" text-anchor="middle" fill="#fff" font-family="Arial">${path.parse(file).name}</text></svg>`;
    img = sharp(Buffer.from(svg));
  }
  img = fmt === "png" ? img.png() : fmt === "webp" ? img.webp({ quality: 90 }) : img.jpeg({ quality: 92 });
  const out = path.join(IMG_DIR, file);
  await img.toFile(out);
  return out;
}
const files = [
  ["D001.jpg", 2048, 2048, "jpg"], ["D002.png", 1536, 1536, "png"], ["D003 (1).jpeg", 3000, 3000, "jpg"], ["D004.webp", 1024, 1024, "webp"],
  [`${idC}.jpg`, 2048, 2048, "jpg"], ["D007.jpg", 2048, 2048, "jpg"], ["D005_small.jpg", 800, 800, "jpg"], ["D006_wide.jpg", 2048, 1600, "jpg"],
  ["holiday photo.jpg", 1600, 1600, "jpg"], ["D999.jpg", 1024, 1024, "jpg"], ["D001 (2).jpg", 1024, 1024, "jpg"],
];
const paths = [];
for (let k = 0; k < files.length; k++) paths.push(await makeImage(files[k][0], files[k][1], files[k][2], k, files[k][3]));

// ---------------- Cloudinary giả (trong trình duyệt) ----------------
const store = new Map(); // public_id → Buffer
const uploads = [];
let failNext = null;
const hands = fs.readdirSync("public/hands").filter((f) => f.endsWith(".jpg")).map((f) => fs.readFileSync(path.join("public/hands", f)));
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
function multipart(buf, ctype) {
  const boundary = "--" + (ctype.match(/boundary=([^;]+)/)?.[1] ?? "");
  const out = {};
  let at = buf.indexOf(boundary);
  while (at !== -1) {
    const next = buf.indexOf(boundary, at + boundary.length);
    if (next === -1) break;
    const part = buf.subarray(at + boundary.length + 2, next - 2);
    const sep = part.indexOf("\r\n\r\n");
    const head = part.subarray(0, sep).toString();
    const name = head.match(/name="([^"]+)"/)?.[1];
    if (name) out[name] = /filename=/.test(head) ? part.subarray(sep + 4) : part.subarray(sep + 4).toString();
    at = next;
  }
  return out;
}
async function cloudRoute(route) {
  const req = route.request();
  const u = new URL(req.url());
  if (u.hostname === "api.cloudinary.com" && req.method() === "POST" && u.pathname === `/v1_1/${CLOUD}/image/upload`) {
    const f = multipart(req.postDataBuffer() ?? Buffer.alloc(0), req.headers()["content-type"] ?? "");
    const signed = Object.keys(f).filter((k) => !["file", "api_key", "signature", "resource_type", "cloud_name"].includes(k)).sort().map((k) => `${k}=${f[k]}`).join("&");
    const sigOk = f.signature === sha1(signed + SECRET);
    const fresh = Math.abs(Date.now() / 1000 - Number(f.timestamp)) < 3600;
    const size = Buffer.isBuffer(f.file) ? jpegSize(f.file) : null;
    const rec = { public_id: f.public_id, folder: f.folder, allowed_formats: f.allowed_formats, tags: f.tags, sigOk, fresh, size, bytes: f.file?.length ?? 0, apiKey: f.api_key };
    uploads.push(rec);
    if (!sigOk || !fresh) return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "Invalid Signature" } }) });
    if (failNext && String(f.public_id).startsWith(failNext)) { failNext = null; return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "Mock Cloudinary: temporary failure" } }) }); }
    if (!size) return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: { message: "Invalid image file" } }) });
    const version = Math.round(Date.now() / 1000);
    const pid = `${f.folder}/${f.public_id}`;
    store.set(pid, f.file);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ public_id: pid, version, width: size.w, height: size.h, bytes: f.file.length, format: "jpg", resource_type: "image", secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v${version}/${pid}.jpg` }) });
  }
  if (u.hostname === "res.cloudinary.com" && req.method() === "GET" && u.pathname.startsWith(`/${CLOUD}/image/upload/`)) {
    const pid = u.pathname.replace(/^.*?\/v\d+\//, "").replace(/\.\w+$/, "");
    let body = store.get(pid);
    if (!body && pid.startsWith("pawbook/designs-flow/D007_")) body = fs.readFileSync(paths[5]);
    if (!body) body = hands[Math.abs([...pid].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % hands.length];
    return route.fulfill({ status: 200, contentType: "image/jpeg", body });
  }
  // ảnh cũ CÔNG KHAI trên CDN thật (chỉ khi FLOW_E2E_PUBLIC_CDN=1): GET chỉ đọc
  if (process.env.FLOW_E2E_PUBLIC_CDN === "1" && u.hostname === "res.cloudinary.com" && req.method() === "GET") return route.continue();
  return route.abort(); // mọi host ngoài khác: chặn (không lộ dữ liệu, không gọi dịch vụ thật)
}

// ---------------- đăng nhập + API ----------------
async function login(ctx, email) {
  const csrf = await (await ctx.request.get(`${BASE_URL}/api/auth/csrf`)).json();
  await ctx.request.post(`${BASE_URL}/api/auth/callback/credentials`, { form: { csrfToken: csrf.csrfToken, email, password: PASSWORD, json: "true" } });
  const s = await (await ctx.request.get(`${BASE_URL}/api/auth/session`)).json();
  return s?.user?.email === email;
}
const browser = await chromium.launch();
const mkCtx = (opts = {}) => browser.newContext({ baseURL: BASE_URL, locale: "vi-VN", serviceWorkers: "block", viewport: { width: 1440, height: 900 }, ...opts });
const api = async (ctx, method, p, body) => {
  const r = await ctx.request.fetch(`${BASE_URL}${p}`, { method, ...(body !== undefined ? { data: body } : {}) });
  let j = null;
  try { j = await r.json(); } catch { /* not json */ }
  return { s: r.status(), j };
};
const ENDPOINTS = [["GET", "/api/admin/designs/flow"], ["POST", "/api/admin/designs/flow/sign", { code: "D001" }], ["POST", "/api/admin/designs/flow/import", { code: "D001" }], ["POST", "/api/admin/designs/flow/undo", { designId: d[0].designId }]];

const anon = await mkCtx();
const anonSt = [];
for (const [m, p, b] of ENDPOINTS) anonSt.push((await api(anon, m, p, b)).s);
ok("S1", "khách chưa đăng nhập → 403 cả 4 API", anonSt.every((s) => s === 403), anonSt);
const tech = await mkCtx();
ok("S2", "đăng nhập tài khoản thợ (không phải admin)", await login(tech, TECH));
const techSt = [];
for (const [m, p, b] of ENDPOINTS) techSt.push((await api(tech, m, p, b)).s);
ok("S3", "tài khoản không phải ADMIN → 403 cả 4 API", techSt.every((s) => s === 403), techSt);

const admin = await mkCtx();
ok("S4", "đăng nhập admin", await login(admin, ADMIN));
const g0 = await api(admin, "GET", "/api/admin/designs/flow");
ok("S5", "admin GET: 213 dòng lô 2026-11, 1 mẫu đã có ảnh Flow (D007), có Cloudinary", g0.s === 200 && g0.j.rows.length === 213 && g0.j.imported === 1 && g0.j.storage === true && g0.j.rows[6].flow?.code === "D007", { s: g0.s, imported: g0.j?.imported });
const sg = await api(admin, "POST", "/api/admin/designs/flow/sign", { code: "d001" });
const p = sg.j?.params ?? {};
const signedStr = Object.keys(p).sort().map((k) => `${k}=${p[k]}`).join("&");
ok("S6", "chữ ký: thư mục pawbook/designs-flow, jpg/png/webp, public_id theo mẫu, timestamp mới, ký đúng", sg.s === 200 && p.folder === "pawbook/designs-flow" && p.allowed_formats === "jpg,png,webp" && p.public_id === `D001_${d[0].designId}` && Math.abs(Date.now() / 1000 - p.timestamp) < 30 && sg.j.signature === sha1(signedStr + SECRET) && sg.j.uploadUrl === `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, sg.j);
ok("S7", "phản hồi chữ ký không chứa secret", !JSON.stringify(sg.j).includes(SECRET));
ok("S8", "ký mã lạ → 400, mã đúng nhưng mẫu không có → 404", (await api(admin, "POST", "/api/admin/designs/flow/sign", { code: "D999" })).s === 400 && (await api(admin, "POST", "/api/admin/designs/flow/sign", { code: "D213" })).s === 404);
const nowS = Math.round(Date.now() / 1000);
const forged = { code: "D001", secure_url: `https://res.cloudinary.com/someone-else/image/upload/v${nowS}/pawbook/designs-flow/D001_${d[0].designId}.jpg`, public_id: `pawbook/designs-flow/D001_${d[0].designId}`, width: 2048, height: 2048, bytes: 1000 };
const f1 = await api(admin, "POST", "/api/admin/designs/flow/import", forged);
const f2 = await api(admin, "POST", "/api/admin/designs/flow/import", { ...forged, secure_url: forged.secure_url.replace("someone-else", CLOUD), height: 1500 });
const row1 = await db.nailDesign.findUnique({ where: { id: d[0].designId } });
ok("S9", "nhập link kho Cloudinary khác / ảnh không vuông → 422, mẫu không đổi", f1.s === 422 && f2.s === 422 && row1.imageUrl === seeded.get(d[0].designId).imageUrl && row1.prompt === seeded.get(d[0].designId).prompt, [f1.s, f2.s]);
const old0 = (await api(admin, "GET", "/api/admin/designs")).j?.oldImages;

// ---------------- trình duyệt: kéo ảnh → xem lại → đăng → thử lại → hoàn tác ----------------
await admin.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
await admin.route(/^https:\/\/(api|res)\.cloudinary\.com\//, cloudRoute);
await admin.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => (/cloudinary\.com/.test(r.request().url()) ? r.fallback() : r.abort()));
const page = await admin.newPage();
// chụp khu ảnh Flow không bị thanh điều hướng dính (sticky/fixed) đè lên
async function shot(locator, file, pg = page) {
  await locator.scrollIntoViewIfNeeded(); // nút "lên đầu trang"… chỉ hiện khi đã cuộn → cho hiện trước rồi mới ẩn
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { for (const el of document.querySelectorAll("body *")) { if (el.closest("#anh-flow")) continue; const pos = getComputedStyle(el).position; if (pos === "fixed" || pos === "sticky") { el.setAttribute("data-qa-hidden", el.style.display || "-"); el.style.setProperty("display", "none", "important"); } } });
  await locator.screenshot({ path: path.join(SHOTS, file) });
  await pg.evaluate(() => { for (const el of document.querySelectorAll("[data-qa-hidden]")) { const v = el.getAttribute("data-qa-hidden"); el.style.removeProperty("display"); if (v !== "-") el.style.display = v; el.removeAttribute("data-qa-hidden"); } });
}
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));
await page.goto("/admin/studio", { waitUntil: "domcontentloaded" });
const panel = page.locator("#anh-flow");
await panel.waitFor({ timeout: 60_000 });
await page.getByTestId("flow-progress").waitFor();
await page.getByTestId("flow-files").setInputFiles(paths);
const cards = panel.getByTestId("flow-card");
await page.waitForFunction((n) => document.querySelectorAll('[data-testid="flow-card"]').length === n && ![...document.querySelectorAll('[data-testid="flow-status"]')].some((e) => /kiểm tra|Checking/.test(e.textContent || "")), files.length, { timeout: 30_000 });
const card = (code, nth = 0) => panel.locator(`[data-testid="flow-card"][data-code="${code}"]`).nth(nth);
const status = async (code, nth = 0) => (await card(code, nth).getByTestId("flow-status").textContent())?.trim();
const checked = async (code, nth = 0) => card(code, nth).locator('input[type="checkbox"]').isChecked();
ok("B1", `${files.length} ảnh hiện trong lưới xem lại`, (await cards.count()) === files.length);
const blocked = [["D005", "nhỏ hơn 1024"], ["D006", "không vuông"], ["", "Không đọc được mã"], ["D999", "Không có mẫu"]];
const blockedOk = [];
for (const [code, why] of blocked) blockedOk.push((await card(code).textContent()).includes(why) && (await card(code).locator('input[type="checkbox"]').isDisabled()));
blockedOk.push((await card("D001", 1).textContent()).includes("Trùng mẫu"));
ok("B2", "ảnh nhỏ / không vuông / không mã / mã không có mẫu / trùng mẫu → không chọn được, có lý do", blockedOk.every(Boolean), blockedOk);
const def = [];
for (const c of ["D001", "D002", "D003", "D004", idC]) def.push(await checked(c));
ok("B3", "ảnh hợp lệ được chọn sẵn; D007 (đã có ảnh Flow) không chọn sẵn và có ghi chú", def.every(Boolean) && !(await checked("D007")) && (await card("D007").textContent()).includes("đã có ảnh Flow"), def);
ok("B4", "cột ẢNH CŨ / ẢNH MỚI + tên mẫu từ DB", (await card("D001").textContent()).includes(d[0].title) && (await card("D001").locator("img").count()) === 2 && (await card(idC).textContent()).includes("Peach ombre glaze"));
await page.waitForTimeout(800); // ảnh xem trước tải xong
await shot(panel, "flow_review_1440.png");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok("B5", "390px: không tràn ngang", overflow <= 0, overflow);
await shot(panel, "flow_review_390.png");
await page.setViewportSize({ width: 1440, height: 900 });

await card("D004").locator('input[type="checkbox"]').uncheck(); // bỏ chọn 1 ảnh
ok("B6", "chọn tất cả hiện đúng số đã chọn (4/6)", (await page.getByTestId("flow-select-all").locator("xpath=..").textContent()).includes("(4/6)"));
failNext = "D002_"; // lần tải D002 đầu tiên lỗi → kiểm tra nút Thử lại
await page.getByTestId("flow-publish").click();
await page.waitForFunction(() => { const s = [...document.querySelectorAll('[data-testid="flow-status"]')].map((e) => e.textContent || ""); return !s.some((t) => /Đang tải lên|Đang lưu/.test(t)) && s.filter((t) => /Đã đăng|Lỗi/.test(t)).length >= 4; }, null, { timeout: 60_000 });
ok("B7", "đăng: D001, D003, mẫu ngoài lô → Đã đăng; D002 lỗi Cloudinary → Lỗi + nút Thử lại; D004 (bỏ chọn) không đụng", (await status("D001")) === "Đã đăng" && (await status("D003")) === "Đã đăng" && (await status(idC)) === "Đã đăng" && (await status("D002")) === "Lỗi" && (await status("D004")) === "Sẵn sàng" && (await card("D002").getByRole("button", { name: /Thử lại/ }).count()) === 1, [await status("D001"), await status("D002"), await status("D003"), await status("D004"), await status(idC)]);
await card("D002").getByRole("button", { name: /Thử lại/ }).click();
await page.waitForFunction(() => /Đã đăng/.test(document.querySelector('[data-testid="flow-card"][data-code="D002"] [data-testid="flow-status"]')?.textContent || ""), null, { timeout: 30_000 });
ok("B8", "Thử lại D002 → Đã đăng", (await status("D002")) === "Đã đăng");
await page.waitForTimeout(500);
await shot(panel, "flow_published_1440.png");

const goodUps = uploads.filter((u) => u.sigOk);
const d3 = uploads.find((u) => u.public_id === `D003_${d[2].designId}`);
ok("C1", "mọi lần tải lên đều ký đúng, đúng thư mục/định dạng, khoá API công khai đúng", uploads.length === 5 && goodUps.length === 5 && uploads.every((u) => u.folder === "pawbook/designs-flow" && u.allowed_formats === "jpg,png,webp" && u.tags === "pawnail-flow" && u.fresh && u.apiKey === "123456789012345"), uploads);
ok("C2", "trình duyệt thu nhỏ 3000px → 2048px JPEG; PNG/ảnh 2048 cũng thành JPEG ≤ 2048", d3?.size?.w === 2048 && d3?.size?.h === 2048 && uploads.every((u) => u.size && Math.max(u.size.w, u.size.h) <= 2048), d3);
const after = await db.nailDesign.findMany({ where: { id: { in: [d[0].designId, d[1].designId, d[2].designId, d[3].designId, idC] } } });
const by = new Map(after.map((r) => [r.id, r]));
const isFlowRow = (id, code) => { const r = by.get(id); return r.imageUrl.startsWith(`https://res.cloudinary.com/${CLOUD}/image/upload/v`) && r.imageUrl.includes("/pawbook/designs-flow/") && r.prompt.includes(`[was:${seeded.get(id).imageUrl}]`) && r.prompt.endsWith(`[flow:${code}:${new Date().toISOString().slice(0, 10)}]`) && !/\[(q|img):/.test(r.prompt); };
ok("C3", "DB: 4 mẫu đổi sang ảnh Flow, ảnh cũ cất trong [was:], gỡ [q:][img:]; D004 không đổi", isFlowRow(d[0].designId, "D001") && isFlowRow(d[1].designId, "D002") && isFlowRow(d[2].designId, "D003") && isFlowRow(idC, idC) && by.get(d[3].designId).prompt === seeded.get(d[3].designId).prompt);
const r1 = by.get(d[0].designId);
const pid1 = r1.imageUrl.replace(/^.*?\/v\d+\//, "").replace(/\.jpg$/, "");
const again = await api(admin, "POST", "/api/admin/designs/flow/import", { code: "D001", secure_url: r1.imageUrl, public_id: pid1, width: 2048, height: 2048, bytes: 500000 });
const r1b = await db.nailDesign.findUnique({ where: { id: d[0].designId } });
ok("C4", "nhập lại đúng ảnh → unchanged, prompt y nguyên", again.s === 200 && again.j.unchanged === true && r1b.prompt === r1.prompt, again);
const pub = await api(admin, "GET", "/api/designs?limit=60");
const p1 = pub.j?.designs?.find((x) => x.id === d[0].designId);
ok("C5", "API công khai: ảnh Flow → rendered=false (nhãn 'Ảnh minh hoạ AI'), imageSource 'flow'", p1?.imageSource === "flow" && p1?.rendered === false && p1?.imageUrl === r1.imageUrl, p1 && { s: p1.imageSource, r: p1.rendered });
const old1 = (await api(admin, "GET", "/api/admin/designs")).j?.oldImages;
ok("C6", "bộ đếm 'ảnh cũ chờ máy vẽ lại' bỏ 4 ảnh Flow vừa nhập", typeof old0 === "number" && old0 - old1 === 4, { old0, old1 });

await card("D002").getByTestId("flow-undo").click();
await page.waitForFunction(() => /Đã hoàn tác/.test(document.querySelector('[data-testid="flow-card"][data-code="D002"] [data-testid="flow-status"]')?.textContent || ""), null, { timeout: 20_000 });
const r2 = await db.nailDesign.findUnique({ where: { id: d[1].designId } });
ok("H1", "Hoàn tác D002 → ảnh cũ + prompt cũ khớp từng ký tự", r2.imageUrl === seeded.get(d[1].designId).imageUrl && r2.prompt === seeded.get(d[1].designId).prompt, r2.prompt);
await page.waitForTimeout(600);
const imported = panel.locator("details").filter({ hasText: "Ảnh Flow đã đăng" });
ok("H2", "danh sách 'Ảnh Flow đã đăng' (lô 2026-11): D001, D003, D007", (await imported.locator("summary").textContent()).includes("(3)"), await imported.locator("summary").textContent());
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByTestId("flow-progress").waitFor({ timeout: 60_000 });
ok("H3", "tải lại trang: tiến độ lô 3/213", (await page.getByTestId("flow-progress").textContent()).includes("3/213"), await page.getByTestId("flow-progress").textContent());

const exp = page.locator("#anh-flow details").filter({ hasText: "Xuất brief" });
await exp.locator("summary").click();
await exp.getByTestId("flow-export-count").waitFor({ timeout: 20_000 });
const ta = exp.locator("textarea");
const text = await ta.inputValue();
const pubNonFlow = await db.nailDesign.count({ where: { status: "published", NOT: [{ prompt: { contains: "[flow:" } }] } });
ok("E1", `xuất brief: ${pubNonFlow} mẫu chưa có ảnh Flow → lô 12, mã = id mẫu, dặn đổi tên ảnh đúng mã`, (await exp.getByTestId("flow-export-count").textContent()).includes(`${pubNonFlow} mẫu · ${Math.ceil(pubNonFlow / 12)} lô`) && /rename each created image to exactly its brief code \(e\.g\. c[a-z0-9]{24}\)/.test(text) && (text.match(/\[c[a-z0-9]{20,31}\] /g) ?? []).length === Math.min(12, pubNonFlow) && !/knit/i.test(text), text.slice(0, 200));
await exp.getByRole("button", { name: /Sao chép lô này/ }).click();
const clip = await page.evaluate(() => navigator.clipboard.readText());
ok("E2", "Sao chép lô này → đúng nội dung lô", clip === text);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await shot(panel, "flow_export_390.png");
ok("E3", "390px (khu xuất brief mở): không tràn ngang", (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);

const en = await mkCtx({ locale: "en-US" });
await login(en, ADMIN);
await en.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, cloudRoute);
const pe = await en.newPage();
await pe.goto("/admin/studio", { waitUntil: "domcontentloaded" });
const enOk = await pe.locator("#anh-flow").getByText("Images from Google Flow").first().waitFor({ timeout: 60_000 }).then(() => true).catch(() => false);
const enText = enOk ? await pe.locator("#anh-flow").textContent() : "";
ok("I1", "trình duyệt tiếng Anh: khu ảnh Flow hiện tiếng Anh (tr(vi, en))", enOk && enText.includes("Drop images here or click to choose") && enText.includes("Export briefs for Flow"), enText.slice(0, 120));
await shot(pe.locator("#anh-flow"), "flow_panel_en_1440.png", pe);
ok("Z1", "không lỗi JavaScript trên trang admin", !errors.length, errors);

await browser.close();
await db.$disconnect();
fs.rmSync(IMG_DIR, { recursive: true, force: true });
console.log(`\nscreenshots: ${SHOTS}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
