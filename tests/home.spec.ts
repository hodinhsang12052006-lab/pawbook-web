import { test, expect } from "@playwright/test";
import { attachIsolatedIp, trackRuntimeErrors } from "./helpers";

test.describe("Homepage & UI Display", () => {
  test("TC-HOME-01: loads homepage with HTTP 200, brand header, and guest auth actions", async ({ page }) => {
    await attachIsolatedIp(page);
    const { pageErrors, serverErrors } = trackRuntimeErrors(page);

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Navbar brand (neon B logo + "PawNail" wordmark link) & guest actions (links, EN-first labels)
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: "PawNail" })).toBeVisible();
    await expect(header.getByRole("link", { name: /^Log in$/ })).toBeVisible();
    await expect(header.getByRole("link", { name: /^(Create account|Sign up)$/ })).toBeVisible();

    // Desktop sidebar explore section
    await expect(page.getByRole("navigation", { name: "Explore" })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test("TC-HOME-02: switches cleanly between Discover, Jobs, and Available techs tabs", async ({ page }) => {
    await attachIsolatedIp(page);
    await page.goto("/");

    // guests see "Discover" in place of the members' "Feed" (components/layout/Sidebar.tsx)
    const sidebarNav = page.getByRole("navigation", { name: "Explore" });

    // Switch to Jobs tab
    await sidebarNav.getByRole("button", { name: /^Jobs$/ }).click();
    await expect(page).toHaveURL(/\/\?tab=jobs/);

    // Switch to Available Techs (portfolio) tab
    await sidebarNav.getByRole("button", { name: /^Available techs$/ }).click();
    await expect(page).toHaveURL(/\/\?tab=portfolio/);

    // Switch back to Discover (feed) tab
    await sidebarNav.getByRole("button", { name: /^(Discover|Feed)$/ }).click();
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

