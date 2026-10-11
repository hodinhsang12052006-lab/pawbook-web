// Tìm phần tử gây giật bố cục (CLS) trên trang công khai — chỉ đọc.
import { chromium, devices } from "playwright";
const url = process.argv[2] || "https://www.bitpawos.com/";
const b = await chromium.launch();
for (const run of [1, 2, 3]) {
  const ctx = await b.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__shifts.push({ v: +e.value.toFixed(3), t: Math.round(e.startTime), src: (e.sources || []).map((s) => {
          const n = s.node; if (!n) return "?";
          const el = n.nodeType === 1 ? n : n.parentElement;
          return `${el?.tagName?.toLowerCase()}.${String(el?.className || "").split(" ").slice(0, 4).join(".")} [${(el?.textContent || "").trim().slice(0, 40)}] y${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`;
        }) });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await p.goto(url, { waitUntil: "load" });
  await p.waitForTimeout(6000);
  const s = await p.evaluate(() => window.__shifts);
  const total = s.reduce((a, x) => a + x.v, 0);
  console.log(`run${run} CLS=${total.toFixed(3)}`);
  for (const x of s.filter((x) => x.v >= 0.01)) console.log(`  ${x.v} @${x.t}ms\n    ${x.src.join("\n    ")}`);
  await ctx.close();
}
await b.close();
