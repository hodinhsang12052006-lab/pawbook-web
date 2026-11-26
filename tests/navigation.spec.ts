import { test, expect } from "@playwright/test";
import {
  attachIsolatedIp,
  trackRuntimeErrors,
  SEED_TECH_EMAIL,
  DEMO_PASSWORD,
} from "./helpers";

test.describe("Cross-Page Navigation Flows", () => {
  test("TC-NAV-01: navigates from Jobs listing to a real Job Detail page (/jobs/[id])", async ({ page, request }) => {
    const ip = await attachIsolatedIp(page);
    const { pageErrors, serverErrors } = trackRuntimeErrors(page);

    const apiRes = await request.get("/api/jobs?limit=5", {
      headers: { "cf-connecting-ip": ip },
    });
    expect(apiRes.status()).toBe(200);
    const jobsPayload = await apiRes.json();
    const jobs = Array.isArray(jobsPayload) ? jobsPayload : jobsPayload.jobs || jobsPayload.items || [];
    expect(jobs.length).toBeGreaterThan(0);

    const targetJob = jobs[0];
    const detailRes = await page.goto(`/jobs/${targetJob.id}`);
    expect(detailRes?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/jobs/${targetJob.id}`));
    await expect(page.locator("main, body").first()).toContainText(
      new RegExp(targetJob.state || targetJob.city || "Nail", "i")
    );

    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test("TC-NAV-02: navigates from Salons directory (/salons) to Salon Menu page (/menu/[uid])", async ({ page }) => {
    await attachIsolatedIp(page);
    const { pageErrors, serverErrors } = trackRuntimeErrors(page);

    const res = await page.goto("/salons");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /Tiệm & thợ nail quanh bạn|Nail salons & techs near you/
    );

    // Filter state chip interaction on /salons
    const allChip = page.getByRole("button", { name: /^Tất cả$|^All$/ }).first();
    await expect(allChip).toBeVisible();

    // Click first "Xem menu & đặt lịch" / "Menu & book" link on a salon card
    const menuLink = page.getByRole("link", { name: /Xem menu & đặt lịch|Menu & book/i }).first();
    await expect(menuLink).toBeVisible({ timeout: 20_000 });
    await menuLink.click();

    await expect(page).toHaveURL(/\/menu\/[^/?#]+/);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test("TC-NAV-03: loads Public Profile page (/profile/[uid]) from technician listing", async ({ page, request }) => {
    const ip = await attachIsolatedIp(page);
    const { pageErrors, serverErrors } = trackRuntimeErrors(page);

    const techRes = await request.get("/api/technicians?limit=5", {
      headers: { "cf-connecting-ip": ip },
    });
    expect(techRes.status()).toBe(200);
    const techData = await techRes.json();
    const techs = Array.isArray(techData) ? techData : techData.technicians || techData.items || [];
    expect(techs.length).toBeGreaterThan(0);

    const targetUid = techs[0].userId || techs[0].user?.id || techs[0].id;
    const profileRes = await page.goto(`/profile/${targetUid}`);
    expect(profileRes?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/profile/${targetUid}`));
    await expect(page.locator("header")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test("TC-NAV-04: authenticates seed user and navigates to personal Profile & Tools pages", async ({ page }) => {
    await attachIsolatedIp(page);
    const { pageErrors, serverErrors } = trackRuntimeErrors(page);

    await page.goto("/auth/login");
    await page.locator("#email").fill(SEED_TECH_EMAIL);
    await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
    await page.locator('form button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });

    // Navigate to personal /profile via Navbar profile button
    await page.getByRole("button", { name: /Hồ sơ của tôi|My profile/i }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.locator("main, body").first()).toContainText(/Bột\/Acrylic|Gel-X|Dip\/SNS/);

    // Navigate to Nail Radar tool
    const radarRes = await page.goto("/tools/radar");
    expect(radarRes?.status()).toBe(200);
    await expect(page.locator("header")).toBeVisible();

    // Navigate to Income Tracker tool
    const incomeRes = await page.goto("/tools/income-tracker");
    expect(incomeRes?.status()).toBe(200);
    await expect(page.locator("header")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test("TC-NAV-05: navigates across Designs, Trends, Supply Store, Privacy, and Terms pages", async ({ page }) => {
    await attachIsolatedIp(page);
    const { pageErrors, serverErrors } = trackRuntimeErrors(page);

    await page.goto("/");

    // Sidebar tools navigation to /designs
    const designsLink = page.locator('aside a[href="/designs"]').first();
    await expect(designsLink).toBeVisible();
    await designsLink.click();
    await expect(page).toHaveURL(/\/designs/);

    // Navigate through remaining major routes and verify clean rendering
    for (const route of ["/trends", "/supply", "/privacy", "/terms"]) {
      const r = await page.goto(route);
      expect(r?.status(), `Expected HTTP 200 on ${route}`).toBe(200);
      await expect(page.locator("body")).not.toBeEmpty();
    }

    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });
});

