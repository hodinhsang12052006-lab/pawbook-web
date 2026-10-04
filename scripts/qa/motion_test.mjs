// Kiểm thử điều hướng mobile + chuyển động + FOMO toast v2.
// CHỈ chạy với server local trỏ vào dev.db.   node scripts/qa/motion_test.mjs
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, Results } from "./lib.mjs";

const R = new Results("Điều hướng & chuyển động");
const OUT = process.env.TEMP || ".";
const browser = await chromium.launch();
const errors = [];

async function login(ctx, email) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  await p.goto(BASE_URL + "/auth/login");
  await p.locator("#email").fill(email);
  await p.locator("#password").fill(DEMO_PASSWORD);
  await p.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  return p;
}

// Vuốt bằng sự kiện chạm thật (CDP) — giống ngón tay trên điện thoại.
async function swipe(page, cdp, fromX, toX, y) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fromX, y }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fromX + ((toX - fromX) * i) / 6, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(450);
}

const selectedTab = (p) => p.locator('[role="tab"][aria-selected="true"]').innerText();

try {
  // ===== THỢ trên điện thoại =====
  const tc = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const tp = await login(tc, SEED_TECH);
  const cdp = await tc.newCDPSession(tp);
  await tp.goto(BASE_URL + "/?tab=feed");
  const nav = tp.getByRole("navigation", { name: "Điều hướng chính" });
  await nav.waitFor({ timeout: 15000 });

  // Tên truy cập của từng nút (avatar ở mục Hồ sơ là aria-hidden).
  const clean = [];
  for (const b of await nav.locator("button").all()) {
    clean.push(((await b.getAttribute("aria-label")) || (await b.locator(":scope > span").last().innerText())).trim());
  }
  R.check("M1", "Thanh điều hướng thợ: Bảng tin · Việc làm · ＋ · Tin nhắn · Hồ sơ", ["Bảng tin", "Việc làm", "Tin nhắn", "Hồ sơ"].every((l) => clean.includes(l)) && (await nav.getByRole("button", { name: "Đăng bài mới" }).count()) === 1, clean.join("|"));

  await nav.getByRole("button", { name: "Việc làm" }).click();
  await tp.waitForTimeout(600);
  R.check("M2", "Bấm 'Việc làm' → tab Việc gấp, URL ?tab=jobs, nút sáng đúng", (await selectedTab(tp)).includes("Việc gấp") && tp.url().includes("tab=jobs") && (await nav.getByRole("button", { name: "Việc làm" }).getAttribute("aria-current")) === "page", tp.url());

  // Cuộn để thanh tab lên gần đầu màn hình, rồi vuốt ngay trên vùng nội dung.
  await tp.evaluate(() => {
    const el = document.querySelector('[role="tablist"]');
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90);
  });
  await tp.waitForTimeout(400);
  const box = await tp.locator('[role="tablist"]').boundingBox();
  const y = Math.min(box.y + box.height + 200, tp.viewportSize().height - 160);
  await swipe(tp, cdp, 330, 60, y);
  const afterLeft = await selectedTab(tp);
  await swipe(tp, cdp, 60, 330, y);
  const afterRight = await selectedTab(tp);
  R.check("M3", "Vuốt trái → 'Thợ rảnh', vuốt phải → quay lại 'Việc gấp'", afterLeft.includes("Thợ rảnh") && afterRight.includes("Việc gấp"), `${afterLeft} / ${afterRight}`);

  // Vuốt trên hàng chip bang (cuộn ngang) KHÔNG được đổi tab
  await tp.evaluate(() => window.scrollTo(0, 0));
  await tp.waitForTimeout(300);
  const chip = await tp.getByRole("button", { name: "Tất cả bang" }).boundingBox();
  await swipe(tp, cdp, 330, 60, chip.y + chip.height / 2);
  R.check("M4", "Vuốt trên hàng chip bang chỉ cuộn, không đổi tab", (await selectedTab(tp)).includes("Việc gấp"), await selectedTab(tp));

  // Viên chọn trượt đúng vị trí
  const tx = await tp.locator('[role="tablist"] > span[aria-hidden]').evaluate((el) => el.style.transform);
  R.check("M5", "Viên chọn tab dịch đúng vị trí (translateX(100%))", tx === "translateX(100%)", tx);

  // ＋ → mở ô soạn bài
  await nav.getByRole("button", { name: "Đăng bài mới" }).click();
  await tp.waitForTimeout(1200);
  const focused = await tp.evaluate(() => document.activeElement?.tagName === "TEXTAREA" && /Khoe tác phẩm/.test(document.activeElement.getAttribute("placeholder") || ""));
  R.check("M6", "Bấm ＋ → về Bảng tin và focus ô soạn bài", focused && (await selectedTab(tp)).includes("Bảng tin"));
  await tp.screenshot({ path: `${OUT}/m_compose.png` });

  // Cuộn xuống ẩn thanh, cuộn lên hiện lại
  await tp.locator("textarea").first().blur();
  await tp.evaluate(() => window.scrollTo(0, 0));
  await tp.waitForTimeout(300);
  // Chế độ giả lập cảm ứng không nhận con lăn chuột — cuộn trực tiếp từng bước.
  for (let i = 1; i <= 6; i++) {
    await tp.evaluate((yy) => window.scrollTo(0, yy), i * 150);
    await tp.waitForTimeout(60);
  }
  await tp.waitForTimeout(500);
  const hiddenCls = await nav.getAttribute("class");
  for (let i = 1; i <= 3; i++) {
    await tp.evaluate((yy) => window.scrollTo(0, yy), 900 - i * 100);
    await tp.waitForTimeout(60);
  }
  await tp.waitForTimeout(500);
  const shownCls = await nav.getAttribute("class");
  R.check("M7", "Cuộn xuống ẩn thanh điều hướng, cuộn lên hiện lại", hiddenCls.includes("translate-y-[calc") && !shownCls.includes("translate-y-[calc"), "");

  // FOMO toast v2 xuất hiện (lần đầu ~9 giây), có nhãn loại + đóng được
  await tp.evaluate(() => sessionStorage.removeItem("pn_fomo_session"));
  await tp.goto(BASE_URL + "/?tab=feed");
  const toast = tp.locator('[role="status"]').filter({ has: tp.getByRole("button", { name: "Ẩn thông báo" }) });
  const appeared = await toast.waitFor({ timeout: 16000 }).then(() => true).catch(() => false);
  const label = appeared ? await toast.locator("p").first().innerText() : "";
  R.check("M8", "FOMO toast xuất hiện với nhãn loại sự kiện", appeared && /TIN TUYỂN|THỢ CẬP NHẬT|BÀI ĐĂNG|NHỊP THỊ TRƯỜNG/i.test(label), label);
  await tp.screenshot({ path: `${OUT}/m_fomo.png` });
  if (appeared) {
    await toast.getByRole("button", { name: "Ẩn thông báo" }).click();
    await tp.waitForTimeout(400);
    const gone = (await toast.count()) === 0;
    await tp.waitForTimeout(12000);
    R.check("M9", "Đóng toast → biến mất và không hiện lại ngay (tạm hoãn 3 phút)", gone && (await toast.count()) === 0);
  } else R.check("M9", "Đóng toast", false, "toast không xuất hiện");

  // Không hiện toast ở trang tin nhắn
  await tp.evaluate(() => sessionStorage.removeItem("pn_fomo_session"));
  await tp.goto(BASE_URL + "/messages");
  await tp.waitForTimeout(12000);
  R.check("M10", "Không hiện FOMO toast ở trang Tin nhắn", (await toast.count()) === 0);

  // ===== CHỦ TIỆM =====
  const oc = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const op = await login(oc, SEED_OWNER);
  await op.goto(BASE_URL + "/?tab=feed");
  const onav = op.getByRole("navigation", { name: "Điều hướng chính" });
  await onav.waitFor({ timeout: 15000 });
  await onav.getByRole("button", { name: "Tìm thợ" }).click();
  await op.waitForTimeout(600);
  const ownerTab = await selectedTab(op);
  await onav.getByRole("button", { name: "Đăng tin tuyển thợ" }).click();
  await op.waitForURL(/\/jobs\/create/, { timeout: 15000 }).catch(() => {});
  R.check("M11", "Chủ tiệm: 'Tìm thợ' → tab Thợ rảnh; ＋ → trang đăng tin", ownerTab.includes("Thợ rảnh") && op.url().includes("/jobs/create"), `${ownerTab} ${op.url()}`);
  await op.goto(BASE_URL + "/?tab=jobs");
  await op.waitForTimeout(1500);
  await op.screenshot({ path: `${OUT}/m_owner_nav.png` });

  // ===== Desktop đang tải hồ sơ — cột trái là khung chờ, không lóe "Thành viên" =====
  const dc = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "vi-VN" });
  const dp = await login(dc, SEED_OWNER);
  await dp.route("**/api/profile?id=*", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await dp.goto(BASE_URL + "/");
  await dp.waitForTimeout(1000);
  const flash = (await dp.getByText("Chưa cập nhật khu vực").count()) + (await dp.getByText("Thành viên", { exact: true }).count());
  await dp.screenshot({ path: `${OUT}/m_loading.png` });
  const loaded = await dp.getByText("Kim Nguyen").first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  R.check("M12", "Đang tải: cột trái là khung chờ (không lóe 'Thành viên · Chưa cập nhật khu vực'), rồi hiện đúng tên", flash === 0 && loaded, `flash=${flash}`);
} finally {
  await browser.close();
}
R.check("M13", "Không có lỗi JS", errors.length === 0, errors.join(" | "));
const s = R.summary();
process.exit(s.failed ? 1 : 0);
