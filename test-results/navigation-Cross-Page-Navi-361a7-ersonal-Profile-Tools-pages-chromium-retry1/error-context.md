# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Cross-Page Navigation Flows >> TC-NAV-04: authenticates seed user and navigates to personal Profile & Tools pages
- Location: tests\navigation.spec.ts:83:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 60000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e5]
        - combobox "Ngôn ngữ / Language" [ref=e8] [cursor=pointer]:
          - option "VN" [selected]
          - option "EN"
      - button "Chuyển sang giao diện sáng" [ref=e9]:
        - img [ref=e10]
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e25]:
          - generic [ref=e26]:
            - link "PawNail Jobs Logo PawNail Jobs" [ref=e27] [cursor=pointer]:
              - /url: /
              - img "PawNail Jobs Logo" [ref=e29]
              - generic [ref=e30]: PawNail Jobs
            - heading "Việc Làm Nail Mỹ 🇺🇸 & Úc 🇦🇺" [level=1] [ref=e31]:
              - generic [ref=e32]: Việc Làm Nail
              - generic [ref=e33]: Mỹ 🇺🇸 & Úc 🇦🇺
            - paragraph [ref=e34]: Kết nối chủ tiệm cần thợ gấp và thợ nail đang tìm việc — chỉ trong vài phút.
          - generic [ref=e35]:
            - generic [ref=e36]: ✨ 1026+ tin tìm thợ tại Mỹ & Úc (khảo sát 9/2026)
            - generic [ref=e37]: ⚡ Tìm việc & Bao lương trong 24h
            - generic [ref=e38]: 🛡️ Bảo mật thông tin 100%
        - generic [ref=e39]: © 2026 PawNail Jobs. Bảo lưu mọi quyền.
      - generic [ref=e42]:
        - generic [ref=e43]:
          - heading "Chào mừng trở lại!" [level=2] [ref=e44]
          - paragraph [ref=e45]: Nhập email và mật khẩu của bạn để truy cập PawNail Jobs.
        - generic [ref=e46]:
          - generic [ref=e47]:
            - generic [ref=e48]: Địa chỉ Email
            - generic [ref=e49]:
              - generic:
                - img
              - textbox "Địa chỉ Email" [ref=e50]:
                - /placeholder: ban@email.com
                - text: tech1.us@pawnailjobs.demo
          - generic [ref=e51]:
            - generic [ref=e52]:
              - generic [ref=e53]: Mật khẩu
              - link "Quên mật khẩu?" [ref=e54] [cursor=pointer]:
                - /url: /auth/forgot
            - generic [ref=e55]:
              - generic:
                - img
              - textbox "Mật khẩu" [ref=e56]:
                - /placeholder: ••••••••
                - text: Demo@12345
          - button "Đang xử lý..." [disabled] [ref=e57] [cursor=pointer]:
            - img [ref=e58]
            - generic [ref=e60]: Đang xử lý...
        - generic [ref=e61]:
          - text: Chưa có tài khoản?
          - link "Đăng ký ngay" [ref=e62] [cursor=pointer]:
            - /url: /auth/register
  - button "Open Next.js Dev Tools" [ref=e68] [cursor=pointer]:
    - img [ref=e69]
  - alert [ref=e72]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import {
  3   |   attachIsolatedIp,
  4   |   trackRuntimeErrors,
  5   |   SEED_TECH_EMAIL,
  6   |   DEMO_PASSWORD,
  7   | } from "./helpers";
  8   | 
  9   | test.describe("Cross-Page Navigation Flows", () => {
  10  |   test("TC-NAV-01: navigates from Jobs listing to a real Job Detail page (/jobs/[id])", async ({ page, request }) => {
  11  |     const ip = await attachIsolatedIp(page);
  12  |     const { pageErrors, serverErrors } = trackRuntimeErrors(page);
  13  | 
  14  |     const apiRes = await request.get("/api/jobs?limit=5", {
  15  |       headers: { "cf-connecting-ip": ip },
  16  |     });
  17  |     expect(apiRes.status()).toBe(200);
  18  |     const jobsPayload = await apiRes.json();
  19  |     const jobs = Array.isArray(jobsPayload) ? jobsPayload : jobsPayload.jobs || jobsPayload.items || [];
  20  |     expect(jobs.length).toBeGreaterThan(0);
  21  | 
  22  |     const targetJob = jobs[0];
  23  |     const detailRes = await page.goto(`/jobs/${targetJob.id}`);
  24  |     expect(detailRes?.status()).toBe(200);
  25  |     await expect(page).toHaveURL(new RegExp(`/jobs/${targetJob.id}`));
  26  |     await expect(page.locator("main, body").first()).toContainText(
  27  |       new RegExp(targetJob.state || targetJob.city || "Nail", "i")
  28  |     );
  29  | 
  30  |     expect(pageErrors).toEqual([]);
  31  |     expect(serverErrors).toEqual([]);
  32  |   });
  33  | 
  34  |   test("TC-NAV-02: navigates from Salons directory (/salons) to Salon Menu page (/menu/[uid])", async ({ page }) => {
  35  |     await attachIsolatedIp(page);
  36  |     const { pageErrors, serverErrors } = trackRuntimeErrors(page);
  37  | 
  38  |     const res = await page.goto("/salons");
  39  |     expect(res?.status()).toBe(200);
  40  |     await expect(page.getByRole("heading", { level: 1 })).toContainText(
  41  |       /Tiệm & thợ nail quanh bạn|Nail salons & techs near you/
  42  |     );
  43  | 
  44  |     // Filter state chip interaction on /salons
  45  |     const allChip = page.getByRole("button", { name: /^Tất cả$|^All$/ }).first();
  46  |     await expect(allChip).toBeVisible();
  47  | 
  48  |     // Click first "Xem menu & đặt lịch" / "Menu & book" link on a salon card
  49  |     const menuLink = page.getByRole("link", { name: /Xem menu & đặt lịch|Menu & book/i }).first();
  50  |     await expect(menuLink).toBeVisible({ timeout: 20_000 });
  51  |     await menuLink.click();
  52  | 
  53  |     await expect(page).toHaveURL(/\/menu\/[^/?#]+/);
  54  |     await expect(page.locator("header")).toBeVisible();
  55  |     await expect(page.locator("main")).toBeVisible();
  56  | 
  57  |     expect(pageErrors).toEqual([]);
  58  |     expect(serverErrors).toEqual([]);
  59  |   });
  60  | 
  61  |   test("TC-NAV-03: loads Public Profile page (/profile/[uid]) from technician listing", async ({ page, request }) => {
  62  |     const ip = await attachIsolatedIp(page);
  63  |     const { pageErrors, serverErrors } = trackRuntimeErrors(page);
  64  | 
  65  |     const techRes = await request.get("/api/technicians?limit=5", {
  66  |       headers: { "cf-connecting-ip": ip },
  67  |     });
  68  |     expect(techRes.status()).toBe(200);
  69  |     const techData = await techRes.json();
  70  |     const techs = Array.isArray(techData) ? techData : techData.technicians || techData.items || [];
  71  |     expect(techs.length).toBeGreaterThan(0);
  72  | 
  73  |     const targetUid = techs[0].userId || techs[0].user?.id || techs[0].id;
  74  |     const profileRes = await page.goto(`/profile/${targetUid}`);
  75  |     expect(profileRes?.status()).toBe(200);
  76  |     await expect(page).toHaveURL(new RegExp(`/profile/${targetUid}`));
  77  |     await expect(page.locator("header")).toBeVisible();
  78  | 
  79  |     expect(pageErrors).toEqual([]);
  80  |     expect(serverErrors).toEqual([]);
  81  |   });
  82  | 
  83  |   test("TC-NAV-04: authenticates seed user and navigates to personal Profile & Tools pages", async ({ page }) => {
  84  |     await attachIsolatedIp(page);
  85  |     const { pageErrors, serverErrors } = trackRuntimeErrors(page);
  86  | 
  87  |     await page.goto("/auth/login");
  88  |     await page.locator("#email").fill(SEED_TECH_EMAIL);
  89  |     await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  90  |     await page.locator('form button[type="submit"]').click();
  91  | 
> 92  |     await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });
      |                ^ Error: page.waitForURL: Test timeout of 60000ms exceeded.
  93  | 
  94  |     // Navigate to personal /profile via Navbar profile button
  95  |     await page.getByRole("button", { name: /Hồ sơ của tôi|My profile/i }).click();
  96  |     await expect(page).toHaveURL(/\/profile$/);
  97  |     await expect(page.locator("main, body").first()).toContainText(/Bột\/Acrylic|Gel-X|Dip\/SNS/);
  98  | 
  99  |     // Navigate to Nail Radar tool
  100 |     const radarRes = await page.goto("/tools/radar");
  101 |     expect(radarRes?.status()).toBe(200);
  102 |     await expect(page.locator("header")).toBeVisible();
  103 | 
  104 |     // Navigate to Income Tracker tool
  105 |     const incomeRes = await page.goto("/tools/income-tracker");
  106 |     expect(incomeRes?.status()).toBe(200);
  107 |     await expect(page.locator("header")).toBeVisible();
  108 | 
  109 |     expect(pageErrors).toEqual([]);
  110 |     expect(serverErrors).toEqual([]);
  111 |   });
  112 | 
  113 |   test("TC-NAV-05: navigates across Designs, Trends, Supply Store, Privacy, and Terms pages", async ({ page }) => {
  114 |     await attachIsolatedIp(page);
  115 |     const { pageErrors, serverErrors } = trackRuntimeErrors(page);
  116 | 
  117 |     await page.goto("/");
  118 | 
  119 |     // Sidebar tools navigation to /designs
  120 |     const designsLink = page.locator('aside a[href="/designs"]').first();
  121 |     await expect(designsLink).toBeVisible();
  122 |     await designsLink.click();
  123 |     await expect(page).toHaveURL(/\/designs/);
  124 | 
  125 |     // Navigate through remaining major routes and verify clean rendering
  126 |     for (const route of ["/trends", "/supply", "/privacy", "/terms"]) {
  127 |       const r = await page.goto(route);
  128 |       expect(r?.status(), `Expected HTTP 200 on ${route}`).toBe(200);
  129 |       await expect(page.locator("body")).not.toBeEmpty();
  130 |     }
  131 | 
  132 |     expect(pageErrors).toEqual([]);
  133 |     expect(serverErrors).toEqual([]);
  134 |   });
  135 | });
  136 | 
  137 | 
```