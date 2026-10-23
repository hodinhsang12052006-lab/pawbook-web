// Ảnh chụp màn hình cho App Store / Google Play — chụp các trang CÔNG KHAI của bitpawos.com
// (chỉ đọc), rồi ghép khung + tiêu đề quảng bá. Kết quả: store-assets/ (không commit).
//   node scripts/store/make_screenshots.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const SITE = process.env.SITE || "https://www.bitpawos.com";
const OUT = path.resolve("store-assets");
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { path: "/", title: "Việc nail gấp tại Mỹ & Úc", sub: "Tìm việc, tìm thợ — miễn phí, nhắn trực tiếp" },
  { path: "/?tab=jobs", title: "Tin tuyển thợ mới mỗi ngày", sub: "Lọc theo bang, lương, kỹ năng — tin gấp lên đầu", scrollTo: /tin đang tuyển/ },
  { path: "/jobs/__LATEST__", title: "Xem lương, chỗ ở, liên hệ", sub: "Gọi hoặc nhắn tiệm chỉ 1 chạm" },
  // Thử mẫu: chụp tay → chạm móng → 10 mẫu trend vẽ lên tay (ảnh tay mẫu: scripts/qa/fixtures/hand.jpg)
  { path: "/tryon", title: "Thử mẫu trên chính tay bạn", sub: "Chụp tay → 10 mẫu nail trend trong vài giây", tryon: true },
  { path: "/designs", title: "Mẫu nail mới mỗi ngày", sub: "Ý tưởng theo mùa, giá gợi ý — lưu mẫu bạn thích" },
  { path: "/auth/register", title: "Thợ, chủ tiệm hay khách", sub: "Đăng ký 1 phút — đều miễn phí" },
];
// Apple iPhone 6.7"/6.9": 1290×2796 · Google Play điện thoại: 1080×1920
const TARGETS = [
  { name: "ios", w: 1290, h: 2796, vw: 430, vh: 932 },
  { name: "android", w: 1080, h: 1920, vw: 393, vh: 760 },
];

const browser = await chromium.launch();
for (const t of TARGETS) {
  for (const [i, s] of SHOTS.entries()) {
    // 1) chụp trang thật (khung điện thoại, độ nét 3x)
    const ctx = await browser.newContext({ viewport: { width: t.vw, height: t.vh }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "vi-VN", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
    const p = await ctx.newPage();
    let target = s.path;
    if (target.includes("__LATEST__")) {
      const jobs = await (await fetch(SITE + "/api/jobs?page=1&pageSize=1")).json().catch(() => []);
      target = target.replace("__LATEST__", jobs?.[0]?.id || "");
    }
    await p.goto(SITE + target, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    if (s.tryon) {
      await p.locator("input[type=file]").setInputFiles(path.resolve("scripts/qa/fixtures/hand.jpg"));
      const img = p.getByRole("img", { name: "Ảnh tay khách" });
      await img.waitFor({ timeout: 20000 });
      for (const [b, tip] of [[[272, 425], [272, 322]], [[385, 430], [380, 312]], [[505, 422], [500, 308]], [[618, 400], [615, 310]]]) {
        for (const [x, y] of [b, tip]) { const box = await img.boundingBox(); await p.mouse.click(box.x + (x / 900) * box.width, box.y + (y / 900) * box.height); }
      }
      // chờ máy nhận đủ 4 móng (viền móng hiện trên ảnh) rồi mới tạo mẫu; chờ 4 ảnh mẫu đầu vẽ xong
      await p.waitForFunction(() => document.querySelectorAll('svg[data-testid="nail-overlay"] polygon[data-nail]').length >= 4, null, { timeout: 30000 }).catch(() => {});
      await p.getByRole("button", { name: /Tạo mẫu/ }).click();
      await p.locator("button[aria-pressed]").first().waitFor({ timeout: 20000 });
      await p.waitForFunction(() => document.querySelectorAll("img[data-look]").length >= 4, null, { timeout: 40000 }).catch(() => {});
      await p.locator("button[aria-pressed]").first().evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 90));
      await p.waitForTimeout(1200);
    }
    // Cuộn tới đúng phần cần khoe (VD danh sách việc), bỏ qua banner đầu trang
    if (s.scrollTo) {
      await p.getByText(s.scrollTo).first().evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 140)).catch(() => {});
      await p.waitForTimeout(1200);
    }
    const raw = await p.screenshot({ type: "png" });
    await ctx.close();
    // 2) ghép: nền thương hiệu + tiêu đề + ảnh trong khung bo góc
    const page = await browser.newPage({ viewport: { width: t.w, height: t.h } });
    const head = Math.round(t.h * 0.17);
    const frameW = Math.round(t.w * 0.84);
    await page.setContent(`<!doctype html><html><body style="margin:0;width:${t.w}px;height:${t.h}px;overflow:hidden;background:radial-gradient(120% 60% at 50% 0%,#be185d 0%,#4c1d95 45%,#0b0b14 100%);font-family:'Segoe UI',Arial,sans-serif">
<div style="height:${head}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;padding:0 ${Math.round(t.w * 0.06)}px">
<div style="font-size:${Math.round(t.w * 0.068)}px;font-weight:900;line-height:1.15">${s.title}</div>
<div style="margin-top:${Math.round(t.w * 0.018)}px;font-size:${Math.round(t.w * 0.036)}px;color:#fbcfe8">${s.sub}</div></div>
<div style="display:flex;justify-content:center"><img src="data:image/png;base64,${raw.toString("base64")}" style="width:${frameW}px;border-radius:${Math.round(t.w * 0.05)}px;border:${Math.round(t.w * 0.012)}px solid #1e1b2e;box-shadow:0 30px 80px rgba(0,0,0,.6)"/></div>
</body></html>`);
    await page.waitForTimeout(300);
    const file = path.join(OUT, `${t.name}_${i + 1}_${s.path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`);
    await page.screenshot({ path: file, type: "png" });
    await page.close();
    console.log("✓", path.basename(file));
  }
}
// Ảnh bìa Google Play 1024×500
const icon = fs.readFileSync("assets/icon.png").toString("base64");
const fg = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await fg.setContent(`<!doctype html><html><body style="margin:0;width:1024px;height:500px;display:flex;align-items:center;gap:48px;padding:0 70px;box-sizing:border-box;background:linear-gradient(120deg,#0b0b14 0%,#4c1d95 55%,#be185d 100%);font-family:'Segoe UI',Arial,sans-serif;color:#fff">
<img src="data:image/png;base64,${icon}" style="width:230px;height:230px;border-radius:52px;box-shadow:0 20px 60px rgba(0,0,0,.5)"/>
<div><div style="font-size:66px;font-weight:900;line-height:1">PawNail Jobs</div>
<div style="margin-top:18px;font-size:30px;color:#fbcfe8">Việc nail gấp tại Mỹ &amp; Úc</div>
<div style="margin-top:10px;font-size:24px;color:#e9d5ff">Tìm việc · Tìm thợ · Miễn phí</div></div></body></html>`);
await fg.screenshot({ path: path.join(OUT, "play_feature_graphic_1024x500.png") });
// Biểu tượng 512×512 cho Google Play
const ic = await browser.newPage({ viewport: { width: 512, height: 512 } });
await ic.setContent(`<body style="margin:0"><img src="data:image/png;base64,${icon}" style="width:512px;height:512px;display:block"/></body>`);
await ic.screenshot({ path: path.join(OUT, "play_icon_512.png") });
await browser.close();
console.log("→", OUT);
