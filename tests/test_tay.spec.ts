import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

// Load env variables manually for test context
try {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] ? match[2].trim() : "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[match[1]] = value;
      }
    });
  }
} catch (e) {
  console.error("Failed to load .env in test runner:", e);
}

let prismaInstance: PrismaClient;

if (process.env.TURSO_DATABASE_URL) {
  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql as any);
  prismaInstance = new PrismaClient({ adapter: adapter as any });
} else {
  prismaInstance = new PrismaClient();
}

const prisma = prismaInstance;

test.describe("Automated E2E Testing - PawBook", () => {
  const randomSuffix = Math.floor(Math.random() * 900000 + 100000);
  const testEmail = `testuser_${randomSuffix}@pawbook.vn`;
  const testName = `QA Tester ${randomSuffix}`;
  const testPassword = "password123";

  test("Registration and core user flows", async ({ page, request }) => {
    // Đăng ký listener để bắt log từ browser và API response
    page.on("console", msg => console.log("BROWSER LOG:", msg.text()));
    page.on("response", async response => {
      if (response.url().includes("/api/applications") && response.request().method() === "POST") {
        console.log("API RESPONSE STATUS:", response.status());
        try {
          console.log("API RESPONSE BODY:", await response.text());
        } catch (e) {}
      }
    });

    // Luồng 1: Tự động điền form Đăng ký 1 tài khoản mới.
    await page.goto("http://localhost:3000/register");
    
    // Click vào thẻ Persona đầu tiên (CANDIDATE) bằng locator chính xác
    const candidateBtn = page.locator('div.group:has-text("Dân Tech")').first();
    await candidateBtn.waitFor({ state: "visible", timeout: 10000 });
    await candidateBtn.click({ force: true });
    
    // Đợi input xuất hiện để xác nhận đã qua Step 2
    await page.waitForSelector('input[placeholder="Nguyễn Văn A"]', { timeout: 5000 });
    
    await page.fill('input[placeholder="Nguyễn Văn A"]', testName);
    await page.fill('input[placeholder="name@example.com"]', testEmail);
    await page.fill('input[placeholder="Tối thiểu 6 ký tự"]', testPassword);
    await page.click('button:has-text("Tiếp tục")', { force: true });
    
    // Đợi Step 3
    await page.waitForSelector('input[placeholder="Next.js, Python, Kế toán thuế, SEO..."]', { timeout: 5000 });
    
    await page.fill('input[placeholder="Next.js, Python, Kế toán thuế, SEO..."]', "nextjs, automation, playwright");
    await page.fill('textarea[placeholder="Tôi có 3 năm kinh nghiệm trong thiết kế phần mềm / làm MMO kiếm tiền ngách..."]', "QA Automation test bio description.");
    await page.click('button[type="submit"]', { force: true });

    // Expect direct redirect to home page on auto-login
    await page.waitForURL("http://localhost:3000/", { timeout: 15000 });

    // Đợi trang chủ tải xong và có sự hiện diện của session
    await page.waitForTimeout(2050);

    // Luồng 2: Điều hướng vào Profile, click nút "Điểm danh" -> Assert số dư ví tăng 20 coin.
    await page.goto("http://localhost:3000/profile");
    
    console.log("Current page URL after going to /profile:", page.url());
    
    // Đợi tên QA Tester hiển thị để đảm bảo API profile đã load xong
    await expect(page.locator("h1")).toContainText(testName, { timeout: 15000 });
    
    const coinBadge = page.locator("#user-pawcoin-balance");
    try {
      await expect(coinBadge).toContainText("150", { timeout: 10000 });
    } catch (err) {
      console.log("Locator failed. Page HTML body content:");
      console.log(await page.locator("body").innerText());
      throw err;
    }

    // Click nút điểm danh nhận quà
    await page.waitForSelector("#btn-daily-reward", { state: "visible", timeout: 10000 });
    await page.click("#btn-daily-reward", { force: true });
    
    // Đợi số dư ví tăng lên 170 (+20)
    await expect(coinBadge).toContainText("170", { timeout: 10000 });

    // Luồng 3: Điều hướng ra Job Board, click "Ứng tuyển" (Apply) một Job bất kỳ -> Assert số dư ví bị trừ 5 coin.
    // Lấy ID việc làm đầu tiên từ API để test
    const jobsResponse = await request.get("http://localhost:3000/api/jobs");
    const jobs = await jobsResponse.json();
    expect(jobs.length).toBeGreaterThan(0);
    const targetJobId = jobs[0].id;

    // Vào trang chi tiết và ứng tuyển
    await page.goto(`http://localhost:3000/jobs/${targetJobId}`);
    
    // Chờ click nút nộp hồ sơ
    await page.click('button:has-text("Nộp nhanh CV mặc định")', { force: true });
    
    // Chờ 2 giây để API hoàn tất
    await page.waitForTimeout(2000);

    // Quay lại Profile và kiểm tra số dư ví
    await page.goto("http://localhost:3000/profile");
    await expect(coinBadge).toContainText("165", { timeout: 10000 });

    // Luồng 4: Thử gọi request để Review một tài khoản rác -> Assert bị chặn và báo lỗi 403.
    // Lấy một Spa Owner thực tế từ DB để kích hoạt kiểm tra quan hệ giao dịch (403 instead of 404)
    const targetJob = jobs[0];
    const spaOwner = await prisma.user.findFirst({
      where: {
        role: "EMPLOYER",
        id: { not: targetJob.employerId }
      }
    });
    const targetUserId = spaOwner ? spaOwner.id : "random-trash-user-id";

    // Thực thi fetch trực tiếp trong môi trường Page để thừa hưởng Cookie session đăng nhập
    const reviewResponse = await page.evaluate(async (targetId) => {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: 5,
          content: "Fake Review spam check",
          targetUserId: targetId
        })
      });
      return { status: res.status, body: await res.json() };
    }, targetUserId);
    
    console.log("Review API Response under logged-in page context status:", reviewResponse.status);
    console.log("Review API Response body:", reviewResponse.body);
    expect(reviewResponse.status).toBe(403);
  });
});
