# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: forms-and-http.spec.ts >> Forms Validation & HTTP Status Codes >> TC-FORM-01: Login form displays error message on invalid credentials without crashing
- Location: tests\forms-and-http.spec.ts:10:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: Test timeout of 60000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/auth/login", waiting until "load"

```

# Page snapshot

```yaml
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
        - button "Đăng nhập" [ref=e57] [cursor=pointer]:
          - generic [ref=e58]: Đăng nhập
      - generic [ref=e59]:
        - text: Chưa có tài khoản?
        - link "Đăng ký ngay" [ref=e60] [cursor=pointer]:
          - /url: /auth/register
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import {
  3   |   attachIsolatedIp,
  4   |   nextClientIp,
  5   |   SEED_OWNER_EMAIL,
  6   |   DEMO_PASSWORD,
  7   | } from "./helpers";
  8   | 
  9   | test.describe("Forms Validation & HTTP Status Codes", () => {
  10  |   test("TC-FORM-01: Login form displays error message on invalid credentials without crashing", async ({ page }) => {
  11  |     await attachIsolatedIp(page);
> 12  |     await page.goto("/auth/login");
      |                ^ Error: page.goto: Test timeout of 60000ms exceeded.
  13  | 
  14  |     const uniqueFakeEmail = `invalid.user.${Date.now()}@example.com`;
  15  |     await page.locator("#email").fill(uniqueFakeEmail);
  16  |     await page.locator('input[type="password"]').fill("WrongPassword!123");
  17  |     await page.locator('form button[type="submit"]').click();
  18  | 
  19  |     // Must remain on /auth/login and display user-friendly error banner
  20  |     await expect(page).toHaveURL(/\/auth\/login/);
  21  |     await expect(
  22  |       page.getByText(/Email hoặc mật khẩu không chính xác|không chính xác|Invalid|incorrect/i).first()
  23  |     ).toBeVisible({ timeout: 15_000 });
  24  |   });
  25  | 
  26  |   test("TC-FORM-02: Login form authenticates valid Owner credentials and establishes session", async ({ page }) => {
  27  |     await attachIsolatedIp(page);
  28  |     await page.goto("/auth/login");
  29  | 
  30  |     await page.locator("#email").fill(SEED_OWNER_EMAIL);
  31  |     await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  32  |     await page.locator('form button[type="submit"]').click();
  33  | 
  34  |     await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });
  35  | 
  36  |     const sessionRes = await page.request.get("/api/auth/session");
  37  |     expect(sessionRes.status()).toBe(200);
  38  |     const session = await sessionRes.json();
  39  |     expect(session?.user?.email).toBe(SEED_OWNER_EMAIL);
  40  |     expect(session?.user?.role).toBe("OWNER");
  41  |   });
  42  | 
  43  |   test("TC-FORM-03: Register role picker renders all 3 roles and enforces input/API validation", async ({ page, request }) => {
  44  |     const ip = await attachIsolatedIp(page);
  45  |     await page.goto("/auth/register");
  46  | 
  47  |     // Role picker presents Technician, Salon Owner, and Client paths
  48  |     const buttons = page.locator("button");
  49  |     await expect(buttons.filter({ hasText: /Thợ|Technician/i }).first()).toBeVisible();
  50  |     await expect(buttons.filter({ hasText: /Chủ tiệm|Salon/i }).first()).toBeVisible();
  51  |     await expect(buttons.filter({ hasText: /khách|Getting your nails done/i }).first()).toBeVisible();
  52  | 
  53  |     // Open Technician step 1 via query param and check required fields exist
  54  |     await page.goto("/auth/register?role=technician");
  55  |     await expect(page.getByPlaceholder("ban@email.com")).toBeVisible();
  56  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  57  | 
  58  |     // Backend validation on POST /api/register rejects incomplete/invalid payload with 4xx (no DB write)
  59  |     const badRegRes = await request.post("/api/register", {
  60  |       headers: { "cf-connecting-ip": ip },
  61  |       data: { email: "not-an-email", password: "123" },
  62  |     });
  63  |     expect(badRegRes.status()).toBeGreaterThanOrEqual(400);
  64  |     expect(badRegRes.status()).toBeLessThan(500);
  65  |   });
  66  | 
  67  |   test("TC-FORM-04: Forgot Password form submits email and shows confirmation or service notice", async ({ page }) => {
  68  |     await attachIsolatedIp(page);
  69  |     await page.goto("/auth/forgot");
  70  | 
  71  |     await expect(page.getByRole("heading", { name: /Quên mật khẩu|Forgot your password/i })).toBeVisible();
  72  | 
  73  |     const emailInput = page.locator("#forgot-email");
  74  |     await expect(emailInput).toHaveAttribute("required", "");
  75  |     await emailInput.fill(`reset.check.${Date.now()}@example.com`);
  76  |     await page.getByRole("button", { name: /Gửi link đặt lại|Send reset link/i }).click();
  77  | 
  78  |     // Either SMTP sent confirmation (role="status") or graceful fallback notice (role="alert" for 503 fallback)
  79  |     await expect(page.locator('[role="status"], [role="alert"]').first()).toBeVisible({ timeout: 15_000 });
  80  |   });
  81  | 
  82  |   test("TC-FORM-05: Booking API & Menu booking modal validate required customer inputs", async ({ page, request }) => {
  83  |     const ip = await attachIsolatedIp(page);
  84  | 
  85  |     // Verify API validation rejects missing phone/name without mutating DB
  86  |     const badBooking = await request.post("/api/bookings", {
  87  |       headers: { "cf-connecting-ip": ip },
  88  |       data: { techId: "nonexistent", name: "", phone: "" },
  89  |     });
  90  |     expect(badBooking.status()).toBeGreaterThanOrEqual(400);
  91  |     expect(badBooking.status()).toBeLessThan(500);
  92  | 
  93  |     // Open a real salon/tech menu page and verify interactive booking button if exposed
  94  |     const salonsRes = await request.get("/api/salons?limit=3", {
  95  |       headers: { "cf-connecting-ip": nextClientIp() },
  96  |     });
  97  |     expect(salonsRes.status()).toBe(200);
  98  |     const salonsData = await salonsRes.json();
  99  |     const firstSalon = salonsData?.items?.[0];
  100 |     if (firstSalon?.id) {
  101 |       const menuPageRes = await page.goto(`/menu/${firstSalon.id}`);
  102 |       expect(menuPageRes?.status()).toBe(200);
  103 |       const bookBtn = page.getByRole("button", { name: /Đặt lịch|Book/i }).first();
  104 |       if (await bookBtn.count()) {
  105 |         await bookBtn.click();
  106 |         const dialog = page.getByRole("dialog", { name: /Đặt lịch|Book an appointment/i });
  107 |         await expect(dialog).toBeVisible();
  108 |         await expect(dialog.locator('input[type="tel"]')).toHaveAttribute("required", "");
  109 |       }
  110 |     }
  111 |   });
  112 | 
```