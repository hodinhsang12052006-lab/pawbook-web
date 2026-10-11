// Đo tốc độ trang CÔNG KHAI (chỉ đọc) trên mạng 4G mô phỏng + CPU điện thoại tầm trung.
import { chromium, devices } from "playwright";
const URLS = (process.argv[2] || "https://www.bitpawos.com/").split(",");
const b = await chromium.launch();
for (const url of URLS) {
  for (const run of [1, 2]) {
    const ctx = await b.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable");
    // "4G chậm" kiểu Lighthouse: 9 Mbps xuống, 150ms RTT; CPU chậm 4x
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const bytes = { js: 0, img: 0, css: 0, font: 0, other: 0, n: 0 };
    const big = [];
    cdp.on("Network.loadingFinished", () => {});
    p.on("response", async (r) => {
      try {
        const len = Number(r.headers()["content-length"] || 0) || (await r.body().catch(() => Buffer.alloc(0))).length;
        const t = r.request().resourceType();
        const k = t === "script" ? "js" : t === "image" ? "img" : t === "stylesheet" ? "css" : t === "font" ? "font" : "other";
        bytes[k] += len; bytes.n++;
        if (len > 100_000) big.push(`${Math.round(len / 1024)}KB ${r.url().replace(/^https:\/\/www\.bitpawos\.com/, "").slice(0, 90)}`);
      } catch {}
    });
    await p.addInitScript(() => {
      window.__lcp = 0; window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const t0 = Date.now();
    await p.goto(url, { waitUntil: "load", timeout: 90_000 });
    const load = Date.now() - t0;
    await p.waitForTimeout(3000);
    const m = await p.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      return { ttfb: Math.round(nav.responseStart), fcp: Math.round(fcp?.startTime || 0), lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), domInteractive: Math.round(nav.domInteractive) };
    });
    const kb = (x) => Math.round(x / 1024);
    console.log(`${url} run${run}: load ${load}ms ttfb ${m.ttfb} fcp ${m.fcp} lcp ${m.lcp} cls ${m.cls} | JS ${kb(bytes.js)}KB img ${kb(bytes.img)}KB css ${kb(bytes.css)}KB font ${kb(bytes.font)}KB other ${kb(bytes.other)}KB (${bytes.n} req)`);
    if (run === 1 && big.length) console.log("  big:", big.slice(0, 12).join("\n       "));
    await ctx.close();
  }
}
await b.close();
