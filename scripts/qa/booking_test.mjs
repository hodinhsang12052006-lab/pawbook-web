// Đặt lịch không cần tài khoản: khách gửi từ menu (QR / link) → thợ nhận, gọi / nhắn SMS soạn sẵn,
// xác nhận giờ, đánh dấu đã làm. API (kiểm tra, chống spam, quyền) + giao diện điện thoại 2 phía.
// CHỈ chạy với server local (bash scripts/qa/start-launch-server.sh).   node scripts/qa/booking_test.mjs
import { createClient } from "@libsql/client";
import { chromium, devices } from "playwright";
import { BASE_URL, DEMO_PASSWORD, SEED_OWNER, SEED_TECH, Results, fakeIp } from "./lib.mjs";

if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error("booking_test chỉ chạy với server local");
const R = new Results("Đặt lịch");
const db = createClient({ url: "file:prisma/dev.db" });
await db.execute("PRAGMA busy_timeout = 10000");
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
const tech = await login(SEED_TECH, devices["iPhone 13"]);
const owner = await login(SEED_OWNER);
const api = (who, method, path, data) => who.ctx.request.fetch(BASE_URL + path, { method, headers: who.h, ...(data ? { data } : {}) });
// Khách KHÔNG tài khoản: request không cookie, mỗi nhóm 1 IP
const book = (data, ip = fakeIp()) => fetch(BASE_URL + "/api/bookings", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(data) });
const rowsFor = async (techId) => (await db.execute({ sql: `SELECT * FROM "BookingRequest" WHERE techId = ? ORDER BY createdAt`, args: [techId] })).rows;
await db.execute({ sql: `DELETE FROM "BookingRequest" WHERE techId IN (?, ?)`, args: [tech.me.id, owner.me.id] });

// Menu của thợ: 1 mẫu đang hiện + 1 mẫu ẩn; 1 mẫu của tiệm khác
for (const it of (await (await api(tech, "GET", `/api/menu?userId=${tech.me.id}`)).json()).items || []) if (/^QA /.test(it.name)) await api(tech, "DELETE", `/api/menu/${it.id}`);
const mk = async (who, data) => (await (await api(who, "POST", "/api/menu", data)).json()).item?.id;
const itemId = await mk(tech, { name: "QA Mắt mèo bạc", priceFrom: 45, priceTo: 60 });
const hiddenId = await mk(tech, { name: "QA Đang ẩn", priceFrom: 30, active: false });
const otherId = await mk(owner, { name: "QA Mẫu tiệm khác", priceFrom: 40 });
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

// ---------- API ----------
const e1 = await book({ techId: tech.me.id, name: "A", phone: "2145550123" });
const e2 = await book({ techId: tech.me.id, name: "Lan", phone: "12345" });
const e3 = await book({ techId: tech.me.id, name: "Lan", phone: "2145550123", date: "2030-01-01" });
const e4 = await book({ techId: "khong-co", name: "Lan", phone: "2145550123" });
const e5 = await book({ techId: tech.me.id, menuItemId: otherId, name: "Lan", phone: "2145550123" });
const e6 = await book({ techId: tech.me.id, menuItemId: hiddenId, name: "Lan", phone: "2145550123" });
R.check("B1", "Kiểm tra đầu vào: tên quá ngắn / SĐT sai / ngày quá xa → 400; thợ không tồn tại, mẫu của tiệm khác, mẫu đang ẩn → 404",
  [e1, e2, e3].every((r) => r.status === 400) && [e4, e5, e6].every((r) => r.status === 404), [e1, e2, e3, e4, e5, e6].map((r) => r.status).join(" "));

const ipA = fakeIp();
const ok1 = await book({ techId: tech.me.id, menuItemId: itemId, name: "Ngọc Anh", phone: "(214) 555-0123", date: tomorrow, time: "afternoon", note: "Muốn tông hồng", itemName: "GIẢ MẠO", itemPrice: "$1", locale: "vi" }, ipA);
const au = await book({ techId: tech.me.id, name: "Mia", phone: "0412 345 678", locale: "en" });
const rows1 = await rowsFor(tech.me.id);
const r1 = rows1.find((r) => r.clientName === "Ngọc Anh");
const r2 = rows1.find((r) => r.clientName === "Mia");
R.check("B2", "Khách không tài khoản đặt lịch → 201; tên + giá mẫu lấy từ menu (bỏ dữ liệu giả khách gửi), SĐT chuẩn hoá Mỹ / Úc",
  ok1.status === 201 && au.status === 201 && r1?.itemName === "QA Mắt mèo bạc" && r1.itemPrice === "$45–60" && r1.clientPhone === "+12145550123" && r1.preferredTime === "afternoon" && r1.preferredDate === tomorrow && r2?.clientPhone === "+61412345678" && r2.locale === "en" && r2.itemName === null,
  JSON.stringify({ s: [ok1.status, au.status], r1: r1 && [r1.itemName, r1.itemPrice, r1.clientPhone], au: r2?.clientPhone }));

const bot = await book({ techId: tech.me.id, name: "Bot", phone: "2145550199", website: "http://spam.example" });
const dup = await book({ techId: tech.me.id, menuItemId: itemId, name: "Ngọc Anh", phone: "214-555-0123" }, ipA);
const rows2 = await rowsFor(tech.me.id);
R.check("B3", "Bot điền ô bẫy → trả thành công giả, KHÔNG lưu; cùng SĐT gửi lại trong 10 phút → không tạo trùng",
  bot.status === 201 && !rows2.some((r) => r.clientName === "Bot") && dup.status === 200 && (await dup.json()).duplicate === true && rows2.filter((r) => r.clientName === "Ngọc Anh").length === 1,
  JSON.stringify({ bot: bot.status, dup: dup.status, n: rows2.length }));

const ipB = fakeIp();
const burst = [];
for (let i = 0; i < 6; i++) burst.push((await book({ techId: owner.me.id, name: `Khách ${i}`, phone: `21455501${10 + i}` }, ipB)).status);
R.check("B4", "Chống spam: 1 IP gửi tối đa 5 lần / giờ → lần 6 bị 429", JSON.stringify(burst) === JSON.stringify([201, 201, 201, 201, 201, 429]), JSON.stringify(burst));

const g401 = await fetch(BASE_URL + "/api/bookings");
const tList = await (await api(tech, "GET", "/api/bookings?status=new")).json();
const oList = await (await api(owner, "GET", "/api/bookings?status=new")).json();
R.check("B5", "Xem lịch: chưa đăng nhập 401; thợ chỉ thấy lịch CỦA MÌNH (kèm SĐT dễ đọc + đếm), tiệm khác không thấy",
  g401.status === 401 && tList.bookings?.length === 2 && tList.counts?.new === 2 && tList.bookings.some((b) => b.phoneDisplay === "(214) 555-0123") && tList.bookings.some((b) => b.phoneDisplay === "0412 345 678") && !oList.bookings.some((b) => /Ngọc Anh|Mia/.test(b.clientName)),
  JSON.stringify({ g: g401.status, t: tList.bookings?.length, c: tList.counts, o: oList.bookings?.length }));

const bId = String(r1?.id);
const skip = await api(tech, "PATCH", `/api/bookings/${bId}`, { status: "done" });
const steal = await api(owner, "PATCH", `/api/bookings/${bId}`, { status: "confirmed" });
const conf = await api(tech, "PATCH", `/api/bookings/${bId}`, { status: "confirmed", scheduledFor: "Thứ 7, 18/10 · 2:30 PM" });
const fin = await api(tech, "PATCH", `/api/bookings/${bId}`, { status: "done" });
const reopen = await api(tech, "PATCH", `/api/bookings/${bId}`, { status: "confirmed" });
const delOther = await api(owner, "DELETE", `/api/bookings/${String(r2?.id)}`);
const del = await api(tech, "DELETE", `/api/bookings/${String(r2?.id)}`);
const left = await rowsFor(tech.me.id);
R.check("B6", "Trạng thái: chưa xác nhận không cho \"đã làm\"; tiệm khác sửa/xoá → 403; xác nhận (kèm giờ) → đã làm; không mở lại lịch đã xong; thợ xoá được (xoá luôn SĐT)",
  skip.status() === 400 && steal.status() === 403 && conf.ok() && (await conf.json()).booking.scheduledFor === "Thứ 7, 18/10 · 2:30 PM" && fin.ok() && reopen.status() === 400 && delOther.status() === 403 && del.ok() && !left.some((r) => r.id === r2?.id) && left.find((r) => r.id === bId)?.status === "done",
  [skip.status(), steal.status(), conf.status(), fin.status(), reopen.status(), delOther.status(), del.status()].join(" "));

// ---------- Giao diện: khách trên điện thoại ----------
const guest = await login(null, devices["iPhone 13"]);
const gp = guest.page;
await gp.goto(BASE_URL + `/menu/${tech.me.id}`);
await gp.getByRole("button", { name: "QA Mắt mèo bạc" }).click({ timeout: 20000 });
const noChat = (await gp.getByRole("button", { name: "Nhắn tin hỏi thêm" }).count()) === 0;
await gp.getByRole("button", { name: "Đặt lịch mẫu này" }).click();
const form = gp.getByRole("dialog", { name: "Đặt lịch" });
await form.waitFor({ timeout: 5000 });
const showsItem = await form.getByText("$45–60").isVisible();
await form.getByPlaceholder("VD: Ngọc Anh").fill("Thu Trang");
await form.getByPlaceholder("(214) 555-0123").fill("123");
await form.getByRole("button", { name: "Ngày mai" }).click();
await form.getByRole("button", { name: "Buổi tối" }).click();
await form.getByPlaceholder(/muốn đổi màu hồng/).fill("Có tháo gel cũ");
await form.getByRole("button", { name: "Gửi yêu cầu đặt lịch" }).click();
const badPhone = await form.getByRole("alert").filter({ hasText: /Số điện thoại chưa đúng/ }).waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
await form.getByPlaceholder("(214) 555-0123").fill("972 555 0188");
await form.getByRole("button", { name: "Gửi yêu cầu đặt lịch" }).click();
const sent = await form.getByText("Đã gửi yêu cầu!").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
const ov1 = await gp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
R.check("B7", "Khách (chưa đăng nhập) trên điện thoại: chi tiết mẫu → \"Đặt lịch mẫu này\" (không bắt đăng nhập, không hiện nút chat) → nhập sai SĐT được nhắc rõ → gửi thành công",
  noChat && showsItem && badPhone && sent && ov1 <= 1, JSON.stringify({ noChat, showsItem, badPhone, sent, ov1 }));
await form.getByRole("button", { name: "Xong" }).click();
// Đặt lịch chung (không chọn mẫu) từ đầu menu; tên + SĐT được nhớ trên máy khách
await gp.getByRole("button", { name: "Đặt lịch", exact: true }).click();
const form2 = gp.getByRole("dialog", { name: "Đặt lịch" });
await form2.getByPlaceholder("VD: Ngọc Anh").evaluate((el) => new Promise((ok) => { const t = Date.now(); const f = () => (el.value || Date.now() - t > 4000 ? ok() : setTimeout(f, 100)); f(); }));
const remembered = (await form2.getByPlaceholder("VD: Ngọc Anh").inputValue()) === "Thu Trang" && (await form2.getByPlaceholder("(214) 555-0123").inputValue()) === "972 555 0188";
await form2.getByRole("button", { name: "Gửi yêu cầu đặt lịch" }).click();
const sent2 = await form2.getByText("Đã gửi yêu cầu!").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
const trang = (await rowsFor(tech.me.id)).filter((r) => r.clientName === "Thu Trang");
R.check("B8", "Nút \"Đặt lịch\" chung ở đầu menu; lần 2 tự điền sẵn tên + SĐT (chỉ lưu trên máy khách); lưu đúng 2 yêu cầu (1 theo mẫu + buổi tối, 1 hỏi chung)",
  remembered && sent2 && trang.length === 2 && trang.some((r) => r.itemName === "QA Mắt mèo bạc" && r.preferredTime === "evening" && r.note === "Có tháo gel cũ") && trang.some((r) => r.itemName === null),
  JSON.stringify({ remembered, sent2, n: trang.length }));

// ---------- Giao diện: thợ nhận lịch ----------
const tp = tech.page;
await tp.goto(BASE_URL + "/?tab=feed");
const toolLink = tp.getByRole("navigation", { name: "Công cụ" }).getByRole("link", { name: /Lịch hẹn/ }).first();
await toolLink.filter({ hasText: /\d/ }).waitFor({ timeout: 15000 }).catch(() => {});
const toolBadge = await toolLink.textContent().catch(() => "");
await tp.goto(BASE_URL + "/bookings");
const card = tp.getByRole("listitem", { name: "Lịch của Thu Trang" }).filter({ hasText: "QA Mắt mèo bạc" });
await card.waitFor({ timeout: 20000 });
const txt = await card.textContent();
const sms = await card.getByRole("link", { name: "Nhắn SMS" }).getAttribute("href");
const tel = await card.getByRole("link", { name: "Gọi" }).getAttribute("href");
R.check("B9", "Thợ: lối tắt \"Lịch hẹn\" có số khách mới; thẻ lịch đủ tên, SĐT, mẫu + giá, ngày/buổi muốn, ghi chú; nút Gọi + Nhắn SMS soạn sẵn đúng tên khách và mẫu",
  /2/.test(toolBadge || "") && /\(972\) 555-0188/.test(txt) && /\$45–60/.test(txt) && /buổi tối/.test(txt) && /Có tháo gel cũ/.test(txt) && tel === "tel:+19725550188" && /^sms:\+19725550188\?&body=/.test(sms || "") && /Thu%20Trang/.test(sms || "") && /QA%20M%E1%BA%AFt%20m%C3%A8o%20b%E1%BA%A1c/.test(sms || ""),
  JSON.stringify({ toolBadge, tel, sms: sms?.slice(0, 120) }));

await card.getByRole("button", { name: "Xác nhận giờ" }).click();
const dlg = tp.getByRole("dialog", { name: "Xác nhận giờ hẹn" });
await dlg.getByPlaceholder("2:30 PM").fill("6:00 PM");
await dlg.getByRole("button", { name: "Xác nhận lịch" }).click();
const confirmSms = await dlg.getByRole("link", { name: "Nhắn xác nhận cho khách" }).getAttribute("href", { timeout: 8000 }).catch(() => "");
await dlg.getByRole("link", { name: "Nhắn xác nhận cho khách" }).evaluate((a) => a.removeAttribute("href")).catch(() => {}); // không mở app SMS trong test
await dlg.getByRole("button", { name: "Để sau" }).click().catch(() => {});
await tp.getByRole("button", { name: /Đã hẹn/ }).click();
const confirmedCard = await tp.getByRole("listitem", { name: "Lịch của Thu Trang" }).filter({ hasText: "6:00 PM" }).waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
const ov2 = await tp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
R.check("B10", "Thợ xác nhận giờ → có ngay tin SMS xác nhận soạn sẵn (kèm giờ); lịch chuyển sang tab \"Đã hẹn\"; điện thoại không tràn ngang",
  /6%3A00%20PM/.test(confirmSms || "") && confirmedCard && ov2 <= 1, JSON.stringify({ confirmSms: confirmSms?.slice(0, 160), confirmedCard, ov2 }));

// ---------- Đánh giá sau buổi làm ----------
await db.execute({ sql: `DELETE FROM "ClientReview" WHERE techId = ?`, args: [tech.me.id] });
const doneCard = tp.getByRole("listitem", { name: "Lịch của Thu Trang" }).filter({ hasText: "6:00 PM" });
await doneCard.getByRole("button", { name: "Đã làm xong" }).click();
const ask = tp.getByRole("dialog", { name: "Xin khách đánh giá" });
const askSms = await ask.getByRole("link", { name: "Nhắn xin đánh giá" }).getAttribute("href", { timeout: 8000 }).catch(() => "");
const token = decodeURIComponent(askSms || "").match(/\/r\/([A-Za-z0-9_-]{16,40})/)?.[1];
await ask.getByRole("button", { name: "Để sau" }).click().catch(() => {});
R.check("B12", "Thợ bấm \"Đã làm xong\" → hiện ngay tin SMS xin đánh giá soạn sẵn, kèm link riêng của lịch hẹn", !!token && /Thu%20Trang/.test(askSms || ""), (askSms || "").slice(0, 160));

const bad404 = await fetch(BASE_URL + "/api/client-reviews?token=khong-co-token-nay-abcdef");
const notDone = (await rowsFor(tech.me.id)).find((r) => r.status === "new");
const withLink = await fetch(BASE_URL + "/api/client-reviews", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": fakeIp() }, body: JSON.stringify({ token, rating: 5, comment: "Đẹp lắm, ghé www.spam.com nha" }) });
const noStar = await fetch(BASE_URL + "/api/client-reviews", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": fakeIp() }, body: JSON.stringify({ token, rating: 0 }) });
R.check("B13", "Link sai → 404; lịch chưa làm xong không có link đánh giá; nhận xét chứa link / thiếu sao → 400",
  bad404.status === 404 && notDone && !notDone.reviewToken && withLink.status === 400 && noStar.status === 400, [bad404.status, !!notDone?.reviewToken, withLink.status, noStar.status].join(" "));

const rv = await login(null, devices["iPhone 13"]);
await rv.page.goto(BASE_URL + `/r/${token}`);
const rvName = await rv.page.getByRole("heading", { name: tech.me.name || "" }).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
const prefilled = await rv.page.getByLabel("Tên hiển thị").inputValue().catch(() => "");
await rv.page.getByRole("radio", { name: "5 sao" }).click();
await rv.page.getByPlaceholder(/Móng đẹp/).fill("Làm kỹ, đúng giờ, mắt mèo rất đẹp!");
await rv.page.getByRole("button", { name: "Gửi đánh giá" }).click();
const thanks = await rv.page.getByText("Cảm ơn bạn!").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
const again = await fetch(BASE_URL + "/api/client-reviews", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": fakeIp() }, body: JSON.stringify({ token, rating: 1, comment: "spam" }) });
const ov3 = await rv.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
R.check("B14", "Khách mở link trên điện thoại (không tài khoản): thấy tên thợ, tên hiển thị gợi ý gọn \"Thu T.\", chấm 5 sao + nhận xét → cảm ơn; gửi lần 2 → 409 (1 lịch = 1 đánh giá)",
  rvName && prefilled === "Thu T." && thanks && again.status === 409 && ov3 <= 1, JSON.stringify({ rvName, prefilled, thanks, again: again.status, ov3 }));

const pub = await (await fetch(BASE_URL + `/api/client-reviews?techId=${tech.me.id}`)).json();
await rv.page.goto(BASE_URL + `/menu/${tech.me.id}`);
const sec = rv.page.getByRole("region", { name: "Đánh giá từ khách" });
const secOk = await sec.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
const secTxt = secOk ? await sec.textContent() : "";
R.check("B15", "Menu thợ hiện \"Đánh giá từ khách\": 5.0, nhãn \"Khách đã đặt lịch\", tên gọn, tên mẫu; không lộ SĐT",
  pub.count === 1 && pub.average === 5 && secOk && /5\.0/.test(secTxt) && /Khách đã đặt lịch/.test(secTxt) && /Thu T\./.test(secTxt) && /QA Mắt mèo bạc/.test(secTxt) && !/972|555/.test(JSON.stringify(pub)),
  JSON.stringify({ count: pub.count, avg: pub.average, secOk, secTxt: secTxt.slice(0, 120) }));

// Lịch hẹn tự xoá sau 90 ngày → đánh giá vẫn còn (không khoá ngoại tới lịch hẹn)
await db.execute({ sql: `DELETE FROM "BookingRequest" WHERE reviewToken = ?`, args: [token] });
const keep = await (await fetch(BASE_URL + `/api/client-reviews?techId=${tech.me.id}`)).json();
R.check("B16", "Xoá lịch hẹn (kèm SĐT) → đánh giá vẫn giữ trên menu", keep.count === 1, JSON.stringify(keep.count));
rv.errors.length && guest.errors.push(...rv.errors);
await db.execute({ sql: `DELETE FROM "ClientReview" WHERE techId = ?`, args: [tech.me.id] });

const errs = [...tech.errors, ...guest.errors, ...owner.errors];
R.check("B11", "Không có lỗi JavaScript", errs.length === 0, errs.join(" | "));

// Dọn
await db.execute({ sql: `DELETE FROM "BookingRequest" WHERE techId IN (?, ?)`, args: [tech.me.id, owner.me.id] });
for (const id of [itemId, hiddenId]) if (id) await api(tech, "DELETE", `/api/menu/${id}`);
if (otherId) await api(owner, "DELETE", `/api/menu/${otherId}`);
await browser.close();
const s = R.summary();
process.exit(s.failed ? 1 : 0);
