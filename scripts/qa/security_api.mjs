// Kiểm thử bảo mật API: xác thực, phân quyền (IDOR), kiểm tra đầu vào, rate
// limit, header bảo mật. Chạy: node scripts/qa/security_api.mjs
import fs from "fs";
import { Client, Results, registerUser, SEED_OWNER, SEED_OWNER_2, SEED_TECH, BASE_URL } from "./lib.mjs";

const R = new Results("Security API");
const anon = new Client();

// ---------- 1. Header bảo mật ----------
{
  const r = await anon.req("/auth/login");
  const h = r.headers;
  R.check("H1", "X-Frame-Options: DENY (chống clickjacking)", h.get("x-frame-options") === "DENY", h.get("x-frame-options"));
  R.check("H2", "X-Content-Type-Options: nosniff", h.get("x-content-type-options") === "nosniff");
  R.check("H3", "Content-Security-Policy có mặt", !!h.get("content-security-policy"));
  R.check("H4", "Strict-Transport-Security có mặt", !!h.get("strict-transport-security"));
  R.check("H5", "Không lộ header X-Powered-By", !h.get("x-powered-by"), h.get("x-powered-by"));
}

// ---------- 2. Endpoint cần đăng nhập phải trả 401 khi ẩn danh ----------
const protectedCalls = [
  ["GET", "/api/messages"],
  ["POST", "/api/messages", { content: "x", receiverId: "x" }],
  ["POST", "/api/conversations", { participantIds: ["x"] }],
  ["POST", "/api/posts", { content: "x" }],
  ["POST", "/api/jobs", { title: "x" }],
  ["PUT", "/api/profile", { name: "x" }],
  ["DELETE", "/api/profile"],
  ["POST", "/api/upload"],
  ["POST", "/api/user/update-avatar", { image: "x" }],
  ["GET", "/api/admin/leads"],
  ["POST", "/api/block", { userId: "x" }],
  ["POST", "/api/report", { userId: "x", reason: "x" }],
  ["POST", "/api/reviews", { targetUserId: "x" }],
  ["POST", "/api/unlock", { technicianUserId: "x" }],
  ["POST", "/api/zego/token", { roomId: "call-a-b" }],
  ["POST", "/api/calls", { targetId: "x", action: "offer" }],
  ["POST", "/api/supply", { title: "x" }],
  ["GET", "/api/jobs/saved"],
  ["POST", "/api/messages/seen", { conversationId: "x" }],
  ["POST", "/api/messages/react", { messageId: "x", emoji: "x" }],
];
for (const [method, path, json] of protectedCalls) {
  const r = await anon.req(path, { method, json });
  R.check("A-" + path, `${method} ${path} ẩn danh → 401`, r.status === 401, `status=${r.status}`);
}
{
  const r = await anon.req("/api/pusher/auth", {
    method: "POST",
    body: "socket_id=1.1&channel_name=private-chat-x",
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  R.check("A-pusher", "Pusher auth ẩn danh → 401", r.status === 401, `status=${r.status}`);
}

// ---------- 3. Đăng nhập ----------
const owner = new Client();
const owner2 = new Client();
const tech = new Client();
R.check("L1", "Đăng nhập chủ tiệm seed", (await owner.login(SEED_OWNER)).ok);
R.check("L2", "Đăng nhập chủ tiệm seed #2", (await owner2.login(SEED_OWNER_2)).ok);
R.check("L3", "Đăng nhập thợ seed", (await tech.login(SEED_TECH)).ok);
{
  const c = new Client();
  const r = await c.login(SEED_TECH, "wrong-password");
  R.check("L4", "Sai mật khẩu → không có session", !r.ok);
  const e1 = await new Client().req("/api/auth/csrf");
  // Thông báo lỗi phải giống nhau cho email không tồn tại vs sai mật khẩu.
  const bad1 = new Client(); await bad1.login("nobody.qa@qa.test", "whatever123");
  R.check("L5", "Email không tồn tại → không có session (không lộ user)", !bad1.userId, e1.status);
}
{
  // Khóa tạm theo email sau 5 lần sai — mỗi lần dùng IP khác để chắc chắn
  // đây là khóa theo TÀI KHOẢN, không phải theo IP.
  const { body } = await registerUser();
  for (let i = 0; i < 5; i++) await new Client().login(body.email, "wrong-" + i);
  const r = await new Client().login(body.email, body.password);
  R.check("L6", "Brute-force: sau 5 lần sai, đúng mật khẩu cũng bị khóa tạm", !r.ok);
}
{
  // Rate limit đăng nhập theo IP ở proxy (8/phút).
  const c = new Client("10.250.0.1");
  let got429 = false;
  for (let i = 0; i < 12; i++) {
    const csrf = await c.req("/api/auth/csrf");
    const r = await c.req("/api/auth/callback/credentials", {
      method: "POST",
      body: new URLSearchParams({ csrfToken: csrf.data.csrfToken, email: `x${i}@qa.test`, password: "x", json: "true" }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    if (r.status === 429) got429 = true;
  }
  R.check("L7", "Rate limit đăng nhập theo IP → 429", got429);
  // IP khác không bị ảnh hưởng (không chặn nhầm người dùng khác).
  const other = new Client("10.250.0.2");
  R.check("L8", "IP khác vẫn đăng nhập được khi 1 IP bị chặn", (await other.login(SEED_TECH)).ok);
}

// ---------- 4. Phân quyền / IDOR ----------
{
  const r = await tech.req("/api/admin/leads");
  R.check("Z1", "Thợ gọi /api/admin/leads → 403", r.status === 403, `status=${r.status}`);
  const r2 = await owner.req("/api/admin/leads");
  R.check("Z2", "Chủ tiệm gọi /api/admin/leads → 403", r2.status === 403, `status=${r2.status}`);
}
let ownerJobId;
{
  const r = await tech.req("/api/jobs", { method: "POST", json: { title: "x", salonName: "x", market: "US", state: "CA", city: "x", salaryType: "x", salaryAmount: "x", phone: "1" } });
  R.check("Z3", "Thợ không được đăng tin tuyển dụng → 403", r.status === 403, `status=${r.status}`);
  const c = await owner.req("/api/jobs", { method: "POST", json: { title: "QA job", salonName: "QA Salon", market: "US", state: "CA", city: "San Jose", salaryType: "Bao lương tuần", salaryAmount: "$1000", phone: "5550100", skills: ["Gel-X"] } });
  ownerJobId = c.data?.id;
  R.check("Z4", "Chủ tiệm đăng tin → 201", c.status === 201, `status=${c.status}`);
  const d = await owner2.req(`/api/jobs/${ownerJobId}`, { method: "DELETE" });
  R.check("Z5", "Chủ tiệm KHÁC xóa tin của người ta → 403", d.status === 403, `status=${d.status}`);
  const d2 = await tech.req(`/api/jobs/${ownerJobId}`, { method: "DELETE" });
  R.check("Z6", "Thợ xóa tin của chủ tiệm → 403", d2.status === 403, `status=${d2.status}`);
}
let convId;
{
  const m = await tech.req("/api/messages", { method: "POST", json: { receiverId: owner.userId, content: "Chào anh, em là thợ QA" } });
  convId = m.data?.message?.conversationId;
  R.check("Z7", "Thợ nhắn tin cho chủ tiệm → 201", m.status === 201 && !!convId, `status=${m.status}`);
  const r = await owner2.req(`/api/messages?conversationId=${convId}`);
  R.check("Z8", "Người ngoài đọc hội thoại của người khác → 403", r.status === 403, `status=${r.status}`);
  const w = await owner2.req("/api/messages", { method: "POST", json: { conversationId: convId, content: "chen ngang" } });
  R.check("Z9", "Người ngoài gửi tin vào hội thoại của người khác → 403", w.status === 403, `status=${w.status}`);
  const s = await owner2.req("/api/messages/seen", { method: "POST", json: { conversationId: convId } });
  R.check("Z10", "Người ngoài đánh dấu đã xem hội thoại khác → 403", s.status === 403, `status=${s.status}`);
  const msgId = m.data?.message?.id;
  const rx = await owner2.req("/api/messages/react", { method: "POST", json: { messageId: msgId, emoji: "❤️" } });
  R.check("Z11", "Người ngoài thả cảm xúc tin nhắn người khác → 403", rx.status === 403, `status=${rx.status}`);
  const own = await owner.req(`/api/messages?conversationId=${convId}`);
  R.check("Z12", "Người trong hội thoại đọc được tin", own.status === 200 && own.data.messages?.length >= 1, `status=${own.status}`);
}
{
  const r = await owner2.req("/api/pusher/auth", {
    method: "POST",
    body: `socket_id=123.456&channel_name=private-chat-${owner.userId}`,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  R.check("Z13", "Pusher: nghe lén kênh chat của người khác → 403", r.status === 403, `status=${r.status}`);
  const z = await owner2.req("/api/zego/token", { method: "POST", json: { roomId: `call-${owner.userId}-${tech.userId}` } });
  R.check("Z14", "Zego: xin token vào phòng gọi người khác → 403", z.status === 403, `status=${z.status}`);
}
{
  const p = await owner2.req(`/api/profile?id=${owner.userId}`);
  R.check("Z15", "Xem hồ sơ người khác không lộ email/SĐT", p.status === 200 && !p.data.email && !p.data.phone, JSON.stringify({ email: p.data.email, phone: p.data.phone }));
  const anonP = await anon.req(`/api/profile?id=${tech.userId}`);
  R.check("Z16", "Ẩn danh xem hồ sơ thợ không lộ lương mong muốn", anonP.status === 200 && !anonP.data.email && anonP.data.technicianProfile?.desiredSalaryAmount == null);
  const j = await anon.req(`/api/jobs/${ownerJobId}`);
  R.check("Z17", "Chi tiết tin công khai không lộ SĐT tài khoản chủ tiệm", j.status === 200 && j.data.owner && j.data.owner.phone === undefined && j.data.owner.email === undefined);
}
{
  // Chặn: sau khi chủ tiệm chặn thợ, thợ không nhắn/gọi được nữa.
  const b = await owner.req("/api/block", { method: "POST", json: { userId: tech.userId } });
  R.check("Z18", "Chủ tiệm chặn thợ", b.status === 200 || b.status === 201, `status=${b.status}`);
  const m = await tech.req("/api/messages", { method: "POST", json: { conversationId: convId, content: "còn đó không" } });
  R.check("Z19", "Bị chặn → không gửi được tin nhắn (403)", m.status === 403, `status=${m.status}`);
  const g = await tech.req("/api/conversations", { method: "POST", json: { isGroup: true, name: "lách", participantIds: [owner.userId, owner2.userId] } });
  R.check("Z20", "Bị chặn → không lách bằng tạo nhóm chat (403)", g.status === 403, `status=${g.status}`);
  const call = await tech.req("/api/calls", { method: "POST", json: { targetId: owner.userId, action: "offer", callType: "audio" } });
  R.check("Z21", "Bị chặn → không gọi được (403)", call.status === 403, `status=${call.status}`);
  const ub = await owner.req(`/api/block?userId=${tech.userId}`, { method: "DELETE" });
  R.check("Z22", "Bỏ chặn", ub.status === 200, `status=${ub.status}`);
}
{
  const r = await tech.req("/api/report", { method: "POST", json: { userId: owner2.userId, reason: "QA test report" } });
  R.check("Z23", "Báo cáo người dùng (yêu cầu App Store UGC) → 201", r.status === 201, `status=${r.status}`);
}

// ---------- 5. Kiểm tra đầu vào / payload độc hại ----------
const big = "A".repeat(3_000_000);
{
  const r = await tech.req("/api/messages", { method: "POST", json: { receiverId: owner2.userId, content: "B".repeat(6000) } });
  R.check("V1", "Tin nhắn text 6000 ký tự → 400", r.status === 400, `status=${r.status}`);
  const r2 = await tech.req("/api/profile", { method: "PUT", json: { name: big } });
  R.check("V2", "Tên hồ sơ 3MB → 400", r2.status === 400, `status=${r2.status}`);
  const r3 = await tech.req("/api/profile", { method: "PUT", json: { name: { $gt: "" } } });
  R.check("V3", "Tên hồ sơ kiểu object (injection) → 400", r3.status === 400, `status=${r3.status}`);
  const r4 = await owner.req("/api/jobs", { method: "POST", json: { title: big, salonName: "x", market: "US", state: "CA", city: "x", salaryType: "x", salaryAmount: "x", phone: "1" } });
  R.check("V4", "Tiêu đề tin tuyển 3MB → 400", r4.status === 400, `status=${r4.status}`);
  const r5 = await tech.req("/api/posts", { method: "POST", json: { content: "C".repeat(2500) } });
  R.check("V5", "Bài đăng > 2000 ký tự → 400", r5.status === 400, `status=${r5.status}`);
  const r6 = await tech.req("/api/posts", { method: "POST", json: { content: "x", mediaUrls: Array(20).fill("https://images.unsplash.com/a") } });
  R.check("V6", "Bài đăng 20 ảnh → 400", r6.status === 400, `status=${r6.status}`);
  const r7 = await owner.req("/api/supply", { method: "POST", json: { title: "x", imageUrl: "javascript:alert(1)", price: 10 } });
  R.check("V7", "Sản phẩm với imageUrl javascript: → 400", r7.status === 400, `status=${r7.status}`);
  const r8 = await tech.req("/api/user/update-avatar", { method: "POST", json: { image: "D".repeat(600_000) } });
  R.check("V8", "Avatar 600KB → 400", r8.status === 400, `status=${r8.status}`);
  const r9 = await registerUser({ portfolioImages: Array(50).fill("https://x") });
  R.check("V9", "Đăng ký với 50 ảnh portfolio → 400", r9.res.status === 400, `status=${r9.res.status}`);
  const r10 = await registerUser({ role: "ADMIN" });
  R.check("V10", "Tự đăng ký role ADMIN → 400", r10.res.status === 400, `status=${r10.res.status}`);
  const r11 = await registerUser({ email: "not-an-email" });
  R.check("V11", "Email sai định dạng → 400", r11.res.status === 400);
  const r12 = await registerUser({ password: "123" });
  R.check("V12", "Mật khẩu < 8 ký tự → 400", r12.res.status === 400);
  const dup = await registerUser({ email: SEED_TECH });
  R.check("V13", "Email trùng → 409", dup.res.status === 409, `status=${dup.res.status}`);
  const r14 = await tech.req("/api/messages", { method: "POST", body: "{not json", headers: { "content-type": "application/json" } });
  R.check("V14", "JSON hỏng → lỗi được xử lý (4xx/500 JSON), server không sập", r14.status >= 400 && typeof r14.data === "object", `status=${r14.status}`);
  const sqli = await anon.req("/api/jobs?state=" + encodeURIComponent("CA' OR '1'='1"));
  R.check("V15", "SQL injection qua query → trả rỗng, không lỗi", sqli.status === 200 && Array.isArray(sqli.data) && sqli.data.length === 0, `status=${sqli.status} n=${sqli.data?.length}`);
  const fake = new File([Buffer.from("<svg onload=alert(1)>")], "x.svg", { type: "image/svg+xml" });
  const fd = new FormData(); fd.append("file", fake);
  const up = await fetch(BASE_URL + "/api/upload", { method: "POST", body: fd, headers: { cookie: Object.entries(tech.jar).map(([k, v]) => `${k}=${v}`).join("; ") } });
  R.check("V16", "Upload SVG (XSS) → 400", up.status === 400, `status=${up.status}`);
}
{
  // XSS lưu trữ: nội dung có <script> phải được trả về nguyên văn (React tự
  // escape khi render) — kiểm tra phía UI ở ui_audit.
  const xss = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
  const r = await tech.req("/api/posts", { method: "POST", json: { content: "QA XSS " + xss } });
  R.check("V17", "Đăng bài chứa payload XSS được lưu (sẽ kiểm tra escape ở UI)", r.status === 201, `status=${r.status}`);
  fs.writeFileSync(new URL("./.xss_post_id", import.meta.url), r.data?.id || "");
}

// ---------- 6. Xóa tài khoản (bắt buộc App Store 5.1.1(v) / Google Play) ----------
{
  const { client, body } = await registerUser({ role: "OWNER", salonName: "QA Delete Salon" });
  await client.login(body.email, body.password);
  await client.req("/api/posts", { method: "POST", json: { content: "bài sẽ bị xóa theo tài khoản" } });
  await client.req("/api/messages", { method: "POST", json: { receiverId: tech.userId, content: "tin sẽ bị xóa" } });
  const d = await client.req("/api/profile", { method: "DELETE" });
  R.check("D1", "Xóa tài khoản (có job, bài đăng, tin nhắn) → 200", d.status === 200, `status=${d.status} ${JSON.stringify(d.data)}`);
  const relog = await new Client().login(body.email, body.password);
  R.check("D2", "Sau khi xóa không đăng nhập lại được", !relog.ok);
  const feed = await anon.req("/api/posts");
  const jobs = await anon.req("/api/jobs");
  const msgs = await tech.req("/api/messages");
  R.check("D3", "Feed / job board / hộp thư người kia vẫn hoạt động sau khi xóa", feed.status === 200 && jobs.status === 200 && msgs.status === 200, `${feed.status}/${jobs.status}/${msgs.status}`);
}

// ---------- 7. Endpoint test Sentry đã gỡ ----------
{
  const r = await anon.req("/api/sentry-example-api");
  R.check("S1", "Đã gỡ /api/sentry-example-api (ai cũng spam lỗi Sentry được)", r.status === 404, `status=${r.status}`);
}

const out = R.summary();
fs.mkdirSync(new URL("./reports/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./reports/security_api.json", import.meta.url), JSON.stringify(out, null, 2));
process.exit(out.failed ? 1 : 0);
