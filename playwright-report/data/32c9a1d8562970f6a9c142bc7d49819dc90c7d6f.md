# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: forms-and-http.spec.ts >> Forms Validation & HTTP Status Codes >> TC-HTTP-02: Non-existent routes return HTTP 404 with branded NotFound UI and protected API returns 401
- Location: tests\forms-and-http.spec.ts:130:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: apiRequestContext.get: Request context disposed.
Call log:
  - → GET http://localhost:3000/api/profile
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - cf-connecting-ip: 10.178.0.2

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]:
    - generic [ref=e10]:
      - text: Compiling
      - generic [ref=e11]:
        - generic [ref=e12]: .
        - generic [ref=e13]: .
        - generic [ref=e14]: .
  - alert [ref=e15]: "SÀN KẾT NỐI NGHỀ NAIL HẢI NGOẠI #1 TẠI MỸ & ÚC"
  - generic [ref=e16]:
    - banner [ref=e17]:
      - generic [ref=e18]:
        - generic [ref=e19] [cursor=pointer]:
          - img "PawNail Jobs" [ref=e21]
          - generic [ref=e22]: PawNail Jobs
        - generic [ref=e24]:
          - button "VI / EN" [ref=e25] [cursor=pointer]:
            - generic [ref=e26]: VI
            - generic [ref=e27]: /
            - generic [ref=e28]: EN
          - button "Đăng nhập" [ref=e29] [cursor=pointer]
          - button "Đăng ký" [ref=e30] [cursor=pointer]
    - generic [ref=e35]:
      - generic [ref=e36]:
        - img [ref=e37]
        - text: 100% miễn phí kết nối
      - 'heading "SÀN KẾT NỐI NGHỀ NAIL HẢI NGOẠI #1 TẠI MỸ & ÚC" [level=1] [ref=e40]':
        - text: SÀN KẾT NỐI NGHỀ NAIL
        - text: "HẢI NGOẠI #1 TẠI MỸ & ÚC"
      - paragraph [ref=e41]: Nơi thợ nail tìm việc gấp, chủ tiệm tìm thợ giỏi — miễn phí, nhắn tin trực tiếp, chỉ trong vài phút.
      - generic [ref=e42]:
        - button "TÌM VIỆC LÀM NAIL" [ref=e43]:
          - img [ref=e44]
          - text: TÌM VIỆC LÀM NAIL
        - button "ĐĂNG TIN TUYỂN THỢ GẤP" [ref=e47]:
          - img [ref=e48]
          - text: ĐĂNG TIN TUYỂN THỢ GẤP
      - link "34 việc đang tuyển 🔥 16 việc gấp 2 tin mới 7 ngày" [ref=e53] [cursor=pointer]:
        - /url: /?tab=jobs
        - generic [ref=e57]: 34 việc đang tuyển
        - generic [ref=e58]: 🔥 16 việc gấp
        - generic [ref=e59]: 2 tin mới 7 ngày
      - link "💅 Bạn đi làm nail? Xem mẫu & tìm tiệm gần bạn →" [ref=e60] [cursor=pointer]:
        - /url: /salons
    - main [ref=e61]:
      - generic [ref=e62]:
        - complementary [ref=e63]:
          - generic [ref=e65]:
            - generic [ref=e66]:
              - paragraph [ref=e67]: Tham gia PawNail
              - paragraph [ref=e68]: Miễn phí — tìm việc, tìm thợ và nhắn tin trực tiếp.
              - generic [ref=e69]:
                - link "Đăng ký" [ref=e70] [cursor=pointer]:
                  - /url: /auth/register
                - link "Đăng nhập" [ref=e71] [cursor=pointer]:
                  - /url: /auth/login
            - navigation "Khám phá" [ref=e72]:
              - button "Bảng Tin" [ref=e73]:
                - img [ref=e74]
                - generic [ref=e77]: Bảng Tin
              - button "Cần Thợ Gấp" [ref=e78]:
                - img [ref=e79]
                - generic [ref=e82]: Cần Thợ Gấp
              - button "Thợ Đang Rảnh" [ref=e83]:
                - img [ref=e84]
                - generic [ref=e88]: Thợ Đang Rảnh
            - paragraph [ref=e89]: Công cụ
            - navigation "Công cụ" [ref=e90]:
              - link "Tin nhắn Chat với tiệm & thợ" [ref=e91] [cursor=pointer]:
                - /url: /messages
                - img [ref=e93]
                - generic [ref=e95]:
                  - generic [ref=e96]: Tin nhắn
                  - generic [ref=e97]: Chat với tiệm & thợ
                - img [ref=e98]
              - link "Thu nhập & tip Ghi turn + tip mỗi tối" [ref=e100] [cursor=pointer]:
                - /url: /tools/income-tracker
                - img [ref=e102]
                - generic [ref=e105]:
                  - generic [ref=e106]: Thu nhập & tip
                  - generic [ref=e107]: Ghi turn + tip mỗi tối
                - img [ref=e108]
              - link "Mẫu nail mới Ý tưởng mỗi ngày + vật tư cần chuẩn bị" [ref=e110] [cursor=pointer]:
                - /url: /designs
                - img [ref=e112]
                - generic [ref=e115]:
                  - generic [ref=e116]: Mẫu nail mới
                  - generic [ref=e117]: Ý tưởng mỗi ngày + vật tư cần chuẩn bị
                - img [ref=e118]
              - link "Xu hướng tuần Mẫu hot · thợ nổi bật · lương" [ref=e120] [cursor=pointer]:
                - /url: /trends
                - img [ref=e122]
                - generic [ref=e125]:
                  - generic [ref=e126]: Xu hướng tuần
                  - generic [ref=e127]: Mẫu hot · thợ nổi bật · lương
                - img [ref=e128]
              - link "Nail Radar Mức bao lương & chia turn theo bang" [ref=e130] [cursor=pointer]:
                - /url: /tools/radar
                - img [ref=e132]
                - generic [ref=e139]:
                  - generic [ref=e140]: Nail Radar
                  - generic [ref=e141]: Mức bao lương & chia turn theo bang
                - img [ref=e142]
              - link "Kho hàng vật tư Vật tư giá sỉ từ các tiệm" [ref=e144] [cursor=pointer]:
                - /url: /supply
                - img [ref=e146]
                - generic [ref=e149]:
                  - generic [ref=e150]: Kho hàng vật tư
                  - generic [ref=e151]: Vật tư giá sỉ từ các tiệm
                - img [ref=e152]
        - generic [ref=e154]:
          - generic [ref=e155]:
            - generic [ref=e156]:
              - button "Mỹ Mỹ · US" [pressed] [ref=e157]:
                - img "Mỹ" [ref=e158]
                - text: Mỹ · US
              - button "Úc Úc · AU" [ref=e179]:
                - img "Úc" [ref=e180]
                - text: Úc · AU
            - generic [ref=e192]:
              - button "Tất cả bang" [ref=e193]
              - button "California" [ref=e194]
              - button "Texas" [ref=e195]
              - button "Florida" [ref=e196]
              - button "New York" [ref=e197]
              - button "Washington" [ref=e198]
              - button "Georgia" [ref=e199]
              - button "North Carolina" [ref=e200]
              - button "Virginia" [ref=e201]
              - button "Arizona" [ref=e202]
              - button "Illinois" [ref=e203]
            - generic [ref=e204]:
              - img [ref=e205]
              - 'textbox "Tìm theo thành phố... (VD: Los Angeles, Sydney)" [ref=e208]'
          - tablist "Nội dung trang chủ" [ref=e210]:
            - tab "Bảng tin" [selected] [ref=e211]:
              - img [ref=e212]
              - generic [ref=e215]: Bảng tin
            - tab "Cần thợ gấp" [ref=e216]:
              - img [ref=e217]
              - generic [ref=e219]: Cần thợ gấp
            - tab "Thợ đang rảnh" [ref=e220]:
              - img [ref=e221]
              - generic [ref=e224]: Thợ đang rảnh
          - generic [ref=e227]:
            - 'region "Chủ đề tuần: Mùa Halloween" [ref=e228]':
              - generic: 🎃
              - button "Ẩn chủ đề hôm nay" [ref=e229]:
                - img [ref=e230]
              - generic [ref=e233]:
                - generic [ref=e234]:
                  - generic [ref=e235]:
                    - img [ref=e236]
                    - text: PawNail Studio
                  - generic [ref=e239]: Chủ đề tuần này
                - generic [ref=e240]:
                  - heading "🎃 Mùa Halloween" [level=3] [ref=e241]
                  - paragraph [ref=e242]: Tháng khách thích móng "chơi" nhất năm — đen nhám, cam bí ngô, mắt mèo, nhện mạng.
                - generic [ref=e243]:
                  - generic [ref=e244]: Đen nhám + mạng nhện bạc
                  - generic [ref=e245]: Cam bí ngô ombre
                  - generic [ref=e246]: Mắt mèo xanh rêu
                  - generic [ref=e247]: Ma trắng 3D mini
                - generic [ref=e248]:
                  - 'button "Tham gia #PawNailHalloween" [ref=e249]':
                    - img [ref=e250]
                    - text: "Tham gia #PawNailHalloween"
                  - generic [ref=e256]: Đăng ảnh mẫu bạn làm — bài được thích nhiều nhất được ghim Top tuần 🏆
            - generic "Đang tải bảng tin" [ref=e257]
    - contentinfo [ref=e286]:
      - paragraph [ref=e287]: © 2026 PawNail Jobs. Nền tảng việc làm & tay nghề Nail cho thị trường Mỹ & Úc.
```

# Test source

```ts
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
  113 |   test("TC-HTTP-01: Core public pages and JSON APIs return HTTP 200 OK", async ({ request }) => {
  114 |     const ip = nextClientIp();
  115 |     const htmlRoutes = ["/", "/salons", "/designs", "/supply", "/trends", "/auth/login", "/auth/register", "/privacy"];
  116 |     for (const path of htmlRoutes) {
  117 |       const res = await request.get(path, { headers: { "cf-connecting-ip": ip } });
  118 |       expect(res.status(), `Expected 200 on page ${path}`).toBe(200);
  119 |       expect(res.headers()["content-type"]).toContain("text/html");
  120 |     }
  121 | 
  122 |     const apiRoutes = ["/api/jobs?limit=3", "/api/salons?limit=3", "/api/technicians?limit=3", "/api/supply"];
  123 |     for (const apiPath of apiRoutes) {
  124 |       const res = await request.get(apiPath, { headers: { "cf-connecting-ip": ip } });
  125 |       expect(res.status(), `Expected 200 on API ${apiPath}`).toBe(200);
  126 |       expect(res.headers()["content-type"]).toContain("application/json");
  127 |     }
  128 |   });
  129 | 
  130 |   test("TC-HTTP-02: Non-existent routes return HTTP 404 with branded NotFound UI and protected API returns 401", async ({ page, request }) => {
  131 |     const ip = await attachIsolatedIp(page);
  132 | 
  133 |     // 1. Unknown page route returns HTTP 404 and renders custom NotFound screen
  134 |     const res404 = await page.goto("/duong-dan-khong-ton-tai-e2e-404");
  135 |     expect(res404?.status()).toBe(404);
  136 |     await expect(page.getByRole("heading", { name: /Không tìm thấy trang|Page not found/i })).toBeVisible();
  137 | 
  138 |     const homeLink = page.getByRole("link", { name: /Về trang chủ|Back to home/i });
  139 |     await expect(homeLink).toBeVisible();
  140 |     await homeLink.click();
  141 |     await expect(page).toHaveURL(/\/$/);
  142 | 
  143 |     // 2. Non-existent job API returns HTTP 404
  144 |     const api404 = await request.get("/api/jobs/nonexistent_job_id_404_check", {
  145 |       headers: { "cf-connecting-ip": ip },
  146 |     });
  147 |     expect(api404.status()).toBe(404);
  148 | 
  149 |     // 3. Unauthenticated private profile API returns HTTP 401
> 150 |     const api401 = await request.get("/api/profile", {
      |                                  ^ Error: apiRequestContext.get: Request context disposed.
  151 |       headers: { "cf-connecting-ip": ip },
  152 |     });
  153 |     expect(api401.status()).toBe(401);
  154 |   });
  155 | });
  156 | 
  157 | 
```