// Mục SANG TIỆM: API (đăng / lọc / quyền / đã sang / xoá / giới hạn) + bot gửi bài sang tiệm qua /api/jobs/sync
// + giao diện (danh sách, trang tin, form đăng, dải trên bảng Việc làm, trang Công cụ). Dữ liệu HƯ CẤU (555-01xx).
// CHỈ chạy với server local.   node scripts/qa/salon_sale_test.mjs
import { chromium, devices } from "playwright";
import { BASE_URL, Client, Results, registerUser } from "./lib.mjs";

const R = new Results("Sang tiệm nail");
const KEY = "test-ingest-key-0123456789abcdef";
const sync = (body) => fetch(BASE_URL + "/api/jobs/sync", { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${KEY}` }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
const t = String(Date.now()).slice(-4);
const phoneN = (n) => `(317) 555-01${String(n).padStart(2, "0")}`;
const errors = [];
let browser;

try {
  // ---------- API ----------
  const anon = new Client();
  const list0 = await anon.req("/api/salon-sales?market=US");
  R.check("S1", "GET /api/salon-sales công khai → 200 + danh sách", list0.status === 200 && Array.isArray(list0.data.sales), list0.status);

  const o = await registerUser({ name: "QA Sale Owner", role: "OWNER", state: "IN", city: "Indianapolis" });
  const tech = await registerUser({ name: "QA Sale Tech" });
  const o2 = await registerUser({ name: "QA Sale Owner 2", role: "OWNER" });
  for (const u of [o, tech, o2]) await u.client.login(u.body.email, u.body.password);
  const valid = { market: "US", state: "IN", city: "Indianapolis", title: `QA Sang tiệm 8 ghế ${t}`, description: "Tiệm khu Mỹ trắng, khách quen đông, hợp đồng thuê còn 4 năm. <script>alert(1)</script>", askingPrice: "120,000", monthlyRent: "1950", monthlyRevenue: "41000", chairs: "8", tables: "8", sqft: "1400", phone: "317 555 0120" };
  const unauth = await anon.req("/api/salon-sales", { method: "POST", json: valid });
  const asTech = await tech.client.req("/api/salon-sales", { method: "POST", json: valid });
  R.check("S2", "Chưa đăng nhập → 401; thợ → 403", unauth.status === 401 && asTech.status === 403, [unauth.status, asTech.status]);

  const bad = await Promise.all([
    o.client.req("/api/salon-sales", { method: "POST", json: { ...valid, phone: "0912345678" } }),
    o.client.req("/api/salon-sales", { method: "POST", json: { ...valid, state: "VIC" } }),
    o.client.req("/api/salon-sales", { method: "POST", json: { ...valid, description: "ngắn" } }),
    o.client.req("/api/salon-sales", { method: "POST", json: { ...valid, askingPrice: "-5" } }),
  ]);
  R.check("S3", "Dữ liệu sai (SĐT không phải số Mỹ / bang Úc cho tin Mỹ / mô tả quá ngắn / giá âm) → 400", bad.every((r) => r.status === 400), bad.map((r) => r.status));

  const c1 = await o.client.req("/api/salon-sales", { method: "POST", json: valid });
  const s1 = c1.data;
  R.check("S4", "Chủ tiệm đăng tin → 201: giá $120,000, thuê 1,950, doanh thu 41,000, 8 ghế, 8 bàn, 1,400 sqft, SĐT chuẩn hoá, bỏ thẻ <script>",
    c1.status === 201 && s1.askingPrice === 120000 && s1.monthlyRent === 1950 && s1.monthlyRevenue === 41000 && s1.chairs === 8 && s1.tables === 8 && s1.sqft === 1400 && s1.phone === "(317) 555-0120" && !/<script/i.test(s1.description) && s1.canManage === true && s1.seller?.id === o.client.userId,
    JSON.stringify(c1.data).slice(0, 300));

  const cheap = await o.client.req("/api/salon-sales", { method: "POST", json: { ...valid, title: `QA Tiệm nhỏ giá rẻ ${t}`, askingPrice: "45000", phone: "317 555 0121" } });
  const nego = await o.client.req("/api/salon-sales", { method: "POST", json: { ...valid, title: `QA Tiệm thương lượng ${t}`, askingPrice: "", phone: "317 555 0122" } });
  const inState = await anon.req("/api/salon-sales?market=US&state=IN");
  const under50 = await anon.req("/api/salon-sales?market=US&state=IN&maxPrice=50000");
  const byPrice = await anon.req("/api/salon-sales?market=US&state=IN&sort=price");
  const ids50 = under50.data.sales.map((s) => s.id);
  const prices = byPrice.data.sales.map((s) => s.askingPrice).filter((p) => p != null);
  R.check("S5", "Lọc bang IN có đủ 3 tin; 'dưới $50K' có tin $45K + tin thương lượng, KHÔNG có tin $120K; sắp giá thấp trước; đếm theo bang",
    cheap.status === 201 && nego.status === 201 && [s1.id, cheap.data.id, nego.data.id].every((id) => inState.data.sales.some((s) => s.id === id)) &&
      ids50.includes(cheap.data.id) && ids50.includes(nego.data.id) && !ids50.includes(s1.id) && prices.every((p, i) => i === 0 || prices[i - 1] <= p) && inState.data.states.some((x) => x.state === "IN" && x.n >= 3),
    JSON.stringify({ inState: inState.data.total, ids50: ids50.length, prices }));

  const pub = await anon.req(`/api/salon-sales/${s1.id}`);
  R.check("S6", "Trang tin công khai: không lộ khoá chống trùng / mã băm / email; người lạ không quản lý được",
    pub.status === 200 && pub.data.canManage === false && !/sourceKey|sourceFbHash|email|ownerId/.test(JSON.stringify(pub.data)), JSON.stringify(Object.keys(pub.data)));

  const other = await o2.client.req(`/api/salon-sales/${s1.id}`, { method: "PATCH", json: { action: "sold" } });
  const otherDel = await o2.client.req(`/api/salon-sales/${s1.id}`, { method: "DELETE" });
  const sold = await o.client.req(`/api/salon-sales/${cheap.data.id}`, { method: "PATCH", json: { action: "sold" } });
  const afterSold = await anon.req("/api/salon-sales?market=US&state=IN");
  const soldPage = await anon.req(`/api/salon-sales/${cheap.data.id}`);
  const relist = await o.client.req(`/api/salon-sales/${cheap.data.id}`, { method: "PATCH", json: { action: "relist" } });
  R.check("S7", "Chủ tiệm khác sửa / xoá → 403; chủ tin 'Đã sang' → rời danh sách nhưng trang tin vẫn mở (status sold); 'Đăng lại' → hiện lại",
    other.status === 403 && otherDel.status === 403 && sold.data.status === "sold" && !afterSold.data.sales.some((s) => s.id === cheap.data.id) && soldPage.data.status === "sold" && relist.data.status === "active",
    [other.status, otherDel.status, sold.data.status, soldPage.data.status, relist.data.status]);

  const fourth = await o.client.req("/api/salon-sales", { method: "POST", json: { ...valid, title: `QA Tin thứ 4 ${t}`, phone: "317 555 0123" } });
  R.check("S8", "Giới hạn chống rác: tin đang hiện thứ 4 → 429 SALE_LIMIT", fourth.status === 429 && fourth.data.code === "SALE_LIMIT", fourth.status);

  const del = await o.client.req(`/api/salon-sales/${nego.data.id}`, { method: "DELETE" });
  const gone = await anon.req(`/api/salon-sales/${nego.data.id}`);
  R.check("S9", "Xoá tin → trang tin 410, không còn trong danh sách", del.status === 200 && gone.status === 410, [del.status, gone.status]);

  // ---------- Bot: bài sang tiệm từ nhóm → mục Sang tiệm ----------
  const text = `Cần Thợ Nails/Mua Bán Tiệm Nail Tại Mỹ
SANG TIỆM NAIL QA ${t}
Do move đi bang khác, em muốn sang gấp tiệm nails đang hoạt động ổn định, khách quen nhiều
8ghế spa + 1 ghế em bé, 8 bàn làm tay
In Come: $500k/ năm
Rent: $1,950 / tháng
Giá sang: $120k
Liên hệ: 317-555-01${t.slice(-2)}`;
  const post = { content: text, salon_name: "Người đăng", phone: `317555${"01" + t.slice(-2)}`, post_url: `https://www.facebook.com/groups/1/posts/sale${t}`, salary: "$500" };
  const b1 = await sync(post);
  const b2 = await sync(post);
  const b3 = await sync({ ...post, content: text + "\nCòn để lại supply.", post_url: `https://www.facebook.com/groups/1/posts/sale${t}b` });
  const saleId = b1.data.sale_id;
  const saleGet = saleId ? await anon.req(`/api/salon-sales/${saleId}`) : { data: {} };
  const jobsIn = await anon.req("/api/jobs?market=US&state=IN&limit=100");
  const jobsArr = Array.isArray(jobsIn.data) ? jobsIn.data : jobsIn.data.jobs || [];
  R.check("S10", "Bot gửi bài SANG TIỆM → 201 created kind 'sale' (bot coi là thành công), vào mục Sang tiệm: IN, giá $120,000, thuê $1,950, 8 ghế, 8 bàn, nhãn từ nhóm, không có người bán để nhắn",
    b1.status === 201 && b1.data.status === "created" && b1.data.kind === "sale" && !!saleId && b1.data.job_id === null &&
      saleGet.data.state === "IN" && saleGet.data.askingPrice === 120000 && saleGet.data.monthlyRent === 1950 && saleGet.data.chairs === 8 && saleGet.data.tables === 8 && saleGet.data.fromGroup === true && saleGet.data.seller === null,
    JSON.stringify({ b1: b1.data, sale: { ...saleGet.data, description: undefined } }).slice(0, 500));
  R.check("S11", "Bài sang tiệm KHÔNG lên bảng Việc làm; gửi lại đúng bài → updated; bài mới cùng SĐT → bumped (repost 2)",
    !jobsArr.some((j) => /SANG TIỆM NAIL QA/.test(j.description || "")) && b2.data.status === "updated" && b2.data.sale_id === saleId && b3.data.status === "bumped" && b3.data.repost_count === 2,
    JSON.stringify([b2.data.status, b3.data.status, b3.data.repost_count]));
  const hire = await sync({ content: `Tiệm ở Indianapolis cần gấp 2 thợ bột, bao lương $1,000/tuần. Gọi 317-555-01${String((Number(t.slice(-2)) + 50) % 100).padStart(2, "0")}`, salon_name: "QA Hire" });
  R.check("S12", "Bài tuyển thợ qua bot vẫn là tin tuyển (kind 'job')", hire.data.kind === "job" && ["created", "bumped", "updated"].includes(hire.data.status), JSON.stringify(hire.data));

  // ---------- Giao diện ----------
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(BASE_URL + "/vi/salons-for-sale");
  await p.locator("[data-sale-card]").first().waitFor({ timeout: 20000 });
  const listUi = await p.evaluate(() => ({ cards: document.querySelectorAll("[data-sale-card]").length, h1: document.querySelector("h1")?.textContent, count: document.querySelector("[aria-live=polite]")?.textContent, over: [...document.querySelectorAll("[data-sale-card] *")].some((e) => e.getBoundingClientRect().right > innerWidth + 1) }));
  await p.locator("[data-sale-filter=state]").selectOption("IN");
  await p.waitForFunction(() => /tiệm đang sang/.test(document.querySelector("[aria-live=polite]")?.textContent || "") && document.querySelectorAll("[data-sale-card]").length > 0, null, { timeout: 15000 });
  const inCards = await p.locator("[data-sale-card]").count();
  R.check("U1", "Trang /vi/salons-for-sale: tiêu đề 'Sang tiệm nail', thẻ tin, đếm số tiệm, lọc bang Indiana chạy; không tràn ngang ở 412px",
    listUi.h1 === "Sang tiệm nail" && listUi.cards > 0 && /tiệm đang sang/.test(listUi.count || "") && !listUi.over && inCards >= 2, JSON.stringify({ ...listUi, inCards }));

  const html = await fetch(`${BASE_URL}/vi/salons-for-sale/${s1.id}`).then((r) => r.text());
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] || "";
  await p.goto(`${BASE_URL}/vi/salons-for-sale/${s1.id}`);
  await p.locator("[data-sale-facts]").waitFor({ timeout: 20000 });
  const det = await p.evaluate(() => ({ price: document.querySelector("[data-sale-price]")?.textContent, facts: document.querySelector("[data-sale-facts]")?.textContent, call: document.querySelector("[data-sale-call]")?.getAttribute("href"), msg: !!document.querySelector("[data-sale-message]") }));
  R.check("U2", "Trang tin: tiêu đề tab có nơi + giá (máy chủ dựng sẵn, chia sẻ được), giá $120,000, số liệu, nút Gọi tel:, nút Nhắn tin chủ tiệm",
    /Indianapolis/.test(title) && /\$120,000/.test(title) && det.price === "$120,000" && /Ghế spa/.test(det.facts || "") && /^tel:/.test(det.call || "") && /3175550120/.test((det.call || "").replace(/\D/g, "")) && det.msg,
    JSON.stringify({ title, ...det }));

  // Chủ tiệm đăng tin qua form
  const ctxO = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const po = await ctxO.newPage();
  po.on("pageerror", (e) => errors.push(e.message));
  await po.goto(BASE_URL + "/auth/login");
  await po.locator("#email").fill(o2.body.email);
  await po.locator("#password").fill(o2.body.password);
  await po.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await po.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
  await po.goto(BASE_URL + "/vi/salons-for-sale/new");
  await po.locator("[data-sale-form]").waitFor({ timeout: 20000 });
  await po.locator("#sale-city").fill("Houston");
  await po.locator("#sale-title").fill(`QA Form sang tiệm ${t}`);
  await po.locator("#sale-price").fill("88000");
  await po.locator("#sale-chairs").fill("6");
  await po.locator("#sale-desc").fill("Tiệm 6 ghế trong plaza đông khách, hợp đồng thuê còn 3 năm, để lại toàn bộ supply.");
  await po.locator("#sale-phone").fill("713 555 0124");
  await po.locator("[data-sale-submit]").click();
  await po.waitForURL(/\/salons-for-sale\/(?!new)[a-z0-9]+$/, { timeout: 30000 });
  await po.locator("[data-sale-manage]").waitFor({ timeout: 20000 });
  const formSale = await po.evaluate(() => ({ url: location.pathname, price: document.querySelector("[data-sale-price]")?.textContent, h1: document.querySelector("h1")?.textContent }));
  await po.locator("[data-sale-mark-sold]").click();
  await po.locator("[data-sale-sold]").waitFor({ timeout: 15000 });
  R.check("U3", "Chủ tiệm đăng qua form (Houston → tự chọn TX) → trang tin của mình có giá $88,000 + khối quản lý; bấm 'Đánh dấu đã sang' → báo đã sang",
    /^\/vi\/salons-for-sale\//.test(formSale.url) && formSale.price === "$88,000" && /QA Form sang tiệm/.test(formSale.h1 || ""), JSON.stringify(formSale));

  await po.goto(BASE_URL + "/vi/?tab=jobs");
  const strip = await po.locator("[data-sale-strip]").first().waitFor({ timeout: 20000 }).then(() => po.locator("[data-sale-strip]").first().innerText()).catch(() => "");
  await po.goto(BASE_URL + "/vi/tools");
  const tools = await po.getByText("Sang tiệm", { exact: true }).first().isVisible({ timeout: 15000 }).catch(() => false);
  R.check("U4", "Bảng Việc làm có dải 'N tiệm đang sang' (dẫn tới mục Sang tiệm); trang Công cụ có 'Sang tiệm'", /tiệm đang sang|Muốn sang tiệm/.test(strip) && tools, JSON.stringify({ strip, tools }));

  R.check("U5", "Không lỗi JS", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 300), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
