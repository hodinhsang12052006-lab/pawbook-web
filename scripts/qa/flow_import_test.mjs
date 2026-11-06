// Kiểm thử đầu-cuối "Ảnh từ Google Flow" (components/designs/FlowImport + /api/admin/designs/flow/*) trên server LOCAL.
// Cloudinary GIẢ ngay trong trình duyệt (page.route): kiểm tra chữ ký thật bằng secret giả của server, đọc kích thước
// JPEG đã thu nhỏ, trả kết quả kiểu Cloudinary (kèm chữ ký phản hồi) và phục vụ lại ảnh — không ảnh nào rời máy,
// không gọi Cloudinary thật.
//   Server: next start với CLOUDINARY_CLOUD_NAME=<cloud> CLOUDINARY_API_KEY=<số> CLOUDINARY_API_SECRET=<secret giả>
//           và DB là MỘT BẢN SAO SQLite local trong thư mục tạm (TURSO_DATABASE_URL=file:<bản sao>.db).
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
// bài test GHI vào DB (tạo tài khoản, thay mẫu) → chỉ nhận BẢN SAO trong thư mục tạm, không bao giờ prisma/dev.db (git)
const realp = (f) => { try { return fs.realpathSync.native(f).toLowerCase(); } catch { return path.resolve(f).toLowerCase(); } };
const dbReal = realp(DB_FILE);
if (dbReal === realp("prisma/dev.db") || !dbReal.startsWith(realp(os.tmpdir()) + path.sep)) {
  console.error(`❌ FLOW_E2E_DB phải là bản sao nằm trong thư mục tạm (${os.tmpdir()}), không phải prisma/dev.db: ${DB_FILE}`);
  process.exit(1);
}
const SHOTS = process.env.FLOW_E2E_SHOTS || path.join(os.tmpdir(), "flow_import_shots");
fs.mkdirSync(SHOTS, { recursive: true });
const DB_URL = `file:${path.resolve(DB_FILE).replace(/\\/g, "/")}`;
// @prisma/client nạp .env cạnh schema của bản cài (có thể trỏ DB production) nhưng không ghi đè biến đã đặt
Object.assign(process.env, { TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", DATABASE_URL: DB_URL });

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } });
const dbList = await db.$queryRawUnsafe("PRAGMA database_list");
if (realp(dbList[0]?.file ?? "") !== dbReal) { console.error("❌ Prisma không mở đúng bản sao DB", dbList); process.exit(1); }
const { chromium } = await import("playwright");
const sharp = (await import("sharp")).default;
const bcrypt = (await import("bcryptjs")).default;
const manifest = JSON.parse(fs.readFileSync("lib/data/flow-briefs-2026-11.json", "utf8"));
const codeOf = new Map(manifest.map((b) => [b.designId, b.code]));

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
const rows = d.map((b, i) => { const c = real(b.designId); return { ...base(i), ...(c ? { title: c.title, pattern: c.pattern, shape: c.shape, finish: c.finish } : { title: `Mẫu ${b.code}` }), id: b.designId, titleEn: b.title, imageUrl: c ? c.imageUrl : seedUrl(`seed_${b.code}`), prompt: seedPrompt(b.title) }; });
// D007 đã có ảnh Flow từ trước (hiện ghi chú "đăng sẽ thay ảnh đó")
const flow7 = `https://res.cloudinary.com/${CLOUD}/image/upload/v1793900000/pawbook/designs-flow/D007_${d[6].designId}_0123456789.jpg`;
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
async function makeImage(file, w, h, k, fmt, dir = IMG_DIR) {
  let img;
  const code = path.basename(file).match(/^D\d{3}/)?.[0];
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
  const out = path.join(dir, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await img.toFile(out);
  return out;
}
const files = [
  ["D001.jpg", 2048, 2048, "jpg"], ["D002.png", 1536, 1536, "png"], ["D003 (1).jpeg", 3000, 3000, "jpg"], ["D004.webp", 1024, 1024, "webp"],
  [`${idC}.jpg`, 2048, 2048, "jpg"], ["D007.jpg", 2048, 2048, "jpg"], ["D005_small.jpg", 800, 800, "jpg"], ["D006_wide.jpg", 2048, 1600, "jpg"],
  ["holiday photo.jpg", 1600, 1600, "jpg"], ["D999.jpg", 1024, 1024, "jpg"], ["D001 (2).jpg", 1024, 1024, "jpg"], ["D010-D011.jpg", 1024, 1024, "jpg"],
];
const paths = [];
for (let k = 0; k < files.length; k++) paths.push(await makeImage(files[k][0], files[k][1], files[k][2], k, files[k][3]));
const hourAgo = new Date(Date.now() - 3600e3);
fs.utimesSync(paths[10], hourAgo, hourAgo); // "D001 (2).jpg" cũ hơn "D001.jpg" → mặc định dùng D001.jpg (file mới nhất)
// thư mục kiểu "tải về từ Flow": ảnh ở thư mục con + 1 file chữ (bị bỏ qua)
const FOLDER = path.join(IMG_DIR, "flow_batch");
for (const [k, [f, fmt]] of [["D008.jpg", "jpg"], ["D009.png", "png"], ["sub/D010.jpg", "jpg"], ["sub/D011.jpg", "jpg"], ["sub/deeper/D012.webp", "webp"]].entries()) await makeImage(f, 1024, 1024, 20 + k, fmt, FOLDER);
fs.writeFileSync(path.join(FOLDER, "notes.txt"), "not an image");

// ---------------- Cloudinary giả (trong trình duyệt) ----------------
const store = new Map(); // public_id → { buf, version }
const uploads = [];
const fails = new Map(); // tiền tố public_id → { kind: "500" | "abort", n }
let delayMs = 0;
const hands = fs.readdirSync("public/hands").filter((f) => f.endsWith(".jpg")).map((f) => fs.readFileSync(path.join("public/hands", f)));
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");
const respSig = (pid, version) => sha1(`public_id=${pid}&version=${version}${SECRET}`);
/** Kích thước ảnh JPEG tải lên (Cloudinary giả chỉ nhận JPEG — trình duyệt phải đổi PNG/WebP sang JPEG). */
async function jpegSize(buf) {
  try {
    const m = await sharp(buf).metadata();
    return m.format === "jpeg" && m.width && m.height ? { w: m.width, h: m.height } : null;
  } catch { return null; }
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
    const size = Buffer.isBuffer(f.file) ? await jpegSize(f.file) : null;
    const rec = { public_id: f.public_id, folder: f.folder, allowed_formats: f.allowed_formats, tags: f.tags, overwrite: f.overwrite, sigOk, fresh, size, bytes: f.file?.length ?? 0, apiKey: f.api_key };
    uploads.push(rec);
    if (!sigOk || !fresh) return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "Invalid Signature" } }) });
    const fl = [...fails.entries()].find(([p]) => String(f.public_id).startsWith(p));
    if (fl && fl[1].n > 0) {
      fl[1].n--;
      if (fl[1].kind === "abort") return route.abort("connectionreset");
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "Mock Cloudinary: temporary failure" } }) });
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (!size) return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: { message: "Invalid image file" } }) });
    const pid = `${f.folder}/${f.public_id}`;
    const prev = store.get(pid);
    if (prev && f.overwrite === "false") rec.keptExisting = true; // overwrite=false: Cloudinary trả ảnh cũ, không thay
    const version = prev && f.overwrite === "false" ? prev.version : Math.round(Date.now() / 1000);
    if (!rec.keptExisting) store.set(pid, { buf: f.file, version });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ public_id: pid, version, signature: respSig(pid, version), width: size.w, height: size.h, bytes: f.file.length, format: "jpg", resource_type: "image", existing: !!rec.keptExisting, secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v${version}/${pid}.jpg` }) });
  }
  if (u.hostname === "res.cloudinary.com" && req.method() === "GET" && u.pathname.startsWith(`/${CLOUD}/image/upload/`)) {
    const pid = u.pathname.replace(/^.*?\/v\d+\//, "").replace(/\.\w+$/, "");
    let body = store.get(pid)?.buf;
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
// trình duyệt thật luôn gửi Origin khi POST — API request của Playwright thì không, nên thêm vào
const api = async (ctx, method, p, body, headers = { Origin: BASE_URL }) => {
  const r = await ctx.request.fetch(`${BASE_URL}${p}`, { method, headers, ...(body !== undefined ? { data: body } : {}) });
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
ok("S5", "admin GET: 213 dòng lô 2026-11, 1 mẫu đã có ảnh Flow (D007, cũng có trong danh sách hoàn tác), có Cloudinary", g0.s === 200 && g0.j.rows.length === 213 && g0.j.imported === 1 && g0.j.storage === true && g0.j.rows[6].flow?.code === "D007" && g0.j.importedRows?.length === 1, { s: g0.s, imported: g0.j?.imported });
const sg = await api(admin, "POST", "/api/admin/designs/flow/sign", { code: "d001" });
const sg2 = await api(admin, "POST", "/api/admin/designs/flow/sign", { code: "D001" });
const p = sg.j?.params ?? {};
const signedStr = Object.keys(p).sort().map((k) => `${k}=${p[k]}`).join("&");
ok("S6", "chữ ký: thư mục pawbook/designs-flow, jpg/png/webp, overwrite=false, public_id theo mẫu + đuôi ngẫu nhiên (mỗi lần khác), ký đúng",
  sg.s === 200 && p.folder === "pawbook/designs-flow" && p.allowed_formats === "jpg,png,webp" && p.overwrite === "false" && new RegExp(`^D001_${d[0].designId}_[a-f0-9]{10}$`).test(p.public_id) && sg2.j?.params?.public_id !== p.public_id && Math.abs(Date.now() / 1000 - p.timestamp) < 30 && sg.j.signature === sha1(signedStr + SECRET) && sg.j.uploadUrl === `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, sg.j);
ok("S7", "phản hồi chữ ký không chứa secret", !JSON.stringify(sg.j).includes(SECRET));
ok("S8", "ký mã lạ → 400, mã đúng nhưng mẫu không có → 404", (await api(admin, "POST", "/api/admin/designs/flow/sign", { code: "D999" })).s === 400 && (await api(admin, "POST", "/api/admin/designs/flow/sign", { code: "D213" })).s === 404);
const nowS = Math.round(Date.now() / 1000);
const pid0 = `pawbook/designs-flow/${p.public_id}`;
const forged = { code: "D001", secure_url: `https://res.cloudinary.com/someone-else/image/upload/v${nowS}/${pid0}.jpg`, public_id: pid0, version: nowS, signature: respSig(pid0, nowS), width: 2048, height: 2048, bytes: 1000 };
const f1 = await api(admin, "POST", "/api/admin/designs/flow/import", forged);
const f2 = await api(admin, "POST", "/api/admin/designs/flow/import", { ...forged, secure_url: forged.secure_url.replace("someone-else", CLOUD), height: 1500 });
const f3 = await api(admin, "POST", "/api/admin/designs/flow/import", { ...forged, secure_url: forged.secure_url.replace("someone-else", CLOUD), signature: "0".repeat(40) });
const f4 = await api(admin, "POST", "/api/admin/designs/flow/import", { ...forged, secure_url: forged.secure_url.replace("someone-else", CLOUD).replace("/designs-flow/", "/designs-flow/x/../") });
const row1 = await db.nailDesign.findUnique({ where: { id: d[0].designId } });
ok("S9", "nhập link kho khác / không vuông / chữ ký Cloudinary sai / dot-segment → 422, mẫu không đổi", [f1, f2, f3, f4].every((r) => r.s === 422) && row1.imageUrl === seeded.get(d[0].designId).imageUrl && row1.prompt === seeded.get(d[0].designId).prompt, [f1.s, f2.s, f3.s, f4.s]);
const c1 = await api(admin, "POST", "/api/admin/designs/flow/undo", { designId: d[6].designId }, {}); // không có Origin
const c2 = await api(admin, "POST", "/api/admin/designs/flow/undo", { designId: d[6].designId }, { Origin: "https://evil.example" });
const c3 = await admin.request.fetch(`${BASE_URL}/api/admin/designs/flow/undo`, { method: "POST", headers: { Origin: BASE_URL, "Content-Type": "text/plain" }, data: JSON.stringify({ designId: d[6].designId }) });
const row7 = await db.nailDesign.findUnique({ where: { id: d[6].designId } });
ok("S10", "chống CSRF: POST thiếu Origin / Origin trang khác → 403, thân text/plain → 415; D007 không bị hoàn tác", c1.s === 403 && c2.s === 403 && c3.status() === 415 && row7.imageUrl === flow7, [c1.s, c2.s, c3.status()]);
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

// thả lệch ra ngoài khung + thả thứ không phải ảnh
const guard = await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.items.add(new File(["x"], "D001.jpg", { type: "image/jpeg" }));
  const target = document.querySelector("h1") || document.body;
  const over = new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true });
  const drop = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
  target.dispatchEvent(over);
  target.dispatchEvent(drop);
  return { over: over.defaultPrevented, drop: drop.defaultPrevented };
});
await page.getByTestId("flow-notice").waitFor({ timeout: 5000 }).catch(() => {});
const guardNote = (await page.getByTestId("flow-notice").textContent().catch(() => "")) ?? "";
ok("D1", "thả ảnh ra NGOÀI khung: trình duyệt không mở ảnh (preventDefault) + nhắc thả vào khung", guard.over && guard.drop && guardNote.includes("Thả ảnh vào khung"), { guard, guardNote });
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.items.add(new File(["hello"], "notes.txt", { type: "text/plain" }));
  document.querySelector("#anh-flow").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
});
await page.waitForFunction(() => /Không thấy ảnh/.test(document.querySelector('[data-testid="flow-notice"]')?.textContent || ""), null, { timeout: 5000 }).catch(() => {});
ok("D2", "thả thứ không có ảnh JPG/PNG/WebP → báo rõ, không im lặng", /Không thấy ảnh JPG\/PNG\/WebP/.test((await page.getByTestId("flow-notice").textContent()) ?? ""));

await page.getByTestId("flow-files").setInputFiles(paths);
const cards = panel.getByTestId("flow-card");
await page.waitForFunction((n) => document.querySelectorAll('[data-testid="flow-card"]').length === n && ![...document.querySelectorAll('[data-testid="flow-status"]')].some((e) => /kiểm tra|Checking/.test(e.textContent || "")), files.length, { timeout: 30_000 });
const card = (code, nth = 0) => panel.locator(`[data-testid="flow-card"][data-code="${code}"]`).nth(nth);
const byName = (name) => panel.getByTestId("flow-card").filter({ has: page.getByTestId("flow-filename").getByText(name, { exact: true }) });
const status = async (code, nth = 0) => (await card(code, nth).getByTestId("flow-status").textContent())?.trim();
const checked = async (code, nth = 0) => card(code, nth).locator('input[type="checkbox"]').isChecked();
ok("B1", `${files.length} ảnh hiện trong lưới xem lại, mỗi thẻ có tên file`, (await cards.count()) === files.length && (await panel.getByTestId("flow-filename").count()) === files.length);
const blocked = [["D005", "nhỏ hơn 1024"], ["D006", "không vuông"], ["", "Không đọc được mã"], ["D999", "Không có mẫu"]];
const blockedOk = [];
for (const [code, why] of blocked) blockedOk.push((await card(code).textContent()).includes(why) && (await card(code).locator('input[type="checkbox"]').isDisabled()));
blockedOk.push((await byName("D010-D011.jpg").textContent()).includes("nhiều mã khác nhau"));
ok("B2", "ảnh nhỏ / không vuông / không mã / mã không có mẫu / tên có 2 mã → không chọn được, có lý do", blockedOk.every(Boolean), blockedOk);
const dupOld = byName("D001 (2).jpg");
const dupNew = byName("D001.jpg");
const dupOk = [
  (await dupOld.textContent()).includes("Trùng mẫu") && (await dupOld.textContent()).includes("D001.jpg"),
  await dupNew.locator('input[type="checkbox"]').isChecked(),
  (await dupNew.textContent()).includes("Có 2 file cho mẫu này"),
];
await dupOld.locator('input[type="checkbox"]').check(); // tick file trùng → dùng file này thay
dupOk.push(await dupOld.locator('input[type="checkbox"]').isChecked(), (await dupNew.textContent()).includes("Trùng mẫu"));
await dupNew.locator('input[type="checkbox"]').check(); // đổi lại
dupOk.push(await dupNew.locator('input[type="checkbox"]').isChecked(), (await dupOld.textContent()).includes("Trùng mẫu"));
ok("B2b", "2 file cùng mẫu: mặc định dùng file MỚI NHẤT, tick file trùng để đổi, đổi lại được", dupOk.every(Boolean), dupOk);
const def = [];
for (const c of ["D001", "D002", "D003", "D004", idC]) def.push(await checked(c));
ok("B3", "ảnh hợp lệ được chọn sẵn; D007 (đã có ảnh Flow) không chọn sẵn, nhãn 'Đã có ảnh Flow' + ghi chú", def.every(Boolean) && !(await checked("D007")) && (await status("D007")) === "Đã có ảnh Flow" && (await card("D007").textContent()).includes("đã có ảnh Flow"), def);
ok("B4", "cột ẢNH CŨ / ẢNH MỚI + tên mẫu tiếng Việt từ DB", (await card("D001").textContent()).includes(seeded.get(d[0].designId).title) && (await card("D001").locator("img").count()) === 2 && (await card(idC).textContent()).includes("Hồng đào ombre"));
await page.getByTestId("flow-filter").check();
const problemCount = await cards.count();
await page.getByTestId("flow-filter").uncheck();
ok("B4b", "'Chỉ xem ảnh có vấn đề' → chỉ 6 thẻ (nhỏ, lệch, không mã, D999, 2 mã, trùng)", problemCount === 6, problemCount);
const sum = (await page.getByTestId("flow-summary").textContent()) ?? "";
ok("B4c", "dòng tóm tắt: 5 sẵn sàng · 1 đã có ảnh Flow · 1 trùng · 5 không dùng được · 0 lỗi", sum.includes("5 sẵn sàng") && sum.includes("1 đã có ảnh Flow") && sum.includes("1 trùng") && sum.includes("5 không dùng được") && sum.includes("0 lỗi"), sum);
await card("D001").getByRole("button", { name: /Phóng to/ }).click();
const dlg = page.getByRole("dialog");
const dlgOk = (await dlg.locator("img").count()) === 2 && (await dlg.textContent()).includes("Ảnh hiện tại");
await page.keyboard.press("Escape");
ok("B4d", "bấm vào ảnh → khung so sánh lớn (ảnh hiện tại / ảnh mới), Esc đóng", dlgOk && (await dlg.count()) === 0);
await page.waitForTimeout(800); // ảnh xem trước tải xong
await shot(panel, "flow_review_1440.png");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok("B5", "390px: không tràn ngang", overflow <= 0, overflow);
await shot(panel, "flow_review_390.png");
await page.setViewportSize({ width: 1440, height: 900 });

await card("D004").locator('input[type="checkbox"]').uncheck(); // bỏ chọn 1 ảnh
ok("B6", "chọn tất cả hiện đúng số đã chọn (4/5 — D007 đã có ảnh Flow không tính)", (await page.getByTestId("flow-select-all").locator("xpath=..").textContent()).includes("(4/5)"), await page.getByTestId("flow-select-all").locator("xpath=..").textContent());
fails.set("D002_", { kind: "500", n: 3 }); // Cloudinary lỗi 500 cả 3 lần (1 + 2 lần tự thử lại) → báo lỗi
fails.set("D003_", { kind: "abort", n: 3 }); // mất mạng cả 3 lần → báo mất kết nối
fails.set(`${idC}_`, { kind: "500", n: 1 }); // lỗi 1 lần → tự thử lại thành công, chủ tiệm không phải làm gì
delayMs = 700;
await page.getByTestId("flow-publish").click();
await page.waitForFunction(() => /Đang đăng/.test(document.querySelector('[data-testid="flow-run-status"]')?.textContent || ""), null, { timeout: 10_000 });
const unloadBlocked = await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
await card(idC).scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 400));
const bar = await page.getByTestId("flow-runbar").boundingBox();
ok("B6b", "đang đăng: tải lại trang bị hỏi lại; cuộn xuống vẫn thấy thanh tiến độ dính dưới thanh menu", unloadBlocked && !!bar && bar.y >= 60 && bar.y < 140, { unloadBlocked, bar });
await shot(panel, "flow_mid_run_1440.png").catch(() => {});
await page.waitForFunction(() => !/Đang đăng/.test(document.querySelector('[data-testid="flow-run-status"]')?.textContent || ""), null, { timeout: 90_000 });
const runText = (await page.getByTestId("flow-run-status").textContent()) ?? "";
const t2 = (await card("D002").textContent()) ?? "";
const t3 = (await card("D003").textContent()) ?? "";
ok("B7", "đăng: D001 + mẫu ngoài lô (lỗi 1 lần, tự thử lại) → Đã đăng; D002 'Kho ảnh từ chối' + chi tiết; D003 'Mất kết nối'; D004 không đụng; thanh: 'Xong: đã đăng 2/4 · 2 lỗi'",
  (await status("D001")) === "Đã đăng" && (await status(idC)) === "Đã đăng" && (await status("D002")) === "Lỗi" && (await status("D003")) === "Lỗi" && (await status("D004")) === "Sẵn sàng" &&
  t2.includes("Kho ảnh từ chối") && t2.includes("Chi tiết") && t2.includes("Mock Cloudinary") && t3.includes("Mất kết nối") && t3.includes("Chi tiết") &&
  runText.includes("2/4") && runText.includes("2 lỗi") && (await page.getByTestId("flow-retry-failed").textContent()).includes("Thử lại 2 ảnh lỗi"),
  [await status("D001"), await status("D002"), await status("D003"), await status("D004"), await status(idC), runText, t2.slice(0, 200), t3.slice(0, 200)]);
delayMs = 0;
await page.getByTestId("flow-retry-failed").click();
await page.waitForFunction(() => ["D002", "D003"].every((c) => /Đã đăng/.test(document.querySelector(`[data-testid="flow-card"][data-code="${c}"] [data-testid="flow-status"]`)?.textContent || "")), null, { timeout: 60_000 });
ok("B8", "'Thử lại 2 ảnh lỗi' → D002, D003 Đã đăng", (await status("D002")) === "Đã đăng" && (await status("D003")) === "Đã đăng");
await byName("holiday photo.jpg").getByTestId("flow-remove").click(); // bỏ 1 thẻ khác → sắp xếp lại trùng mẫu
const dupAfter = byName("D001 (2).jpg");
ok("B9", "sau khi đăng D001.jpg: file trùng 'D001 (2).jpg' vẫn là 'Trùng mẫu', không tự chọn; nút ✕ bỏ thẻ khỏi danh sách", (await dupAfter.getByTestId("flow-status").textContent()) === "Trùng mẫu" && !(await dupAfter.locator('input[type="checkbox"]').isChecked()) && (await byName("holiday photo.jpg").count()) === 0 && !(await dupNew.textContent()).includes("Có 2 file"));
await page.waitForTimeout(500);
await shot(panel, "flow_published_1440.png");

const pidRe = /^(D\d{3}_)?c[a-z0-9]{24}_[a-f0-9]{10}$/;
const d3 = uploads.filter((u) => String(u.public_id).startsWith(`D003_${d[2].designId}_`) && u.size).pop();
ok("C1", "mọi lần tải lên: ký đúng, overwrite=false, public_id có đuôi ngẫu nhiên (không lần nào trùng), đúng thư mục/định dạng, khoá API công khai đúng",
  uploads.length >= 9 && uploads.every((u) => u.sigOk && u.fresh && u.overwrite === "false" && pidRe.test(u.public_id) && u.folder === "pawbook/designs-flow" && u.allowed_formats === "jpg,png,webp" && u.tags === "pawnail-flow" && u.apiKey === "123456789012345") && new Set(uploads.map((u) => u.public_id)).size === uploads.length && !uploads.some((u) => u.keptExisting),
  uploads.map((u) => `${u.public_id}:${u.sigOk}:${u.overwrite}`));
ok("C2", "trình duyệt thu nhỏ 3000px → 2048px JPEG; PNG/WebP → JPEG; JPEG ≤ 2048 gửi nguyên", d3?.size?.w === 2048 && d3?.size?.h === 2048 && uploads.every((u) => u.size && Math.max(u.size.w, u.size.h) <= 2048), d3);
const after = await db.nailDesign.findMany({ where: { id: { in: [d[0].designId, d[1].designId, d[2].designId, d[3].designId, idC] } } });
const by = new Map(after.map((r) => [r.id, r]));
const today = new Date().toISOString().slice(0, 10);
const isFlowRow = (id, code) => { const r = by.get(id); return new RegExp(`^https://res\\.cloudinary\\.com/${CLOUD}/image/upload/v\\d+/pawbook/designs-flow/(D\\d{3}_)?${id}_[a-f0-9]{10}\\.jpg$`).test(r.imageUrl) && r.prompt.includes(`[was:${seeded.get(id).imageUrl}]`) && r.prompt.endsWith(`[flow:${code}:${today}]`) && !/\[(q|img):/.test(r.prompt); };
ok("C3", "DB: 4 mẫu đổi sang ảnh Flow, ảnh cũ cất trong [was:], gỡ [q:][img:]; D004 không đổi", isFlowRow(d[0].designId, "D001") && isFlowRow(d[1].designId, "D002") && isFlowRow(d[2].designId, "D003") && isFlowRow(idC, idC) && by.get(d[3].designId).prompt === seeded.get(d[3].designId).prompt);
const r1 = by.get(d[0].designId);
const pid1 = r1.imageUrl.replace(/^.*?\/v\d+\//, "").replace(/\.jpg$/, "");
const v1 = Number(r1.imageUrl.match(/\/v(\d+)\//)[1]);
const again = await api(admin, "POST", "/api/admin/designs/flow/import", { code: "D001", secure_url: r1.imageUrl, public_id: pid1, version: v1, signature: respSig(pid1, v1), width: 2048, height: 2048, bytes: 500000 });
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
const imported = panel.getByTestId("flow-imported");
ok("H2", "danh sách 'Ảnh Flow đã đăng' gồm MỌI lô: D001, D003, D007 + mẫu ngoài lô", (await imported.locator("summary").textContent()).includes("(4)"), await imported.locator("summary").textContent());
await page.getByTestId("flow-undo-session").click();
await page.getByTestId("flow-confirm").click(); // bước xác nhận
await page.waitForFunction(() => !document.querySelector('[data-testid="flow-undo-session"]') && ![...document.querySelectorAll('[data-testid="flow-status"]')].some((e) => /Đang lưu/.test(e.textContent || "")), null, { timeout: 30_000 });
const back = await db.nailDesign.findMany({ where: { id: { in: [d[0].designId, d[2].designId, idC] } } });
ok("H2b", "'Hoàn tác cả lượt vừa đăng (3)' + xác nhận → 3 mẫu về đúng ảnh + prompt cũ", back.length === 3 && back.every((r) => r.imageUrl === seeded.get(r.id).imageUrl && r.prompt === seeded.get(r.id).prompt), back.map((r) => r.prompt.slice(-40)));

// cả thư mục (thư mục con + file chữ) → Stop giữa chừng → đăng nốt
await page.getByTestId("flow-folder-input").setInputFiles(FOLDER);
await page.waitForFunction(() => ["D008", "D009", "D010", "D011", "D012"].every((c) => /Sẵn sàng/.test(document.querySelector(`[data-testid="flow-card"][data-code="${c}"] [data-testid="flow-status"]`)?.textContent || "")), null, { timeout: 30_000 });
ok("F1", "chọn cả thư mục: 5 ảnh ở thư mục con được thêm, file chữ bị bỏ qua", (await cards.count()) === files.length - 1 + 5);
delayMs = 4000;
await page.setViewportSize({ width: 390, height: 844 });
await page.getByTestId("flow-publish").click();
await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="flow-status"]')].some((e) => /Đang chờ/.test(e.textContent || "")), null, { timeout: 10_000 });
await card("D012").scrollIntoViewIfNeeded();
const bar390 = await page.getByTestId("flow-runbar").boundingBox();
const overflowRun = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await page.screenshot({ path: path.join(SHOTS, "flow_mid_run_390.png") }).catch(() => {});
await page.getByTestId("flow-stop").click();
await page.waitForFunction(() => /Đã dừng/.test(document.querySelector('[data-testid="flow-run-status"]')?.textContent || ""), null, { timeout: 30_000 });
const folderStates = [];
for (const c of ["D008", "D009", "D010", "D011", "D012"]) folderStates.push(await status(c));
ok("F2", "390px: thanh tiến độ dính trong màn hình, ảnh chờ hiện 'Đang chờ', không tràn; Dừng → 4 ảnh đang chạy xong, 1 ảnh về 'Sẵn sàng'",
  !!bar390 && bar390.y >= 60 && bar390.y < 140 && overflowRun <= 0 && folderStates.filter((s) => s === "Đã đăng").length === 4 && folderStates.filter((s) => s === "Sẵn sàng").length === 1 && (await page.getByTestId("flow-run-status").textContent()).includes("4/5"),
  { bar390, overflowRun, folderStates });
delayMs = 0;
await page.setViewportSize({ width: 1440, height: 900 });
await page.getByTestId("flow-publish").click();
await page.waitForFunction(() => /Xong/.test(document.querySelector('[data-testid="flow-run-status"]')?.textContent || ""), null, { timeout: 30_000 });
ok("F3", "bấm Đăng lần nữa → ảnh còn lại được đăng", ["D008", "D009", "D010", "D011", "D012"].length === (await Promise.all(["D008", "D009", "D010", "D011", "D012"].map((c) => status(c)))).filter((s) => s === "Đã đăng").length);

await page.reload({ waitUntil: "domcontentloaded" });
await page.getByTestId("flow-progress").waitFor({ timeout: 60_000 });
ok("H3", "tải lại trang: tiến độ lô 6/213 (D007 + D008…D012)", (await page.getByTestId("flow-progress").textContent()).includes("6/213"), await page.getByTestId("flow-progress").textContent());
await page.getByTestId("flow-folder-input").setInputFiles(FOLDER);
await page.waitForFunction(() => document.querySelectorAll('[data-testid="flow-card"]').length === 5 && ![...document.querySelectorAll('[data-testid="flow-status"]')].some((e) => /kiểm tra/.test(e.textContent || "")), null, { timeout: 30_000 });
const resume = [];
for (const c of ["D008", "D009", "D010", "D011", "D012"]) resume.push((await status(c)) === "Đã có ảnh Flow" && !(await checked(c)));
ok("H4", "thả lại cùng thư mục sau khi tải lại: ảnh đã đăng hiện 'Đã có ảnh Flow', không chọn sẵn, chọn tất cả (0/0)", resume.every(Boolean) && (await page.getByTestId("flow-select-all").locator("xpath=..").textContent()).includes("(0/0)"), resume);
await imported.locator("summary").click();
await imported.getByTestId("flow-undo-day").first().click();
await imported.getByTestId("flow-undo-day-confirm").click();
await page.waitForFunction(() => /\(1\)/.test(document.querySelector('[data-testid="flow-imported"] summary')?.textContent || ""), null, { timeout: 30_000 });
const r8 = await db.nailDesign.findUnique({ where: { id: d[7].designId } });
ok("H5", "danh sách ảnh Flow: 'Hoàn tác cả ngày này' + xác nhận → 5 ảnh hôm nay về ảnh cũ, còn lại D007; thẻ đang xem cập nhật theo ('Sẵn sàng', ảnh cũ)", r8.imageUrl === seeded.get(d[7].designId).imageUrl && r8.prompt === seeded.get(d[7].designId).prompt && (await imported.locator("summary").textContent()).includes("(1)") && (await status("D008")) === "Sẵn sàng" && (await card("D008").locator("img").first().getAttribute("src"))?.includes(seeded.get(d[7].designId).imageUrl.split("/upload/")[1]), [await status("D008"), await card("D008").locator("img").first().getAttribute("src")]);

const exp = page.locator("#anh-flow details").filter({ hasText: "Xuất brief" });
await exp.locator("summary").click();
await exp.getByTestId("flow-export-count").waitFor({ timeout: 20_000 });
const ta = exp.locator("textarea");
const text = await ta.inputValue();
const pubNonFlow = await db.nailDesign.findMany({ where: { status: "published", NOT: [{ prompt: { contains: "[flow:" } }] }, orderBy: { publishedAt: "desc" }, select: { id: true }, take: 600 });
const want = pubNonFlow.slice(0, 12).map((r) => codeOf.get(r.id) ?? r.id);
ok("E1", `xuất brief: ${pubNonFlow.length} mẫu chưa có ảnh Flow → lô 12; mẫu lô 2026-11 giữ D-mã, mẫu khác dùng id; dặn đổi tên đúng mã`,
  (await exp.getByTestId("flow-export-count").textContent()).includes(`${pubNonFlow.length} mẫu · ${Math.ceil(pubNonFlow.length / 12)} lô`) &&
  text.includes(`rename each created image to exactly its brief code (e.g. ${want[0]})`) && want.every((c) => text.includes(`[${c}] `)) && want.some((c) => /^D\d{3}$/.test(c)) && !/knit/i.test(text) && (await exp.textContent()).includes("Tải 12 ảnh về"),
  { head: text.slice(0, 200), want: want.slice(0, 4) });
await exp.getByRole("button", { name: /Sao chép lô này/ }).click();
const clip = await page.evaluate(() => navigator.clipboard.readText());
ok("E2", "Sao chép lô này → đúng nội dung lô, lô đánh dấu 'đã sao chép'", clip === text && (await exp.textContent()).includes("đã sao chép"));
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
ok("I1", "trình duyệt tiếng Anh: khu ảnh Flow hiện tiếng Anh (tr(vi, en))", enOk && enText.includes("Drop images or a whole folder") && enText.includes("Choose a folder") && enText.includes("Export briefs for Flow"), enText.slice(0, 160));
await shot(pe.locator("#anh-flow"), "flow_panel_en_1440.png", pe);
ok("Z1", "không lỗi JavaScript trên trang admin", !errors.length, errors);

await browser.close();
await db.$disconnect();
fs.rmSync(IMG_DIR, { recursive: true, force: true });
console.log(`\nscreenshots: ${SHOTS}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
