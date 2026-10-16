// Menu mẫu nail cá nhân: API (quyền, kiểm tra ảnh, ẩn vật tư với khách, xếp thứ tự, lấy từ kho mẫu)
// + giao diện (khách xem → "Muốn làm mẫu này" → tin nhắn soạn sẵn; thợ tự thêm mẫu; QR; điện thoại).
// CHỈ chạy với server local.   node scripts/qa/menu_test.mjs
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_OWNER_2, SEED_TECH, Results, fakeIp } from "./lib.mjs";

if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error("menu_test chỉ chạy với server local");
const R = new Results("Menu mẫu nail");
const browser = await chromium.launch();
async function login(email, device = { viewport: { width: 1280, height: 860 } }) {
  const ctx = await browser.newContext({ ...device, locale: "vi-VN" });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  let me = null;
  if (email) {
    const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
    await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: DEMO_PASSWORD, json: "true" }, headers: h });
    me = (await (await ctx.request.get(BASE_URL + "/api/auth/session", { headers: h })).json()).user;
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, me, h, page, errors };
}
const tech = await login(SEED_TECH);
const owner = await login(SEED_OWNER);
const owner2 = await login(SEED_OWNER_2);
const guest = await login(null);
const api = (who, method, path, data) => who.ctx.request.fetch(BASE_URL + path, { method, headers: who.h, ...(data ? { data } : {}) });
const created = [];

// 1 mẫu PawNail đã duyệt trong DB LOCAL (để thử "Thêm từ kho mẫu") — xoá khi xong
const db = createClient({ url: "file:prisma/dev.db" });
await db.execute("PRAGMA busy_timeout = 10000");
const QA_DESIGN = "qa-menu-design";
const QA_IMG = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
await db.execute({ sql: `DELETE FROM "NailDesign" WHERE id = ?`, args: [QA_DESIGN] });
await db.execute({
  sql: `INSERT INTO "NailDesign" (id, day, market, title, titleEn, description, descriptionEn, skills, difficulty, minutes, priceHint, materials, steps, imageUrl, provider, prompt, status, publishedAt, createdAt)
        VALUES (?, '2026-10-16', 'US', 'QA Mắt mèo ánh bạc', 'QA Silver cat-eye', 'Mẫu thử', 'Test', 'Gel-X,Design', 2, 70, '$55–70', ?, '[]', ?, 'sample', 'qa', 'published', ?, ?)`,
  args: [QA_DESIGN, JSON.stringify([{ vi: "Gel mắt mèo", en: "Cat-eye gel", qty: "1 lọ" }, { vi: "Nam châm", en: "Magnet", qty: "1 cái" }]), QA_IMG, Date.now(), Date.now()],
});

// Ảnh hợp lệ: lấy ảnh mẫu PawNail (Cloudinary) có sẵn trong kho
const designs = (await (await api(guest, "GET", "/api/designs?limit=12")).json()).designs || [];
const cloudImg = designs.map((d) => d.imageUrl).find((u) => /^https:\/\/res\.cloudinary\.com\//.test(u || ""));

// ---------- API ----------
const unknown = await api(guest, "GET", "/api/menu?userId=khong-co-nguoi-nay");
const empty0 = await (await api(guest, "GET", `/api/menu?userId=${tech.me.id}`)).json();
R.check("M1", "Khách xem menu thợ → 200 (isOwner=false); id không tồn tại → 404", unknown.status() === 404 && empty0.isOwner === false && Array.isArray(empty0.items), `${unknown.status()} ${JSON.stringify(empty0).slice(0, 80)}`);
// dọn mẫu cũ của lần chạy trước
for (const it of (await (await api(tech, "GET", `/api/menu?userId=${tech.me.id}`)).json()).items || []) if (/^QA /.test(it.name) || it.sourceDesignId === QA_DESIGN) await api(tech, "DELETE", `/api/menu/${it.id}`);

const g401 = await api(guest, "POST", "/api/menu", { name: "QA x", priceFrom: 10 });
const evil = await api(tech, "POST", "/api/menu", { name: "QA ảnh lạ", priceFrom: 40, images: ["https://evil.example.com/track.jpg"] });
const short = await api(tech, "POST", "/api/menu", { name: "Q", priceFrom: 40 });
const noPrice = await api(tech, "POST", "/api/menu", { name: "QA không giá" });
R.check("M2", "Chưa đăng nhập → 401; ảnh ngoài PawNail / tên 1 ký tự / thiếu giá → 400", g401.status() === 401 && evil.status() === 400 && short.status() === 400 && noPrice.status() === 400, [g401.status(), evil.status(), short.status(), noPrice.status()].join(" "));

const mk = await api(tech, "POST", "/api/menu", {
  category: "HAND", name: "QA French tráng gương", technique: "Gel", priceFrom: 45, priceTo: 60, minutes: 60, durabilityWeeks: 3, difficulty: 2,
  description: "Hợp đi làm", images: cloudImg ? [cloudImg] : [], materials: [{ name: "Base gel", qty: "1 lớp", cost: 0.8 }, { name: "Bột chrome", qty: "1 hũ nhỏ", cost: 1.7 }, { name: "Top gel", qty: "", cost: null }],
});
const item1 = (await mk.json()).item;
if (item1) created.push(item1.id);
R.check("M3", "Thợ thêm mẫu → 201, tự tính chi phí vật tư $2.50 (bỏ dòng chưa có giá)", mk.status() === 201 && item1?.materialCost === 2.5 && item1.materials.length === 3, `${mk.status()} ${item1?.materialCost}`);

const pub = (await (await api(owner, "GET", `/api/menu?userId=${tech.me.id}`)).json()).items.find((i) => i.id === item1?.id);
const guestView = (await (await api(guest, "GET", `/api/menu?userId=${tech.me.id}`)).json()).items.find((i) => i.id === item1?.id);
R.check("M4", "Người khác xem → thấy mẫu + giá nhưng KHÔNG thấy vật tư / chi phí", pub && guestView && pub.materials === null && pub.materialCost === null && guestView.materials === null && pub.priceFrom === 45, JSON.stringify(pub).slice(0, 120));

const p403 = await api(owner2, "PATCH", `/api/menu/${item1?.id}`, { active: false });
const d403 = await api(owner2, "DELETE", `/api/menu/${item1?.id}`);
R.check("M5", "Người khác sửa / xoá mẫu của thợ → 403", p403.status() === 403 && d403.status() === 403, `${p403.status()} ${d403.status()}`);

const mk2 = await api(tech, "POST", "/api/menu", { category: "FOOT", name: "QA Chân gel đỏ", priceFrom: 35, minutes: 45 });
const item2 = (await mk2.json()).item;
if (item2) created.push(item2.id);
await api(tech, "PATCH", `/api/menu/${item2?.id}`, { active: false });
const guestItems = (await (await api(guest, "GET", `/api/menu?userId=${tech.me.id}`)).json()).items;
const ownItems = (await (await api(tech, "GET", `/api/menu?userId=${tech.me.id}`)).json()).items;
R.check("M6", "Ẩn mẫu → khách không thấy, chủ menu vẫn thấy (đánh dấu ẩn)", !guestItems.some((i) => i.id === item2?.id) && ownItems.some((i) => i.id === item2?.id && i.active === false), `${guestItems.length}/${ownItems.length}`);
await api(tech, "PATCH", `/api/menu/${item2?.id}`, { active: true });

const ids = ownItems.map((i) => i.id);
const rev = [...ids].reverse();
const ro = await api(tech, "POST", "/api/menu/reorder", { ids: rev });
const after = (await (await api(tech, "GET", `/api/menu?userId=${tech.me.id}`)).json()).items.map((i) => i.id);
const foreign = await api(owner2, "POST", "/api/menu/reorder", { ids: [item1?.id] });
R.check("M7", "Xếp lại thứ tự → lưu đúng; xếp mẫu của người khác → 403", ro.ok() && JSON.stringify(after) === JSON.stringify(rev) && foreign.status() === 403, `${ro.status()} ${foreign.status()}`);
await api(tech, "POST", "/api/menu/reorder", { ids });

const design = designs.find((d) => d.id === QA_DESIGN);
let fd1 = null, fd2 = null, fromItem = null;
if (design) {
  fd1 = await api(tech, "POST", "/api/menu/from-design", { designId: design.id });
  fromItem = (await fd1.json().catch(() => ({}))).item;
  if (fromItem) created.push(fromItem.id);
  fd2 = await api(tech, "POST", "/api/menu/from-design", { designId: design.id });
}
R.check("M8", "Thêm từ kho mẫu PawNail → 201 (copy tên, giá, ảnh, vật tư); thêm lần 2 → 409", design && fd1.status() === 201 && fd2.status() === 409 && fromItem?.sourceDesignId === design.id && fromItem.priceFrom === 55 && fromItem.priceTo === 70 && fromItem.images[0] === QA_IMG && fromItem.materials.length === 2, design ? `${fd1.status()} ${fd2.status()}` : "không có mẫu trong kho");

// ---------- Giao diện ----------
// Khách chưa đăng nhập: /menu/[uid] → thẻ thợ, mẫu, chi tiết, "Muốn làm mẫu này" → đăng nhập kèm callbackUrl
await guest.page.goto(BASE_URL + `/menu/${tech.me.id}`);
const card = guest.page.getByRole("button", { name: "QA French tráng gương" });
const shown = await card.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
const header = await guest.page.getByText(tech.me.name || "", { exact: false }).first().isVisible().catch(() => false);
const noCost = (await guest.page.getByText(/Vật tư|lời/).count()) === 0;
R.check("M9", "Trang /menu/[uid] (quét QR): thẻ thợ + mẫu + giá, không lộ vật tư/lời", shown && header && noCost && (await guest.page.getByText("$45–60").count()) >= 1, JSON.stringify({ shown, header, noCost }));
if (shown) await card.click();
const want = guest.page.getByRole("button", { name: "Muốn làm mẫu này" });
await want.click({ timeout: 8000 }).catch(() => {});
await guest.page.waitForURL(/\/auth\/login/, { timeout: 10000 }).catch(() => {});
const cb = new URL(guest.page.url()).searchParams.get("callbackUrl");
R.check("M10", "Khách chưa đăng nhập bấm \"Muốn làm mẫu này\" → trang đăng nhập, quay lại đúng tin nhắn", /\/auth\/login/.test(guest.page.url()) && cb === `/messages?to=${tech.me.id}`, guest.page.url());

// Đăng nhập với callbackUrl lạ (//evil) → không bị đưa ra ngoài
await guest.page.goto(BASE_URL + "/auth/login?callbackUrl=//evil.example.com");
await guest.page.getByLabel(/Email/i).first().fill(SEED_OWNER_2);
await guest.page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
await guest.page.locator('form button[type="submit"]').first().click();
await guest.page.waitForURL((u) => !/\/auth\/login/.test(u.toString()), { timeout: 15000 }).catch(() => {});
R.check("M11", "callbackUrl ngoài trang (//evil…) bị bỏ qua → về trang chủ PawNail", new URL(guest.page.url()).origin === new URL(BASE_URL).origin, guest.page.url());

// Chủ tiệm (đã đăng nhập) xem tab Menu của thợ → "Muốn làm mẫu này" → tin nhắn soạn sẵn tên mẫu + giá
await owner.page.goto(BASE_URL + `/profile/${tech.me.id}?tab=menu`);
const oCard = owner.page.getByRole("button", { name: "QA French tráng gương" });
const tabOk = await oCard.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
if (tabOk) {
  await oCard.click();
  await owner.page.getByRole("button", { name: "Muốn làm mẫu này" }).click();
}
await owner.page.waitForURL(/\/messages\?to=/, { timeout: 15000 }).catch(() => {});
await owner.page.waitForFunction(() => [...document.querySelectorAll("textarea, input")].some((e) => /QA French tráng gương/.test(e.value)), null, { timeout: 15000 }).catch(() => {});
const draft = await owner.page.evaluate(() => [...document.querySelectorAll("textarea, input")].map((e) => e.value).find((v) => /QA French/.test(v)) || "");
R.check("M12", "Hồ sơ ?tab=menu → bấm mẫu → \"Muốn làm mẫu này\" → mở chat với thợ, ô nhập đã soạn sẵn tên mẫu + giá", tabOk && /QA French tráng gương/.test(draft) && /\$45–60/.test(draft), `${tabOk} "${draft.slice(0, 90)}"`);

// Thợ tự thêm mẫu qua giao diện (không ảnh), vật tư → thấy chi phí + lời ngay
await tech.page.goto(BASE_URL + `/profile/${tech.me.id}?tab=menu`);
await tech.page.getByRole("button", { name: "Thêm mẫu" }).first().click({ timeout: 20000 });
const dlg = tech.page.getByRole("dialog", { name: "Thêm mẫu vào menu" });
await dlg.waitFor({ timeout: 5000 });
await dlg.getByRole("button", { name: "Móng chân" }).click();
await dlg.getByPlaceholder(/French tráng gương ngắn/).fill("QA Pedi thạch");
await dlg.getByRole("button", { name: "Gel", exact: true }).click();
await dlg.getByPlaceholder("45").fill("38");
await dlg.getByLabel("Tên vật tư").first().fill("Gel màu");
await dlg.getByLabel("Chi phí").first().fill("1.2");
const liveCost = await dlg.getByText(/Chi phí vật tư/).textContent().catch(() => "");
await dlg.getByRole("button", { name: "Lưu" }).click();
const newCard = tech.page.getByRole("button", { name: "QA Pedi thạch" });
const added = await newCard.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
const cardCost = added ? await tech.page.locator("article", { has: newCard }).getByText(/Vật tư \$1\.20/).count() : 0;
R.check("M13", "Thợ bấm \"Thêm mẫu\" → điền nhóm, kỹ thuật, giá, vật tư → thấy chi phí + lời ngay → lưu hiện thẻ", added && /\$1\.20/.test(liveCost || "") && cardCost === 1, JSON.stringify({ added, liveCost, cardCost }));
for (const it of (await (await api(tech, "GET", `/api/menu?userId=${tech.me.id}`)).json()).items) if (it.name === "QA Pedi thạch") created.push(it.id);

// QR menu
await tech.page.getByRole("button", { name: "QR" }).click();
const qr = tech.page.getByRole("dialog", { name: "Mã QR menu" });
const qrOk = await qr.getByRole("img", { name: "Mã QR menu" }).waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
const qrUrl = await qr.textContent().catch(() => "");
R.check("M14", "Nút QR → mã QR trỏ tới /menu/<thợ> + nút tải ảnh", qrOk && qrUrl.includes(`/menu/${tech.me.id}`), qrUrl.slice(0, 120));
await qr.getByRole("button", { name: "Đóng" }).click();

// Kho mẫu: thợ thấy "Thêm vào menu của tôi"; khách không thấy
if (design) {
  await tech.page.goto(BASE_URL + "/designs");
  await tech.page.locator("button").filter({ has: tech.page.locator("img") }).first().click({ timeout: 20000 }).catch(() => {});
  const techBtn = await tech.page.getByRole("button", { name: "Thêm vào menu của tôi" }).waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  const g2 = await login(null);
  await g2.page.goto(BASE_URL + "/designs");
  await g2.page.locator("button").filter({ has: g2.page.locator("img") }).first().click({ timeout: 20000 }).catch(() => {});
  await g2.page.getByRole("dialog").first().waitFor({ timeout: 8000 }).catch(() => {});
  const guestBtn = await g2.page.getByRole("button", { name: "Thêm vào menu của tôi" }).count();
  R.check("M15", "Chi tiết mẫu trong kho: thợ có nút \"Thêm vào menu của tôi\", khách thì không", techBtn && guestBtn === 0, JSON.stringify({ techBtn, guestBtn }));
  await g2.ctx.close();
}

// Điện thoại: không tràn ngang, tab hồ sơ cuộn được, chi tiết mẫu vừa màn hình
const phone = await login(null, devices["iPhone 13"]);
await phone.page.goto(BASE_URL + `/menu/${tech.me.id}`);
await phone.page.getByRole("button", { name: "QA French tráng gương" }).waitFor({ timeout: 20000 }).catch(() => {});
const ov1 = await phone.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
// Tiệm CÓ menu → 5 tab (không tràn ngang); tiệm CHƯA có mẫu → khách không thấy tab Menu, chủ tiệm vẫn thấy
const ownerItem = (await (await api(owner, "POST", "/api/menu", { name: "QA Menu tiệm", priceFrom: 30 })).json()).item?.id;
if (ownerItem) created.push(ownerItem);
const tabsNav = () => phone.page.getByRole("navigation", { name: "Mục hồ sơ" });
await phone.page.goto(BASE_URL + `/profile/${owner.me.id}`);
await tabsNav().getByRole("button", { name: /Menu/ }).waitFor({ timeout: 20000 }).catch(() => {});
const ov2 = await phone.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const menuTab = await tabsNav().getByRole("button", { name: /Menu/ }).isVisible().catch(() => false);
for (const it of (await (await api(owner2, "GET", `/api/menu?userId=${owner2.me.id}`)).json()).items || []) await api(owner2, "DELETE", `/api/menu/${it.id}`);
await phone.page.goto(BASE_URL + `/profile/${owner2.me.id}?tab=menu`);
await tabsNav().waitFor({ timeout: 20000 }).catch(() => {});
await phone.page.waitForTimeout(1500);
const hiddenForGuest = (await tabsNav().getByRole("button", { name: /Menu/ }).count()) === 0;
const backToOverview = (await tabsNav().getByRole("button", { name: /Tổng quan/ }).getAttribute("aria-current").catch(() => null)) === "page";
await owner2.page.goto(BASE_URL + `/profile/${owner2.me.id}`);
const selfSees = await owner2.page.getByRole("navigation", { name: "Mục hồ sơ" }).getByRole("button", { name: /Menu/ }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
R.check("M16", "Điện thoại: /menu + hồ sơ tiệm 5 tab không tràn ngang; tiệm chưa có mẫu → khách không thấy tab Menu (link ?tab=menu về Tổng quan), chủ tiệm vẫn thấy để tạo",
  ov1 <= 1 && ov2 <= 1 && menuTab && hiddenForGuest && backToOverview && selfSees, JSON.stringify({ ov1, ov2, menuTab, hiddenForGuest, backToOverview, selfSees }));

const errs = [...tech.errors, ...owner.errors, ...guest.errors, ...phone.errors];
R.check("M17", "Không có lỗi JavaScript trên các trang menu", errs.length === 0, errs.join(" | "));

// Dọn dữ liệu QA (chỉ mẫu do test tạo)
for (const id of new Set(created)) if ((await api(tech, "DELETE", `/api/menu/${id}`)).status() === 403) await api(owner, "DELETE", `/api/menu/${id}`);
await db.execute({ sql: `DELETE FROM "NailDesign" WHERE id = ?`, args: [QA_DESIGN] });
await browser.close();
const s = R.summary();
process.exit(s.failed ? 1 : 0);
