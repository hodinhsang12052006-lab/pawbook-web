# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Cross-Page Navigation Flows >> TC-NAV-05: navigates across Designs, Trends, Supply Store, Privacy, and Terms pages
- Location: tests\navigation.spec.ts:113:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/designs/
Received string:  ""

```

# Test source

```ts
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
  92  |     await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });
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
> 123 |     await expect(page).toHaveURL(/\/designs/);
      |                        ^ Error: expect(page).toHaveURL(expected) failed
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