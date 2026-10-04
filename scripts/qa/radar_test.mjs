// Kiểm thử "Radar xu hướng & nỗi đau ngành": Nhịp đau tuần, tín hiệu tự động,
// tin ngành, Phòng nội dung (admin duyệt → bảng tin). CHỈ chạy với dev.db local.
//   node scripts/qa/radar_test.mjs
import { chromium } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Client, DEMO_PASSWORD, Results, SEED_OWNER, registerUser } from "./lib.mjs";

const R = new Results("Radar xu hướng & nỗi đau");
const db = createClient({ url: "file:prisma/dev.db" });

// ---- Nhịp đau tuần ----
R.check("RA1", "/api/pulse bắt buộc đăng nhập", (await new Client().req("/api/pulse")).status === 401);

const voters = [];
for (let i = 0; i < 6; i++) {
  const v = await registerUser({ state: "TX", city: "Houston", name: `QA Pulse ${i}` });
  await v.client.login(v.body.email, v.body.password);
  voters.push(v);
}
const t0 = voters[0].client;
const g0 = (await t0.req("/api/pulse")).data;
R.check("RA2", "Thợ nhận câu hỏi tuần của thợ, CHƯA thấy kết quả trước khi trả lời", g0.question?.id?.startsWith("tech_") && !g0.results, JSON.stringify(g0).slice(0, 160));
R.check("RA3", "Lựa chọn rác → 400", (await t0.req("/api/pulse", { method: "POST", json: { option: "<script>" } })).status === 400);

const opts = g0.question.options.map((o) => o.id);
// 4 phiếu cho lựa chọn đầu, 2 phiếu cho lựa chọn thứ 2 → 67% / 33%
for (let i = 0; i < 6; i++) {
  const r = await voters[i].client.req("/api/pulse", { method: "POST", json: { option: i < 4 ? opts[0] : opts[1] } });
  if (r.status !== 200) R.check("RA4x", `phiếu ${i}`, false, JSON.stringify(r.data));
}
const again = await t0.req("/api/pulse", { method: "POST", json: { option: opts[2] } });
R.check("RA4", "Mỗi người chỉ trả lời 1 lần/tuần (lần 2 → 409)", again.status === 409, again.status);
const after = (await t0.req("/api/pulse")).data;
const top = [...after.results.options].sort((a, b) => b.votes - a.votes)[0];
R.check("RA5", "Đủ mẫu → công bố %, lựa chọn đúng của tôi được ghi nhận", after.myVote === opts[0] && after.results.published && after.results.total >= 6 && top.id === opts[0], JSON.stringify(after.results).slice(0, 200));

const owner = new Client();
await owner.login(SEED_OWNER);
const og = (await owner.req("/api/pulse")).data;
R.check("RA6", "Chủ tiệm nhận câu hỏi riêng của chủ tiệm", og.question?.id?.startsWith("owner_"), og.question?.id);

// ---- Tín hiệu: tạo tin cần Gel-X ở Texas để thấy "thiếu thợ" ----
for (let i = 0; i < 3; i++) {
  await owner.req("/api/jobs", { method: "POST", json: { title: `QA radar Gel-X ${i}`, salonName: "QA Radar Nails", description: "", market: "US", state: "TX", city: "Austin", salaryType: "Bao lương tuần", salaryAmount: "$1,500/tuần", skills: ["Gel-X"], benefits: [], phone: "5125550100", isUrgent: false } });
}

// ---- Phòng nội dung (admin) ----
const admin = await registerUser({ name: "QA Radar Admin" });
await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE email = ?`, args: [admin.body.email] });
await admin.client.login(admin.body.email, admin.body.password);
R.check("RA7", "Phòng nội dung: khách 401, thợ 403", (await new Client().req("/api/admin/studio")).status === 401 && (await t0.req("/api/admin/studio")).status === 403);
const room = await admin.client.req("/api/admin/studio?market=US");
const d = room.data;
R.check("RA8", "Admin thấy đủ: tín hiệu + tin ngành + bài nháp", room.status === 200 && d.signals && Array.isArray(d.news) && Array.isArray(d.drafts), room.status);
R.check("RA9", "Tín hiệu 'thiếu thợ Gel-X tại Texas' được phát hiện", d.signals.skillGaps.some((g) => g.state === "TX" && g.skill === "Gel-X" && g.jobs >= 3), JSON.stringify(d.signals.skillGaps).slice(0, 200));
const pulseDraft = d.drafts.find((x) => x.kind === "pulse");
R.check("RA10", "Bài nháp Nhịp đau trích ĐÚNG % thật (67%)", pulseDraft && /67%/.test(pulseDraft.title), pulseDraft?.title);
R.check("RA11", "Tin ngành chỉ gồm tiêu đề + link https (không chép nội dung)", d.news.length === 0 || d.news.every((n) => /^https:\/\//.test(n.link) && n.title.length <= 200 && !("content" in n)), `${d.news.length} tin`);
R.check("RA12", "Nội dung tin ngành đúng chủ đề nail", d.news.length === 0 || d.news.filter((n) => /nail|manicur|pedicur|móng|nail tech|gel|acrylic/i.test(n.title) || n.source === "NAILS Magazine").length / d.news.length > 0.9, d.news.slice(0, 3).map((n) => n.title).join(" | "));

// Đăng / chặn link nguy hiểm / gỡ
const bad = await admin.client.req("/api/admin/studio", { method: "POST", json: { kind: "custom", title: "QA xấu", body: "x x x", href: "javascript:alert(1)" } });
R.check("RA13", "Chặn link javascript: trong bài đăng", bad.status === 400, bad.status);
const pub = await admin.client.req("/api/admin/studio", { method: "POST", json: { kind: pulseDraft.kind, title: pulseDraft.title, body: pulseDraft.body, href: pulseDraft.href, market: "US" } });
const xss = await admin.client.req("/api/admin/studio", { method: "POST", json: { kind: "custom", title: `QA <img src=x onerror="window.__xss=1"> tiêu đề`, body: "Kiểm tra an toàn hiển thị", market: "US" } });
const radar = (await new Client().req("/api/radar?market=US")).data;
R.check("RA14", "Bài đã duyệt hiện ở /api/radar (công khai) + kết quả Nhịp đau đã đủ mẫu", pub.status === 201 && radar.posts.some((p) => p.id === pub.data.id) && radar.pulse.some((p) => p.total >= 6), JSON.stringify(radar).slice(0, 200));
R.check("RA15", "/api/radar không lộ dữ liệu cá nhân", !/"(email|phone|userId|password)"/.test(JSON.stringify(radar)));
R.check("RA16", "Thợ không đăng được bài Studio", (await t0.req("/api/admin/studio", { method: "POST", json: { kind: "custom", title: "hack", body: "hack hack" } })).status === 403);

// ---- Giao diện ----
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "vi-VN" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("pn_fomo_session", JSON.stringify({ shown: 99, closes: 9 })); localStorage.setItem("pn_push_dismissed_at", String(Date.now())); } catch {} });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  // thợ MỚI chưa trả lời
  const fresh = await registerUser({ state: "CA", city: "San Jose", name: "QA Pulse UI" });
  await p.goto(BASE_URL + "/auth/login");
  await p.locator("#email").fill(fresh.body.email);
  await p.locator("#password").fill(fresh.body.password);
  await p.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  await p.goto(BASE_URL + "/?tab=feed");
  const card = p.getByRole("region", { name: "Nhịp đau tuần" });
  const shown = await card.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  R.check("RA17", "Bảng tin có thẻ 'Nhịp đau tuần' cho người chưa trả lời", shown);
  if (shown) {
    await card.scrollIntoViewIfNeeded();
    await card.getByRole("button").first().click();
    const ack = await card.getByText(/%|Đã ghi nhận/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    R.check("RA18", "Bấm 1 lần → hiện kết quả / xác nhận ngay trong thẻ", ack);
    await p.screenshot({ path: (process.env.TEMP || ".") + "/radar_pulse.png" });
  } else R.check("RA18", "Bấm trả lời", false, "thẻ không hiện");

  const radarCard = p.getByText(pulseDraft.title).first();
  let found = false;
  for (let i = 0; i < 10 && !found; i++) {
    found = await radarCard.isVisible().catch(() => false);
    if (!found) { await p.evaluate(() => window.scrollBy(0, 1200)); await p.waitForTimeout(600); }
  }
  R.check("RA19", "Bài PawNail Studio đã duyệt xuất hiện trong bảng tin", found);
  R.check("RA20", "Tiêu đề chứa HTML hiển thị như chữ, không chạy mã (chống XSS)", (await p.evaluate(() => window.__xss)) !== 1);

  await p.goto(BASE_URL + "/trends");
  const sec = await p.getByRole("heading", { name: "Nhịp đau ngành" }).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  const newsSec = await p.getByRole("heading", { name: "Tin ngành nail" }).isVisible().catch(() => false);
  R.check("RA21", "Trang Xu hướng có 'Nhịp đau ngành' + 'Tin ngành nail'", sec && (newsSec || d.news.length === 0), `pulse=${sec} news=${newsSec}`);
  await p.screenshot({ path: (process.env.TEMP || ".") + "/radar_trends.png", fullPage: true });

  const actx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "vi-VN" });
  const ap = await actx.newPage();
  ap.on("pageerror", (e) => errors.push("admin: " + e.message));
  await ap.goto(BASE_URL + "/auth/login");
  await ap.locator("#email").fill(admin.body.email);
  await ap.locator("#password").fill(admin.body.password);
  await ap.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await ap.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  await ap.goto(BASE_URL + "/admin/studio");
  const roomOk = await ap.getByRole("heading", { name: /Bài nháp sẵn sàng/ }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  const postedBtn = await ap.getByRole("button", { name: "Đã đăng" }).count();
  R.check("RA22", "Trang Phòng nội dung hiển thị bài nháp; bài đã đăng hiện 'Đã đăng'", roomOk && postedBtn >= 1, `room=${roomOk} posted=${postedBtn}`);
  await ap.screenshot({ path: (process.env.TEMP || ".") + "/radar_room.png", fullPage: true });
} finally {
  await browser.close();
}
// gỡ bài thử
await admin.client.req("/api/admin/studio", { method: "DELETE", json: { id: pub.data.id } });
if (xss.data?.id) await admin.client.req("/api/admin/studio", { method: "DELETE", json: { id: xss.data.id } });
R.check("RA23", "Gỡ bài → không còn trên bảng tin", !(await new Client().req("/api/radar?market=US")).data.posts.some((p) => p.id === pub.data.id));
R.check("RA24", "Không có lỗi JS", errors.length === 0, errors.join(" | "));
const s = R.summary();
process.exit(s.failed ? 1 : 0);
