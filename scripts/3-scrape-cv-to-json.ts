import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

// Enable Puppeteer stealth plugin on Playwright Extra
chromium.use(stealthPlugin());

// Configurable constants
const OUTPUT_DIR = path.join(process.cwd(), "data_cvs");
const HEADLESS = process.env.SHOW_BROWSER !== "true";

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 5 Key Niches of Candidates to crawl
const NICHES = [
  "Thợ sửa điện lạnh",
  "Kỹ thuật viên Spa",
  "Lập trình viên Web",
  "Tài xế lái xe",
  "Thợ xây dựng"
];

// Realistic Vietnamese names for fallback/parsing
const MOCK_NAMES = [
  "Nguyễn Văn Tuấn", "Trần Thị Mai", "Lê Quốc Bảo", "Phạm Thùy Chi", "Hoàng Minh Đức",
  "Vũ Bảo Vy", "Bùi Tuyết Trinh", "Đỗ Đăng Khoa", "Nguyễn Khánh Nam", "Lê Minh Hùng",
  "Phạm Thanh Sơn", "Đặng Hồng Nhung", "Trần Việt Anh", "Lê Diệu Linh", "Nguyễn Gia Huy"
];

// FOMO tags helper
const FOMO_TAGS_POOL = [
  "🔥 Hot: 2 HR đang xem",
  "⚡ Rảnh lịch - Nhận việc ngay",
  "⭐ Kinh nghiệm thực chiến",
  "🔥 Top 5% ứng viên tốt",
  "⚡ Bắt đầu làm ngay",
  "⭐ Có chứng chỉ hành nghề",
  "🔥 Sẵn sàng tăng ca",
  "⚡ Đã xác thực tay nghề"
];

// Skills dataset per niche
const SKILLS_MAP: Record<string, string[]> = {
  "Thợ sửa điện lạnh": ["Vệ sinh điều hòa", "Bơm gas máy lạnh", "Sửa tủ lạnh inverter", "Lắp đặt máy giặt"],
  "Kỹ thuật viên Spa": ["Massage body", "Laser skincare", "Massage đá nóng", "Tư vấn làm đẹp"],
  "Lập trình viên Web": ["ReactJS", "Next.js", "Node.js", "TypeScript", "Tailwind CSS"],
  "Tài xế lái xe": ["Bằng lái hạng D", "Lái xe hộ", "Đường trường", "Cứu hộ ô tô"],
  "Thợ xây dựng": ["Thợ hồ", "Ốp lát gạch", "Sơn tường", "Đọc bản vẽ nhỏ"]
};

// Default bios if scraping falls back
const DEFAULT_BIOS: Record<string, string> = {
  "Thợ sửa điện lạnh": "Chuyên sửa chữa điện lạnh gia đình, vệ sinh bơm ga máy lạnh điều hòa Inverter nhanh gọn. Tận tâm, chu đáo, bảo hành dài hạn.",
  "Kỹ thuật viên Spa": "Có 4 năm làm việc tại spa cao cấp, am hiểu kỹ thuật trị liệu da mặt, massage body tinh dầu Thụy Điển. Giao tiếp tốt, thân thiện.",
  "Lập trình viên Web": "Lập trình viên Front-end đam mê React/Next.js, tối ưu hóa giao diện người dùng và tăng tốc độ tải trang. Có tư duy sản phẩm.",
  "Tài xế lái xe": "Kinh nghiệm 5 năm lái xe gia đình, lái xe hộ sau tiệc nhậu. Cam kết lái xe an toàn, lịch sự, đúng giờ.",
  "Thợ xây dựng": "Thợ xây dựng lành nghề, chuyên hoàn thiện công trình nhà phố, ốp lát gạch men sạch đẹp, chống thấm dột khẩn cấp."
};

// Delay helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Slugify helper to create safe folder/file names
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove Vietnamese accents
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function scrapeNiche(niche: string) {
  console.log(`\n=== Starting scraper for niche: "${niche}" ===`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const candidates: any[] = [];

  try {
    // Search google with candidate/freelancer dorks
    // CHANGE THIS URL OR QUERY IF YOU WISH TO TARGET OTHER JOB PORTALS DIRECTLY
    const query = `site:vn "hồ sơ" OR "cv" OR "freelancer" "${niche}"`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    console.log(`Navigating to Google Search: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "networkidle" });
    await delay(2000);

    // Extract search result item element blocks
    const searchResultSelector = "div.g";
    const resultCount = await page.locator(searchResultSelector).count();
    console.log(`Found ${resultCount} search result snippets.`);

    for (let i = 0; i < Math.min(resultCount, 8); i++) {
      try {
        const block = page.locator(searchResultSelector).nth(i);
        const titleText = await block.locator("h3").first().innerText().catch(() => "");
        const snippetText = await block.locator("div[style*='-webkit-line-clamp']").first().innerText()
          .catch(() => block.locator("span").first().innerText().catch(() => ""));

        if (!titleText) continue;

        // Try to parse candidate name or fallback to mock name pool
        let candidateName = "";
        const parts = titleText.split(/[-|:]/);
        if (parts.length > 0 && parts[0].trim().length > 3 && parts[0].trim().length < 25) {
          candidateName = parts[0].trim();
        } else {
          candidateName = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
        }

        // Random avatar index
        const randomImgId = Math.floor(Math.random() * 70) + 1;
        const avatarUrl = `https://i.pravatar.cc/300?img=${randomImgId}`;

        // Random years of experience
        const expYears = Math.floor(Math.random() * 7) + 2;
        
        // Random salary range
        const baseSalary = 10 + Math.floor(Math.random() * 15);
        const maxSalary = baseSalary + 5 + Math.floor(Math.random() * 10);
        const expectedSalary = `${baseSalary},000,000đ - ${maxSalary},000,000đ`;

        // Random distance
        const distanceVal = (Math.random() * 5 + 0.5).toFixed(1);

        // Randomly select 2 fomo tags from pool
        const shuffledTags = [...FOMO_TAGS_POOL].sort(() => 0.5 - Math.random());
        const fomoTags = shuffledTags.slice(0, 2);

        candidates.push({
          id: `scraped-cv-${slugify(niche)}-${i}`,
          name: candidateName,
          title: `${niche} chuyên nghiệp`,
          experience: `${expYears} năm kinh nghiệm`,
          salary: expectedSalary,
          location: "TP. Hồ Chí Minh",
          distance: `${distanceVal} km`,
          avatarUrl: avatarUrl,
          bio: snippetText.replace(/\n/g, " ").trim() || DEFAULT_BIOS[niche],
          skills: SKILLS_MAP[niche] || ["Tay nghề cao", "Chuyên nghiệp"],
          fomoTags: fomoTags
        });
      } catch (err: any) {
        console.error(`Error parsing index ${i}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error(`Scrape failure for ${niche}:`, err.message);
  } finally {
    await browser.close();
  }

  // Fallback: If blocked or zero items scraped, generate 4 high quality profiles to keep it functional
  if (candidates.length === 0) {
    console.log(`No entries crawled for "${niche}". Loading fallback templates...`);
    for (let i = 1; i <= 4; i++) {
      const randomImgId = Math.floor(Math.random() * 70) + 1;
      const shuffledTags = [...FOMO_TAGS_POOL].sort(() => 0.5 - Math.random());
      candidates.push({
        id: `scraped-cv-${slugify(niche)}-fallback-${i}`,
        name: MOCK_NAMES[(i * 3) % MOCK_NAMES.length],
        title: `${niche} chất lượng cao`,
        experience: `${3 + i} năm kinh nghiệm`,
        salary: `${12 + i},000,000đ - ${20 + i * 2},000,000đ`,
        location: "TP. Hồ Chí Minh",
        distance: `${(1.2 * i).toFixed(1)} km`,
        avatarUrl: `https://i.pravatar.cc/300?img=${randomImgId}`,
        bio: DEFAULT_BIOS[niche] || "Chuyên viên dịch vụ kỹ thuật lành nghề, giàu kinh nghiệm, chu đáo, nhiệt tình hỗ trợ khách hàng.",
        skills: SKILLS_MAP[niche] || ["Tay nghề giỏi", "Nhiệt tình"],
        fomoTags: shuffledTags.slice(0, 2)
      });
    }
  }

  // Save to file
  const filename = `${slugify(niche)}.json`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, JSON.stringify(candidates, null, 2), "utf-8");
  console.log(`Saved ${candidates.length} records into ${outputPath}!`);
}

async function main() {
  console.log("=== Playwright CV Scraper & FOMO Generator ===");
  for (const niche of NICHES) {
    await scrapeNiche(niche);
    await delay(1500); // polite pause between queries
  }
  console.log("\n=== Scraper finished! All data files saved in data_cvs/ ===");
}

main().catch((err) => {
  console.error("Scraper crashed:", err);
  process.exit(1);
});
