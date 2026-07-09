import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { MongoClient } from "mongodb";

// Add stealth plugin to Playwright
// @ts-ignore
chromium.use(stealthPlugin());

// MongoDB configuration
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = "pawbook_data_mining";
const COLLECTION_NAME = "services";

const CITIES = [
  "Nha Trang",
  "Ho Chi Minh",
  "Ha Noi",
  "Da Nang",
  "Hai Phong",
  "Can Tho",
  "Bien Hoa"
];

// Helper for generating random delays (anti-ban)
const sleep = (minMs: number, maxMs: number) => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
};

async function scrapeServices() {
  console.log("🚀 Starting Service Scraper...");
  
  // Setup MongoDB client
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);
  
  // Ensure unique index for phone/source URL to support upsert logic
  await collection.createIndex({ phone: 1 }, { unique: true });
  await collection.createIndex({ sourceUrl: 1 }, { unique: true });

  // Optional: Rotate proxies if provided in env
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
    for (const city of CITIES) {
      console.log(`🔍 Crawling city: ${city}`);
      
      // Mock Search Target: Crawling list of service providers/maps
      // In production, change URL to target directories (e.g. Google Maps, Yellow Pages, Local Listing Directories)
      const searchUrl = `https://examplesite.com/search?query=pet+services&location=${encodeURIComponent(city)}`;
      
      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(3000, 7000); // Anti-ban random delay

        // Extract listings from target listing HTML container
        const listings = await page.$$eval(".listing-card", (elements) => {
          return elements.map((el) => {
            const name = el.querySelector(".title")?.textContent?.trim() || "";
            const address = el.querySelector(".address")?.textContent?.trim() || "";
            const phone = el.querySelector(".phone")?.textContent?.trim() || "";
            const ratingStr = el.querySelector(".rating")?.textContent?.trim() || "0";
            const workingHours = el.querySelector(".hours")?.textContent?.trim() || "08:00 - 22:00";
            const lat = el.getAttribute("data-lat") ? parseFloat(el.getAttribute("data-lat")!) : null;
            const lng = el.getAttribute("data-lng") ? parseFloat(el.getAttribute("data-lng")!) : null;
            const sourceUrl = (el.querySelector("a.detail-link") as HTMLAnchorElement)?.href || "";

            return {
              name,
              address,
              phone,
              rating: parseFloat(ratingStr) || 0.0,
              workingHours,
              coordinates: lat && lng ? { lat, lng } : null,
              sourceUrl
            };
          });
        });

        console.log(`📈 Found ${listings.length} listings in ${city}`);

        // Save listings to MongoDB using upsert logic based on phone/url
        for (const item of listings) {
          if (!item.phone && !item.sourceUrl) continue;

          const query = item.phone ? { phone: item.phone } : { sourceUrl: item.sourceUrl };

          await collection.updateOne(
            query,
            {
              $set: {
                ...item,
                city,
                lastCrawledAt: new Date()
              }
            },
            { upsert: true }
          );
        }

      } catch (err) {
        console.error(`❌ Error scraping services in ${city}:`, err);
      }
    }
  } finally {
    await browser.close();
    await client.close();
    console.log("🏁 Service Scraper Finished.");
  }
}

// Self execution check
if (require.main === module) {
  scrapeServices().catch(console.error);
}
