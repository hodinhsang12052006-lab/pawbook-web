// Kiểm thử PawNail Studio (nội dung theo mùa), "Chào mừng trở lại", bộ lọc
// gọn trên mobile và nền mới. CHỈ chạy với server local trỏ vào dev.db.
//   node scripts/qa/studio_test.mjs
import { chromium, devices } from "playwright";
import { BASE_URL, Client, DEMO_PASSWORD, Results, SEED_TECH, SEED_OWNER } from "./lib.mjs";

const R = new Results("PawNail Studio & giữ chân");
const OUT = process.env.TEMP || ".";

// ---- API ----
const anon = new Client();
const st = await anon.req("/api/studio?market=US&role=TECHNICIAN");
R.check("ST1", "/api/studio công khai: có chủ đề tuần, hashtag thử thách, mẹo hôm nay", st.status === 200 && st.data.theme?.hashtag && st.data.challenge?.hashtag === st.data.theme.hashtag && typeof st.data.tip === "string", JSON.stringify(st.data).slice(0, 200));
R.check("ST2", "/api/studio không lộ SĐT/email", !/"(phone|email|password)"/.test(JSON.stringify(st.data)));
const ow = await anon.req("/api/studio?market=US&role=OWNER");
R.check("ST3", "Mẹo theo vai trò (chủ tiệm ≠ thợ)", ow.data.tip !== st.data.tip, `${ow.data.tip} | ${st.data.tip}`);
const dg0 = await anon.req("/api/home/digest?since=2026-01-01T00:00:00Z");
R.check("ST4", "/api/home/digest bắt buộc đăng nhập", dg0.status === 401, dg0.status);
const tc = new Client();
await tc.login(SEED_TECH);
const bad = await tc.req("/api/home/digest?since=khong-hop-le");
R.check("ST5", "since rác → 400", bad.status === 400, bad.status);
const dg = await tc.req(`/api/home/digest?since=${new Date(Date.now() - 3 * 86_400_000).toISOString()}`);
R.check("ST6", "Digest chỉ trả số đếm", dg.status === 200 && ["newJobs", "likes", "comments", "saves", "newTechs"].every((k) => Number.isInteger(dg.data[k])) && !/"(phone|email)"/.test(JSON.stringify(dg.data)), JSON.stringify(dg.data));
const far = await tc.req("/api/home/digest?since=2000-01-01T00:00:00Z");
R.check("ST7", "since quá xa bị giới hạn 30 ngày", new Date(far.data.since).getTime() >= Date.now() - 31 * 86_400_000, far.data.since);

// ---- UI ----
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(BASE_URL + "/auth/login");
  await p.locator("#email").fill(SEED_TECH);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  const me = await p.evaluate(() => fetch("/api/auth/session").then((r) => r.json()).then((s) => s.user.id));

  // Giả lập lần ghé trước là 2 ngày trước → thẻ "Có gì mới" phải hiện.
  // Đặt mốc khi đang ở trang KHÔNG có thẻ này (trang chủ ngay sau đăng nhập
  // có thể ghi đè mốc "bây giờ" sau khi test đặt, nếu server đang chậm).
  await p.goto(BASE_URL + "/terms");
  await p.evaluate(([id]) => {
    localStorage.setItem(`pn_last_visit_${id}`, String(Date.now() - 2 * 86_400_000));
    localStorage.removeItem("pn_studio_hide");
    sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 }));
  }, [me]);
  await p.goto(BASE_URL + "/?tab=feed");
  const wb = p.getByRole("region", { name: "Có gì mới từ lần trước" });
  const wbShown = await wb.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  R.check("ST8", "Quay lại sau 2 ngày → thẻ 'Có gì mới từ lần trước bạn ghé'", wbShown);
  await p.screenshot({ path: `${OUT}/st_home.png` });
  if (wbShown) {
    const jobsChip = wb.getByRole("button", { name: /tin tuyển mới/ });
    if (await jobsChip.count()) {
      await jobsChip.click();
      await p.waitForTimeout(600);
      R.check("ST9", "Bấm 'N tin tuyển mới' → chuyển sang tab Việc gấp", (await p.locator('[role="tab"][aria-selected="true"]').innerText()).includes("Việc gấp"));
    } else R.check("ST9", "Chip tin tuyển mới", true, "không có tin mới trong 2 ngày — bỏ qua");
  } else R.check("ST9", "Chip tin tuyển mới", false, "thẻ không hiện");
  await p.reload();
  await p.waitForTimeout(1500);
  R.check("ST10", "Tải lại ngay → thẻ không hiện lại (chỉ hiện khi vắng ≥4 giờ)", (await wb.count()) === 0);

  // Bộ lọc gọn trên mobile
  await p.goto(BASE_URL + "/?tab=feed");
  const allStates = p.getByRole("button", { name: "Tất cả bang" });
  await allStates.waitFor({ timeout: 10000 });
  const filterBox = await allStates.evaluate((el) => el.closest(".glass-card").getBoundingClientRect().height);
  await p.getByRole("button", { name: "Tìm theo thành phố" }).click();
  const searchShown = await p.getByPlaceholder("Thành phố… (VD: Houston, Sydney)").isVisible();
  R.check("ST11", "Bộ lọc mobile gọn 1 hàng (<70px) + nút 🔍 mở ô tìm", filterBox < 70 && searchShown, `h=${filterBox}`);
  R.check("ST12", "Nút ＋ trùng lặp ở thanh trên đã ẩn trên mobile", (await p.getByTitle("Đăng ảnh portfolio").isVisible()) === false);

  // Thẻ chủ đề tuần → Tham gia → ô soạn bài có hashtag
  const theme = p.getByRole("region", { name: /Chủ đề tuần/ });
  const themeShown = await theme.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  R.check("ST13", "Bảng tin có thẻ 'PawNail Studio · Chủ đề tuần'", themeShown && (await theme.getByText("PawNail Studio").count()) > 0);
  await p.screenshot({ path: `${OUT}/st_theme.png` });
  if (themeShown) {
    await theme.getByRole("button", { name: /Tham gia #/ }).click();
    await p.waitForTimeout(1200);
    const val = await p.locator("textarea").first().inputValue();
    R.check("ST14", "Bấm 'Tham gia #…' → ô soạn bài điền sẵn hashtag thử thách", val.includes(`#${st.data.theme.hashtag}`), val);
    // Chip gợi ý hashtag thử thách hiển thị đã dùng (disabled)
    const chip = p.getByRole("button", { name: `#${st.data.theme.hashtag}`, exact: true });
    R.check("ST15", "Chip gợi ý hashtag hiện & đánh dấu đã dùng", (await chip.count()) > 0 && (await chip.first().isDisabled()));
    await p.locator("textarea").first().fill("");
    // Nút ✕ "Ẩn chủ đề hôm nay" phải bấm được (không bị nội dung thẻ đè lên).
    await theme.getByRole("button", { name: "Ẩn chủ đề hôm nay" }).click({ timeout: 5000 });
    R.check("ST13b", "Nút ✕ trên thẻ chủ đề bấm được và ẩn thẻ trong hôm nay", (await theme.count()) === 0);
    await p.evaluate(() => localStorage.removeItem("pn_studio_hide"));
  }

  // Mẹo hôm nay chen trong bảng tin
  const tip = p.getByText("Mẹo hôm nay · PawNail Studio");
  for (let i = 0; i < 6 && !(await tip.count()); i++) {
    await p.evaluate(() => window.scrollBy(0, 900));
    await p.waitForTimeout(500);
  }
  R.check("ST16", "Thẻ 'Mẹo hôm nay' xuất hiện giữa bảng tin", (await tip.count()) > 0);

  // Trang xu hướng có bảng thử thách
  await p.goto(BASE_URL + "/trends");
  const ch = await p.getByRole("heading", { name: new RegExp(`Thử thách #${st.data.theme.hashtag}`) }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  R.check("ST17", "Trang Xu hướng có bảng 'Thử thách #…'", ch);

  // Nền: có lớp aurora; mobile đứng yên
  const anim = await p.evaluate(() => getComputedStyle(document.querySelector(".app-backdrop .aurora-1")).animationName);
  R.check("ST18", "Nền aurora tồn tại, đứng yên trên mobile", anim === "none", anim);
  const dctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: "vi-VN" });
  const dp = await dctx.newPage();
  await dp.goto(BASE_URL + "/auth/login");
  const danim = await dp.evaluate(() => getComputedStyle(document.querySelector(".app-backdrop .aurora-1")).animationName);
  R.check("ST19", "Nền aurora chuyển động chậm trên desktop", danim === "bgDrift1", danim);
} finally {
  await browser.close();
}
R.check("ST20", "Không có lỗi JS", errors.length === 0, errors.join(" | "));
const s = R.summary();
process.exit(s.failed ? 1 : 0);
