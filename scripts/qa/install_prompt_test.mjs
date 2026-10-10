// Nút "Cài app" (PWA): Android 1 chạm, iPhone hướng dẫn, Zalo/Facebook nhắc mở trình duyệt.
// CHỈ chạy với server local.   node scripts/qa/install_prompt_test.mjs
import { chromium, devices } from "playwright";
import { BASE_URL, Results, fakeIp } from "./lib.mjs";

const R = new Results("Cài app");
const errors = [];
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const banner = (p) => p.locator("[data-install-banner]");
const WAIT = 17_000;
// Chrome thật bắn beforeinstallprompt khi đủ điều kiện cài — headless thì không, nên bắn giả.
const fireBIP = (p, outcome = "accepted") =>
  p.evaluate((o) => {
    const e = new Event("beforeinstallprompt", { cancelable: true });
    e.prompt = async () => { window.__prompted = (window.__prompted || 0) + 1; };
    e.userChoice = Promise.resolve({ outcome: o });
    window.dispatchEvent(e);
  }, outcome);

const browser = await chromium.launch();
async function ctxFor(device, ua) {
  const ctx = await browser.newContext({ ...device, ...(ua ? { userAgent: ua } : {}), locale: "vi-VN" });
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), "cf-connecting-ip": fakeIp() } }));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  return p;
}
const returning = (p) => p.evaluate((d) => localStorage.setItem("pn_install", JSON.stringify({ days: [d] })), yesterday);

try {
  await Promise.all([
    // ---- Android ----
    (async () => {
      const p = await ctxFor(devices["Pixel 7"]);
      await p.goto(BASE_URL + "/");
      await fireBIP(p);
      await p.waitForTimeout(WAIT);
      R.check("I1", "Lần đầu ghé (chưa đăng nhập): KHÔNG làm phiền ngay", (await banner(p).count()) === 0);
      await returning(p);
      await p.reload();
      await fireBIP(p);
      await banner(p).waitFor({ timeout: WAIT + 3000 });
      const txt = await banner(p).innerText();
      R.check("I2", "Android, khách quay lại: hiện thẻ 'Cài PawNail lên điện thoại' + nút Cài app / Để sau", /Cài PawNail/.test(txt) && /Cài app/.test(txt) && /Để sau/.test(txt), txt);
      await p.screenshot({ path: `${process.env.TEMP || "."}/install_android.png` }).catch(() => {});
      await banner(p).getByRole("button", { name: /Cài app/ }).click();
      await p.waitForTimeout(500);
      const st = await p.evaluate(() => ({ prompted: window.__prompted, s: JSON.parse(localStorage.getItem("pn_install") || "{}") }));
      R.check("I3", "Bấm Cài app → mở hộp cài của Chrome, đã cài thì thôi hiện", st.prompted === 1 && st.s.installed === true && (await banner(p).count()) === 0, JSON.stringify(st));
      await p.reload();
      await fireBIP(p);
      await p.waitForTimeout(WAIT);
      R.check("I4", "Đã cài: không bao giờ hiện lại", (await banner(p).count()) === 0);
    })(),
    // ---- iPhone Safari ----
    (async () => {
      const p = await ctxFor(devices["iPhone 13"]);
      await p.goto(BASE_URL + "/");
      await returning(p);
      await p.reload();
      await banner(p).waitFor({ timeout: WAIT + 3000 });
      const txt = await banner(p).innerText();
      R.check("I5", "iPhone Safari: hướng dẫn 3 bước Chia sẻ → Thêm vào MH chính (không có nút cài giả)", /Chia sẻ/.test(txt) && /Thêm vào MH chính/.test(txt) && !/Cài app/.test(txt), txt);
      await p.screenshot({ path: `${process.env.TEMP || "."}/install_ios.png` }).catch(() => {});
      await banner(p).getByRole("button", { name: "Đóng" }).click();
      const s = await p.evaluate(() => JSON.parse(localStorage.getItem("pn_install") || "{}"));
      await p.reload();
      await p.waitForTimeout(WAIT);
      R.check("I6", "Bấm X → im 14 ngày", s.snoozeUntil > Date.now() + 13 * 86_400_000 && (await banner(p).count()) === 0);
    })(),
    // ---- Trong Zalo ----
    (async () => {
      const p = await ctxFor(devices["iPhone 13"], devices["iPhone 13"].userAgent + " Zalo iOS/500");
      await p.goto(BASE_URL + "/");
      await returning(p);
      await p.reload();
      await banner(p).waitFor({ timeout: WAIT + 3000 });
      R.check("I7", "Mở trong Zalo/Facebook: nhắc 'Mở bằng trình duyệt'", /Mở bằng trình duyệt/.test(await banner(p).innerText()));
    })(),
    // ---- Desktop + trang tin nhắn ----
    (async () => {
      const d = await ctxFor(devices["Desktop Chrome"]);
      await d.goto(BASE_URL + "/");
      await returning(d);
      await d.reload();
      await fireBIP(d);
      const m = await ctxFor(devices["Pixel 7"]);
      await m.goto(BASE_URL + "/auth/login");
      await returning(m);
      await m.reload();
      await fireBIP(m);
      await d.waitForTimeout(WAIT);
      R.check("I8", "Máy tính: không hiện; trang đăng nhập/tin nhắn: không chen ngang", (await banner(d).count()) === 0 && (await banner(m).count()) === 0);
    })(),
  ]);
  R.check("I9", "Không lỗi JS", errors.length === 0, errors.join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
