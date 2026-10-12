// Đăng ký xong → tài khoản chính thức (admin) tự có cuộc trò chuyện với người mới: tin "📋 Thông tin
// đăng ký" (đủ thông tin + từng câu trả lời khảo sát) + tin chào mừng. Cả admin lẫn người mới đều thấy.
// CHỈ chạy với server local.   node scripts/qa/welcome_chat_test.mjs
import { createClient } from "@libsql/client";
import { chromium, devices } from "playwright";
import { BASE_URL, Client, DEMO_PASSWORD, Results, fakeIp, registerUser } from "./lib.mjs";

const R = new Results("Tin chào mừng & thông tin đăng ký");
const db = createClient({ url: "file:prisma/dev.db" });
const stamp = Date.now().toString().slice(-7);
// DB local có thể chưa có admin (production luôn có tài khoản chính thức) → tạo 1 admin, chờ hết
// bộ nhớ tạm "chưa có admin" 30 giây của getOfficialAccount.
let official = (await db.execute(`SELECT id, email FROM "User" WHERE role = 'ADMIN' ORDER BY createdAt ASC LIMIT 1`)).rows[0];
if (!official) {
  const a = await registerUser({ name: "PawNail Jobs" });
  await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE email = ?`, args: [a.body.email] });
  official = (await db.execute(`SELECT id, email FROM "User" WHERE role = 'ADMIN' ORDER BY createdAt ASC LIMIT 1`)).rows[0];
  await new Promise((r) => setTimeout(r, 31_000));
}

// 1) Chủ tiệm đăng ký + trả lời đủ 5 câu khảo sát
const owner = new Client();
const email = `welcome.${stamp}@qa.test`;
const survey = ["booking", "turn_tip", "supply_bill", "gps_refund", "crm_qr"].map((key, i) => ({ key, title: key, answer: i % 2 ? "B" : "A", tag: null, answeredAt: new Date().toISOString() }));
const reg = await owner.req("/api/register", { method: "POST", json: { role: "OWNER", market: "US", name: `Lan Tran ${stamp}`, email, password: DEMO_PASSWORD, phone: "+1 7135550123", state: "TX", city: "Houston", salonName: `Lotus Nails ${stamp}`, urgentRole: ["Bột/Acrylic", "Gel-X"], salaryType: "Bao lương tuần", salaryAmount: "$1,200", hasHousing: true, diagnosedPains: [], surveyAnswers: survey } });
R.check("W0", "Đăng ký chủ tiệm thành công", reg.status === 201, JSON.stringify(reg.data).slice(0, 200));
const newId = reg.data?.user?.id;

// Tin được tạo ngay sau khi trả lời (after()) — chờ tối đa 8 giây
let rows = [];
for (let i = 0; i < 16 && rows.length < 2; i++) {
  await new Promise((r) => setTimeout(r, 500));
  rows = (await db.execute({ sql: `SELECT m.body, m.senderId FROM "Message" m JOIN "Conversation" c ON c.id = m.conversationId JOIN "_UserConversations" a ON a.A = c.id AND a.B = ? JOIN "_UserConversations" b ON b.A = c.id AND b.B = ? ORDER BY m.createdAt ASC`, args: [official.id, newId] })).rows;
}
const info = String(rows[0]?.body || "");
const hello = String(rows[1]?.body || "");
R.check("W1", "Admin tự có cuộc trò chuyện với người mới, 2 tin (thông tin + chào mừng), người gửi là tài khoản chính thức", rows.length === 2 && rows.every((r) => r.senderId === official.id), `${rows.length} tin`);
R.check("W2", "Tin 📋 có đủ: vai trò, tên, tiệm, SĐT, email, khu vực, cần tuyển, lương, chỗ ở", info.startsWith("📋 Thông tin đăng ký") && ["Chủ tiệm", `Lan Tran ${stamp}`, `Lotus Nails ${stamp}`, "+1 7135550123", email, "Houston, Texas", "Bột/Acrylic, Gel-X", "$1,200", "Chỗ ở cho thợ: Có"].every((x) => info.includes(x)), info.slice(0, 400));
R.check("W3", "Tin 📋 có ĐỦ 5 câu khảo sát kèm đúng đáp án đã chọn", /Khảo sát \(5\/5 câu\)/.test(info) && (info.match(/→ /g) || []).length === 5, info.slice(info.indexOf("📝"), info.indexOf("📝") + 300));
R.check("W4", "Tin chào mừng: gọi tên + 'cần hỗ trợ gì cứ nhắn ở đây'", hello.startsWith(`Chào mừng Lan Tran ${stamp} đến với PawNail Jobs`) && /cứ nhắn ở đây/.test(hello), hello.slice(0, 160));

// 2) Đăng ký lại / gọi trùng không gửi lặp; thợ đăng ký cũng có tin chào
const tech = new Client();
const regT = await tech.req("/api/register", { method: "POST", json: { role: "TECHNICIAN", market: "AU", name: `Mai Vu ${stamp}`, email: `welcome.t.${stamp}@qa.test`, password: DEMO_PASSWORD, phone: "+61 400000123", state: "NSW", city: "Sydney", specialties: ["Gel-X", "Dip/SNS"], desiredSalaryType: "Theo giờ AUD", desiredSalaryAmount: "$30", desiredBenefits: ["Tip cao"], status: "URGENT", portfolioImages: [] } });
let trows = [];
for (let i = 0; i < 16 && trows.length < 2; i++) {
  await new Promise((r) => setTimeout(r, 500));
  trows = (await db.execute({ sql: `SELECT m.body FROM "Message" m JOIN "_UserConversations" a ON a.A = m.conversationId AND a.B = ? JOIN "_UserConversations" b ON b.A = m.conversationId AND b.B = ? ORDER BY m.createdAt ASC`, args: [official.id, regT.data?.user?.id] })).rows;
}
const tinfo = String(trows[0]?.body || "");
R.check("W5", "Thợ đăng ký: tin 📋 có kỹ năng, lương mong muốn, tình trạng 'Cần việc gấp', khu vực Úc", regT.status === 201 && trows.length === 2 && ["Thợ nail", "Gel-X, Dip/SNS", "$30", "Cần việc gấp", "Sydney, New South Wales (Úc)"].every((x) => tinfo.includes(x)), tinfo.slice(0, 300));

// 3) Giao diện: admin mở Tin nhắn thấy cuộc trò chuyện + tin nhiều dòng giữ xuống dòng; người mới cũng thấy
const browser = await chromium.launch();
async function pageAs(mail, device) {
  const ctx = await browser.newContext({ ...device, locale: "vi-VN" });
  const h = { "cf-connecting-ip": fakeIp() };
  await ctx.route(BASE_URL + "/**", (r) => r.continue({ headers: { ...r.request().headers(), ...h } }));
  const csrf = await (await ctx.request.get(BASE_URL + "/api/auth/csrf", { headers: h })).json();
  await ctx.request.post(BASE_URL + "/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email: mail, password: DEMO_PASSWORD, json: "true" }, headers: h });
  return ctx.newPage();
}
const ownerPage = await pageAs(email, devices["iPhone 13"]);
await ownerPage.goto(BASE_URL + "/messages");
await ownerPage.getByText(/Chào mừng/).first().waitFor({ timeout: 15000 }).catch(() => {});
const ownerSees = (await ownerPage.getByText(/Chào mừng/).count()) > 0;
R.check("W6", "Người mới mở Tin nhắn thấy lời chào từ PawNail Jobs", ownerSees);
await ownerPage.getByText(/Chào mừng/).first().click().catch(() => {});
await ownerPage.getByText("📋 Thông tin đăng ký").first().waitFor({ timeout: 15000 }).catch(() => {});
const ws = await ownerPage.getByText("📋 Thông tin đăng ký").first().evaluate((e) => getComputedStyle(e).whiteSpace).catch(() => "");
R.check("W7", "Tin nhiều dòng hiện đúng từng dòng (không dồn 1 hàng)", /pre-wrap/.test(ws), ws);
await ownerPage.screenshot({ path: process.env.TEMP + "/welcome_chat.png" });
await browser.close();

const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
