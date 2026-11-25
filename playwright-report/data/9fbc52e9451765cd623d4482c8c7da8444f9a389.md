# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> Homepage & UI Display >> TC-HOME-01: loads homepage with HTTP 200, brand header, and guest auth actions
- Location: tests\home.spec.ts:5:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('header').getByRole('button', { name: /Đăng nhập|Sign in/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('header').getByRole('button', { name: /Đăng nhập|Sign in/i })

```

```yaml
- banner:
  - img "PawNail Jobs"
  - text: PawNail Jobs
- text: 100% miễn phí kết nối
- 'heading "SÀN KẾT NỐI NGHỀ NAIL HẢI NGOẠI #1 TẠI MỸ & ÚC" [level=1]'
- paragraph: Nơi thợ nail tìm việc gấp, chủ tiệm tìm thợ giỏi — miễn phí, nhắn tin trực tiếp, chỉ trong vài phút.
- button "TÌM VIỆC LÀM NAIL"
- button "ĐĂNG TIN TUYỂN THỢ GẤP"
- link "💅 Bạn đi làm nail? Xem mẫu & tìm tiệm gần bạn →":
  - /url: /salons
- main:
  - complementary:
    - navigation "Khám phá":
      - button "Bảng Tin"
      - button "Cần Thợ Gấp"
      - button "Thợ Đang Rảnh"
    - paragraph: Công cụ
    - navigation "Công cụ":
      - link "Tin nhắn Chat với tiệm & thợ":
        - /url: /messages
      - link "Thu nhập & tip Ghi turn + tip mỗi tối":
        - /url: /tools/income-tracker
      - link "Mẫu nail mới Ý tưởng mỗi ngày + vật tư cần chuẩn bị":
        - /url: /designs
      - link "Xu hướng tuần Mẫu hot · thợ nổi bật · lương":
        - /url: /trends
      - link "Nail Radar Mức bao lương & chia turn theo bang":
        - /url: /tools/radar
      - link "Kho hàng vật tư Vật tư giá sỉ từ các tiệm":
        - /url: /supply
  - button "Mỹ Mỹ · US" [pressed]:
    - img "Mỹ"
    - text: Mỹ · US
  - button "Úc Úc · AU":
    - img "Úc"
    - text: Úc · AU
  - button "Tất cả bang"
  - button "California"
  - button "Texas"
  - button "Florida"
  - button "New York"
  - button "Washington"
  - button "Georgia"
  - button "North Carolina"
  - button "Virginia"
  - button "Arizona"
  - button "Illinois"
  - 'textbox "Tìm theo thành phố... (VD: Los Angeles, Sydney)"'
  - tablist "Nội dung trang chủ":
    - tab "Bảng tin" [selected]
    - tab "Cần thợ gấp"
    - tab "Thợ đang rảnh"
- contentinfo:
  - paragraph: © 2026 PawNail Jobs. Nền tảng việc làm & tay nghề Nail cho thị trường Mỹ & Úc.
- alert
- status:
  - paragraph: Nhịp thị trường
  - paragraph: Texas dẫn đầu nhu cầu với 99 tin tìm thợ, nhiều nhất là thợ Bột/Acrylic (khảo sát nhóm nail Facebook, 9/2026)
  - button "Ẩn thông báo"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { attachIsolatedIp, trackRuntimeErrors } from "./helpers";
  3  | 
  4  | test.describe("Homepage & UI Display", () => {
  5  |   test("TC-HOME-01: loads homepage with HTTP 200, brand header, and guest auth actions", async ({ page }) => {
  6  |     await attachIsolatedIp(page);
  7  |     const { pageErrors, serverErrors } = trackRuntimeErrors(page);
  8  | 
  9  |     const response = await page.goto("/");
  10 |     expect(response?.status()).toBe(200);
  11 | 
  12 |     // Navbar brand & guest actions
  13 |     await expect(page.locator("header")).toBeVisible();
  14 |     await expect(page.getByAltText("PawNail Jobs").first()).toBeVisible();
> 15 |     await expect(page.locator("header").getByRole("button", { name: /Đăng nhập|Sign in/i })).toBeVisible();
     |                                                                                              ^ Error: expect(locator).toBeVisible() failed
  16 |     await expect(page.locator("header").getByRole("button", { name: /Đăng ký|Sign up/i })).toBeVisible();
  17 | 
  18 |     // Desktop sidebar explore section
  19 |     await expect(page.getByRole("navigation", { name: /Khám phá|Explore/i })).toBeVisible();
  20 | 
  21 |     expect(pageErrors).toEqual([]);
  22 |     expect(serverErrors).toEqual([]);
  23 |   });
  24 | 
  25 |   test("TC-HOME-02: switches cleanly between Feed, Urgent Jobs, and Available Techs tabs", async ({ page }) => {
  26 |     await attachIsolatedIp(page);
  27 |     await page.goto("/");
  28 | 
  29 |     const sidebarNav = page.getByRole("navigation", { name: /Khám phá|Explore/i });
  30 | 
  31 |     // Switch to Jobs tab
  32 |     await sidebarNav.getByRole("button", { name: /Cần Thợ Gấp|Urgent jobs/i }).click();
  33 |     await expect(page).toHaveURL(/\/\?tab=jobs/);
  34 | 
  35 |     // Switch to Available Techs (portfolio) tab
  36 |     await sidebarNav.getByRole("button", { name: /Thợ Đang Rảnh|Available techs/i }).click();
  37 |     await expect(page).toHaveURL(/\/\?tab=portfolio/);
  38 | 
  39 |     // Switch back to Feed tab
  40 |     await sidebarNav.getByRole("button", { name: /Bảng Tin|Feed/i }).click();
  41 |     await expect(page).toHaveURL(/\/\?tab=feed/);
  42 |   });
  43 | 
  44 |   test("TC-HOME-03: filters homepage content by US / AU market and state query params", async ({ page }) => {
  45 |     await attachIsolatedIp(page);
  46 |     const response = await page.goto("/?tab=jobs&market=US&state=CA");
  47 |     expect(response?.status()).toBe(200);
  48 | 
  49 |     await expect(page.locator("header")).toBeVisible();
  50 |     // Switch to Australia market view via URL parameter and verify UI renders cleanly
  51 |     const auRes = await page.goto("/?tab=jobs&market=AU");
  52 |     expect(auRes?.status()).toBe(200);
  53 |     await expect(page.locator("header")).toBeVisible();
  54 |   });
  55 | 
  56 |   test("TC-HOME-04: toggles bilingual UI between Vietnamese (vi) and English (en)", async ({ page }) => {
  57 |     await attachIsolatedIp(page);
  58 |     await page.goto("/salons");
  59 | 
  60 |     await expect(page.getByRole("heading", { level: 1 })).toContainText(/Tiệm & thợ nail quanh bạn|Nail salons & techs near you/);
  61 | 
  62 |     // Locate language toggle in header and switch locale
  63 |     const langBtn = page.locator("header button").filter({ hasText: /^(VI|EN|🌐)/i }).first();
  64 |     if (await langBtn.count()) {
  65 |       const beforeText = await page.getByRole("heading", { level: 1 }).innerText();
  66 |       await langBtn.click();
  67 |       await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(beforeText);
  68 |     } else {
  69 |       // Fallback: verify localStorage bitpaw_locale switches language cleanly
  70 |       await page.evaluate(() => localStorage.setItem("bitpaw_locale", "en"));
  71 |       await page.reload();
  72 |       await expect(page.getByRole("heading", { level: 1 })).toContainText("Nail salons & techs near you");
  73 |     }
  74 |   });
  75 | 
  76 |   test("TC-HOME-05: renders responsive mobile layout without horizontal overflow", async ({ page }) => {
  77 |     await attachIsolatedIp(page);
  78 |     await page.setViewportSize({ width: 390, height: 844 });
  79 | 
  80 |     const response = await page.goto("/");
  81 |     expect(response?.status()).toBe(200);
  82 | 
  83 |     await expect(page.locator("header")).toBeVisible();
  84 | 
  85 |     const hasHorizontalOverflow = await page.evaluate(() => {
  86 |       return document.documentElement.scrollWidth > window.innerWidth + 2;
  87 |     });
  88 |     expect(hasHorizontalOverflow).toBe(false);
  89 |   });
  90 | });
  91 | 
  92 | 
```