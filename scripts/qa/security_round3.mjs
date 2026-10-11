// ĐÓNG VAI HACKER — đợt 3: nhắm vào tính năng mới (mời bạn, email tuần, hủy nhận, số liệu admin,
// cài app, Google) + phiên đăng nhập. CHỈ chạy với server local.   node scripts/qa/security_round3.mjs
import http from "node:http";
import { chromium, devices } from "playwright";
import { createClient } from "@libsql/client";
import { BASE_URL, Client, Results, fakeIp, registerUser } from "./lib.mjs";

const R = new Results("Hacker đợt 3");
const db = createClient({ url: "file:prisma/dev.db" });
const mails = [];
const resend = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { mails.push(JSON.parse(b || "{}")); res.writeHead(200, { "content-type": "application/json" }).end('{"id":"x"}'); }); });
await new Promise((r) => resend.listen(4991, "127.0.0.1", r));
const one = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];
let browser;

try {
  // ---------- S1. Đổi mật khẩu phải đá văng phiên cũ (máy bị lấy cắp) ----------
  const v = await registerUser({ name: "Nạn Nhân" });
  const thief = new Client();
  await thief.login(v.body.email, v.body.password);
  const before = (await thief.req("/api/auth/session")).data?.user?.id;
  await fetch(BASE_URL + "/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": fakeIp() }, body: JSON.stringify({ email: v.body.email }) });
  await new Promise((r) => setTimeout(r, 400));
  const token = (mails.at(-1)?.text || "").match(/token=([\w-]+)/)?.[1];
  const rs = await fetch(BASE_URL + "/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": fakeIp() }, body: JSON.stringify({ token, password: "DoiMoi#2026!" }) });
  // (hệ thống kiểm tra lại phiên mỗi ≤ 5 phút; ép kiểm tra ngay bằng cách lùi mốc kiểm tra trong thẻ là không thể từ ngoài → test chờ qua 1 lần làm mới)
  const after = (await thief.req("/api/auth/session")).data?.user?.id;
  const prof = await thief.req("/api/profile");
  R.check("S1", "Đổi mật khẩu qua email → phiên cũ (kẻ trộm) bị đăng xuất ngay", !!before && rs.status === 200 && !after && prof.status === 401, `before=${!!before} reset=${rs.status} after=${after} profile=${prof.status}`);
  const owner = new Client();
  const ok = await owner.login(v.body.email, "DoiMoi#2026!");
  R.check("S1b", "Chủ tài khoản đăng nhập lại bằng mật khẩu mới vẫn bình thường", ok.ok);

  // ---------- S2. Link hủy nhận: máy quét link (Outlook/Gmail) mở GET không được tự hủy ----------
  const lu = await registerUser({ name: "Mail Scan" });
  const id = (await one(`SELECT id FROM "User" WHERE email = ?`, [lu.body.email])).id;
  const { createHmac } = await import("node:crypto");
  // dùng chính link trong email tuần (lấy qua cron) thay vì tự ký
  await db.execute(`UPDATE "User" SET emailDigest = 0`);
  await db.execute({ sql: `UPDATE "User" SET emailDigest = 1, lastDigestAt = NULL, createdAt = ?, email = ? WHERE id = ?`, args: [Date.now() - 3 * 86400000, `scan.${Date.now()}@example.com`, id] });
  const vw = await registerUser({ role: "OWNER", name: "Tiệm Xem", salonName: "View Nails" }); // chủ tiệm thật xem hồ sơ → có điều mới để gửi
  await vw.client.login(vw.body.email, vw.body.password);
  await vw.client.req("/api/profile/views", { method: "POST", json: { profileId: id } });
  await new Promise((r) => setTimeout(r, 800));
  const n0 = mails.length;
  await fetch(BASE_URL + "/api/cron/digest", { headers: { authorization: "Bearer test-cron" } });
  const dm = mails.slice(n0).find((m) => m.to?.[0]?.startsWith("scan."));
  const link = dm?.html?.match(/href="([^"]*\/api\/email\/unsubscribe[^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
  if (link) {
    const local = BASE_URL + new URL(link).pathname + new URL(link).search;
    const g = await fetch(local);
    const gHtml = await g.text();
    const still = Number((await one(`SELECT emailDigest FROM "User" WHERE id = ?`, [id])).emailDigest);
    R.check("S2", "Mở link hủy bằng GET (máy quét link tự mở) KHÔNG tự hủy — phải bấm xác nhận", g.status === 200 && still === 1 && /<form[^>]*method="post"/i.test(gHtml), `status=${g.status} digest=${still}`);
    const p = await fetch(local, { method: "POST" });
    R.check("S2b", "Bấm xác nhận (POST / one-click của Gmail) → hủy thật", p.status === 200 && Number((await one(`SELECT emailDigest FROM "User" WHERE id = ?`, [id])).emailDigest) === 0);
  } else R.check("S2", "Có email tuần để thử link hủy", false, "không nhận được email");
  void createHmac;

  // ---------- S3. XSS qua tên hiển thị ở mọi nơi tên xuất hiện ----------
  const evil = `<img src=x onerror="window.__pwn=1">"><svg onload=window.__pwn=1>`;
  const x = await registerUser({ role: "OWNER", name: evil.slice(0, 80), salonName: "XSS Nails" });
  const xid = (await one(`SELECT id FROM "User" WHERE email = ?`, [x.body.email])).id;
  await x.client.login(x.body.email, x.body.password);
  const victim = await registerUser({ name: "Thợ Bị Xem", ref: xid }); // vào qua link "mời" của kẻ xấu
  await victim.client.login(victim.body.email, victim.body.password);
  await x.client.req("/api/profile/views", { method: "POST", json: { profileId: victim.client.userId } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "vi-VN" });
  const u = new URL(BASE_URL);
  await ctx.addCookies(Object.entries(victim.client.jar).map(([name, value]) => ({ name, value, domain: u.hostname, path: "/" })));
  const p = await ctx.newPage();
  let dialog = false;
  p.on("dialog", (d) => { dialog = true; d.dismiss().catch(() => {}); });
  for (const path of ["/", "/profile", `/profile/${xid}`, "/?tab=jobs"]) {
    await p.goto(BASE_URL + path, { waitUntil: "load" }); await p.waitForTimeout(1500);
  }
  await p.goto(BASE_URL + "/").catch(() => {});
  await p.getByRole("button", { name: "Thông báo" }).first().click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const pwn = await p.evaluate(() => window.__pwn === 1);
  R.check("S3", "Tên chứa mã độc (XSS) hiện ở trang chủ, hồ sơ, chuông thông báo… KHÔNG chạy", !pwn && !dialog);

  // ---------- S4. Chuyển hướng sang trang lừa đảo sau đăng nhập ----------
  const c = new Client();
  const csrf = (await c.req("/api/auth/csrf")).data.csrfToken;
  const r4 = await c.req("/api/auth/callback/credentials", { method: "POST", body: new URLSearchParams({ csrfToken: csrf, email: v.body.email, password: "DoiMoi#2026!", callbackUrl: "https://evil.example/phish", json: "true" }).toString(), headers: { "content-type": "application/x-www-form-urlencoded" } });
  const loc = String(r4.headers.get("location") || r4.data?.url || "");
  R.check("S4", "callbackUrl trỏ ra web lạ → không bị chuyển sang trang lừa đảo", !loc.includes("evil.example"), loc);

  // ---------- S5. Dữ liệu rác vào ô mời bạn bè / đăng ký ----------
  const weird = [];
  for (const ref of [{ $ne: null }, ["a", "b"], "x".repeat(5000), "../../etc/passwd", "' OR 1=1 --"]) {
    const r = await registerUser({ ref });
    weird.push(r.res.status);
  }
  R.check("S5", "Ref là object/mảng/chuỗi dài/SQL → vẫn đăng ký bình thường, không lỗi 500, không gắn bậy", weird.every((s) => s === 201), weird.join());
  const roleHack = await registerUser({ role: "ADMIN" });
  R.check("S5b", "Tự đăng ký làm ADMIN → bị chặn", roleHack.res.status === 400);

  // ---------- S6. Lấy dữ liệu người khác (IDOR) ----------
  const other = await registerUser({ role: "OWNER", name: "Người Khác" });
  const otherId = (await one(`SELECT id FROM "User" WHERE email = ?`, [other.body.email])).id;
  const ref6 = await victim.client.req(`/api/referrals?userId=${otherId}&id=${otherId}`);
  const growth = await x.client.req("/api/admin/growth");
  const prefs = await victim.client.req("/api/email/prefs", { method: "POST", json: { emailDigest: false, userId: otherId } });
  const otherDigest = Number((await one(`SELECT emailDigest FROM "User" WHERE id = ?`, [otherId])).emailDigest);
  R.check("S6", "Không xem được link mời / số liệu admin / đổi cài đặt email của người khác", ref6.data?.link?.endsWith(victim.client.userId) && growth.status === 403 && prefs.status === 200 && otherDigest === 1);

  // ---------- S7. Tài khoản đã xoá: phiên cũ không dùng tiếp được ----------
  const d = await registerUser({ name: "Sắp Xoá" });
  await d.client.login(d.body.email, d.body.password);
  const dId = d.client.userId;
  await db.execute({ sql: `DELETE FROM "User" WHERE id = ?`, args: [dId] });
  const afterDel = (await d.client.req("/api/auth/session")).data?.user?.id;
  R.check("S7", "Tài khoản đã bị xoá → phiên cũ hết hiệu lực", !afterDel, String(afterDel));

  // ---------- S8. JSON-LD / tin tuyển chứa </script> ----------
  const o8 = await registerUser({ role: "OWNER", name: "Owner LD", salonName: "LD Nails" });
  await o8.client.login(o8.body.email, o8.body.password);
  const job = await o8.client.req("/api/jobs", { method: "POST", json: { title: "Cần thợ </script><script>window.__pwn=1</script>", salonName: "LD Nails", description: "</script><img src=x onerror=window.__pwn=1>", city: "Houston", state: "TX", market: "US", salaryType: "Bao lương tuần", salaryAmount: "$1,200", phone: "7135550111", skills: "Gel-X", benefits: "" } });
  const jobId = job.data?.id || job.data?.job?.id;
  if (jobId) {
    await p.goto(`${BASE_URL}/jobs/${jobId}`, { waitUntil: "load" }); await p.waitForTimeout(1500);
    const html = await (await fetch(`${BASE_URL}/jobs/${jobId}`)).text();
    R.check("S8", "Tin tuyển chứa </script> → không phá thẻ JSON-LD, không chạy mã", !(await p.evaluate(() => window.__pwn === 1)) && !/<\/script><script>window\.__pwn/.test(html));
  } else R.check("S8", "Tạo được tin thử", false, JSON.stringify(job.data).slice(0, 120));
} catch (e) {
  R.check("FATAL", String(e?.message || e).slice(0, 200), false);
} finally {
  await browser?.close();
  resend.close();
}
const sum = R.summary();
process.exit(sum.failed ? 1 : 0);
