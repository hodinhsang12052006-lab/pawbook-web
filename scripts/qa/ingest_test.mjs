// Đăng hộ tiệm: tool → /api/ingest/jobs → tin trên PawNail (nhãn, gọi trực tiếp, hết hạn, nhận/gỡ tin).
// Bài & SĐT HƯ CẤU (đầu số 555-01xx). CHỈ chạy với server local.   node scripts/qa/ingest_test.mjs
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Client, Results, registerUser } from "./lib.mjs";

const R = new Results("Đăng hộ tiệm");
const db = createClient({ url: "file:prisma/dev.db" });
const KEY = "test-ingest-key-0123456789abcdef";
const ingest = (posts, key = KEY) => fetch(BASE_URL + "/api/ingest/jobs", { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ posts }) }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
const tag = String(Date.now()).slice(-4);
const n4 = (k) => String(100 + ((Number(tag) + k) % 99)).padStart(4, "0").slice(-4);
const PH1 = `(832) 555-${n4(1)}`, PH2 = `(469) 555-${n4(2)}`;
const POST1 = `CẦN GẤP THỢ BỘT + GEL-X ${tag}\nTiệm Sunny Nails & Spa cần 2 thợ, bao lương $1,300 - $1,600/tuần, bao ăn ở.\n8800 Bellaire Blvd Ste 200, Houston, TX 77036\nGọi ${PH1}`;
const errors = [];
let browser;

try {
  const noKey = await ingest([{ text: POST1 }], "sai-khoa-0000000000000000000");
  R.check("I1", "Sai khoá → 401 (không ai ngoài tool đẩy tin được)", noKey.status === 401);

  const r1 = await ingest([
    { text: POST1, sourceUrl: "https://facebook.com/groups/x/posts/1", postedAt: new Date(Date.now() - 2 * 3600e3).toISOString() },
    { text: `Mình tìm việc nail ở Dallas, ai cần thợ gọi ${PH2}` },
    { text: "Cần thợ nail gấp ở Texas, inbox mình nhé" },
    { text: `Cần thợ dip ở Plano TX, gọi ${PH2}`, postedAt: new Date(Date.now() - 20 * 86400e3).toISOString() },
  ]);
  const rs = r1.data.results || [];
  R.check("I2", "Bài tuyển → tạo tin; bài tìm việc / không SĐT / quá 14 ngày → bỏ qua có lý do", r1.status === 200 && rs[0]?.status === "created" && rs[1]?.status === "skipped" && rs[2]?.reason?.includes("SĐT") && rs[3]?.reason?.includes("cũ"), JSON.stringify(rs));
  const jobId = rs[0]?.jobId;
  const row = (await db.execute({ sql: `SELECT j.salonName, j.phone, j.city, j.state, j.address, j.zip, j.salaryAmount, j.source, j.expiresAt, u.name owner FROM "Job" j JOIN "User" u ON u.id = j.ownerId WHERE j.id = ?`, args: [jobId || ""] })).rows[0];
  R.check("I3", "Tự tách đúng: tên tiệm, SĐT, địa chỉ, Houston TX 77036, lương; đứng tên tài khoản hệ thống (không mạo danh tiệm)", row?.salonName === "Sunny Nails & Spa" && row.phone === PH1 && row.city === "Houston" && row.state === "TX" && row.zip === "77036" && String(row.address).startsWith("8800 Bellaire Blvd") && row.salaryAmount === "$1,300-1,600/tuần" && row.owner === "PawNail · Tin tổng hợp", JSON.stringify(row));

  const r2 = await ingest([{ text: POST1 + "\n(đăng lại)", sourceUrl: "https://facebook.com/groups/x/posts/2" }]);
  const cnt = Number((await db.execute({ sql: `SELECT COUNT(*) n FROM "Job" WHERE phone = ? AND source = 'ingest'`, args: [PH1] })).rows[0].n);
  R.check("I4", "Tiệm đăng lại (cùng SĐT) → làm mới tin cũ, không thành 2 tin", r2.data.results?.[0]?.status === "updated" && cnt === 1, JSON.stringify(r2.data.results));

  const list = await fetch(`${BASE_URL}/api/jobs?market=US&state=TX`).then((r) => r.json());
  const inList = list.find((j) => j.id === jobId);
  R.check("I5", "Hiện trong danh sách việc; KHÔNG lộ link bài gốc / khoá chống trùng", !!inList && inList.source === "ingest" && !("sourceUrl" in inList) && !("sourceKey" in inList));

  // Giao diện
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await p.goto(`${BASE_URL}/jobs/${jobId}`);
  await p.getByText("PawNail đăng hộ theo yêu cầu của tiệm").waitFor({ timeout: 15000 });
  const html = await (await fetch(`${BASE_URL}/jobs/${jobId}`)).text();
  R.check("I6", "Trang tin: nhãn đăng hộ + địa chỉ có link bản đồ + nút Gọi; KHÔNG có 'Nhắn tin qua App'; có 'Tôi là chủ tiệm này'", (await p.getByRole("link", { name: /Bản đồ/ }).count()) > 0 && (await p.getByText(/Gọi ngay/).count()) > 0 && (await p.getByText("Nhắn tin qua App").count()) === 0 && (await p.getByRole("button", { name: "Tôi là chủ tiệm này" }).count()) > 0);
  await p.screenshot({ path: `${process.env.TEMP || "."}/ingest_detail.png`, fullPage: true }).catch(() => {});
  R.check("I7", "Không khai tin đăng hộ cho Google (noindex, không JobPosting)", /noindex/.test(html) && !/"@type":"JobPosting"/.test(html));

  // Tiệm xin gỡ tin (khách vãng lai) → admin duyệt → mất tin + không đăng lại số đó
  await p.getByRole("button", { name: "Gỡ tin này" }).click();
  const dlg = p.getByRole("dialog");
  await dlg.getByPlaceholder(/Tên của bạn/).fill("Chủ tiệm Sunny");
  await dlg.getByPlaceholder(/SĐT hoặc email/).fill("sunny@example.com");
  await dlg.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await p.waitForTimeout(1200);
  const reqRow = (await db.execute({ sql: `SELECT id, kind FROM "JobRequest" WHERE jobId = ? AND handledAt IS NULL`, args: [jobId] })).rows[0];
  R.check("I8", "Bấm 'Gỡ tin này' → lưu yêu cầu cho admin (tin CHƯA bị gỡ ngay — chống người lạ gỡ bậy)", reqRow?.kind === "remove" && !!(await db.execute({ sql: `SELECT id FROM "Job" WHERE id = ?`, args: [jobId] })).rows[0]);

  const a = await registerUser({ name: "QA Ingest Admin" });
  await db.execute({ sql: `UPDATE "User" SET role = 'ADMIN' WHERE email = ?`, args: [a.body.email] });
  await a.client.login(a.body.email, a.body.password);
  const pend = await a.client.req("/api/admin/ingest");
  R.check("I9", "Admin thấy yêu cầu đang chờ", pend.data.requests?.some((x) => x.id === reqRow.id));
  const res = await a.client.req("/api/admin/ingest", { method: "POST", json: { action: "resolve", requestId: reqRow.id, decision: "remove" } });
  const gone = !(await db.execute({ sql: `SELECT id FROM "Job" WHERE id = ?`, args: [jobId] })).rows[0];
  const again = await ingest([{ text: POST1 }]);
  R.check("I10", "Admin duyệt gỡ → tin biến mất; tool đẩy lại số đó → bị chặn", res.status === 200 && gone && again.data.results?.[0]?.reason?.includes("gỡ"), JSON.stringify(again.data.results));

  // Nhận tin: chủ tiệm (đã đăng nhập) → admin chuyển tin
  const PH3 = `(713) 555-${n4(3)}`;
  const c = await ingest([{ text: `Tiệm Lotus Nails ở Houston TX cần thợ chân tay nước, gọi ${PH3}` }]);
  const job2 = c.data.results?.[0]?.jobId;
  const o = await registerUser({ role: "OWNER", name: "Chủ Lotus", salonName: "Lotus Nails" });
  await o.client.login(o.body.email, o.body.password);
  await o.client.req(`/api/jobs/${job2}/request`, { method: "POST", json: { kind: "claim", name: "Chủ Lotus", contact: "lotus@example.com" } });
  const cr = (await db.execute({ sql: `SELECT id FROM "JobRequest" WHERE jobId = ? AND kind = 'claim'`, args: [job2] })).rows[0];
  await a.client.req("/api/admin/ingest", { method: "POST", json: { action: "resolve", requestId: cr.id, decision: "claim" } });
  const j2 = (await db.execute({ sql: `SELECT ownerId, source, expiresAt FROM "Job" WHERE id = ?`, args: [job2] })).rows[0];
  R.check("I11", "Chủ tiệm nhận tin → tin chuyển sang tài khoản của họ, thành tin thường (nhắn tin được, hết nhãn)", j2.ownerId === o.client.userId && j2.source === null && j2.expiresAt === null, JSON.stringify(j2));

  // Hết hạn → tự ẩn khỏi danh sách
  const PH4 = `(281) 555-${n4(4)}`;
  const d = await ingest([{ text: `Cần thợ bột gấp ở Katy TX, gọi ${PH4}` }]);
  const job3 = d.data.results?.[0]?.jobId;
  await db.execute({ sql: `UPDATE "Job" SET expiresAt = ? WHERE id = ?`, args: [Date.now() - 1000, job3] });
  const list2 = await fetch(`${BASE_URL}/api/jobs?market=US&state=TX&x=${Date.now()}`).then((r) => r.json());
  const det = await fetch(`${BASE_URL}/api/jobs/${job3}`).then((r) => r.json());
  R.check("I12", "Quá hạn → tự ẩn khỏi danh sách; mở link cũ thì báo 'đã hết hạn'", !list2.some((j) => j.id === job3) && det.expired === true);

  // Admin dán bài bằng tay
  const ap = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "vi-VN" });
  const u = new URL(BASE_URL);
  await ap.addCookies(Object.entries(a.client.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
  const ap1 = await ap.newPage();
  ap1.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await ap1.goto(BASE_URL + "/admin/studio");
  await ap1.getByTestId("ingest-text").fill(`Hiring nail tech at Rose Nail Lounge, 120 King St, Newtown NSW 2042. $32-36/hr. Call 0412 555 0${n4(5).slice(-2)}`);
  await ap1.getByRole("button", { name: "Xem trước" }).click();
  const prev = ap1.getByTestId("ingest-preview");
  await prev.waitFor({ timeout: 10000 });
  const ptxt = await prev.innerText();
  R.check("I13", "Admin dán bài → xem trước tách đúng (Úc: tên tiệm, NSW, giờ AUD) trước khi đăng", /Rose Nail Lounge/.test(ptxt) && /NSW/.test(ptxt) && /Theo giờ AUD/.test(ptxt), ptxt.slice(0, 200));
  await ap1.getByRole("button", { name: "Đăng hộ" }).click();
  await ap1.getByText("Đã đăng hộ tiệm").waitFor({ timeout: 10000 }).catch(() => {});
  R.check("I14", "Bấm Đăng hộ → tin lên sàn", Number((await db.execute(`SELECT COUNT(*) n FROM "Job" WHERE salonName = 'Rose Nail Lounge' AND source = 'ingest'`)).rows[0].n) === 1);
  R.check("I15", "Không lỗi JS", errors.length === 0, errors.join(" | "));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser?.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
