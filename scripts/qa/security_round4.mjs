// Bảo mật vòng 4 (17/10/2026) — đóng vai kẻ xấu: spam nhắn người lạ hàng loạt, kéo cả trăm người vào nhóm,
// đăng tin tuyển rác hàng loạt, nhét dữ liệu bẩn vào hồ sơ, dò lộ dữ liệu riêng qua API công khai.
// CHỈ chạy với server local (bash scripts/qa/start-launch-server.sh).   node scripts/qa/security_round4.mjs
import { BASE_URL, Client, Results, SEED_OWNER, registerUser } from "./lib.mjs";

if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error("security_round4 chỉ chạy với server local");
const R = new Results("Bảo mật vòng 4 — chống spam & dữ liệu bẩn");
const login = async (body) => { const c = new Client(); await c.login(body.email, body.password); return c; };

// ---------- 1. Spam nhắn người lạ ----------
const spammer = await registerUser({ name: "QA Spammer" });
const sp = await login(spammer.body);
const targets = [], targetC = [];
for (let i = 0; i < 21; i++) {
  const t = await registerUser({ name: `QA Target ${i}` });
  const c = await login(t.body);
  targets.push(c.userId);
  targetC.push(c);
}
const sent = [];
for (let i = 0; i < 20; i++) sent.push((await sp.req("/api/messages", { method: "POST", json: { receiverId: targets[i], content: `Chào chị ${i}, bên em đang tuyển` } })).status);
const over = await sp.req("/api/messages", { method: "POST", json: { receiverId: targets[20], content: "Việc lương cao, ib ngay" } });
R.check("SP1", "Tài khoản mới nhắn 20 người lạ được; người lạ thứ 21 trong ngày → 429 kèm lời giải thích dễ hiểu", sent.every((s) => s === 201 || s === 200) && over.status === 429 && over.data?.code === "COLD_DM_LIMIT" && /mai bạn nhắn tiếp/.test(over.data?.error || ""), JSON.stringify({ sent: [...new Set(sent)], over: over.status, msg: over.data?.error }));
const again = await sp.req("/api/messages", { method: "POST", json: { receiverId: targets[0], content: "Nhắn tiếp người đã nói chuyện" } });
R.check("SP2", "Chạm trần vẫn nhắn tiếp bình thường trong cuộc trò chuyện ĐÃ có (không chặn nhầm chat thật)", again.status === 201 || again.status === 200, String(again.status));
const conv = await sp.req("/api/conversations", { method: "POST", json: { participantIds: [targets[20]] } });
const viaConv = conv.data?.id ? await sp.req("/api/messages", { method: "POST", json: { conversationId: conv.data.id, content: "Lách qua tạo hội thoại trước" } }) : { status: 0 };
R.check("SP3", "Không lách được bằng cách tạo hội thoại trước rồi gửi tin đầu → vẫn 429", viaConv.status === 429, JSON.stringify({ conv: conv.status, msg: viaConv.status }));
const reply = await targetC[1].req("/api/messages", { method: "POST", json: { receiverId: spammer.res.data?.user?.id || sp.userId, content: "Dạ em nghe" } });
R.check("SP4", "Người nhận trả lời lại được bình thường (trả lời không tính là nhắn người lạ)", reply.status === 201 || reply.status === 200, String(reply.status));

// ---------- 2. Nhóm chat kéo cả trăm người ----------
const bigGroup = await sp.req("/api/conversations", { method: "POST", json: { isGroup: true, name: "Việc lương cao", participantIds: targets.slice(0, 21) } });
R.check("GR1", "Tạo nhóm 22 người (kéo hàng loạt người lạ vào để rải tin) → 429", bigGroup.status === 429 && /tối đa 20/.test(bigGroup.data?.error || ""), JSON.stringify({ s: bigGroup.status, e: bigGroup.data?.error }));
const badIds = await sp.req("/api/conversations", { method: "POST", json: { participantIds: [{ $ne: null }] } });
R.check("GR2", "participantIds kiểu object (NoSQL/Prisma injection) → 400, không 500", badIds.status === 400, String(badIds.status));
const okGroup = await sp.req("/api/conversations", { method: "POST", json: { isGroup: true, name: "Nhóm nhỏ", participantIds: targets.slice(0, 3) } });
R.check("GR3", "Nhóm nhỏ bình thường vẫn tạo được", okGroup.status === 201 || okGroup.status === 200, String(okGroup.status));

// ---------- 3. Tin tuyển rác hàng loạt ----------
const owner = await registerUser({ name: "QA Spam Salon", role: "OWNER", salonName: "QA Spam Salon" });
const oc = await login(owner.body);
const jobBody = (i) => ({ title: `QA tuyển thợ ${i}`, salonName: "QA Spam Salon", market: "US", state: "CA", city: "San Jose", salaryType: "Bao lương tuần", salaryAmount: "$1,000", phone: "+1 408 555 0142", skills: ["Bột/Acrylic"], benefits: [] });
const limit = Number(process.env.JOBS_PER_DAY || 60);
let okJobs = 0, firstBlocked = null;
for (let i = 0; i < limit + 1; i++) {
  const r = await oc.req("/api/jobs", { method: "POST", json: jobBody(i) });
  if (r.status === 201 || r.status === 200) okJobs++;
  else { firstBlocked = r; break; }
}
// Tin mồi lúc đăng ký (nếu có) cũng tính vào trần ngày.
R.check("JB1", `Chủ tiệm đăng tới trần ${limit} tin / ngày; tin tiếp theo → 429 kèm lời giải thích`, firstBlocked?.status === 429 && firstBlocked?.data?.code === "JOB_LIMIT" && okJobs >= limit - 1, JSON.stringify({ okJobs, blocked: firstBlocked?.status, msg: firstBlocked?.data?.error }));

// ---------- 4. Dữ liệu bẩn trong hồ sơ ----------
const tech = await registerUser({ name: "QA Dirty Profile" });
const tc = await login(tech.body);
const put = (json) => tc.req("/api/profile", { method: "PUT", json });
const s1 = await put({ technician: { status: "HACKED<script>" } });
const s2 = await put({ avatarUrl: "javascript:alert(document.cookie)" });
const s3 = await put({ technician: { portfolioImages: ["https://res.cloudinary.com/demo/image/upload/sample.jpg", "javascript:alert(1)"] } });
const s4 = await put({ avatarUrl: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" });
const s5 = await put({ technician: { status: "URGENT", portfolioImages: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"] }, avatarUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg" });
R.check("PF1", "Trạng thái thợ lạ → 400; ảnh đại diện javascript: / data:text/html → 400; ảnh tác phẩm javascript: → 400", s1.status === 400 && s2.status === 400 && s3.status === 400 && s4.status === 400, JSON.stringify([s1.status, s2.status, s3.status, s4.status]));
R.check("PF2", "Dữ liệu hợp lệ vẫn lưu bình thường (trạng thái Cần việc ngay + ảnh Cloudinary)", s5.status === 200 && s5.data?.technicianProfile?.status === "URGENT", JSON.stringify({ s: s5.status, st: s5.data?.technicianProfile?.status }));

// ---------- 5. Dò lộ dữ liệu riêng qua API công khai (không đăng nhập) ----------
const anon = new Client();
const ownerSeedId = (await (async () => { const c = new Client(); await c.login(SEED_OWNER); return c.userId; })());
const pub = ["/api/jobs", "/api/technicians", "/api/posts", "/api/activity", "/api/official", "/api/menu/showcase", "/api/designs", "/api/designs/community", "/api/trends", "/api/studio", `/api/profile?userId=${ownerSeedId}`, `/api/menu?userId=${ownerSeedId}`, `/api/client-reviews?techId=${targets[0]}`];
const leaks = [];
for (const p of pub) {
  const r = await anon.req(p);
  const txt = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
  if (r.status >= 500) leaks.push(`${p}: ${r.status}`);
  if (/"password"\s*:|\$2[aby]\$\d\d\$/.test(txt)) leaks.push(`${p}: password/hash`);
  if (/"(surveyAnswers|diagnosedPains|reviewToken|sessionsValidAfter|tokenHash)"\s*:\s*[^n]/.test(txt)) leaks.push(`${p}: private field`);
  if (/[a-z0-9._%+-]+@(qa\.test|gmail\.com|pawnailjobs\.demo)/i.test(txt)) leaks.push(`${p}: email`);
}
R.check("LK1", `${pub.length} API công khai (không đăng nhập): không lộ mật khẩu/hash, email, câu trả lời khảo sát, mã đánh giá; không lỗi 5xx`, leaks.length === 0, leaks.join(" | "));

const s = R.summary();
process.exit(s.failed ? 1 : 0);
