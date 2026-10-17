// Cộng đồng THẬT: chủ đề nóng (tín hiệu từ tool) · thăm dò 1 chạm · tâm sự ẩn danh (duyệt, không lộ danh tính).
// CHỈ chạy với server local.   node scripts/qa/community_test.mjs
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Client, Results, registerUser } from "./lib.mjs";

const R = new Results("Cộng đồng: chủ đề nóng · thăm dò · ẩn danh");
const db = createClient({ url: "file:prisma/dev.db" });
const KEY = "test-ingest-key-0123456789abcdef";
const errors = [];
let browser;
const t = Date.now();

try {
  // ---- Tín hiệu chủ đề từ tool ----
  const noKey = await fetch(BASE_URL + "/api/content/topics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics: [{ topic: "chia turn" }] }) });
  const sig = await fetch(BASE_URL + "/api/content/topics", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": KEY }, body: JSON.stringify({ topics: [{ topic: "Chủ chia turn bất công quá mọi người ơi", likes: 120, comments: 80 }, { topic: "tip quẹt thẻ bị trừ phí", likes: 10, comments: 3 }] }) }).then((r) => r.json());
  R.check("T1", "Cổng tín hiệu chủ đề cần khoá; nhận chủ đề → xếp hạng (chia turn nóng nhất)", noKey.status === 401 && sig.ranking?.[0]?.key === "turn" && sig.matched >= 2, JSON.stringify(sig.ranking?.slice(0, 2)));

  // ---- Thăm dò ----
  const a = await registerUser({ name: "QA Comm Admin" });
  await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE email = ?`, args: [a.body.email] });
  const adminId = (await db.execute({ sql: `SELECT id FROM "User" WHERE email = ?`, args: [a.body.email] })).rows[0].id;
  const pid = `cqa${t}`;
  await db.execute({ sql: `INSERT INTO "Post" (id, authorId, content, postType, mediaUrls, createdAt) VALUES (?, ?, ?, 'GENERAL', '[]', ?)`, args: [pid, adminId, `💬 Tiệm bạn chia turn kiểu nào? ${t}`, Date.now()] });
  await db.execute({ sql: `INSERT INTO "PostPoll" (postId, question, options) VALUES (?, ?, ?)`, args: [pid, "Tiệm bạn chia turn kiểu nào?", JSON.stringify(["Xoay vòng", "Theo tiền", "Chủ chia", "Khách chọn"])] });
  const feed = await fetch(BASE_URL + "/api/posts").then((r) => r.json());
  const fp = feed.posts.find((p) => p.id === pid);
  R.check("V1", "Bảng tin trả thăm dò: câu hỏi + 4 lựa chọn, 0 phiếu", fp?.poll?.options?.length === 4 && fp.poll.total === 0 && fp.poll.myVote === null);
  const u1 = await registerUser({ name: "Thợ Bình Chọn" }); await u1.client.login(u1.body.email, u1.body.password);
  const u2 = await registerUser({ name: "Thợ Bình Chọn 2" }); await u2.client.login(u2.body.email, u2.body.password);
  const v1 = await u1.client.req(`/api/posts/${pid}/vote`, { method: "POST", json: { option: 0 } });
  await u2.client.req(`/api/posts/${pid}/vote`, { method: "POST", json: { option: 1 } });
  const v1b = await u1.client.req(`/api/posts/${pid}/vote`, { method: "POST", json: { option: 1 } });
  const bad = await u1.client.req(`/api/posts/${pid}/vote`, { method: "POST", json: { option: 9 } });
  const guest = await fetch(`${BASE_URL}/api/posts/${pid}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{\"option\":0}" });
  R.check("V2", "Bình chọn: 1 người 1 phiếu, đổi phiếu được, lựa chọn sai 400, khách 401", v1.data.total === 1 && v1b.data.total === 2 && v1b.data.options[1].votes === 2 && v1b.data.options[0].votes === 0 && bad.status === 400 && guest.status === 401, JSON.stringify(v1b.data));

  // ---- Tâm sự ẩn danh ----
  const w = await registerUser({ name: "Nguyễn Thị Bí Mật", state: "TX", city: "Houston" });
  await w.client.login(w.body.email, w.body.password);
  const wid = w.client.userId;
  const sec = `Chủ tiệm bắt mình làm 7 ngày không nghỉ, mình nên làm sao? ${t}`;
  const ap = await w.client.req("/api/posts", { method: "POST", json: { content: sec, anonymous: true } });
  const anonId = ap.data.id;
  const before = await fetch(BASE_URL + "/api/posts").then((r) => r.json());
  R.check("A1", "Gửi tâm sự ẩn danh → chờ duyệt, CHƯA hiện trên bảng tin", ap.status === 201 && ap.data.pending === true && !before.posts.some((p) => p.id === anonId));
  const extra = [];
  for (let i = 0; i < 3; i++) extra.push((await w.client.req("/api/posts", { method: "POST", json: { content: `Tâm sự thêm ${i} ${t}`, anonymous: true } })).status);
  R.check("A2", "Tối đa 3 tâm sự ẩn danh / ngày (bài thứ 4 → 429)", extra[0] === 201 && extra[1] === 201 && extra[2] === 429, extra.join());

  await a.client.login(a.body.email, a.body.password);
  const pend = await a.client.req("/api/admin/anon");
  const pendItem = pend.data.pending?.find((p) => p.id === anonId);
  R.check("A3", "Admin thấy bài chờ duyệt — chỉ vai trò + bang, KHÔNG thấy tên người gửi", !!pendItem && pendItem.state === "TX" && !JSON.stringify(pend.data).includes("Bí Mật") && !JSON.stringify(pend.data).includes(wid));
  await a.client.req("/api/admin/anon", { method: "POST", json: { postId: anonId, decision: "approve" } });
  const after = await fetch(BASE_URL + "/api/posts").then((r) => r.json());
  const shown = after.posts.find((p) => p.id === anonId);
  const raw = JSON.stringify(shown || {});
  R.check("A4", "Duyệt → lên bảng tin dưới tên 'Thợ ẩn danh', KHÔNG có id/tên/thành phố người đăng", !!shown && shown.author.name === "Thợ ẩn danh" && shown.author.id === null && shown.city === null && !raw.includes("Bí Mật") && !raw.includes(wid) && !raw.includes("Houston"), raw.slice(0, 200));
  const prof = await u1.client.req(`/api/posts?authorId=${wid}`);
  R.check("A5", "Trang hồ sơ của người đó KHÔNG liệt kê bài ẩn danh (không suy ra được ai viết)", !(prof.data.posts || []).some((p) => p.id === anonId));
  await w.client.req(`/api/posts/${anonId}/comments`, { method: "POST", json: { content: "Cảm ơn mọi người đã góp ý" } });
  const cm = await u1.client.req(`/api/posts/${anonId}/comments`);
  R.check("A6", "Tác giả bình luận dưới bài ẩn danh của mình → hiện 'Tác giả (ẩn danh)', không lộ tên", cm.data.some((c) => c.author.name === "Tác giả (ẩn danh)" && c.author.id === null) && !JSON.stringify(cm.data).includes("Bí Mật"));
  const rep = await u1.client.req("/api/report", { method: "POST", json: { postId: anonId, reason: "test báo cáo" } });
  const repRow = (await db.execute({ sql: `SELECT reportedUserId FROM "UserReport" ORDER BY createdAt DESC LIMIT 1` })).rows[0];
  R.check("A7", "Báo cáo bài ẩn danh được (máy chủ tự tra tác giả, người báo cáo không biết là ai)", rep.status === 201 && repRow?.reportedUserId === wid);
  const act = await fetch(BASE_URL + "/api/activity").then((r) => r.text());
  R.check("A8", "Mục 'hoạt động gần đây' không lộ bài ẩn danh", !act.includes(anonId));

  // ---- Giao diện ----
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const u = new URL(BASE_URL);
  await ctx.addCookies(Object.entries(u2.client.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p.goto(BASE_URL + "/?tab=feed");
  const poll = p.getByTestId("poll").first();
  await poll.waitFor({ timeout: 20000 });
  await poll.scrollIntoViewIfNeeded();
  await poll.getByRole("button", { name: /Khách chọn/ }).click();
  await p.waitForTimeout(1200);
  const ptxt = await poll.innerText();
  R.check("U1", "Bảng tin: thăm dò hiện, bấm 1 chạm → hiện % (tổng phiếu chỉ hiện khi ≥ 5, không lộ \"0 phiếu\")", /%/.test(ptxt) && /người đã bình chọn|Cảm ơn bạn đã bình chọn/.test(ptxt), ptxt.slice(0, 160));
  await p.screenshot({ path: `${process.env.TEMP || "."}/community_poll.png` }).catch(() => {});
  const anonCard = p.locator("article", { hasText: sec }).first();
  await anonCard.scrollIntoViewIfNeeded().catch(() => {});
  const atxt = await anonCard.innerText().catch(() => "");
  R.check("U2", "Thẻ tâm sự: nhãn 'Tâm sự ẩn danh', không có nút xem hồ sơ / nhắn tác giả", /Tâm sự ẩn danh/.test(atxt) && (await anonCard.getByRole("link", { name: /Xem Tay Nghề|Xem Tiệm|Xem hồ sơ/ }).count()) === 0 && (await anonCard.getByRole("button", { name: /Nhắn tin cho tác giả/ }).count()) === 0, atxt.slice(0, 160));
  await anonCard.screenshot({ path: `${process.env.TEMP || "."}/community_anon.png` }).catch(() => {});
  R.check("U3", "Ô soạn bài có nút '🤫 Ẩn danh'", (await p.getByRole("button", { name: /Ẩn danh/ }).count()) > 0);
  R.check("U4", "Không lỗi JS", errors.length === 0, errors.join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
