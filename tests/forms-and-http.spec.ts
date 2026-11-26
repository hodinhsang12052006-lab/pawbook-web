import { test, expect } from "@playwright/test";
import {
  attachIsolatedIp,
  nextClientIp,
  SEED_OWNER_EMAIL,
  DEMO_PASSWORD,
} from "./helpers";

test.describe("Forms Validation & HTTP Status Codes", () => {
  test("TC-FORM-01: Login form displays error message on invalid credentials without crashing", async ({ page }) => {
    await attachIsolatedIp(page);
    await page.goto("/auth/login");

    const uniqueFakeEmail = `invalid.user.${Date.now()}@example.com`;
    await page.locator("#email").fill(uniqueFakeEmail);
    await page.locator('input[type="password"]').fill("WrongPassword!123");
    await page.locator('form button[type="submit"]').click();

    // Must remain on /auth/login and display user-friendly error banner
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(
      page.getByText(/Email hoặc mật khẩu không chính xác|không chính xác|Invalid|incorrect/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("TC-FORM-02: Login form authenticates valid Owner credentials and establishes session", async ({ page }) => {
    await attachIsolatedIp(page);
    await page.goto("/auth/login");

    await page.locator("#email").fill(SEED_OWNER_EMAIL);
    await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
    await page.locator('form button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });

    const sessionRes = await page.request.get("/api/auth/session");
    expect(sessionRes.status()).toBe(200);
    const session = await sessionRes.json();
    expect(session?.user?.email).toBe(SEED_OWNER_EMAIL);
    expect(session?.user?.role).toBe("OWNER");
  });

  test("TC-FORM-03: Register role picker renders all 3 roles and enforces input/API validation", async ({ page, request }) => {
    const ip = await attachIsolatedIp(page);
    await page.goto("/auth/register");

    // Role picker presents Technician, Salon Owner, and Client paths (components/auth/RolePicker.tsx, data-role)
    await expect(page.locator('button[data-role="technician"]')).toContainText(/nail technician/i);
    await expect(page.locator('button[data-role="owner"]')).toContainText(/salon/i);
    await expect(page.locator('button[data-role="client"]')).toContainText(/nail client/i);

    // Open Technician step 1 via query param and check required fields exist (EN placeholder on "/", VI on /vi/...)
    await page.goto("/auth/register?role=technician");
    await expect(page.getByPlaceholder("you@email.com")).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Backend validation on POST /api/register rejects incomplete/invalid payload with 4xx (no DB write)
    const badRegRes = await request.post("/api/register", {
      headers: { "cf-connecting-ip": ip },
      data: { email: "not-an-email", password: "123" },
    });
    expect(badRegRes.status()).toBeGreaterThanOrEqual(400);
    expect(badRegRes.status()).toBeLessThan(500);
  });

  test("TC-FORM-04: Forgot Password form submits email and shows confirmation or service notice", async ({ page }) => {
    await attachIsolatedIp(page);
    await page.goto("/auth/forgot");

    await expect(page.getByRole("heading", { name: /Quên mật khẩu|Forgot your password/i })).toBeVisible();

    const emailInput = page.locator("#forgot-email");
    await expect(emailInput).toHaveAttribute("required", "");
    await emailInput.fill(`reset.check.${Date.now()}@example.com`);
    await page.getByRole("button", { name: /Gửi link đặt lại|Send reset link/i }).click();

    // Either SMTP sent confirmation (role="status") or graceful fallback notice (role="alert" for 503 fallback)
    await expect(page.locator('[role="status"], [role="alert"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test("TC-FORM-05: Booking API & Menu booking modal validate required customer inputs", async ({ page, request }) => {
    const ip = await attachIsolatedIp(page);

    // Verify API validation rejects missing phone/name without mutating DB
    const badBooking = await request.post("/api/bookings", {
      headers: { "cf-connecting-ip": ip },
      data: { techId: "nonexistent", name: "", phone: "" },
    });
    expect(badBooking.status()).toBeGreaterThanOrEqual(400);
    expect(badBooking.status()).toBeLessThan(500);

    // Open a real salon/tech menu page and verify interactive booking button if exposed
    const salonsRes = await request.get("/api/salons?limit=3", {
      headers: { "cf-connecting-ip": nextClientIp() },
    });
    expect(salonsRes.status()).toBe(200);
    const salonsData = await salonsRes.json();
    const firstSalon = salonsData?.items?.[0];
    if (firstSalon?.id) {
      const menuPageRes = await page.goto(`/menu/${firstSalon.id}`);
      expect(menuPageRes?.status()).toBe(200);
      const bookBtn = page.getByRole("button", { name: /Đặt lịch|Book/i }).first();
      if (await bookBtn.count()) {
        await bookBtn.click();
        const dialog = page.getByRole("dialog", { name: /Đặt lịch|Book an appointment/i });
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('input[type="tel"]')).toHaveAttribute("required", "");
      }
    }
  });

  test("TC-HTTP-01: Core public pages and JSON APIs return HTTP 200 OK", async ({ request }) => {
    const ip = nextClientIp();
    const htmlRoutes = ["/", "/salons", "/designs", "/supply", "/trends", "/auth/login", "/auth/register", "/privacy"];
    for (const path of htmlRoutes) {
      const res = await request.get(path, { headers: { "cf-connecting-ip": ip } });
      expect(res.status(), `Expected 200 on page ${path}`).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/html");
    }

    const apiRoutes = ["/api/jobs?limit=3", "/api/salons?limit=3", "/api/technicians?limit=3", "/api/supply"];
    for (const apiPath of apiRoutes) {
      const res = await request.get(apiPath, { headers: { "cf-connecting-ip": ip } });
      expect(res.status(), `Expected 200 on API ${apiPath}`).toBe(200);
      expect(res.headers()["content-type"]).toContain("application/json");
    }
  });

  test("TC-HTTP-02: Non-existent routes return HTTP 404 with branded NotFound UI and protected API returns 401", async ({ page, request }) => {
    const ip = await attachIsolatedIp(page);

    // 1. Unknown page route returns HTTP 404 and renders custom NotFound screen
    const res404 = await page.goto("/duong-dan-khong-ton-tai-e2e-404");
    expect(res404?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /Không tìm thấy trang|Page not found/i })).toBeVisible();

    const homeLink = page.getByRole("link", { name: /Về trang chủ|Back to home/i });
    await expect(homeLink).toBeVisible();
    await homeLink.click();
    await expect(page).toHaveURL(/\/$/);

    // 2. Non-existent job API returns HTTP 404
    const api404 = await request.get("/api/jobs/nonexistent_job_id_404_check", {
      headers: { "cf-connecting-ip": ip },
    });
    expect(api404.status()).toBe(404);

    // 3. Unauthenticated private profile API returns HTTP 401
    const api401 = await request.get("/api/profile", {
      headers: { "cf-connecting-ip": ip },
    });
    expect(api401.status()).toBe(401);
  });
});

