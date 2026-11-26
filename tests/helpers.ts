import type { Page } from "@playwright/test";

export const SEED_TECH_EMAIL = "tech1.us@pawnailjobs.demo";
export const SEED_OWNER_EMAIL = "owner1.us@pawnailjobs.demo";
export const DEMO_PASSWORD = "Demo@12345";

let ipSeq = 1;
const subnet = Math.floor(Math.random() * 180) + 30;

/**
 * Generates an isolated simulated client IP (`cf-connecting-ip`) per test so
 * parallel Playwright workers never collide in the in-memory auth rate limiter.
 */
export function nextClientIp(): string {
  const n = ipSeq++;
  return `10.${subnet}.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`;
}

export async function attachIsolatedIp(page: Page, ip = nextClientIp()): Promise<string> {
  await page.context().setExtraHTTPHeaders({ "cf-connecting-ip": ip });
  return ip;
}

/**
 * Tracks uncaught browser exceptions (`pageerror`) and internal server errors (`5xx`)
 * on local application routes during a test.
 */
export function trackRuntimeErrors(page: Page) {
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  page.on("response", (res) => {
    const url = res.url();
    if (url.startsWith("http://localhost") && res.status() >= 500) {
      // /api/auth/forgot intentionally returns 503 when SMTP is not configured locally
      if (res.status() === 503 && url.includes("/api/auth/forgot")) return;
      serverErrors.push(`HTTP ${res.status()} ${new URL(url).pathname}`);
    }
  });

  return { pageErrors, serverErrors };
}

