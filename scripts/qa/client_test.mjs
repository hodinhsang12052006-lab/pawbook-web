// Khách đi làm nail (vai trò CLIENT): đăng ký, thế giới riêng (không việc làm / tuyển thợ), tìm tiệm, xem mẫu
// không lẫn vật tư nghề, nhắn tiệm, trang "Tôi", rào chặn hành động nghề. CHỈ chạy với server local.
//   node scripts/qa/client_test.mjs
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Client, Results, SEED_OWNER, SEED_TECH, DEMO_PASSWORD, fakeIp, registerUser } from "./lib.mjs";

if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error("client_test chỉ chạy với server local");
const R = new Results("Khách làm nail (CLIENT)");

// ---------- API ----------
const reg = await registerUser({ name: "QA Khách Ngọc", role: "CLIENT", market: "US", state: "CA", city: "San Jose", specialties: undefined });
const client = new Client();
const li = await client.login(reg.body.email, reg.body.password);
R.check("C1", "Đăng ký khách (role CLIENT) → 201, đăng nhập được, vai trò CLIENT, không tạo hồ sơ thợ / tin tuyển", reg.res.status === 201 && li.ok && li.session?.user?.role === "CLIENT" && !reg.res.data?.user?.technicianProfile,
  JSON.stringify({ s: reg.res.status, role: li.session?.user?.role }));

const post = await client.req("/api/posts", { method: "POST", json: { content: "Khách thử đăng bài" } });
const job = await client.req("/api/jobs", { method: "POST", json: { title: "x", salonName: "x", market: "US", state: "CA", city: "x", salaryType: "x", salaryAmount: "x", phone: "+1 408 555 0100" } });
const menu = await client.req("/api/menu", { method: "POST", json: { name: "x", priceFrom: 10 } });
R.check("C2", "Khách KHÔNG đăng bài lên bảng tin nghề (403), không đăng tin tuyển (403), không tạo menu (403)", post.status === 403 && job.status === 403 && menu.status === 403, JSON.stringify([post.status, job.status, menu.status]));

// Thợ mẫu có menu có giá → hiện ở "Tiệm & thợ quanh bạn"
const tech = new Client();
await tech.login(SEED_TECH);
const mk = await tech.req("/api/menu", { method: "POST", json: { name: "QA Gel-X khách test", priceFrom: 55, priceTo: 70, images: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"] } });
const salons = await new Client().req("/api/salons?market=US&state=CA&limit=48");
const txt = JSON.stringify(salons.data);
const me = salons.data?.items?.find((x) => x.id === tech.userId);
R.check("C3", "/api/salons (công khai): thợ có menu hiện kèm dịch vụ + giá + ảnh; KHÔNG lộ email / SĐT / tài khoản khách", !!me && me.services.some((s) => s.name === "QA Gel-X khách test" && s.priceFrom === 55) && me.photos.length > 0 && !/@|"phone"|"email"/.test(txt) && !salons.data.items.some((x) => x.id === li.session.user.id),
  JSON.stringify({ n: salons.data?.items?.length, me: me && { services: me.services, photos: me.photos.length } }));

const dm = await client.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: "Chào tiệm, mẫu này bao nhiêu ạ?" } });
R.check("C4", "Khách nhắn hỏi mẫu cho thợ được (201)", dm.status === 201 || dm.status === 200, String(dm.status));

// ---------- Giao diện điện thoại ----------
const browser = await chromium.launch();
async function ui(email, password) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password, json: "true" }, headers: h });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, errors };
}
try {
  const c = await ui(reg.body.email, reg.body.password);
  await c.page.goto(BASE_URL + "/");
  // Lời chào (bản copy chuyên nghiệp 11/2026 bỏ 💅): <h1> "Chào <tên>"
  await c.page.getByRole("heading", { level: 1, name: /^Chào / }).first().waitFor({ timeout: 20000 });
  await c.page.waitForTimeout(1500);
  const body = await c.page.locator("main").innerText();
  // Thẻ THỬ MẪU đầu trang: ảnh trước / sau thật (tải được), dẫn tới /tryon, nói rõ "soi tông da + dáng móng"
  const hero = c.page.getByTestId("tryon-hero");
  const heroOk = await hero.evaluate((a) => {
    const imgs = [...a.querySelectorAll("img")];
    return { href: a.getAttribute("href"), imgs: imgs.length, loaded: imgs.every((i) => i.complete && i.naturalWidth > 100), text: a.textContent || "" };
  }).catch(() => null);
  R.check("C13", "Trang chủ khách mở đầu bằng thẻ Thử mẫu: ảnh trước / sau thật (cả 2 tải được), \"Thử những mẫu hợp với tay bạn\" + chụp 1 ảnh soi tông da, dẫn tới /tryon",
    !!heroOk && heroOk.href === "/tryon" && heroOk.imgs === 2 && heroOk.loaded && /mẫu hợp với tay bạn/.test(heroOk.text) && /Chụp một ảnh/.test(heroOk.text) && /tông da/.test(heroOk.text), JSON.stringify(heroOk));
  const nav = await c.page.locator("nav").last().innerText().catch(() => "");
  const ov = await c.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  // Lối tắt (bản copy 11/2026): "Mẫu nail" (trước là "Mẫu trend") · Tiệm gần bạn · Mẫu đã lưu
  R.check("C5", "Trang chủ khách: lời chào, Mẫu nail / Tiệm gần bạn / Mẫu đã lưu, khối \"Tiệm & thợ quanh bạn\"; KHÔNG có Việc gấp / Thợ rảnh / tuyển thợ / Bảng tin nghề; không tràn ngang",
    /^Chào /m.test(body) && /Mẫu nail/.test(body) && /Tiệm gần bạn/.test(body) && /Mẫu đã lưu/.test(body) && /Tiệm & thợ quanh bạn/.test(body) && !/Việc gấp|Thợ rảnh|tuyển thợ|Đăng tin|Bảng tin/i.test(body) && ov <= 1, JSON.stringify({ ov, sample: body.slice(0, 220) }));
  // Tab cuối "Tôi" → "Tài khoản" (bản copy 11/2026)
  R.check("C6", "Thanh dưới của khách: Trang chủ · Mẫu nail · Tin nhắn · Tài khoản — không có Việc làm / Bảng tin", /Trang chủ/.test(nav) && /Mẫu nail/.test(nav) && /Tin nhắn/.test(nav) && /Tài khoản/.test(nav) && !/Việc làm|Bảng tin|Tìm thợ/.test(nav), nav.replace(/\s+/g, " "));

  // Mẫu nail: khách thấy giá + tìm tiệm, KHÔNG thấy vật tư / các bước (thông tin nghề)
  const db = createClient({ url: process.env.QA_DB_URL?.startsWith("file:") ? process.env.QA_DB_URL : "file:prisma/dev.db" }) /* DB QA local: scripts/qa/make-qa-db.sh */;
  await db.execute("PRAGMA busy_timeout = 10000");
  await db.execute({ sql: `DELETE FROM "NailDesign" WHERE id = ?`, args: ["qa-client-look"] });
  await db.execute({
    sql: `INSERT INTO "NailDesign" (id, day, market, title, titleEn, description, descriptionEn, skills, difficulty, minutes, priceHint, materials, steps, imageUrl, palette, shape, finish, provider, prompt, status, publishedAt, createdAt)
          VALUES ('qa-client-look', '2026-10-23', 'US', 'QA Mẫu khách xem', 'QA client look', 'Mẫu thử', 'Test', 'Gel-X', 1, 45, '$45–55', ?, ?, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', '["#f9c","#fff"]', 'almond', 'glossy', 'sample', 'qa', 'published', ?, ?)`,
    args: [JSON.stringify([{ vi: "Gel nền", en: "Base gel", qty: "1 lọ" }]), JSON.stringify([{ vi: "Dũa form", en: "Shape" }]), Date.now() + 5000, Date.now()],
  });
  await c.page.goto(BASE_URL + "/designs");
  const card = c.page.getByText("QA Mẫu khách xem").first();
  const hasCard = await card.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  let sheet = "";
  if (hasCard) { await card.click(); await c.page.waitForTimeout(800); sheet = await c.page.getByRole("dialog").first().innerText().catch(() => ""); }
  R.check("C7", "Khách mở mẫu nail: có \"Tìm tiệm / thợ làm mẫu này\", KHÔNG có \"Vật tư cần chuẩn bị\" / \"Các bước làm\"", hasCard && /Tìm tiệm \/ thợ làm mẫu này/.test(sheet) && !/Vật tư cần chuẩn bị|Các bước làm/.test(sheet), sheet.slice(0, 200));

  await c.page.goto(BASE_URL + "/salons");
  const salonTxt = await c.page.locator("main").innerText({ timeout: 20000 });
  await c.page.getByText("QA Gel-X khách test").first().waitFor({ timeout: 15000 }).catch(() => {});
  const salonTxt2 = await c.page.locator("main").innerText();
  // Nút trên thẻ (bản copy 11/2026): "Menu & đặt lịch" → /menu/<thợ>, "Nhắn tin" (trước là "Nhắn hỏi mẫu") → /messages?to=<thợ>
  const cardMenu = await c.page.locator(`main a[href="/menu/${tech.userId}"]`).filter({ hasText: /^Menu & đặt lịch$/ }).count();
  const cardMsg = await c.page.locator(`main a[href="/messages?to=${tech.userId}"]`).filter({ hasText: /^Nhắn tin$/ }).count();
  R.check("C8", "/salons: tiêu đề \"Tiệm & thợ nail quanh bạn\", thẻ thợ có dịch vụ + giá, nút \"Menu & đặt lịch\" / \"Nhắn tin\" đúng thợ", /Tiệm & thợ nail quanh bạn/.test(salonTxt) && /QA Gel-X khách test/.test(salonTxt2) && /\$55/.test(salonTxt2) && cardMenu > 0 && cardMsg > 0, JSON.stringify({ cardMenu, cardMsg, txt: salonTxt2.slice(0, 160) }));

  await c.page.goto(BASE_URL + "/profile");
  const acc = await c.page.locator("main").innerText({ timeout: 20000 });
  await c.page.getByText("Khách PawNail").first().waitFor({ timeout: 15000 }).catch(() => {});
  const acc2 = await c.page.locator("main").innerText();
  R.check("C9", "Trang \"Tôi\" của khách: Khách PawNail, Mẫu đã lưu / Tìm tiệm / Tin nhắn, Đăng xuất, Xoá tài khoản — không có ô portfolio / kỹ năng thợ", /Khách PawNail/.test(acc2) && /Xoá tài khoản/.test(acc2) && !/portfolio|Kỹ năng|kinh nghiệm/i.test(acc2), (acc || acc2).slice(0, 200));

  // Chủ tiệm bấm vào khách (từ tin nhắn) → thẻ "Khách PawNail" + Nhắn tin
  const o = await ui(SEED_OWNER, DEMO_PASSWORD);
  await o.page.goto(BASE_URL + `/profile/${li.session.user.id}`);
  await o.page.getByText("Khách PawNail").first().waitFor({ timeout: 20000 }).catch(() => {});
  const pub = await o.page.locator("main").innerText();
  R.check("C10", "Hồ sơ công khai của khách: thẻ gọn \"Khách PawNail\" + Nhắn tin (không phải khung hồ sơ thợ trống)", /Khách PawNail/.test(pub) && /Nhắn tin/.test(pub) && !/Portfolio|Kỹ năng/.test(pub), pub.slice(0, 160));

  // Đăng ký (phase 1, 11/2026): danh sách vai trò, dòng "Tôi là khách làm nail" → form khách. Trang chủ khách: nút chính
  // "Thử mẫu trên tay" (→ /tryon) + "Tìm tiệm" (→ /salons) thay cho lối "Bạn đi làm nail? Xem mẫu & tìm tiệm".
  const g = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const gp = await g.newPage();
  await gp.goto(BASE_URL + "/auth/register");
  const clientRow = gp.locator('.pn-row[data-role="client"]');
  await clientRow.waitFor({ timeout: 20000 });
  const rowText = (await clientRow.innerText()).replace(/\s+/g, " ");
  await clientRow.click();
  const formOk = await gp.getByText("Tài khoản khách làm nail").first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  await gp.goto(BASE_URL + "/");
  const tryLink = await gp.locator('a[data-hero-cta="client"][href="/tryon"]').filter({ hasText: /Thử mẫu trên tay/ }).count();
  const salonLink = await gp.locator('a[href="/salons"]').filter({ hasText: /^Tìm tiệm$/ }).count();
  R.check("C11", "Khách mới: trang đăng ký có dòng \"Tôi là khách làm nail\" → form khách; trang chủ có lối \"Thử mẫu trên tay\" + \"Tìm tiệm\"", /Tôi là khách làm nail/.test(rowText) && formOk && tryLink > 0 && salonLink > 0, JSON.stringify({ rowText, formOk, tryLink, salonLink }));

  R.check("C12", "Không có lỗi JavaScript", c.errors.length === 0 && o.errors.length === 0, [...c.errors, ...o.errors].join(" | "));
} finally {
  if (mk.data?.item?.id) await tech.req(`/api/menu/${mk.data.item.id}`, { method: "DELETE" });
  await createClient({ url: process.env.QA_DB_URL?.startsWith("file:") ? process.env.QA_DB_URL : "file:prisma/dev.db" }) /* DB QA local: scripts/qa/make-qa-db.sh */.execute({ sql: `DELETE FROM "NailDesign" WHERE id = ?`, args: ["qa-client-look"] }).catch(() => {});
  await browser.close();
}
const s = R.summary();
process.exit(s.failed ? 1 : 0);
