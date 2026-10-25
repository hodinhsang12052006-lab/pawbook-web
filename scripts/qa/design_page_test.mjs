// TRANG RIÊNG TỪNG MẪU NAIL (/designs/[id]): link chia sẻ có ảnh xem trước, Google đọc được (HowTo: vật tư + các
// bước), mẫu liên quan, nút chia sẻ / lưu, sitemap; mẫu nháp / không có → 404. CHỈ chạy với server local.
//   node scripts/qa/design_page_test.mjs
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Client, Results, registerUser } from "./lib.mjs";

const R = new Results("Trang riêng mẫu nail");
const db = createClient({ url: "file:prisma/dev.db" });
const IMG = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
let browser;

try {
  // bảo đảm có ≥ 3 mẫu đã đăng có ảnh (cron local tạo mẫu; giả lập ảnh đã vẽ)
  let list = (await fetch(BASE_URL + "/api/designs?limit=12").then((r) => r.json())).designs;
  if (list.length < 3) {
    const c = await fetch(BASE_URL + "/api/cron/designs?count=3", { headers: { authorization: "Bearer test-cron" } }).then((r) => r.json());
    const ids = c.created || [];
    if (ids.length) await db.execute(`UPDATE "NailDesign" SET imageUrl = '${IMG}', status = 'published', publishedAt = COALESCE(publishedAt, CURRENT_TIMESTAMP) WHERE imageUrl IS NULL AND id IN (${ids.map(() => "?").join(",")})`, ids);
    list = (await fetch(BASE_URL + "/api/designs?limit=12").then((r) => r.json())).designs;
  }
  const d = list[0];
  const res = await fetch(`${BASE_URL}/designs/${d.id}`);
  const html = await res.text();
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).find((x) => x?.["@type"] === "HowTo");
  const og = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? "";
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "";
  const h1 = /<h1[^>]*>[^<]*<\/h1>/.test(html) && html.includes(d.title.replace(/&/g, "&amp;").slice(0, 12));
  R.check("P1", "Trang mẫu dựng sẵn phía máy chủ: 200, tiêu đề H1 tên mẫu, ảnh xem trước khi chia sẻ (og:image), link chuẩn (canonical)",
    res.status === 200 && h1 && (/cloudinary/.test(og) || og.startsWith("data:image/")) && canon.endsWith(`/designs/${d.id}`), JSON.stringify({ status: res.status, h1, og: og.slice(0, 60), canon }));
  R.check("P2", `Google đọc được cách làm (HowTo): ${ld?.step?.length ?? 0} bước, ${ld?.supply?.length ?? 0} vật tư, thời gian ${ld?.totalTime}, bản tiếng Anh`,
    !!ld && ld.step.length === d.steps.length && ld.supply.length === d.materials.length && ld.totalTime === `PT${d.minutes}M` && ld.name === (d.titleEn || d.title), JSON.stringify(ld ?? {}).slice(0, 200));

  const nf = await fetch(`${BASE_URL}/designs/khong-co-mau-nay`);
  const draft = list[1];
  await db.execute({ sql: `UPDATE "NailDesign" SET status = 'draft' WHERE id = ?`, args: [draft.id] });
  const dr = await fetch(`${BASE_URL}/designs/${draft.id}`);
  await db.execute({ sql: `UPDATE "NailDesign" SET status = 'published' WHERE id = ?`, args: [draft.id] });
  R.check("P3", "Mẫu không có / mẫu NHÁP (chưa đăng) → 404, không lộ ra ngoài", nf.status === 404 && dr.status === 404, JSON.stringify({ nf: nf.status, draft: dr.status }));

  const sm = await fetch(BASE_URL + "/sitemap.xml").then((r) => r.text());
  R.check("P4", "Sitemap khai các trang mẫu đã đăng (Google tìm thấy mẫu mới mỗi ngày)", sm.includes(`/designs/${d.id}`) && !sm.includes(`/designs/khong`));

  // lưu mẫu: khách lạ đọc được tổng lượt lưu; người đăng nhập lưu → trang biết "đã lưu"
  const anon = await new Client().req(`/api/designs/${d.id}/save`);
  const u = await registerUser({ name: "QA Design Page" });
  await u.client.login(u.body.email, u.body.password);
  const s1 = await u.client.req(`/api/designs/${d.id}/save`, { method: "POST" });
  const s2 = await u.client.req(`/api/designs/${d.id}/save`);
  await u.client.req(`/api/designs/${d.id}/save`, { method: "POST" }); // bỏ lưu lại cho sạch
  R.check("P5", "Trạng thái lưu mẫu: khách lạ → chưa lưu; thợ bấm Lưu → trang đọc lại thấy ĐÃ LƯU", anon.status === 200 && anon.data.saved === false && s1.data.saved === true && s2.data.saved === true && s2.data.saves >= 1, JSON.stringify({ anon: anon.data, s1: s1.data, s2: s2.data }));

  // giao diện thật trên iPhone: không lỗi, không tràn ngang, có mẫu liên quan, chia sẻ chép link
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 120)); });
  await page.goto(`${BASE_URL}/designs/${d.id}`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const rel = await page.locator('a[href^="/designs/"]').count();
  await page.evaluate(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });
  await page.getByTestId("design-share").click();
  await page.waitForTimeout(500);
  const toastShown = await page.getByText(/Đã chép link mẫu|Link copied/).isVisible().catch(() => false);
  R.check("P6", `Trên iPhone: không lỗi trang (${errs.length}), không tràn ngang (${overflow}px), ${rel} link sang mẫu khác, nút "Chia sẻ mẫu" chép link`,
    errs.length === 0 && overflow <= 1 && rel >= 2 && toastShown, JSON.stringify({ errs: errs.slice(0, 3), overflow, rel, toastShown }));

  // từ lưới /designs: mở mẫu → có nút "Mở trang mẫu" dẫn tới trang riêng
  await page.goto(`${BASE_URL}/designs`, { waitUntil: "networkidle" });
  await page.locator("main button.group").first().click();
  const href = await page.getByTestId("design-open-page").getAttribute("href").catch(() => null);
  R.check("P7", "Bảng chi tiết trong /designs có nút \"Mở trang mẫu\" → /designs/[id] (link chia sẻ được)", !!href && /^\/designs\/[\w-]+$/.test(href), String(href));

  // Xu hướng mẫu nail (radar có nguồn) trên /trends: mẫu PawNail làm theo trend → dẫn sang trang riêng mẫu
  const radarDesign = list[2];
  await db.execute({ sql: `UPDATE "NailDesign" SET description = ?, descriptionEn = ? WHERE id = ?`, args: ["Trend đang được ưa chuộng · Mắt mèo chấm bi (Pinterest Predicts 2026: tìm kiếm \"polka dot cat eye nails\" +1.585%): QA.", "Trending now · Polka dot cat eye (Pinterest Predicts 2026: \"polka dot cat eye nails\" +1,585%): QA.", radarDesign.id] });
  const radar = await fetch(BASE_URL + "/api/trends/nail-radar").then((r) => r.json());
  const polka = radar.trends.find((t) => t.designs.some((x) => x.id === radarDesign.id));
  await page.goto(`${BASE_URL}/trends`, { waitUntil: "networkidle" });
  const sec = page.getByTestId("nail-trend-radar");
  const secLink = await sec.locator(`a[href="/designs/${radarDesign.id}"]`).count().catch(() => 0);
  R.check("P8", `Trang Xu hướng có mục "Xu hướng mẫu nail đang lên": ${radar.trends.length} trend có nguồn (Pinterest…), trend "${polka?.name?.vi}" kèm mẫu PawNail làm theo → link sang trang mẫu`,
    radar.trends.length >= 8 && radar.trends.every((t) => t.source?.vi && t.name?.en) && !!polka && secLink === 1, JSON.stringify({ n: radar.trends.length, polka: !!polka, secLink }));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
