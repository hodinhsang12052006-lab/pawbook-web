// Đóng vai SÂU (UX audit): khách lạ → thợ mới → chủ tiệm mới → người quay lại.
// Mỗi bước: chụp màn hình (điện thoại), đo thời gian, ghi chữ hiển thị, lỗi JS/5xx.
// CHỈ chạy với server local (dev.db).   node scripts/qa/persona_deep.mjs
import fs from "node:fs";
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_TECH, fakeIp } from "./lib.mjs";

const OUT = (process.env.TEMP || ".") + "/deep";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const errors = [];
const browser = await chromium.launch();
let shotN = 0;

async function ctx(device = devices["Pixel 7"], locale = "vi-VN") {
  const c = await browser.newContext({ ...device, locale });
  const ip = fakeIp();
  await c.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), "cf-connecting-ip": ip } }));
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(`${p.url().replace(BASE_URL, "")}: ${e.message.slice(0, 140)}`));
  p.on("response", (r) => { if (r.status() >= 500 && r.url().startsWith(BASE_URL)) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
  return p;
}
async function step(who, name, p, fn, { full = false } = {}) {
  const t0 = Date.now();
  let ok = true, note = "";
  try { note = (await fn()) || ""; } catch (e) { ok = false; note = "LỖI: " + e.message.split("\n")[0].slice(0, 140); }
  const ms = Date.now() - t0;
  await p.waitForTimeout(700);
  const file = `${String(++shotN).padStart(2, "0")}_${who}_${name.replace(/[^\w]+/g, "_").slice(0, 30)}.png`;
  await p.screenshot({ path: `${OUT}/${file}`, fullPage: full }).catch(() => {});
  const text = (await p.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 220);
  log.push({ who, name, ok, ms, url: p.url().replace(BASE_URL, ""), note, file, text });
  console.log(`${ok ? "✓" : "✗"} ${who.padEnd(5)} ${name.padEnd(38)} ${String(ms).padStart(6)}ms  ${note}`);
}
const settle = (p) => p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
const stamp = Date.now();

// ================= KHÁCH LẠ (chưa đăng ký) =================
{
  const p = await ctx();
  await step("KHACH", "Mở bitpawos lần đầu", p, async () => { await p.goto(BASE_URL + "/"); await settle(p); return p.url().replace(BASE_URL, ""); }, { full: true });
  await step("KHACH", "Muốn xem việc trước khi đăng ký", p, async () => { await p.goto(BASE_URL + "/?tab=jobs"); await settle(p); return p.url().replace(BASE_URL, ""); });
  await step("KHACH", "Mở 1 tin tuyển qua link chia sẻ", p, async () => {
    const r = await (await fetch(BASE_URL + "/api/jobs?limit=1")).json().catch(() => ({}));
    const id = (Array.isArray(r) ? r : r.jobs)?.[0]?.id;
    await p.goto(BASE_URL + `/jobs/${id}`); await settle(p); return p.url().replace(BASE_URL, "");
  }, { full: true });
  await step("KHACH", "Xem mẫu nail khi chưa đăng nhập", p, async () => { await p.goto(BASE_URL + "/designs"); await settle(p); return p.url().replace(BASE_URL, ""); });
  await step("KHACH", "Trang đăng nhập + bấm Quên mật khẩu", p, async () => {
    await p.goto(BASE_URL + "/auth/login"); await settle(p);
    await p.getByText(/Quên mật khẩu/).first().click({ timeout: 5000 });
    await p.waitForTimeout(800);
    return (await p.locator("[role=status], .toast, div[class*=toast]").allInnerTexts().catch(() => [])).join(" ").slice(0, 160);
  });
}

// ================= THỢ MỚI =================
{
  const p = await ctx();
  await step("THO", "Đăng ký thợ — bước 1", p, async () => {
    await p.goto(BASE_URL + "/auth/register?role=technician"); await p.getByPlaceholder("VD: Kim Nails").waitFor();
    await p.getByPlaceholder("VD: Kim Nails").fill("Lan Nguyễn");
    await p.getByPlaceholder("555 123 4567").fill("7135550199");
    await p.getByPlaceholder("VD: Los Angeles").fill("Houston");
    await p.getByPlaceholder("ban@email.com").fill(`deep.t.${stamp}@qa.test`);
    await p.locator('input[type="password"]').fill("QaPass#2026");
  }, { full: true });
  await step("THO", "Đăng ký thợ — bước 2 (tay nghề)", p, async () => { await p.getByRole("button", { name: /Tiếp tục/ }).first().click(); await p.getByText("Tay nghề & mong muốn").waitFor({ timeout: 20000 }); }, { full: true });
  await step("THO", "Đăng ký thợ — bước 3 (ảnh)", p, async () => {
    const chip = p.getByRole("button", { name: /Gel-X|Bột/ }).first();
    if (await chip.count()) await chip.click();
    await p.getByRole("button", { name: /Tiếp tục/ }).first().click(); await p.waitForTimeout(1200);
  }, { full: true });
  await step("THO", "Hoàn tất đăng ký → vào app", p, async () => {
    await p.getByRole("button", { name: /Hoàn tất|Bỏ qua|Vào app|Bắt đầu/i }).last().click({ timeout: 10000 });
    await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 25000 }); await settle(p);
    return p.url().replace(BASE_URL, "");
  }, { full: true });
  await step("THO", "Mở 1 tin tuyển", p, async () => { await p.locator('a[href^="/jobs/"]').first().click({ timeout: 10000 }); await p.waitForURL(/\/jobs\//); await settle(p); }, { full: true });
  await step("THO", "Nhắn tin cho tiệm", p, async () => {
    const b = p.getByRole("button", { name: /Nhắn tin qua App/ }).or(p.getByRole("link", { name: /Nhắn tin qua App/ })).first();
    await b.click({ timeout: 8000 }); await p.getByPlaceholder(/Viết tin nhắn/).waitFor({ timeout: 20000 });
    await p.getByPlaceholder(/Viết tin nhắn/).fill("Dạ chào anh chị, tiệm còn tuyển thợ không ạ?"); await p.keyboard.press("Enter"); await p.waitForTimeout(1200);
  });
  await step("THO", "Hồ sơ của tôi", p, async () => { await p.goto(BASE_URL + "/profile"); await settle(p); }, { full: true });
  await step("THO", "Bật báo việc gần tôi", p, async () => { await p.goto(BASE_URL + "/?tab=jobs"); await settle(p); const b = p.getByRole("button", { name: /Báo tôi khi có việc/ }).first(); if (await b.count()) { await b.click(); await p.waitForTimeout(1000); return "có nút báo việc"; } return "KHÔNG thấy nút báo việc"; });
  await step("THO", "Mẫu nail", p, async () => { await p.goto(BASE_URL + "/designs"); await settle(p); const c = p.locator("main button.group").first(); if (await c.count()) { await c.click(); await p.waitForTimeout(800); return "mở chi tiết mẫu"; } return "chưa có mẫu"; }, { full: true });
  await step("THO", "Xu hướng & lương", p, async () => { await p.goto(BASE_URL + "/trends"); await settle(p); }, { full: true });
  await step("THO", "Thu nhập & tip", p, async () => { await p.goto(BASE_URL + "/tools/income-tracker"); await settle(p); }, { full: true });
  await step("THO", "Hộp thư", p, async () => { await p.goto(BASE_URL + "/messages"); await settle(p); });
  await step("THO", "Thông báo (chuông)", p, async () => { await p.goto(BASE_URL + "/?tab=feed"); await settle(p); await p.getByRole("button", { name: "Thông báo" }).first().click({ timeout: 5000 }); await p.waitForTimeout(800); });
  await step("THO", "Bảng tin", p, async () => { await p.keyboard.press("Escape"); await p.goto(BASE_URL + "/?tab=feed"); await settle(p); }, { full: true });
  await step("THO", "Đổi sang tiếng Anh", p, async () => { await p.getByRole("button", { name: /EN|Language|Ngôn ngữ/ }).first().click({ timeout: 5000 }); await p.waitForTimeout(1200); });
}

// ================= CHỦ TIỆM MỚI =================
{
  const p = await ctx();
  await step("CHU", "Đăng ký chủ tiệm", p, async () => {
    await p.goto(BASE_URL + "/auth/register?role=owner"); await p.getByPlaceholder("VD: Happy Nails & Spa").waitFor();
    await p.getByPlaceholder("Nguyễn Văn A").fill("Tony Trần");
    await p.getByPlaceholder("VD: Happy Nails & Spa").fill("Tony Nails Spa");
    await p.getByPlaceholder("VD: Los Angeles").fill("Dallas");
    await p.getByPlaceholder("555 123 4567").fill("2145550123");
    await p.getByPlaceholder("VD: $1,200-1,500/tuần").fill("$1,300/tuần");
    await p.getByPlaceholder("ban@email.com").fill(`deep.o.${stamp}@qa.test`);
    await p.locator('input[type="password"]').fill("QaPass#2026");
  }, { full: true });
  await step("CHU", "Khảo sát", p, async () => { await p.getByRole("button", { name: /Tiếp tục khảo sát nhanh/ }).click(); await p.waitForTimeout(1200); }, { full: true });
  await step("CHU", "Bỏ qua khảo sát / chẩn đoán", p, async () => {
    const skip = p.getByRole("button", { name: /Bỏ qua khảo sát/ });
    if (await skip.count()) await skip.click(); else for (let q = 0; q < 8; q++) { const o = p.locator("button.w-full.text-left").first(); if (!(await o.isVisible().catch(() => false))) break; await o.click(); await p.waitForTimeout(600); }
    await p.waitForTimeout(2500);
  }, { full: true });
  await step("CHU", "Vào app (danh sách thợ)", p, async () => {
    const cta = p.getByRole("button", { name: /Tiếp tục tìm thợ|Trải nghiệm|Vào/ }).first(); if (await cta.count()) await cta.click();
    await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 }); await settle(p);
  }, { full: true });
  await step("CHU", "Xem hồ sơ 1 thợ", p, async () => { await p.locator('button:has(img), a[href^="/profile/"]').first().click({ timeout: 10000 }); await p.waitForTimeout(2000); }, { full: true });
  await step("CHU", "Nhắn thợ", p, async () => {
    const b = p.getByRole("button", { name: /Nhắn tin/ }).or(p.getByRole("link", { name: /Nhắn tin/ })).first();
    await b.click({ timeout: 8000 }); await p.getByPlaceholder(/Viết tin nhắn/).waitFor({ timeout: 20000 });
  });
  await step("CHU", "Đăng tin tuyển", p, async () => { await p.goto(BASE_URL + "/jobs/create"); await settle(p); }, { full: true });
  await step("CHU", "Hồ sơ tiệm", p, async () => { await p.goto(BASE_URL + "/profile"); await settle(p); }, { full: true });
  await step("CHU", "Kho vật tư", p, async () => { await p.goto(BASE_URL + "/supply"); await settle(p); }, { full: true });
  await step("CHU", "Radar lương", p, async () => { await p.goto(BASE_URL + "/tools/radar"); await settle(p); }, { full: true });
}

// ================= NGƯỜI QUAY LẠI (máy tính) =================
{
  const p = await ctx({ viewport: { width: 1366, height: 860 } });
  await step("QUAY", "Đăng nhập lại", p, async () => {
    await p.goto(BASE_URL + "/auth/login"); await p.locator("#email").fill(SEED_TECH); await p.locator("#password").fill(DEMO_PASSWORD);
    await p.getByRole("button", { name: /^Đăng nhập$/ }).click(); await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 }); await settle(p);
  }, { full: true });
}

fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors }, null, 1));
console.log("\nLỗi JS/5xx:", errors.length ? errors : "không");
await browser.close();
