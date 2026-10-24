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
  await c.page.getByText(/Chào .*💅/).first().waitFor({ timeout: 20000 });
  await c.page.waitForTimeout(1500);
  const body = await c.page.locator("main").innerText();
  // Thẻ THỬ MẪU đầu trang: ảnh trước / sau thật (tải được), dẫn tới /tryon, nói rõ "soi tông da + dáng móng"
  const hero = c.page.getByTestId("tryon-hero");
  const heroOk = await hero.evaluate((a) => {
    const imgs = [...a.querySelectorAll("img")];
    return { href: a.getAttribute("href"), imgs: imgs.length, loaded: imgs.every((i) => i.complete && i.naturalWidth > 100), text: a.textContent || "" };
  }).catch(() => null);
  R.check("C13", "Trang chủ khách mở đầu bằng thẻ Thử mẫu: ảnh trước / sau thật (cả 2 tải được), \"Chụp tay — xem mẫu hợp với BẠN\", dẫn tới /tryon",
    !!heroOk && heroOk.href === "/tryon" && heroOk.imgs === 2 && heroOk.loaded && /Chụp tay/.test(heroOk.text) && /tông da/.test(heroOk.text), JSON.stringify(heroOk));
  const nav = await c.page.locator("nav").last().innerText().catch(() => "");
  const ov = await c.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  R.check("C5", "Trang chủ khách: lời chào, Mẫu trend / Tiệm gần bạn / Mẫu đã lưu, khối \"Tiệm & thợ quanh bạn\"; KHÔNG có Việc gấp / Thợ rảnh / tuyển thợ / Bảng tin nghề; không tràn ngang",
    /Mẫu trend/.test(body) && /Tiệm gần bạn/.test(body) && /Tiệm & thợ quanh bạn/.test(body) && !/Việc gấp|Thợ rảnh|tuyển thợ|Đăng tin|Bảng tin/i.test(body) && ov <= 1, JSON.stringify({ ov, sample: body.slice(0, 220) }));
  R.check("C6", "Thanh dưới của khách: Trang chủ · Mẫu nail · Tin nhắn · Tôi — không có Việc làm / Bảng tin", /Mẫu nail/.test(nav) && /Tôi/.test(nav) && !/Việc làm|Bảng tin|Tìm thợ/.test(nav), nav.replace(/\s+/g, " "));

  // Mẫu nail: khách thấy giá + tìm tiệm, KHÔNG thấy vật tư / các bước (thông tin nghề)
  const db = createClient({ url: "file:prisma/dev.db" });
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
  R.check("C8", "/salons: tiêu đề \"Tiệm & thợ nail quanh bạn\", thẻ thợ có dịch vụ + giá, nút \"Xem menu & đặt lịch\" / \"Nhắn hỏi mẫu\"", /Tiệm & thợ nail quanh bạn/.test(salonTxt) && /QA Gel-X khách test/.test(salonTxt2) && /\$55/.test(salonTxt2) && /Xem menu & đặt lịch/.test(salonTxt2) && /Nhắn hỏi mẫu/.test(salonTxt2), salonTxt2.slice(0, 200));

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

  // Đăng ký: thẻ "Bạn đi làm nail?" → form khách
  const g = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const gp = await g.newPage();
  await gp.goto(BASE_URL + "/auth/register");
  await gp.getByRole("button", { name: /Bạn đi làm nail/ }).click({ timeout: 20000 });
  const formOk = await gp.getByText("Tài khoản khách làm nail").first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  await gp.goto(BASE_URL + "/");
  const heroLink = await gp.getByRole("link", { name: /Bạn đi làm nail\? Xem mẫu & tìm tiệm/ }).count();
  R.check("C11", "Khách mới: trang đăng ký có thẻ \"Bạn đi làm nail? (khách)\" → form khách; trang chủ có lối \"Bạn đi làm nail? Xem mẫu & tìm tiệm\"", formOk && heroLink > 0, JSON.stringify({ formOk, heroLink }));

  R.check("C12", "Không có lỗi JavaScript", c.errors.length === 0 && o.errors.length === 0, [...c.errors, ...o.errors].join(" | "));
} finally {
  if (mk.data?.item?.id) await tech.req(`/api/menu/${mk.data.item.id}`, { method: "DELETE" });
  await createClient({ url: "file:prisma/dev.db" }).execute({ sql: `DELETE FROM "NailDesign" WHERE id = ?`, args: ["qa-client-look"] }).catch(() => {});
  await browser.close();
}
const s = R.summary();
process.exit(s.failed ? 1 : 0);
