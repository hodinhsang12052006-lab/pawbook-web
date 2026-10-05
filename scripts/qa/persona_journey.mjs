// Hành trình người dùng THẬT (đóng vai): thợ mới, chủ tiệm mới, người quay lại.
// Chụp màn hình từng bước + đo thời gian + đếm thao tác → dùng để đánh giá UX.
// CHỈ chạy với server local (dev.db).   node scripts/qa/persona_journey.mjs
import fs from "node:fs";
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_TECH, fakeIp } from "./lib.mjs";

const OUT = (process.env.TEMP || ".") + "/persona";
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (who, step, data) => {
  const row = { who, step, ...data };
  log.push(row);
  console.log(`${who.padEnd(6)} ${step.padEnd(34)} ${JSON.stringify(data)}`);
};
const browser = await chromium.launch();
const errors = [];

async function ctxFor(device = devices["Pixel 7"]) {
  const ctx = await browser.newContext({ ...device, locale: "vi-VN" });
  const ip = fakeIp();
  await ctx.route(BASE_URL + "/**", (route) => route.continue({ headers: { ...route.request().headers(), "cf-connecting-ip": ip } }));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return p;
}
async function timed(p, fn) {
  const t0 = Date.now();
  await fn();
  return Date.now() - t0;
}
const shot = (p, name, full = false) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }).catch(() => {});
const visibleText = (p) => p.evaluate(() => document.body.innerText.slice(0, 600).replace(/\s+/g, " "));
const countInputs = (p) => p.evaluate(() => [...document.querySelectorAll("input,select,textarea")].filter((e) => e.offsetParent && e.type !== "hidden" && e.type !== "file").length);

// ================= PERSONA A: thợ mới, điện thoại =================
{
  const p = await ctxFor();
  let ms = await timed(p, async () => {
    await p.goto(BASE_URL + "/");
    await p.waitForURL(/\/auth\/register/);
    await p.getByRole("heading").first().waitFor();
  });
  note("THỢ", "Mở app lần đầu → trang đăng ký", { ms });
  await shot(p, "A01_landing", true);
  await shot(p, "A01_landing_fold");

  await p.goto(BASE_URL + "/auth/register?role=technician");
  await p.getByPlaceholder("VD: Kim Nails").waitFor();
  note("THỢ", "Đăng ký bước 1: số ô phải điền", { inputs: await countInputs(p) });
  await shot(p, "A02_reg_step1", true);
  const stamp = Date.now();
  await p.getByPlaceholder("VD: Kim Nails").fill("Lan Nguyễn");
  await p.getByPlaceholder("555 123 4567").fill("7135550199");
  await p.getByPlaceholder("VD: Los Angeles").fill("Houston");
  note("THỢ", "Gõ Houston → ô Bang tự chọn", { state: await p.getByLabel(/Bang|Tiểu bang/).first().inputValue().catch(() => "?") });
  await p.getByPlaceholder("ban@email.com").fill(`persona.${stamp}@qa.test`);
  await p.locator('input[type="password"]').fill("QaPass#2026");
  await p.getByRole("button", { name: /Tiếp tục/ }).first().click();
  await p.getByText("Tay nghề & mong muốn").waitFor({ timeout: 20000 });
  note("THỢ", "Đăng ký bước 2: số ô", { inputs: await countInputs(p) });
  await shot(p, "A03_reg_step2", true);
  await p.getByRole("button", { name: /Bột|Acrylic/ }).first().click();
  await p.getByRole("button", { name: /Tiếp tục/ }).last().click();
  await p.getByText("Ảnh mẫu móng của bạn").waitFor({ timeout: 10000 });
  await shot(p, "A04_reg_step3", true);
  // Người dùng thật hay BỎ QUA ảnh lúc đăng ký → thử hoàn tất không ảnh
  const finish = p.getByRole("button", { name: /Hoàn Tất/ });
  const canSkip = await finish.isEnabled();
  note("THỢ", "Bước 3: hoàn tất được khi chưa có ảnh?", { canSkip });
  if (!canSkip) {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await p.locator('input[type="file"]').setInputFiles({ name: "nail.png", mimeType: "image/png", buffer: png });
    await p.waitForTimeout(2500);
  }
  ms = await timed(p, async () => {
    await finish.click();
    await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
    await p.waitForLoadState("networkidle").catch(() => {});
  });
  note("THỢ", "Hoàn tất → vào app", { ms });
  await p.waitForTimeout(1500);
  await shot(p, "A05_first_home");
  await shot(p, "A05_first_home_full", true);
  note("THỢ", "Màn hình đầu tiên sau đăng ký (chữ)", { text: (await visibleText(p)).slice(0, 300) });

  ms = await timed(p, async () => {
    await p.getByRole("link", { name: /Việc làm/ }).last().click().catch(() => p.goto(BASE_URL + "/?tab=jobs"));
    await p.getByRole("link", { name: /Gọi ngay/ }).first().waitFor({ timeout: 15000 });
  });
  note("THỢ", "Bấm Việc làm → thấy tin", { ms });
  await shot(p, "A06_jobs");
  await p.getByRole("link", { name: /Gọi ngay/ }).first().evaluate((el) => el.closest("article,div[class*=rounded]")?.querySelector("a,h3")?.click());
  await p.waitForURL(/\/jobs\//, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await shot(p, "A07_job_detail", true);
  note("THỢ", "Chi tiết tin", { url: p.url().replace(BASE_URL, "") });

  const msgBtn = p.getByRole("button", { name: /Nhắn tin qua App/ }).or(p.getByRole("link", { name: /Nhắn tin qua App/ })).first();
  if (await msgBtn.count()) {
    ms = await timed(p, async () => {
      await msgBtn.click();
      await p.getByPlaceholder(/Viết tin nhắn/).waitFor({ timeout: 20000 });
    });
    note("THỢ", "Nhắn tiệm từ tin → khung chat sẵn sàng", { ms });
    await shot(p, "A08_chat_first");
  }
  await p.goto(BASE_URL + "/profile");
  await p.waitForTimeout(1500);
  await shot(p, "A09_profile_full", true);
  await p.goto(BASE_URL + "/?tab=feed");
  await p.getByRole("button", { name: "Thông báo" }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  await shot(p, "A10_bell");
  await p.goto(BASE_URL + "/trends");
  await p.waitForTimeout(1500);
  await shot(p, "A11_trends_full", true);
}

// ================= PERSONA B: chủ tiệm mới =================
{
  const p = await ctxFor();
  await p.goto(BASE_URL + "/auth/register?role=owner");
  await p.getByPlaceholder("VD: Happy Nails & Spa").waitFor({ timeout: 15000 });
  note("CHỦ", "Đăng ký chủ tiệm: số ô", { inputs: await countInputs(p) });
  await shot(p, "B01_reg", true);
  const stamp = Date.now();
  await p.getByPlaceholder("Nguyễn Văn A").fill("Tony Trần");
  await p.getByPlaceholder("VD: Happy Nails & Spa").fill("Tony Nails Spa");
  await p.getByPlaceholder("VD: Los Angeles").fill("Dallas");
  note("CHỦ", "Gõ Dallas → ô Bang tự chọn", { state: await p.getByLabel(/Bang|Tiểu bang/).first().inputValue().catch(() => "?") });
  await p.getByPlaceholder("555 123 4567").fill("2145550123");
  await p.getByPlaceholder("VD: $1,200-1,500/tuần").fill("$1,300/tuần");
  await p.getByPlaceholder("ban@email.com").fill(`persona.o.${stamp}@qa.test`);
  await p.locator('input[type="password"]').fill("QaPass#2026");
  await p.getByRole("button", { name: /Tiếp tục khảo sát nhanh/ }).click();
  let q = 0;
  const t0 = Date.now();
  for (; q < 8; q++) {
    const opt = p.locator("button.w-full.text-left").first();
    if (!(await opt.isVisible().catch(() => false))) break;
    if (q === 0) await shot(p, "B02_survey_q1");
    await opt.click();
    await p.waitForTimeout(700);
  }
  note("CHỦ", "Khảo sát bắt buộc trước khi vào app", { questions: q, ms: Date.now() - t0 });
  await p.waitForTimeout(3500);
  await shot(p, "B03_diagnostic", true);
  note("CHỦ", "Màn chẩn đoán (chữ)", { text: (await visibleText(p)).slice(0, 260) });
  const cta = p.getByRole("button", { name: /Tiếp tục tìm thợ|Trải nghiệm/ }).first();
  if (await cta.count()) await cta.click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2000);
  await shot(p, "B04_owner_home");
  await shot(p, "B04_owner_home_full", true);
  await p.goto(BASE_URL + "/?tab=technicians");
  await p.waitForTimeout(2000);
  await shot(p, "B05_techs");
  const firstTech = p.locator('a[href^="/profile/"]').first();
  if (await firstTech.count()) {
    await firstTech.click();
    await p.waitForURL(/\/profile\//, { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await shot(p, "B06_tech_profile", true);
    const unlock = p.getByRole("button", { name: /Mở khóa liên hệ/ }).first();
    if (await unlock.count()) {
      await unlock.click();
      await p.waitForTimeout(1200);
      await shot(p, "B07_unlock_modal");
      note("CHỦ", "Muốn nhắn thợ → phải qua 'Mở khóa'", { text: (await visibleText(p)).slice(0, 200) });
    }
  }
}

// ================= PERSONA C: thợ quay lại sau 3 ngày, máy tính =================
{
  const p = await ctxFor({ viewport: { width: 1366, height: 860 } });
  await p.goto(BASE_URL + "/auth/login");
  await shot(p, "C01_login");
  await p.locator("#email").fill(SEED_TECH);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  const me = await p.evaluate(() => fetch("/api/auth/session").then((r) => r.json()).then((s) => s.user.id));
  await p.goto(BASE_URL + "/terms");
  await p.evaluate((id) => localStorage.setItem(`pn_last_visit_${id}`, String(Date.now() - 3 * 86400000)), me);
  const ms = await timed(p, async () => {
    await p.goto(BASE_URL + "/?tab=feed");
    await p.waitForLoadState("networkidle").catch(() => {});
  });
  note("QUAY LẠI", "Trang chủ desktop tải xong", { ms });
  await p.waitForTimeout(1500);
  await shot(p, "C02_return_home");
  await shot(p, "C02_return_home_full", true);
}

fs.writeFileSync(`${OUT}/journey.json`, JSON.stringify({ log, errors }, null, 1));
console.log("\nLỗi JS:", errors.length ? errors : "không");
await browser.close();
