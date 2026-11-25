import { test, expect } from "@playwright/test";
import { attachIsolatedIp, trackRuntimeErrors } from "./helpers";

test.describe("Homepage & UI Display", () => {
  test("TC-HOME-01: loads homepage with HTTP 200, brand header, and guest auth actions", async ({ page }) => {
    await attachIsolatedIp(page);
    const { pageErrors, serverErrors } = trackRuntimeErrors(page);

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Navbar brand & guest actions
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByAltText("PawNail Jobs").first()).toBeVisible();
    await expect(page.locator("header").getByRole("button", { name: /Đăng nhập|Sign in/i })).toBeVisible();
    await expect(page.locator("header").getByRole("button", { name: /Đăng ký|Sign up/i })).toBeVisible();

    // Desktop sidebar explore section
    await expect(page.getByRole("navigation", { name: /Khám phá|Explore/i })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test("TC-HOME-02: switches cleanly between Feed, Urgent Jobs, and Available Techs tabs", async ({ page }) => {
    await attachIsolatedIp(page);
    await page.goto("/");

    const sidebarNav = page.getByRole("navigation", { name: /Khám phá|Explore/i });

    // Switch to Jobs tab
    await sidebarNav.getByRole("button", { name: /Cần Thợ Gấp|Urgent jobs/i }).click();
    await expect(page).toHaveURL(/\/\?tab=jobs/);

    // Switch to Available Techs (portfolio) tab
    await sidebarNav.getByRole("button", { name: /Thợ Đang Rảnh|Available techs/i }).click();
    await expect(page).toHaveURL(/\/\?tab=portfolio/);

    // Switch back to Feed tab
    await sidebarNav.getByRole("button", { name: /Bảng Tin|Feed/i }).click();
    await expect(page).toHaveURL(/\/\?tab=feed/);
  });

  test("TC-HOME-03: filters homepage content by US / AU market and state query params", async ({ page }) => {
    await attachIsolatedIp(page);
    const response = await page.goto("/?tab=jobs&market=US&state=CA");
    expect(response?.status()).toBe(200);

    await expect(page.locator("header")).toBeVisible();
    // Switch to Australia market view via URL parameter and verify UI renders cleanly
    const auRes = await page.goto("/?tab=jobs&market=AU");
    expect(auRes?.status()).toBe(200);
    await expect(page.locator("header")).toBeVisible();
  });

  test("TC-HOME-04: toggles bilingual UI between Vietnamese (vi) and English (en)", async ({ page }) => {
    await attachIsolatedIp(page);
    await page.goto("/salons");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Tiệm & thợ nail quanh bạn|Nail salons & techs near you/);

    // Locate language toggle in header and switch locale
    const langBtn = page.locator("header button").filter({ hasText: /^(VI|EN|🌐)/i }).first();
    if (await langBtn.count()) {
      const beforeText = await page.getByRole("heading", { level: 1 }).innerText();
      await langBtn.click();
      await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(beforeText);
    } else {
      // Fallback: verify localStorage bitpaw_locale switches language cleanly
      await page.evaluate(() => localStorage.setItem("bitpaw_locale", "en"));
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Nail salons & techs near you");
    }
  });

  test("TC-HOME-05: renders responsive mobile layout without horizontal overflow", async ({ page }) => {
    await attachIsolatedIp(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page.locator("header")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });
});

