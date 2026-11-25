# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> Homepage & UI Display >> TC-HOME-01: loads homepage with HTTP 200, brand header, and guest auth actions
- Location: tests\home.spec.ts:5:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   "HTTP 500 /api/studio",
+   "HTTP 500 /api/radar",
+   "HTTP 500 /api/supply",
+   "HTTP 500 /api/posts",
+   "HTTP 500 /api/jobs",
+   "HTTP 500 /api/jobs",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5] [cursor=pointer]:
          - img "PawNail Jobs" [ref=e7]
          - generic [ref=e8]: PawNail Jobs
        - generic [ref=e10]:
          - button "VI / EN" [ref=e11] [cursor=pointer]:
            - generic [ref=e12]: VI
            - generic [ref=e13]: /
            - generic [ref=e14]: EN
          - button "Đăng nhập" [ref=e15] [cursor=pointer]
          - button "Đăng ký" [ref=e16] [cursor=pointer]
    - generic [ref=e21]:
      - generic [ref=e22]:
        - img [ref=e23]
        - text: 100% miễn phí kết nối
      - 'heading "SÀN KẾT NỐI NGHỀ NAIL HẢI NGOẠI #1 TẠI MỸ & ÚC" [level=1] [ref=e26]':
        - text: SÀN KẾT NỐI NGHỀ NAIL
        - text: "HẢI NGOẠI #1 TẠI MỸ & ÚC"
      - paragraph [ref=e27]: Nơi thợ nail tìm việc gấp, chủ tiệm tìm thợ giỏi — miễn phí, nhắn tin trực tiếp, chỉ trong vài phút.
      - generic [ref=e28]:
        - button "TÌM VIỆC LÀM NAIL" [ref=e29]:
          - img [ref=e30]
          - text: TÌM VIỆC LÀM NAIL
        - button "ĐĂNG TIN TUYỂN THỢ GẤP" [ref=e33]:
          - img [ref=e34]
          - text: ĐĂNG TIN TUYỂN THỢ GẤP
      - link "💅 Bạn đi làm nail? Xem mẫu & tìm tiệm gần bạn →" [ref=e39] [cursor=pointer]:
        - /url: /salons
    - main [ref=e40]:
      - generic [ref=e41]:
        - complementary [ref=e42]:
          - generic [ref=e44]:
            - generic [ref=e45]:
              - paragraph [ref=e46]: Tham gia PawNail
              - paragraph [ref=e47]: Miễn phí — tìm việc, tìm thợ và nhắn tin trực tiếp.
              - generic [ref=e48]:
                - link "Đăng ký" [ref=e49] [cursor=pointer]:
                  - /url: /auth/register
                - link "Đăng nhập" [ref=e50] [cursor=pointer]:
                  - /url: /auth/login
            - navigation "Khám phá" [ref=e51]:
              - button "Bảng Tin" [ref=e52]:
                - img [ref=e53]
                - generic [ref=e56]: Bảng Tin
              - button "Cần Thợ Gấp" [ref=e57]:
                - img [ref=e58]
                - generic [ref=e61]: Cần Thợ Gấp
              - button "Thợ Đang Rảnh" [ref=e62]:
                - img [ref=e63]
                - generic [ref=e67]: Thợ Đang Rảnh
            - paragraph [ref=e68]: Công cụ
            - navigation "Công cụ" [ref=e69]:
              - link "Tin nhắn Chat với tiệm & thợ" [ref=e70] [cursor=pointer]:
                - /url: /messages
                - img [ref=e72]
                - generic [ref=e74]:
                  - generic [ref=e75]: Tin nhắn
                  - generic [ref=e76]: Chat với tiệm & thợ
                - img [ref=e77]
              - link "Thu nhập & tip Ghi turn + tip mỗi tối" [ref=e79] [cursor=pointer]:
                - /url: /tools/income-tracker
                - img [ref=e81]
                - generic [ref=e84]:
                  - generic [ref=e85]: Thu nhập & tip
                  - generic [ref=e86]: Ghi turn + tip mỗi tối
                - img [ref=e87]
              - link "Mẫu nail mới Ý tưởng mỗi ngày + vật tư cần chuẩn bị" [ref=e89] [cursor=pointer]:
                - /url: /designs
                - img [ref=e91]
                - generic [ref=e94]:
                  - generic [ref=e95]: Mẫu nail mới
                  - generic [ref=e96]: Ý tưởng mỗi ngày + vật tư cần chuẩn bị
                - img [ref=e97]
              - link "Xu hướng tuần Mẫu hot · thợ nổi bật · lương" [ref=e99] [cursor=pointer]:
                - /url: /trends
                - img [ref=e101]
                - generic [ref=e104]:
                  - generic [ref=e105]: Xu hướng tuần
                  - generic [ref=e106]: Mẫu hot · thợ nổi bật · lương
                - img [ref=e107]
              - link "Nail Radar Mức bao lương & chia turn theo bang" [ref=e109] [cursor=pointer]:
                - /url: /tools/radar
                - img [ref=e111]
                - generic [ref=e118]:
                  - generic [ref=e119]: Nail Radar
                  - generic [ref=e120]: Mức bao lương & chia turn theo bang
                - img [ref=e121]
              - link "Kho hàng vật tư Vật tư giá sỉ từ các tiệm" [ref=e123] [cursor=pointer]:
                - /url: /supply
                - img [ref=e125]
                - generic [ref=e128]:
                  - generic [ref=e129]: Kho hàng vật tư
                  - generic [ref=e130]: Vật tư giá sỉ từ các tiệm
                - img [ref=e131]
        - generic [ref=e133]:
          - generic [ref=e134]:
            - generic [ref=e135]:
              - button "Mỹ Mỹ · US" [pressed] [ref=e136]:
                - img "Mỹ" [ref=e137]
                - text: Mỹ · US
              - button "Úc Úc · AU" [ref=e158]:
                - img "Úc" [ref=e159]
                - text: Úc · AU
            - generic [ref=e171]:
              - button "Tất cả bang" [ref=e172]
              - button "California" [ref=e173]
              - button "Texas" [ref=e174]
              - button "Florida" [ref=e175]
              - button "New York" [ref=e176]
              - button "Washington" [ref=e177]
              - button "Georgia" [ref=e178]
              - button "North Carolina" [ref=e179]
              - button "Virginia" [ref=e180]
              - button "Arizona" [ref=e181]
              - button "Illinois" [ref=e182]
            - generic [ref=e183]:
              - img [ref=e184]
              - 'textbox "Tìm theo thành phố... (VD: Los Angeles, Sydney)" [ref=e187]'
          - tablist "Nội dung trang chủ" [ref=e189]:
            - tab "Bảng tin" [selected] [ref=e190]:
              - img [ref=e191]
              - generic [ref=e194]: Bảng tin
            - tab "Cần thợ gấp" [ref=e195]:
              - img [ref=e196]
              - generic [ref=e198]: Cần thợ gấp
            - tab "Thợ đang rảnh" [ref=e199]:
              - img [ref=e200]
              - generic [ref=e203]: Thợ đang rảnh
          - generic "Đang tải bảng tin" [ref=e207]
    - contentinfo [ref=e236]:
      - paragraph [ref=e237]: © 2026 PawNail Jobs. Nền tảng việc làm & tay nghề Nail cho thị trường Mỹ & Úc.
  - button "Open Next.js Dev Tools" [ref=e243] [cursor=pointer]:
    - generic [ref=e246]:
      - text: Compiling
      - generic [ref=e247]:
        - generic [ref=e248]: .
        - generic [ref=e249]: .
        - generic [ref=e250]: .
  - alert [ref=e251]: "SÀN KẾT NỐI NGHỀ NAIL HẢI NGOẠI #1 TẠI MỸ & ÚC"
  - status [ref=e252]:
    - generic [ref=e254]:
      - img [ref=e257]
      - generic [ref=e259]:
        - paragraph [ref=e260]: Nhịp thị trường
        - paragraph [ref=e261]: Texas dẫn đầu nhu cầu với 99 tin tìm thợ, nhiều nhất là thợ Bột/Acrylic (khảo sát nhóm nail Facebook, 9/2026)
    - button "Ẩn thông báo" [ref=e262]:
      - img [ref=e263]
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
  15 |     await expect(page.locator("header").getByRole("button", { name: /Đăng nhập|Sign in/i })).toBeVisible();
  16 |     await expect(page.locator("header").getByRole("button", { name: /Đăng ký|Sign up/i })).toBeVisible();
  17 | 
  18 |     // Desktop sidebar explore section
  19 |     await expect(page.getByRole("navigation", { name: /Khám phá|Explore/i })).toBeVisible();
  20 | 
  21 |     expect(pageErrors).toEqual([]);
> 22 |     expect(serverErrors).toEqual([]);
     |                          ^ Error: expect(received).toEqual(expected) // deep equality
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