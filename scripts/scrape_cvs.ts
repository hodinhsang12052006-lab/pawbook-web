import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { MongoClient } from "mongodb";
import * as fs from "fs";
import * as path from "path";

// Add stealth plugin to Playwright
// @ts-ignore
chromium.use(stealthPlugin());

// MongoDB configuration
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = "pawbook_data_mining";
const COLLECTION_NAME = "candidates";

// Helper for generating random delays (anti-ban)
const sleep = (minMs: number, maxMs: number) => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
};

async function scrapeCVs() {
  console.log("🚀 Starting CV Scraper...");

  // Setup MongoDB client
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  // Ensure unique index for CV link/email/phone to support upsert logic
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

  // CORE REQUIREMENT: Session/Cookies hijacking logic to bypass login wall gates.
  // Load session cookies if saved from previous interactive login or provided in env config
  const cookieFilePath = path.join(__dirname, "cookies.json");
  if (fs.existsSync(cookieFilePath)) {
    console.log("🔑 Loading saved session cookies to bypass gate authentication...");
    const cookiesRaw = fs.readFileSync(cookieFilePath, "utf8");
    try {
      const cookies = JSON.parse(cookiesRaw);
      await context.addCookies(cookies);
      console.log("✅ Cookies applied to context.");
    } catch (e) {
      console.error("❌ Failed to parse cookies file:", e);
    }
  } else if (process.env.RECRUITER_AUTH_TOKEN) {
    // If auth token is provided directly, inject it into localStorage/headers later
    console.log("🔑 Recruiter auth token detected in environment variables.");
  } else {
    console.log("⚠️ No saved session cookies found. Proceeding with guest access (might get blocked on real profile info)...");
  }

  const page = await context.newPage();

  try {
    // In production, navigate to recruiter portals containing candidates CV profiles
    const targetUrl = "https://examplesite.com/recruiter/candidates";
    
    console.log(`🔍 Crawling candidate directory: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(3000, 7000); // Random delay

    // Optional: Inject Recruiter Token into localStorage if cookies weren't loaded
    if (process.env.RECRUITER_AUTH_TOKEN) {
      await page.evaluate((token) => {
        localStorage.setItem("authToken", token);
        localStorage.setItem("session_token", token);
      }, process.env.RECRUITER_AUTH_TOKEN);
      
      // Reload page to apply localStorage state
      await page.reload({ waitUntil: "domcontentloaded" });
      await sleep(2000, 4000);
    }

    // Extract CV card info from list page
    const candidateLinks = await page.$$eval(".candidate-card a.profile-link", (elements) => {
      return elements.map((el) => (el as HTMLAnchorElement).href);
    });

    console.log(`📈 Found ${candidateLinks.length} candidate profiles. Crawling detailed profile pages...`);

    for (const profileUrl of candidateLinks) {
      try {
        console.log(`📄 Crawling profile details: ${profileUrl}`);
        await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(3000, 7000); // Anti-ban random delay

        // Extract detailed candidate info (including email & phone)
        const profileData = await page.evaluate(() => {
          // Selectors depend on target site structure
          const name = document.querySelector(".profile-name")?.textContent?.trim() || "";
          const desiredPosition = document.querySelector(".desired-position")?.textContent?.trim() || "";
          const experience = document.querySelector(".experience")?.textContent?.trim() || "";
          const skills = document.querySelector(".skills")?.textContent?.trim() || "";
          
          // Real contact info (emails/phones are normally gated behind auth buttons/paywalls)
          // Emulate click on "Show Contact Info" button if present
          const showButton = document.querySelector(".show-contact-button") as HTMLElement;
          if (showButton) {
            showButton.click();
          }

          const email = document.querySelector(".email-address")?.textContent?.trim() || "";
          const phone = document.querySelector(".phone-number")?.textContent?.trim() || "";

          return {
            name,
            desiredPosition,
            experience,
            skills,
            email,
            phone
          };
        });

        // Save candidate details to MongoDB using upsert logic based on URL
        if (profileData.email || profileData.phone || profileUrl) {
          const query = { sourceUrl: profileUrl };
          
          await collection.updateOne(
            query,
            {
              $set: {
                ...profileData,
                sourceUrl: profileUrl,
                lastCrawledAt: new Date()
              }
            },
            { upsert: true }
          );
          
          console.log(`✅ Upserted profile: ${profileData.name} (${profileData.phone || "No Phone"})`);
        }

      } catch (err) {
        console.error(`❌ Error scraping candidate profile at ${profileUrl}:`, err);
      }
    }

    // Save session cookies at the end of the script for reuse
    const currentCookies = await context.cookies();
    fs.writeFileSync(cookieFilePath, JSON.stringify(currentCookies, null, 2), "utf8");
    console.log(`💾 Cookies file updated in: ${cookieFilePath}`);

  } catch (err) {
    console.error("❌ Error scraping CVs:", err);
  } finally {
    await browser.close();
    await client.close();
    console.log("🏁 CV Scraper Finished.");
  }
}

// Self execution check
if (require.main === module) {
  scrapeCVs().catch(console.error);
}
