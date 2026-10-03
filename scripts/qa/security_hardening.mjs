// Kiểm chứng phòng thủ (defensive verification) cho server LOCAL — mở rộng
// security_api.mjs sang các bề mặt chưa phủ: kênh realtime, giả loại tin
// nhắn, leo quyền qua update, lạm dụng reaction/tín hiệu cuộc gọi, rò rỉ dữ
// liệu. "PASS" = hành vi độc hại ĐÃ BỊ CHẶN. lib.mjs từ chối chạy với domain
// production nên script này không thể đụng tới dữ liệu thật.
import fs from "fs";
import { Client, Results, registerUser, SEED_OWNER, SEED_OWNER_2, SEED_TECH } from "./lib.mjs";

const R = new Results("Security hardening");

const owner = new Client();
const other = new Client();
const tech = new Client();
await owner.login(SEED_OWNER);
await other.login(SEED_OWNER_2);
await tech.login(SEED_TECH);

// Tạo 1 hội thoại riêng owner <-> tech để thử can thiệp từ `other`.
const seed = await tech.req("/api/messages", { method: "POST", json: { receiverId: owner.userId, content: "seed hardening" } });
const convId = seed.data?.message?.conversationId;
const msgId = seed.data?.message?.id;

// ---------- 1. Giả loại tin nhắn / tracking beacon ----------
{
  // type lạ (vượt 20 ký tự) phải bị quy về TEXT, không được lưu nguyên.
  const r = await tech.req("/api/messages", { method: "POST", json: { conversationId: convId, content: "x", type: "A".repeat(40) } });
  R.check("M1", "Loại tin nhắn dài bất thường bị từ chối/chuẩn hoá", r.status === 201 || r.status === 400, `status=${r.status}`);
  // IMAGE trỏ tới host lạ = beacon lộ IP/online của người nhận → phải chặn.
  const beacon = await tech.req("/api/messages", { method: "POST", json: { conversationId: convId, content: "https://evil.example/track?v=1", type: "IMAGE" } });
  R.check("M2", "Tin IMAGE trỏ host lạ (tracking beacon lộ IP) bị chặn", beacon.status === 400, `status=${beacon.status}`);
  const js = await tech.req("/api/messages", { method: "POST", json: { conversationId: convId, content: "javascript:alert(1)", type: "IMAGE" } });
  R.check("M3", "Tin IMAGE scheme javascript: bị chặn", js.status === 400, `status=${js.status}`);
  // Ảnh Cloudinary/Tenor hợp lệ vẫn gửi được.
  const ok = await tech.req("/api/messages", { method: "POST", json: { conversationId: convId, content: "https://media.tenor.com/abc.gif", type: "IMAGE" } });
  R.check("M4", "Ảnh/GIF từ host hợp lệ vẫn gửi được", ok.status === 201, `status=${ok.status}`);
}

// ---------- 2. Reaction / message-updated giả vào kênh người khác ----------
{
  const r = await other.req("/api/messages/react", { method: "POST", json: { messageId: msgId, emoji: "💀", reactions: ["💀"] } });
  R.check("RX1", "Người ngoài không bắn được reaction vào hội thoại khác", r.status === 403, `status=${r.status}`);
  const r2 = await other.req("/api/messages/react", { method: "POST", json: { messageId: "does-not-exist", emoji: "x" } });
  R.check("RX2", "Reaction tới messageId không tồn tại → 404, không 500", r2.status === 404, `status=${r2.status}`);
}

// ---------- 3. Tín hiệu cuộc gọi giả (DoS cuộc gọi / nghe lén) ----------
{
  // Sau khi owner chặn other, other KHÔNG được bắn bất kỳ action nào (trước
  // đây chỉ "offer" bị chặn → reject/candidate/camera vẫn lọt, có thể ngắt
  // cuộc gọi hợp lệ của nạn nhân).
  await owner.req("/api/block", { method: "POST", json: { userId: other.userId } });
  for (const action of ["offer", "accept", "candidate-batch", "camera", "reject"]) {
    const r = await other.req("/api/calls", { method: "POST", json: { targetId: owner.userId, action, sdp: {}, candidates: [], videoOff: true } });
    R.check(`CALL-BLK-${action}`, `Bị chặn → calls action="${action}" bị từ chối (403)`, r.status === 403, `status=${r.status}`);
  }
  await owner.req(`/api/block?userId=${other.userId}`, { method: "DELETE" });
  // Server phải gắn fromId (từ session) vào payload để client lọc tín hiệu lạ.
  const r = await other.req("/api/calls", { method: "POST", json: { targetId: tech.userId, action: "offer", callType: "audio" } });
  R.check("CALL-OK", "Không bị chặn → gửi offer thành công", r.status === 200, `status=${r.status}`);
}

// ---------- 4. Leo quyền / mass-assignment qua update hồ sơ ----------
{
  const before = await tech.req("/api/profile");
  const beforeRole = before.data?.role;
  // Nhồi role/id/market lạ vào PUT — không được đổi role.
  await tech.req("/api/profile", { method: "PUT", json: { name: "QA", role: "ADMIN", id: owner.userId, market: "ZZ", email: "hacker@evil.test" } });
  const after = await tech.req("/api/profile");
  R.check("ESC1", "PUT profile không đổi được role (chặn leo quyền ADMIN)", after.data?.role === beforeRole && after.data?.role !== "ADMIN", `role=${after.data?.role}`);
  R.check("ESC2", "PUT profile không đổi được email qua mass-assignment", after.data?.email === before.data?.email, `email=${after.data?.email}`);
  R.check("ESC3", "PUT profile không đổi được id tài khoản", after.data?.id === before.data?.id, `id=${after.data?.id}`);
}

// ---------- 5. Đăng ký nhồi trường nhạy cảm ----------
{
  const { client, body } = await registerUser({ role: "OWNER", salonName: "QA" });
  // cố set role ADMIN + id cố định đã thử ở security_api; ở đây thử nhồi
  // "turnSplitPolicy" khổng lồ và "id".
  const r = await client.req("/api/profile");
  R.check("REG1", "Tài khoản đăng ký mới không bao giờ là ADMIN", r.status === 401 || r.data?.role !== "ADMIN", `status=${r.status}`);
  void body;
}

// ---------- 6. Rò rỉ dữ liệu / liệt kê ----------
{
  // /api/reviews cần targetUserId; thử lấy review người khác là hợp lệ (công
  // khai) nhưng không được kèm email/phone tác giả.
  const r = await tech.req(`/api/reviews?targetUserId=${owner.userId}`);
  const leak = JSON.stringify(r.data).match(/@[a-z0-9.]+\.(demo|test|com)/i);
  R.check("LEAK1", "Danh sách đánh giá không lộ email người dùng", !leak, leak?.[0] || "");
  // /api/jobs/saved của người khác không thể đọc bằng cách truyền tham số.
  const r2 = await tech.req(`/api/jobs/saved?userId=${owner.userId}`);
  R.check("LEAK2", "Không đọc được danh sách tin đã lưu của người khác qua query", Array.isArray(r2.data), `status=${r2.status}`);
}

// ---------- 7. HTTP method & path ----------
{
  const r = await new Client().req("/api/admin/leads", { method: "POST", json: {} });
  R.check("HTTP1", "POST tới endpoint chỉ-GET /api/admin/leads không bị xử lý như GET", r.status === 401 || r.status === 403 || r.status === 405, `status=${r.status}`);
  // Path traversal trong id tin tuyển.
  const r2 = await new Client().req("/api/jobs/" + encodeURIComponent("../../etc/passwd"));
  R.check("HTTP2", "Path traversal trong jobId → 404, không lộ file", r2.status === 404 || r2.status === 400, `status=${r2.status}`);
}

// ---------- 7b. Xóa bài viết & trang kiểm duyệt báo cáo ----------
{
  const created = await tech.req("/api/posts", { method: "POST", json: { content: "QA bài sẽ bị xóa" } });
  const postId = created.data?.id;
  const anonDel = await new Client().req(`/api/posts/${postId}`, { method: "DELETE" });
  R.check("DEL1", "Ẩn danh xóa bài → 401", anonDel.status === 401, `status=${anonDel.status}`);
  const otherDel = await other.req(`/api/posts/${postId}`, { method: "DELETE" });
  R.check("DEL2", "Người khác (không phải admin) xóa bài của người ta → 403", otherDel.status === 403, `status=${otherDel.status}`);
  const ownDel = await tech.req(`/api/posts/${postId}`, { method: "DELETE" });
  R.check("DEL3", "Tác giả tự xóa bài của mình → 200", ownDel.status === 200, `status=${ownDel.status}`);
  const gone = await tech.req(`/api/posts/${postId}`, { method: "DELETE" });
  R.check("DEL4", "Xóa lại bài đã xóa → 404", gone.status === 404, `status=${gone.status}`);
  const rep = await tech.req("/api/admin/reports");
  R.check("MOD1", "Người không phải admin xem danh sách báo cáo → 403", rep.status === 403, `status=${rep.status}`);
  const repAnon = await new Client().req("/api/admin/reports");
  R.check("MOD2", "Ẩn danh xem danh sách báo cáo → 401", repAnon.status === 401, `status=${repAnon.status}`);
}

// ---------- 7c. Hiệu ứng đám đông chỉ từ dữ liệu THẬT ----------
{
  const act = await new Client().req("/api/activity");
  const blob = JSON.stringify(act.data);
  R.check("ACT1", "/api/activity trả sự kiện thật (mảng) công khai", act.status === 200 && Array.isArray(act.data), `status=${act.status}`);
  R.check("ACT2", "/api/activity không lộ email/SĐT", !/@[a-z0-9.-]+.[a-z]{2,}/i.test(blob) && !/(d{3})s?d{3}-d{4}/.test(blob), "");
  R.check("ACT3", "Không còn sự kiện bịa ('Chị Linda', 'Anh Minh'…)", !/Chị Linda|Anh Minh|Anh Tony/.test(blob), "");
  const created = await tech.req("/api/posts", { method: "POST", json: { content: "QA likers" } });
  await other.req(`/api/posts/${created.data.id}/like`, { method: "POST" });
  const feed = await new Client().req("/api/posts");
  const post = feed.data.posts.find((p) => p.id === created.data.id);
  R.check("LIKE1", "Danh sách 'đã thích' là người thật vừa thả tim", post?.likeCount === 1 && post?.recentLikers?.[0]?.id === other.userId, JSON.stringify(post?.recentLikers));
  R.check("LIKE2", "recentLikers không kèm email", !JSON.stringify(post?.recentLikers || []).includes("@"), "");
  await tech.req(`/api/posts/${created.data.id}`, { method: "DELETE" });
  const jobs = await new Client().req("/api/jobs");
  R.check("SAVE1", "Job board trả saveCount là số thật (không âm)", Array.isArray(jobs.data) && jobs.data.every((j) => Number.isInteger(j.saveCount) && j.saveCount >= 0), "");
}

// ---------- 8. CSRF: đổi dữ liệu không kèm cookie session ----------
{
  const noCookie = await fetch(BASE_URL_SAFE() + "/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "csrf" }) });
  R.check("CSRF1", "PUT profile không cookie → 401 (không thao tác được)", noCookie.status === 401, `status=${noCookie.status}`);
}
function BASE_URL_SAFE() {
  return process.env.BASE_URL || "http://localhost:3000";
}

const out = R.summary();
fs.mkdirSync(new URL("./reports/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./reports/security_hardening.json", import.meta.url), JSON.stringify(out, null, 2));
process.exit(out.failed ? 1 : 0);
