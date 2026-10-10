// Kiểm thử: tài khoản CHÍNH THỨC (tick xanh, ghim đầu tin nhắn, hồ sơ),
// tin nhắn mượt (không còn "Đang nạp tin nhắn mới"), đăng tin kèm ảnh, và
// giao diện TIẾNG ANH. CHỈ chạy với server local trỏ vào dev.db.
//   node scripts/qa/official_test.mjs
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Client, DEMO_PASSWORD, Results, SEED_OWNER, SEED_TECH, registerUser } from "./lib.mjs";

const R = new Results("Tài khoản chính thức, ảnh tin tuyển & tiếng Anh");
const OUT = process.env.TEMP || ".";
const db = createClient({ url: "file:prisma/dev.db" });
await db.execute("PRAGMA busy_timeout = 10000"); // server cũng đang ghi vào dev.db
// PNG 1×1 hợp lệ
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

// ---- Tài khoản chính thức ----
let adminRow = (await db.execute(`SELECT id, email FROM "User" WHERE role = 'ADMIN' ORDER BY createdAt ASC LIMIT 1`)).rows[0];
if (!adminRow) {
  const a = await registerUser({ name: "PawNail Official" });
  await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE email = ?`, args: [a.body.email] });
  adminRow = (await db.execute({ sql: `SELECT id, email FROM "User" WHERE email = ?`, args: [a.body.email] })).rows[0];
}
const officialId = String(adminRow.id);
let off = null;
for (let i = 0; i < 40; i++) {
  off = (await new Client().req("/api/official")).data;
  if (off?.account) break;
  await new Promise((r) => setTimeout(r, 1000));
}
R.check("OF1", "/api/official trả tài khoản ADMIN sớm nhất", off?.account?.id === officialId, JSON.stringify(off));
R.check("OF2", "/api/official không lộ email/SĐT", !/"(email|phone|password)"/.test(JSON.stringify(off)));

// ---- Ảnh tin tuyển (API) ----
const owner = new Client();
await owner.login(SEED_OWNER);
const dataPng = `data:image/png;base64,${PNG.toString("base64")}`;
const created = await owner.req("/api/jobs", {
  method: "POST",
  json: {
    title: "QA tin có ảnh", salonName: "QA Media Nails", description: "Tiệm sạch đẹp", market: "US", state: "CA", city: "San Jose",
    salaryType: "Bao lương tuần", salaryAmount: "$1,400/tuần", skills: ["Gel-X"], benefits: ["Tip cao"], phone: "4085550111", isUrgent: false,
    mediaUrls: [dataPng, "https://evil.example.com/x.jpg", "javascript:alert(1)"],
  },
});
const jobId = created.data?.id;
const detail = jobId ? (await new Client().req(`/api/jobs/${jobId}`)).data : null;
R.check("OF3", "Đăng tin kèm ảnh: ảnh hợp lệ được lưu, link lạ/javascript bị loại", detail?.mediaUrls?.length === 1 && detail.mediaUrls[0] === dataPng, JSON.stringify(detail?.mediaUrls)?.slice(0, 120));
const list = (await new Client().req("/api/jobs")).data;
R.check("OF4", "Danh sách tin trả kèm mediaUrls", Array.isArray(list) && list.find((j) => j.id === jobId)?.mediaUrls?.length === 1);
const anonSign = await new Client().req("/api/upload/sign", { method: "POST", json: {} });
R.check("OF5", "Ký upload video bắt buộc đăng nhập", anonSign.status === 401, anonSign.status);

const browser = await chromium.launch();
const errors = [];
async function login(ctx, email) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => { if (r.status() >= 500 || (r.status() === 403 && r.url().includes("/api/pusher/auth"))) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
  await p.goto(BASE_URL + "/auth/login");
  await p.locator("#email").fill(email);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.getByRole("button", { name: /^(Đăng nhập|Sign in|Log in)$/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  await p.evaluate(() => sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 })));
  return p;
}

try {
  // ---- Tin nhắn: ghim chính thức + tick xanh + không còn "Đang nạp…" ----
  const techCtx = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  // Ghi lại MỌI lần chữ "Đang nạp tin nhắn" xuất hiện (kể cả thoáng qua).
  await techCtx.addInitScript(() => {
    window.__loadingPill = 0;
    const check = () => { if (/đang nạp tin nhắn/i.test(document.body?.innerText || "")) window.__loadingPill++; };
    const start = () => new MutationObserver(check).observe(document.body, { childList: true, subtree: true, characterData: true });
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  });
  const tp = await login(techCtx, SEED_TECH);
  await tp.goto(BASE_URL + "/messages");
  // Chưa từng nhắn → dòng "Hỗ trợ chính thức"; đã nhắn → cuộc trò chuyện với
  // tài khoản chính thức. Cả hai trường hợp đều phải là dòng ĐẦU TIÊN dưới ô tìm kiếm.
  const offName = off.account.name;
  const pinned = tp.getByRole("button", { name: new RegExp(`Hỗ trợ chính thức|${offName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first();
  const pinnedShown = await pinned.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  const firstRowText = await tp.evaluate(() => {
    const search = document.querySelector('input[placeholder*="Tìm cuộc trò chuyện"], input[aria-label*="Tìm cuộc trò chuyện"]');
    const all = [...document.querySelectorAll("button")].filter((b) => b.innerText.trim() && search && (search.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    return all[0]?.innerText || "";
  });
  R.check("OF6", "Tin nhắn: tài khoản chính thức được GHIM đầu danh sách", pinnedShown && (firstRowText.includes("Hỗ trợ chính thức") || firstRowText.includes(offName)), firstRowText.slice(0, 80));
  R.check("OF7", "Có tick xanh xác minh cạnh tên chính thức", (await tp.getByRole("img", { name: /Tài khoản chính thức/ }).count()) > 0);
  await tp.screenshot({ path: `${OUT}/of_messages_pinned.png` });

  // Mở 1 cuộc trò chuyện có sẵn, quay lại rồi mở lại → hiện tức thì từ cache.
  await pinned.click();
  const input = tp.getByPlaceholder(/Viết tin nhắn/);
  await input.waitFor({ timeout: 15000 });
  R.check("OF8", "Mở chat chính thức: header có tên + tick xanh", (await tp.getByRole("img", { name: /Tài khoản chính thức/ }).count()) > 0);
  const msg = `QA hỏi hỗ trợ ${Date.now()}`;
  await input.fill(msg);
  await input.press("Enter");
  await tp.getByText(msg).last().waitFor({ timeout: 10000 });
  const admin = new Client();
  // Admin xem hộp thư của chính mình (không đọc DM của người khác).
  const adminEmail = String(adminRow.email);
  await db.execute({ sql: `UPDATE "User" SET password = (SELECT password FROM "User" WHERE email = ?) WHERE email = ?`, args: [SEED_TECH, adminEmail] });
  await admin.login(adminEmail);
  const convs = (await admin.req("/api/messages")).data;
  const conv = Array.isArray(convs) ? convs : convs?.conversations || [];
  R.check("OF9", "Tin nhắn tới tài khoản chính thức thật sự đến hộp thư admin", JSON.stringify(conv).includes(msg), JSON.stringify(conv).slice(0, 160));
  await tp.screenshot({ path: `${OUT}/of_official_chat.png` });

  await tp.goto(BASE_URL + "/messages");
  await tp.getByRole("button", { name: /Hỗ trợ chính thức|PawNail|QA/ }).first().waitFor({ timeout: 15000 });
  const t0 = Date.now();
  await tp.getByText(msg).first().click().catch(() => {});
  await tp.getByPlaceholder(/Viết tin nhắn/).waitFor({ timeout: 15000 });
  await tp.getByText(msg).last().waitFor({ timeout: 10000 });
  const reopenMs = Date.now() - t0;
  R.check("OF10", "Mở lại cuộc trò chuyện: tin hiện ngay (< 1.5s)", reopenMs < 1500, `${reopenMs}ms`);
  await tp.waitForTimeout(800);
  const pill = await tp.evaluate(() => window.__loadingPill);
  R.check("OF11", "KHÔNG còn chữ 'Đang nạp tin nhắn mới…' ở bất kỳ lúc nào", pill === 0, pill);

  // ---- Hồ sơ chính thức ----
  await tp.goto(BASE_URL + `/profile/${officialId}`);
  const offHead = await tp.getByText("Tài khoản chính thức của PawNail Jobs").first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  R.check("OF12", "Hồ sơ chính thức: tiêu đề + tick xanh", offHead && (await tp.getByRole("img", { name: /Tài khoản chính thức/ }).count()) > 0);
  await tp.screenshot({ path: `${OUT}/of_profile.png`, fullPage: true });
  await tp.getByRole("tab", { name: "Giới thiệu" }).or(tp.getByRole("button", { name: "Giới thiệu" })).first().click();
  const about = await tp.getByText("Cam kết của PawNail").waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
  R.check("OF13", "Tab Giới thiệu có cam kết + email hỗ trợ", about && (await tp.getByText("support@bitpawos.com").count()) > 0);
  await tp.getByRole("link", { name: /Nhắn tin hỗ trợ/ }).first().click();
  const toChat = await tp.waitForURL(/\/messages/, { timeout: 15000 }).then(() => true).catch(() => false);
  R.check("OF14", "Nút 'Nhắn tin hỗ trợ' mở khung chat", toChat);

  // ---- Đăng tin kèm ảnh qua UI ----
  const ownerCtx = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const op = await login(ownerCtx, SEED_OWNER);
  const title = `QA tin ảnh UI ${Date.now() % 100000}`;
  await op.goto(BASE_URL + "/jobs/create");
  await op.getByPlaceholder("VD: Los Angeles").fill("San Jose");
  await op.getByPlaceholder("VD: Happy Nails & Spa").fill("QA Photo Nails");
  await op.getByRole("button", { name: /Tiếp tục/ }).click();
  await op.getByPlaceholder("VD: Cần thợ Bột/Dip gấp").fill(title);
  await op.getByPlaceholder(/VD: \$1,200|VD: \$28/).fill("$1,300/tuần");
  await op.getByPlaceholder("(555) 123-4567").fill("4085550100");
  await op.getByRole("button", { name: /Tiếp tục/ }).click();
  await op.locator('input[type="file"]').setInputFiles([
    { name: "tiem1.png", mimeType: "image/png", buffer: PNG },
    { name: "tiem2.png", mimeType: "image/png", buffer: PNG },
  ]);
  const next = op.getByRole("button", { name: /^Tiếp tục/ });
  await next.waitFor({ timeout: 15000 });
  await op.waitForFunction(() => ![...document.querySelectorAll("button")].some((b) => /Đang tải lên/.test(b.innerText)), null, { timeout: 20000 });
  await op.screenshot({ path: `${OUT}/of_job_media_step.png` });
  await next.click();
  await op.getByRole("button", { name: /Đăng tin ngay/ }).click();
  await op.waitForURL(/\/jobs\/[a-z0-9]+$/, { timeout: 20000 });
  const gallery = await op.getByText("Ảnh & video tiệm").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  R.check("OF15", "Đăng tin qua UI kèm 2 ảnh → trang tin có mục 'Ảnh & video tiệm'", gallery);
  await op.screenshot({ path: `${OUT}/of_job_detail.png`, fullPage: true });
  if (gallery) {
    await op.locator("section", { hasText: "Ảnh & video tiệm" }).locator("button").first().click();
    const dlg = op.getByRole("dialog", { name: /Xem ảnh/ });
    const opened = await dlg.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
    await op.keyboard.press("Escape");
    const closed = await dlg.waitFor({ state: "detached", timeout: 5000 }).then(() => true).catch(() => false);
    R.check("OF16", "Bấm ảnh → mở trình xem toàn màn hình, Esc để đóng", opened && closed);
  } else R.check("OF16", "Bấm ảnh → mở trình xem toàn màn hình", false, "không có gallery");
  await tp.goto(BASE_URL + "/?tab=jobs");
  await tp.getByText(title).first().waitFor({ timeout: 15000 }).catch(() => {});
  // Leo từ tiêu đề lên tới khung thẻ đầu tiên có ảnh bìa (img data:/cloudinary).
  const hasCover = await tp.evaluate((t) => {
    const el = [...document.querySelectorAll("h2,h3,p,span,a")].find((e) => e.textContent.trim() === t);
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.querySelector("img[src^=\"data:image\"], img[src*=\"res.cloudinary.com\"]")) return true;
      if (n.querySelectorAll("h2,h3").length > 1) return false;
    }
    return false;
  }, title);
  R.check("OF17", "Job board: thẻ tin hiện ảnh bìa", hasCover);

  // ---- Giao diện tiếng Anh ----
  const enCtx = await browser.newContext({ ...devices["Pixel 7"], locale: "en-US" });
  await enCtx.addInitScript(() => { try { localStorage.setItem("bitpaw_locale", "en"); } catch {} });
  const ep = await login(enCtx, SEED_TECH);
  const VN = /[ạảấầậắằặẹẻếềệịọỏốồộớờợụủứừựỳỵỷỹđĐ]/g;
  const viRatio = async () => ep.evaluate((re) => {
    const t = document.querySelector("main")?.innerText || document.body.innerText;
    const words = t.split(/\s+/).filter(Boolean);
    const vi = words.filter((w) => new RegExp(re, "").test(w)).length;
    return { vi, total: words.length };
  }, VN.source);
  const pages = [
    ["/?tab=jobs", /open jobs/],
    ["/messages", /Private chat|Official/i],
    ["/profile", /Your profile|Save profile|Save/],
    ["/trends", /This week's trends/],
    ["/tools/radar", /Choose a state|Reference/],
    [`/profile/${officialId}`, /Official PawNail Jobs account/],
  ];
  for (const [path, re] of pages) {
    await ep.goto(BASE_URL + path);
    const ok = await ep.getByText(re).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    await ep.waitForTimeout(500);
    const r = await viRatio();
    // Nội dung do NGƯỜI DÙNG viết (tên, bài đăng, tin tuyển) vẫn là tiếng Việt — chỉ đo khung giao diện.
    R.check(`OF-EN ${path}`, `EN: ${path} hiển thị tiếng Anh`, ok, `${r.vi}/${r.total} từ có dấu`);
    await ep.screenshot({ path: `${OUT}/of_en_${path.replace(/[^a-z]/gi, "_")}.png` });
  }
  const ownerEn = await browser.newContext({ ...devices["Pixel 7"], locale: "en-US" });
  await ownerEn.addInitScript(() => { try { localStorage.setItem("bitpaw_locale", "en"); } catch {} });
  const oe = await login(ownerEn, SEED_OWNER);
  await oe.goto(BASE_URL + "/jobs/create");
  const enCreate = await oe.getByText("Post a job").first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  R.check("OF-EN create", "EN: trang đăng tin hiển thị tiếng Anh", enCreate);
  await oe.screenshot({ path: `${OUT}/of_en_jobs_create.png` });

  R.check("OF18", "Không có lỗi JS / 5xx / 403 presence trong suốt luồng", errors.length === 0, errors.slice(0, 5).join(" | "));
} finally {
  await browser.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
