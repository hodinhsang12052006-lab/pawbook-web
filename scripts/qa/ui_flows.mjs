// Kiểm thử luồng người dùng thật qua giao diện (Playwright, mobile 390px):
// đăng ký thợ 3 bước → đăng bài → thích/bình luận → kiểm tra XSS → chủ tiệm
// đăng tin → nhắn tin 2 chiều → lưu hồ sơ → đăng xuất/đăng nhập lại → xóa
// tài khoản. Chạy: node scripts/qa/ui_flows.mjs
import fs from "fs";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, Results, fakeIp } from "./lib.mjs";

const R = new Results("UI flows");
const SHOTS = new URL("./reports/flows/", import.meta.url);
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(name + ".png", SHOTS)) }).catch(() => {});

const browser = await chromium.launch();
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "vi-VN" };

async function newCtx() {
  const ctx = await browser.newContext(MOBILE);
  const ip = fakeIp();
  await ctx.route(BASE_URL + "/**", (route) => route.continue({ headers: { ...route.request().headers(), "cf-connecting-ip": ip } }));
  return ctx;
}
const pageErrors = [];
function watch(page, who) {
  page.on("pageerror", (e) => pageErrors.push(`${who}: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => {
    if (r.url().startsWith(BASE_URL) && r.status() >= 500) pageErrors.push(`${who}: HTTP ${r.status()} ${r.url().replace(BASE_URL, "")}`);
  });
}
async function step(id, desc, fn) {
  try {
    const detail = await fn();
    R.check(id, desc, detail !== false, detail === false ? "điều kiện không đạt" : "");
  } catch (e) {
    for (const [pg, who] of [[tp, "tech"], [op, "owner"]]) if (pg) await shot(pg, `FAIL_${id}_${who}`);
    R.check(id, desc, false, e.message.split("\n")[0]);
  }
}

const stamp = Date.now();
const techEmail = `qa.ui.${stamp}@qa.test`;
const techPass = "QaPass#2026";
const techName = `QA Thợ ${String(stamp).slice(-4)}`;

// ===================== THỢ =====================
let tp, op;
const techCtx = await newCtx();
tp = await techCtx.newPage();
watch(tp, "tech");

await step("F1", "Khách vào / bị chuyển sang trang đăng ký", async () => {
  await tp.goto(BASE_URL + "/");
  await tp.waitForURL(/\/auth\/register/, { timeout: 15000 });
  await shot(tp, "01_register_picker");
});

await step("F2", "Đăng ký thợ — bước 1 (thông tin + tài khoản)", async () => {
  await tp.goto(BASE_URL + "/auth/register?role=technician");
  await tp.getByPlaceholder("VD: Kim Nails").fill(techName);
  await tp.getByPlaceholder("555 123 4567").fill("4085550199");
  await tp.getByPlaceholder("VD: Los Angeles").fill("San Jose");
  await tp.getByPlaceholder("ban@email.com").fill(techEmail);
  await tp.locator('input[type="password"]').fill(techPass);
  await shot(tp, "02_tech_step1");
  await tp.getByRole("button", { name: /Tiếp tục/ }).first().click();
  await tp.getByText("Tay nghề & mong muốn").waitFor({ timeout: 20000 });
});

await step("F3", "Đăng ký thợ — bước 2 (tay nghề) → bước 3", async () => {
  await shot(tp, "03_tech_step2");
  // chọn 1 kỹ năng bất kỳ (nút đầu tiên trong lưới kỹ năng)
  const skill = tp.getByRole("button", { name: /Bột|Acrylic|Gel|Dip/ }).first();
  if (await skill.count()) await skill.click();
  await tp.getByRole("button", { name: /Tiếp tục/ }).last().click();
  await tp.getByText("Ảnh mẫu móng của bạn").waitFor({ timeout: 10000 });
});

await step("F4", "Đăng ký thợ — upload ảnh portfolio + Hoàn tất → vào app", async () => {
  // Ảnh PNG 1x1 thật để đi qua /api/upload (không cấu hình Cloudinary local
  // → fallback data URL).
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await tp.locator('input[type="file"]').setInputFiles({ name: "nail.png", mimeType: "image/png", buffer: png });
  await tp.waitForTimeout(2500);
  await shot(tp, "04_tech_step3");
  await tp.getByRole("button", { name: /Hoàn Tất/ }).click();
  await tp.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  await tp.waitForLoadState("networkidle").catch(() => {});
  await shot(tp, "05_tech_home");
});

await step("F5", "Hồ sơ thợ đã lưu kỹ năng + ảnh portfolio", async () => {
  const p = await (await techCtx.request.get(BASE_URL + "/api/profile")).json();
  return p.email === techEmail && p.technicianProfile && p.technicianProfile.portfolioImages.length >= 1;
});

const postText = `QA bài đăng UI ${stamp}`;
await step("F6", "Đăng bài lên bảng tin qua composer", async () => {
  await tp.goto(BASE_URL + "/?tab=feed");
  const box = tp.getByPlaceholder(/Khoe tác phẩm móng mới/);
  await box.waitFor({ timeout: 15000 });
  await box.fill(postText);
  await tp.getByRole("button", { name: /^Đăng bài$/ }).click();
  await tp.getByText(postText).first().waitFor({ timeout: 15000 });
  await shot(tp, "06_feed_posted");
});

await step("F7", "Thích + bình luận bài vừa đăng", async () => {
  const card = tp.locator("article, div").filter({ hasText: postText }).filter({ has: tp.getByPlaceholder("Viết bình luận...") }).last();
  // mở ô bình luận nếu đang ẩn
  if (!(await tp.getByPlaceholder("Viết bình luận...").count())) {
    const toggle = tp.locator("div").filter({ hasText: postText }).getByRole("button", { name: /Bình luận|bình luận/ }).first();
    await toggle.click();
  }
  const input = (await card.count()) ? card.getByPlaceholder("Viết bình luận...") : tp.getByPlaceholder("Viết bình luận...").first();
  await input.fill("QA bình luận 👍");
  await input.press("Enter");
  await tp.getByText("QA bình luận 👍").first().waitFor({ timeout: 10000 });
});

await step("F8", "Payload XSS trong bài đăng KHÔNG thực thi khi hiển thị", async () => {
  await tp.goto(BASE_URL + "/?tab=feed");
  await tp.waitForLoadState("networkidle").catch(() => {});
  await tp.waitForTimeout(1500);
  return (await tp.evaluate(() => window.__xss)) !== 1;
});

// ===================== CHỦ TIỆM =====================
const ownerCtx = await newCtx();
op = await ownerCtx.newPage();
watch(op, "owner");

await step("F9", "Chủ tiệm đăng nhập qua form", async () => {
  await op.goto(BASE_URL + "/auth/login");
  await op.locator("#email").fill(SEED_OWNER);
  await op.locator("#password").fill(DEMO_PASSWORD);
  await op.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await op.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  await shot(op, "07_owner_home");
});

const jobTitle = `QA cần thợ Gel-X ${String(stamp).slice(-4)}`;
await step("F10", "Chủ tiệm đăng tin tuyển thợ qua form", async () => {
  await op.goto(BASE_URL + "/jobs/create");
  await op.getByPlaceholder("VD: Los Angeles").fill("San Jose");
  await op.getByPlaceholder("VD: Happy Nails & Spa").fill("QA Nails");
  await op.getByRole("button", { name: /Tiếp tục/ }).click();
  await op.getByPlaceholder("VD: Cần thợ Bột/Dip gấp").fill(jobTitle);
  await op.getByPlaceholder(/VD: \$1,200|VD: \$28/).fill("$1,300/tuần");
  await op.getByPlaceholder("(555) 123-4567").fill("4085550100");
  await op.getByRole("button", { name: /Tiếp tục/ }).click();
  await shot(op, "08_job_create");
  await op.getByRole("button", { name: /Đăng tin ngay/ }).click();
  await op.waitForURL((u) => !u.pathname.startsWith("/jobs/create"), { timeout: 20000 });
  const jobs = await (await fetch(BASE_URL + "/api/jobs")).json();
  return jobs.some((j) => j.title === jobTitle);
});

await step("F11", "Thợ thấy tin mới trên job board", async () => {
  await tp.goto(BASE_URL + "/?tab=jobs");
  await tp.getByText(jobTitle).first().waitFor({ timeout: 15000 });
  await shot(tp, "09_tech_jobboard");
});

// Nhắn tin 2 chiều qua UI
const ownerId = (await (await ownerCtx.request.get(BASE_URL + "/api/auth/session")).json()).user.id;
const techId = (await (await techCtx.request.get(BASE_URL + "/api/auth/session")).json()).user.id;
await step("F12", "Thợ mở chat với chủ tiệm (/messages?to=) và gửi tin", async () => {
  await tp.goto(BASE_URL + `/messages?to=${ownerId}`);
  const input = tp.getByPlaceholder(/Viết tin nhắn/);
  await input.waitFor({ timeout: 20000 });
  await input.fill("Chào anh, em muốn ứng tuyển ạ");
  await input.press("Enter");
  await tp.getByText("Chào anh, em muốn ứng tuyển ạ").last().waitFor({ timeout: 10000 });
  await shot(tp, "10_tech_chat");
});

await step("F13", "Chủ tiệm nhận được tin và trả lời", async () => {
  await op.goto(BASE_URL + `/messages?to=${techId}`);
  await op.getByText("Chào anh, em muốn ứng tuyển ạ").last().waitFor({ timeout: 20000 });
  const input = op.getByPlaceholder(/Viết tin nhắn/);
  await input.fill("OK em, mai ghé tiệm nhé");
  await input.press("Enter");
  await op.getByText("OK em, mai ghé tiệm nhé").last().waitFor({ timeout: 10000 });
  await shot(op, "11_owner_chat");
});

await step("F14", "Thợ chỉnh sửa + lưu hồ sơ", async () => {
  await tp.goto(BASE_URL + "/profile");
  const bio = tp.getByPlaceholder("Kinh nghiệm, phong cách làm việc...");
  await bio.waitFor({ timeout: 15000 });
  await bio.fill("5 năm làm Gel-X, QA test");
  await tp.getByRole("button", { name: /Lưu hồ sơ/ }).click();
  await tp.waitForTimeout(2000);
  const p = await (await techCtx.request.get(BASE_URL + "/api/profile")).json();
  await shot(tp, "12_profile_saved");
  return p.technicianProfile?.bio === "5 năm làm Gel-X, QA test";
});

await step("F15", "Đăng xuất rồi đăng nhập lại bằng tài khoản vừa tạo", async () => {
  await techCtx.clearCookies();
  await tp.goto(BASE_URL + "/auth/login");
  await tp.locator("#email").fill(techEmail);
  await tp.locator("#password").fill(techPass);
  await tp.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await tp.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
});

await step("F16", "Xóa tài khoản qua UI (gõ xác nhận) → về trang đăng ký, không đăng nhập lại được", async () => {
  await tp.goto(BASE_URL + "/profile");
  await tp.getByRole("button", { name: /^Xóa tài khoản$/ }).click();
  await tp.getByPlaceholder("XÓA TÀI KHOẢN").fill("XÓA TÀI KHOẢN");
  await shot(tp, "13_delete_confirm");
  await tp.getByRole("button", { name: /Xóa vĩnh viễn|Xóa tài khoản|Xác nhận/ }).last().click();
  await tp.waitForURL((u) => u.pathname.startsWith("/auth"), { timeout: 20000 });
  const csrf = await (await techCtx.request.get(BASE_URL + "/api/auth/csrf")).json();
  await techCtx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email: techEmail, password: techPass, json: "true" } });
  const s = await (await techCtx.request.get(BASE_URL + "/api/auth/session")).json();
  return !s?.user;
});

await step("F17", "Chủ tiệm vẫn mở hộp thư bình thường sau khi đối phương xóa tài khoản", async () => {
  await op.goto(BASE_URL + "/messages");
  await op.waitForLoadState("networkidle").catch(() => {});
  const r = await ownerCtx.request.get(BASE_URL + "/api/messages");
  return r.status() === 200;
});

// ---------- Tính năng giữ chân người dùng (bản nâng cấp giao diện) ----------
await step("F19", "Đổi ảnh đại diện từ trang Tài khoản → % hoàn thiện tăng", async () => {
  await op.goto(BASE_URL + "/profile");
  await op.getByText("Hoàn thiện hồ sơ").first().waitFor({ timeout: 15000 });
  const beforeUrl = (await (await ownerCtx.request.get(BASE_URL + "/api/profile")).json()).avatarUrl;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  // Màu ngẫu nhiên mỗi lần chạy — ảnh giống hệt lần trước sẽ cho cùng URL.
  const sharp = (await import("sharp")).default;
  const color = { r: Math.floor(Math.random() * 255), g: Math.floor(Math.random() * 255), b: 180 };
  const logo = await sharp({ create: { width: 64, height: 64, channels: 3, background: color } }).png().toBuffer();
  void png;
  await op.locator('input[type="file"][accept="image/*"]').first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
  await op.getByText("Đã đổi ảnh đại diện!").waitFor({ timeout: 20000 });
  const p = await (await ownerCtx.request.get(BASE_URL + "/api/profile")).json();
  await shot(op, "14_avatar_changed");
  // Ảnh mới khác ảnh cũ, và mục "Ảnh đại diện" trong checklist đã tick.
  const avatarItemDone = await op.locator("li", { hasText: "Ảnh đại diện / logo tiệm" }).first().evaluate((el) => el.className.includes("line-through"));
  return p.avatarUrl !== beforeUrl && !p.avatarUrl.includes("dicebear") && avatarItemDone;
});

await step("F20", "Trang chi tiết tin: lưu tin + có tin tương tự + khối an toàn", async () => {
  const jobs = await (await fetch(BASE_URL + "/api/jobs")).json();
  // Chọn tin của tiệm khác, ở bang có ≥2 tin để chắc chắn có "tin tương tự".
  const perState = {};
  for (const j of jobs) perState[j.market + j.state] = (perState[j.market + j.state] || 0) + 1;
  const target = jobs.find((j) => j.ownerId !== ownerId && perState[j.market + j.state] >= 2);
  await op.goto(BASE_URL + `/jobs/${target.id}`);
  await op.getByText("Trước khi nhận việc").waitFor({ timeout: 15000 });
  await op.waitForTimeout(800);
  // Nếu lần chạy trước đã lưu, bỏ lưu trước để kiểm tra lại từ đầu.
  if (await op.getByRole("button", { name: "Bỏ lưu tin", exact: true }).count()) {
    await op.getByRole("button", { name: "Bỏ lưu tin", exact: true }).click();
    await op.getByRole("button", { name: "Lưu tin", exact: true }).waitFor({ timeout: 10000 });
  }
  await op.getByRole("button", { name: "Lưu tin", exact: true }).click();
  await op.getByRole("button", { name: "Bỏ lưu tin", exact: true }).waitFor({ timeout: 10000 });
  await op.waitForTimeout(800);
  const saved = await (await ownerCtx.request.get(BASE_URL + "/api/jobs/saved")).json();
  await op.getByText("Trước khi nhận việc").waitFor();
  // Tin tương tự tải sau thông tin chính — chờ thay vì đếm ngay.
  await op.getByText(/^Tin tương tự tại/).waitFor({ timeout: 10000 });
  await shot(op, "15_job_detail");
  return saved.includes(target.id);
});

await step("F21", "Desktop: Sidebar có Công cụ (Tin nhắn, Đăng tin, Radar) + % hoàn thiện, cột phải có Mẹo & tin gấp", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
  await ctx.addCookies(await ownerCtx.cookies());
  const p = await ctx.newPage();
  await p.goto(BASE_URL + "/");
  await p.getByText("Mẹo hôm nay").waitFor({ timeout: 15000 });
  const tools = p.getByRole("navigation", { name: "Công cụ" });
  await tools.getByRole("link", { name: /Tin nhắn/ }).waitFor();
  await tools.getByRole("link", { name: /Nail Radar/ }).waitFor();
  await tools.getByRole("link", { name: /Đăng tin tuyển thợ/ }).waitFor();
  await p.getByText(/Tin gấp mới nhất/).waitFor();
  await p.locator('aside a[href^="/jobs/"]').first().waitFor({ timeout: 10000 });
  await p.screenshot({ path: fileURLToPath(new URL("16_desktop_home.png", SHOTS)) });
  await ctx.close();
});

await step("F22", "Trang đăng ký có số liệu, cách hoạt động và FAQ mở được", async () => {
  const ctx = await newCtx();
  const p = await ctx.newPage();
  await p.goto(BASE_URL + "/auth/register");
  await p.getByText("Hoạt động thế nào?").waitFor({ timeout: 15000 });
  await p.getByText("PawNail Jobs có thu phí không?").click();
  await p.getByText(/Đăng ký, đăng tin, xem portfolio và nhắn tin đều miễn phí/).waitFor({ timeout: 5000 });
  await ctx.close();
});

await step("F23", "Menu ⋮: tự xóa bài của mình → bài biến khỏi bảng tin", async () => {
  const text = `QA bài sẽ xóa ${Date.now()}`;
  await op.goto(BASE_URL + "/?tab=feed");
  const box = op.getByPlaceholder(/Khoe tác phẩm móng mới/);
  await box.waitFor({ timeout: 15000 });
  await box.fill(text);
  await op.getByRole("button", { name: /^Đăng bài$/ }).click();
  const card = op.locator("article").filter({ hasText: text }).first();
  await card.waitFor({ timeout: 15000 });
  op.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Tùy chọn bài viết" }).click();
  await op.getByRole("menuitem", { name: /Xóa bài viết/ }).click();
  await op.getByText("Đã xóa bài viết.").waitFor({ timeout: 10000 });
  return (await op.locator("article").filter({ hasText: text }).count()) === 0;
});

await step("F24", "Menu ⋮: báo cáo bài người khác với lý do có sẵn", async () => {
  await op.goto(BASE_URL + "/?tab=feed");
  const card = op.locator("article").filter({ hasNot: op.getByText("Kim Nguyen", { exact: true }) }).first();
  await card.waitFor({ timeout: 15000 });
  await card.getByRole("button", { name: "Tùy chọn bài viết" }).click();
  await op.getByRole("menuitem", { name: /Báo cáo bài viết/ }).click();
  await op.getByRole("menuitem", { name: "Lừa đảo / spam" }).click();
  await op.getByText(/Đã gửi báo cáo/).waitFor({ timeout: 10000 });
  await shot(op, "17_report_sent");
});

await step("F25", "Thả tim: hiện dòng 'Bạn… đã thích' (người thật), double-tap ảnh hiện tim lớn", async () => {
  await op.goto(BASE_URL + "/?tab=feed");
  const card = op.locator("article").filter({ has: op.locator("img[sizes]") }).first();
  await card.waitFor({ timeout: 15000 });
  if ((await card.getByRole("button", { name: "Bỏ thích" }).count()) > 0) {
    await card.getByRole("button", { name: "Bỏ thích" }).click();
    await card.getByRole("button", { name: "Thích", exact: true }).waitFor();
  }
  await card.locator("img[sizes]").first().dblclick();
  await card.locator(".heart-big").waitFor({ state: "attached", timeout: 5000 });
  await card.getByRole("button", { name: "Bỏ thích" }).waitFor({ timeout: 10000 });
  await card.getByText(/đã thích/).waitFor({ timeout: 5000 });
  await shot(op, "18_like_effect");
});

await step("F26", "Job board: lưu tin → hiện '👀 N người đã lưu tin này'", async () => {
  await op.goto(BASE_URL + "/?tab=jobs");
  const card = op.locator("div.glass-card").filter({ has: op.getByRole("button", { name: /lưu tin$/i }) }).first();
  await card.waitFor({ timeout: 15000 });
  if ((await card.getByRole("button", { name: "Bỏ lưu tin" }).count()) === 0) await card.getByRole("button", { name: "Lưu tin" }).click();
  await card.getByText(/người đã lưu tin này/).waitFor({ timeout: 10000 });
});

await step("F27", "Mobile: hàng thẻ Công cụ hiện trên trang chủ", async () => {
  await op.goto(BASE_URL + "/");
  const row = op.getByRole("navigation", { name: "Công cụ" });
  await row.getByRole("link", { name: /Nail Radar/ }).waitFor({ timeout: 15000 });
  await shot(op, "19_mobile_tools");
});

await step("F28", "Tin nhắn: xem trước tin cuối + giờ, tìm kiếm hoạt động, header có 'Xem hồ sơ', không còn chấm online giả", async () => {
  const techs = await (await fetch(BASE_URL + "/api/technicians")).json();
  const partner = techs[0].user;
  const stamp = `QA preview ${Date.now()}`;
  await ownerCtx.request.post(BASE_URL + "/api/messages", { data: { receiverId: partner.id, content: stamp } });
  await op.goto(BASE_URL + "/messages");
  await op.getByText(`Bạn: ${stamp}`).first().waitFor({ timeout: 15000 });
  const search = op.getByRole("searchbox", { name: "Tìm cuộc trò chuyện" });
  await search.fill("zzzz-khong-co");
  await op.getByText(/Không tìm thấy cuộc trò chuyện nào/).waitFor({ timeout: 5000 });
  await search.fill(partner.name.split(" ")[0]);
  const row = op.getByRole("button", { name: new RegExp(partner.name) }).first();
  await row.waitFor({ timeout: 5000 });
  await row.click();
  await op.getByRole("link", { name: "Xem hồ sơ" }).waitFor({ timeout: 10000 });
  await op.getByText(stamp).last().waitFor({ timeout: 10000 });
  await shot(op, "20_messenger");
  return (await op.locator(".bg-emerald-500.rounded-full").count()) === 0;
});

R.check("F18", "Không có lỗi JS / HTTP 5xx trong suốt các luồng", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
const out = R.summary();
fs.writeFileSync(new URL("./reports/ui_flows.json", import.meta.url), JSON.stringify(out, null, 2));
process.exit(out.failed ? 1 : 0);
