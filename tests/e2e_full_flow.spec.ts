import { test, expect } from "@playwright/test";

test.describe("Full E2E User Journey Bot - PawBook", () => {
  const randomSuffix = Math.floor(Math.random() * 900000 + 100000);
  const testEmail = `test_user_${randomSuffix}@gmail.com`;
  const testName = `User Bot ${randomSuffix}`;
  const testPassword = "Password123!";

  test("New candidate registration, profile setup, feed interaction, and radar exploration", async ({ page }) => {
    // 1. Step 1: Registration
    await page.goto("http://localhost:3000/auth/register");
    await page.waitForTimeout(1000);
    
    // Select the first persona card (Candidate)
    await page.locator("div.group").first().click({ force: true });
    await page.waitForTimeout(1000);

    // Step 2 basic credentials
    await page.fill('input[placeholder="Nguyễn Văn A"]', testName);
    await page.fill('input[placeholder="name@example.com"]', testEmail);
    await page.fill('input[placeholder="Tối thiểu 6 ký tự"]', testPassword);
    await page.click('button:has-text("Tiếp tục")', { force: true });
    await page.waitForTimeout(1000);

    // Step 3 Dynamic profile
    await page.fill('input[placeholder="Next.js, Python, Kế toán thuế, SEO..."]', "react, typescript, playwright");
    await page.fill('textarea[placeholder="Tôi có 3 năm kinh nghiệm trong thiết kế phần mềm / làm MMO kiếm tiền ngách..."]', "Playwright automation bot user experience.");
    await page.click('button[type="submit"]', { force: true });
    
    // Expect direct redirect to home page on auto-login
    await page.waitForURL("http://localhost:3000/", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 3. Step 3: Profile Setup
    await page.goto("http://localhost:3000/profile");
    await page.waitForTimeout(1500);

    // Open edit profile modal
    await page.click('button:has-text("Chỉnh sửa trang cá nhân")', { force: true });
    await page.waitForTimeout(1000);

    // Change address
    await page.fill('input[placeholder="Ví dụ: Quận 1, TP. Hồ Chí Minh"]', "Quận Cầu Giấy, Hà Nội");
    
    // Click submit
    await page.click('button:has-text("Lưu thay đổi")', { force: true });
    await page.waitForTimeout(1500);

    // Verify profile updated location info
    const addressSelector = page.locator('span:has-text("Hà Nội, Việt Nam"), span:has-text("Quận Cầu Giấy, Hà Nội")');
    await expect(addressSelector.first()).toBeVisible({ timeout: 10000 });

    // 4. Step 4: Explore and click job card
    await page.goto("http://localhost:3000/");
    await page.waitForTimeout(2000);

    // Switch tab on homepage to 'jobs' via bottom preview button
    await page.click('button:has-text("Xem tất cả việc làm")', { force: true });
    await page.waitForTimeout(1500);

    // Click "Xem & Ứng tuyển" on first job card
    const firstJobCard = page.locator('button:has-text("Xem & Ứng tuyển")').first();
    await expect(firstJobCard).toBeVisible({ timeout: 10000 });
    await firstJobCard.click({ force: true });
    await page.waitForTimeout(2000);

    // 5. Step 5: Review & Comment interactively
    // Verify detail page URL contains jobs path
    expect(page.url()).toContain("/jobs/");

    // Scroll to bottom review section
    const reviewFormComment = page.locator('textarea[placeholder="Nhập nội dung đánh giá chất lượng dịch vụ của nhà cung cấp này..."]');
    await expect(reviewFormComment).toBeVisible({ timeout: 15000 });
    
    // Choose 5 star rating (click last star button in stars list)
    const starButtons = page.locator('form button:has(svg)');
    await expect(starButtons.first()).toBeVisible({ timeout: 10000 });
    await starButtons.nth(4).click({ force: true });
    await page.waitForTimeout(500);

    // Write comment
    await reviewFormComment.fill("Dịch vụ tuyệt vời, phong cách làm việc rất chuyên nghiệp! ⭐⭐⭐⭐⭐");
    await page.waitForTimeout(500);

    // Submit review form
    await page.click('form button[type="submit"]', { force: true });
    await page.waitForTimeout(2000);

    // 6. Step 6: Radar Map Verification
    await page.goto("http://localhost:3000/explore");
    await page.waitForTimeout(3000);

    // Check if the radar map container element is successfully loaded
    const mapHeader = page.locator('h1:has-text("Bản đồ Radar: Tìm việc quanh đây")');
    await expect(mapHeader).toBeVisible({ timeout: 10000 });

    const leafletContainer = page.locator(".leaflet-container");
    await expect(leafletContainer).toBeVisible({ timeout: 15000 });
  });
});
