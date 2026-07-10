import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

// Enable Puppeteer stealth plugin on Playwright Extra
chromium.use(stealthPlugin());

// 5 Key Cities of Vietnam for focused crawling
const PROVINCES = [
  "TP.HCM", "Hà Nội", "Đà Nẵng", "Cần Thơ", "Nha Trang"
];

// 53 Service keywords
const KEYWORDS = [
  "Cứu hộ xe máy", "Cứu hộ ô tô", "Thợ sửa khóa", "Sửa điện nước khẩn cấp", "Thông tắc vệ sinh",
  "Nhà thuốc 24/7", "Cấp cứu thú y", "Diệt côn trùng", "Sửa chữa máy lạnh", "Sửa điện máy gia dụng",
  "Dọn dẹp nhà cửa", "Giặt ủi nội thất", "Thợ xây sửa nhỏ", "Lắp đặt camera", "Sửa cửa cuốn cửa kính",
  "Cắt tóc nam barber", "Salon tóc nữ", "Spa Massage", "Tiệm Nails", "Phun xăm thẩm mỹ",
  "Phòng tập Gym Yoga", "Trang điểm Makeup", "Thuê xe máy", "Thuê ô tô tự lái", "Chuyển nhà trọn gói",
  "Xe tải chở thuê", "Đưa đón sân bay", "Tài xế lái xe hộ", "Giặt ủi dân dụng", "Giao gas tận nhà",
  "Giao nước khoáng", "Sửa quần áo giày dép", "In ấn Photocopy", "Rửa xe chăm sóc xe", "Giao đá viên hỏa tốc",
  "Spa thú cưng", "Khách sạn thú cưng", "Trông trẻ theo giờ", "Gia sư trung tâm dạy kèm", "Khu vui chơi trẻ em",
  "Quán ăn đêm", "Cà phê làm việc", "Cyber Gaming tiệm net", "Billiards bida", "Karaoke",
  "Nấu tiệc tại nhà", "Thuê đồ sự kiện", "Cho thuê trang phục", "Y tế tại nhà", "Dịch vụ giấy tờ pháp lý",
  "Mua bán sửa chữa điện thoại iphone", "Chạy xe ôm công nghệ Grab", "Sửa chữa máy tính laptop",
  "Taxi xe ôm chở thú cưng"
];

// Configurable options
const MAX_STORES_PER_KEYWORD = parseInt(process.env.MAX_STORES_PER_KEYWORD || "5", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "10", 10);
const HEADLESS = process.env.SHOW_BROWSER !== "true";
const DATA_DIR = path.join(process.cwd(), "data_crawled");

// Ensure output directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Slugify helper to create safe folder/file names
function slugify(text: string): string {
  if (text === "Taxi xe ôm chở thú cưng") {
    return "Xe_om_thu_cung";
  }
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove Vietnamese accents
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9]/g, "_")  // Replace space/special characters with underscore
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Delay helper
const delay = (min: number, max: number) => {
  const ms = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

async function parsePlaceDetails(page: any, defaultCategory: string) {
  try {
    const nameLocator = page.locator("h1");
    if ((await nameLocator.count()) === 0) return null;
    const name = (await nameLocator.first().textContent() || "").trim();
    if (!name) return null;

    let rating: number | null = null;
    let reviewCount = 0;

    const ratingContainer = page.locator("div.F7nice");
    if ((await ratingContainer.count()) > 0) {
      const spans = ratingContainer.locator("span");
      const spansCount = await spans.count();
      if (spansCount > 0) {
        const ratingText = await spans.first().textContent();
        if (ratingText) {
          const parsed = parseFloat(ratingText.replace(",", ".").trim());
          if (!isNaN(parsed)) rating = parsed;
        }
      }
      if (spansCount > 1) {
        const reviewText = await spans.nth(1).textContent();
        if (reviewText) {
          const parsed = parseInt(reviewText.replace(/[^\d]/g, "").trim(), 10);
          if (!isNaN(parsed)) reviewCount = parsed;
        }
      }
    }

    let address = "";
    const addressButton = page.locator('button[data-item-id="address"]');
    if ((await addressButton.count()) > 0) {
      const label = await addressButton.first().getAttribute("aria-label");
      if (label) {
        address = label.replace(/^Địa chỉ:\s*/i, "").trim();
      } else {
        const text = await addressButton.first().textContent();
        if (text) address = text.replace(/^Địa chỉ:\s*/i, "").trim();
      }
    }

    if (!address) {
      const addressLines = page.locator(".Io6YTe");
      const count = await addressLines.count();
      for (let i = 0; i < count; i++) {
        const text = await addressLines.nth(i).textContent();
        if (text) {
          address = text.trim();
          break;
        }
      }
    }

    if (!address) {
      address = "Việt Nam";
    }

    let url = page.url();
    let coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (!coordMatch) {
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(1000);
        url = page.url();
        coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) break;
      }
    }

    const latitude = coordMatch ? parseFloat(coordMatch[1]) : null;
    const longitude = coordMatch ? parseFloat(coordMatch[2]) : null;

    let category = defaultCategory;
    const categoryButton = page.locator('button[jsaction*="category"]');
    if ((await categoryButton.count()) > 0) {
      const catText = await categoryButton.first().textContent();
      if (catText) category = catText.trim();
    }

    return { name, category, rating, reviewCount, address, latitude, longitude };
  } catch (err: any) {
    console.error(`  [Parser Error]: ${err.message}`);
    return null;
  }
}

interface ScrapeTask {
  province: string;
  keyword: string;
}

async function runWorker(
  workerId: number,
  queue: ScrapeTask[],
  browser: any,
  totalTasks: number
) {
  await delay(workerId * 1.5, workerId * 1.5);

  while (queue.length > 0) {
    const task = queue.shift();
    if (!task) break;

    const { province, keyword } = task;
    const provinceSlug = slugify(province);
    const keywordSlug = slugify(keyword);
    const provinceDir = path.join(DATA_DIR, provinceSlug);
    const outputFile = path.join(provinceDir, `${keywordSlug}.json`);

    // Check if task is already completed (Resilience)
    if (fs.existsSync(outputFile)) {
      console.log(`[Worker ${workerId}] ⏩ SKIP: "${keyword}" in "${province}" (Already exists: ${provinceSlug}/${keywordSlug}.json)`);
      continue;
    }

    console.log(`[Worker ${workerId}] 🚀 [${totalTasks - queue.length}/${totalTasks}] Crawling: "${keyword}" in "${province}"...`);

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const taskStores: any[] = [];

    try {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keyword + " " + province)}`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await delay(2, 4);

      // Handle direct redirect to a single place page
      const currentUrl = page.url();
      if (currentUrl.includes("/maps/place/")) {
        console.log(`[Worker ${workerId}]   Direct redirect to a single location.`);
        const storeData = await parsePlaceDetails(page, keyword);
        if (storeData) {
          taskStores.push(storeData);
        }
      } else {
        // Scroll sidebar to load search result cards
        const feed = page.locator('div[role="feed"]');
        if ((await feed.count()) > 0) {
          let lastHeight = await feed.evaluate((el: any) => el.scrollHeight);
          let scrollAttempts = 0;

          while (scrollAttempts < 5) {
            const currentCount = await page.locator('a[href*="/maps/place/"]').count();
            if (currentCount >= MAX_STORES_PER_KEYWORD) break;

            await feed.evaluate((el: any) => el.scrollTo(0, el.scrollHeight));
            await delay(1, 2);

            const newHeight = await feed.evaluate((el: any) => el.scrollHeight);
            if (newHeight === lastHeight) {
              scrollAttempts++;
            } else {
              scrollAttempts = 0;
              lastHeight = newHeight;
            }
          }
        }

        // Extract list item links
        const links = page.locator('a[href*="/maps/place/"]');
        const totalFound = await links.count();
        const urls: string[] = [];
        for (let i = 0; i < totalFound; i++) {
          const href = await links.nth(i).getAttribute("href");
          if (href && !urls.includes(href)) {
            urls.push(href);
          }
        }

        const toCrawl = urls.slice(0, MAX_STORES_PER_KEYWORD);
        console.log(`[Worker ${workerId}]   Found ${urls.length} places. Crawling top ${toCrawl.length}...`);

        for (const placeUrl of toCrawl) {
          try {
            await page.goto(placeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
            await delay(1, 2);

            const storeData = await parsePlaceDetails(page, keyword);
            if (storeData) {
              taskStores.push(storeData);
            }
          } catch (err: any) {
            console.error(`[Worker ${workerId}]   Error visiting place details: ${err.message}`);
          }
        }
      }

      // Write crawled data to partitioned JSON file
      if (!fs.existsSync(provinceDir)) {
        fs.mkdirSync(provinceDir, { recursive: true });
      }
      fs.writeFileSync(outputFile, JSON.stringify(taskStores, null, 2), "utf-8");
      console.log(`[Worker ${workerId}]   ✅ SAVED ${taskStores.length} stores to ${provinceSlug}/${keywordSlug}.json`);

    } catch (err: any) {
      console.error(`[Worker ${workerId}] ❌ Error processing keyword "${keyword}" in "${province}": ${err.message}`);
    } finally {
      await context.close();
    }
  }
}

async function main() {
  console.log("=== NATIONWIDE GOOGLE MAPS STORE SCRAPER (STAGE 1) ===");
  console.log(`Total Provinces: ${PROVINCES.length}`);
  console.log(`Total Keywords per Province: ${KEYWORDS.length}`);
  
  // Build queue of all combinations
  const queue: ScrapeTask[] = [];
  for (const province of PROVINCES) {
    for (const keyword of KEYWORDS) {
      queue.push({ province, keyword });
    }
  }

  const totalTasks = queue.length;
  console.log(`Total Search Tasks to Complete: ${totalTasks}`);
  console.log(`Concurrency: ${CONCURRENCY} workers`);
  console.log(`Max stores per keyword: ${MAX_STORES_PER_KEYWORD}`);

  const start = Date.now();
  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      workers.push(runWorker(i + 1, queue, browser, totalTasks));
    }
    await Promise.all(workers);
  } finally {
    await browser.close();
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`=== STAGE 1 COMPLETED. Elapsed Time: ${duration}s ===`);
}

main().catch((err) => {
  console.error("Nationwide scraper crashed:", err);
  process.exit(1);
});
