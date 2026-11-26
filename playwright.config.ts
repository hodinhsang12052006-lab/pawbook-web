import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // no local retry: a test that only passes on retry is reported as failing, not hidden as "flaky"
  retries: process.env.CI ? 2 : 0,
  // one worker: tests share the server and its in-memory auth rate limiter
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],
  use: {
    baseURL: BASE_URL,
    // EN-first site: "/" is English, Vietnamese lives under /vi/...
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // QA SQLite copy + SHOW_DEMO_DATA=1 + next build/start: never Turso production, never `next dev` (first-compile
    // timeouts and manifest-write races were the 9 failures of the first run). See scripts/qa/pw-server.mjs.
    command: "node scripts/qa/pw-server.mjs",
    url: BASE_URL,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
});
