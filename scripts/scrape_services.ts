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
  console.log("🚀 Starting Google Maps Service Scraper...");

  // Setup MongoDB client
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  // Indexes to ensure query efficiency and avoid duplicates
  await collection.createIndex({ phone: 1 }, { sparse: true });
  await collection.createIndex({ name: 1, address: 1 }, { unique: true });

  const proxyServer = process.env.PROXY_SERVER; // e.g. "http://username:password@ip:port"
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ],
    proxy: proxyServer ? { server: proxyServer } : undefined
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "vi-VN" // Request Google Maps in Vietnamese
  });

  const page = await context.newPage();

  try {
    for (const city of CITIES) {
      console.log(`🔍 Searching pet services in: ${city}`);

      // Check time limit (Kill switch at 10:00 AM Asia/Ho_Chi_Minh)
      const nowInVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      if (nowInVN.getHours() >= 10) {
        console.log("⏰ Time limit reached (>= 10:00 AM Asia/Ho_Chi_Minh). Stopping execution...");
        break;
      }

      // Navigate to Google Maps search query URL
      const searchUrl = `https://www.google.com/maps/search/pet+services+${encodeURIComponent(city)}`;
      
      try {
        await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 45000 });
        await sleep(3000, 5000);

        // Define scrollable results side panel selector in Google Maps
        const listPanelSelector = "div[role='feed']";
        
        // Wait for list panel to load
        await page.waitForSelector(listPanelSelector, { timeout: 15000 }).catch(() => {
          console.log("⚠️ Results feed panel not found (might be direct listing page or no results).");
        });

        // Scroll to load all businesses in the list panel
        console.log("📜 Scrolling result list to load all items...");
        let isEnd = false;
        let lastHeight = 0;
        let scrollAttempts = 0;

        while (!isEnd && scrollAttempts < 25) {
          const panelHandle = await page.$(listPanelSelector);
          if (!panelHandle) break;

          // Scroll down by executing scrollTop modifications on feed panel element
          await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (el) {
              el.scrollTop = el.scrollHeight;
            }
          }, listPanelSelector);

          await sleep(1500, 2500);

          // Get current scroll height to check if more items loaded
          const newHeight = await page.evaluate((selector) => {
            return document.querySelector(selector)?.scrollHeight || 0;
          }, listPanelSelector);

          if (newHeight === lastHeight) {
            // Check if bottom marker text is visible (e.g. "Bạn đã đi đến cuối danh sách")
            const textContent = await page.evaluate((selector) => {
              return document.querySelector(selector)?.textContent || "";
            }, listPanelSelector);
            
            if (textContent.includes("cuối danh sách") || textContent.includes("end of the list")) {
              isEnd = true;
            }
          }
          
          lastHeight = newHeight;
          scrollAttempts++;
        }

        // Get list of item card links / listings elements
        const listingSelector = "a[href*='/maps/place/']";
        const listingHandles = await page.$$(listingSelector);
        console.log(`📈 Loaded ${listingHandles.length} listings to scrape.`);

        // Iterate and extract detailed coordinates, names, addresses and phones
        for (let i = 0; i < Math.min(listingHandles.length, 50); i++) {
          // Check time limit inside processing loop
          const currentVNTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
          if (currentVNTime.getHours() >= 10) {
            console.log("⏰ Time limit reached (>= 10:00 AM Asia/Ho_Chi_Minh). Exiting processing loop...");
            break;
          }

          try {
            // Refetch elements as state could change
            const elements = await page.$$(listingSelector);
            const currentItem = elements[i];
            if (!currentItem) continue;

            // Click listing item to open details card panel
            await currentItem.click();
            await sleep(2500, 4500); // Wait for details card animation/network calls

            // Extract detailed attributes from open side details panel
            const detailData = await page.evaluate(() => {
              // Extract Name from H1 tag inside details panel
              const nameEl = document.querySelector("h1");
              const name = nameEl?.textContent?.trim() || "";

              // Extract Address by looking for item ID attribute
              const addressEl = document.querySelector("[data-item-id='address']");
              const address = addressEl?.textContent?.trim() || "";

              // Extract Phone number by searching for phone attribute
              const phoneEl = document.querySelector("[data-item-id^='phone:tel:']");
              const phoneRaw = phoneEl?.getAttribute("data-item-id") || "";
              const phone = phoneRaw.replace("phone:tel:", "").trim();

              // Extract working hours
              const hoursEl = document.querySelector("[data-item-id='oh']");
              const workingHours = hoursEl?.textContent?.trim() || "08:00 - 22:00";

              return {
                name,
                address,
                phone,
                workingHours
              };
            });

            // Read coordinates directly from location URI using regex matching patterns
            const currentUrl = page.url();
            let coordinates = null;
            const geoRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
            const match = currentUrl.match(geoRegex);
            if (match) {
              coordinates = {
                lat: parseFloat(match[1]),
                lng: parseFloat(match[2])
              };
            }

            if (detailData.name) {
              const payload = {
                name: detailData.name,
                address: detailData.address,
                phone: detailData.phone || null,
                workingHours: detailData.workingHours,
                coordinates,
                city,
                sourceUrl: currentUrl,
                lastCrawledAt: new Date()
              };

              // MongoDB Upsert rules: Use phone if present, fallback to name+address query
              const query = detailData.phone 
                ? { phone: detailData.phone } 
                : { name: detailData.name, address: detailData.address };

              await collection.updateOne(
                query,
                { $set: payload },
                { upsert: true }
              );

              console.log(`✅ Upserted: "${detailData.name}" | Phone: ${detailData.phone || "N/A"}`);
            }

            // Close current detail card view to return back (if needed)
            const closeBtn = await page.$("button[aria-label='Đóng'], button[aria-label='Close']");
            if (closeBtn) {
              await closeBtn.click();
              await sleep(1000, 2000);
            }

          } catch (itemErr) {
            console.error(`❌ Error parsing details for index ${i}:`, itemErr);
          }
        }

      } catch (cityErr) {
        console.error(`❌ Error crawling search query for city ${city}:`, cityErr);
      }
    }
  } finally {
    await browser.close();
    await client.close();
    console.log("🏁 Google Maps Service Scraper Finished.");
  }
}

// Self execution check
if (require.main === module) {
  scrapeServices().catch(console.error);
}
