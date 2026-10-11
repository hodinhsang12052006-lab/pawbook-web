// Độ giật bố cục (CLS) trang chủ — khách & người đã đăng nhập, điện thoại. Google: tốt < 0.1.
// CHỈ chạy với server local.   node scripts/qa/cls_test.mjs
import { chromium, devices } from "playwright";
import { BASE_URL, Results, SEED_OWNER, SEED_TECH, Client } from "./lib.mjs";

const R = new Results("Giật bố cục (CLS)");
const browser = await chromium.launch();
const errors = [];
async function cls(ctx, path = "/") {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p.addInitScript(() => {
    window.__cls = 0; window.__src = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; if (e.value > 0.05) window.__src.push(`${e.value.toFixed(3)}@${Math.round(e.startTime)}ms ` + (e.sources || []).map((s) => { const el = s.node?.nodeType === 1 ? s.node : s.node?.parentElement; return `${el?.tagName?.toLowerCase()}.${String(el?.className || "").split(" ").slice(0, 4).join(".")}[${(el?.textContent || "").trim().slice(0, 30)}] y${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}`; }).join(" | ")); } }).observe({ type: "layout-shift", buffered: true });
  });
  await p.goto(BASE_URL + path, { waitUntil: "load" });
  await p.waitForTimeout(5000);
  const v = await p.evaluate(() => window.__cls);
  if (v > 0.1) console.log("   nguồn:", (await p.evaluate(() => window.__src)).join(" || "));
  const hero = (await p.locator("h1", { hasText: "SÀN KẾT NỐI" }).isVisible()) ? 1 : 0;
  await p.close();
  return { v: +v.toFixed(3), hero };
}
try {
  const g = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const g1 = await cls(g), g2 = await cls(g);
  R.check("C1", "Khách (lần đầu + quay lại): CLS < 0.1, có phần giới thiệu", g1.v < 0.1 && g2.v < 0.1 && g1.hero > 0, `${g1.v} / ${g2.v}`);

  for (const [id, email, label] of [["C2", SEED_OWNER, "Chủ tiệm"], ["C3", SEED_TECH, "Thợ"]]) {
    const c = new Client();
    await c.login(email);
    const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
    const u = new URL(BASE_URL);
    await ctx.addCookies(Object.entries(c.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
    await cls(ctx); // lần đầu trên máy: ghi gợi ý "đã đăng nhập"
    const r = await cls(ctx);
    R.check(id, `${label} đã đăng nhập (lần sau): CLS < 0.1, KHÔNG hiện phần giới thiệu cho khách`, r.v < 0.1 && r.hero === 0, `${r.v} hero=${r.hero}`);
  }

  // Đăng xuất → máy quên gợi ý, khách lại thấy giới thiệu ngay
  const c = new Client();
  await c.login(SEED_TECH);
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const u = new URL(BASE_URL);
  await ctx.addCookies(Object.entries(c.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
  await cls(ctx);
  await ctx.clearCookies();
  await cls(ctx); // phiên không còn → xoá gợi ý
  const after = await cls(ctx);
  R.check("C4", "Sau khi đăng xuất: trang khách hiện đầy đủ, không giật", after.v < 0.1 && after.hero > 0, `${after.v} hero=${after.hero}`);
  R.check("C5", "Không lỗi JS (kể cả lỗi hydrate)", errors.length === 0, errors.join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
