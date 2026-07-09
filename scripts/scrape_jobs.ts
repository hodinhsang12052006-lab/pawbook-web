import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { MongoClient } from "mongodb";

// Add stealth plugin to Playwright
// @ts-ignore
chromium.use(stealthPlugin());

// MongoDB configuration
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = "pawbook_data_mining";
const COLLECTION_NAME = "jobs";

// Helper for generating random delays (anti-ban)
const sleep = (minMs: number, maxMs: number) => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
};

async function scrapeJobs() {
  console.log("🚀 Starting Job Scraper...");

  // Setup MongoDB client
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  // Ensure unique index for Job Url to support upsert logic
  await collection.createIndex({ sourceUrl: 1 }, { unique: true });

  const proxyServer = process.env.PROXY_SERVER; // e.g. "http://username:password@ip:port"
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    proxy: proxyServer ? { server: proxyServer } : undefined
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    // Crawling job listing pages
    // In production, target major job boards / aggregator sites
    const jobBoardUrl = "https://examplesite.com/jobs?q=veterinary+pet+care";
    
    console.log(`🔍 Crawling target page: ${jobBoardUrl}`);
    await page.goto(jobBoardUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(3000, 7000); // Random delay

    // Extract job details from target HTML container
    const jobs = await page.$$eval(".job-card", (elements) => {
      return elements.map((el) => {
        const companyName = el.querySelector(".company")?.textContent?.trim() || "";
        const position = el.querySelector(".title")?.textContent?.trim() || "";
        const salary = el.querySelector(".salary")?.textContent?.trim() || "Thỏa thuận";
        const location = el.querySelector(".location")?.textContent?.trim() || "";
        const requirements = el.querySelector(".requirements")?.textContent?.trim() || "";
        const sourceUrl = (el.querySelector("a.apply-link") as HTMLAnchorElement)?.href || "";

        return {
          companyName,
          position,
          salary,
          location,
          requirements,
          sourceUrl
        };
      });
    });

    console.log(`📈 Extracted ${jobs.length} jobs.`);

    // Save jobs to MongoDB using upsert logic based on URL
    for (const item of jobs) {
      if (!item.sourceUrl) continue;

      await collection.updateOne(
        { sourceUrl: item.sourceUrl },
        {
          $set: {
            ...item,
            lastCrawledAt: new Date()
          }
        },
        { upsert: true }
      );
    }

  } catch (err) {
    console.error("❌ Error scraping jobs:", err);
  } finally {
    await browser.close();
    await client.close();
    console.log("🏁 Job Scraper Finished.");
  }
}

// Self execution check
if (require.main === module) {
  scrapeJobs().catch(console.error);
}
